# Handoff 04a: Save the extracted resume text (`resume_texts`)

**Branch:** `feat/04a-resume-texts`, already checked out in its own folder: **`/Users/suryavamshi/portfolio-builder-saas-04a`** (a git worktree). Work **only in that folder**. Run `npm ci` there first. The main folder is used by Claude Code for handoff 04 (the fact check) at the same time.
**Plan reference:** `version2memory.md` sections 6.1 (step 4, fact check needs the resume text), 6.2 (step 1–3: "The extracted resume text is saved in `resume_texts` when uploaded (same 48 h deletion)"), 6.11 and 6.12.
**Reviewer:** Claude Code reviews this branch line by line and applies the migration itself. **This touches database privileges: follow the spec exactly, do not improvise.** If something looks wrong, write it under "open questions" in your report.

---

## Read first
1. `version2memory.md` sections **0**, **2**, **6.1**, **6.11**, **6.12** and the decision log entries for 2026-10-12.
2. `supabase/migrations/0010_lock_down_privileges.sql` and `0011_portfolio_versions.sql` (the privilege pattern you must copy).
3. `src/routes/api/uploads.ts` (POST handler), `src/server/resume-text.ts` (`extractResumeText`), `src/server/portfolio-versions.ts` (style of a small service-role helper), `src/lib/supabase/admin.ts`.

## Why
Today the resume text is extracted again from the PDF/DOCX on every generation. Handoff 04 adds a fact check that compares the generated page against the resume, and later paths (the MCP server, background jobs) also need the text. So the text is extracted **once, when the resume is uploaded**, and stored. It must disappear exactly when the resume file does (48 h after a successful generation, on reset, when the resume is replaced or deleted, and on account deletion).

## The design in one sentence
A new table keyed by the resume's **upload id** with `on delete cascade`, so every existing path that deletes the `uploads` row (the retention cron, `/api/reset`, `DELETE /api/uploads/:id`, the singleton replace in `POST /api/uploads`, account deletion) also deletes the text, with **no change to any retention SQL**.

---

## Task A: Migration `supabase/migrations/0012_resume_texts.sql`
Write exactly this:
```sql
-- Extracted resume text, saved once at upload (handoff 04a).
-- Keyed by the resume's upload row: every path that deletes the upload
-- (48 h retention cron, reset, replace, delete, account deletion) cascades here.
create table public.resume_texts (
  upload_id uuid primary key references public.uploads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create index resume_texts_user_idx on public.resume_texts (user_id);

alter table public.resume_texts enable row level security;

-- No policies and no grants: only the service-role client (server routes)
-- reads or writes resume text. See 0010 for why table-level privileges are revoked.
revoke all on public.resume_texts from anon, authenticated;
```
**Do not apply it.** Claude Code applies it after review.

## Task B: `src/server/resume-texts.ts`
```ts
export const MAX_RESUME_TEXT_CHARS = 100_000;

/** Saves (or replaces) the text for one resume upload. Throws on a database error. */
export async function saveResumeText(
  admin: SupabaseClient, // service-role client
  userId: string,
  uploadId: string,
  text: string,
): Promise<void>;

/** The saved text for this user's resume upload, or null if there is none. Throws on a database error. */
export async function loadResumeText(
  admin: SupabaseClient,
  userId: string,
  uploadId: string,
): Promise<string | null>;
```
- `saveResumeText`: trims the text and cuts it to `MAX_RESUME_TEXT_CHARS`; if the result is empty, does nothing (no row). Otherwise upserts `{ upload_id, user_id, text }` with `onConflict: "upload_id"`.
- `loadResumeText`: `select("text")` filtered by **both** `.eq("upload_id", uploadId)` and `.eq("user_id", userId)`, `.maybeSingle()`. Returns `data?.text ?? null`.
- Short comments only where the "why" isn't obvious, matching `portfolio-versions.ts`.

## Task C: Save the text on upload (`src/routes/api/uploads.ts`, POST)
- Right **after** the successful `uploads` insert (after the `if (insertResult.error || !insertResult.data) { ... }` block) and **before** the singleton replace block, add: when `kind === "resume"`:
  1. `const text = await extractResumeText(processed, validated.mime);`
  2. `await saveResumeText(createSupabaseAdminClient(), user.id, id, text);`
  3. Wrap both in **one** `try/catch`. On any error: `console.warn("Could not save resume text", e instanceof Error ? e.message : e)` and **continue**. The upload must still succeed (generation can still extract from the file).
- Use the same `id` the upload row was inserted with, and `user.id` from `AuthedContext`. Never take either from the request.
- Nothing else in this route changes (response shape, status codes, validation, quota, replace logic).

## Task D: Tests `src/server/resume-texts.test.ts`
Use a recording fake of the Supabase query builder (see the `fakeAdmin` helper in `src/server/portfolio-versions.test.ts`; copy it into your file, don't import it). Cover:
1. `saveResumeText` upserts `{ upload_id, user_id, text }` with `{ onConflict: "upload_id" }`, and the text is trimmed.
2. Text longer than `MAX_RESUME_TEXT_CHARS` is cut to exactly that length.
3. Whitespace-only text writes nothing.
4. A database error from the upsert makes `saveResumeText` throw.
5. `loadResumeText` filters by both `upload_id` and `user_id`, and returns the text, or `null` when there's no row.
6. A database error from the select makes `loadResumeText` throw.

---

## Out of scope: do NOT do these
- **Don't touch** `src/routes/api/generate.ts`, `src/server/finalize-html.ts`, `src/server/llm/*`, or any other route than `uploads.ts`. Claude Code wires the stored text into generation and builds the fact check.
- No change to retention SQL, `/api/reset`, `DELETE /api/uploads/:id`, or the admin panel (the cascade covers them).
- No backfill of existing resumes (generation will fall back to extracting from the file).
- No new dependencies. Don't edit `version2memory.md`, `README.md`, `userflow.md`, or other handoff files.
- Don't touch the unrelated untracked files (`brag-output/`, `showreel/`, `LAUNCH_VIDEO.md`, `.agents/`, `.claude/skills/brag-slim`, `skills-lock.json`).

## Deploy order
Migration `0012` must be applied **before** this code is deployed: until then the save in Task C fails (it's caught and logged, so uploads keep working, but no text is stored). Claude Code applies the migration.

## Done when
1. In `/Users/suryavamshi/portfolio-builder-saas-04a`: `npx tsc --noEmit -p .`, `npm run lint` (0 errors), `npx vitest run` and `npm run build` all pass.
2. `git diff main --stat` shows changes only in: `supabase/migrations/0012_resume_texts.sql`, `src/server/resume-texts.ts`, `src/server/resume-texts.test.ts`, `src/routes/api/uploads.ts`, and this file.
3. `grep -rn 'from("resume_texts")' src` shows only `src/server/resume-texts.ts`, always filtered by `user_id`.
4. The migration file matches Task A exactly.

## When finished
- Commit on `feat/04a-resume-texts` (one commit per task is fine). **Don't push, merge, rebase or open a PR**, and don't touch the main folder.
- Append a **"Handoff report"** at the end of **this** file: files changed, the tests, anything you did differently and why, open questions. **Every claim must match the code**; quote the changed lines of `uploads.ts`.

---

## Handoff report
