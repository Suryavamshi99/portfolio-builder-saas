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

## The contract

[`API.md`](./API.md) is the single source of truth for every endpoint —
request/response shapes, auth requirements, error codes. Antigravity's UI
session should only ever need to read that file, never this repo's DB
schema or server internals.

## Status

Milestones 1, 2, and 2b are live: `GET /api/me`, `GET/PUT /api/content`,
`POST/GET /api/uploads`, `DELETE /api/uploads/:id` — all backed by real
Supabase tables, RLS policies, and Storage. Uploads are validated server-side
by magic-byte sniffing (never client-reported type), size-capped, quota- and
rate-limited, and images are stripped of EXIF/GPS via `sharp` before storage
(`src/server/uploads.ts`). Not yet built: BYOK extraction (3), rate limiting
on generation (4), Vercel OAuth + publish (5) — see `API.md`'s Changelog for
exactly what's shipped vs. stubbed. There is no login UI yet (Antigravity's
job); `/studio` will show "sign in to edit" for anyone without a Supabase
session. One known gap: the retention cron's Storage-object deletion is a
TODO in `0002_retention_cron.sql` — it deletes the DB row but not yet the
underlying file, pending an Edge Function.
