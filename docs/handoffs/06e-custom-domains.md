# Handoff 06e: Custom domains (users bring their own domain)

**Worktree / branch:** `/Users/suryavamshi/portfolio-builder-saas-06e` on `feat/06e-custom-domains` (based on the merged integration branch).
**Rules:** `docs/handoffs/_rules.md` (read first). **Plan:** `version2memory.md` section 6.9. **Migration number:** `0017_custom_domains.sql`.
**Reviewer:** Claude Code reviews this line by line (domain ownership is a security boundary).

## The one rule that matters
A hostname may be mapped to a user's site **only after they prove they own it** with a TXT record we generate. Vercel's own checks don't prove ownership. Never serve a hostname for a row whose status is `pending`.

## Env (add to `.env.example`)
`VERCEL_API_TOKEN` (secret), `SITES_PROJECT_ID` (the `shipfolio-sites` Vercel project id), `VERCEL_TEAM_ID` (team id, used as `?teamId=`), plus the existing `SITES_DOMAIN`.

## Task A: Migration `supabase/migrations/0017_custom_domains.sql`
```sql
create table public.custom_domains (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  hostname text not null unique check (hostname = lower(hostname)),
  status text not null default 'pending' check (status in ('pending', 'verified', 'live')),
  verify_token text not null,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  last_checked_at timestamptz
);
alter table public.custom_domains enable row level security;
revoke all on public.custom_domains from anon, authenticated;
```
Exactly this. **Do not apply it.** One custom domain per user.

## Task B: `src/server/domains.ts` (pure helpers, tested)
- `validateHostname(raw, sitesDomain): { ok: true; hostname } | { ok: false; reason }`: trim, lowercase, strip a trailing dot; no scheme/path/port/spaces/underscores; 4–253 chars; each label 1–63 chars of `[a-z0-9-]` not starting/ending with `-`; at least two labels; the last label (TLD) 2+ letters; not an IP address; reject `sitesDomain` itself and any subdomain of it; reject anything ending `.vercel.app`, `.vercel.com`, `.now.sh`, `localhost`. Punycode (`xn--`) allowed.
- `verifyRecordName(hostname) = "_shipfolio-verify." + hostname`; `newVerifyToken()` = 24 random bytes base64url prefixed `shipfolio-verify=`.
- `txtMatches(txtRecords: string[][], token): boolean`: join each record's chunks, exact match of the token (trimmed).

