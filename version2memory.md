# version2memory.md: Project context and decisions (Shipfolio AI)

**Last updated:** 2026-10-14
**Purpose:** the single source of truth to resume work after the session is compacted. Read this before doing anything on this project. It holds everything decided and discovered so far.

**Precedence:** this file replaces the earlier uncommitted `memory.md`. Where this file and `userflow.md` disagree, **this file wins.** `userflow.md` still describes the removed copy-paste path and the dropped JSON/template design (see section 3).

---

## 0. Quick summary (read first)

- **Product:** Shipfolio AI, a SaaS that turns a resume into a portfolio website. Repo: `/Users/suryavamshi/portfolio-builder-saas`, GitHub `Suryavamshi99/portfolio-builder-saas`.
- **Problem being solved:** the owner can't pay for every user's AI tokens or take on day-to-day billing for AI usage. Today the only option is the user's own Gemini key, which most users won't have.
- **Agreed direction:**
  1. **Three ways to generate:** (A) free models through a harness the owner runs, (B) the user's own Claude or ChatGPT subscription through an MCP server on the owner's domain, (D) the user's own Gemini key (already built). ~~(C) copy-paste prompt~~ has been **REMOVED** (decision 2026-10-11).
  2. **The output is always a complete `.html` file written by the model for each user, following the guardrail prompt rules.** No templates or JSON step. A shared `finalizeHtml()` checks the rules, cleans it for safety and checks facts against the resume.
  3. **Hosting on the owner's domain:** built as `www.shipfolio.xyz/s/<name>` (the owner can't change GoDaddy nameservers, so no wildcard DNS), plus an optional custom domain the user brings (served by the separate `shipfolio-sites` project).
  4. **Free = preview only (watermarked). Paid = everything:** HTML/zip download, GitHub push, deploy to their own Vercel ($19 one-time), plus hosting and custom domain through a **yearly hosting add-on** (decided 2026-10-11).
  5. **Payments: Dodo Payments only, everywhere** (decision 2026-10-11). No other payment provider in any country or for any product.
- **Status (2026-10-14): everything in the proposed design is built and deployed except payments** (Dodo hosting add-on, refunds, watermark/paywall check; production still runs `PAYMENTS_ENABLED=false`). Section 6 is kept as the design record; the decision log (section 1, newest first) says where the build deviated (notably: hosting is at `www.shipfolio.xyz/s/<name>`, not `<name>.<domain>`; GitHub push needs an existing repo; the fact check covers numbers only). Production: https://www.shipfolio.xyz. Pending owner steps: try the real Claude connector, try Push to GitHub, answer the Dodo setup questions.
- **Key point from the history:** the product **started** with "structured JSON → one fixed template" and **moved to "the model writes custom HTML" on 2026-09-25 (`fe465ac`)**. On 2026-10-11 the owner confirmed HTML stays: the aim is always to create `.html` files following the rules in the prompt.
- **Sections:** 0.5 history from the first commit → 1 decision log → 2 owner preferences → 3 files from this session → 4 tech stack, env vars, database → 5 current flow in detail + known problems → 6 proposed design → 7 open questions.

---

## 0.5 Product history: from the first commit to now

Rebuilt from all 46 commits (2026-09-11 → 2026-10-08), `README.md`, `API.md`, `DESIGN.md` and `FRONTEND_CHANGELOG.md`. Everything after 2026-10-08 is design discussion (section 1).

### Origins
- Started as **`portfolio-builder-saas`**, a multi-user product spun out of the owner's own personal site repo **`Suryavamshi99/surya-vamshi-portfolio`** (single-user, synced with Lovable, deployed to Cloudflare; **left untouched** by this project). The Studio editor (`Editor.tsx`, `fields.tsx`, `model.ts`, `sections.tsx`) was copied from that repo at the start.
- Original pitch: students turn a resume into a live portfolio, either by prompting an AI with **their own API key** (BYOK) or by editing structured fields, then **publish to their own Vercel account**.
- **How the work was split:** backend and API built in Claude Code sessions. The frontend UI was built by a separate tool, **"Antigravity"**, working only from **`API.md`** (the API contract and source of truth for endpoints). `FRONTEND_CHANGELOG.md` records Antigravity's work file by file.
- **Branding:** `portfolio-builder-saas` → **Portfol.io** (2026-09-17) → **Shipfolio** (2026-09-20), because the portfol.io domain was already taken. Don't imply ownership of any domain that isn't owned (fixed in 6c50e74). The onboarding wizard is titled "Shipfolio AI Wizard".

### Backend milestones (2026-09-11 → 2026-09-17)

