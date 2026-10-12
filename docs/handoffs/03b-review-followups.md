# Handoff 03b: Review follow-ups for handoff 03 (low-severity fixes + missing tests)

**Branch:** `feat/03b-review-followups`, already checked out in its own folder: **`/Users/suryavamshi/portfolio-builder-saas-03b`** (a git worktree). Work **only in that folder**. The main folder `/Users/suryavamshi/portfolio-builder-saas` is on `feat/03-finalize-html`, where Claude Code is fixing the serious issues at the same time. Run `npm ci` in your folder first (it has no `node_modules`).
**Plan reference:** `docs/handoffs/03-finalize-html-and-versions.md` (the spec; it still wins) and the code review of handoff 03 (2026-10-12).
**Reviewer:** Claude Code reviews this branch and merges it into `feat/03-finalize-html`. Follow the spec exactly; if something looks wrong, write it under "open questions" in your report.

---

## Why this exists
The review of handoff 03 found three small issues and several missing tests. Claude Code is fixing the serious ones (`<noscript>`, re-parse loop, SVG `<animate>`, the missing `xlink:href` test, version-save failures) on `feat/03-finalize-html`. You do the rest, here, in parallel.

## Stay inside these lines (to avoid merge conflicts)
- In `src/server/finalize-html.ts` change **only** the two places named in Tasks B and C. Don't reformat, rename, move or reorder anything else in that file.
- **Don't touch:** `src/server/finalize-html.test.ts`, `src/server/portfolio-versions.ts`, `src/server/portfolio-versions.test.ts`, `src/server/storage-markers.ts`, `src/server/template/images.ts`, any route in `src/routes/`, `src/server/vercel/`, migrations, `package.json`.
- Put **all new tests** in one new file: `src/server/review-followups.test.ts`.

---

## Task A: Correct the handoff 03 report (review finding #9)
`docs/handoffs/03-finalize-html-and-versions.md`, section **"Handoff report"** (at the end) describes things that don't exist. Rewrite that section so it matches the files on this branch. Check each claim against the code before you write it. Known wrong claims:
- Migration `0011` has **no** `version` column, **no** `(user_id, version desc)` index and **no** mutation-blocking trigger. It matches Task C of the spec exactly (quote its columns and the one index `portfolio_versions_user_created_idx`).
- `savePortfolioVersion` does **not** increment a version number. It inserts, upserts `portfolios`, then prunes to the newest 20.
- `signStorageMarkers` calls `createSignedUrl` once per distinct path (not `createSignedUrls`).
- `sanitizeHtmlForServing` does **not** run B3/B4 (only B5).
- Dependencies are `cheerio ^1.2.0` and `vitest ^5.0.3`.
- List the real test files and the real test count (`npx vitest run`).
Don't touch any other section of that file.

## Task B: `rel` on every kept `target="_blank"` link (review finding #12)
Spec B4: "add `rel="noopener noreferrer"` to every kept `<a>` that has `target="_blank"`". Today it's only added in the verified-http branch (`finalize-html.ts`, inside the `$("a, area").each(...)` loop, the `if (el.tagName.toLowerCase() === "a" && $el.attr("target") === "_blank")` block), so kept `#`, `mailto:` and `tel:` links miss it.
- Delete that per-branch block.
- Directly after the `$("a, area").each(...)` loop ends (before the `if (removedLinksCount > 0)` warning), add: `$('a[href][target="_blank"]').attr("rel", "noopener noreferrer");`
- Tests: a kept `mailto:`, `tel:`, `#anchor` and verified-http link, each with `target="_blank"`, all come out with `rel="noopener noreferrer"`; a link whose `href` was removed has neither `target` nor a new `rel`.

