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

## The contract

[`API.md`](./API.md) is the single source of truth for every endpoint —
request/response shapes, auth requirements, error codes. Antigravity's UI
session should only ever need to read that file, never this repo's DB
schema or server internals.

## Status

Milestone 1 (auth + per-user storage) not yet started — this is currently
just the ported Studio UI running against a hardcoded empty `Content`
placeholder (`src/data/content.ts`). See `API.md`'s Changelog for what's
actually shipped vs. stubbed.
