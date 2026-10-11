# Handoff 02: Lock down direct database access (users.plan + portfolio HTML)

**Branch:** `feat/02-lock-down-db-privileges` (already created locally with this file on it; check it out and work there)
**Plan reference:** `version2memory.md` section 6.12, "Row-level security rule for the new data", and section 6.14 build step 1.
**Reviewer:** Claude Code reviews this branch line by line and applies the migration itself. **This is security work: follow the spec exactly and do not improvise.**

---

## Read first
1. `version2memory.md` sections **0**, **2**, **4** and **6.12**.
2. `supabase/migrations/0001_init.sql`, `0006_admin_flag.sql` and `0007_generated_html.sql`.
3. `src/lib/supabase/admin.ts` (the service-role client) and `src/server/users.ts`.

## Why this exists: two live holes (both confirmed on the real database, 2026-10-11)

The app talks to Supabase as the logged-in user. Any logged-in user can also call Supabase's REST API directly with their own session token, skipping our server completely. Row-level security only controls **which rows** a user can touch, not **which columns**. On top of that, Supabase gives the `authenticated` role **table-wide** privileges by default.

1. **Anyone can make themselves Pro or admin, for free.** Migration `0006` ran `revoke update (plan, is_admin) on public.users from authenticated`. Revoking a *column* privilege does nothing while the *table-wide* UPDATE grant still exists. The live database confirms it: `has_column_privilege('authenticated','public.users','plan','UPDATE') = true`, and the same is true for `is_admin`. With the "users can update their own row" policy, a user can PATCH `plan = 'pro'` or `is_admin = true` on their own row. They could also INSERT their row with those values.
2. **Free users can read the clean HTML, and anyone can write unchecked HTML.** `portfolios.generated_html` can be selected and updated by its owner through REST. A free user can read the un-watermarked page (bypassing Handoff 01). Anyone can also write arbitrary HTML that publish then deploys.

## The fix, in one sentence
Take away table-wide write access on `users` (keep only what `getOrCreateAppUser` needs), take away **all** direct access to `portfolios`, and make the server routes read and write `portfolios` with the service-role client, always scoped to the logged-in user's id.

---

## Task A: Migration `supabase/migrations/0010_lock_down_privileges.sql`

Write exactly this (keep the comments short, in the style of 0006):

```sql
-- Column-level REVOKE (0006) is a no-op while the table-wide grant Supabase
-- gives `authenticated` exists. Replace table-wide privileges with explicit ones.

-- users: a session may only create/touch its own row's id (getOrCreateAppUser's
-- upsert). plan and is_admin are written only by the service role
-- (Dodo webhook, /admin).
revoke insert, update on public.users from anon, authenticated;
grant insert (id), update (id) on public.users to authenticated;

-- portfolios: no direct access at all. Every read/write goes through server
-- routes using the service-role client scoped to the session's user id, so the
-- clean HTML never reaches a free user and unchecked HTML can't be stored.
revoke all on public.portfolios from anon, authenticated;
```

- Don't drop or change any RLS policy. RLS stays on as a second layer.
- **Don't apply it to Supabase.** Claude Code applies it after the code is deployed (see "Deploy order").

## Task B: Server routes use the service-role client for `portfolios`

In each of these four files, every `.from("portfolios")` call must use `createSupabaseAdminClient()` from `src/lib/supabase/admin.ts` instead of the request's `supabase`. **Always** scope it with `.eq("user_id", user.id)` for reads, or `user_id: user.id` for upserts, where `user` comes from `AuthedContext`. **Never** take a user id from the request body or query.

| File | Call to switch |
|---|---|
| `src/routes/api/content.ts` | `select("generated_html, updated_at")` |
| `src/routes/api/generate.ts` | the `upsert({ user_id, generated_html, updated_at })` after generation |
| `src/routes/api/publish.ts` | `select("generated_html")` |
| `src/routes/api/reset.ts` | the `upsert({ user_id, generated_html: null, updated_at })` |

- Create the admin client **once per request**, inside the handler, only where it's needed (e.g. `const admin = createSupabaseAdminClient();`).
- **Don't change anything else** in these routes. Everything other than the `portfolios` calls keeps using the user's `supabase` client: uploads, storage downloads, `embedStorageImagesInHtml(generatedHtml, supabase)`, rate limits, `byok_keys`, `portfolio_inputs`, `users`. The only purpose is to keep user-scoped RLS everywhere else.
- Update the doc comment at the top of `src/lib/supabase/admin.ts`. It currently says it's used for none of this. List the `portfolios` routes and the rule: only with an explicit `user.id` scope taken from the authenticated session.
- Search the repo (`grep -rn 'from("portfolios")' src`) and confirm no other non-admin code touches `portfolios` with the user client. `src/server/admin-users.ts` and `src/routes/api/admin/*` already use the service role, so leave them alone.

## Task C: No change needed for `users`
`getOrCreateAppUser` (`src/server/users.ts`) upserts `{ id }` only, which the new `insert (id), update (id)` grant allows. The Dodo webhook (`src/server/payments.ts`) and `/admin` already use the service role. **Don't change them.** If you find any other code path that writes `users` with the user client, stop and note it in the report. Don't work around it.

---

## Out of scope: do NOT do these
- No changes to RLS policies, or to any other table's privileges (`uploads`, `publications`, `generations`, `byok_keys`, `vercel_connections`, `portfolio_inputs`). Claude Code will review those separately.
- No changes to `src/start.ts`, payments/Dodo logic, the admin panel, the watermark, the generation flow or the UI.
- No new dependencies. Don't edit `version2memory.md`, `README.md` or `userflow.md`.
- Don't touch or commit the unrelated untracked files (`brag-output/`, `showreel/`, `LAUNCH_VIDEO.md`, `.agents/`, `.claude/skills/brag-slim`, `skills-lock.json`).

