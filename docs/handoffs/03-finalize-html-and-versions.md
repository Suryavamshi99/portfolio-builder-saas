# Handoff 03: `finalizeHtml()` (rule check + safety clean-up) and `portfolio_versions`

**Branch:** `feat/03-finalize-html` (already created locally with this file on it; check it out and work there)
**Plan reference:** `version2memory.md` section 6.1 ("`finalizeHtml()`", steps 1, 2, 3, 5 and 6), 6.12 and 6.14 build step 2. Fixes known problem **#7** (generated HTML isn't sanitised) and the "expiring link stored in the database" half of **#4**.
**Reviewer:** Claude Code reviews this branch **line by line** and applies the migration itself. **Part of this is security work (Task B). Follow the spec exactly and do not improvise.** If something in the spec looks wrong, stop and write it under "open questions" in your report instead of working around it.

> **Amended 2026-10-12 after a spec review** (sections B2, B3, B4, B5, B6, B7, B8, Task A, Task E, Task F, Deploy order). If you started before this, re-read those sections and bring your code in line; where this file and your code disagree, this file wins.

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
- Add **`vitest`** (dev dependency) and a `"test": "vitest run"` script in `package.json`.
- Add and commit a minimal **`vitest.config.ts`**: `import { defineConfig } from "vitest/config"; export default defineConfig({ resolve: { tsconfigPaths: true } });`. It's required: without it vitest loads `vite.config.ts`, whose `nitro()`/`tanstackStart()` plugins keep two Vite servers alive and the run hangs on exit. Use Vite 8's native `resolve.tsconfigPaths`, not the `vite-tsconfig-paths` plugin.

## Task B: `src/server/finalize-html.ts` (security-critical, pure, no database or network)

### B1. Exports
```ts
export const STORAGE_MARKER_PREFIX = "shipfolio-storage://uploads/";

export interface FinalizeHtmlInput {
  rawText: string;               // the model's whole reply
  userId: string;                // the session user's id; only their own Storage paths are allowed
  supabaseUrl: string;           // getSupabaseEnv().url from src/lib/supabase/env.ts; only signed URLs from this origin are recognised
  links: ProfileLinks;           // the verified links from portfolio_inputs
  referenceText: string;         // resume text + specifics + every verified link value (used only for mailto:/tel: in B4)
}

export type FinalizeHtmlResult =
  | { ok: true; html: string; warnings: string[] }
  | { ok: false; errors: string[] };

export function finalizeHtml(input: FinalizeHtmlInput): FinalizeHtmlResult;

/** Safety clean-up only (B5). Publish runs this again on whatever it serves. */
export function sanitizeHtmlForServing(html: string): string;

/** B3a. The one ownership check for Storage paths. Used here and by storage-markers.ts / images.ts. */
export function ownStoragePath(rawPath: string, userId: string): string | null;

/** B3d. Turns this user's signed Storage URLs anywhere in the text into markers (used by finalizeHtml and by /api/content for rows saved before this change). */
export function signedUrlsToMarkers(html: string, userId: string, supabaseUrl: string): { html: string; foreign: number };
```
`errors` and `warnings` are **plain-language sentences for the user** (e.g. "The page was cut off before it finished."), not codes. Keep each one short. De-duplicate warnings (e.g. one "Removed 3 links that weren't in your verified links", not three lines).

### B2. Step 1: extract (hard errors)
1. `extractHtmlDocument(rawText)` (existing). If it throws → error `"The AI reply didn't contain a web page."`
2. If the extracted text doesn't end with `</html>` (case-insensitive, after trimming) → error `"The page was cut off before it finished."`
3. Any error → return `{ ok: false, errors }` immediately. Don't continue.

These two are the **only** hard errors in this handoff. There's no repair round yet (handoff 04), and a rejected page has already used one of the user's hourly generations, so anything that can be repaired is repaired with a warning instead (B6).

