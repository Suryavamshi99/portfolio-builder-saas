# Admin console (`/admin`)

Single-owner operations console, hidden (no link anywhere). Built 2026-10-14 from handoffs 08a (backend), 08c (sign-in) and 08b (UI); plan: [`docs/plans/2026-10-14-admin-console-plan.md`](./plans/2026-10-14-admin-console-plan.md). Admin identity is **separate from Supabase users**.

## Sign-in and sessions
1. `POST /api/admin/login` checks `ADMIN_USERNAME` + scrypt `ADMIN_PASSWORD_HASH` (a wrong username still runs a dummy scrypt, same error). Success sets a 5-minute `admin_pending` cookie and answers `{ step: "enroll" | "totp" }`.
2. **Authenticator-app 2FA (TOTP, RFC 6238, SHA-1, 6 digits, ±1 step, replay-protected).** First time: `2fa/enroll/start` (QR + manual secret) → `2fa/enroll/confirm` (code) → 8 one-time recovery codes shown once. After that: `login/totp` accepts a 6-digit code **or** a recovery code. `enroll/confirm` is refused once 2FA is on.
3. Session cookie `__Host-admin_session` (HttpOnly, Secure, SameSite=Strict, Path=/; plain `admin_session` over http in dev): 8 h absolute, 30 min idle (re-signed at most once a minute), carries `epoch`. Old v1 cookies are rejected.
4. **Sign out everywhere** (`logout-all`) bumps `session_epoch` in `admin_security`; every older cookie dies.
5. **Step-up:** deleting an account, takedown, admin-flag change, plan change to/from pro, domain removal and MCP revoke need `POST /api/admin/step-up` (password + current code/recovery code) within the last 5 minutes, else `403 step_up_required` (the UI opens a dialog and retries once). Job cancel and provider clear-cooldown need a reason only.
6. **Lockout:** 5 failures per hashed IP+username key in 15 min → `429 locked` with backoff 1 / 5 / 15 min (password and code stages counted separately), plus the older in-memory per-IP limiter. Attempts stored in `admin_login_attempts` (hashed key, no raw IP).
7. Secrets: TOTP secret stored AES-GCM-encrypted with `ENCRYPTION_KEY`; recovery codes stored as sha256 hashes. Nothing secret appears in responses (other than the once-only enrolment/recovery fields) or in the audit log.
8. **Break-glass:** if the authenticator and recovery codes are lost, delete the single row in `public.admin_security` from the Supabase dashboard (resets 2FA; next sign-in goes to enrolment). Do it only yourself.

## Safety rules
Reason (3–300 chars) required on every destructive action; deleting a user also needs `confirmEmail`; the last admin cannot be demoted or deleted (`409 last_admin`); **no impersonation, ever**; user HTML appears only in `<iframe sandbox="">` (no scripts, no same-origin) and the edit textarea; lists are server-paginated (`page`, `pageSize` ≤ 100); every change is written to `admin_audit_log` (append-only; no update/delete path; `detail` keys matching `password|secret|token|key|html` are stripped).

## Tabs
Overview (users, content, sites, domains, jobs 24 h by source, top errors, free-model budgets/cooldowns, queue warning, payments flag) · Users (search/filters/pagination, detail drawer: uploads, versions, jobs, site/domain, connections, preview, actions) · Sites & domains (unpublish, remove domain) · Jobs & providers (cancel job, clear cooldown) · Audit log (filters) · System (commit, origins, settings present/missing, never values) · Security (2FA status, regenerate recovery codes, sign out everywhere, recent sign-ins). Active tab in `?tab=`.

## Endpoints (all under `/api/admin/`, admin cookie unless noted)
| Method | Path | Notes |
|---|---|---|
| POST | `login`, `login/totp`, `2fa/enroll/start`, `2fa/enroll/confirm` | pending cookie flow (no session yet) |
| POST | `logout`, `logout-all`*, `step-up`, `2fa/recovery/regenerate`* | *needs step-up |
| GET | `session`, `security`, `overview`, `system`, `audit`, `users`, `users/:id`, `sites`, `jobs` | read-only; paginated lists |
| PATCH | `users/:id` | `{plan?, isAdmin?, html?, reason}`; plan to/from pro and admin flag need reason + step-up |
| DELETE | `users/:id` | `{reason, confirmEmail}` + step-up |
| POST | `users/:id/revoke-mcp`*, `sites/:slug/unpublish`*, `domains/remove`* | `{reason}` (+ `hostname` for domains) |
| POST | `jobs/:id/cancel`, `providers/clear-cooldown` | `{reason}` (+ `provider`); `409 job_finished`, `400` unknown provider |

Errors use `{ error: { code, message } }`. Codes: `reason_required`, `confirm_mismatch`, `last_admin`, `step_up_required`, `locked`, `invalid_credentials`, `invalid_code`, `pending_required`, `already_enrolled`, `domain_not_found`.

## Tables (migrations 0019, 0020; RLS on, no access for anon/authenticated)
`admin_audit_log` (action, target_type `user|site|domain|job|provider|mcp|system`, target_id, reason, detail jsonb, actor_hash = first 16 hex of sha256(ip+session secret)); `admin_security` (single row: encrypted TOTP secret, enabled_at, recovery hashes, session_epoch, last_totp_step); `admin_login_attempts` (hashed key, stage, ok).

## Audit action names
`user.plan_change`, `user.admin_flag`, `user.html_edit`, `user.delete`, `user.mcp_revoke`, `site.takedown`, `domain.remove`, `job.cancel`, `provider.clear_cooldown`, `admin.login_ok`, `admin.login_fail`, `admin.login_locked`, `admin.step_up`, `admin.2fa_enrolled`, `admin.logout_all`, `admin.recovery_used`, `admin.recovery_regenerated`.

## Code map
Server: `src/server/admin-middleware.ts` (session check, `requireStepUp`), `admin-audit.ts`, `admin-rate-limit.ts`; `src/lib/admin/{session,totp,security-store,password,env}.ts`; routes `src/routes/api/admin/*`. UI: `src/routes/admin.tsx`, `src/components/admin/*`, typed client `src/lib/admin-api.ts`, `src/lib/admin-stepup.ts`.

## Review notes (2026-10-14)
Claude Code fixed one hole found in review (enrol-confirm acting as an unthrottled second login door) and wired 08a's destructive routes to the real step-up. Known, accepted: recovery-code consumption and TOTP last-step update are read-then-write (single owner, negligible race); the session cookie also accepts the alternate cookie-name variant; until the owner enrols, the password alone reaches the enrolment screen, so enrol immediately after deploy.

## Not built yet
Billing tab (refunds, plan history) arrives with Dodo; no IP allowlist (home IP changes); retention sweep of `admin_login_attempts` older than 30 days is not scheduled.

## Verification
Unit tests (456 total at merge): RFC 6238 vectors, replay, recovery single-use, token tamper/expiry/idle/epoch, cookie flags, lockout backoff, step-up window and wiring on every destructive route, reason/confirm/last-admin, audit without secrets, pagination cap, `system` returns no values, `admin-api.ts` client. Live test with temporary users on production only with owner approval, deleted afterwards.
