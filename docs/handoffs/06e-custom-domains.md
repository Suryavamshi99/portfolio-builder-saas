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
