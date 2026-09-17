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
   resulting `VERCEL_CLIENT_ID`/`VERCEL_CLIENT_SECRET` in `.env`. The exact
   registration flow and the OAuth/Deployments API endpoints this app calls
   (`src/config/vercel.ts`) weren't verified against live Vercel traffic when
   built — check `API.md`'s milestone 5 section before relying on this.
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

## The contract

[`API.md`](./API.md) is the single source of truth for every endpoint —
request/response shapes, auth requirements, error codes. Antigravity's UI
session should only ever need to read that file, never this repo's DB
schema or server internals.

## Status

**All six milestones' endpoints exist** (payments intentionally excluded —
see below), plus `POST /api/reset` ("start over" — added later as a product
requirement, see API.md) — all backed by real Supabase tables, RLS policies,
and Storage.

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

**Milestone 6 (payments) is deliberately not started** — `users.plan` is the
only forward-looking surface (`"free"`, unenforced), per the brief.

**Still not runtime-verified**: real BYOK provider keys (the actual LLM
calls), and the entire Vercel OAuth/Deployments flow — the latter carries
real uncertainty (see `API.md`'s milestone 5 section) since there's still no
way to confirm Vercel's current API shapes against live traffic without a
registered OAuth app. `vite build` (client+SSR) and `tsc --noEmit` stay
clean after every change; a standalone smoke test confirmed `pdf-parse`
extracts text from a real (hand-built) PDF buffer. DOCX extraction via
`mammoth` is still implementation-reviewed only, not executed.