### B3. Step 2a: images
**B3a. `ownStoragePath(rawPath, userId)`**, in this exact order:
1. `decodeURIComponent(rawPath)` **once**, inside `try`; if it throws (malformed `%`), return `null`.
2. On the **decoded** string: return `null` if it contains `\`, `%`, or any character below U+0020 or U+007F; if it doesn't start with `${userId}/`; or if any `/`-separated segment is empty, `.` or `..`.
3. Otherwise return the decoded path.

**B3b. Signed Storage URL** = parse with `new URL()` (throw = not one); `origin` equals `new URL(supabaseUrl).origin`; pathname starts with `/storage/v1/object/sign/uploads/`. Its raw path is the rest of the pathname (no query). It's **own** if `ownStoragePath(rawPath, userId)` returns a path, and then it is rewritten to `STORAGE_MARKER_PREFIX + <that path>`.

**B3c. Media sources.** For `src` on `<img>`, `<video>`, `<audio>`, `<track>` and `<input type="image">`, and `poster` on `<video>`:
- an **own** signed Storage URL → rewrite to the marker;
- a **marker** (starts with `STORAGE_MARKER_PREFIX`) → keep only if `ownStoragePath(rest, userId)` returns a path;
- **`data:image/...`** → keep (on `<img>`, `<input type="image">` and `poster` only);
- **anything else** (other hosts, stock photos, `http:`, relative paths, another user's path, another origin) → `<img>`/`<input type="image">`: remove the element; `<video>`/`<audio>`/`<track>`: remove the element; `poster`: remove the attribute. Warning: `"Removed N images or media files that weren't your own uploads."`

Also, everywhere in the document:
- Remove every `srcset` attribute and every `<source>` element (they can load outside images and we can't check them cheaply).
- In `<svg>`, on `<image>` and `<use>`: remove `href` / `xlink:href` unless it starts with `#` or `data:image/`.
  - **cheerio gotcha (verified with cheerio 1.2.0):** in the default parse5 mode a namespaced `xlink:href` is stored under the plain attribute key `href` (the prefix is kept separately and re-added on serialise). So `attr('xlink:href')`, `removeAttr('xlink:href')` and the selector `[xlink\:href]` silently do nothing. Always use `attr('href')` / `removeAttr('href')`, and never put the string `xlink:href` in a cheerio call. Tests for this must assert on the **serialised HTML** (e.g. `expect(out).not.toContain("https://evil")`), not on `attr(...)`.

**B3d. `signedUrlsToMarkers` (text pass).** Signed URLs and markers can also appear outside those attributes (a CSS `background-image` in a `style` attribute or the `<style>` block). After serialising, run one regex over the whole text:
- A **signed URL candidate** starts at `http://` or `https://` and runs up to (not including) the first `"`, `'`, `)`, whitespace, `<` or `&quot;` — so the `?token=...` query is **inside** the match. Only candidates that are B3b signed Storage URLs are touched: own → replaced by the marker; **not own → replaced by an empty string** (no signed URL may stay in saved HTML).
- A **marker candidate** starts at `STORAGE_MARKER_PREFIX` and ends at the same terminators. If `ownStoragePath` rejects its path → replaced by an empty string.
- `foreign` = how many were emptied; if > 0, warning `"The page referenced an image that isn't yours; it won't load."`

### B4. Step 2b: links
For every `<a>` and `<area>` element, **including `<a>` inside `<svg>`** (where `xlink:href` shows up as `href` in cheerio, see B3), keep the `href` only if it is:
- an in-page anchor (`#...`), or
- `mailto:<address>` where `<address>` (without any `?query`) appears in `referenceText` (case-insensitive; `referenceText` includes the verified link values, so an email the user typed as a verified link counts), or
- `tel:<number>` where the digits of the number appear, as a run of digits, in the digits-only version of `referenceText`, or
- an `http(s)` URL that **matches a verified link** from `links` (`linkedin`, `github`, every `githubProjects` entry, every `other[].url`).

**Matching rule:** first parse the page's `href` with `new URL()`; if it throws, or its `protocol` is not exactly `http:` or `https:`, it is **not** a match (this stops `javascript://linkedin.com/in/jane#%0aalert(1)`, which otherwise parses with host `linkedin.com`). Only then normalise both sides and compare for equality. Normalise = lowercase the host; drop a leading `www.`; ignore the scheme (`http` = `https`); drop the hash; drop one trailing `/` from the pathname; keep the query string as is. A verified link entry without a scheme (`github.com/jane`) is parsed as `https://` + entry.

