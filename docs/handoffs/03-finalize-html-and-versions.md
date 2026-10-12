# Handoff 03: `finalizeHtml()` (rule check + safety clean-up) and `portfolio_versions`

**Branch:** `feat/03-finalize-html` (already created locally with this file on it; check it out and work there)
**Plan reference:** `version2memory.md` section 6.1 ("`finalizeHtml()`", steps 1, 2, 3, 5 and 6), 6.12 and 6.14 build step 2. Fixes known problem **#7** (generated HTML isn't sanitised) and the "expiring link stored in the database" half of **#4**.
**Reviewer:** Claude Code reviews this branch **line by line** and applies the migration itself. **Part of this is security work (Task B). Follow the spec exactly and do not improvise.** If something in the spec looks wrong, stop and write it under "open questions" in your report instead of working around it.

---

## Read first
1. `version2memory.md` sections **0**, **2**, **4**, **6.1** and **6.12**.
2. `src/routes/api/generate.ts`, `src/routes/api/content.ts`, `src/routes/api/publish.ts`, `src/routes/api/reset.ts`.
3. `src/server/llm/index.ts` (`extractHtmlDocument`, `ProfileLinks`), `src/server/template/images.ts`, `src/server/watermark.ts`, `src/server/portfolio-inputs.ts`.
4. `supabase/migrations/0010_lock_down_privileges.sql` (the privilege pattern new tables must follow).

## What this handoff does and does NOT do
Build step 2 is split in three:
- **03 (this one):** `finalizeHtml()` without the fact check, the `portfolio_versions` table, and wiring both into today's synchronous `/api/generate`, `/api/content` and `/api/publish`.
- **04 (later):** `resume_texts` + the fact check + the one repair round.
- **05 (later):** background generation jobs (`generation_jobs`, polling, real progress statuses), and `generations.source/model`.

So: **no fact check, no repair round, no jobs, no UI changes** in this handoff.

---

## Task A: Dependencies
- Add **`cheerio`** (runtime dependency, latest 1.x) for parsing and editing HTML. **Never edit HTML with regular expressions in Task B**, except where this spec says so explicitly. Parse with `cheerio.load(html)` (the default parse5 document mode, which keeps the doctype).
- Add **`vitest`** (dev dependency) and a `"test": "vitest run"` script in `package.json`. No config file unless it's needed for the `@/` path alias (if so, a minimal `vitest.config.ts` using `vite-tsconfig-paths`, which is already installed).

## Task B: `src/server/finalize-html.ts` (security-critical, pure, no database or network)

### B1. Exports
```ts
export const STORAGE_MARKER_PREFIX = "shipfolio-storage://uploads/";

export interface FinalizeHtmlInput {
  rawText: string;               // the model's whole reply
  userId: string;                // the session user's id; only their own Storage paths are allowed
  supabaseUrl: string;           // process.env.SUPABASE_URL; only signed URLs from this origin are recognised
  links: ProfileLinks;           // the verified links from portfolio_inputs
  referenceText: string;         // resume text + "\n" + specifics (used only for mailto:/tel: in B4)
}

export type FinalizeHtmlResult =
  | { ok: true; html: string; warnings: string[] }
  | { ok: false; errors: string[] };

export function finalizeHtml(input: FinalizeHtmlInput): FinalizeHtmlResult;

/** Safety clean-up only (B5). Publish runs this again on whatever it serves. */
export function sanitizeHtmlForServing(html: string): string;
```
`errors` and `warnings` are **plain-language sentences for the user** (e.g. "The page was cut off before it finished."), not codes. Keep each one short. De-duplicate warnings (e.g. one "Removed 3 links that weren't in your verified links", not three lines).

