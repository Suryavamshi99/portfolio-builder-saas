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

### Files Changed
1. **`API.md`**:
   - Replaced all "Planned (in progress)" sections and integrated all routes into definitive status tables.
   - Removed old `/api/generate`; documented the asynchronous `/api/generations` (+ `/:id`, `/latest`, DELETE cancel), `/api/free/status`, and `/api/cron/*` endpoints with real request/response schemas and error codes.
   - Documented `/api/sites/*` (`check`, `me`, `publish`, `unpublish`, `/api/admin/sites/:slug/unpublish`) and public sandboxed hosting at `/s/<slug>` and `/s/<slug>/images/:image`.
   - Documented `/api/github/*` (`status`, `callback`) and `/api/export/github`.
   - Documented `/api/domains` (GET, POST, DELETE) and `/api/domains/verify`.
   - Documented `/api/mcp/*` (`status`, `connections/:clientId`) and public connector endpoints: `/mcp`, `/authorize`, `/token`, `/register`, `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`.
   - Explicitly marked each endpoint as paid-only (`hasPaidAccess()`) or public.
2. **`README.md`**:
   - Added exhaustive Environment Variables table containing all variables from `.env.example`: `APP_ORIGIN`, `APP_EXTRA_ORIGINS`, `SITES_DOMAIN`, `SITES_BASE_URL`, `CRON_SECRET`, `OPENROUTER_API_KEY`, `FREE_MODEL_OPENROUTER_A..D` with the strict **free-models-only** rule (`:free` suffix enforced in code), `GITHUB_APP_*`, `VERCEL_API_TOKEN`, `SITES_PROJECT_ID`, `VERCEL_TEAM_ID`, `OAUTH_VERCEL_CLIENT_*`, `PAYMENTS_ENABLED`, `DODO_*`, `ADMIN_*`, and waitlist settings.
   - Added comprehensive **Deploying** section detailing the main app project on Vercel, the `shipfolio-sites` project (`sites-app/`, custom domains only), Vercel Cron jobs (`/api/cron/free-queue`, `/api/cron/domains`), Supabase `pg_cron` routines, the rule that developers never apply migrations directly, and the golden deployment rule: *"After every push, check production serves the new code before applying a migration"*.
   - Updated Folder Map with all new backend subsystems (`src/server/generation/`, `src/server/mcp/`, `src/server/github/`, `src/server/domains.ts`, `sites-app/`, and migrations 0001 through 0018).
3. **`docs/ARCHITECTURE.md`**:
   - Added the three generation paths (Path A: Free OpenRouter chain; Path B: Claude/ChatGPT via MCP connector; Path D: Google Gemini BYOK key).
   - Documented the `generation_jobs` lifecycle (`queued` → `reading` → `writing` → `checking` → `saving` → `done`/`failed`), the strict one-active-job-per-user concurrency constraint, and queueing/cron retry execution.
   - Documented hosting architecture at `/s/<slug>` and `sites-app` with the opaque-origin CSP `sandbox` (omitting `allow-same-origin`) and 20s shared edge cache.
   - Documented custom domain provisioning with mandatory DNS TXT ownership proof, anti-squatting protections, and stale record sweeps.
   - Documented the OAuth 2.1 & MCP token model (PKCE S256, SHA-256 token hashing, rotating refresh tokens with 10s reuse tolerance, client registration spoof protections).
   - Documented the table privilege lockdown rule and complete inventory of migrations 0001 through 0018.
4. **`userflow.md`**:
   - Updated Part 1 (Current Flow) diagrams and stages to reflect background generation (`POST /api/generations`), provider selection, path/subdomain hosting, custom domains, and GitHub push.
   - Marked every Part 2 item with its actual shipping status (all core generation, hosting, domain, MCP, and export capabilities are ✅ Built & Shipped; yearly hosting add-on in Dodo is ⏳ Pending Dodo dashboard setup).
5. **`.env.example`** (Comments only):
   - Added comments clarifying the strict `:free` model suffix rule for OpenRouter model variables.
   - Added comments documenting `SITES_BASE_URL` for path-based hosting at `/s/<slug>`.
6. **`docs/handoffs/07f-docs-refresh.md`**:
   - Appended this handoff report.

---

### Verification & Test Suite
- `npx tsc --noEmit -p .`: Passed with 0 errors.
- `npm run lint`: Passed with 0 errors (17 existing warnings in pre-existing UI files).
- `npx vitest run`: Passed 301 tests across 29 test files.
- `npm run build`: Passed production build cleanly in 527ms.
- `git diff main...HEAD --stat`: Shows only the handoff's allowed files.

---

