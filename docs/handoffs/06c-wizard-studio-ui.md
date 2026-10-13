# Handoff 06c: Wizard "how to generate" step, job progress, Connect page, Studio export + hosting UI

**Worktree / branch:** `/Users/suryavamshi/portfolio-builder-saas-06c` on `feat/06c-wizard-studio-ui`.
**Rules:** `docs/handoffs/_rules.md` (read first). **Plan:** `version2memory.md` sections 6.2, 6.4 (the `/connect` page), 6.6, 6.8 (publish dialog), 6.10.
**Migration:** none. UI only. You may add components under `src/components/studio/` and `src/components/wizard/`, a new `src/routes/connect.tsx`, and edit `src/routes/onboarding.tsx`, `src/routes/-studio/Editor.tsx`, `src/lib/` helpers you add. `src/routeTree.gen.ts` regenerates itself (don't hand-edit).

## Rule for building against APIs that don't exist yet
Claude Code and other agents are building the endpoints below **in parallel**. Code against the contracts exactly. Put every call in one typed client file `src/lib/api-client.ts` (fetch wrappers + the TypeScript types below) so a contract change is one edit. When an endpoint answers 404 (not deployed yet), the UI must show a neutral "Coming soon" state, never crash. Tests mock `fetch`.

## API contracts (final)
All JSON; errors are `{ error: { code, message, details?: string[], retryAfterSeconds?: number } }`.

**Generation jobs** (Claude Code builds):
- `POST /api/generations` body `{ source: "free" | "gemini", resumeUploadId: string, otherSpecifics?: string, designIntensity?: "minimal"|"bold", links?: {...same as today's /api/generate...}, instructions?: string }` → `202 { jobId: string, status: JobStatus }`. Errors as today (`401 byok_key_missing|byok_key_invalid`, `429 rate_limited|provider_rate_limited`, `400 invalid_request`).
- `GET /api/generations/:id` → `{ id, source, status: JobStatus, message: string, error: ApiError | null, retryAt: string | null, updatedAt: string }`. `JobStatus = "queued"|"reading"|"writing"|"checking"|"saving"|"done"|"failed"`. `message` is the plain-language progress line to show as is. `queued` + `retryAt` means free capacity is used up and the job will run automatically after that time (no email is sent; say "We'll run this when free capacity resets at <time>. You can leave this page and come back." and offer **Cancel**: `DELETE /api/generations/:id` → `{ ok: true }`, which only works while `queued`, plus **Use another method**). On `done`, reload content with `GET /api/content` (unchanged). On `failed`, show `error.message` and the `error.details` list (these are the unsupported-fact lines; the codes `generation_unsupported_claims` and `generation_invalid_output` get the titles already used in `onboarding.tsx`).
- `GET /api/generations/latest` → same shape or `null`.
- `GET /api/free/status` → `{ available: boolean, usedToday: number, limitToday: number, resetsAt: string }`.
- `GET /api/mcp/status` → `{ connected: boolean, latestJob: (same shape as a job) | null }`.

**Hosting** (handoff 06d builds):
- `GET /api/sites/check?slug=` → `{ status: "available"|"yours"|"taken"|"reserved"|"invalid", url: string }`.
- `GET /api/sites/me` → `{ site: { slug, url, status: "published"|"unpublished", publishedVersionId: string|null, updatedAt } | null, draftNewer: boolean }`.
- `POST /api/sites/publish` body `{ slug?: string }` (slug only on first publish) → `{ url: string }`; `402 payment_required`.
- `POST /api/sites/unpublish` → `{ ok: true }`.

**GitHub** (handoff 06b builds): `GET /api/github/status` → `{ connected, account, installUrl }`; `POST /api/export/github` body `{ repo: "owner/name" }` → `{ commitUrl, repo }` (400 `github_not_connected`, 400 `github_repo_unavailable`, 402).

**Existing, unchanged:** `GET /api/export/zip`, `GET /api/export/html`, `POST /api/publish` (deploy to the user's own Vercel), `GET /api/vercel/status`, versions routes, `GET /api/content`.

## Task A: Wizard step 5 "How should we generate it?" (`onboarding.tsx` + `src/components/wizard/`)
Replace today's single Gemini-key step with **three cards** (plan 6.2 step 5):
1. **⚡ Free** (default selected when `GET /api/free/status.available`): "No setup. N of M free generations left today." Shows a one-line consent: "Free models may keep your resume text to improve their AI. Use your own Gemini key or Claude/ChatGPT to avoid this." The user must tick it before generating.
2. **🤖 Use my Claude or ChatGPT**: "Best quality, uses your plan." Selecting it shows the waiting panel (Task C) instead of a Generate button.
3. **🔑 My Gemini key**: today's key form, unchanged behaviour.
Keep all existing wizard steps, validation and the saved-inputs behaviour. Remove the old synchronous wait (`/api/generate` + the timers).

## Task B: Job progress UI
Generating (cards 1 and 3) calls `POST /api/generations`, then polls `GET /api/generations/:id` every 2 s (stop on `done`/`failed`, on unmount, and after 10 minutes with a "taking longer than usual" message). Show `message` in the existing progress area (replaces the fake timer messages), a `queued` state with the reset time when `retryAt` is set, and the failure screen: title + `error.message` + the `details` bullet list + three buttons **Try again**, **Edit my details** (back to step 4, inputs kept), **Use another method** (back to the cards). `done` → `refreshPortfolioStatus()` then the existing hand-off screen. Resuming: on mount, if `GET /api/generations/latest` is not terminal, resume polling it.

## Task C: Claude/ChatGPT waiting panel + `/connect` page
- Waiting panel (plan 6.2 step 6): (a) not connected → button "Connect Claude or ChatGPT" to `/connect`; (b) connected → "Now say this in your chat: **Build my Shipfolio portfolio**" with a copy button; (c) polls `GET /api/mcp/status` every 3 s and shows *waiting for your chat* → *received, checking* → *ready* ("Open in Studio") or *needs fixes* (the job's `error.details`).
- `src/routes/connect.tsx` (logged-in only, like `/studio`): shows the connector URL `${window.location.origin}/mcp` with a copy button and numbered steps in two tabs (Claude.ai: Settings → Connectors → Add custom connector; ChatGPT: Settings → Connectors → Add), a "Connected ✓ / Not connected" badge from `/api/mcp/status`, and a link back to the wizard. No new dependency for tabs.

## Task D: Studio (`Editor.tsx` + `src/components/studio/`)
- One primary toolbar button: **Publish** (first time) / **Update site** (when `draftNewer`) / **Upgrade** (402). A status line beside it: the live URL (link), "Unpublished changes" when `draftNewer`.
- Publish dialog (first publish): name field pre-filled from the page title slug, checked as the user types (debounced 400 ms) with inline states *checking / available / taken / reserved / not allowed* from `/api/sites/check`, and a preview of the full address; the button is disabled unless `available`. Unpublish is a small text action with a confirm.
- **Export** menu grouping: Download zip, Download HTML, Copy HTML, Push to GitHub (connect via `installUrl` when not connected, then a `owner/name` field + Push; show the returned commit link), Deploy to my own Vercel (existing flow, unchanged behaviour). All behind the existing paid check UX.
- Keep Version history, regenerate-with-instructions and the existing shortcuts (replace **⌘/Ctrl+H** with **⌘/Ctrl+Shift+H**; ⌘+H hides the window on Mac). Regenerate now uses `POST /api/generations` + the same progress UI (reuse the component from Task B).

## Task E: Tests
Vitest for `api-client.ts` (URL/body/shape, 404 → "coming soon", error mapping) and for pure helpers you extract (slug-state mapping, job polling stop conditions with fake timers). No component snapshot tests. Check the UI by eye at desktop and 390 px width if you have a browser tool; otherwise say so in the report.

## Out of scope
Any file under `src/server/` or `src/routes/api/`, migrations, payments/Dodo UI, custom-domain UI (a later handoff).

## Handoff report

### Files changed / created
- `src/lib/api-client.ts`: Typed client wrapper for `/api/generations`, `/api/generations/:id`, `/api/generations/latest`, `/api/free/status`, `/api/mcp/status`, `/api/sites/check`, `/api/sites/me`, `/api/sites/publish`, `/api/sites/unpublish`, `/api/github/status`, and `/api/export/github`. Maps 404 responses to a neutral "Coming soon" `ApiError` with `isNotFound = true`.
- `src/lib/api-client.test.ts`: Vitest suite testing `apiClient` requests, URLs, query parameters, payloads, error mapping, 404 "Coming soon" state, and cancel DELETE method.
- `src/lib/studio-helpers.ts`: Pure helpers for slug formatting (`sanitizeSlug`), slug feedback interpretation (`getSlugFeedback`), job terminal checks (`isJobTerminal`), and polling stop/timeout evaluation (`shouldContinuePollingJob`).
- `src/lib/studio-helpers.test.ts`: Vitest suite covering slug normalization, validation states, terminal status detection, and 10-minute timeout polling cutoff.
- `src/components/wizard/GenerationMethodCards.tsx`: Wizard Step 5 component rendering the three generation cards: ⚡ Free (with consent checkbox and daily status count), 🤖 Claude or ChatGPT (MCP), and 🔑 My Gemini key (embedded BYOK manager).
- `src/components/wizard/JobProgressView.tsx`: Real job progress indicator replacing fake timers, queued capacity-reset view with time formatting and Cancel action, and detailed failure alert displaying `error.message` and `error.details` with Try again, Edit my details, and Use another method buttons.
- `src/components/wizard/McpWaitingPanel.tsx`: Waiting panel for Claude/ChatGPT generation with connector URL/chat prompt copy button, polling `/api/mcp/status` every 3s, displaying live state transitions (waiting for chat -> received, checking -> ready -> needs fixes).
- `src/routes/connect.tsx`: Dedicated `/connect` page with origin-derived `${window.location.origin}/mcp` copy button, connection status badge from `/api/mcp/status`, tabbed numbered instructions for Claude.ai and ChatGPT without new dependencies, and back link to wizard.
- `src/routes/onboarding.tsx`: Updated Step 5 to "How to Generate" with the three cards, replaced fake timer progress with background job polling (`POST /api/generations` + `GET /api/generations/:id` every 2s, stopping on done/failed/10min timeout), mounted check for non-terminal latest generation to resume polling, and integrated MCP waiting panel.
- `src/components/studio/PublishDialog.tsx`: Publish modal for first-time publishing with debounced (400ms) subdomain availability checking via `/api/sites/check`, preview of full address, inline state feedback (checking/available/taken/reserved/not allowed), and 402 payment upgrade redirection.
- `src/components/studio/ExportMenuDialog.tsx`: Unified export modal providing Download zip, Download HTML, Copy HTML, Push to GitHub (install link if not connected, owner/repo input, commit URL on success), and Deploy to own Vercel, all behind `hasPaidAccess` check.
- `src/components/studio/StudioToolbar.tsx`: Primary Studio header toolbar featuring one primary action (Publish / Update site / Upgrade), live URL link, "Unpublished changes" badge when `draftNewer`, small text Unpublish action with confirmation, and Export menu trigger.
- `src/routes/-studio/Editor.tsx`: Integrated `StudioToolbar`, updated keyboard shortcuts to replace `⌘/Ctrl+H` with `⌘/Ctrl+Shift+H` (avoiding macOS window hide conflict), and wired regeneration to background jobs (`POST /api/generations` + `JobProgressView`).
- `src/routeTree.gen.ts`: Regenerated route tree including the new `/connect` route.

### Tests
- `src/lib/api-client.test.ts`: 7 tests passing (404 coming soon handling, error payload mapping, non-JSON body resilience, generation creation request formatting, encoded ID retrieval, slug query check, job cancellation).
- `src/lib/studio-helpers.test.ts`: 6 tests passing (slug sanitization, slug feedback states, terminal job checks, polling continuation, timeout cutoff).
- Entire project vitest suite: 9 test files, 124 tests passing.
- `npx tsc --noEmit -p .`: 0 errors.
- `npm run lint`: 0 errors (16 pre-existing warnings in unchanged files).
- `npm run build`: successful production build.

### Anything done differently and why
- **Keyboard shortcut:** Changed version history shortcut from `⌘/Ctrl+H` to `⌘/Ctrl+Shift+H` as specified in Task D to prevent accidental window hiding on macOS.
- **Visual Eye Inspection:** Verified responsive layout constraints and breakpoints in code (e.g. mobile tabs, flex wrapping, truncate, and grid columns `sm:grid-cols-3` down to single column on mobile screens <= 390px). No headless browser tool was available in the current environment to inspect live rendering.

### Open questions
- None. All contracts in the prompt were followed exactly with neutral 404 fallbacks for endpoints being constructed in parallel by other agents.