### B2. Step 1: extract (hard errors)
1. `extractHtmlDocument(rawText)` (existing). If it throws → error `"The AI reply didn't contain a web page."`
2. If the extracted text doesn't end with `</html>` (case-insensitive, after trimming) → error `"The page was cut off before it finished."`
3. Check the **raw extracted string** (before parsing, because the parser invents missing tags) with case-insensitive regexes: it must contain `<!doctype html`, `<head`, `<body`, and a `<style` element with non-whitespace content. Each one missing → its own error, e.g. `"The page has no <head> section."`
4. Any error → return `{ ok: false, errors }` immediately. Don't continue.

### B3. Step 2a: images
For every `<img>`, decide on its `src`:
- **Signed Storage URL** → allowed only if **all** of these hold, then rewrite it to `STORAGE_MARKER_PREFIX + <storage path>` (path decoded once with `decodeURIComponent`, no query string):
  - parse it with `new URL()`; its `origin` equals `new URL(supabaseUrl).origin`;
  - its pathname starts with `/storage/v1/object/sign/uploads/`;
  - the storage path (the rest of the pathname) starts with `${userId}/` and contains no `..` segment.
- **Already a marker** (`src` starts with `STORAGE_MARKER_PREFIX`) → allowed only if the path after the prefix starts with `${userId}/` and has no `..` segment.
- **`data:image/...`** → allowed as is.
- **Anything else** (other hosts, stock photos, `http:`, relative paths, a signed URL for another user's path or from another origin) → remove the `<img>` element. Warning: `"Removed N images that weren't your own uploads."`

Also, everywhere in the document:
- Remove every `srcset` attribute and every `<source>` element (they can load outside images and we can't check them cheaply).
- In `<svg>`, on `<image>` and `<use>`: remove `href` / `xlink:href` unless it starts with `#` or `data:image/`.

The rewrite also covers the signed URL appearing anywhere else (for example a CSS `background-image` in a `style` attribute or the `<style>` block): after the `<img>` pass, do one regex replace over the serialised HTML for signed URLs that pass the same three checks, and turn them into markers. Signed URLs that fail the checks there are left as is (they're harmless text the CSP blocks; the publish step only bundles valid ones), but add a warning `"The page referenced an image that isn't yours; it won't load."`

### B4. Step 2b: links
For every element with an `href` (`<a>`, `<area>`), keep the `href` only if it is:
- an in-page anchor (`#...`), or
- `mailto:<address>` where `<address>` (without any `?query`) appears in `referenceText` (case-insensitive), or
- `tel:<number>` where the digits of the number appear, as a run of digits, in the digits-only version of `referenceText`, or
- an `http(s)` URL that **matches a verified link** from `links` (`linkedin`, `github`, every `githubProjects` entry, every `other[].url`).

**Matching rule:** normalise both sides and compare for equality. Normalise = parse with `new URL()` (if it throws, it's not a match); lowercase the host; drop a leading `www.`; ignore the scheme (`http` = `https`); drop the hash; drop one trailing `/` from the pathname; keep the query string as is. A verified link entry without a scheme (`github.com/jane`) is parsed as `https://` + entry.

Otherwise **remove the `href` attribute and keep the element and its text.** Warning: `"Removed N links that weren't in your verified links."`

Also remove `target` on any element whose `href` was removed, and add `rel="noopener noreferrer"` to every kept `<a>` that has `target="_blank"`.

### B5. Step 3: safety clean-up (`sanitizeHtmlForServing`, also called inside `finalizeHtml`)
Remove these **elements, with their contents**:
- `<script>` **with a `src` attribute** (inline `<script>` without `src` stays: the rules allow small inline effects)
- `<iframe>`, `<frame>`, `<frameset>`, `<object>`, `<embed>`, `<applet>`, `<portal>`, `<base>`
- every `<meta>` with an `http-equiv` attribute
- every `<link>` **except** `rel="stylesheet"` or `rel="preconnect"` whose `href` host is exactly `fonts.googleapis.com` or `fonts.gstatic.com` (https only)

Remove these **attributes**:
- `action`, `method` and `target` on `<form>`; `formaction`, `formmethod`, `formtarget` on any element (so no form can submit anywhere)
- `ping` on any element

In every `<style>` element's text, remove each `@import` rule whose URL isn't `https://fonts.googleapis.com/...` (one regex over the CSS text is fine here; match `@import` up to the next `;`).

`sanitizeHtmlForServing` must be **idempotent**: running it twice gives the same output as running it once. It must not do anything from B3/B4 (publish has no `links`/`userId` context), and it must not touch the watermark.

### B6. Step 2c: warnings and small fixes (never errors)
- No `<meta name="viewport">` → insert `<meta name="viewport" content="width=device-width, initial-scale=1">` at the start of `<head>`. Warning: `"Added a mobile viewport tag."`
- No `<nav>` → warning. No `<section>` → warning. No `<a href="#...">` left after B4 → warning `"The page has no in-page navigation."` Any `<img>` without a non-empty `alt` → one warning.
- Remove the watermark: every element with the `data-shipfolio-watermark` attribute **and** every `<shipfolio-watermark>` element (see `src/server/watermark.ts`). No warning.

### B7. Order inside `finalizeHtml`
B2 → parse once → watermark removal (B6) → B5 → B3 → B4 → viewport + warnings (B6) → serialise → the B3 regex pass over the serialised text → return `{ ok: true, html, warnings }`.

### B8. Tests `src/server/finalize-html.test.ts`
At least one test per bullet in B2–B6, plus:
- a signed URL for **another user's** path (`otherUserId/photo/x.png`) is **not** turned into a marker, and the `<img>` is removed;
- a signed URL from **another origin** with the right path is not turned into a marker;
- a path with `..` (`${userId}/../other/x.png`, also URL-encoded `%2E%2E`) is rejected;
- `https://www.LinkedIn.com/in/jane/` matches a verified `linkedin.com/in/jane`; `https://linkedin.com/in/jane-evil` does not;
- `javascript:alert(1)` and `data:text/html,...` hrefs are removed;
- an inline `<script>` without `src` is kept; `<script src="https://x">` is removed;
- `sanitizeHtmlForServing(sanitizeHtmlForServing(x)) === sanitizeHtmlForServing(x)` on a messy fixture;
- a watermarked page (`addWatermark(page)`) comes back with no watermark.

## Task C: Migration `supabase/migrations/0011_portfolio_versions.sql`
```sql
create table public.portfolio_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  html text not null,
  source text not null check (source in ('gemini', 'free', 'mcp')),
  model text,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index portfolio_versions_user_created_idx
  on public.portfolio_versions (user_id, created_at desc);

alter table public.portfolio_versions enable row level security;

-- No policies and no grants: only the service-role client (server routes)
-- reads or writes versions. See 0010 for why table-level privileges are revoked.
revoke all on public.portfolio_versions from anon, authenticated;
```
Write it exactly like this. **Do not apply it.** Claude Code applies it after review.

## Task D: `src/server/portfolio-versions.ts`
```ts
export const MAX_VERSIONS_PER_USER = 20;

export async function savePortfolioVersion(
  admin: SupabaseClient,   // the service-role client
  userId: string,
  version: { html: string; source: "gemini" | "free" | "mcp"; model: string | null; warnings: string[] },
): Promise<{ versionId: string; updatedAt: string }>;
```
It: inserts the `portfolio_versions` row → upserts `portfolios` (`generated_html = html`, `updated_at`) exactly like `generate.ts` does today → deletes this user's versions older than the newest `MAX_VERSIONS_PER_USER` (select the ids to keep, ordered by `created_at desc`, then delete the rest for this `user_id`). Throws on any database error. Every query is filtered by `userId`.

## Task E: Storage markers on the way out: `src/server/storage-markers.ts`
- Move `PHOTO_SIGNED_URL_TTL_SECONDS` out of `generate.ts` into this file and import it back.
- `signStorageMarkers(html, supabase, ttlSeconds): Promise<string>`: finds every `STORAGE_MARKER_PREFIX + path` occurrence (regex on the text is fine; the path ends at the first `"`, `'`, `)`, whitespace or `<`), signs each **distinct** path once with `supabase.storage.from("uploads").createSignedUrl`, and replaces every occurrence. If signing fails, leave the marker (the image just won't show).
- Change `embedStorageImagesInHtml` (`src/server/template/images.ts`) to also bundle **markers** the same way it bundles signed URLs today (download the path, put it in `images/<basename>`, rewrite to the relative path). Keep the existing signed-URL handling: rows saved before this change still contain signed URLs.

## Task F: Wire it in
### `src/routes/api/generate.ts`
- Replace `extractHtmlDocument(responseText)` + the `portfolios` upsert with: `finalizeHtml({ rawText: responseText, userId: user.id, supabaseUrl: process.env.SUPABASE_URL, links, referenceText: resumeText + "\n" + (otherSpecifics ?? "") })`.
  - `ok: false` → `422`, code `generation_invalid_output`, message `"The AI's page didn't pass our checks. Please try again."`, plus an extra `details: string[]` field in the error object with the errors. Extend `errorResponse` for that the same way `retryAfterSeconds` is handled.
  - `ok: true` → `savePortfolioVersion(admin, user.id, { html, source: "gemini", model: LLM_MODELS.google, warnings })`. On throw → the same 500 as today.
- The response becomes `{ html, updatedAt, warnings }`, where `html` is the saved HTML with markers signed (`signStorageMarkers` with the user's `supabase` client and `PHOTO_SIGNED_URL_TTL_SECONDS`), then watermarked for free users exactly as today.
- Leave everything else (rate limit, key handling, photo, reference images, `recordGeneration`, error codes) unchanged. The photo URL sent to the model stays a signed URL; `finalizeHtml` turns it into a marker.

### `src/routes/api/content.ts`
- Before the watermark step, run `signStorageMarkers(html, supabase, PHOTO_SIGNED_URL_TTL_SECONDS)`. Nothing else changes.

### `src/routes/api/publish.ts`
- After `embedStorageImagesInHtml`, run `sanitizeHtmlForServing(html)` on the result and deploy that. Nothing else changes.

### `src/routes/api/reset.ts`
- Also delete the user's `portfolio_versions` rows, **with the admin client** (users have no access to that table), scoped `.eq("user_id", user.id)`, right before the `portfolios` reset. Same error style as the other steps.

---

## Out of scope: do NOT do these
- No fact check, no `resume_texts`, no repair round, no background jobs, no version-history UI, no Studio or wizard changes.
- Don't touch the admin panel's HTML edit route, `src/start.ts`, payments, the watermark module, the guardrail prompt or `buildPortfolioHtmlUserMessage`.
- No dependencies other than `cheerio` and `vitest`. Don't edit `version2memory.md`, `README.md` or `userflow.md`.
- Don't touch or commit the unrelated untracked files (`brag-output/`, `showreel/`, `LAUNCH_VIDEO.md`, `.agents/`, `.claude/skills/brag-slim`, `skills-lock.json`).

## Deploy order
The code needs the `portfolio_versions` table, so: Claude Code applies `0011` → then merges and deploys. Generation fails with a 500 if the code ships first.

## Done when (acceptance checks)
1. `npx tsc --noEmit -p .`, `npm run lint`, `npm test` and `npm run build` all pass.
2. Every case listed in B8 has a test, and all tests pass.
3. `grep -rn 'from("portfolio_versions")' src` shows only the admin (service-role) client, always filtered by the session user's id.
4. The migration file matches Task C exactly.
5. Claude Code will then: apply `0011`, generate a real portfolio as a free test user and check the saved HTML holds a marker (not a signed URL), the preview shows the photo, the watermark is shown, and a `portfolio_versions` row exists; then confirm a direct REST read of `portfolio_versions` fails for that user.

## When finished
- Commit on this branch (one commit per task is fine). **Don't push, open a PR or merge.**
- Append a **"Handoff report"** section to this file: files changed; the full list of tests; anything you did differently and why; anything you weren't sure about.

---

## Handoff report
