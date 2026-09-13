# Portfolio Builder — SaaS

Hosted product: students turn a resume into a live portfolio site either by
prompting an AI (their own API key) or editing structured fields directly,
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
   Settings → API) and a generated `ENCRYPTION_KEY` (command is in the
   example file's comment).
4. Deploy the Storage-cleanup Edge Function the retention cron depends on:
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

Milestones 1, 2, 2b, 3, and 4 are live: `GET /api/me`, `GET/PUT /api/content`,
`POST/GET /api/uploads`, `DELETE /api/uploads/:id`, `POST/GET /api/byok-keys`,
`DELETE /api/byok-keys/:provider`, `POST /api/generate` — all backed by real
Supabase tables, RLS policies, and Storage. Uploads are validated server-side
by magic-byte sniffing (never client-reported type), size-capped, quota- and
rate-limited, and images are stripped of EXIF/GPS via `sharp` before storage
(`src/server/uploads.ts`). BYOK keys are AES-256-GCM encrypted at rest
(`src/lib/crypto.ts`); `/api/generate` extracts resume text server-side
(`pdf-parse`/`mammoth`) before it ever reaches an LLM, applies the guardrail
system prompt verbatim, and validates the model's output against the same
zod schema Studio uses before saving it as a draft. Both upload and
generation rate limits are real rolling-hour checks (`src/server/rate-limit.ts`),
not estimates. Not yet built: Vercel OAuth + publish (5) — see `API.md`'s
Changelog for exact shape details as each piece shipped. There is no login UI
yet (Antigravity's job); `/studio` will show "sign in to edit" for anyone
without a Supabase session.

The retention cron's Storage-object deletion gap is closed:
`supabase/functions/purge-storage-objects/` (a Deno Edge Function, deployed
separately — see Setup step 4) is invoked via `pg_net` from
`0003_storage_cleanup.sql`. It's best-effort/fire-and-forget by design — a
failed call leaves an orphaned Storage object with no DB row pointing at it,
which is safe (nothing references it) but not immediately reclaimed.

**Not runtime-verified**: none of milestones 1–4 have been exercised against
a live Supabase project or real provider API keys — no credentials exist in
this environment. Verified so far: `vite build` (client+SSR) and
`tsc --noEmit` clean after every change, plus a standalone smoke test
confirming `pdf-parse` actually extracts text from a real (hand-built)
PDF buffer. DOCX extraction via `mammoth` and all three LLM provider calls
are implementation-reviewed but not executed.