## Task C: `src/server/vercel/domains.ts` (Vercel REST, `fetch`, no new dependency)
All calls: `Authorization: Bearer ${VERCEL_API_TOKEN}`, `?teamId=${VERCEL_TEAM_ID}`. Throw `VercelDomainError` (with `status`, a short message, never the token).
- `addDomain(hostname)`: `POST https://api.vercel.com/v10/projects/${SITES_PROJECT_ID}/domains` body `{ name }`. Treat "already added to this project" (409 with that code) as success; 409 for another project → `VercelDomainError` "This domain is already used by another Vercel project".
- `getDomainConfig(hostname)`: `GET /v6/domains/${hostname}/config` → `{ misconfigured: boolean, recommendedIPv4: string[], recommendedCNAME: string[] }` (read the real field names from Vercel's response; keep a typed mapping and a test with a sample body).
- `removeDomain(hostname)`: `DELETE /v9/projects/${SITES_PROJECT_ID}/domains/${hostname}`; 404 = success.

## Task D: Routes `src/routes/api/domains/` (all `authMiddleware`; admin client scoped to `user.id`)
- `GET /api/domains` → `{ domain: null | { hostname, status, verifyRecord: { type: "TXT", name, value }, dns: { a: string[], cname: string[] } | null, lastCheckedAt } }`. `dns` is filled (from `getDomainConfig`) only when status is `verified` or `live`; values come from the Vercel response, **never hard-coded**.
- `POST /api/domains` body `{ hostname }`: 402 unless `hasPaidAccess`; 400 `domain_invalid` (with the reason) from `validateHostname`; 400 `no_site` unless the user has a `published` `sites` row; 409 `domain_taken` if another user has the hostname; 409 `domain_exists` if the user already has a (different) domain (must delete first). Inserts `pending` with a new token. Does **not** call Vercel. Response same shape as GET.
- `POST /api/domains/verify`: loads the user's row (404 `no_domain`); rate limit 30/hour with `checkHourlyRateLimit(admin, "custom_domains" …)` is not possible on this table, so instead refuse when `last_checked_at` is less than 10 seconds old (429). Resolve TXT with `node:dns/promises` `resolveTxt(verifyRecordName)` (catch `ENODATA/ENOTFOUND` as "not found yet"). Not matching → update `last_checked_at`, respond `{ status: "pending", message: "We can't see the TXT record yet. DNS changes can take a few minutes." }`. Matching → `addDomain`, set `verified` + `verified_at`, then `getDomainConfig`: if `misconfigured === false` set `live`. Respond the GET shape.
- `GET /api/domains` also re-checks a `verified` row's config when called (cheap) and promotes it to `live` once `misconfigured` is false.
- `DELETE /api/domains` → `removeDomain` then delete the row. `{ ok: true }`.
- Cron `GET /api/cron/domains` (copy the `CRON_SECRET` bearer check from `src/routes/api/cron.free-queue.ts`): delete `pending` rows older than 14 days. Add it to `vercel.json` `crons` at `20 0 * * *` (keep the existing entry).

## Task E: Serve custom domains in `sites-app/`
Edit `sites-app/api/serve.ts` only (plus `sites-app/lib/` helpers): when the Host is **not** `*.${SITES_DOMAIN}`, look up `custom_domains` by exact hostname with status `verified` or `live`, then the owner's `sites` row (`status = 'published'`) → slug; otherwise the "isn't published" page. Everything else (path mapping, CSP + sandbox on every response, headers) stays as is. Hosts that are not valid hostnames → 404 without a query. Keep the copies in `sites-app/lib/` in sync with `src/server/` (`src/server/sites-app-sync.test.ts` enforces it; update both).

## Task F: Tests
Hostname validation (accepts `example.com`, `my-site.co.uk`, `xn--abc.com`; rejects `localhost`, `1.2.3.4`, `a.vercel.app`, `shipfolio.xyz`, `x.shipfolio.xyz`, `http://a.com`, `a b.com`, `-a.com`, `a..com`, 254 chars); TXT matching (chunked records, wrong token, empty); Vercel client with mocked `fetch` (add 409 same project OK / other project error, config mapping, token never in errors); route logic with a recording fake: create → `pending` and **no** Vercel call, verify with wrong TXT stays `pending`, verify with right TXT calls `addDomain` once and goes `verified`/`live`, another user's hostname → 409, free user → 402, serve lookup ignores `pending`.

## Out of scope
UI (handoff 07a), apex/www redirect pairing, subdomain→custom redirect, payments.

## Handoff report

### Files changed
- `.env.example`: Added `VERCEL_API_TOKEN`, `SITES_PROJECT_ID`, and `VERCEL_TEAM_ID`.
- `supabase/migrations/0017_custom_domains.sql`: Created `public.custom_domains` table with uuid primary key, user_id unique foreign key, hostname lowercase check, status check (`pending`, `verified`, `live`), verify_token, timestamps, row level security enabled, and revoked all privileges from anon/authenticated.
- `src/server/domains.ts`: Pure domain helpers: `validateHostname`, `verifyRecordName`, `newVerifyToken`, and `txtMatches`.
- `sites-app/lib/domains.ts`: Mirror copy of `src/server/domains.ts` for standalone `sites-app`.
- `src/server/vercel/domains.ts`: Vercel REST client (`addDomain`, `getDomainConfig`, `removeDomain`, `VercelDomainError`) using native `fetch`, bearer auth and `teamId` query param. Never leaks auth token in error messages.
- `src/routes/api/domains/index.ts`: Route `Route = createFileRoute("/api/domains/")` handling `GET`, `POST`, and `DELETE`.
  - `GET`: Returns `{ domain: null | { hostname, status, verifyRecord, dns, lastCheckedAt } }`. DNS details filled from `getDomainConfig` when status is `verified` or `live`. Rechecks config and promotes `verified` to `live` when `misconfigured === false`.
  - `POST`: 402 if `!hasPaidAccess(appUser)`, 400 `domain_invalid` if invalid format, 400 `no_site` if no published site, 409 `domain_exists` if user already configured a domain, 409 `domain_taken` if another user has the hostname. Inserts `pending` with `newVerifyToken()`. Does **not** call Vercel.
  - `DELETE`: Calls `removeDomain` on Vercel then deletes DB row.
- `src/routes/api/domains/verify.ts`: Route `POST /api/domains/verify`. Refuses requests when `last_checked_at` is under 10s old (429). Resolves TXT using `node:dns/promises` (via injectable `txtResolver`). If no match, updates `last_checked_at` and responds pending. If match, calls `addDomain`, sets `verified` + `verified_at`, checks `getDomainConfig` (promotes to `live` if `misconfigured === false`).
- `src/routes/api/cron/domains.ts`: Route `GET /api/cron/domains`. Protected by `CRON_SECRET` bearer check using `timingSafeEqual`. Deletes `pending` rows older than 14 days.
- `vercel.json`: Added cron schedule `20 0 * * *` for `/api/cron/domains` alongside existing free-queue cron.
- `sites-app/api/serve.ts`: Updated custom domain routing. When Host is not `*.${SITES_DOMAIN}`, validates hostname (404 without query if invalid), looks up `custom_domains` where status in `('verified', 'live')`, looks up owner's site with `status = 'published'`, and serves files under `{slug}/`. Never serves pending domains.
- `src/server/sites-app-sync.test.ts`: Added sync assertion for `src/server/domains.ts` matching `sites-app/lib/domains.ts`.
- `src/server/sites.test.ts`: Updated 404 test mock for `sites-app` to provide mocked Supabase client so dummy URL doesn't attempt external network call.
- `src/routeTree.gen.ts`: Regenerated TanStack router tree with new domain and cron routes.
- `src/server/domains.test.ts`: Tests for hostname validation, verify record names, random tokens, and TXT chunk matching.
- `src/server/vercel/domains.test.ts`: Tests for Vercel domain client with mocked `fetch` (same-project 409 success, other-project 409 error, config mapping, token sanitization, 404 removal success).
- `src/server/domains-routes.test.ts`: Integration tests for domain routes, rate limiting, verification flow, cron cleanup, and custom domain serving.

### Tests
- `src/server/domains.test.ts`: 15 tests passing.
  - Accepts `example.com`, `my-site.co.uk`, `xn--abc.com`, subdomains.
  - Rejects `localhost`, `1.2.3.4`, `a.vercel.app`, `shipfolio.xyz`, `x.shipfolio.xyz`, `http://a.com`, `a b.com`, `-a.com`, `a..com`, 254 chars.
  - TXT matching: chunked records, single chunk, multiple records, mismatched tokens.
- `src/server/vercel/domains.test.ts`: 10 tests passing.
  - `addDomain`: 200 OK, 409 same project OK, 409 other project error with clean message, token never in error.
  - `getDomainConfig`: typed mapping of `misconfigured`, `recommendedIPv4`, `recommendedCNAME`, token never in error.
  - `removeDomain`: 200 OK, 404 treated as success, throws on 500.
- `src/server/domains-routes.test.ts`: 16 tests passing.
  - `POST /api/domains`: 402 for free users, 400 for invalid hostname, 400 for no published site, 409 for taken domain, creates `pending` and does NOT call Vercel.
  - `POST /api/domains/verify`: 404 when no domain, 429 when under 10 seconds, wrong TXT stays `pending` without calling Vercel, matching TXT calls `addDomain` once and sets `verified`/`live`.
  - `GET /api/domains`: returns null when none, promotes `verified` to `live` when `misconfigured === false`.
  - `DELETE /api/domains`: calls `removeDomain` and deletes DB row.
  - `GET /api/cron/domains`: 401 unauthorized, deletes pending rows older than 14 days with valid bearer secret.
  - `sites-app`: ignores `pending` custom domains, serves custom domain with sandbox CSP when status is `verified` or `live` and site is published.
- `src/server/sites-app-sync.test.ts`: 4 tests passing (enforcing byte-exact copies in `sites-app/lib/`).
- Full vitest suite: 24 test files, 265 tests all passing.

### Security-related code changes
1. **Migration RLS lockdown** (`supabase/migrations/0017_custom_domains.sql`):
```sql
alter table public.custom_domains enable row level security;
revoke all on public.custom_domains from anon, authenticated;
```
2. **Never serve pending custom domains** (`sites-app/api/serve.ts`):
```ts
const { data: domainRow, error: domainError } = await supabase
  .from("custom_domains")
  .select("user_id, status")
  .eq("hostname", hostname)
  .in("status", ["verified", "live"])
  .maybeSingle();

if (domainError || !domainRow) {
  sendResponse(res, 404, UNPUBLISHED_HTML, "text/html; charset=utf-8");
  return;
}
```
3. **Domain creation does not call Vercel until TXT ownership is proven** (`src/routes/api/domains/index.ts` lines 180-205):
Domain row is inserted with `status: 'pending'` and a 24-byte cryptographically random token (`shipfolio-verify=...`). Only `POST /api/domains/verify` calls `addDomain` after `txtMatches` succeeds.
4. **No token leakage in Vercel client errors** (`src/server/vercel/domains.ts`):
Error messages contain HTTP status and Vercel error message only, never authorization header or token values.

### Anything done differently & why
- In `src/routes/api/domains/verify.ts`, exposed `setTxtResolver(fn)` to allow injecting a DNS TXT lookup function in tests. Node ESM module namespace exports cannot be mutated with `vi.spyOn(dnsPromises, "resolveTxt")` in Vitest.
- In `sites-app/api/serve.ts`, imported `validateHostname` from `../lib/domains` to validate incoming custom domain Host headers without DB queries when invalid.
- In `src/server/sites.test.ts`, the test for `missing or invalid host slug` was passing `host: "invalid.com"` without mocking the Supabase client, which previously triggered a live network request to `https://example.supabase.co` that timed out. Configured the mock client so it returns the 404 unpublished response immediately.

### Open questions
- None. All tasks and contracts in `docs/handoffs/06e-custom-domains.md` were implemented and verified.
