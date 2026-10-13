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
