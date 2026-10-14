# Handoff 08c: Admin sign-in v2 (TOTP 2FA, session v2, step-up, lockout)

**Worktree / branch:** `/Users/suryavamshi/portfolio-builder-saas-08c` on `feat/08c-admin-auth` (Claude creates it). **Rules:** `docs/handoffs/_rules.md` (no accounts or data on production; do not apply migrations). **Plan:** `docs/plans/2026-10-14-admin-console-plan.md` (decisions 2–6).
**Reviewer:** Claude Code reviews this line by line (security-critical). Follow exactly; when unsure, choose the stricter behavior and note it in the report.
**Migration:** `supabase/migrations/0020_admin_security.sql` (do not apply).

## Read first
`src/lib/admin/session.ts`, `src/lib/admin/env.ts`, `src/routes/api/admin/{login,logout,session}.ts`, `src/server/admin-middleware.ts`, `src/server/admin-rate-limit.ts`, the encryption helper that uses `ENCRYPTION_KEY` (grep), `src/start.ts` (Origin check), `docs/handoffs/08a-admin-backend.md` Task B (`logAdminAction`).

## Task A: migration
```sql
create table public.admin_security (
  id boolean primary key default true check (id),   -- single row
  totp_secret_enc text,
  totp_enabled_at timestamptz,
  recovery_hashes text[] not null default '{}',
  session_epoch integer not null default 1,
  last_totp_step bigint,
  updated_at timestamptz not null default now()
);
alter table public.admin_security enable row level security;
revoke all on public.admin_security from anon, authenticated;
create table public.admin_login_attempts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  key_hash text not null,          -- sha256(ip + username + ADMIN_SESSION_SECRET), never raw
  stage text not null check (stage in ('password','totp')),
  ok boolean not null
);
create index admin_login_attempts_key_idx on public.admin_login_attempts (key_hash, created_at desc);
alter table public.admin_login_attempts enable row level security;
revoke all on public.admin_login_attempts from anon, authenticated;
```
(Retention of attempts older than 30 days is a note in the report, not code.)

## Task B: building blocks (`src/lib/admin/` and `src/server/admin-*.ts`)
1. `totp.ts`: RFC 6238 SHA-1, 6 digits, 30 s step, accept ±1 step, base32 secret (20 random bytes), `otpauth://totp/Shipfolio%20Admin:<username>?secret=…&issuer=Shipfolio%20Admin` URI. Constant-time compare. Reject a code whose step ≤ `last_totp_step` (no replay); store the step after success. No new dependency.
2. `security-store.ts`: get/create the single row; encrypt/decrypt the secret with the existing `ENCRYPTION_KEY` helper (AES-GCM); generate 8 recovery codes (10 chars, `XXXXX-XXXXX`), store sha256 hashes, each usable once (remove on use), return plaintext only once at enrolment/regeneration.
3. Session v2 in `session.ts`: payload `{ iat, exp (8 h), seen (last activity), epoch, stepUp? }`. Valid only if now<exp, now−seen<30 min, and `epoch` equals DB `session_epoch` (read once per request in the middleware). Middleware re-signs the cookie with a fresh `seen` at most once a minute (Set-Cookie). Cookie name `__Host-admin_session` when the request is https, else `admin_session`; flags HttpOnly, Secure (https), SameSite=Strict, Path=/. Also accept nothing from old v1 tokens (force re-login after deploy).
4. Partial state between steps: a short-lived (5 min) signed `admin_pending` cookie (same flags, name `__Host-admin_pending`) proving the password step passed; it cannot access any admin route.
5. Lockout: before verifying anything count `admin_login_attempts` for the key in the last 15 min; ≥5 failures → `429 locked` with `retryAfterSeconds` (backoff: 1, 5, 15 min by count 5/8/11). Record every attempt (stage, ok). Keep the existing per-IP limiter too. Same error `invalid_credentials` for wrong user and wrong password; compare with a dummy scrypt when the username is wrong (no timing oracle).

## Task C: API contract (all under `src/routes/api/admin/`)
- `POST /login` `{ username, password }` → if 2FA not enrolled: sets pending cookie, `{ step: "enroll" }`; else pending cookie, `{ step: "totp" }`. Failure `401 invalid_credentials`, `429 locked`.
- `POST /login/totp` `{ code }` (6 digits **or** a recovery code) with pending cookie → full session cookie, `{ ok: true, usedRecovery: boolean }`; failure `401 invalid_code`.
- `POST /2fa/enroll/start` (pending cookie only, not enrolled) → `{ otpauthUri, secret }` (secret shown once for manual entry; stored encrypted but not yet enabled).
- `POST /2fa/enroll/confirm` `{ code }` → enables, returns `{ recoveryCodes: string[] }` once and issues the full session.
- `GET /session` → `{ authenticated, expiresAt, idleExpiresAt, stepUpUntil: string|null, twoFactor: boolean }`.
- `POST /step-up` `{ password, code }` (full session) → sets `stepUpUntil = now+5 min` in the cookie; `401 invalid_credentials|invalid_code`, same lockout.
- `POST /logout` clears cookies. `POST /logout-all` (needs step-up) bumps `session_epoch`, clears cookie.
- `POST /2fa/recovery/regenerate` (needs step-up) → `{ recoveryCodes }`, old ones invalid.
- `GET /security` → `{ twoFactorEnabledAt, recoveryCodesLeft, recentAttempts: [{ createdAt, stage, ok }] (last 20, no IP) }`.
- Middleware helper `requireStepUp()` for 08a routes: returns `403 { error: { code: "step_up_required" } }` when `stepUpUntil` is missing or past. 08a applies it to the destructive routes (listed in plan decision 4); in your branch export it and add a test route-agnostic unit test.
- Audit (via `logAdminAction`, targetType `system`): `admin.login_ok`, `admin.login_fail`, `admin.login_locked`, `admin.step_up`, `admin.2fa_enrolled`, `admin.logout_all`, `admin.recovery_used`, `admin.recovery_regenerated`. No codes, passwords or secrets in `detail`.

## Task D: UI (only these files)
`src/components/admin/SignIn.tsx` (steps: password → code or enrol; enrol shows QR using an inline QR component you write or a tiny vetted dependency pinned in package.json — if you add one, name it in the report — plus the manual secret, then shows recovery codes once with "I saved them" checkbox and copy/download), `src/components/admin/StepUpDialog.tsx` (password+code, used by 08b via a `requestStepUp(): Promise<boolean>` hook in `src/lib/admin-stepup.ts`), `src/components/admin/SecurityPanel.tsx` (status, regenerate codes, sign out everywhere, recent sign-ins). 08b imports these; do not edit `admin.tsx` beyond swapping its sign-in form for `<SignIn onDone>` if 08b has not merged (note it in the report).

## Tests
RFC 6238 test vectors, ±1 step window, replay rejected, recovery code single-use, token tampering/expiry/idle/epoch mismatch, cookie names/flags for https vs http, lockout thresholds and backoff, same error for bad user/bad password, step-up window, pending cookie cannot reach admin routes, no secret/code in audit detail or any response other than the documented once-only fields.

## Out of scope
Admin data endpoints (08a), console tabs (08b), IP allowlist, impersonation, applying migrations.

## Done when
Usual four checks pass; `git diff main --stat` shows only the files above, tests, migration and this file.

## Handoff report
