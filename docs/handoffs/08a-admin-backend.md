# Handoff 08a: Admin backend: overview, search, jobs, sites, providers, audit log

**Worktree / branch:** `/Users/suryavamshi/portfolio-builder-saas-08a` on `feat/08a-admin-backend`. **Rules:** `docs/handoffs/_rules.md` (read first, including the new production rule). **Migration number:** `0019_admin_audit_log.sql` (do not apply).
**Reviewer:** Claude Code reviews this **line by line**: it is the owner's most powerful surface (it can read every user's data and delete accounts). Follow the safety rules below exactly.
**Companion:** handoff 08b builds the UI against the contracts in this file at the same time; keep the response shapes exactly as written.

## Read first
`src/server/admin-middleware.ts`, `src/lib/admin/*`, every file in `src/routes/api/admin/`, `src/server/admin-users.ts`, `src/server/admin-rate-limit.ts`, `src/server/generation/jobs.ts`, `src/config/free-models.ts`, `src/server/mcp/store.ts` (`revokeConnection`), `src/server/vercel/domains.ts`, `src/server/sites-storage.ts`.

## Safety rules (apply to every route in this handoff)
1. Every route uses `adminMiddleware` exactly like the existing admin routes. Reads are `GET`; anything that changes data is `POST`/`PATCH`/`DELETE` (the Origin check in `src/start.ts` already protects those).
2. **Every change is written to the audit log** (below) in the same request, after the change succeeds. A failed audit write is logged with `console.error` but does not undo the change.
3. The audit log and all responses **never contain**: secrets, tokens, API keys, password hashes, storage signed URLs, or full HTML (store sizes/counts instead).
4. Destructive actions require a `reason` string (3–300 characters, trimmed) in the body: user delete, site takedown, domain removal, plan change to or from `pro`, admin-flag change, MCP revoke, job cancel. Missing reason → `400 reason_required`.
5. Deleting a user also requires `confirmEmail` in the body equal (case-insensitive) to the user's email → else `400 confirm_mismatch`. An admin cannot delete their own account, and the last remaining admin cannot lose the admin flag or be deleted (`409 last_admin`). (The admin panel's own login is separate from Supabase: "own account" means a `users` row with `is_admin = true` that you are about to delete when it is the only one; implement as: refuse deleting or demoting any admin if the number of admins would drop to zero.)
6. All lists are paginated server-side: `page` (1-based, default 1), `pageSize` (default 25, max 100). Response always includes `{ page, pageSize, total }`.
7. Never render or return user HTML except in the existing `GET /api/admin/users/:id` field `portfolio.html`.

## Plan and auth
Context: `docs/plans/2026-10-14-admin-console-plan.md`. Sign-in v2 (TOTP, step-up, lockout) is handoff 08c, not here. Destructive routes (user delete, takedown, admin-flag change, plan change to/from pro, domain remove, MCP revoke) must call `requireStepUp()` exported by 08c from `src/server/admin-middleware.ts`; until 08c merges, add a local stub marked `// replaced by 08c` that always passes. Job cancel and provider clear-cooldown need a reason but no step-up. Login events use `target_type = 'system'`. Migration 0019 is yours; 08c uses 0020.

## Task A: Migration `supabase/migrations/0019_admin_audit_log.sql`
```sql
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  action text not null,
  target_type text not null check (target_type in ('user', 'site', 'domain', 'job', 'provider', 'mcp', 'system')),
  target_id text,
  reason text,
  detail jsonb not null default '{}'::jsonb,
  actor_hash text
);
create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
create index admin_audit_log_target_idx on public.admin_audit_log (target_type, target_id);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon, authenticated;
```
Exactly this. Do not apply it. (Nobody can edit or delete audit rows through the app: there is no update/delete code path.)

## Task B: `src/server/admin-audit.ts`
`logAdminAction(admin, { action, targetType, targetId?, reason?, detail?, request })`. `actor_hash` = first 16 hex of `sha256(clientIp + ADMIN_SESSION_SECRET)` where `clientIp` is the first value of `x-forwarded-for` (or `""`). `detail` is a small object chosen by the caller (for example `{ from: "free", to: "pro" }`); strip any key named like `password|secret|token|key|html`. Action names: `user.plan_change`, `user.admin_flag`, `user.html_edit`, `user.delete`, `user.mcp_revoke`, `site.takedown`, `domain.remove`, `job.cancel`, `provider.clear_cooldown`.
Retrofit the existing mutating routes (`users.$id.ts` PATCH/DELETE, `sites.$slug.unpublish.ts`) to follow safety rules 2, 4 and 5 (they currently take no reason). Keep their URLs.

## Task C: Routes (all under `src/routes/api/admin/`)
Response shapes are the contract with 08b. All timestamps ISO strings.

