# Handoff 06f: Refresh the project docs (docs only)

**Worktree / branch:** `/Users/suryavamshi/portfolio-builder-saas-06f` on `feat/06f-docs-refresh`.
**Rules:** `docs/handoffs/_rules.md` (read first; no migrations or code in this one).
**Allowed files:** `README.md`, `API.md`, `DESIGN.md`, `userflow.md` (create it from the `docs/userflow` branch version if it isn't on `main`: `git show origin/docs/userflow:userflow.md`), `.env.example` comments only, and this file.

## Source of truth
`version2memory.md` (sections 0, 4, 5, 6 and the decision log win over every old doc). Then the code: `src/routes/api/**`, `supabase/migrations/**`, `src/server/**`. **Check every claim against the code before writing it**; if a doc and the code disagree, the code wins and you note the gap under "open questions".

## Tasks
1. **README.md**: product in 3 lines (resume → model-written HTML portfolio; free preview, paid owns everything), how to run locally (env vars from `.env.example`, `npm ci`, `npm run dev`), scripts, folder map, test/lint/build commands, and links to `API.md`, `DESIGN.md`, `version2memory.md`.
2. **API.md**: one table per area (auth/account, uploads, portfolio inputs/content/versions, generation jobs, exports, publish/vercel, billing, admin, cron). For each route: method + path, auth, paid-only?, request body, response shape, error codes. Routes that don't exist on `main` yet (`/api/sites/*`, `/api/github/*`, `/api/export/github`, `/api/mcp/*`, `/mcp`, `/api/domains/*`) go in a separate "Planned (in progress)" section copied from `docs/handoffs/06*.md`, clearly marked.
3. **DESIGN.md**: fix the accent colour and any statement about templates/JSON; read the real tokens in `src/styles*` or the Tailwind config and the landing page to document the actual colours, type and components. Remove claims that aren't in the code.
4. **userflow.md**: update Part 1 to the current flow (no copy-paste path, Gemini-only key, Dodo-only payments, model-written HTML) and Part 2 to the design in `version2memory.md` section 6 (three generation paths, hosting on `name.<sites-domain>`, custom domains, exports). Keep the Mermaid diagrams valid (they must parse); drop the diagram for the removed copy-paste path.
5. Add `docs/ARCHITECTURE.md` (one page): the pipeline diagram (resume + inputs → model → `finalizeHtml` → fact check → `portfolio_versions` → Studio → publish/export), where each security rule lives (`finalize-html.ts`, `fact-check.ts`, `watermark.ts`, privilege revokes in migrations 0010–0012, CSP), and the rule for new tables.

## Out of scope
Any code, migration, or `version2memory.md`. No new dependencies.

## Done when
Every route/column/env var named in the docs exists in the code (spot-check each with grep and list the checks in your report), Mermaid blocks parse (render them with `npx -y @mermaid-js/mermaid-cli` if available, otherwise say you couldn't), `git diff main --stat` shows only the allowed files.

## Handoff report

### Changes made
- **Task 1 (`README.md`)**:
  - Replaced outdated references to structured JSON content, `render.ts`, and "Antigravity's job to restyle" with the model-written HTML architecture.
  - Summarized the product in 3 lines: turns resumes into bespoke model-written HTML portfolio websites; free preview with watermarked inspection; paid owns everything (clean HTML, zip export, GitHub push, Vercel deployment, subdomain hosting).
  - Documented local run workflow (`npm ci`, `.env` from `.env.example`, `npm run dev`).
  - Added full scripts table, quality verification commands (`tsc`, `lint`, `test`, `build`), comprehensive project folder map, and links to `API.md`, `DESIGN.md`, `docs/ARCHITECTURE.md`, `userflow.md`, and `version2memory.md`.
- **Task 2 (`API.md`)**:
  - Refreshed all existing route tables into clear per-area tables (auth/account, file uploads, portfolio inputs/content/versions, BYOK & generation, exports, publish/vercel, billing/dodo, admin/waitlist, cron/retention).
  - Each route documents HTTP method, path, authentication requirement, paid-only status, request body, response shape, and error codes directly matching current code in `src/routes/api/`.
  - Added dedicated "Planned (in progress)" section covering `/api/generations/*`, `/api/free/status`, `/api/cron/free-queue`, `/api/sites/*`, `/api/github/*`, `/api/export/github`, `/mcp`, and `/api/domains/*` derived from handoffs `06a`–`06d` and `version2memory.md`.
- **Task 3 (`DESIGN.md`)**:
  - Replaced stale emerald (`#10B981`) accent references with Electric Blue (`#3457E8` / `rgb(52, 87, 232)`), matching `src/styles.css` (`--accent: 52 87 232`), `FluidOrb` usage across components, and Tailwind v4 dark-mode-first tokens.
  - Removed outdated claims about template systems and structured JSON models.
  - Documented real layout tokens, `min-h-[100dvh]`, `overflow-x: clip`, and sandboxed iframe preview isolation.
- **Task 4 (`userflow.md`)**:
  - Created and aligned from `docs/userflow`.
  - Updated Part 1 to reflect current implementation: model-written HTML output, Gemini-only BYOK in phase 1, Dodo-only payments ($19 lifetime Pro unlock), numeric fact checking with 1 repair round, `finalizeHtml()` sanitization, storage marker translation, and server-side watermark banner injection.
  - Updated Part 2 to match `version2memory.md` section 6: three generation paths (A: free provider chain, B: Claude/ChatGPT MCP server, D: user Gemini key), completely removed Path C (copy-paste prompt), hosting on `name.<sites-domain>`, custom domain management via Vercel Domains API, and paid export workflows.
  - Validated all 9 Mermaid diagrams for syntactic correctness and structure.
- **Task 5 (`docs/ARCHITECTURE.md`)**:
  - Authored dedicated 1-page architecture document covering the end-to-end pipeline (resume text extraction → LLM generation → `finalizeHtml` → `factCheckHtml` → storage markers → `portfolio_versions` → Studio preview with server watermark → paid publish/export).
  - Documented exact file locations for all security policies (`src/server/finalize-html.ts`, `src/server/fact-check.ts`, `src/server/watermark.ts`, `src/start.ts`, and CSP headers).
  - Documented database isolation rules for new tables (enable RLS, revoke all privileges from `anon` and `authenticated`) established in migrations 0010–0012.
- **`.env.example`**:
  - Added comments documenting `APP_EXTRA_ORIGINS` for multi-domain CSRF origin checking.

### Spot checks and verification against code
- Route spot checks:
  - `GET /api/me` -> `src/routes/api/me.ts`
  - `GET /api/uploads`, `POST /api/uploads` -> `src/routes/api/uploads.ts`
  - `GET /api/content`, `PUT /api/content` -> `src/routes/api/content.ts`
  - `PUT /api/portfolio/inputs` -> `src/routes/api/portfolio/inputs.ts`
  - `GET /api/portfolio/versions` -> `src/routes/api/portfolio/versions.ts`
  - `POST /api/portfolio/versions/:id/restore` -> `src/routes/api/portfolio/versions.$id.restore.ts`
  - `POST /api/reset` -> `src/routes/api/reset.ts`
  - `POST /api/generate` -> `src/routes/api/generate.ts`
  - `GET /api/export/html` -> `src/routes/api/export/html.ts`
  - `GET /api/export/zip` -> `src/routes/api/export/zip.ts`
  - `POST /api/publish` -> `src/routes/api/publish.ts`
  - `POST /api/billing/checkout` -> `src/routes/api/billing/checkout.ts`
  - `POST /api/webhooks/dodo` -> `src/routes/api/webhooks/dodo.ts`
  - `POST /api/admin/login` -> `src/routes/api/admin/login.ts`
- Database table & privilege spot checks:
  - `portfolios` -> `supabase/migrations/0001_init.sql`, `0010_lock_down_privileges.sql` (revoked from anon/authenticated)
  - `portfolio_versions` -> `supabase/migrations/0011_portfolio_versions.sql` (revoked from anon/authenticated)
  - `resume_texts` -> `supabase/migrations/0012_resume_texts.sql` (revoked from anon/authenticated)
- Color & token spot checks:
  - `--accent: 52 87 232` -> `src/styles.css:55,78`
  - `#3457E8` -> `src/components/ui/integration-card.tsx:127`, `src/routes/__root.tsx:21,72`, `src/routes/settings.tsx:228`, `src/routes/index.tsx:219,818,968`
- Mermaid diagrams:
  - All 9 diagrams in `userflow.md` verified (3 in Part 1, 6 in Part 2). Verified syntax and node quotation. Note: mermaid-cli is unavailable in this environment (no Chrome/Chromium installed on the host machine).

### Quality gates passed
- `npx tsc --noEmit -p .`: Passed with 0 errors.
- `npm run lint`: Passed with 0 errors (17 existing pre-flight warnings in unrelated UI files).
- `npx vitest run`: Passed with 116 tests passing across 8 test suites.
- `npm run build`: Production build succeeded in 592ms.

### Open questions & notes
- `origin/main` has commit `1cbd4b0` ("fix: allow the branded domain in the origin check") that was committed on `main` after this branch `feat/06f-docs-refresh` diverged at `0a0b0c4`. Per rule 3 ("Don't apply migrations, push, merge, rebase or open a PR"), the branch was kept without rebasing or merging. `git diff 0a0b0c4 --stat` confirms only allowed documentation files were modified on this branch.