| Date | Commit | What shipped |
|---|---|---|
| 09-11 | `015b352` | Project setup: TanStack Start, Vercel-ready build, Studio editor copied over, `API.md` with placeholder endpoints for milestones 1–6 |
| 09-13 | `9187b0e` | **M1 + M2:** Supabase auth, migrations 0001 (all tables, row-level security, private `uploads` bucket) + 0002 (retention cron jobs), AES-256-GCM encryption module, `authMiddleware`, `GET /api/me`, `GET`/`PUT /api/content` (content was **structured JSON** at this point) |
| 09-13 | `0e33611` | **M2b uploads:** real file-type detection, size limits, EXIF/GPS removal with `sharp`, single-slot vs capped kinds, quota, 10/hr upload limit |
| 09-13 | `7886002` | Storage clean-up Edge Function + migration 0003; **M3** BYOK keys + `/api/generate` (resume text extraction, guardrail prompt, **JSON Schema output from zod `contentSchema`**); **M4** shared hourly rate limiter |
| 09-13 | `7b42c7f` | **M5:** Vercel OAuth (signed stateless `state`), **template renderer `src/server/template/render.ts`** (one static HTML page from the Content JSON, all text escaped, deliberately plain-looking), image embedding, `POST /api/publish`, `/api/publish/status`, **global cross-site request (Origin) check** in `src/start.ts`; fixed `uploads.published` so it no longer protects files from the 30-day purge |
| 09-16 | `9a3d17f` | **Frontend built by Antigravity:** auth, onboarding wizard, BYOK, uploads, live preview, publish, Studio restyle |
| 09-16 | `e34af53` | Studio only opens once a portfolio exists (`portfolio-gate.ts`), wizard-first flow, confirm before regenerating, BYOK help tooltips, **`POST /api/reset`** ("start over", Settings "Danger Zone") |
| 09-17 | `c4078f6` | Portfol.io rebrand; prompt tuned with **Resume.io career guidelines** (X-Y-Z action-verb formula, positioning statement, skill groups) |
| 09-17 | `135e38a` | Found that `gemini-2.0-flash` had been **shut down by Google on 2026-06-01** → switched to `gemini-3.5-flash`; `gpt-4o` → `gpt-5.6-terra`; Vercel `team_id` captured (migration 0004) and passed on every Vercel call |
| 09-17 | `8138e27` | **M6 Dodo Payments:** one-time **$19 lifetime Pro**; the webhook is the only thing that grants Pro (Standard Webhooks HMAC, verifier written by hand, no SDK); duplicate-safe `purchases` (migration 0005); webhooks exempt from the Origin check. "Unlimited portfolios" was dropped as a Pro benefit because the schema allows **one portfolio per user**. Pro = more storage, higher limits, no "Published with…" badge |
| 09-17 | `c707f42` | Vercel rejects custom env vars starting with `VERCEL_` → renamed to **`OAUTH_VERCEL_CLIENT_ID` / `OAUTH_VERCEL_CLIENT_SECRET`** |
| 09-17 | `ae847c2` | Vercel 404 on every route: the **`nitro()` plugin from `nitro/vite`** was missing in `vite.config.ts`; added `vercel.json` `{"framework":"tanstack-start"}` |
| 09-17 | `6669e59` | 500 on every route: pdf-parse needed `DOMMatrix` → pass **`CanvasFactory` from `pdf-parse/worker`** so the bundler includes `@napi-rs/canvas` |
| 09-17 | `961642e` | npm's install-script approval gate → **`allowScripts` for `sharp`** in package.json |
| 09-18 | `6c50e74` | Stopped implying portfol.io is owned; dev-server fix (exclude pdf-parse/worker from Vite's `optimizeDeps`) |

### Landing page and brand (2026-09-20 → 2026-09-24)
- `2280ea8` **Shipfolio rebrand + waitlist mode** (`VITE_LAUNCH_MODE`, `POST /api/waitlist` → Google Apps Script → Sheet, `WAITLIST_WEBHOOK_URL/SECRET`). This is milestone 7 in `API.md`.
- `328158b` **Fake testimonials replaced** with **five real portfolios** built by the founder's friends (shared with their permission, linked to live sites). Never add fabricated testimonials.
- `b3958a7` "Cyber Emerald" design tokens + WebGL FluidOrb + mobile layout → `879c082` accent changed to **electric blue `#3457E8`** with zinc neutrals (`DESIGN.md` still says emerald `#10B981`, which is out of date).
- `4f54652` Integrations showcase (Claude, OpenAI, Gemini, Vercel) + Motion reveal/stagger layer; `design-taste-frontend` skill installed.
- Hero went through several versions: crisp orb with crosshair (`c9e16be`, **reverted**) → scroll-driven CSS glass orb (`57cd53b`; fixed sticky positioning by using `overflow-x: clip` instead of `hidden`) → **autoplay** orb (`eacfbb8`: the owner said the scroll-driven version looked blank) → dot-grid texture → **Gemini/Veo cinematic video** (`1cca85d`, `gemini-cinematic-web` skill) → **tile-grid portfolio concept video** (`1b64dcc`, refreshed in `22a2e86`) → readability fixes (`a1323e1`, `4cec141`, `2dae0ad`: the scrim was silently broken because `color-mix()` can't use a bare "R G B" variable).
- `c95c658` Marketing nav for logged-out visitors (How it works / Features / Portfolios), home page only.

### Admin, payments and generation changes (2026-09-24 → 2026-10-08)
- `ead9555` **Hidden admin panel at `/admin`** (no link anywhere). Separate login: scrypt-hashed password, signed httpOnly cookie, per-IP login rate limit. Env: `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` (create with `scripts/hash-admin-password.mjs`), `ADMIN_SESSION_SECRET`. It can list users (email, plan, storage, BYOK providers, Vercel), change plan, edit portfolio content (now `generated_html`), toggle admin, and delete accounts (including their stored files). Uses the service-role client only under `/api/admin/*`; it never decrypts BYOK keys.
- `8fd62c7` **`users.is_admin`** + migration 0006 **removes users' permission to update `plan` and `is_admin`** (row-level security is per row, so without this a user could set their own plan to `pro` through the REST API). ⚠️ **0006 never actually worked:** a column-level REVOKE does nothing while Supabase's table-wide grant to `authenticated` exists, so users *could* still set `plan`/`is_admin` until the 2026-10-12 hotfix and migration 0010 (see the decision log). `hasPaidAccess()` and `canAccessStudio()` take admins into account; `/api/publish` returns 402.
- `4aa2ae8` **BYOK limited to Gemini only** ("phase 1"), because Anthropic and OpenAI keys need a funded account, which breaks "generate free, pay to deploy". Gemini has a real free tier with no card needed.
- **`fe465ac` (2026-09-25), important: switched from "structured JSON → one fixed template" to "the model writes one complete custom HTML/CSS page per user".** Reason: the fixed template was only a placeholder for Antigravity to restyle, and *that restyle was never going to happen*, so design had to come from the model. Migration 0007 added `portfolios.generated_html` (the old `content` JSON column was kept, unused). Reference screenshots (sent as images) and the photo URL started being used (before this they were collected but never used). The guardrail prompt was rewritten (same no-invention rule, HTML output). `extractHtmlDocument` replaced `extractJsonObject`. `embedStorageImagesInHtml` replaced the old structured-content image embedding. **Studio's structured field editor (`model.ts`/`sections.tsx`/`fields.tsx`) was deleted**, replaced by an iframe preview + "regenerate with instructions". `contentSchema` and `data/content.ts` were deleted. `render.ts` is gone (only `template/images.ts` is left).
- `0757e44` Vercel OAuth errors now redirect back to Studio with `vercel_error` instead of crashing; **HTML download put behind payment**; plain-language progress messages; new `LlmRateLimitError` (Gemini 429 → "try again after HH:MM").
- `2d1fd4a` Mobile hero video autoplay made more reliable; simpler retention wording ("we delete X").
- `bb6758d` Wizard Next/Back disabled while an upload is running; **Minimal / Design-heavy toggle**; **structured profile links** (LinkedIn, GitHub, project links, other links) passed to the model as exact trusted URLs.
- `d32a49a` Retention gaps closed (uploads abandoned before any generation are now deleted by age, migration 0008); **`npm run setup:retention`** (`scripts/setup-retention-cron.mjs`) deploys the Edge Function, sets `CRON_SECRET` and seeds `app_config`, and is safe to re-run.
- `e17ef29` **Payment required before connecting Vercel** (checked on the server in `oauth/start`); the publish toolbar shows one action at a time (Upgrade → Connect Vercel → Publish); checkout `returnTo: studio|settings`; result dialog + polling `/api/me`; **`PAYMENT_TEST_MODE=dummy`** dev-only fake checkout (`/api/dev/payment-test`); a shared `grantProAccess` helper.
- `e4c5b02` **Patched a critical XSS (CVE-2026-102989 / GHSA-qx66-fv34-fjm8)** in TanStack Start: `@tanstack/react-start` 1.168.60, `react-router` 1.170.41, `router-plugin` 1.168.42 (all pinned exactly). Breaking change handled: `errorComponent`'s `error` is now `unknown`. Never set `DANGEROUSLY_DEPLOY_VULNERABLE_TANSTACK_START_XSS`.
- `00603e0` Download made free temporarily (`DOWNLOAD_FREE_FOR_NOW`) → replaced by **`aa68467` `PAYMENTS_ENABLED`** env switch. `/api/me` now returns `hasPaidAccess` computed on the server, so the client never works it out itself. **The local `.env` has `PAYMENTS_ENABLED=false`** (free testing state); `.env.example` defaults to enforced.
- `f608cdc` `VITE_LAUNCH_MODE=false/0/off/no` now means waitlist mode.
- `62e3c3f` (2026-10-08, latest commit) **Dark mode only**: theme toggle removed, `<html class="dark">` rendered on the server; the light-mode CSS variables are still in `styles.css` but unused.

### State of the docs (some are out of date)
- `README.md`: still describes the structured-JSON + `render.ts` pipeline and "Antigravity's job to restyle". **Out of date since `fe465ac`.**
- `API.md`: the endpoint contract for milestones 1–7 + changelog. Check it against the code before trusting it for anything touched after `fe465ac`.
- `DESIGN.md`: the design contract and tokens (taste-skill rules: hero at most 4 text elements, `min-h-[100dvh]`, rules for bento grids and eyebrow labels). The accent colour listed is the old emerald.
- **Verified against real services:** the Supabase project (migrations applied, sign-up and email confirmation work end to end). **Not verified with real traffic (at the time of the README):** real LLM calls with real keys, the Vercel OAuth/deploy flow (no registered OAuth app), and the real Dodo checkout and webhook.

### Resolved: HTML output stays
An earlier draft of the proposal went back to "structured JSON → templates". The owner rejected that on 2026-10-11: **the aim is always to create `.html` files based on the rules set in the prompt.** Section 6 is written on that basis.

---

## 1. Decision log (newest first)

| Date | Decision | Notes |
|---|---|---|
| 2026-10-14 | **Admin console v2, Google sign-in, free-model retry flow, preview/mobile fixes, discoverable custom domains (all live; migrations now 0001-0020).** | (1) **Admin console v2** (docs/ADMIN.md): env-based admin identity, TOTP 2FA + recovery codes, 8 h session / 30 min idle, 5-minute step-up for destructive actions, audit log, last-admin protection, no impersonation. Owner still has to enrol 2FA at `/admin`. (2) **Google sign-in** works end to end (Google Cloud OAuth client + Supabase Google provider, set up by the owner through the desktop app; consent screen shows the Supabase address, a custom auth domain would be a paid add-on). `/login` shows a spinner instead of flashing the form while a session loads (`5891ecc`). Public `/privacy` page added for the consent screen (`6ceff79`). Forgot-password + `/reset-password` live; Supabase redirect URLs `.../reset-password` and `.../login` are configured. (3) **Free models busy is a retryable failure** (`free_models_busy`, no budget charged); jobs queue until tomorrow only when every provider's daily budget is truly spent; a queued job never blocks a new build or the Claude/ChatGPT connector (`superseded`). (4) **Preview** renders at real device widths (1280/820/390) and in-page links no longer load Shipfolio in the frame. (5) **Mobile-friendly rule** in the single guardrail prompt (works on phone, tablet and desktop, not mobile-first) plus an automatic no-sideways-scroll guard added by `finalizeHtml`. (6) **Custom domains were already built (Settings > Domains) but undiscoverable**; Publish dialog, Vercel bar and `/settings?tab=domains` now point to it (`a0cda7a`). Custom domain needs Pro and a published site; the real DNS step is still untested. **Lesson:** Chromium 136+ ignores `--remote-debugging-port` on the default profile, so Claude cannot attach to the owner's signed-in browser; owner-run desktop-app prompts are the route for console setup. **Pending:** owner enrols admin 2FA, rebuilds a portfolio and checks it on a phone, tries a real GitHub push; payments (Dodo hosting add-on, refunds, watermark/paywall check). |
| 2026-10-14 | **Admin console v2 built, reviewed, merged, migrations 0019/0020 applied, deployed (`1b68acb`).** Handoffs 08a (backend), 08c (sign-in), 08b (UI) via `docs/plans/2026-10-14-admin-console-plan.md`; full description in `docs/ADMIN.md`. Also on main (`5c0f98d`): Google sign-in button, forgot/reset password (`/reset-password`), wizard steps locked until a resume is uploaded, Claude/ChatGPT logos instead of emojis on the method cards. | Decisions: keep env-based admin identity (not Supabase users), add TOTP 2FA + recovery codes, 8 h / 30 min idle sessions, step-up for destructive actions, lockout, audit log, no impersonation, no IP allowlist. Review found and fixed: enrol-confirm worked as an unthrottled second login door once 2FA was on. Owner to-do: enrol 2FA at `/admin` and save recovery codes; in Supabase add redirect URLs `/reset-password` and `/login` and enable the Google provider (client ID/secret from Google Cloud). |
| 2026-10-14 | **Antigravity handoffs 07d (visual QA), 07e (account clean-up), 07f (docs refresh) reviewed, fixed where needed, merged and deployed (`8e49c18`).** | 07d fixed 10 UI problems (Publish dialog still showed the old subdomain address, unpublish popup had no Escape/focus handling, phone layouts, copy-button fallback, stale model names in the Connect panel). 07e: `removeSiteFiles()` (`src/server/sites-storage.ts`) now deletes a site's files on unpublish, takedown and account deletion (this closes the gap noted on 2026-10-13); reset answers with `notes`. Claude changed unpublish/takedown so a file clean-up failure is logged, not turned into an error (the status flips first, so nothing is served). 07f docs were spot-checked against the code (52/52 routes, 38/38 env names exist). **Open:** while testing, Antigravity created two QA accounts on production (`shipqa1791949801962@maxxspace.com` with 1 upload/portfolio/job, and an unconfirmed `qa-user-1791949729212@gmail.com`); deletion is awaiting the owner's approval. Rule added to `docs/handoffs/_rules.md`: no production accounts without approval. |
| 2026-10-14 | **Security review of the Claude/ChatGPT connector done; fixes shipped (`08a1677`), 32/32 live checks.** | Sound: PKCE S256 only, single-use codes, hashed tokens, rotating refresh tokens, exact redirect URIs, user-scoped queries, RLS. Fixed: (F1) apps could register a name like "Claude" and phish a consent, so names that imitate Claude/ChatGPT/Shipfolio are refused unless the redirect host is claude.ai/claude.com/chatgpt.com/openai.com, all other apps show an "Unverified app" warning with the signed-in email, invisible/bidi characters are stripped; (F3) registrations capped 300/h with unused ones swept; (F4) a refresh token reused within 10 s is refused without revoking (retry), later reuse revokes the chain; (F5) Content-Length check on /mcp. Not changed: (F6) scopes are advertised but not enforced (one resource only); per-user rate limit on failed saves (F5 rest). The reviewer's F2 (scripts on the app origin at /s/*) was already covered by the CSP sandbox, verified live. VERCEL_API_TOKEN added; custom-domain flow live-tested 11/11 except the real DNS proof (needs a domain the owner controls). GitHub App `shipfolio-ai-export` created; its connect protections verified, real push to a repo not yet tried by the owner. |
| 2026-10-13 | **Hosted portfolios live at `www.shipfolio.xyz/s/<name>` (supersedes the `<name>.shipfolio.xyz` wildcard plan).** | The owner can't change GoDaddy nameservers, so no wildcard DNS. `src/routes/s.$.ts` + `src/server/sites-serve.ts` serve published pages from the app, with the CSP `sandbox` (no `allow-same-origin`) on EVERY response so a page gets an opaque origin: verified live that its script runs but `document.cookie` for the app domain throws `SecurityError`. Image paths are rewritten to `/s/<slug>/images/...`. `SITES_BASE_URL=https://www.shipfolio.xyz/s` switches `siteUrl()`; unset it to go back to subdomains. Shared cache is 20 s (no stale reuse) so unpublish/takedown is near-immediate. `sites-app/` (project `shipfolio-sites`) stays for custom domains only. Live-tested 20/20. **Known gap (fixed 2026-10-14 in handoff 07e):** deleting an account used to leave its `sites/<slug>/` files in storage. |
| 2026-10-13 | **Everything except payments built and deployed for the 15th deadline (migrations 0013-0018 applied).** | Shipped: background generation jobs + free-model chain (`/api/generations`, daily budgets, cooldowns, queue + cron), MCP server + OAuth for Claude/ChatGPT (`/mcp`, `/authorize`, `/token`, `/register`; live-tested 26/27), GitHub App push (installation ownership verified via the user's own installation list), hosting on `slug.shipfolio.xyz` (`sites-app/`, separate Vercel project `shipfolio-sites`, sandboxed CSP on every response), custom domains with TXT ownership proof (pending claims never block or serve), settings UI, retention cron jobs, wizard/Studio UI (Antigravity 06a-06f, 07a, 07c; Claude reviewed each and fixed the issues). **Decisions:** (1) no second domain: user sites live on `*.shipfolio.xyz`, protected by the CSP `sandbox` directive (opaque origin, no cookie tossing) - needs the domain on Vercel nameservers for the wildcard certificate; (2) **only `:free` OpenRouter models**, enforced in code (`free-models.ts` drops any other); chain order (env `FREE_MODEL_OPENROUTER_A..D`): nemotron-3-super, laguna-s-2.1, north-mini-code, nemotron-3-ultra (slow, last); Groq/Cerebras not used; (3) `APP_EXTRA_ORIGINS` allows the branded domain in the Origin check while `APP_ORIGIN` stays the vercel.app address (OAuth redirects). **Known:** free models write plain but accurate pages (~5 KB); Gemma 4 is often rate-limited upstream; real `/api/generations` runs ~40-60 s. **Open for the owner:** GoDaddy nameservers to Vercel (then attach `*.shipfolio.xyz` to `shipfolio-sites`), GitHub App values, `VERCEL_API_TOKEN`, Supabase Auth redirect URL for www.shipfolio.xyz, payments + watermark check. |
| 2026-10-13 | **Handoff 04 + 04a + Antigravity's feat/05 shipped (`997a875`, migration 0012 applied, 10/10 live checks).** | Numeric fact check (numbers/%/money/years; employers and certification names deferred) with one repair round (`fact-check.ts`, `checked-generation.ts`); resume text saved once at upload in `resume_texts` (service-role only, cascades with the upload); generation shows the reasons in the wizard and Studio. Antigravity added zip/HTML export, version history + restore, and Studio shortcuts. Known v1 limits: values match across units ($6M passes if the resume says "team of 6"), numbers written as words aren't checked, a failed repair call loses that generation. Minor: Studio's ⌘+H shortcut clashes with the Mac "Hide" shortcut. **Next: handoff 05** (background generation jobs). |
| 2026-10-12 | **Handoff 03 shipped: `finalizeHtml()`, storage markers, `portfolio_versions` (migration 0011).** | Spec reviewed with ce-doc-review and amended before building; code reviewed with ce-code-review (6 reviewers + validator). Claude fixed the P1/P2s (`<noscript>` removed, clean-until-stable against nested-form mXSS, SVG `href` animations, version-save rollback/prune), Antigravity did the rest as handoff 03b; then a hardening pass (shared marker pattern, strict path characters, mailto cc/bcc stripped). 74 tests. Spec amendment B9 records the behaviour changes. Live-checked on production with a temporary user (deleted): version table refused to users, old photo links re-signed, preview shows photo. |
| 2026-10-12 | **Incident: production domain was stuck on a build older than handoff 01.** | Every push built as "Production" but the domain wasn't promoted, so migration 0010 broke Studio ("Could not load content") for logged-in users from 0010 until `vercel promote` on 2026-10-12. Promotion is automatic again (verified with `896df42`). **Rule:** after each push, probe a route only the new code has before applying a migration. Production has `PAYMENTS_ENABLED=false`, so nobody sees the watermark there. |
| 2026-10-12 | **Database privileges locked down (hotfix + migration 0010, applied and tested).** | Migration 0006's column REVOKE was a no-op, so any logged-in user could make themselves Pro or admin with one REST call. Fixed: `revoke insert, update on public.users from anon, authenticated; grant insert (id), update (id) on public.users to authenticated;` (applied first as a hotfix). Then `revoke all on public.portfolios from anon, authenticated;` after `/api/content`, `/api/generate`, `/api/publish` and `/api/reset` were switched to the service-role client scoped to `AuthedContext.user.id` (handoff 02, merged `8993143`, deployed before the migration). Tested with a temporary user: self-upgrade, direct read/edit/delete of `portfolios` all blocked; sign-in, studio load, watermark and reset still work. **Rule for new tables:** revoke table-level privileges and grant only what's needed; never rely on a column-level REVOKE alone. Undo for portfolios if ever needed: `grant all on public.portfolios to anon, authenticated;`. |
| 2026-10-12 | **Database changes are explained to the owner and approved before they run.** | Applies to migrations, SQL, data edits and test users, even when no permission prompt appears. Claude has an allow rule for `apply_migration`; read-only `execute_sql` and test scripts that write to the live database may still be blocked, in which case the owner runs them with `!`. |
| 2026-10-11 | **Simple build tasks go to another LLM through handoffs.** | Claude writes `docs/handoffs/NN-*.md` (+ a prompt) on a local branch; the other LLM builds on that branch and appends a "Handoff report"; Claude reviews line by line, fixes, merges, applies any migration (after explaining it) and tests. Security-critical work stays with Claude or gets a line-by-line review. Done: **01** save wizard inputs + server-side watermark (`649f556`, migration 0009); **02** lock down direct database access (`8993143`, migration 0010). **03** finalizeHtml + versions (migration 0011), **04** fact check + **04a** resume_texts (migration 0012), Antigravity's feat/05 (exports, version history). **Next: payments (Dodo add-on, refunds), then verify the paywall/watermark.** |
| 2026-10-11 | **First-version scope cuts** (from the plan review). | (1) Path B saves with one `save_portfolio_html` tool, not start/append/finish parts. (2) GitHub updates are a plain new commit, no edit detection or pull request. (3) Custom domains: DNS records + "Verify now" + daily cleanup only; no 5-minute poll, 7-day email or registrar guides. (4) No image fix for today's download in build step 1. All four are listed under "Add later if needed" in 6.12. |
| 2026-10-11 | **Pricing: $19 one-time + a yearly hosting add-on** (from the plan review). | The $19 lifetime Pro unlock covers generation limits, clean HTML, zip download, GitHub push and deploy to their own Vercel. **Hosting** on `name.<sites-domain>` and the custom domain is a separate **yearly Dodo add-on**, so the owner's hosting cost is always covered. Must be set up in Dodo before publishing (build step 4) ships. Rejected: $19 covering hosting forever (cost grows with every buyer and is hard to take back). |
| 2026-10-11 | **Refunds and chargebacks: back to free and unpublish.** | The Dodo webhook also handles refund and dispute events: `users.plan` goes back to `free`, the hosted site and custom domain are taken down. Files the user already downloaded or pushed stay theirs. |
| 2026-10-11 | **When the free models run out: queue and email.** | A free user's generation waits for the next day's free budget, their inputs stay saved, and they get an email when the preview is ready. The UI also offers B and D. Rejected: only suggesting B or D (most users have neither). |
| 2026-10-11 | **Path B (MCP): accept that the HTML is visible in the user's own chat (Option 2).** | No MCP rule can hide it: the user's model writes the HTML in their chat before the owner's server receives it, tool-call inputs can usually be expanded, and the user can simply ask their model to print it. Rejected Option 1 (user's model writes a content + design brief, owner's server turns it into HTML with the free-model chain): it would protect the file but weaken design quality for the users most likely to pay, and use free-model capacity. **Reasoning:** anyone with Claude/ChatGPT can already get a portfolio HTML for free without Shipfolio; what's sold is the guardrails + fact check, bundled images, one-click hosting, custom domain + HTTPS, updates, versions and GitHub push. **Light deterrents only:** tool descriptions tell the model not to show the HTML and to give the Studio link instead; watermark, hosting, bundling and updates stay paid. |
| 2026-10-11 | **Dodo Payments is the only payment provider, worldwide.** | No Stripe, PayPal, Razorpay or Lemon Squeezy, and no per-region providers. Every paid product (the Pro unlock and any future add-on such as a custom-domain add-on) goes through Dodo. Dodo acts as merchant of record and handles global tax. The existing dev-only dummy checkout (`PAYMENT_TEST_MODE=dummy`, blocked in production) is a test tool, not a provider, and stays. |
| 2026-10-11 | **The copy-paste prompt option (Path C) is removed entirely.** | Don't build `/api/generations/prompt` or `/api/generations/import`, the "Copy prompt" card, the paste box, or the fix-up prompt. The wizard shows **three** generation cards, not four. Users without a Gemini key or a Claude/ChatGPT plan use the free models (A). |
| 2026-10-11 | **Paid users get everything.** | Download HTML, zip export, push to GitHub, deploy to their own Vercel, hosting on the owner's subdomain, custom domain. The owner explicitly reversed the earlier "users can't download" idea: "If they are paying, they are free to do whatever." |
| 2026-10-11 | **Free users get only a watermarked preview in Studio.** | No publish, no download, no export. The watermark is added on the server, so no app endpoint hands free users the clean HTML. It is a deterrent, not a lock (see 6.6). |
| 2026-10-11 | **Host user sites on the owner's domain** (`name.<sites-domain>`), with an **optional custom domain** (`janedoe.com`) pointed at the owner's hosting. | A domain only provides the name; it still needs hosting. Default: the user's domain points to the owner's Vercel "sites" project. Pushing files to the user's own hosting = the export features (paid). |
| 2026-10-11 | **Use a separate domain and a separate Vercel project for user sites.** | For example the app at `yourbrand.com` and user sites at `*.yoursites.domain`. This keeps the app's Supabase login cookies away from user-hosted pages (the GitHub / `github.io` pattern). The owner plans to buy a domain anyway. |
| 2026-10-11 | **Output is always a complete `.html` file written by the model per user, following the guardrail prompt rules** (the resume is the only source of facts, plus the design and output rules). | Replaces a short-lived draft idea of "structured JSON + templates" (dropped, never built). Every path (A, B, D) produces HTML; a shared `finalizeHtml()` checks the rules, cleans unsafe tags and checks facts. Keeps the direction of `fe465ac`. |
| 2026-10-11 | **MCP = the user's chat app connects to the owner's MCP server.** | The owner's server can't use someone's Claude or ChatGPT subscription (no API access, and it breaks both providers' terms). The direction is: user's Claude.ai/ChatGPT → `https://<app-domain>/mcp` (OAuth). The user's model does the writing; the MCP tools supply inputs and save the result. MCP "sampling" isn't supported by Claude.ai or ChatGPT as far as known, so don't rely on it. |
| 2026-10-11 | Free-model harness = a fallback chain of free providers with a shared daily budget and per-user daily limits. | OpenRouter `:free` → Groq → Cerebras → the owner's own free Gemini key. |

**Earlier context that still holds:** Pro is a **one-time $19 lifetime unlock** through Dodo (`PRO_PRICE_USD = 19`). **Open question:** whether hosting sites indefinitely for a one-time fee is acceptable, or whether to add an optional yearly custom-domain add-on (it would also go through Dodo).

---

## 2. User preferences and working style

- The owner thinks in **user journeys**. Explain things as "what the user sees" + "what happens behind the scenes".
- The owner prefers **the least effort and the fewest tokens** when several options are equally good (for example GitHub instead of an artifact for the diagrams).
- The owner plans to **compact sessions** and resume from this file, so keep it updated whenever a decision changes.
- The owner hasn't asked for any implementation yet. **Confirm before starting to build.**
- Use they/them for anyone whose pronouns aren't known.
- Git: commit or push only when asked. Branch off `main` first (`main` is the default branch).

---

## 3. Files and artifacts created in this session

| Item | Where | State |
|---|---|---|
| `userflow.md` | Branch **`docs/userflow`**, pushed. https://github.com/Suryavamshi99/portfolio-builder-saas/blob/docs/userflow/userflow.md | Part 1 = current flow in detail, Part 2 = proposed flow, plus 10 Mermaid diagrams (all checked with Mermaid 11.4.1's parser). **Not merged into `main`.** ⚠️ **Out of date in two ways:** it still describes Path C (copy-paste) with a diagram, and its Part 2 is built on the dropped "structured JSON + templates" idea. Rewrite Part 2 from section 6 of this file if it's updated. |
| `version2memory.md` (this file) | Project root, committed on `main` | Replaces the earlier uncommitted `memory.md` (renamed). |
| `docs/handoffs/01-save-inputs-and-watermark.md`, `docs/handoffs/02-lock-down-db-privileges.md` | `main` | Handoff specs + the other LLM's reports. Both merged, migrations 0009 and 0010 applied. |
| `docs/handoffs/` (`_rules.md`, `01`-`07f`) | `main` | Every handoff spec with the other LLM's report (Antigravity). `_rules.md` holds the rules every handoff follows (own worktree, no migrations applied, no pushes, no production accounts). Reports can be wrong: verify against the code. |
| `docs/ARCHITECTURE.md`, `API.md`, `README.md`, `userflow.md` | `main` | Refreshed 2026-10-14 (handoff 07f) to match what shipped. Where they disagree with this file, this file's decision log wins. |
| Claude's private memory | `~/.claude/projects/-Users-suryavamshi-portfolio-builder-saas/memory/` (`project-state-2026-10-14.md`, `working-agreements.md`, others) + `MEMORY.md` index | Short summary of the strategy; points to this file. |

**Local git state when this was written:** branch `main` at `62e3c3f`. The working tree also has other uncommitted files that aren't part of this work. **Don't touch or commit them.**

**Tooling note:** there's no Chrome/Chromium on this Mac, so mermaid-cli and the Playwright MCP can't render. Check Mermaid by parsing in Node with jsdom + `mermaid@11.4.1` (a throwaway install in the scratchpad worked).

---

## 4. Tech stack (current code)

- **Framework:** TanStack Start (React 19, TanStack Router 1.170.x, Vite 8, Nitro), TypeScript, Tailwind v4, shadcn/Radix UI, `motion`.
- **Backend:** server routes in `src/routes/api/*` (TanStack Start `createFileRoute(...).server.handlers`).
- **Auth and database:** Supabase (`@supabase/ssr`): email + password auth, Postgres with row-level security, a Storage bucket `uploads`, `pg_cron` + `pg_net`, and an Edge Function `purge-storage-objects`.
- **AI:** Google Gemini `gemini-3.5-flash` through the user's own key. Anthropic (`claude-sonnet-5`) and OpenAI (`gpt-5.6-terra`) adapters exist but are switched off (`BYOK_ENABLED_PROVIDERS = ["google"]`).
- **Payments:** Dodo Payments (Checkout Sessions API + Standard Webhooks).
- **Hosting:** the app runs on Vercel. User portfolios are currently deployed to **the user's own Vercel account** through Vercel OAuth.
- **Libraries:** `pdf-parse`, `mammoth` (resume text), `file-type` (detects the real file type), `sharp` (removes image metadata), `zod`, `zod-to-json-schema`.
- **Dark mode only** (latest commit removed the light/dark toggle).

### Environment variables in use

| Variable | Purpose |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Supabase clients (server and browser) |
| `SUPABASE_SERVICE_ROLE_KEY` (admin client) | Webhook plan grants, the `/api/admin/*` panel |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET` | Hidden `/admin` panel login (separate from Supabase login) |
| `APP_ORIGIN` | Cross-site request (Origin) check, redirects |
| `ENCRYPTION_KEY` | AES-256-GCM key (base64, 32 bytes) for Gemini keys and Vercel tokens |
| `VITE_LAUNCH_MODE` | `waitlist`/`false`/`0`/`off`/`no` → waitlist; anything else → live. Fixed at build time. |
| `PAYMENTS_ENABLED` | `false` → everything free for everyone. Defaults to enforced when unset. Server-side only. |
| `PAYMENT_TEST_MODE=dummy` | Dev-only fake checkout, ignored when `NODE_ENV=production` |
| `DODO_ENVIRONMENT` (`test_mode`/`live_mode`), `DODO_PAYMENTS_API_KEY`, `DODO_PRODUCT_ID_PRO`, `DODO_WEBHOOK_SECRET` | Dodo |
| `OAUTH_VERCEL_CLIENT_ID`, `OAUTH_VERCEL_CLIENT_SECRET` (`src/config/vercel.ts`) | Deploy to the user's own Vercel (the `VERCEL_` prefix is reserved by Vercel) |
| `WAITLIST_WEBHOOK_URL`, `WAITLIST_WEBHOOK_SECRET` (`src/config/waitlist.ts`) | Google Apps Script → Google Sheet |
| `CRON_SECRET` (Supabase secret) + `app_config` rows `purge_edge_function_url`, `purge_cron_secret` | Storage purge Edge Function |
| `APP_EXTRA_ORIGINS` | Extra allowed origins for the Origin check (the branded domain `www.shipfolio.xyz`); `APP_ORIGIN` stays the vercel.app address used for OAuth redirects |
| `CRON_SECRET` (Vercel, different from the Supabase one above) | Bearer secret for the Vercel Cron routes `/api/cron/free-queue` and `/api/cron/domains` |
| `OPENROUTER_API_KEY`, `FREE_MODEL_OPENROUTER_A`..`D` (+ optional `FREE_IMAGES_*`, `FREE_BUDGET_*`, `FREE_MAX_OUTPUT_TOKENS`) | Free-model chain. **Only `:free` model ids are accepted** (enforced in `src/config/free-models.ts`). Order today: nemotron-3-super, laguna-s-2.1, north-mini-code, nemotron-3-ultra |
| `SITES_DOMAIN`, `SITES_BASE_URL` | Hosting: `SITES_BASE_URL=https://www.shipfolio.xyz/s` makes published addresses `/s/<name>`; unset it to use `<name>.<SITES_DOMAIN>` |
| `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET` | GitHub App `shipfolio-ai-export` (push to the user's own repo; the app needs "Request user authorization during installation" on) |
| `VERCEL_API_TOKEN`, `SITES_PROJECT_ID`, `VERCEL_TEAM_ID` | Custom domains: adding/removing domains on the `shipfolio-sites` project |

### Database tables today (migrations 0001–0020; 0019 `admin_audit_log`, 0020 `admin_security` + `admin_login_attempts`)

`users` (id, plan `free|pro`, is_admin, created_at; users can only write their row's `id`, so they **can't** set `plan` or `is_admin`, per migration 0010; 0006 was ineffective), `portfolios` (user_id primary key = **one portfolio per user**, `generated_html`, updated_at; **no direct access for users** since 0010, every read/write goes through server routes with the service-role client scoped to the session's user id), `uploads` (kind `resume|visual_reference|photo|project_image`, storage_path, filename, size_bytes, mime_type, published), `generations` (user_id, resume_upload_id, status `succeeded|failed`, created_at), `byok_keys` (user_id + provider, encrypted_key, nonce), `vercel_connections` (encrypted_access_token, nonce, vercel_username, team_id), `publications` (vercel_deployment_id, status, url, finished_at), `purchases` (dodo_payment_id unique, amount, currency), `upload_deletion_warnings`, `app_config`.

**Added since (2026-10-11 → 2026-10-14), all server-only (no access for `anon`/`authenticated`):** `portfolio_inputs` (0009), `portfolio_versions` (0011, newest 20 per user), `resume_texts` (0012, cascades with the resume upload), `generation_jobs` + `provider_budgets` + function `claim_provider_budget` (0013), `github_connections` + `exports` (0014), `sites` + private storage bucket `sites` (0015), `mcp_clients` + `mcp_tokens` (0016, hashes only), `custom_domains` (0017), and five clean-up cron jobs (0018).

### Plan limits (`src/config/plans.ts`)

| | Free | Pro |
|---|---|---|
| Storage | 50 MB | 250 MB |
| Generations per hour | 5 | 20 |
| Uploads per hour | 10 | 30 |
| Publish / Vercel connect / download | ❌ | ✅ |

Upload limits per kind: resume (single, PDF/DOCX, 5 MB), photo (single, PNG/JPEG/WEBP, 5 MB), visual_reference (max 3), project_image (max 10).

---

## 5. Current flow (as built): detailed

> **Note (2026-10-14):** this section describes the flow as it was on 2026-10-11, before handoffs 01-07. The current flow is in `userflow.md` Part 1 and `docs/ARCHITECTURE.md`.

### Stage 0: Landing `/`
- `getLaunchMode()`: in waitlist mode, calls to action become an email form → `POST /api/waitlist` (zod email check) → forwards with a shared secret to a Google Apps Script → Google Sheet. In live mode, calls to action → `/login?redirect=/onboarding`.

### Stage 1: Login `/login`
- Supabase `signUp` (a confirmation email arrives from `noreply@mail.app.supabase.io`, often in spam) / `signInWithPassword`.
- Destination: the explicit `redirect` if there is one, otherwise `GET /api/content` → `/studio` if a portfolio exists, else `/onboarding`.
- `AuthProvider` → `GET /api/me` → creates the `users` row if needed, returns plan, isAdmin, **hasPaidAccess** (computed on the server by `hasPaidAccess()` in `src/server/users.ts`), storage, Vercel connection status.
- Security: `authMiddleware` on every `/api/*` route (session from the cookie, checked on the server); a global Origin check rejects POST/PUT/DELETE from other origins (`src/start.ts`); webhooks are exempt and verify their own signatures.
- `canAccessStudio()` = admin OR a portfolio exists.

### Stage 2: Wizard `/onboarding` (6 steps)
On load it calls `GET /api/uploads?kind=resume` and `GET /api/byok-keys` so returning users skip ahead.
1. **Resume**: `POST /api/uploads`: size check → real file type check from the bytes → hourly upload limit → quota → store at `uploads/{userId}/{kind}/{uuid}-{name}` → insert the row (file removed if the insert fails) → single-slot replace → 1-hour signed URL.
2. **Visual style**: up to 3 screenshots (metadata removed with `sharp`) + **Minimal/Bold** toggle (browser memory only).
3. **Photo**: single slot, metadata removed.
4. **Links and specifics**: LinkedIn, GitHub, GitHub project links, other links, free text. ⚠️ **Never saved, browser memory only.**
5. **Gemini key**: `POST /api/byok-keys`: only `google` allowed; AES-256-GCM encrypted; stored as encrypted value + nonce; **not tested when saved**; GET never returns the key.
6. **Generate**: `POST /api/generate`:
   1. Check the input (provider = google, resumeUploadId required, design minimal/bold, links cleaned: 300 characters / 10 items max)
   2. Hourly generation limit (counts all `generations` rows, including failures)
   3. Load the encrypted key (missing → 401 `byok_key_missing`)
   4. Download the resume → extract text (`extractResumeText`)
   5. Photo → **7-day signed URL** put into the prompt; up to 3 reference images sent as base64
   6. Decrypt the key
   7. Prompt = `GUARDRAIL_SYSTEM_PROMPT` (resume is the only source of facts, self-check, output one self-contained HTML document) + user message (resume text, specifics, photo URL or "no photo", verified links, Minimal/Bold direction, copywriting rules)
   8. `callGoogle`: 401/403 → `byok_key_invalid`; 429 → `provider_rate_limited` with the retry time; other errors → 502; a failure records a `failed` row in `generations`
   9. Success → `succeeded` row in `generations` (**starts the 48 h resume deletion**)
   10. `extractHtmlDocument`: strip fences, cut `<!doctype`/`<html>`…`</html>`, reject under 200 characters (422). ⚠️ No sanitising.
   11. Upsert `portfolios.generated_html` (overwrites; one portfolio per user)
   12. The UI refreshes "portfolio ready" → hand-off screen → Studio
   - The UI progress messages are fake timers (1.5 s, 4.5 s, 12 s).

### Stage 3: Studio `/studio`
- Preview: `<iframe srcDoc sandbox="allow-same-origin">` in desktop, tablet and mobile sizes, so **scripts don't run** in the preview.
- **Regenerate** sends only `{provider: "google", resumeUploadId, otherSpecifics}`, so ⚠️ links are dropped, Bold resets to Minimal, and it fails after 48 h ("No resume on file").
- **Download** (`src/routes/-studio/Editor.tsx`): gated by `hasPaidAccess` from `useAuth()`; free users are sent to checkout. Builds `portfolio.html` in the browser. ⚠️ It contains the 7-day signed photo URL. ⚠️ The gate is UI-only, because `GET /api/content` returns the full HTML to anyone logged in. (`DOWNLOAD_FREE_FOR_NOW` from commit `00603e0` has since been removed; download is paid-only again.)

### Stage 4: Payment (Dodo)
- `POST /api/billing/checkout` → Dodo `POST {base}/checkouts` with `product_cart` (Pro product), customer email, `return_url` (`/settings|/studio?upgrade=pending`), `metadata.userId` → redirect to `checkout_url`. With the dev dummy mode → `/api/dev/payment-test`.
- `POST /api/webhooks/dodo`: Standard Webhooks HMAC check → only `payment.succeeded` → `grantProAccess`: insert into `purchases` (a duplicate `dodo_payment_id` → no-op) → `users.plan = 'pro'` using the admin client.
- Settings re-checks the plan, because the webhook can arrive after the redirect.
- `hasPaidAccess()` = `!paymentsEnabled()` OR is_admin OR plan = pro.

### Stage 5: Publish (user's own Vercel)
- Connect: `GET /api/vercel/oauth/start` (paid check, signed state tied to the user) → Vercel → `GET /api/vercel/oauth/callback` (check state, exchange code, look up username, encrypt and save token + team_id) → `/studio?vercel=connected`. `DELETE /api/vercel` disconnects.
- `POST /api/publish`: not connected → 409; not paid → **402** (the real server-side gate); load the HTML → `embedStorageImagesInHtml` (download each signed-URL image, replace it with `images/<file>`, so live sites don't depend on storage) → decrypt the token → project name from `<title>` → upload files by hash to `/v2/files` → `POST /v13/deployments` (production, no framework) → `publications` row `queued` → mark uploads `published = true` → 202.
- `GET /api/publish/status` polls Vercel and updates `publications` until the deployment is finished.

### Stage 6: Data retention
- Hourly: resume + screenshots deleted 48 h after a successful generation.
- Daily 03:00: photo and project images deleted when the portfolio hasn't changed for 30 days. Daily 04:00: warnings queued for days 27–28. Migration 0008 purges Storage files with no database row.
- The SQL jobs → `notify_storage_purge` → `pg_net` → Edge Function (bearer `CRON_SECRET`) → files deleted from Storage.
- `POST /api/reset`: deletes all uploads + clears the portfolio. Keeps Gemini keys, the Vercel connection, generations, publications and purchases.

### Known problems in the current code (all fixed as of 2026-10-14)

| # | Problem | Status |
|---|---|---|
| 1 | Links and specifics are never saved | Fixed: `portfolio_inputs` (handoff 01) |
| 2 | Studio regenerate doesn't send `designIntensity` | Fixed (handoff 01) |
| 3 | The resume is deleted 48 h after generation, so regenerate breaks | Mitigated: the text is saved in `resume_texts` (0012) and deleted with the resume; revise-from-HTML mode is not built |
| 4 | The downloaded HTML contains a 7-day signed photo URL | Fixed: pages store storage markers; exports bundle the images |
| 5 | The download paywall is UI-only | Fixed: server-side watermark and `hasPaidAccess()` on every export |
| 6 | The preview sandbox blocks scripts | Fixed: `sandbox="allow-scripts"` (no same-origin) |
| 7 | Generated HTML isn't sanitised | Fixed: `finalizeHtml()` + `sanitizeHtmlForServing()` + CSP |
| 8 | Progress messages are timers | Fixed: background jobs with real statuses |
| 9 | The 422 error text says "Schema Validation" | Fixed: shows the plain-language reasons |

---

## 6. Design record (agreed direction; built as of 2026-10-14 except payments)

> **Status and deviations:** the build follows this design with these differences. (a) Hosting serves `www.shipfolio.xyz/s/<name>` from the app (CSP `sandbox`, 20 s shared cache), not `<name>.<domain>`; `sites-app/` serves custom domains only. (b) GitHub push needs an existing repo the app is installed on (it cannot create repos); no Pages toggle, no pull requests. (c) The fact check covers numbers, percentages, money and dates only (employers/certifications deferred). (d) No email is sent for queued free jobs (no email provider chosen); a daily cron runs them. (e) The MCP save runs `finalizeHtml` + the numeric check but no repair round (the chat fixes what is listed). (f) Payments (6.7) are not built yet.

**Ground rule (owner decision, 2026-10-11): the output is always a complete `.html` file, written by the model for each user, following the rules in the guardrail prompt** (`src/server/llm/guardrail-prompt.ts`: the CORE RULE that the resume is the only source of facts, plus the DESIGN & OUTPUT RULES). There are no templates, no theme system and no JSON content step. Every generation path produces the same kind of HTML file that `/api/generate` produces today.

### 6.1 Core pipeline

```
Resume + inputs ─┬─ A. Free models (owner's server)
                 ├─ B. User's Claude / ChatGPT (MCP)   ──▶ complete HTML file ──▶ finalizeHtml()
                 └─ D. User's Gemini key (owner's server)                              │
                                                                                       ▼
                                       portfolio_versions + portfolios.generated_html → Studio → publish / export
```
(Path C, copy-paste, has been removed.)

**The same rules go to every path:** the system prompt `GUARDRAIL_SYSTEM_PROMPT` plus the user message from `buildPortfolioHtmlUserMessage()` (resume text, specifics, photo URL, verified links, the Minimal/Bold direction, the Resume.io copywriting rules, reference images). Paths A and D send it from the server. Path B gives it to the user's model through the MCP brief. Keep one source of these rules so the paths never drift apart.

**`finalizeHtml()`** (🆕, shared by every path; it replaces the ad-hoc steps at the end of today's `/api/generate`):
1. **Extract** the document (`extractHtmlDocument`, existing). If `</html>` is missing (output cut off) → treat as a failed attempt (Path A: try the next provider; Path B: tell the model to finish it).
2. **Check the output rules** taken from the guardrail prompt:
   - Complete `<!DOCTYPE html>`, `<head>` with an inline `<style>` block, `<body>`, a viewport meta tag (needed for the responsive rule).
   - No external CSS or JS files. The only external resources allowed are **Google Fonts**.
   - `<img src>` may only be the user's own photo or upload URLs (or inline data/SVG). No placeholder or stock image URLs.
   - Outgoing links may only be the **verified links** from `portfolio_inputs` (plus in-page `#anchors` and a `mailto:`/`tel:` that appears in the resume). Any other link gets its `href` removed, and the text stays.
   - Has in-page anchor navigation and semantic structure (`<nav>`, `<section>`, headings, `alt` text). If one is missing, record it as a warning, not a failure.
3. **Safety clean-up** before hosting it on the owner's domain: remove external `<script src>`, `<iframe>`, `<object>`/`<embed>`, `<base>`, `<meta http-equiv="refresh">`, and forms that submit to other sites. **Inline `<style>`, and inline `<script>` for small effects, are allowed** (the rules allow inline code). The separate sites domain keeps app cookies out of reach, and the Content-Security-Policy on every hosted page (6.8) stops inline scripts from loading outside code, sending data anywhere or posting forms. Tag stripping alone can't do that, because an inline script can build those things at run time.
4. **Fact check** (keeps the CORE RULE enforceable without asking the model again): pull the visible text out of the HTML and flag **numbers, percentages, dates, employers and certifications** that don't appear in `resume_texts` (or in the user's own specifics). Flagged items → Path A/D: one repair round on the same model with the list; Path B: returned to the model in the tool reply. Anything still unsupported after the repair → fail and show the list. **In revise mode** (resume already deleted, see 6.6) the reference text is the previous version's visible text instead of `resume_texts`.
5. **Normalise before saving:** rewrite any signed Storage URL (photo, project images) to a stable storage-path marker, so the saved HTML never holds an expiring link. Preview, publish and zip sign the path when they read it. Briefs and prompts use a short-lived (about 1 hour) signed URL. Also remove any element carrying the watermark marker `data-shipfolio-watermark` (see 6.6), so a watermarked copy can never be saved as a version.
6. **Save** a new row in 🆕 `portfolio_versions` (`html`, `source` A/B/D, `model`, `warnings`) and set `portfolios.generated_html` to the latest version.
7. Insert a `generations` row (keeps the 48 h resume retention).

**Generation runs as background jobs** (🆕): `POST /api/generations {source}` → `generation_jobs` row → returns `jobId`; the UI polls `GET /api/generations/:id`; real statuses `reading → writing → checking → saving → done|failed` (replaces the timer messages, fixing #8). This is needed because a full HTML page from a free model can take 1–2 minutes, and Vercel functions have time limits.
- **What runs the job:** the same function invocation continues after the response through `waitUntil` (Vercel Fluid compute), with an explicit `maxDuration` set on that route. Each job has a total time budget a little under that limit: Path A stops trying further providers when the budget is used and fails with `free_capacity_exhausted`. `GET /api/generations/:id` marks any job still not finished after the budget as `failed`, so the UI never polls forever. If real runs don't fit in one invocation, move to a durable queue that runs one provider attempt per step (Vercel Queues, or a pg_cron/Edge Function worker resuming from `generation_jobs`).

### 6.2 Wizard (proposed)
1–3. Resume, visual style (reference screenshots + Minimal/Bold), photo: same uploads as today. 🆕 The extracted resume text is saved in `resume_texts` when uploaded (same 48 h deletion), so every path and the fact check can use it.
4. Links and specifics → 🆕 saved through `PUT /api/portfolio/inputs` (debounced) into `portfolio_inputs` (`links`, `specifics`, `design_intensity`, `preferred_source`). Fixes #1, and #2 because regeneration reads Minimal/Bold from here.
5. **Choose how to generate: THREE cards**:
   - ⚡ **A. Free**, no setup ("2 of 3 free generations left today")
   - 🤖 **B. Use my Claude or ChatGPT** ("Best quality, uses your plan")
   - 🔑 **D. My Gemini key** ("Free key from Google, 2 minutes")
6. **Generate**, with real progress, then the hand-off screen → Studio (same as today).
   - **If B is chosen, the wizard shows a waiting panel** instead of a progress bar: (a) not connected → "Connect Claude or ChatGPT" button to `/connect`; (b) connected → "Now say this in your chat: *Build my Shipfolio portfolio*" with a copy button; (c) live status read by polling the latest `generation_jobs`/version row every few seconds: *waiting for your chat* → *received, checking* → *ready* ("Open in Studio") or *needs fixes* (the plain-language list from `finalizeHtml()`, and a note that the chat has already been told what to fix). The user can leave; Studio shows the same status card.
   - **Generation failure screen (all paths):** the flagged items in plain language ("'Led a team of 12': 12 isn't in your resume"), with **Try again**, **Edit my details** (back to step 4, inputs kept) and **Use another method** (the other cards). Queued free jobs show "Queued, we'll email you when it's ready (free capacity resets at HH:MM)".

There is no theme picker. Design comes from the model, guided by Minimal/Bold, the reference screenshots and the design rules in the prompt, exactly as today.

### 6.3 Path A: Free-model harness
- Per-user daily limit (for example Free 3/day, Pro 10/day) through a new `checkDailyRateLimit`, **on Path A only** (it spends the owner's shared free budget). The existing hourly generation limit (Free 5/h, Pro 20/h) applies to **every** path.
- Shared daily budget per provider in `provider_budgets`. When every provider is used up → `free_capacity_exhausted`: **the job is queued** for the next day's budget, the user's inputs stay saved, and they get an **email when the preview is ready** (decided 2026-10-11). The UI also offers B and D.
- `FREE_PROVIDER_CHAIN` in `src/config/llm.ts`: OpenRouter `:free` model #1 → OpenRouter `:free` #2 → Groq → Cerebras → the owner's free Gemini key.
- One `callOpenAICompatible()` adapter for OpenRouter, Groq and Cerebras; keys in environment variables.
- **Only use models that can output a full HTML page.** A portfolio page is roughly 20–40 KB (about 6–12k output tokens). Pick free models with large enough output limits and good HTML/CSS quality; try each candidate against the guardrail prompt before adding it to the chain.
- 429/5xx or a cut-off page → mark the provider as cooling down → next provider; never retry in a loop. Rule or fact failures → one repair round on the same provider → next provider.
- Reference images only go to models that accept images; otherwise they're skipped.
- **Privacy:** check each candidate provider's data-use terms and put providers that don't train on prompts first in the chain. The ⚡ Free card shows a one-line consent before generating ("Free models may keep your resume text to improve their AI. Use your own Gemini key or Claude/ChatGPT to avoid this."), not just a passing note.
- **Can it write a whole page?** Before adding a provider, confirm its free tier allows a 6–12k-token reply in one call (per-minute token caps on Groq/Cerebras free tiers can block this) and that the result passes `finalizeHtml()` with acceptable design quality. A provider that can't is left out, so the chain's real capacity is known.
- Cost to the owner: $0 (optionally a small one-time OpenRouter credit raises its free daily limit).

### 6.4 Path B: MCP server (user's Claude or ChatGPT)
- Hosted in the app itself: `https://<app-domain>/mcp`, official MCP TypeScript SDK, Streamable HTTP.
- **Auth:** the app acts as an OAuth 2.1 sign-in server for MCP (dynamic client registration + PKCE), built on the existing Supabase login. Either Supabase Auth's OAuth server feature (check it fits) or a small sign-in server inside the app. Scopes `portfolio:read portfolio:write`; short-lived, refreshable tokens in `mcp_tokens`; revocable in Settings → "Connected apps". `mcp_tokens` stores only SHA-256 hashes of tokens; refresh tokens rotate on each use; redirect URIs must exactly match the ones registered; the consent screen shows the app's name, its redirect host and the requested access. New routes: `/authorize`, `/token`, `/register`, plus discovery metadata at `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server`. An unauthenticated `/mcp` request returns 401 with a `WWW-Authenticate` header pointing at the resource metadata (this is what makes Claude.ai/ChatGPT open the login popup).
- **Origin check exemption** (`src/start.ts` today blocks every non-GET request whose Origin isn't the app, except `/api/webhooks/*`): exempt `/mcp`, `/token`, `/register` and the `.well-known` paths, because Claude.ai and ChatGPT call them from their own servers. Those paths accept **only** bearer tokens / PKCE, never the Supabase session cookie, so the exemption opens no CSRF hole. The `/authorize` consent POST is cookie-based and **stays** under the Origin check.
- **One-time connection:** the user opens `/connect` (connector URL with copy button, tabs for Claude.ai and ChatGPT) → adds the custom connector → login popup on the owner's site → consent screen → connected.
- **Tools:**
  - `get_portfolio_brief()`: returns **the guardrail rules (the same system prompt text)**, resume text, verified links, specifics, Minimal/Bold, the photo URL, and reference images as image content. If the resume has already been deleted → "upload your resume at <app>/onboarding first".
  - `save_portfolio_html(html)` → rate limit → `finalizeHtml()`. If the HTML arrives cut off (no `</html>`), the reply tells the model to send the full page again. If rule or fact checks fail, the reply lists exactly what to fix, and the model fixes it and saves again. Success → `{ previewUrl }`.
  - `get_portfolio_html()`: the current version, so the model can revise it ("make the hero bolder", "shorten the summary") and save a new version with `save_portfolio_html`. Applies the same `hasPaidAccess()` rule as `GET /api/content`: free users get the watermarked HTML (the marker is stripped again by `finalizeHtml()` when the revision is saved), paid users get the clean HTML. The accepted exception above covers only HTML the user's own model writes in their chat, not stored HTML the server generated with Path A or D.
- **Enforcement:** the guardrail rules in the brief and tool descriptions (guidance) → `finalizeHtml()` checks (**the real guarantee**).
- The user's subscription pays for the tokens; the owner pays $0.
- **Decided trade-off (Option 2, 2026-10-11):** the HTML is written inside the user's own chat, so a free user could copy it from there without paying. **Accepted on purpose; don't try to block it.** No MCP rule can: the HTML exists in their chat before the server sees it, and the user controls their own model.
  - **Light deterrents:** server instructions and tool descriptions tell the model not to paste the HTML into the chat, and to reply with the Studio link instead ("✅ Your portfolio is ready → Open in Studio").
  - **What stays paid:** clean (unwatermarked) HTML from the owner's server, the zip with bundled images, publishing and hosting, custom domain + HTTPS, updates, version history, GitHub push.
  - **Rejected alternative (Option 1):** the user's model sends only a content + design brief and the owner's server writes the HTML with the free-model chain. It protects the file, but gives weaker design to the users most likely to pay and uses free-model capacity.

### 6.5 Path D: Gemini key (kept)
- Same encrypted key storage, prompt and error handling as today, now running as a background job and passing through `finalizeHtml()`. 🆕 The key is tested when saved (one tiny request).

### 6.6 Studio (proposed)
- **Preview:** the generated HTML in an iframe with `sandbox="allow-scripts"` (**without** `allow-same-origin`), so inline effects run exactly as on the live site while the page stays isolated from the app (fixes #6). Free users get a "Preview, not published" banner **added on the server**, as an element carrying `data-shipfolio-watermark` so `finalizeHtml()` can always strip it.
- 🔁 **Improve with AI:** "make it bolder", "focus on leadership". It runs through the chosen path (A, D, or "do this in Claude/ChatGPT" for B), using the **saved inputs + the current HTML**, so links and Minimal/Bold are kept (fixes #1 and #2).
- **After the resume is deleted (48 h)** (fixes #3): "Improve with AI" still works in **revise mode**. The current HTML is the starting point, and its facts were already checked when it was first generated. The fact check compares against the previous version's text instead of the resume, so no new facts can be added. Only a **full regenerate from scratch** needs the resume uploaded again, and the UI says so.
- 🆕 **Version history:** "Restore version 3" (from `portfolio_versions`).
- **Toolbar layout (one primary action, like today):** the primary button is **Publish** (first time) or **Update site** (after), and it reads **Upgrade** for users without the needed entitlement. A status line beside it shows the live URL, which version is live, and "Unpublished changes" when the draft is newer. Download zip, Push to GitHub and Deploy to my own Vercel sit together under one **Export** menu. Improve with AI and Versions are secondary buttons. **Restoring a version only changes the draft**; the live site changes only on Update site. Free users clicking any paid action go to Upgrade (Dodo).
- `GET /api/content` → `{ html, version, updatedAt }`. **Free users receive the watermarked HTML; the clean HTML only goes to paid publish and export** (fixes #5; the Path B chat copy is an accepted exception, see 6.4). The watermark is a **deterrent, not a lock**: anyone can delete one banner element in their browser. As with Path B, the paid value is hosting, custom domain, bundled export, GitHub push and updates, not withholding the file. What the server *does* guarantee is that no endpoint or database read hands a free user the clean HTML (see the row-level security rule in 6.12).

### 6.7 Payment (Dodo only)
- **Dodo Payments is the only provider worldwide** for every paid product.
- Kept: the checkout session flow, Standard Webhooks check, duplicate-safe `purchases`, `users.plan = 'pro'`, `PAYMENTS_ENABLED` kill switch, admin exemption, dev-only dummy checkout.
- Pro = $19 one-time lifetime unlock (Dodo product `DODO_PRODUCT_ID_PRO`): generation limits, clean HTML, zip, GitHub push, deploy to own Vercel.
- 🆕 **Hosting = a yearly Dodo add-on** (new Dodo product): publishing to `name.<sites-domain>` and the custom domain. Needs its own entitlement with an expiry date, checked on the server alongside `hasPaidAccess()`. Must exist before build step 4.
- 🆕 **Refunds and chargebacks:** the webhook also handles Dodo's refund and dispute events → `users.plan = 'free'` (and the hosting entitlement ends) → the site is unpublished and the custom domain removed. Already-downloaded or pushed files stay with the user.
- Any future add-on (for example a yearly custom-domain add-on) = **a new Dodo product**, granted through the same webhook (extend `grantProAccess` / add an entitlement per product). No other provider.
- Every paid action is checked **on the server** through `hasPaidAccess()`.

### 6.8 Publish to the owner's domain (paid)
- **Subdomain choice:** `GET /api/sites/check?slug=` checks: `[a-z0-9-]`, 3–40 characters, not reserved (`www`, `api`, `admin`, `app`, `mail`…), unique, no offensive words. **First-publish dialog:** a name field pre-filled from the user's name, checked as they type (debounced ~400 ms) with inline states *checking / available / taken / reserved / not allowed*, plus a preview of the full address. The name is **fixed after first publish** for v1 (no renames, so links never break; a rename-with-redirect can come later). → saved in `sites` (`user_id`, unique `slug`, `status`, `published_version`).
- **`POST /api/publish` (changed):** paid check (402) → latest `portfolio_versions` HTML → `embedStorageImagesInHtml` (existing) copies the images into a public `sites/{slug}/images/…` storage area and rewrites the URLs to relative paths → write `sites/{slug}/index.html` → update `sites` → clear the cache for that hostname → return `{ url }`. Live in seconds; no build or polling needed (`publications` kept as history). Published files don't depend on uploads, so the 30-day upload clean-up can never break a live site.
- **Serving:** a separate Vercel project `sites` on a separate domain. Middleware reads the `Host` header → `slug.<sites-domain>` → `sites.slug`; a custom hostname → `custom_domains` → slug → serves `sites/{slug}/index.html` with edge caching. Unknown or unpublished → a friendly page. Every user page is served with `Content-Security-Policy: default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'none'; form-action 'none'; frame-src 'none'; base-uri 'none'`, so a page can't load outside scripts, phone home or collect form input (protects the shared sites domain from being blocklisted as phishing). **Takedown:** an admin "Unpublish site" action in `/admin` and an abuse contact address shown on the sites domain. Previews are `noindex`; published sites are indexable (add OpenGraph tags in the prompt rules or inject them at publish).
- **Updating:** "Update site" re-runs publish with the latest version.
- The existing "Deploy to my own Vercel" OAuth flow moves into **Export** (kept, unchanged; it already publishes generated HTML).

### 6.9 Custom domain (paid)
- Settings → enter `janedoe.com` → `POST /api/domains` (paid check, format check, refuse the owner's own domains, one per site) → Vercel Domains API adds the domain to the `sites` project → save records and verification details in `custom_domains` (`hostname`, `status`).
- The UI shows the DNS records with copy buttons (A `@` → Vercel IP; CNAME `www` → Vercel target; TXT `_vercel` only if Vercel asks), **read from the API response, never hard-coded**, 
- A "Verify now" button (`POST /api/domains/:id/verify`) moves the status `pending → verified → live`; Vercel issues HTTPS automatically. **Ownership proof is ours, not Vercel's:** the UI also shows a Shipfolio TXT record (`_shipfolio-verify.<hostname>` = a random token stored in `custom_domains`), and a domain only moves to `verified` and maps to the slug once that record is found, whatever Vercel reports. Vercel only checks for configuration conflicts, so without this, one user could claim another person's domain, or a domain whose DNS still points at Vercel.
- The user picks apex or `www` as the main address, and the other redirects to it. Once live, the subdomain redirects to the custom domain.
- A daily job removes domains still pending after 14 days. Removing it → delete from Vercel, and the subdomain becomes the main address again.
- **Check:** Vercel's limit on domains per project for the plan. At scale, the alternative is Cloudflare for SaaS (Custom Hostnames).

### 6.10 Export (paid)
- **Zip:** `GET /api/export/zip` (paid check on the server) → latest clean HTML + `images/` with relative paths (same bundling as publish) + `README.txt` → logged in `exports`. Fixes #4 (the photo never expires) and #5.
- **GitHub:** a GitHub App (access limited to repositories it creates or that the user chooses); installation ID in `github_connections`; short-lived tokens created when needed. First push: create the repository → one commit through the Git Data API (blobs → tree → commit → ref) → optionally turn on GitHub Pages through the API. Update: a new commit on `main` (git history keeps any earlier edits).
- **Deploy to own Vercel:** the existing OAuth and deploy flow.

### 6.11 Data retention (proposed)

| Data | Rule |
|---|---|
| Resume file + `resume_texts` | Deleted 48 h after a successful generation |
| Reference screenshots | 48 h after generation |
| Photo and project images (uploads) | 30 days without changes (published copies in `sites/` are **not** deleted) |
| `portfolio_versions` | Keep the last 20 |
| `sites/` files | Kept while published; deleted 30 days after unpublishing or account deletion |
| `mcp_tokens` | Expire; revocable |
| `generation_jobs` | Deleted after 30 days |

Reset also clears `portfolio_versions`, `portfolio_inputs` and `resume_texts`, and asks separately whether to unpublish the live site.

### 6.12 System changes

- **New tables:** `resume_texts`, `portfolio_inputs`, `portfolio_versions`, `generation_jobs`, `provider_budgets`, `sites`, `custom_domains`, `mcp_tokens`, `github_connections`, `exports`
- **Row-level security rule for the new data** (the `portfolios` part is **done** by migration 0010; new tables must follow the same pattern: revoke table-level privileges, don't rely on column-level REVOKE): users get **no direct insert, update or delete** on `portfolio_versions`, `sites`, `custom_domains`, `provider_budgets`, `generation_jobs`, `mcp_tokens` and `exports`. All writes go through server routes using the service-role client. A migration revokes `select` and `update` on `portfolios.generated_html` from `authenticated` (the same pattern 0006 used for `plan` and `is_admin`; today migration 0001 lets users read and update their own row directly, which would let a free user read the clean HTML or write unchecked HTML that publish then serves). Publish and export re-run the safety clean-up step of `finalizeHtml()` on what they serve.
- **Changed tables:** `portfolios` (`generated_html` stays as the latest version), `generations` (+ `source`, `model`)
- **New code:** `finalizeHtml()` (rule check + safety clean-up + fact check), `callOpenAICompatible()`, `FREE_PROVIDER_CHAIN`
- **New routes:** `/mcp`, `/connect`, OAuth `/authorize` `/token` `/register` + `/.well-known/oauth-*` metadata, `/api/generations` + `/api/generations/:id`, `/api/portfolio/inputs`, `/api/sites/*`, `/api/domains/*`, `/api/export/zip`, `/api/export/github`
- **Add later if needed** (cut from the first version, 2026-10-11): saving Path B HTML in parts (only if real cut-offs happen), GitHub pull-request updates, a 5-minute domain-check poll, the 7-day pending-domain email, registrar-specific DNS guides.
- **Not built (removed from the plan):** copy-paste routes (Path C); templates, themes and the structured-content JSON step
- **New infrastructure:** a second domain + Vercel project `sites`, a public `sites` storage area, a GitHub App, OpenRouter / Groq / Cerebras API keys, a daily domain clean-up job
- **Kept:** Supabase login, the upload pipeline, AES-GCM encryption, the guardrail prompt and user-message builder, `extractHtmlDocument`, `embedStorageImagesInHtml`, Dodo payments, `hasPaidAccess`, hourly rate limits, retention jobs, the global Origin check (with the MCP/OAuth exemptions in 6.4), Vercel OAuth (now an export option)

### 6.13 End-to-end journeys
- **Free user (A):** land → sign up → upload resume and photo → links → ⚡ Free → generate (~1–2 min, real progress) → watermarked Studio → "Improve with AI" → Publish → upgrade prompt (Dodo).
- **Claude or ChatGPT user (B):** sign up → upload resume and links → `/connect` → add the connector → "Build my portfolio" → the model reads the brief and rules, writes the HTML, saves it → "Open in Studio" → refine in chat or Studio → pay (Dodo) → publish.
- **Paid user:** pay $19 (Dodo) → publish `jane.<sites-domain>` → connect `janedoe.com` → download zip → push to GitHub (+ Pages) → keep improving → Update site / Push update.

### 6.14 Recommended build order
1. Quick fixes in the current code: save links, specifics and Minimal/Bold (#1, #2); watermark the HTML for free users on the server (#5). (#4, the expiring photo, is fixed by the zip export in step 5.)
2. `finalizeHtml()` + generation jobs + `portfolio_versions` + `resume_texts` (shared pipeline)
3. Free-model chain (Path A)
4. Publish to subdomain (`sites` project + separate domain). **Before this ships:** create the yearly hosting add-on in Dodo and the refund/dispute webhook handling.
5. Zip export (paid, checked on the server)
6. Custom domains
7. MCP server + OAuth (Path B)
8. GitHub push

---

## 7. Open questions and things to check before building

**Answered by the build (2026-10-14):** the sites domain (reuse `shipfolio.xyz`, path hosting `/s/<name>`; the CSP `sandbox` replaces the separate-domain isolation); which free models work (OpenRouter `:free` models; Gemma 4 is often rate-limited upstream, Nemotron Super/Laguna/North Mini Code/Nemotron Ultra answered; Groq and Cerebras were not needed); how strict the fact check is (numbers only for v1); whether Supabase Auth's OAuth server fits MCP (no: a small sign-in server inside the app, `src/server/mcp/`); Vercel's domain limits and a wildcard (not needed). **Still open:** Dodo product setup and the hosting add-on price/lapse behaviour; which email service (none yet); Claude.ai/ChatGPT connector plan rules (the real connector flow is untested by Claude: owner to try it).

- **Deferred live check (owner, 2026-10-12):** verify the free-plan watermark and paywall on production after the payment work (Dodo add-on + refund webhook) is built, then switch `PAYMENTS_ENABLED` on. Until then production runs with payments off and no watermark.

- Update the out-of-date docs (`README.md`, the `DESIGN.md` accent colour, `API.md` after `fe465ac`) whenever the next build starts.

- Price of the yearly hosting add-on, and what happens when it lapses (grace period, then the site shows a friendly "not published" page?).
- Which email service sends the "your preview is ready" email for queued free generations.
- The sites domain name (the owner will buy one). Possibly two domains: the brand domain for the app plus a cheap one for user sites.
- Current Claude.ai and ChatGPT plan rules for custom MCP connectors (which plans, how many connectors).
- Whether Supabase Auth's OAuth server feature fits the MCP sign-in flow.
- Current free-tier limits and terms for OpenRouter `:free`, Groq and Cerebras (and their data-use policies).
- Vercel's limit on domains per project for the plan; Cloudflare for SaaS as the fallback.
- Dodo: confirm it supports every country and currency the owner targets, and how add-on products and entitlements are set up.
- Which free models can reliably write a full portfolio page within their output limits (test against the guardrail prompt).
- How strict the fact check should be (which kinds of text count as claims), so it catches invented facts without rejecting good pages.
- Whether `userflow.md` should be updated (remove Path C, replace Part 2 with the HTML-based design, add Dodo-only) and merged into `main`.