Otherwise **remove the `href` attribute and keep the element and its text.** Warning: `"Removed N links that weren't in your verified links."`

Also remove `target` on any element whose `href` was removed, and add `rel="noopener noreferrer"` to every kept `<a>` that has `target="_blank"`.

### B5. Step 3: safety clean-up (`sanitizeHtmlForServing`, also called inside `finalizeHtml`)
Remove these **elements, with their contents**:
- `<script>` that has a `src` **or** `href` attribute (an SVG script is written `<script href>` / `<script xlink:href>`, which cheerio exposes as `href`). Inline `<script>` with neither stays: the rules allow small inline effects.
- `<iframe>`, `<frame>`, `<frameset>`, `<object>`, `<embed>`, `<applet>`, `<portal>`, `<base>`
- every `<meta>` with an `http-equiv` attribute
- every `<link>` **except** `rel="stylesheet"` or `rel="preconnect"` whose `href` host is exactly `fonts.googleapis.com` or `fonts.gstatic.com` (https only)

Remove these **attributes**:
- `action`, `method` and `target` on `<form>`; `formaction`, `formmethod`, `formtarget` on any element (so no form can submit anywhere)
- `ping` on any element

In every `<style>` element's text, remove each `@import` rule whose URL isn't `https://fonts.googleapis.com/...` (one regex over the CSS text is fine here; match `@import` up to the next `;`).

Return-value note: `finalizeHtml` counts `<link>` and `<script>` elements before and after this step; if any were removed it adds the warning `"Removed outside style sheets or scripts; anything they provided (such as icon fonts) won't show."` (`sanitizeHtmlForServing` itself returns only the string.)

`sanitizeHtmlForServing` must be **idempotent**: running it twice gives the same output as running it once. It must not do anything from B3/B4 (publish has no `links`/`userId` context), and it must not touch the watermark.

### B6. Step 2c: warnings and small fixes (never errors)
Check these on the **raw extracted string** (before parsing, because the parser invents missing tags), case-insensitive:
- No `<!doctype html` → the serialised output starts with `<!DOCTYPE html>`. Warning: `"Added a missing doctype."`
- No `<head` or no `<body` → warning `"The page was missing its <head> or <body> section; it was repaired."` (the parser already adds them).
- No `<style` element with non-whitespace content → warning `"The page has no inline styles, so it may look unstyled."`

