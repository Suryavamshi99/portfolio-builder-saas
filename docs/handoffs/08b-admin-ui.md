# Handoff 08b: Admin UI: a real admin console

**Worktree / branch:** `/Users/suryavamshi/portfolio-builder-saas-08b` on `feat/08b-admin-ui`. **Rules:** `docs/handoffs/_rules.md` (read first, including the production rule: build and test against mocks; do not create accounts or data on production). UI only: `src/routes/admin.tsx`, new `src/components/admin/**`, new `src/lib/admin-api.ts`. No changes under `src/server/` or `src/routes/api/`, no migrations.
**Companion:** handoff 08a builds the endpoints in parallel. Code to the contracts in `docs/handoffs/08a-admin-backend.md` (Task C) exactly. All calls go through one typed client `src/lib/admin-api.ts`. If an endpoint answers 404 (not deployed yet) show a neutral "Not available yet" panel, never crash. Tests mock `fetch`.

## Plan and auth
Context: `docs/plans/2026-10-14-admin-console-plan.md`. Sign-in, step-up and security UI come from handoff 08c (`src/components/admin/SignIn.tsx`, `StepUpDialog.tsx`, `SecurityPanel.tsx`, `requestStepUp()` in `src/lib/admin-stepup.ts`): import them; if missing, code to those names with temporary stubs marked `// replaced by 08c`. Add a seventh tab **Security** rendering `SecurityPanel`. A `403 step_up_required` from any destructive call opens the step-up dialog, then retries once. Replace the sign-in form with `<SignIn>`; keep the 401→sign-in behavior.

## Read first
`src/routes/admin.tsx` (current single page, its sign-in form and `/api/admin/session` check), `src/components/ui/*` (use existing components: Dialog, Tabs, Badge, Button, Input), `src/routes/settings.tsx` (tab style).

## Layout
Keep the existing admin sign-in (separate from user login). After sign-in show a console with **tabs**: **Overview**, **Users**, **Sites & domains**, **Jobs & providers**, **Audit log**, **System**. Persist the active tab in the URL search param (`?tab=`). Must work at 1280 px and 390 px (tables become stacked cards on phones). Dark theme default like the rest of the app.

## Tabs
1. **Overview** (`GET /api/admin/overview`): stat cards (users total / new 7 d / pro / admins; portfolios; versions; stored MB; published sites; domains by status; jobs last 24 h: done / failed / queued / running with a source split; active MCP connections; payments ON/OFF badge), a "Top errors (24 h)" list, a "Free models today" table (model, used / budget as a small bar, cooldown time or "ready"), and a warning banner when `oldestQueuedRetryAt` is set ("N jobs are waiting for free capacity").
2. **Users** (`GET /api/admin/users`): search box (email, debounced 400 ms), filters (plan, admins only, has published site), server pagination (prev/next, page size 25), columns: email, plan badge, admin badge, created, last portfolio update, storage, site slug (link to its `/s/<slug>` address). Row click opens a **detail drawer/page** (`GET /api/admin/users/:id`): header with email and id; sections Uploads, Versions, Recent jobs (status badge, source, provider, error code + message), Site & domain, Connections (GitHub account, Vercel yes/no, MCP apps), Portfolio preview in an `<iframe sandbox="" srcDoc=...>` (**empty sandbox: no scripts, no same-origin**), and the existing edit-HTML textarea (keep today's behaviour). Actions (each opens a confirmation dialog that requires a **reason** field, 3–300 characters, and shows what will happen): change plan, toggle admin, revoke MCP connections (`POST /api/admin/users/:id/revoke-mcp`), unpublish site (takedown), delete account (**also type the user's email to confirm**; the button stays disabled until it matches). After success reload the data and show a toast; show backend `error.message`s (for example `last_admin`, `confirm_mismatch`) in plain words.
3. **Sites & domains** (`GET /api/admin/sites`): search by slug or owner email, status filter, pagination; columns slug, owner email, status, domain badge, updated; actions **Unpublish** (reason dialog, `POST /api/admin/sites/:slug/unpublish`) and **Remove domain** (reason dialog, `POST /api/admin/domains/remove`); open-site link goes to the `url`.
4. **Jobs & providers** (`GET /api/admin/jobs` + the `freeProviders` part of overview): filters (status, source), pagination, columns time, user email, source, status badge, provider, error code with message on hover/expand; **Cancel** button on queued/running jobs (reason dialog, `POST /api/admin/jobs/:id/cancel`). A providers card with **Clear cooldown** per provider (reason dialog, `POST /api/admin/providers/clear-cooldown`).
5. **Audit log** (`GET /api/admin/audit`): read-only table (time, action, target, reason, detail as compact key/values), filter by action and target type, pagination.
6. **System** (`GET /api/admin/system`): deploy commit (first 7 chars), app origin, sites base URL, payments badge, and a checklist of `settings` (green "set" / red "missing", never any value). Link text: "Missing settings can break features" with the plain-language feature for each (for example OPENROUTER_API_KEY → "Free generation").

## UX and safety rules
- Never render user-supplied HTML outside the empty-sandbox iframe, and never use `dangerouslySetInnerHTML`.
- Every destructive dialog: plain-language title ("Delete account of jane@x.com?"), what it does, the reason field, Cancel (default focus) and a red confirm button; Escape closes; focus is trapped (use the existing Dialog component).
- Loading skeletons, empty states ("No jobs in the last 24 hours"), and error states with a Retry button on every panel.
- Do not store the admin session or any data in `localStorage`; a 401 from any call returns to the sign-in form.
- Dates: relative ("3 h ago") with the exact time in a tooltip.

## Tests
Vitest for `admin-api.ts` (URL, query string, body, 404 → "not available", 401 → signed-out signal) and any pure helpers you extract (pagination math, reason validation, email-confirm matching, relative dates). Check the screens at 1280 px and 390 px with your browser tool against a local `npm run dev` **mocked by stubbing `fetch`** (not production); save screenshots under `docs/handoffs/08b-screens/` (PNG, <400 KB, at most 14).

## Out of scope
Anything on the server, the user-facing app screens, payments, changing the admin sign-in mechanism.

## Handoff report
