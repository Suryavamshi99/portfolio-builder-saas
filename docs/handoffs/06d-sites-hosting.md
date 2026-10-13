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

### Status & Verification Summary
- **TypeScript**: `npx tsc --noEmit -p .` passes with 0 errors.
- **Linter**: `npm run lint` passes with 0 errors (17 existing warnings unchanged).
- **Test Suite**: `npx vitest run` passes 141/141 tests across 8 test files (`sites.test.ts` (30 tests), `portfolio-versions.test.ts` (10 tests), `resume-texts.test.ts` (7 tests), `fact-check.test.ts` (20 tests), `storage-markers.test.ts` (4 tests), `review-followups.test.ts` (10 tests), `checked-generation.test.ts` (6 tests), `finalize-html.test.ts` (54 tests)).
- **Build**: `npm run build` succeeds cleanly.
- **Migration**: `supabase/migrations/0015_sites.sql` written exactly as specified in Task A and **not applied**.
- **Scope & Worktree**: Executed strictly in `/Users/suryavamshi/portfolio-builder-saas-06d` on branch `feat/06d-sites-hosting`.

---

### Files Changed & Created

1. **`supabase/migrations/0015_sites.sql`** (Created)
   - Created bucket and table strictly per Task A:
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

2. **`src/server/sites.ts`** (Created)
   - `RESERVED_SLUGS`: contains at least `www`, `api`, `app`, `admin`, `mail`, `ftp`, `ns1`, `ns2`, `smtp`, `imap`, `pop`, `blog`, `docs`, `help`, `support`, `status`, `static`, `assets`, `cdn`, `dev`, `staging`, `test`, `demo`, `root`, `login`, `signup`, `dashboard`, `studio`, `shipfolio`.
   - `BLOCKED_WORDS`: contains phishing/brand safeguards (`paypal`, `google`, `microsoft`, `apple`, `amazon`, `bank`, `login`, etc.).
   - `validateSlug(raw)`: validates lowercase, trimmed, regex `^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$`, checks for no `--`, ensures not reserved or blocked.
   - `slugFromTitle(title)`: ASCII-fold, lowercase, non-alphanumerics replaced with `-`, collapses and trims `-`, capped to 30 characters.
   - `siteUrl(slug)`: returns `https://${slug}.${process.env["SITES_DOMAIN"]}` (reads env inside function, never module scope).
   - `hostToSlug(host, sitesDomain)`: lowercases and strips port, ensures host ends with `.${sitesDomain}`, verifies candidate label with `validateSlug`, returns slug or null.

3. **`src/routes/api/sites/check.ts`** (Created)
   - `GET /api/sites/check?slug=`:
     - Protected with `authMiddleware`.
     - Rate limited via `checkHourlyRateLimit(supabase, "uploads", user.id, 120)` (copied usage from `uploads.ts`).
     - Returns `{ status: "available" | "yours" | "taken" | "reserved" | "invalid", url }`.

4. **`src/routes/api/sites/me.ts`** (Created)
   - `GET /api/sites/me`:
     - Protected with `authMiddleware`.
     - Reads user's `sites` and `portfolios` rows using admin client.
     - Computes `draftNewer`: `portfolio.updated_at > sites.updated_at`.
     - Returns `{ site: { slug, url, status, publishedVersionId, updatedAt } | null, draftNewer }`.

5. **`src/routes/api/sites/publish.ts`** (Created)
   - `POST /api/sites/publish` body `{ slug?: string }`:
     - Checks `hasPaidAccess(appUser)` or returns 402 `payment_required`.
     - Fetches `portfolios.generated_html` or returns 400 `no_portfolio`.
     - First publish requires `slug` passing `validateSlug` and slug uniqueness check; subsequent publishes enforce that the slug is fixed and ignore any new `slug` in the request body.
     - Runs `embedStorageImagesInHtml(generatedHtml, supabase, user.id)`.
     - Runs `sanitizeHtmlForServing(html)`, catching `UnstableHtmlError` to return 422 `publish_unsafe_html`.
     - Fetches latest `portfolio_versions` id for `published_version_id`.
     - Performs insert-then-upload order: upserts `sites` row first with `status: 'published'` and `onConflict: 'user_id'`. Any unique slug collision triggers 409 `slug_taken`.
     - Uploads `{slug}/index.html` to bucket `sites` (`contentType: text/html; charset=utf-8`, `upsert: true`).
     - Uploads images to `{slug}/images/<name>` allowing only `png`, `jpg`, `jpeg`, `webp`, `gif`, `svg+xml`, skipping disallowed files.
     - Lists `{slug}/images/` in bucket `sites` and removes stale images that are no longer referenced.
     - Returns `{ url }`.

6. **`src/routes/api/sites/unpublish.ts`** (Created)
   - `POST /api/sites/unpublish`:
     - Protected with `authMiddleware`.
     - Sets `sites.status = 'unpublished'`.
     - Deletes root files (`{slug}/index.html`) and all files under `{slug}/images/` from bucket `sites`.
     - Returns `{ ok: true }`.