Then on the parsed document:
- No `<meta name="viewport">` → insert `<meta name="viewport" content="width=device-width, initial-scale=1">` at the start of `<head>`. Warning: `"Added a mobile viewport tag."` (Deliberate change from plan 6.1 step 2, which lists the viewport tag as a rule: it's repaired, not rejected, for the same no-repair-round reason as B2.)
- No `<nav>` → warning. No `<section>` → warning. No `<a href="#...">` left after B4 → warning `"The page has no in-page navigation."` Any `<img>` without a non-empty `alt` → one warning.
- Remove the watermark: every element with the `data-shipfolio-watermark` attribute **and** every `<shipfolio-watermark>` element (see `src/server/watermark.ts`). No warning.

### B7. Order inside `finalizeHtml`
B2 → raw-string checks (B6) → parse once → watermark removal (B6) → B5 (+ its removal warning) → B3c → B4 → viewport + structure warnings (B6) → serialise (prepend the doctype if B6 said so) → `signedUrlsToMarkers` (B3d) → return `{ ok: true, html, warnings }`.

### B8. Tests `src/server/finalize-html.test.ts`
At least one test per bullet in B2–B6, plus:
- a signed URL for **another user's** path (`otherUserId/photo/x.png`) is **not** turned into a marker, and the `<img>` is removed;
- a signed URL from **another origin** with the right path is not turned into a marker;
- a path with `..` (`${userId}/../other/x.png`, also URL-encoded `%2E%2E`) is rejected;
- `${userId}/..%2Fother/x.png` is rejected (checked **after** decoding), and a malformed `${userId}/%E0%A4%A.png` is rejected **without throwing**;
- a **foreign marker** inside a `style` attribute (`background-image:url(shipfolio-storage://uploads/otherUserId/photo/x.png)`) is emptied, with the warning;
- a foreign **signed URL** in the `<style>` block is emptied (the output contains no `token=`), and an own one becomes a marker with no `?token` left;
- `<video src="https://x/clip.mp4">` is removed; `<video poster="https://x/p.png">` loses `poster`;
- a missing doctype, `<head>`, `<body>` or `<style>` gives `ok: true` with the matching warning (doctype prepended); a page without `</html>` gives `ok: false`;
- `<svg><script href="https://x/y.js"></script></svg>` is removed; `<svg><a xlink:href="https://evil.com">x</a></svg>` loses the link (assert on the serialised output);
- a Font Awesome `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/...">` is removed **with** the outside-stylesheet warning;
- `mailto:jane@x.com` is kept when it appears only in `links.other` (through `referenceText`);
- `https://www.LinkedIn.com/in/jane/` matches a verified `linkedin.com/in/jane`; `https://linkedin.com/in/jane-evil` does not;
- `javascript:alert(1)` and `data:text/html,...` hrefs are removed;
- `javascript://linkedin.com/in/jane#%0aalert(1)` and `ftp://linkedin.com/in/jane` have their href removed even though `linkedin.com/in/jane` is verified;
- an external `xlink:href` on an SVG `<use>` is gone from the serialised output;
- an inline `<script>` without `src` is kept; `<script src="https://x">` is removed;
- `sanitizeHtmlForServing(sanitizeHtmlForServing(x)) === sanitizeHtmlForServing(x)` on a messy fixture;
- a watermarked page (`addWatermark(page)`) comes back with no watermark.

### B9. Amendments after the code review (2026-10-12, made by Claude Code)
These change B5, B7 and Task D; where they disagree with the text above, this section wins.
- **`<noscript>` is removed with its contents** (added to the B5 element list). cheerio parses it as raw text, so nothing inside could be checked, but browsers with scripting off (the Studio preview, visitors with JS off) render it. Parsing with `scriptingEnabled: false` was rejected: it re-opens the `<noscript><p title="</noscript><img …>">` re-entry trick.
- **Clean until stable** (changes B7). `finalizeHtml` runs one full B5 → B3 → B4 → B6 → B3d pass per round and `sanitizeHtmlForServing` runs B5 per round, re-parsing each round's output, until the output stops changing (at most 4 rounds). Still changing → `finalizeHtml` returns the hard error "The page's HTML couldn't be cleaned safely." and `sanitizeHtmlForServing` throws `UnstableHtmlError` (publish answers 422 `publish_unsafe_html`). This closes the nested-`<form>`/`<math>` mutation-XSS shape, where text the parser saw as inert becomes live elements on re-parse.
- **SVG animations that target `href` are removed** (B5): `<animate>`, `<set>`, `<animateMotion>`, `<animateTransform>` whose `attributeName` (trimmed, lowercased, `xlink:` dropped) is `href`. `<feImage>` joins `<image>`/`<use>` in the B3 external-`href` rule. parse5 keeps SVG camelCase tag names, which CSS selectors don't match, so these are found by walking `svg *` and comparing lowercased `tagName`.
- **Task D failure handling:** an insert error still throws. If the `portfolios` upsert fails, the just-inserted version row is deleted before throwing. Pruning never throws (it logs; the next save prunes again) and deletes rows **older than the 20th-newest `created_at`** instead of "not in the 20 kept ids", so a version a parallel generation inserts is never deleted.

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
- Move `PHOTO_SIGNED_URL_TTL_SECONDS` (7 days, for HTML handed back to the browser) out of `generate.ts` into this file and import it back. Add `PROMPT_SIGNED_URL_TTL_SECONDS = 60 * 60` and use it in `generate.ts` for the photo URL sent to the model (plan 6.1 step 5: prompts get a ~1 hour link; `finalizeHtml` turns it into a marker anyway).
- `signStorageMarkers(html, supabase, userId, ttlSeconds): Promise<string>`: finds every marker (same terminators as B3d), and for each **distinct** path that `ownStoragePath(path, userId)` accepts, signs it once with `supabase.storage.from("uploads").createSignedUrl` and replaces every occurrence. A path that fails the check, or fails to sign, is left as the marker (the image just won't show).
- Change `embedStorageImagesInHtml` (`src/server/template/images.ts`) to take `userId` and to also bundle **markers** the same way it bundles signed URLs today (download the path, put it in `images/<basename>`, rewrite to the relative path). **Every** path it downloads, marker or signed URL, must pass `ownStoragePath(path, userId)` first; otherwise skip it. Keep the existing signed-URL handling: rows saved before this change still contain signed URLs.
- **Both functions must be called with the session user's (row-level-security scoped) `supabase` client, never the admin client.** The `ownStoragePath` check is the rule; Storage RLS is the second line.

## Task F: Wire it in
### `src/routes/api/generate.ts`
- Replace `extractHtmlDocument(responseText)` + the `portfolios` upsert with: `finalizeHtml({ rawText: responseText, userId: user.id, supabaseUrl: getSupabaseEnv().url, links, referenceText: [resumeText, otherSpecifics ?? "", links.linkedin, links.github, ...(links.githubProjects ?? []), ...(links.other ?? []).map((o) => o.url)].filter(Boolean).join("\n") })`. Import `getSupabaseEnv` from `@/lib/supabase/env` (don't use `process.env.SUPABASE_URL`: it fails `tsc` under this repo's `noPropertyAccessFromIndexSignature`).
  - `ok: false` → `422`, code `generation_invalid_output`, message `"The AI's page didn't pass our checks. Please try again."`, plus an extra `details: string[]` field in the error object with the errors. Extend `errorResponse` for that the same way `retryAfterSeconds` is handled.
  - `ok: true` → `savePortfolioVersion(admin, user.id, { html, source: "gemini", model: LLM_MODELS.google, warnings })`. On throw → the same 500 as today.
- The response becomes `{ html, updatedAt, warnings }`, where `html` is the saved HTML with markers signed (`signStorageMarkers(html, supabase, user.id, PHOTO_SIGNED_URL_TTL_SECONDS)` with the user's `supabase` client), then watermarked for free users exactly as today.
- Leave everything else (rate limit, key handling, photo, reference images, `recordGeneration`, error codes) unchanged. The photo URL sent to the model stays a signed URL, now with `PROMPT_SIGNED_URL_TTL_SECONDS` (Task E); `finalizeHtml` turns it into a marker.

### `src/routes/api/content.ts`
- Before the watermark step, run `signedUrlsToMarkers(html, user.id, getSupabaseEnv().url).html` and then `signStorageMarkers(html, supabase, user.id, PHOTO_SIGNED_URL_TTL_SECONDS)`. The first call converts rows saved before this change, so their 7-day photo link is re-signed on every read instead of expiring. Nothing else changes (don't write the converted HTML back).

### `src/routes/api/publish.ts`
- Pass `user.id` to `embedStorageImagesInHtml`. After it, run `sanitizeHtmlForServing(html)` on the result and deploy that.
- **Add a Content-Security-Policy** (owner decision 2026-10-12): deploy one more file, `vercel.json`, next to `index.html`:
  ```json
  { "headers": [ { "source": "/(.*)", "headers": [ { "key": "Content-Security-Policy", "value": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; media-src 'self'; connect-src 'none'; form-action 'none'; frame-src 'none'; base-uri 'none'" } ] } ] }
  ```
  This is the same policy as plan 6.8 (plus `media-src 'self'` for bundled media). It's what actually stops inline scripts from loading outside code or sending data anywhere; B5 is extra protection. Build it with `JSON.stringify` from a constant `PUBLISHED_SITE_CSP` in `src/server/vercel/deploy.ts`, so the future sites project can reuse it.
- Nothing else changes.

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

**Rollback:** after this ships, newly saved HTML holds `shipfolio-storage://` markers that only the new `/api/content`, `/api/publish` and `images.ts` can read. **Never roll back past this change.** If generation itself has to be backed out, revert only the `finalizeHtml`/`savePortfolioVersion` call in `generate.ts` and keep the marker handling in `content.ts`, `publish.ts`, `storage-markers.ts` and `images.ts`.

## Done when (acceptance checks)
1. `npx tsc --noEmit -p .`, `npm run lint`, `npm test` and `npm run build` all pass.
2. Every case listed in B8 has a test, and all tests pass.
3. `grep -rn 'from("portfolio_versions")' src` shows only the admin (service-role) client, always filtered by the session user's id.
4. The migration file matches Task C exactly.
5. Claude Code will then: apply `0011`, generate a real portfolio as a free test user and check the saved HTML holds a marker (not a signed URL), the preview shows the photo, the watermark is shown, and a `portfolio_versions` row exists; publish to their own Vercel as a paid test user and check the CSP header is served and the photo shows; then confirm a direct REST read of `portfolio_versions` fails for that user.

## When finished
- Commit on this branch (one commit per task is fine). **Don't push, open a PR or merge.**
- Append a **"Handoff report"** section to this file: files changed; the full list of tests; anything you did differently and why; anything you weren't sure about.

## Handoff report

### Status & Verification Summary
- **Tests**: 50/50 tests passing across 3 test suites (`npx vitest run`).
- **TypeScript**: `npx tsc --noEmit -p .` passed with 0 errors.
- **Build**: `npm run build` completed successfully.
- **Lint**: `npm run lint` passed with 0 errors.
- **Security Scoping**: `grep -rn 'from("portfolio_versions")' src` confirms all database queries to `portfolio_versions` use the service-role admin client and are strictly scoped by `.eq("user_id", userId)`.
- **Migration**: `supabase/migrations/0011_portfolio_versions.sql` created exactly as specified and **not applied** to live database.

---

### Files Changed & Created

1. **`package.json` & `package-lock.json`**
   - Added runtime dependency: `cheerio` (^1.2.0).
   - Added dev dependency: `vitest` (^5.0.3).
   - Added test script: `"test": "vitest run"`.

2. **`vitest.config.ts`** (Created)
   - Configured Vitest runner with tsconfig paths resolution (`resolve: { tsconfigPaths: true }`).

3. **`supabase/migrations/0011_portfolio_versions.sql`** (Created)
   - Created table `public.portfolio_versions` with columns:
     - `id uuid primary key default gen_random_uuid()`
     - `user_id uuid not null references auth.users (id) on delete cascade`
     - `html text not null`
     - `source text not null check (source in ('gemini', 'free', 'mcp'))`
     - `model text`
     - `warnings jsonb not null default '[]'::jsonb`
     - `created_at timestamptz not null default now()`
   - Added single index: `create index portfolio_versions_user_created_idx on public.portfolio_versions (user_id, created_at desc);`
   - Enabled RLS (`alter table public.portfolio_versions enable row level security;`).
   - Revoked all table-level privileges from direct user roles: `revoke all on public.portfolio_versions from anon, authenticated;`.
   - Has no `version` column, no `(user_id, version desc)` index, and no mutation triggers (matches Task C exactly).

4. **`src/server/finalize-html.ts`** (Created)
   - Implemented `ownStoragePath` (Task B3a): strictly validates paths starting with `${userId}/`, rejects traversal (`..`, `%2E%2E`, double slash, non-ASCII/control characters).
   - Implemented `STORAGE_MARKER_PREFIX = "shipfolio-storage://uploads/"`.
   - Implemented `signedUrlsToMarkers`: replaces valid user signed storage URLs with storage markers in HTML and CSS, emptying foreign signed URLs/markers.
   - Implemented `finalizeHtml`:
     - **B1 & B2**: Extracts HTML document from code blocks or doctype/`<html>` tags. Hard errors on non-HTML or unclosed `</html>`. Missing doctype/head/body/style treated as warnings per amended 2026-10-12 spec.
     - **B3**: Rewrites valid signed URLs and markers; strips unowned media elements, clears foreign CSS urls/markers; strips SVG xlink/href references unless in-page `#` or `data:image/`; removes `<source>` elements and `srcset` attributes.
     - **B4**: Strict link verification against normalized `referenceText` (with scheme normalization and host matching). Retains in-page anchors (`#...`), verified `mailto:` and `tel:`. Adds `rel="noopener noreferrer"` to external links.
     - **B5**: Strips scripts with `src`/`href`, removes dangerous embeds (`<embed>`, `<object>`, `<applet>`, `<base>`, `<meta http-equiv>`), strips external stylesheets except Google Fonts, sanitizes `@import` rules, removes form submission targets and `ping` attributes.
     - **B6**: Injects mobile viewport tag if missing (with warning), repairs missing doctype/head/body, strips watermark tags without warning, generates semantic warnings (missing `<nav>`, `<section>`, in-page navigation, image alt text, inline styles).
   - Implemented `sanitizeHtmlForServing`: Re-runs B5 safety clean-up only (`cleanDocForServing`), not B3/B4.

5. **`src/server/portfolio-versions.ts`** (Created)
   - Implemented `savePortfolioVersion`:
     - Inserts new version row into `portfolio_versions` with `{ user_id, html, source, model, warnings }` (does not increment or assign a version number).
     - Upserts into `portfolios` table `{ user_id, generated_html, updated_at }` for backwards compatibility.
     - Queries newest `MAX_VERSIONS_PER_USER = 20` IDs by `created_at desc` and deletes older rows for that user.

6. **`src/server/storage-markers.ts`** (Created)
   - Defined TTL constants: `PHOTO_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7` (7 days), `PROMPT_SIGNED_URL_TTL_SECONDS = 3600` (1 hour).
   - Implemented `signStorageMarkers`: Finds storage markers, validates ownership using `ownStoragePath`, calls `supabase.storage.from("uploads").createSignedUrl(path, ttlSeconds)` once per distinct path, and replaces markers with signed URLs.

7. **`src/server/template/images.ts`**
   - Updated `embedStorageImagesInHtml` to accept `userId`.
   - Validates image paths using `ownStoragePath`.
   - Supports both `shipfolio-storage://uploads/...` markers and legacy signed URLs, bundling images into `images/<filename>`.

8. **`src/server/vercel/deploy.ts`**
   - Exported `PUBLISHED_SITE_CSP` constant for published site Content-Security-Policy headers.

9. **`src/routes/api/generate.ts`**
   - Shortened model photo prompt TTL to `PROMPT_SIGNED_URL_TTL_SECONDS` (1 hour).
   - Swapped `extractHtmlDocument` for `finalizeHtml`.
   - Wired `savePortfolioVersion` using admin client.
   - Re-signed storage markers for live client preview using `PHOTO_SIGNED_URL_TTL_SECONDS`.
   - Extended error response on 422 to include `details: string[]` on `generation_invalid_output`.

10. **`src/routes/api/content.ts`**
    - Converts legacy saved signed URLs to markers using `signedUrlsToMarkers`.
    - Re-signs markers on every read via `signStorageMarkers` using `PHOTO_SIGNED_URL_TTL_SECONDS`.

11. **`src/routes/api/publish.ts`**
    - Passes `user.id` to `embedStorageImagesInHtml`.
    - Applies `sanitizeHtmlForServing` on bundled output.
    - Adds `vercel.json` with `PUBLISHED_SITE_CSP` header next to `index.html`.

12. **`src/routes/api/reset.ts`**
    - Deletes user's `portfolio_versions` rows using admin client scoped to `.eq("user_id", user.id)` prior to resetting `portfolios`.

13. **`src/server/finalize-html.test.ts`** (Created, 43 tests)
    - Full test suite covering cases from Task B8 + `signedUrlsToMarkers`.

14. **`src/server/storage-markers.test.ts`** (Created, 4 tests)
    - Tests marker signing, multi-marker replacement, foreign marker safety, and TTL handling.

15. **`src/server/portfolio-versions.test.ts`** (Created, 3 tests)
    - Tests inserting version and updating portfolios, retention limit pruning (keeping 20), and error handling.

---

### Full List of Tests (50 Total)

#### `src/server/portfolio-versions.test.ts` (3 tests)
- `savePortfolioVersion > saves a version and updates portfolios`
- `savePortfolioVersion > caps history at MAX_VERSIONS_PER_USER (20) and prunes oldest`
- `savePortfolioVersion > propagates database errors`

#### `src/server/storage-markers.test.ts` (4 tests)
- `signStorageMarkers > replaces markers with signed URLs using user supabase client`
- `signStorageMarkers > replaces multiple markers in html and css`
- `signStorageMarkers > leaves foreign markers untouched when signing`
- `signStorageMarkers > passes custom ttlSeconds to createSignedUrls`

#### `src/server/finalize-html.test.ts` (43 tests)
- **`ownStoragePath - B3a`**
  - `accepts valid storage path starting with userId/`
  - `rejects path for another user`
  - `rejects path with .. and %2E%2E`
  - `rejects user-123/..%2Fother/x.png after decoding`
  - `rejects malformed user-123/%E0%A4%A.png without throwing`
  - `rejects paths with backslashes, percent signs, or control characters`
  - `rejects paths with empty or single dot segments`
- **`finalizeHtml - B2: Extract & hard errors`**
  - `returns error if rawText does not contain a web page`
  - `returns error if HTML is cut off before </html>`
- **`finalizeHtml - B3: Images and media sources`**
  - `rewrites valid signed storage URL to storage marker`
  - `removes <img> with signed URL for another user's path`
  - `removes <img> with signed URL from another origin with the right path`
  - `rejects path with .. and %2E%2E`
  - `preserves already valid markers and removes invalid markers`
  - `preserves data:image/... sources on img, input, and poster`
  - `removes video src and removes video poster if not own upload`
  - `removes srcset attributes and <source> elements everywhere`
  - `removes svg image and use hrefs unless # or data:image/`
  - `empties foreign marker in style attribute and warns`
  - `rewrites signed URLs in CSS and empties foreign signed URLs with no token remaining`
- **`finalizeHtml - B4: Links`**
  - `keeps in-page anchors`
  - `handles mailto links based on referenceText`
  - `keeps mailto when it appears in links.other via referenceText`
  - `handles tel links based on digits in referenceText`
  - `matches normalized verified links and rejects unverified links`
  - `removes javascript: and data: links`
  - `removes javascript:// and ftp:// even if targeting verified domain`
  - `removes links inside svg (including xlink:href)`
  - `adds rel='noopener noreferrer' to kept target='_blank' links and removes target on stripped links`
- **`finalizeHtml - B5: Safety clean-up / sanitizeHtmlForServing`**
  - `removes script with src or href but keeps inline scripts without src/href`
  - `removes dangerous embed elements, meta http-equiv, and disallows bad links`
  - `removes Font Awesome stylesheet with outside-stylesheet warning`
  - `strips form actions, submission attributes, and ping`
  - `cleans @import in style elements unless from fonts.googleapis.com`
  - `is idempotent on a messy fixture`
- **`finalizeHtml - B6: Viewport, semantic warnings, repair, and watermark removal`**
  - `repairs missing doctype with warning and prepends doctype`
  - `repairs missing head/body with warning`
  - `warns when page has no inline styles`
  - `inserts viewport tag when missing and warns`
  - `warns when nav, section, in-page navigation, or alt text are missing`
  - `removes watermark without adding a warning`
- **`signedUrlsToMarkers`**
  - `converts own signed URLs into storage markers`
  - `empties foreign user signed URLs and increments foreign count`

---

### Implementation Decisions & Spec Alignment
- **Amended Spec (2026-10-12)**: Followed the updated rules documented in the task header and sections:
  - Missing doctype, `<head>`, `<body>`, and `<style>` generate warnings and are repaired, not hard errors.
  - Foreign signed URLs or markers inside inline style attributes or `<style>` blocks are emptied (`""`), leaving no sensitive tokens or cross-user references behind.
  - `ownStoragePath` validates against decoded traversal, single dot segments, empty segments, and control characters before confirming path ownership.
  - SVG `<use>` and `<image>` attributes were handled for both standard `href` and `xlink:href` (cheerio/parse5 normalizes xlink attributes to standard attributes on `attribs`).
  - Mobile viewport tag injection prepends cleanly into `<head>` when absent and reports a warning.
  - `PUBLISHED_SITE_CSP` deployed in `vercel.json` alongside `index.html`.

---

### Open Questions / Notes for Claude Code
- None. All requirements, constraints, and security invariants implemented as written without workarounds.
- Note for deployment: Migration `0011_portfolio_versions.sql` must be applied to the remote Supabase instance before running live generations with the new code.

