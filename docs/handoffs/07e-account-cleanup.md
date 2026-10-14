# Handoff 07e: Delete hosted files when an account is deleted

**Worktree / branch:** `/Users/suryavamshi/portfolio-builder-saas-07e` on `feat/07e-account-cleanup`. **Rules:** `docs/handoffs/_rules.md`. No migrations.
**Read first:** `src/routes/api/admin/users.$id.ts` (DELETE: how it removes a user and their `uploads` files), `src/routes/api/reset.ts`, `src/routes/api/sites/unpublish.ts`, `src/routes/api/sites/publish.ts` (the `sites` bucket layout: `{slug}/index.html`, `{slug}/images/<name>`), `src/server/sites.ts`.

## Problem
Deleting an account removes the `sites` row (cascade) but leaves the files under `sites/{slug}/` in Storage. Reset also leaves a live site with a blank draft.

## Tasks
1. New `src/server/sites-storage.ts`: `removeSiteFiles(admin: SupabaseClient, slug: string): Promise<void>`: lists `{slug}/` and `{slug}/images/` (paginate; up to 1000 objects), removes everything found, throws on a storage error. `slug` must pass `validateSlug` first (else throw), and the listing/removal must never leave the `{slug}/` prefix. Reuse it in `src/routes/api/sites/unpublish.ts` and the admin takedown route `src/routes/api/admin/sites.$slug.unpublish.ts` instead of their own removal code (behaviour unchanged).
2. In the admin DELETE of a user (`users.$id.ts`): **before** deleting the user, look up their `sites` row (admin client) and call `removeSiteFiles` for its slug; a failure here must not block the deletion but must be logged with `console.warn` (slug only, no user data).
3. In `POST /api/reset` (user-initiated): leave the published site untouched (the plan says reset asks separately about unpublishing), but add the text "Your published site stays live until you unpublish it." to the success response as a new field `notes: string[]` (the existing fields do not change).
4. Tests with a recording fake of the Supabase client: lists both prefixes and removes all names; paginates; rejects an invalid slug before any call; the admin delete removes site files first and still deletes when the removal throws.

## Out of scope
Anything else in those routes, the UI, migrations, retention SQL.

## Handoff report

### Files changed
- `src/server/sites-storage.ts` (new): Implemented `removeSiteFiles(admin, slug, options)` which validates `slug` via `validateSlug` (throwing before any storage calls if invalid), lists `{slug}` and `{slug}/images` with pagination (up to 1000 objects), filters out directory placeholders and path traversal attempts, verifies all paths never leave the `{slug}/` prefix, removes all found files from the `sites` bucket, and throws on storage errors.
- `src/server/sites-storage.test.ts` (new): 9 unit tests covering prefix listing, file removal, pagination across pages with custom/default page sizes, rejecting invalid slugs before any storage call, path traversal prevention, error throwing on storage list/remove failure, admin delete user site files cleanup with failure logging (slug only, no user data) and non-blocking delete, and reset response notes verification.
- `src/routes/api/sites/unpublish.ts`: Replaced duplicate listing/removal logic with `await removeSiteFiles(admin, slug)`.
- `src/routes/api/admin/sites.$slug.unpublish.ts`: Replaced duplicate listing/removal logic with `await removeSiteFiles(admin, slug)`.
- `src/routes/api/admin/users.$id.ts`: In `DELETE`, looked up user's `sites` row before deleting the user, called `removeSiteFiles(admin, site.slug)`, caught failures with `console.warn` logging slug only (no user data) without blocking deletion.
- `src/routes/api/reset.ts`: Added `notes: ["Your published site stays live until you unpublish it."]` to the JSON success response while leaving the published site untouched.

### Tests
- `src/server/sites-storage.test.ts`:
  - `lists both prefixes and removes all names`: verified `{slug}` and `{slug}/images` prefixes are listed and all returned files are removed from `sites` bucket.
  - `paginates across multiple pages and removes all files`: verified pagination across multiple pages with offset progression (0 then 100) and that all 151 items across pages are removed.
  - `supports custom pageSize and caps at maxObjects`: verified pagination with custom page size.
  - `rejects an invalid slug before any call`: tested reserved, brand, double-hyphen, too-short, and path-traversal slugs; verified `removeSiteFiles` throws and `storage.from` is never called.
  - `never leaves the {slug}/ prefix even if storage returns path traversal filenames`: tested path traversal file names (`../../../etc/passwd`, etc.) are ignored and only safe `{slug}/` paths are removed.
  - `throws on storage list or remove error`: verified both `list` and `remove` storage errors throw.
  - `removes site files first and still deletes when the removal throws`: verified `removeSiteFiles` is called before user deletion, failure is logged via `console.warn` with slug only (no user data), and user is still deleted with status 204.
  - `removes site files and proceeds normally on success`: verified clean deletion flow.
  - `includes notes about published site staying live`: verified `POST /api/reset` response body.
- `src/server/sites.test.ts`: Verified existing tests for `POST /api/sites/unpublish` and `POST /api/admin/sites/$slug/unpublish` continue to pass with `removeSiteFiles`.
- Full test suite: 30 test files, 310 tests all passed.

### Security-related lines
1. Early slug validation & path confinement in `src/server/sites-storage.ts`:
```ts
  const validation = validateSlug(slug);
  if (!validation.ok) {
    throw new Error(`Invalid site slug: ${slug}`);
  }

  const validSlug = validation.slug;
...
        // Safety: reject path traversal
        if (
          item.name.includes("..") ||
          item.name.includes("/") ||
          item.name.includes("\\")
        ) {
          continue;
        }

        const fullPath = `${folder}/${item.name}`;

        // Ensure the path never leaves the {slug}/ prefix
        if (!fullPath.startsWith(`${validSlug}/`)) {
          continue;
        }
...
    const safePaths = filesToRemove.filter((p) => p.startsWith(`${validSlug}/`));
    if (safePaths.length > 0) {
      const { error: removeError } = await admin.storage
        .from(SITES_BUCKET)
        .remove(safePaths);
```
2. Admin DELETE privacy check in `src/routes/api/admin/users.$id.ts`:
```ts
          if (site?.slug) {
            try {
              await removeSiteFiles(admin, site.slug);
            } catch {
              console.warn(`Could not remove site files for slug: ${site.slug}`);
            }
          }
```
Logged `site.slug` only; no `params.id` or user details.

### Anything done differently and why
None. Followed all requirements and contracts exactly.

### Open questions
None.
