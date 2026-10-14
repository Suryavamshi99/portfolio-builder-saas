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

### Files changed and created
- `supabase/migrations/0020_admin_security.sql`: Created tables `public.admin_security` (single row with `totp_secret_enc`, `totp_enabled_at`, `recovery_hashes`, `session_epoch`, `last_totp_step`) and `public.admin_login_attempts` (`key_hash`, `stage`, `ok`, `created_at`). Both have RLS enabled and all privileges revoked from `anon, authenticated`. (Migration file added only; NOT applied to database).
- `src/lib/admin/totp.ts`: RFC 6238 TOTP engine with SHA-1, 6 digits, 30s step, ±1 step verification window, Base32 encoder/decoder, `otpauth://totp/Shipfolio%20Admin:<username>?secret=…&issuer=Shipfolio%20Admin` URI generator, constant-time verification (`timingSafeEqual`), and anti-replay step tracking (`step <= last_totp_step`).
- `src/lib/admin/security-store.ts`: Persistent storage helper for `admin_security`, AES-256-GCM envelope encryption/decryption using `ENCRYPTION_KEY`, recovery codes generation (8 codes, `XXXXX-XXXXX`), SHA-256 hashing, single-use consumption, `session_epoch` bumping, and recovery codes regeneration.
- `src/lib/admin/session.ts`: Session v2 token with payload `{ iat, exp (8 h), seen (last activity), epoch, stepUpUntil }`, 30 min idle timeout, absolute 8 h lifetime, `session_epoch` validation against Postgres, rejection of old v1 tokens, pending cookie (`admin_pending` / `__Host-admin_pending`, 5 min TTL) creation and verification, `__Host-admin_session` (HTTPS) vs `admin_session` (HTTP), SameSite=Strict, HttpOnly, Path=/, and cookie clearing helper.
- `src/lib/admin/password.ts`: Added `DUMMY_SCRYPT_HASH` and constant-time dummy verification when username is invalid to eliminate timing oracles.
- `src/server/admin-rate-limit.ts`: Retained in-memory per-IP rate limiter; added `computeAdminKeyHash(ip, username, sessionSecret)`, `checkAdminLockout(admin, keyHash, stage, nowMs)` with exponential backoff (1m for 5-7 fails, 5m for 8-10 fails, 15m for 11+ fails), and `recordAdminAttempt(admin, keyHash, stage, ok)`.
- `src/server/admin-middleware.ts`: Admin middleware checking Session v2 cookie, validating `session_epoch`, sliding idle expiry at most once per minute via `setResponseHeader("set-cookie", ...)`, context `adminSession`, and exported `requireStepUp()` / `stepUpMiddleware`.
- `src/server/admin-audit.ts`: Implemented `logAdminAction(admin, { action, targetType, targetId, reason, detail, request })` matching 08a Task B signature; sanitizes detail keys matching `/password|secret|token|key|html/i`; computes 16-hex `actor_hash`.
- `src/routes/api/admin/login.ts`: POST `/login` validating username & password with timing defense, checking lockout, setting 5-minute pending cookie, returning `{ step: "enroll" }` or `{ step: "totp" }`.
- `src/routes/api/admin/login.totp.ts`: POST `/login/totp` verifying pending cookie, checking stage lockout, validating 6-digit TOTP (anti-replay) or recovery code (single use), issuing Session v2 cookie and clearing pending cookie.
- `src/routes/api/admin/2fa.enroll.start.ts`: POST `/2fa/enroll/start` requiring pending cookie for unenrolled admin, generating Base32 secret and `otpauthUri`, storing encrypted secret.
- `src/routes/api/admin/2fa.enroll.confirm.ts`: POST `/2fa/enroll/confirm` verifying code against pending secret, enabling 2FA in DB, generating 8 recovery codes, setting Session v2 cookie and clearing pending cookie.
- `src/routes/api/admin/session.ts`: GET `/session` returning `{ authenticated, expiresAt, idleExpiresAt, stepUpUntil, twoFactor }`.
- `src/routes/api/admin/step-up.ts`: POST `/step-up` requiring password + TOTP code, checking lockout, granting 5-minute `stepUpUntil` window in session cookie.
- `src/routes/api/admin/logout.ts`: POST `/logout` clearing all admin cookies.
- `src/routes/api/admin/logout-all.ts`: POST `/logout-all` requiring step-up, bumping `session_epoch` in DB, clearing cookies.
- `src/routes/api/admin/2fa.recovery.regenerate.ts`: POST `/2fa/recovery/regenerate` requiring step-up, regenerating 8 recovery codes, updating DB.
- `src/routes/api/admin/security.ts`: GET `/security` returning `{ twoFactorEnabledAt, recoveryCodesLeft, recentAttempts }` without IP addresses or secret hashes.
- `src/components/admin/SignIn.tsx`: Multistep sign-in UI (password -> totp or enrol with inline SVG QR, manual key, recovery codes display with copy/download and checkbox acknowledgment).
- `src/components/admin/StepUpDialog.tsx`: Step-up dialog prompting for password + code, resolving `requestStepUp()`.
- `src/lib/admin-stepup.ts`: Hook/handler interface `requestStepUp()` and `registerStepUpHandler()`.
- `src/components/admin/SecurityPanel.tsx`: Security tab panel displaying 2FA status, recovery codes count, regenerate codes action (step-up), sign out everywhere action (step-up), and recent sign-in history.
- `src/components/admin/qr.tsx` & `src/components/admin/qr-matrix.ts`: Pure TypeScript inline SVG QR generator (0 dependencies).
- `src/routes/admin.tsx`: Swapped sign-in form for `<SignIn onDone>` component.
- `src/routeTree.gen.ts`: Updated by TanStack Router build.
- `src/lib/admin/totp.test.ts`: RFC 6238 test vectors, ±1 step window, anti-replay, Base32 encode/decode.
- `src/lib/admin/security-store.test.ts`: Recovery code consumption, regeneration, epoch bumping, AES-GCM encryption roundtrip.
- `src/lib/admin/session.test.ts`: Token tampering, 8h expiry, 30m idle, epoch mismatch, v1 rejection, pending tokens, HTTPS vs HTTP cookie flags.
- `src/server/admin-lockout.test.ts`: Lockout thresholds (5, 8, 11), backoff schedule, stage separation, key hashing.
- `src/server/admin-middleware.test.ts`: Route-agnostic `requireStepUp()` testing and session verification.
- `src/server/admin-audit.test.ts`: Detail key sanitization, actor_hash calculation, error resilience.
- `src/server/admin-auth-routes.test.ts`: Full integration tests for all 10 admin auth endpoints.
- `src/components/admin/admin-ui.test.tsx`: Component tests for SignIn, StepUpDialog, SecurityPanel, and QrCode.