### Spot-Checks of Documented Routes, Env Vars & Tables in Code
- **Routes verified:**
  - `/api/generations`: `src/routes/api/generations.ts`
  - `/api/generations/:id`: `src/routes/api/generations.$id.ts`
  - `/api/generations/latest`: `src/routes/api/generations.latest.ts`
  - `/api/free/status`: `src/routes/api/free.status.ts`
  - `/api/cron/free-queue`: `src/routes/api/cron.free-queue.ts`
  - `/api/cron/domains`: `src/routes/api/cron/domains.ts`
  - `/api/sites/check`: `src/routes/api/sites/check.ts`
  - `/api/sites/me`: `src/routes/api/sites/me.ts`
  - `/api/sites/publish`: `src/routes/api/sites/publish.ts`
  - `/api/sites/unpublish`: `src/routes/api/sites/unpublish.ts`
  - `/api/admin/sites/:slug/unpublish`: `src/routes/api/admin/sites.$slug.unpublish.ts`
  - `/s/<slug>` & `/s/<slug>/images/*`: `src/routes/s.$.ts` & `src/server/sites-serve.ts`
  - `/api/github/status`: `src/routes/api/github/status.ts`
  - `/api/github/callback`: `src/routes/api/github/callback.ts`
  - `/api/export/github`: `src/routes/api/export/github.ts`
  - `/api/domains`: `src/routes/api/domains/index.ts`
  - `/api/domains/verify`: `src/routes/api/domains/verify.ts`
  - `/api/mcp/status`: `src/routes/api/mcp.status.ts`
  - `/api/mcp/connections/:clientId`: `src/routes/api/mcp.connections.$clientId.ts`
  - `/mcp`: `src/routes/mcp.ts`
  - `/authorize`: `src/routes/authorize.ts`
  - `/token`: `src/routes/token.ts`
  - `/register`: `src/routes/register.ts`
  - `/.well-known/oauth-authorization-server`: `src/routes/[.]well-known.oauth-authorization-server.ts`
  - `/.well-known/oauth-protected-resource`: `src/routes/[.]well-known.oauth-protected-resource.ts`
- **Environment variables verified:**
  - `APP_ORIGIN`: `src/config/app.ts`, `src/start.ts`
  - `APP_EXTRA_ORIGINS`: `src/lib/origin.ts`, `src/start.ts`
  - `SITES_DOMAIN`: `src/server/sites.ts`, `sites-app/lib/sites.ts`
  - `SITES_BASE_URL`: `src/server/sites.ts:116`, `sites-app/lib/sites.ts:116`
  - `CRON_SECRET`: `src/routes/api/cron.free-queue.ts:9`, `src/routes/api/cron/domains.ts:7`
  - `OPENROUTER_API_KEY`: `src/config/free-models.ts:28`
  - `FREE_MODEL_OPENROUTER_A..D`: `src/config/free-models.ts:29-56`
  - `GITHUB_APP_*`: `src/server/github/app.ts:26-30`
  - `VERCEL_API_TOKEN`: `src/server/vercel/domains.ts:7`
  - `SITES_PROJECT_ID`: `src/server/vercel/domains.ts:9`
  - `VERCEL_TEAM_ID`: `src/server/vercel/domains.ts:10`
- **Database tables verified:**
  - `users`, `portfolios`, `uploads`, `byok_keys`, `vercel_connections`: `0001_init.sql`
  - `upload_deletion_warnings`, `app_config`: `0002_retention_cron.sql`
  - `purchases`: `0005_payments.sql`
  - `portfolio_inputs`: `0009_portfolio_inputs.sql`
  - `portfolio_versions`: `0011_portfolio_versions.sql`
  - `resume_texts`: `0012_resume_texts.sql`
  - `generation_jobs`, `provider_budgets`: `0013_generation_jobs.sql`
  - `github_connections`, `exports`: `0014_github_connections_exports.sql`
  - `sites`: `0015_sites.sql`
  - `mcp_clients`, `mcp_tokens`: `0016_mcp_oauth.sql`
  - `custom_domains`: `0017_custom_domains.sql`

---

### Security Quotes from Implemented Code

1. **Free Models Only Enforcement (`src/config/free-models.ts:99-102`):**
   ```ts
   // Free tier only: an OpenRouter model that isn't a ":free" variant can bill the account, so it is never used.
   if (def.baseUrl.includes("openrouter.ai") && !model.endsWith(":free")) {
     continue;
   }
   ```

2. **Opaque Origin Sandbox for Hosted Portfolios (`src/server/sites-serve.ts:11`):**
   ```ts
   export const SITES_CSP = `${PUBLISHED_SITE_CSP}; sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox`;
   ```

3. **Short-Lived 20s Shared Edge Cache (`src/server/sites-serve.ts:53`):**
   ```ts
   "Cache-Control": "public, max-age=0, s-maxage=20",
   ```

4. **MCP Token Hashing (`src/server/mcp/oauth.ts:9`):**
   ```ts
   export const hashSecret = (secret: string) => createHash("sha256").update(secret).digest("hex");
   ```

5. **PKCE S256 Enforcement (`src/routes/authorize.ts:45-47`):**
   ```ts
   if (get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9\-._~]{43,128}$/.test(codeChallenge)) {
     return fail("This app didn't use a secure sign-in method (PKCE).");
   }
   ```

---

### Anything Done Differently & Why
- Documented both path-based hosting at `/s/<slug>` on the main domain (used because GoDaddy DNS nameservers cannot support wildcard DNS without full nameserver delegation) and custom domain hosting via `sites-app`.

---

### Open Questions
- **Branch Ancestry & Diff Notice:** Branch `feat/07f-docs-refresh` was branched from `1a2863e` before commits `08a1677` ("fix(security): harden the Claude/ChatGPT connection after review") and `b4e3faf` were committed on `main`. Per rule 3 ("Don't apply migrations, push, merge, rebase or open a PR"), we did not merge `main` into our branch. As a consequence, `git diff main...HEAD --stat` shows only our handoff's allowed files (`.env.example`, `API.md`, `README.md`, `docs/ARCHITECTURE.md`, `userflow.md`, and `07f-docs-refresh.md`), whereas `git diff main --stat` compares against `main` directly and shows the diff from those two commits.
- **Mermaid-cli Rendering:** The local environment does not have Chromium/headless browser binaries installed, so `@mermaid-js/mermaid-cli` execution times out attempting to launch Puppeteer. All Mermaid diagrams were written to adhere to standard syntax (`flowchart TD`, `flowchart LR`, `sequenceDiagram`, `stateDiagram-v2`).