## Task C: Leave media elements without `src` alone (review finding #14, owner decision)
Today, in the `$("img, video, audio, track, input[type='image']").each(...)` loop, an element with no `src` is removed and counted as "not your own upload" (the `if (!src) { if (tagName !== "video") { ... } return; }` block). That deletes harmless markup (for example a lazy-load `<img data-src>`) and blames the user's uploads.
- **Decision:** an element with no `src` attribute (or an empty one) is **kept unchanged and not counted**. Replace that block with just `if (!src) return;`.
- Nothing else in that loop changes.
- Tests: `<img data-src="x.png" alt="a">` and `<audio controls></audio>` stay in the output and produce no "Removed ... images or media" warning.

## Task D: Missing tests (all in `src/server/review-followups.test.ts`)
Each test asserts on the **serialised HTML** (`res.html` or the returned string), not on cheerio `attr()`. Add:
1. `sanitizeHtmlForServing(addWatermark(page))` still contains the watermark (`<shipfolio-watermark`).
2. `sanitizeHtmlForServing` leaves an outside `<a href="https://evil.com">` and `<img src="https://evil.com/x.png">` in place (it must not do B3/B4).
3. `sanitizeHtmlForServing` removes `<link rel="stylesheet" href="http://fonts.googleapis.com/css2?family=Inter">` (http, not https) and keeps the https one.
4. `sanitizeHtmlForServing` removes `<svg><script xlink:href="https://evil.com/x.js"></script></svg>` (output has no `evil.com`).
5. `finalizeHtml` removes `<audio src="https://evil.com/a.mp3">`, `<video><track src="https://evil.com/t.vtt"></video>` (the track) and `<input type="image" src="https://evil.com/b.png">`, with the "Removed ... images or media files" warning.
6. `finalizeHtml` on a page with **no `<style>` element at all** (not a whitespace-only one) gives `ok: true` with the "no inline styles" warning.
7. `signedUrlsToMarkers`: an own signed URL followed by `&quot;` (as inside a serialised `style` attribute) becomes a marker and the `&quot;` survives; running `signedUrlsToMarkers` twice gives the same output as once; an uppercase `HTTPS://` signed URL is left as is (document today's behaviour; don't change the code).
8. `embedStorageImagesInHtml` (from `@/server/template/images`) with a fake `supabase` whose `storage.from().download` records calls: a signed URL whose path is `${userId}/../other/x.png` and a marker `shipfolio-storage://uploads/otherUser/photo/x.png` are **never downloaded** and stay unchanged in the output; an own marker is downloaded once and rewritten to `images/<basename>`.

---

## Out of scope: do NOT do these
- No changes for `<noscript>`, re-parsing, SVG `<animate>`/`<set>`/`<feImage>`, `xlink:href` on `<use>`, or `portfolio-versions.ts` (Claude Code is doing those).
- No refactors (no moving the regexes or `ownStoragePath`, no de-duplicating URL normalisation).
- No new dependencies. Don't edit `version2memory.md`, `README.md`, `userflow.md`.
- Don't touch the unrelated untracked files (`brag-output/`, `showreel/`, `LAUNCH_VIDEO.md`, `.agents/`, `.claude/skills/brag-slim`, `skills-lock.json`).

## Done when
1. `npx tsc --noEmit -p .`, `npm run lint` (0 errors), `npx vitest run` and `npm run build` all pass in `/Users/suryavamshi/portfolio-builder-saas-03b`.
2. `git diff feat/03-finalize-html --stat` shows changes only in: `docs/handoffs/03-finalize-html-and-versions.md` (Handoff report section only), `docs/handoffs/03b-review-followups.md` (your report), `src/server/finalize-html.ts` (the two spots), `src/server/review-followups.test.ts`.

## When finished
- Commit on `feat/03b-review-followups` (one commit per task is fine). **Don't push, merge, rebase or open a PR**, and don't touch the main folder.
- Append a **"Handoff report"** section to **this** file: files changed, the list of new tests, anything you did differently and why, open questions. Every claim in it must match the code.

---

## Handoff report