### Security Implementation Highlights (Quoted Lines)
- **Timing-safe password compare with dummy scrypt on username mismatch** (`src/routes/api/admin/login.ts` lines 68-75):
  ```ts
  const usernameOk = username === expectedUsername;
  let passwordOk = false;
  if (usernameOk) {
    passwordOk = verifyPassword(password, passwordHash);
  } else {
    verifyPassword(password, DUMMY_SCRYPT_HASH);
  }
  ```
- **Lockout checking and backoff schedule** (`src/server/admin-rate-limit.ts` lines 80-94):
  ```ts
  const count = records.length;
  if (count < 5) {
    return { locked: false, failureCount: count };
  }

  const backoffSeconds = count >= 11 ? 15 * 60 : count >= 8 ? 5 * 60 : 1 * 60;
  const mostRecentFailedAt = new Date(records[0]!.created_at).getTime();
  const elapsedSeconds = (nowMs - mostRecentFailedAt) / 1000;

  if (elapsedSeconds < backoffSeconds) {
    const retryAfterSeconds = Math.ceil(backoffSeconds - elapsedSeconds);
    return { locked: true, retryAfterSeconds, failureCount: count };
  }
  ```
- **Anti-replay protection in TOTP** (`src/lib/admin/totp.ts` lines 132-135):
  ```ts
  // Anti-replay: reject if step <= lastStep
  if (lastStep !== null && step <= lastStep) {
    continue;
  }
  ```
- **Rejection of old v1 tokens missing iat/seen/epoch** (`src/lib/admin/session.ts` lines 107-114):
  ```ts
  if (
    typeof payload["iat"] !== "number" ||
    typeof payload["exp"] !== "number" ||
    typeof payload["seen"] !== "number" ||
    typeof payload["epoch"] !== "number"
  ) {
    return { valid: false, reason: "invalid_shape" };
  }
  ```
- **Audit detail sanitization removing secret keys** (`src/server/admin-audit.ts` lines 16-24):
  ```ts
  const REDACTED_KEY_REGEX = /password|secret|token|key|html/i;

  export function sanitizeAuditDetail(detail?: Record<string, unknown>): Record<string, unknown> {
    if (!detail || typeof detail !== "object") return {};
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(detail)) {
      if (REDACTED_KEY_REGEX.test(k)) continue;
      sanitized[k] = v;
    }
    return sanitized;
  }
  ```
- **Step-up check helper for destructive routes** (`src/server/admin-middleware.ts` lines 42-49):
  ```ts
  export function requireStepUp(
    target?: AdminSessionPayload | { adminSession?: AdminSessionPayload } | null,
    now = Date.now(),
  ): Response | null {
    const session = target && typeof target === "object" && "adminSession" in target ? target.adminSession : target;
    if (!isStepUpValid(session as AdminSessionPayload | null | undefined, now)) {
      return stepUpRequiredResponse();
    }
    return null;
  }
  ```

### Note on Retention of Login Attempts
As noted in the handoff brief, `admin_login_attempts` records should be purged once older than 30 days. This should be added to the daily retention cron job (`src/routes/api/cron/...` or pg_cron) when migrations are applied to production.

### Open Questions / Decisions
- In accordance with the work split between 08a and 08c, `logAdminAction` was implemented in `src/server/admin-audit.ts` conforming strictly to the contract defined in 08a Task B. When branches are merged (08a -> 08c -> 08b), the implementation will reconcile cleanly.
- `admin.tsx` only had its sign-in form replaced with `<SignIn onDone>`, preserving all other user-listing and editing behavior until 08b merges its tabbed console shell.