## Deploy order (important, don't change)
The new code works **both before and after** the migration, because the service role ignores grants. The old code **breaks** after the migration. So the order is: merge and deploy the code → then apply `0010`. Claude Code does the migration step.

## Done when (acceptance checks)
1. `npx tsc --noEmit -p .`, `npm run lint` and `npm run build` all pass.
2. `grep -rn 'from("portfolios")' src` shows only service-role uses: the four routes above via the admin client, plus the existing admin files.
3. Each switched call is scoped by `user.id` from `AuthedContext`. Quote each changed call in the report.
4. The migration file matches Task A exactly.
5. Claude Code will run the live checks after applying the migration: browser test as a free user, direct REST attempts to set `plan`, read `generated_html` and write `generated_html` (all must fail), plus `has_column_privilege` queries.

## When finished
- Commit on this branch (one commit per task is fine). **Don't push, open a PR or merge.**
- Append a **"Handoff report"** section to this file covering: files changed, each changed `portfolios` call quoted, anything you did differently and why, and anything you weren't sure about.

---

## Handoff report

### 1. Files changed
- **`supabase/migrations/0010_lock_down_privileges.sql`** (new): Added migration matching Task A word for word. Revokes table-wide `insert, update` on `public.users` from `anon, authenticated`, grants `insert (id), update (id)` to `authenticated`, and revokes all on `public.portfolios` from `anon, authenticated`. Not applied to Supabase.
- **`src/lib/supabase/admin.ts`**: Updated module doc comment to document that the service-role client is used for all reads/writes to `public.portfolios` (/api/content, /api/generate, /api/publish, /api/reset), and stated the rule that user-facing calls must always be explicitly scoped to `user.id` from `AuthedContext`.
- **`src/routes/api/content.ts`**: Changed the `portfolios` read to use `createSupabaseAdminClient()`, scoped to `user.id` from `AuthedContext`.
- **`src/routes/api/generate.ts`**: Changed the post-generation `portfolios` upsert to use `createSupabaseAdminClient()`, scoped to `user.id` from `AuthedContext`.
- **`src/routes/api/publish.ts`**: Changed the `portfolios` read to use `createSupabaseAdminClient()`, scoped to `user.id` from `AuthedContext`.
- **`src/routes/api/reset.ts`**: Changed the `portfolios` upsert reset to use `createSupabaseAdminClient()`, scoped to `user.id` from `AuthedContext`.

### 2. Changed `portfolios` calls (quoted)

#### `src/routes/api/content.ts`
```ts
        const admin = createSupabaseAdminClient();
        const { data, error } = await admin
          .from("portfolios")
          .select("generated_html, updated_at")
          .eq("user_id", user.id)
          .maybeSingle();
```

#### `src/routes/api/generate.ts`
```ts
        const updatedAt = new Date().toISOString();
        const admin = createSupabaseAdminClient();
        const { error: saveError } = await admin
          .from("portfolios")
          .upsert({ user_id: user.id, generated_html: html, updated_at: updatedAt }, { onConflict: "user_id" });
```

#### `src/routes/api/publish.ts`
```ts
        const admin = createSupabaseAdminClient();
        const { data: portfolio } = await admin
          .from("portfolios")
          .select("generated_html")
          .eq("user_id", user.id)
          .maybeSingle();
```

#### `src/routes/api/reset.ts`
```ts
        const updatedAt = new Date().toISOString();
        const admin = createSupabaseAdminClient();
        const { error: contentError } = await admin
          .from("portfolios")
          .upsert({ user_id: user.id, generated_html: null, updated_at: updatedAt }, { onConflict: "user_id" });
```

In all four cases, `user` is obtained directly from `const { user, supabase } = context as AuthedContext;` established by `authMiddleware`. No request body or query parameter is used for the user id.

### 3. Verification & Acceptance checks
1. **Compilation, Lint, and Build**:
   - `npx tsc --noEmit -p .`: Passed with exit code 0.
   - `npm run lint`: Passed with exit code 0 (0 errors).
   - `npm run build`: Passed with exit code 0 (client and server bundles built cleanly).
2. **`grep -rn 'from("portfolios")' src`**:
   Shows only service-role client uses:
   - `src/server/admin-users.ts:28`: admin service-role client
   - `src/routes/api/admin/users.$id.ts:24`: admin service-role client
   - `src/routes/api/admin/users.$id.ts:77`: admin service-role client
   - `src/routes/api/publish.ts:48`: `admin.from("portfolios")`
   - `src/routes/api/content.ts:25`: `admin.from("portfolios")`
   - `src/routes/api/reset.ts:62`: `admin.from("portfolios")`
   - `src/routes/api/generate.ts:231`: `admin.from("portfolios")`
3. **`users` writes audit (Task C)**:
   - Confirmed via `grep -rn 'from("users")' src` that `getOrCreateAppUser` in `src/server/users.ts` is the only non-admin code touching `users`, and it upserts `{ id: userId }` only.
4. **Migration content**:
   - `supabase/migrations/0010_lock_down_privileges.sql` matches the exact SQL specified in Task A word for word.

### 4. Anything done differently and why
- Nothing was done differently from the specification.

### 5. Items noted / open questions
- Untracked files (`brag-output/`, `showreel/`, `LAUNCH_VIDEO.md`, `.agents/`, `.claude/skills/brag-slim`, `skills-lock.json`) were left untouched.
- Migration was not applied to remote Supabase, awaiting deployment and application by Claude Code.
