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

### Summary of Changes
Implemented the full-featured, hardened Admin Console UI across seven tabs with server-side pagination, search, responsive desktop (1280px) and mobile (390px) viewports, and audit-reason confirmation dialogs.

### Files Created and Changed
- `src/routes/admin.tsx`: Replaced single-page interface with tabbed console shell (`?tab=overview|users|sites|jobs|audit|system|security`), URL search param synchronization, session check, 401 unauthenticated redirect to `<SignIn>`, 7 tab panels, `<StepUpDialog>` hook registration, and `<AdminToast>` notification manager.
- `src/lib/admin-api.ts`: Typed client matching 08a Task C and 08c contracts, `AdminApiError` class with `isUnauthorized`, `isNotAvailable` (404), and `isStepUpRequired` (403), step-up retry execution wrapper `executeWithStepUp`, and pure helpers:
  - `validateReason(reason)`: Validates 3–300 trimmed characters.
  - `validateConfirmEmail(email, confirmEmail)`: Case-insensitive match for account deletion.
  - `formatRelativeTime(dateInput, now)`: Clean relative times ("3 hours ago", "just now").
  - `formatExactTime(dateInput)`: Formatted locale timestamps for tooltips.
  - `formatBytes(bytes)`: Formats bytes to B, KB, MB, GB, TB.
  - `calculatePagination(total, page, pageSize)`: Computes page limits and navigation bounds.
  - `formatErrorMessage(err)`: Translates backend codes (`last_admin`, `confirm_mismatch`, `reason_required`, `step_up_required`, `job_finished`, `domain_not_found`) to plain-language user messages.
- `src/lib/admin-stepup.ts`: Temporary stub marked `// replaced by 08c` exporting `requestStepUp(): Promise<boolean>` and listener registration.
- `src/lib/admin-api.test.ts`: Vitest test suite with 43 tests covering pure helpers, URL/query parameter serialization, 401 signed-out signaling, 404 not-available detection, error translation, and step-up retry flows.
- `src/components/admin/SignIn.tsx`: Authentication screen stub marked `// replaced by 08c`.
- `src/components/admin/StepUpDialog.tsx`: Step-up re-authentication modal stub marked `// replaced by 08c`.
- `src/components/admin/SecurityPanel.tsx`: Security tab panel stub marked `// replaced by 08c`.
- `src/components/admin/DestructiveConfirmDialog.tsx`: Reusable destructive action dialog adhering to UX/safety rules:
  - Plain-language title and impact description
  - Reason textarea with character count (3–300 chars, trimmed)
  - Optional `requiredConfirmEmail` requiring exact email typing to enable confirmation
  - Default focus on Cancel button
  - Escape closes, focus trapped via Radix Dialog
  - Backend error display formatted in plain words
