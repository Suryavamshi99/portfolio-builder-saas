# Portfol.io — AI Developer Portfolio Builder SaaS

Hosted product: students turn a resume into a live portfolio site either by
prompting a recruiter-grade AI (their own API key) or editing structured fields directly,
then publish it to their own Vercel account.

This repo is the **product** — accounts, per-user storage, the BYOK
extraction endpoint, and the Vercel deploy pipeline. It is separate from
[`surya-vamshi-portfolio`](https://github.com/Suryavamshi99/surya-vamshi-portfolio),
which stays Surya's own single-tenant personal site (Lovable-synced,
deployed to Cloudflare) and is untouched by this project.

The `/studio` editor UI (`src/routes/-studio/*`) is ported from that repo
as the starting point — same form primitives, same content schema shape —
generalized here to read/write a per-user row instead of a static
`content.json` on disk.

## Stack

- **TanStack Start** (React 19, TanStack Router file-based routes), Vite 8
- **Supabase** — Auth, Postgres (per-user Content rows), Storage (uploads),
  pg_cron (retention jobs)
- **Vercel** — hosts this app, and is the deploy target for every published
  user site (OAuth + Deployments API)
- Tailwind v4 + a handful of shadcn/ui primitives (Button/Input/Textarea) —
  placeholder styling only; visual design is Antigravity's job

## Commands

```sh
npm install
npm run dev      # vite dev server
npm run build    # production build
```

## Setup (Supabase)

This app needs its own Supabase project — nothing here provisions one for
you:

1. Create a project at [supabase.com](https://supabase.com).
2. Run the migrations in `supabase/migrations/` against it, in order (via
   the Supabase CLI's `supabase db push`, or paste each file into the SQL
   Editor). `0002_retention_cron.sql` needs the `pg_cron` extension, which
   Supabase provides but doesn't enable by default — enable it in
   Database → Extensions first if `create extension` fails.
3. Copy `.env.example` to `.env` and fill in the Supabase URL + keys (Project
   Settings → API), a generated `ENCRYPTION_KEY` (command is in the example
   file's comment), and `APP_ORIGIN` (this app's own deployed URL).
4. Register a Vercel OAuth app (needed for "Connect Vercel" / Publish) and
   set its redirect URI to `${APP_ORIGIN}/api/vercel/oauth/callback`; put the
   resulting values in `.env` as `OAUTH_VERCEL_CLIENT_ID`/`OAUTH_VERCEL_CLIENT_SECRET`
   — **not** `VERCEL_CLIENT_ID`/`VERCEL_CLIENT_SECRET`; Vercel's own
   dashboard rejects any custom environment variable starting with
   `VERCEL_` at project-import time ("Environment variable ... is
   invalid"), since it reserves that whole prefix for its own system
   variables. The endpoint shapes (`src/config/vercel.ts`) are verified
   against Vercel's official docs, but still not exercised against live
   traffic — no registered app in the environment that built this.
5. Deploy the Storage-cleanup Edge Function the retention cron depends on:
   ```sh
   supabase functions deploy purge-storage-objects
   supabase secrets set CRON_SECRET=$(node -e "console.log(require('node:crypto').randomBytes(24).toString('base64url'))")
   ```
   Then populate `public.app_config` (SQL Editor) with that same secret and
   the function's URL — see the comment at the top of
   `0003_storage_cleanup.sql` for the exact `insert` statement. Skipping this
   step doesn't break anything else; the retention cron just logs a warning
   and leaves Storage objects orphaned (safe, just not reclaimed) until it's
   done.
6. Create a Dodo Payments product (one-time price, **not** recurring —
   $19 by default, see `PRO_PRICE_USD` in `src/config/plans.ts` if you
   change it) and a webhook endpoint pointed at
   `${APP_ORIGIN}/api/webhooks/dodo`. Put the API key, the product's
   `pdt_...` id, and the webhook's `whsec_...` signing secret into `.env`
   as `DODO_PAYMENTS_API_KEY` / `DODO_PRODUCT_ID_PRO` / `DODO_WEBHOOK_SECRET`.
   Dodo's merchant onboarding form asks for a real website URL, so this
   step needs the app actually deployed somewhere first — can't be done
   against `localhost`.

## The contract

[`API.md`](./API.md) is the single source of truth for every endpoint —
request/response shapes, auth requirements, error codes. Antigravity's UI
session should only ever need to read that file, never this repo's DB
schema or server internals.

## Status

**All six milestones are shipped, including payments** — `POST
/api/billing/checkout` + `POST /api/webhooks/dodo` (Dodo Payments, a
one-time $19 lifetime unlock, not a subscription), plus `POST /api/reset`
("start over" — added later as a product requirement, see API.md). All
backed by real Supabase tables, RLS policies, and Storage.

One thing that changed along the way, worth knowing before treating "Pro"
as flexible: the original pricing pitch included "unlimited portfolios" as
a Pro benefit, but the schema only supports one portfolio per user, for
everyone — `portfolios.user_id` is the primary key. That's a real future
feature (a genuine schema change touching most content-facing endpoints +
the frontend), not something Pro currently unlocks. Pro instead gates
storage quota (250MB vs. 50MB), generation/upload rate limits, and the
"Published with Portfol.io" badge on the live site — see `src/config/plans.ts`.

**The frontend is built too** (by Antigravity, not this session) — login/
signup, the onboarding wizard, BYOK key management with per-provider setup
help, Studio restyled, live preview, and the publish flow. On top of that,
this session added: `/studio` is gated behind having a ready portfolio
(profile has real content) rather than being reachable immediately after
sign-in — a brand-new or freshly-reset account lands on the wizard by
default; a confirmation step before regenerating warns that it re-calls the
BYOK provider and overwrites the current draft; and Settings has a "Danger
Zone" to wipe a draft + its uploads back to blank (keeping connected API
keys) via `POST /api/reset`.

**Runtime-verified against a real, live Supabase project** as of this
session — migrations applied successfully, sign-up/email-confirmation flow
confirmed working end to end against real Supabase Auth.

Highlights: uploads are validated server-side by magic-byte sniffing (never
client-reported type), size-capped, quota- and rate-limited, and images are
stripped of EXIF/GPS via `sharp` before storage. BYOK keys and Vercel OAuth
tokens are both AES-256-GCM encrypted at rest with the same module
(`src/lib/crypto.ts`). `/api/generate` extracts resume text server-side
(`pdf-parse`/`mammoth`) before it ever reaches an LLM, applies the guardrail
system prompt verbatim, and validates the model's output against the same
zod schema Studio uses. `/api/publish` renders `Content` through a plain
static-HTML template (`src/server/template/render.ts` — functionally
complete, visually minimal on purpose; Antigravity's job to restyle),
embeds any images that resolve to our own Storage directly into the deploy
bundle rather than linking back to it, and pushes the result to the user's
Vercel account. Both upload and generation rate limits are real rolling-hour
checks (`src/server/rate-limit.ts`), not estimates. A global CSRF Origin
check (`src/start.ts`) now covers every non-GET request across the whole
app, not just the endpoints built after it was added.

The retention cron's Storage-object deletion gap (flagged after milestone
2b) is closed: `supabase/functions/purge-storage-objects/` (a Deno Edge
Function, deployed separately — see Setup) is invoked via `pg_net` from
`0003_storage_cleanup.sql`, fire-and-forget by design. Also corrected while
building milestone 5: `uploads.published` was wrongly implemented (in
milestone 1, before publish existed to clarify the brief's intent) to
permanently exempt a row from the 30-day inactivity purge — the actual rule
is that publishing copies bytes into the Vercel bundle, which is what
protects a live site, so our copy becomes disposable under the same 30-day
rule either way. Fixed in the migrations; see their comments.

Also fixed since the frontend build: two model ids had actually gone
stale — `gemini-2.0-flash` was shut down by Google outright (a real
production break for anyone picking that provider, not just a cosmetic
staleness issue), `gpt-4o` was deprecated — both replaced and verified
against each provider's current docs. And a real gap in the Vercel
integration: the OAuth token response's `team_id` (set when installed on a
Vercel Team, not a personal account) was never captured, so every API call
after connecting would 403 for a team install — fixed via a new migration
and threaded through every call in `src/server/vercel/deploy.ts`.

**Still not runtime-verified**: real BYOK provider keys (the actual LLM
calls), the entire Vercel OAuth/Deployments flow (endpoint shapes are now
confirmed against Vercel's official docs, but not exercised against live
traffic — no registered OAuth app in this environment), and the entire Dodo
Payments flow (same reason — no live product/webhook registered here
either). `vite build` (client+SSR) and `tsc --noEmit` stay clean after every
change; standalone smoke tests confirmed both `pdf-parse` and `mammoth`
actually extract text from real (hand-built) PDF and DOCX buffers.