7. **`src/routes/api/admin/sites.$slug.unpublish.ts`** (Created)
   - `POST /api/admin/sites/:slug/unpublish`:
     - Protected with `adminMiddleware`.
     - Verifies site exists for slug, updates `sites.status = 'unpublished'`.
     - Deletes `{slug}/...` files from bucket `sites`.
     - Returns `{ ok: true }`.

8. **`sites-app/`** (Created)
   - `package.json`: standalone with `@supabase/supabase-js` dependency.
   - `vercel.json`: rewrites `/(.*)` → `/api/serve`.
   - `api/serve.ts`:
     - Verifies required env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SITES_DOMAIN`) or returns 500.
     - Extracts slug via `hostToSlug(req.headers.host, sitesDomain)` or returns 404.
     - Looks up `sites` row by slug with service-role client; missing or `status !== "published"` returns 404 with friendly HTML and `robots: noindex`.
     - Maps `/` → `index.html`. For other paths, enforces `^/[A-Za-z0-9._/-]+$`, no `..`, no empty segment, and must start with `images/`. Invalid path returns 404.
     - Downloads `{slug}/{path}` with service role; missing returns 404.
     - Security headers applied on every response:
       ```ts
       "Content-Type": contentType,
       "X-Content-Type-Options": "nosniff",
       "Referrer-Policy": "strict-origin-when-cross-origin",
       "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300"
       ```
       and for HTML responses:
       ```ts
       export const SITES_CSP = `${PUBLISHED_SITE_CSP}; sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox`;
       headers["Content-Security-Policy"] = SITES_CSP;
       ```
       (with no `allow-same-origin`).

9. **`src/server/sites.test.ts`** (Created)
   - 30 tests covering:
     - All `validateSlug` constraints (reserved, blocked, length, regex, hyphens, normalization).
     - `slugFromTitle` ASCII folding, sanitization, and truncation.
     - `siteUrl` formatting with domain.
     - `hostToSlug` validation (ports, apex rejection, multi-level rejection, evil.com, reserved labels).
     - `SITES_CSP` compliance (starts with `PUBLISHED_SITE_CSP`, ends with sandbox directive, does not contain `allow-same-origin`).
     - `sites-app/api/serve.ts` handling: 500 on missing env, 404 on invalid hosts, path validation blocking traversal (`/..%2f`, `//`, `/index.html` non-images paths), proper CSP on HTML responses.
     - Routes with fake Supabase client:
       - 409 `slug_taken` race check before any upload occurs.
       - Fixed slug preservation on second publish (ignoring body slug).
       - Image extension filtering (uploading allowed image types, skipping `.exe`/`.pdf`) and cleanup of stale images.
       - Slug availability checking (`available`, `yours`, `taken`, `reserved`, `invalid`).
       - Status check in `/api/sites/me` calculating `draftNewer`.
       - Site unpublishing and admin takedown file deletion and status update.

10. **`.env.example`**
    - Added `SITES_DOMAIN=` documentation and entry.

---

### Security Quotes

From `src/routes/api/sites/publish.ts`:
```ts
// Gate with hasPaidAccess:
if (!hasPaidAccess(appUser)) {
  return errorResponse(402, "payment_required", "Upgrade to Pro to publish your site");
}

// Sanitize HTML before serving:
let sanitizedHtml: string;
try {
  sanitizedHtml = sanitizeHtmlForServing(html);
} catch (e) {
  if (!(e instanceof UnstableHtmlError)) throw e;
  return errorResponse(
    422,
    "publish_unsafe_html",
    "Your page couldn't be cleaned safely. Regenerate it, then publish again.",
  );
}

// Insert-then-upload order: reserve the slug before uploading files to prevent races:
const { error: upsertError } = await admin
  .from("sites")
  .upsert(
    {
      user_id: user.id,
      slug: targetSlug,
      status: "published",
      published_version_id: publishedVersionId,
      published_html_hash: htmlHash,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

if (upsertError) {
  if (upsertError.code === "23505" || upsertError.message.includes("unique")) {
    return errorResponse(409, "slug_taken", "This slug is already taken");
  }
  return errorResponse(500, "internal_error", "Could not reserve site slug");
}
```

From `sites-app/api/serve.ts`:
```ts
export const SITES_CSP = `${PUBLISHED_SITE_CSP}; sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox`;

const headers: Record<string, string> = {
  "Content-Type": contentType,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

if (isHtml) {
  headers["Content-Security-Policy"] = SITES_CSP;
}
```

---

### Anything Done Differently & Why
- In `sites-app/api/serve.ts`, exported `mapRequestPathToStoragePath` and client getter helper `setSitesSupabaseClientGetter` so `src/server/sites.test.ts` can thoroughly test path security (blocking directory traversal and malicious URL paths) and mock Supabase storage responses without modifying production handler behavior or requiring network calls.

---

### Open Questions
- None. All contracts and tasks were implemented according to `docs/handoffs/06d-sites-hosting.md`.