- `src/components/admin/StatusBadge.tsx`: Color-coded badges for jobs, sites, domains, plans, and roles.
- `src/components/admin/NotAvailablePanel.tsx`: Neutral panel displayed when backend routes return 404.
- `src/components/admin/EmptyState.tsx`: Empty state component for lists with zero results.
- `src/components/admin/ErrorState.tsx`: Error alert banner with a Retry button.
- `src/components/admin/AdminToast.tsx`: Toast notification stack for mutation success and error feedback.
- `src/components/admin/OverviewTab.tsx`: Primary health overview with stat cards (users total/new 7d/pro/admins, content, sites/domains, system/mcp), capacity warning banner when `oldestQueuedRetryAt` is set, Top Errors (24h) list, and Free Models Today table with usage progress bars and cooldown status.
- `src/components/admin/UsersTab.tsx`: Users management tab with 400ms debounced email search, plan/admin/site filters, server pagination, desktop table and mobile stacked cards, and row selection.
- `src/components/admin/UserDetailDrawer.tsx`: User detail view with uploads list, version history, recent jobs (status, source, provider, error code/message), site & custom domain info, connections (GitHub, Vercel, MCP), raw HTML editor with reason field, portfolio preview in an `<iframe sandbox="" srcDoc=...>`, and audited actions (plan change, admin toggle, MCP revoke, unpublish site, delete account).
- `src/components/admin/SitesTab.tsx`: Sites & custom domains tab with search by slug/owner, status filter, server pagination, desktop table, mobile stacked cards, Unpublish site dialog, and Remove custom domain dialog.
- `src/components/admin/JobsTab.tsx`: Generation jobs tab with status and source filters, server pagination, desktop table, mobile stacked cards, Cancel job action, and Free Model Providers capacity card with Clear Cooldown action.
- `src/components/admin/AuditTab.tsx`: Read-only audit trail with action and target type filters, server pagination, and compact key-value detail tags.
- `src/components/admin/SystemTab.tsx`: System info tab displaying commit revision (first 7 chars), app origin, sites base URL, payments badge, and environment settings checklist with plain-language feature descriptions (never exposing secrets).
- `docs/handoffs/08b-screens/`: Exactly 14 captured screenshots (PNG, all < 120 KB):
  1. `01-overview-1280.png` — Overview tab desktop (1280px)
  2. `02-overview-390.png` — Overview tab mobile (390px)
  3. `03-users-1280.png` — Users tab desktop table (1280px)
  4. `04-users-390.png` — Users tab mobile stacked cards (390px)
  5. `05-user-detail-drawer-1280.png` — User detail drawer with preview & uploads (1280px)
  6. `06-sites-1280.png` — Sites & domains tab desktop (1280px)
  7. `07-sites-390.png` — Sites & domains tab mobile (390px)
  8. `08-jobs-1280.png` — Jobs & providers tab desktop (1280px)
  9. `09-jobs-390.png` — Jobs & providers tab mobile (390px)
  10. `10-audit-1280.png` — Audit log tab desktop (1280px)
  11. `11-audit-390.png` — Audit log tab mobile (390px)
  12. `12-system-1280.png` — System tab desktop (1280px)
  13. `13-security-1280.png` — Security tab desktop (1280px)
  14. `14-destructive-dialog-1280.png` — Destructive account deletion confirmation dialog (1280px)

### Security & Safety Verification
- **Empty-sandbox iframe**: User-supplied portfolio HTML is only ever rendered inside an empty sandbox iframe:
  ```tsx
  <iframe
    title="Portfolio Preview"
    sandbox=""
    srcDoc={detail.portfolio.html}
    className="w-full h-72 border-0 bg-background"
  />
  ```
  `dangerouslySetInnerHTML` is never used.
- **Confirmation dialogs & reasons**: Every destructive action (user delete, takedown, domain removal, plan change, admin toggle, MCP revoke, job cancel, cooldown clear) requires a 3–300 character trimmed reason.
- **Account deletion guard**: Deleting a user requires typing the user's exact email address:
  ```ts
  export function validateConfirmEmail(email: string, confirmEmail: string): boolean {
    return email.trim().toLowerCase() === confirmEmail.trim().toLowerCase();
  }
  ```
  The confirm button remains disabled until the email matches and a valid reason is entered.
- **Step-up re-authentication**: Destructive calls automatically catch `403 step_up_required`, open the `<StepUpDialog>` via `requestStepUp()`, and retry the operation once upon successful verification.
- **No secrets in client or system tab**: The system tab only displays boolean `set` status for environment variables, with no secret values ever returned or rendered. No tokens or sessions are stored in `localStorage`.

### Test Verification
- `npx tsc --noEmit -p .`: Passed with 0 errors (`exactOptionalPropertyTypes: true` satisfied).
- `npm run lint`: Passed with 0 errors (0 warnings on new admin files).
- `npx vitest run`: Passed with 31 test files and 357 tests (including 43 tests in `src/lib/admin-api.test.ts`).
- `npm run build`: Passed cleanly in 1.14s.
- `git diff main --stat`: Confined strictly to listed UI files, components, tests, screens, and documentation.

### Open Questions / Companion Integration Notes
- Handoff 08c stubs in `src/components/admin/{SignIn,StepUpDialog,SecurityPanel}.tsx` and `src/lib/admin-stepup.ts` are marked `// replaced by 08c` for clean replacement upon merging 08c.
- Backend endpoints from 08a Task C are coded to the contract; if any endpoint returns 404 before 08a deployment, the UI displays `<NotAvailablePanel>` rather than failing.
