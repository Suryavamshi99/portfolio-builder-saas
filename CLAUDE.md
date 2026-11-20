# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Shipfolio: a SaaS that turns a resume into a model-written, self-contained HTML portfolio. TanStack Start (SSR, Vite) + Supabase (Postgres, Auth, Storage) + Vercel. `README.md` has the env var table and deploy notes; `docs/ARCHITECTURE.md` is the authoritative pipeline and security spec; `DESIGN.md` is the UI contract.

## Commands

```sh
npm ci
npm run dev                         # vite dev, http://localhost:3000
npx tsc --noEmit -p .               # typecheck
npm run lint                        # eslint, must be 0 errors
npx vitest run                      # whole suite (npm test)
npx vitest run src/server/themes/gate.test.ts      # one file
npx vitest run -t "name of the test"               # one test by name
npm run build                       # production client + SSR build
```

Run typecheck, lint, tests and build before a PR. Do not run `npm run format` over the repo: Prettier rewrites whole files. Match each file's existing style instead.

## Architecture (the parts that span files)

**Generation pipeline.** A portfolio is one HTML document written by a model, never a fixed template with JSON slots. Three paths feed the same post-processing:
- Free chain (`src/server/generation/pipeline/`): small saved steps (plan, design, hero, per-section, assemble) so free models can finish. State is in `generation_jobs.params.pipeline`; a lease plus `GET /api/cron/generation-advance` continues long builds; the status poll restarts stalled ones. Code fallbacks guarantee a build finishes using only resume text.
- BYOK Gemini (`src/server/llm/google.ts`), key envelope-encrypted with `ENCRYPTION_KEY`.
- MCP connector (`src/routes/mcp.ts`, `src/server/mcp/`): the user's own Claude/ChatGPT writes the HTML and saves it through `save_portfolio_html`, or, for themed looks, writes curated facts that `build_themed_portfolio` verifies and renders (`src/server/mcp/themed.ts`).

All paths then run `finalizeHtml()` (sanitise, Google Fonts only) and `factCheckHtml()` (numbers, %, $, years must appear in the resume; one repair round). The fact checker ignores `<script>`/`<style>` text (`visibleText`), so anything drawn at runtime needs its own check. The resume is the only source of facts.

**Themes (`src/server/themes/`).** Each of the 13 looks is a real template (`templates/themes/<id>.ts`): a pure function from `PortfolioFacts` (`facts.ts`) plus `Customisations` (accent, font, hidden/order sections) to one self-contained page. Empty sections are hidden, never filled with placeholders. The facts come from `extract-facts.ts` (model extraction, then `verifyFacts` against the resume, details and links; a no-model heuristic fallback). `curate-facts.ts` then rewords text to fit the look under per-field checks. `generation/themed-build.ts` wires this into free and Gemini jobs: any failure falls back to the older brief path (`designBriefFor`, reference text under `reference/`) with a warning. Theme id and customisations live in `generation_jobs.params.theme`, so there is no DB change. **All templates are OFF unless `TEMPLATES_ENABLED=true`** (`src/config/templates.ts`; taken down 2026-11-21 at the design owner's request; the public sample sites, thumbnails and /themes gallery were removed, restore them from git before re-enabling). Templates are limited to verified `@mastersunion.org` accounts (and admins) via `themes/audience.ts`; free vs paid is then enforced server-side via `checkThemeAccess`. Company look and Custom stay open to everyone. Adding or changing a template: `templates/templates.test.ts` is the shared gate (sample-text ban list, one self-contained page, no empty sections). Sample sites under `public/theme-previews/<id>/` are untrusted-origin preview data; do not run npm/build in them. Roster and tiers: `docs/themes/roster.md`.

**Studio editing (`src/components/preview/`, `src/server/portfolio-edit.ts`).** "Edit text and photos" makes visible text editable inside the sandboxed preview frame (postMessage, per-session token, `inline-editor.ts`). Saves go to `PUT /api/portfolio/html`, which strips editor leftovers and the watermark, runs `finalizeHtml`, allows only the user's own storage images, refuses stale saves and records a version. The numbers fact check is deliberately not run on the user's own edits.

**Serving and isolation.** Published pages are served under an opaque-origin CSP (`src/server/site-csp.ts`: inline scripts only, no fetch, no external scripts, fonts only from Google Fonts). `/s/<slug>` is path hosting from the main app; custom domains go to a second Vercel project, `sites-app/` (`shipfolio-sites`), which serves from the Supabase `sites` bucket. Studio previews are sandboxed iframes with a watermark unless the user has paid access.

**Payments.** Dodo hosted checkout (`/api/billing/checkout`); the plan only flips from the signed webhook `/api/webhooks/dodo` (never from the return URL). `paymentsEnabled()` is a kill switch: when `PAYMENTS_ENABLED=false`, `hasPaidAccess` and `hasHostingAccess` return true for everyone. `PAYMENT_TEST_MODE=dummy` swaps in a fake checkout and is disabled in production. Outside India: $9 then $7.99/yr; India: ₹499 one-time with manual ₹449/yr renewal.

**Crons** (`vercel.json`, all need `Authorization: Bearer $CRON_SECRET`): free-queue, domains, hosting. Supabase `pg_cron` + Edge Functions purge uploads.

**Data access.** Server code reads env inside handlers, never at module scope. Privileged tables are written with the service-role client (`src/lib/supabase/admin.ts`); `authMiddleware` supplies the user-scoped client. Tests use fakes, not the real database.

## Rules that are easy to break

- **Database changes need the owner's approval first.** Explain the change, get a yes, then apply. Draft unapproved SQL in `supabase/pending/` (not `supabase/migrations/`). After any push, confirm production serves the new code before applying a migration (a "Production" build may not be live yet).
- Do not deploy, change production env vars or toggle payments unless explicitly told to. Verify production after a deploy by probing something unique to the new build.
- **Company look.** If the user opted into a company look, the FIRST build must already follow that company's site (layout, colours, type feel, UI patterns) with the user's own details. Never build a generic or themed page first and wait to be corrected. If the user did not opt in, no company look is applied. Opt-in is the wizard toggle or the user explicitly asking in chat for a company's look, never inferred from a resume mentioning a company. This holds on every path: free/Gemini (`run-job.ts`) and the connector (`params.replica` on the MCP job, read by `get_portfolio_brief`, guarded in `checkAndSave`). On the connector the opt-in carries over to revisions until the wizard clears it. Every replica page gets `applyReplicaGuard` (disclaimer, noindex, no company-hosted graphics).
- Free OpenRouter model ids must end in `:free` (`src/config/free-models.ts` drops anything else so it can never bill).
- The working tree usually holds unrelated untracked files (marketing, showreel, `.claude/`, `brag-output/`, `supabase/pending/`). Stage only files you changed, by name; never `git add -A` or `git add .`.
- No original persona names, photos, logos or voice widgets from downloaded sample sites in anything shipped.
