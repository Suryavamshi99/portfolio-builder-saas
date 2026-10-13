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
