# Handoff 06d: Host portfolios on `name.<sites-domain>` (publish, serve, unpublish)

**Worktree / branch:** `/Users/suryavamshi/portfolio-builder-saas-06d` on `feat/06d-sites-hosting`.
**Rules:** `docs/handoffs/_rules.md` (read first). **Plan:** `version2memory.md` sections 6.8 and 6.12.
**Migration number:** `0015_sites.sql`.
**Reviewer:** Claude Code reviews this **line by line**: it serves user-written HTML on a shared domain. Security rules below are not optional.

## Design (final)
- Published files live in a **private** Storage bucket `sites` at `sites/{slug}/index.html` and `sites/{slug}/images/…`. A **separate Vercel project** (code in `sites-app/` in this repo) maps the request `Host` to a slug and serves the files with the service-role key. The sites domain is separate from the app domain so app cookies are never sent to user pages.
- Env for the app: `SITES_DOMAIN` (the app's own domain, e.g. `shipfolio.xyz`, no scheme; pages live at `slug.shipfolio.xyz`; also add `www`, `app`, `api` to the reserved slugs). For `sites-app`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SITES_DOMAIN`.
- Payments are out of scope: gate only with `hasPaidAccess()` (402).

## Task A: Migration `supabase/migrations/0015_sites.sql`
```sql
insert into storage.buckets (id, name, public) values ('sites', 'sites', false) on conflict (id) do nothing;
create table public.sites (
  user_id uuid primary key references auth.users (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$'),
  status text not null default 'published' check (status in ('published', 'unpublished')),
  published_version_id uuid references public.portfolio_versions (id) on delete set null,
  published_html_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sites enable row level security;
revoke all on public.sites from anon, authenticated;
```
Write exactly this. **Do not apply it.** (No storage policies: the bucket is only accessed with the service role.)

## Task B: `src/server/sites.ts` (pure helpers + one service-role helper)
- `RESERVED_SLUGS`: at least `www api app admin mail ftp ns1 ns2 smtp imap pop blog docs help support status static assets cdn dev staging test demo root login signup dashboard studio shipfolio`.
- `validateSlug(raw): { ok: true; slug } | { ok: false; status: "invalid" | "reserved" }`: lowercase, trimmed; regex `^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$`; no `--`; not reserved; not on a small `BLOCKED_WORDS` list (include obvious slurs/phishing words such as `paypal`, `google`, `microsoft`, `apple`, `amazon`, `bank`, `login`... keep the list in a separate array, short).
- `slugFromTitle(title)`: ASCII-fold, lowercase, non-alphanumerics → `-`, trim `-`, cut to 30; may return `""`.
- `siteUrl(slug)`: `https://${slug}.${process.env.SITES_DOMAIN}`.
- `hostToSlug(host, sitesDomain): string | null`: lowercase, strip port; must end with `.${sitesDomain}`; the remaining label must be a single valid label (`validateSlug` ok); anything else (apex, multi-level, other domain) → `null`.

## Task C: Routes (`src/routes/api/sites/`)
All use `authMiddleware`; DB/Storage writes with the admin client scoped to `user.id`.
- `GET /api/sites/check?slug=` → `{ status: "available"|"yours"|"taken"|"reserved"|"invalid", url }`. `yours` if the slug belongs to this user. Rate limit with `checkHourlyRateLimit` (copy usage from `uploads.ts`, 120/hour).
- `GET /api/sites/me` → `{ site: {slug,url,status,publishedVersionId,updatedAt} | null, draftNewer }`. `draftNewer` is true when `portfolios.updated_at` is later than `sites.updated_at`.
- `POST /api/sites/publish` body `{ slug?: string }`:
  1. `hasPaidAccess` else 402. Load the user's `portfolios.generated_html` (400 `no_portfolio` if empty).
  2. If the user has no `sites` row: `slug` is required and must pass `validateSlug` and be free (else 400 `slug_invalid|slug_reserved`, 409 `slug_taken`). **The slug is fixed after first publish** (ignore a different `slug` later).
  3. Build files like `src/routes/api/export/zip.ts`: `embedStorageImagesInHtml(html, supabase, user.id)` → `sanitizeHtmlForServing` (422 `publish_unsafe_html` on `UnstableHtmlError`).
  4. Upload with the admin client to bucket `sites`: `{slug}/index.html` (`contentType: text/html; charset=utf-8`, `upsert: true`) and `{slug}/images/<name>` with the right content type from the extension (allow only png/jpg/jpeg/webp/gif/svg+xml; skip others). Remove stale files under `{slug}/images/` that are no longer referenced (list the folder, delete the difference).
  5. Latest `portfolio_versions` row id → `published_version_id`; upsert `sites` (`status: "published"`, `updated_at: now`); insert an `exports`-style log is NOT needed. Respond `{ url }`.
  Insert-then-upload order: reserve the slug (insert/upsert the `sites` row, unique violation → 409) **before** uploading files, so two users can't race for one slug.
- `POST /api/sites/unpublish` → set `status: "unpublished"`, delete `{slug}/…` files from the bucket. `{ ok: true }`.
- Admin takedown: add `POST /api/admin/sites/:slug/unpublish` using the existing admin middleware pattern in `src/routes/api/admin/` (look at how `users.$id.ts` authenticates). Same effect as above.

## Task D: The serving project `sites-app/`
A tiny standalone Vercel project (own `package.json` with `@supabase/supabase-js` only, own `vercel.json`, no framework). One function `api/serve.ts` (Node runtime) that every path is rewritten to (`vercel.json` rewrite `/(.*)` → `/api/serve`):
- `hostToSlug(req.headers.host, SITES_DOMAIN)` (copy that helper into `sites-app/` or import by relative path if your build allows; keep it identical). No slug → 404 plain page "Not found".
- Look up `sites` by slug with the service-role client; missing or `status !== "published"` → 404 page "This site isn't published." (friendly HTML, `noindex`).
- Map the path: `/` → `index.html`; any other path must match `^/[A-Za-z0-9._/-]+$`, contain no `..` and no empty segment, and must start with `images/` (else 404). Download `{slug}/{path}` with the service role; missing → 404.
- Response headers on every response: `Content-Type` by extension (`html` → `text/html; charset=utf-8`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`, and **for HTML** `Content-Security-Policy: default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; media-src 'self'; connect-src 'none'; form-action 'none'; frame-src 'none'; base-uri 'none'` **followed by `; sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox`** (no `allow-same-origin`). This is required: user pages are served from `*.<the app's own domain>` (decision 2026-10-13: no second domain), and the CSP `sandbox` directive gives every page an opaque origin, so its scripts cannot read or write cookies or storage for the parent domain (no "cookie tossing" against the app's login). Build the string as `SITES_CSP = PUBLISHED_SITE_CSP + "; sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox"` (copy `PUBLISHED_SITE_CSP` from `src/server/vercel/deploy.ts`; add a test that `SITES_CSP` starts with that exact string and ends with the sandbox directive, and that it does NOT contain `allow-same-origin`).
- Never read cookies or forward any request header to Supabase. Env missing → 500 plain text.

## Task E: Tests
`src/server/sites.test.ts` (slug validation incl. reserved/blocked/double hyphen/length, `slugFromTitle`, `hostToSlug` incl. `evil.com`, `a.b.sitesdomain`, apex, port), route tests with a recording fake of the Supabase client for publish (slug race → 409 before upload; slug fixed after first publish; sanitise runs; only allowed image types uploaded) and for `hostToSlug`/path mapping in `sites-app` (traversal attempts `/..%2f`, `//`, `/index.html`, non-`images/` paths). A test that `sites-app` CSP equals `PUBLISHED_SITE_CSP`.

## Out of scope
Custom domains (later handoff, migration 0017), the UI (handoff 06c), entitlements/expiry (payments), `src/routes/api/publish.ts` (the "deploy to my own Vercel" flow stays as is), any other migration.

## Handoff report
