# Handoff 07f: Bring the docs up to date with what shipped (docs only)

**Worktree / branch:** `/Users/suryavamshi/portfolio-builder-saas-07f` on `feat/07f-docs-refresh`. **Rules:** `docs/handoffs/_rules.md` (no code, no migrations). **Allowed files:** `README.md`, `API.md`, `DESIGN.md`, `userflow.md`, `docs/ARCHITECTURE.md`, `.env.example` (comments only), and this file.

## Why
Handoff 06f wrote these docs before the hosting, GitHub, MCP, custom-domain and job work was merged. Several routes were listed as "Planned" and some facts changed.

## Source of truth
The code on `main` (`src/routes/**`, `supabase/migrations/**`, `src/server/**`, `sites-app/`) and `version2memory.md` (its decision log, newest first, wins). Verify every claim with grep before writing it.

## Tasks
1. `API.md`: move everything from "Planned" into the real tables with the actual request/response/error codes read from the route files: `/api/generations` (+ `/:id`, `/latest`, DELETE cancel), `/api/free/status`, `/api/cron/*`, `/api/sites/*`, `/s/<slug>` (public hosted pages), `/api/github/*`, `/api/export/github`, `/api/domains*`, `/api/mcp/*`, and the connector endpoints `/mcp`, `/authorize`, `/token`, `/register`, `/.well-known/*`. Remove the old `/api/generate` if it is still mentioned. Mark which routes are paid-only and which are public.
2. `README.md`: update the env var table from `.env.example` (APP_ORIGIN, APP_EXTRA_ORIGINS, SITES_DOMAIN, SITES_BASE_URL, CRON_SECRET, OPENROUTER_API_KEY and the `FREE_MODEL_OPENROUTER_A..D` settings with the **free-models-only** rule, GITHUB_APP_*, VERCEL_API_TOKEN, SITES_PROJECT_ID, VERCEL_TEAM_ID), and add a "Deploying" section: main app project, the `shipfolio-sites` project (root `sites-app/`, custom domains only), cron jobs, how migrations are applied (never by developers; reviewed first), and the rule "after every push, check production serves the new code before applying a migration".
3. `docs/ARCHITECTURE.md`: add the three generation paths (free chain, Gemini key, Claude/ChatGPT via MCP), the job lifecycle (statuses, one active job per user, queue + cron), hosting (`/s/<slug>` with the CSP `sandbox` and why), custom domains (TXT proof before anything is served), and the OAuth/MCP token model (hashes only, rotating refresh tokens with reuse detection). Keep Mermaid diagrams valid.
4. `userflow.md`: update Part 1 (current flow) to match; mark which Part 2 items are now built.
5. List any doc-vs-code mismatch you could not resolve under "open questions".

## Done when
Every route, env var and table named in the docs exists in the code (list your spot-checks in the report), Mermaid blocks parse (render with `npx -y @mermaid-js/mermaid-cli` if available, otherwise say so), `git diff main --stat` shows only the allowed files.

## Handoff report