- `GET /api/admin/overview` → `{ users: { total, new7d, pro, admins }, content: { portfolios, versions, uploadsBytes }, sites: { published, unpublished }, domains: { pending, verified, live }, jobs: { last24h: { total, done, failed, queued, running, bySource: { free, gemini, mcp } }, topErrors: [{ code, count }], oldestQueuedRetryAt: string | null }, mcp: { activeConnections }, freeProviders: [{ id, label, model, usedToday, dailyBudget, cooldownUntil: string | null }], payments: { enabled: boolean } }`. Use `count(..., { head: true })` queries or small bounded selects; no table scans of HTML.
- `GET /api/admin/users?query=&plan=free|pro&admin=true&site=published&page=&pageSize=` → `{ users: AdminUserSummary[], page, pageSize, total }` (reuse `AdminUserSummary` from `admin-users.ts`; add `siteSlug: string | null`). `query` is a case-insensitive substring of the email. Auth emails come from `admin.auth.admin.listUsers`; page through all of them (cap 5000, then return `truncated: true`), filter and paginate in memory, then enrich only the page's users. Replaces the current unpaginated `GET`.
- `GET /api/admin/users/:id` (extend, keep existing fields) adding: `uploads: [{ kind, filename, sizeBytes, createdAt }]`, `versions: [{ id, source, model, warningsCount, htmlBytes, createdAt }]` (newest 20), `jobs: [{ id, source, status, provider, errorCode, errorMessage, createdAt, updatedAt }]` (newest 10), `site: { slug, status, url, updatedAt } | null`, `domain: { hostname, status } | null`, `connections: { github: { account } | null, vercel: boolean, mcp: [{ clientId, name, connectedAt }] }`. No storage paths.
- `POST /api/admin/users/:id/revoke-mcp` body `{ reason }` → revokes every MCP token of that user → `{ ok: true, revokedClients: number }`.
- `GET /api/admin/jobs?status=&source=&page=&pageSize=` → `{ jobs: [{ id, userEmail, source, status, provider, errorCode, errorMessage, createdAt, updatedAt, retryAt }], page, pageSize, total }`, newest first.
- `POST /api/admin/jobs/:id/cancel` body `{ reason }` → fails a job that is `queued` or running with code `cancelled_by_admin` (use `failJob`) → `{ ok: true }`; 409 `job_finished` if already done/failed.
- `GET /api/admin/sites?query=&status=&page=&pageSize=` → `{ sites: [{ slug, url, status, ownerEmail, ownerId, updatedAt, domain: { hostname, status } | null }], page, pageSize, total }`. `query` matches slug or owner email.
- Existing `POST /api/admin/sites/:slug/unpublish` now needs `{ reason }` and audits.
- `POST /api/admin/domains/remove` body `{ hostname, reason }` → `removeDomain` on Vercel (treat 404 as success), delete the row → `{ ok: true }`; 404 `domain_not_found`.
- `POST /api/admin/providers/clear-cooldown` body `{ provider, reason }` → sets `cooldown_until = null` for today's `provider_budgets` row → `{ ok: true }`. `provider` must be one of the configured provider ids (400 otherwise).
- `GET /api/admin/system` → `{ commit: string | null, appOrigin, sitesBaseUrl: string | null, payments: { enabled: boolean }, settings: [{ name, set: boolean }] }` where `settings` lists whether each of these is set (value never returned): `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ENCRYPTION_KEY, ADMIN_SESSION_SECRET, OPENROUTER_API_KEY, FREE_MODEL_OPENROUTER_A, CRON_SECRET, SITES_BASE_URL, GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, VERCEL_API_TOKEN, SITES_PROJECT_ID, DODO_PAYMENTS_API_KEY, DODO_PRODUCT_ID_PRO, DODO_WEBHOOK_SECRET`; `commit` from `VERCEL_GIT_COMMIT_SHA`.
- `GET /api/admin/audit?action=&targetType=&page=&pageSize=` → `{ entries: [{ id, createdAt, action, targetType, targetId, reason, detail }], page, pageSize, total }`, newest first.

## Task D: Tests (vitest, recording fakes like `src/server/domains-fixes.test.ts`)
Per route: 401 without the admin cookie behaviour is covered by the middleware (add one test proving each new route file wires `adminMiddleware`, for example by asserting `Route.options.server.middleware` contains it). Then: reason required (400) on every destructive route; `confirmEmail` mismatch; last-admin protection; audit row written with the right action/target/reason and **without** any secret/html key; pagination math and `pageSize` cap; user search; overview shape on empty tables; `cancel` on a finished job → 409; `clear-cooldown` with an unknown provider → 400; `system` never returns values.

## Out of scope
UI (08b). Payments. Changing login/session logic. Applying the migration.

## Done when
The usual four checks pass, `git diff main --stat` shows only admin routes, `src/server/admin-*.ts`, tests, the migration and this file.

## Handoff report
