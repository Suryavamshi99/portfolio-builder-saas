---
title: Admin console and admin sign-in hardening
date: 2026-10-14
status: ready-for-build
handoffs: [08a-admin-backend, 08c-admin-auth, 08b-admin-ui]
---

# Admin console and admin sign-in hardening

## Summary
Turn `/admin` from a single page with one password check into a console the founder can run Shipfolio from, with a safer sign-in and a permanent record of every change. Payments/refunds are out of scope until Dodo exists.

## Problem frame
Today the admin can read every user's data, edit HTML and delete accounts. Sign-in is one password (env `ADMIN_USERNAME` + scrypt `ADMIN_PASSWORD_HASH`), the session is a stateless signed 24 h cookie, nothing is logged, users load unpaginated, and there is no view of jobs, sites, domains, free-model capacity or MCP connections.

## Decisions (owner confirmed scope 2026-10-14)
1. **Keep the separate env-based admin identity** (not Supabase users). One owner, no new paid service, and an admin takeover must not depend on the user-auth stack.
2. **Add TOTP 2FA** (authenticator app, RFC 6238, implemented with node:crypto, no new dependency). Secret stored AES-GCM-encrypted with `ENCRYPTION_KEY`; 8 one-time recovery codes stored as hashes. First enrolment happens right after a password sign-in when 2FA is not yet set up, and it is required (no skip) once the feature is deployed.
3. **Session**: cookie name `__Host-admin_session` (Secure, HttpOnly, SameSite=Strict, Path=/), absolute life 8 h, idle timeout 30 min (re-signed on use, "last seen" in the token), carries a `epoch` number. **Sign out everywhere** bumps `epoch` in the DB, invalidating all cookies. Local dev over http keeps the plain name (decide by `request.url` protocol).
4. **Step-up for destructive actions**: delete account, takedown, admin-flag change, plan change to/from pro, domain removal, MCP revoke need the session to have been re-confirmed (password + current TOTP code) in the last 5 minutes (`stepUpUntil` in the token). Missing → `403 step_up_required`; UI shows a re-confirm dialog and retries.
5. **Lockout**: 5 failed attempts per IP+username in 15 min → growing delay and `429`; failures counted for password step and code step separately. Same generic error text for wrong user / wrong password.
6. **Audit everything**: table `admin_audit_log` (append-only, no update/delete path) records logins (success/failure/lockout), step-ups, 2FA changes, sign-out-everywhere and every mutation with reason. No secrets, tokens, HTML or signed URLs ever.
7. **No impersonation / "log in as user"**, ever. Support is done by read-only detail views and explicit, audited actions.
8. **CSRF**: SameSite=Strict + the existing Origin check in `src/start.ts` for non-GET; admin GET routes never change state.
9. **No IP allowlist** (home IP changes, lock-out risk).
10. **User HTML only inside `<iframe sandbox="" srcDoc>`** (empty sandbox) and the existing edit textarea; never `dangerouslySetInnerHTML`.

## Information architecture (tabs, `?tab=` in URL)
Overview (health at a glance) · Users (search, detail drawer: uploads, versions, jobs, site/domain, connections, preview, actions) · Sites & domains (moderate/takedown/remove domain) · Jobs & providers (watch generation, cancel, clear free-model cooldown) · Audit log · System (settings present/missing, commit, payments flag) · Security (2FA status, regenerate recovery codes, sign out everywhere, recent sign-ins). Later with Dodo: Billing tab (refunds, plan history).

## Day-to-day workflows covered
Support a user (find by email → detail → see last jobs/errors → fix plan/cancel job/revoke MCP). Moderate (sites list → takedown with reason → audit). Watch health (overview: failures, queue waiting, free-model budgets). Review what changed (audit). Secure the console (security tab).

## Work split (parallel, each in its own worktree)
| Handoff | Branch | Owns | Migration |
|---|---|---|---|
| 08c-admin-auth | feat/08c-admin-auth | login v2 (password→TOTP), enrolment, recovery codes, session v2, step-up, lockout, sign-out-everywhere, security endpoints, `SignIn.tsx` + `SecurityPanel.tsx` | `0020_admin_security.sql` |
| 08a-admin-backend | feat/08a-admin-backend | audit helper + all list/overview/system/action endpoints | `0019_admin_audit_log.sql` |
| 08b-admin-ui | feat/08b-admin-ui | tabbed console shell and tabs, using `SignIn`/`SecurityPanel` from 08c | none |

Audit helper dependency: 08c needs `logAdminAction`; it codes against the signature in 08a Task B and Claude reconciles on merge. Merge order: 08a → 08c → 08b (08b shell imports 08c components). Contracts: 08a Task C and 08c "API contract" sections are the single source of truth; UI uses one typed client `src/lib/admin-api.ts`.

## Phasing
- **By 2026-10-15**: 08a (audit, reasons, pagination, overview, users/sites/jobs/audit/system endpoints), 08c (2FA, session v2, step-up, lockout), 08b (all tabs except nice-to-haves).
- **If time is short, cut in this order** (last first): Security tab polish, System tab, Jobs & providers UI, user-detail preview. Never cut audit, reasons, step-up or 2FA.
- **Later**: Billing tab with Dodo; per-scope MCP enforcement view; alerting.
- **Rollout safety for 2FA**: until the owner enrols, password-only sign-in keeps working but shows a forced-enrol screen; after enrolling, the code is mandatory. Keep a break-glass path: removing the `admin_security` row via the Supabase dashboard resets 2FA (documented, audited by absence only, so Claude applies it on request).

## Verification plan
Unit tests with mocks (TOTP vectors from RFC 6238, lockout, token expiry/idle/epoch, step-up window, last-admin, reason required, audit has no secret/html keys). After merge and deploy: Claude (not AGY) applies migrations 0019/0020 after explaining them to the owner, probes production for the new routes first, then owner enrols 2FA. Live test uses `shipfolio-livecheck-` throwaway users created only with owner approval and deleted afterwards; admin actions are tried only on those users. Check at 1280 px and 390 px.

## Risks
Lock-out of the owner (mitigated by recovery codes + dashboard reset); TOTP clock skew (accept ±1 step); stateless cookies cannot be revoked individually (epoch solves "all"); audit write failure never rolls back a change but is logged.
