# Shipfolio — AI Developer Portfolio Builder SaaS

Turn a resume into a bespoke, model-written HTML portfolio website in minutes.
Free preview with watermarked studio inspection. One payment (**$9, or ₹499 in India**) unlocks Pro (clean HTML, zip export, GitHub push, Vercel deployment) and includes **1 year of hosting** with a custom domain; hosting then renews at **$7.99/year (₹449)**. See [Payments & Billing](#payments--billing).
No fixed templates or JSON steps — each portfolio is an individual, self-contained HTML/CSS document written by an LLM following strict guardrail rules and verified by automated fact checking.

---

## Quick Start (Run Locally)

### Prerequisites

- Node.js 20+ (Node 22 recommended)
- A Supabase project (Postgres, Auth, Storage)

### Installation & Development

1. **Clone the repository and install dependencies:**
   ```sh
   npm ci
   ```

2. **Configure environment variables:**
   ```sh
   cp .env.example .env
   ```
   Fill in your Supabase credentials (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), a 32-byte base64 `ENCRYPTION_KEY`, and `APP_ORIGIN` (e.g. `http://localhost:3000`).

3. **Database migrations:**
   Migrations live in `supabase/migrations/` (0001 through 0021). In local development, apply them via the Supabase CLI (`supabase db push`) or SQL editor. See [Deploying](#deploying) for strict production migration rules.

4. **Start the local development server:**
   ```sh
   npm run dev
   ```

---

## Available Scripts

| Script | Command | Purpose |
|---|---|---|
| `npm run dev` | `vite dev` | Start local Vite development server |
| `npm run build` | `vite build` | Create production client and SSR build |
| `npm run preview` | `vite preview` | Preview production build locally |
| `npm test` | `vitest run` | Run unit and integration tests |
| `npm run lint` | `eslint .` | Run ESLint across codebase |
| `npm run format` | `prettier --write .` | Format all source files with Prettier |
| `npm run setup:retention` | `node scripts/setup-retention-cron.mjs` | Configure Supabase storage purge cron & Edge Function |

---

## Quality Verification Commands

Before committing or opening a PR, ensure all quality gates pass:

```sh
# Typecheck
npx tsc --noEmit -p .

# Linting (must have 0 errors)
npm run lint

# Test suite
npx vitest run

# Production build
npm run build
```

---

## Environment Variables

All variables are read inside handlers/functions at runtime, never at module scope.

| Variable | Required | Purpose & Rules |
|---|---|---|
| `SUPABASE_URL` | Yes | Supabase project URL (server-side) |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous API key (server-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service-role admin key (privileged server-side operations) |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL exposed to the browser for Auth SDK |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anonymous API key exposed to the browser for Auth SDK |
| `ENCRYPTION_KEY` | Yes | 32 random bytes, base64-encoded. Used for envelope encryption (AES-256-GCM) of BYOK Gemini keys and Vercel OAuth access tokens |
| `APP_ORIGIN` | Yes | Primary public URL of the application (e.g. `https://your-app.vercel.app` or `https://www.shipfolio.xyz`). Used for CSRF Origin checks and OAuth callback URLs |
| `APP_EXTRA_ORIGINS` | No | Comma-separated list of additional permitted request origins (e.g. `https://www.shipfolio.xyz`) when `APP_ORIGIN` holds the Vercel app domain |
| `SITES_DOMAIN` | No | Shared base domain for user-hosted portfolio sites (e.g. `shipfolio.xyz`). Subdomain sites resolve at `https://{slug}.${SITES_DOMAIN}` |
| `SITES_BASE_URL` | No | Path-based hosting base URL (e.g. `https://www.shipfolio.xyz/s`). When set, `siteUrl()` builds `<base>/<slug>` instead of `<slug>.<SITES_DOMAIN>`, serving portfolios from `/s/<slug>` on the main domain when wildcard DNS is unavailable |
| `CRON_SECRET` | Yes | Bearer token secret expected in the `Authorization: Bearer <CRON_SECRET>` header for Vercel Cron routes (`/api/cron/free-queue`, `/api/cron/domains`, `/api/cron/hosting`) |
| `OPENROUTER_API_KEY` | No (fallback) | API key for OpenRouter `:free` models, used after Groq. OpenRouter's free models share one account-wide cap (50 requests a day unless the account has ever bought $10 of credit), so the four slots default to 12 calls each (`FREE_BUDGET_OPENROUTER_A..D`) |
| `FREE_MODEL_OPENROUTER_A..D` | For Free tier | OpenRouter model IDs for fallback slots A through D. **Strict Rule:** Every OpenRouter model ID **MUST end with `:free`** (e.g. `nvidia/nemotron-3-super:free`). Enforced in code (`src/config/free-models.ts`): any model without the `:free` suffix is automatically skipped so it can never bill the OpenRouter account |
| `GROQ_API_KEY` | For fast free builds | Groq key (free, no card). When set, Groq's models are used first. Models come from `FREE_MODELS_GROQ` (comma separated; default `openai/gpt-oss-120b,openai/gpt-oss-20b,qwen/qwen3.8-27b`). Budgets per model: `FREE_BUDGET_GROQ` (default 55 calls a day, about 200K tokens) |
| `CEREBRAS_API_KEY`, `FREE_MODEL_CEREBRAS` | No | Optional tertiary free provider key and model ID |
| `GITHUB_APP_ID` | For GitHub export | GitHub App numeric ID |
| `GITHUB_APP_SLUG` | For GitHub export | GitHub App slug name (e.g. `shipfolio-ai-export`) |
| `GITHUB_APP_PRIVATE_KEY` | For GitHub export | GitHub App private key PEM with newlines escaped as `\n` in a single line |
| `GITHUB_APP_CLIENT_ID` | For GitHub export | GitHub App OAuth client ID (required to verify user installation ownership) |
| `GITHUB_APP_CLIENT_SECRET` | For GitHub export | GitHub App OAuth client secret |
| `VERCEL_API_TOKEN` | For Custom domains | Vercel REST API token with domain management permissions |
| `SITES_PROJECT_ID` | For Custom domains | Vercel Project ID of the `shipfolio-sites` deployment |
| `VERCEL_TEAM_ID` | No | Vercel Team ID if the `shipfolio-sites` project belongs to a team |
| `OAUTH_VERCEL_CLIENT_ID` | For Vercel deploy | Vercel OAuth app client ID (for deploying to user's personal Vercel account) |
| `OAUTH_VERCEL_CLIENT_SECRET` | For Vercel deploy | Vercel OAuth app client secret |
| `PAYMENTS_ENABLED` | No | Gate for paid features (`true` by default). Set to `false` to make all features free for testing or launch promotions |
| `DODO_ENVIRONMENT` | Yes | Dodo Payments environment (`test_mode` or `live_mode`) |
| `DODO_PAYMENTS_API_KEY` | Yes | Dodo Payments secret API key |
| `DODO_PRODUCT_ID_PRO` | Yes | Dodo product ID of the USD "Pro + 1 year hosting" product ($9 paid 365-day trial, then $7.99/yr, tax-inclusive) |
| `DODO_PRODUCT_ID_PRO_IN` | Yes | Same offer as an INR product (₹499, then ₹449/yr) used for buyers in India |
| `DODO_PRODUCT_ID_HOSTING` | Yes | Renewal-only yearly hosting product in USD ($7.99/yr, no trial), sold to Pro users whose hosting lapsed |
| `DODO_PRODUCT_ID_HOSTING_IN` | Yes | Same in INR (₹449/yr) for buyers in India |
| `DODO_WEBHOOK_SECRET` | Yes | Dodo webhook signing secret (`whsec_...`) |
| `PAYMENT_TEST_MODE` | No | Dev-only dummy checkout bypass (`PAYMENT_TEST_MODE=dummy`). Automatically disabled in production |
| `ADMIN_USERNAME` | Yes | Superuser username for the standalone `/admin` dashboard |
| `ADMIN_PASSWORD_HASH` | Yes | Scrypt hash of admin password generated via `node scripts/hash-admin-password.mjs` |
| `ADMIN_SESSION_SECRET` | Yes | 32-byte base64 random secret for signing admin session cookies |
| `VITE_LAUNCH_MODE` | No | `live` (default) or `waitlist` (swaps CTAs for pre-launch email capture form) |
| `WAITLIST_WEBHOOK_URL` | If waitlist mode | Google Apps Script Web App URL to receive waitlist email rows |
| `WAITLIST_WEBHOOK_SECRET` | If waitlist mode | Secret shared with Google Apps Script to verify inbound requests |

---

## Free generation (step by step)

A free model cannot write a whole page in one call (a few tokens a second, small per-minute limits, our own call limits). So the free source builds the page in small saved steps (`src/server/generation/pipeline/`):

1. **Plan** (one call): the model returns the person's name, a palette, fonts, a few design choices and the sections, as **line ranges of the resume**. Our code slices the text itself, so the model never copies it. If the plan is unusable, or covers under 60% of the resume, sections found from the resume's own headings are used.
2. **Design** (code only): the palette and the design choices (hero, headings, cards, corners, motion) select vetted CSS in `default-design.ts`, so text is always readable and the page always responsive. The model chooses; it never writes colour rules.
3. **Hero, then one call per section**, each seeing only its slice of the resume and a fixed class vocabulary.
4. **Assemble in code**, run the sanitiser and the numeric fact check, redo only a section that contains an unsupported number, and fall back to a section rendered from the resume text if that still fails.

Every step has a fallback made in code, so a build always finishes. State is saved after each step in `generation_jobs.params.pipeline` (with a log of which model did what). A run lasts about 170 seconds, then hands over to a fresh invocation (`/api/cron/generation-advance`); the status poll restarts a build that stalled. The Gemini-key source is unchanged (one call). The user's profile photo is always put in the hero by code if the model leaves it out; reference screenshots are not used (free models cannot see images), and the free-option screen says so. The user's regenerate notes reach the hero and every section, and their typed "specifics" reach the hero and About.

**Studio regenerate** follows the method that built the page (`src/lib/regen-method.ts`: the user's choice in this browser session, else the source of the latest generation job, else free). The panel offers Free models / My Gemini key / Claude or ChatGPT. Claude and ChatGPT run in the user's own chat, so that choice shows a handoff (`McpHandoff`): a ready-made prompt (they call `get_portfolio_html`, then `save_portfolio_html`) with Copy, "Open Claude" and "Open ChatGPT" links that pre-fill it, and the Studio polls `/api/content` and refreshes (with the popup and chime) when the chat saves a new version.

Providers are tried best first: Groq's models, then OpenRouter's `:free` models. Typical build on Groq: about 20-30 seconds. The progress screen shows "Step N of M"; the user can close the page. When a build finishes (free, Claude/ChatGPT, or a Studio regeneration) `src/lib/build-notify.ts` shows a popup (`BuildReadyPopup`, mounted at the root), plays a two-note chime made with the Web Audio API, and, while the tab is in the background, blinks the tab title, puts a green dot on the tab icon and sends a desktop notification if the user allowed it. It fires once per build, and the progress screen has an on/off control (remembered in `localStorage`).

---

## Payments & Billing

Payments run on **Dodo Payments** (Merchant of Record), in test mode until live-mode approval. One checkout buys everything.

**The offer**

| | Outside India | India |
|---|---|---|
| Pay today (Pro + 1 year of hosting) | $9 | ₹499 (UPI and cards) |
| Hosting renewal from year 2 | $7.99 / year | ₹449 / year |
| Tax | included in the price | included (GST) |
| Refunds | full refund within 14 days of any payment (policy, issued manually in the Dodo dashboard) | same |

**How it is built**
- **Geo pricing:** the visitor's country comes from Vercel's `x-vercel-ip-country` header (`src/server/geo.ts`). India gets the INR product (UPI only works in INR), everyone else the USD product. Display prices live in `src/config/pricing.ts`; `GET /api/billing/pricing` serves them to the UI.
- **Products (Dodo):** the buy offer is a *subscription with a 365-day paid trial* (trial amount = today's price, then the yearly hosting price). Two such products (USD, INR; `DODO_PRODUCT_ID_PRO`, `_IN`). A Pro user whose hosting lapsed renews through two renewal-only products with no trial (`DODO_PRODUCT_ID_HOSTING`, `_IN`). `POST /api/billing/checkout` picks the right product on the server.
- **State:** `users.plan` (`free` / `pro`, set by the first payment and kept for good), `purchases` (audit log; `kind` = `pro` or `hosting_renewal`; `refunded_at`), `hosting_subscriptions` (one row per user; hosting is active while `now() < grace_until`), `webhook_events` (Standard Webhooks ids, so a redelivery is a no-op).
- **Gating:** `hasPaidAccess` (Pro: downloads, exports) and `hasHostingAccess` (publishing and custom domains, `src/server/billing.ts`). Both pass when `PAYMENTS_ENABLED=false` and for admins.
- **Webhook** (`POST /api/webhooks/dodo`): verifies the signature, then handles `payment.succeeded` (first payment unlocks Pro, later ones are recorded as renewals), `subscription.active|renewed|on_hold|cancelled|expired|failed` (keeps the hosting term), and `refund.succeeded` / `dispute.lost` / `dispute.accepted` (drops the user to free, ends hosting, cancels the Dodo subscription, unpublishes the site). Events for other products and partial refunds are ignored. A new subscription for a user cancels their older one, so a lapsed-then-renewed user is never charged twice.
- **Hosting lifecycle:** active until the paid-through date plus a 14-day cushion (Indian renewals settle about 48 hours late). A failed renewal keeps the grace period but does not extend it. A user who cancels keeps hosting to the end of the paid year. `/api/cron/hosting` unpublishes lapsed sites daily.
- **Public pages:** `/terms`, `/refund`, `/privacy`, and the pricing block on the landing page (`src/components/billing/PricingSection.tsx`). The "Today / You get / Next year" box (`OfferSummary`) appears wherever someone is about to pay.

**Environment:** see the `DODO_*` and `PAYMENTS_ENABLED` rows in [Environment Variables](#environment-variables). Vercel gotcha: the variables already exist, so use `vercel env update NAME production --scope <team> --yes`, not `add`.

**Going live (after Dodo approves the live account)**
1. In Dodo **Live Mode**, create an API key and the four products (Pro and renewal, USD and INR; same prices, tax-inclusive, same descriptions as test mode).
2. Add a live webhook endpoint (`https://<app>/api/webhooks/dodo`) with the events above and copy its signing secret.
3. Set `DODO_ENVIRONMENT=live_mode`, `DODO_PAYMENTS_API_KEY`, `DODO_WEBHOOK_SECRET` and the four product ids on Vercel, then redeploy.
4. Make one small real purchase and refund it, check the database (plan, `hosting_subscriptions`, `purchases`), and only then set `PAYMENTS_ENABLED=true`.

Test mode notes: India cards complete through a gateway simulator ("Simulate Success"); US cards use `4242 4242 4242 4242`. Dodo test refunds can fail with *Insufficient funds in wallet* until the test balance settles.

---

## Deploying

Shipfolio runs on Vercel with a paired Supabase backend. Production deployment spans two Vercel projects, scheduled cron triggers, and strict database migration rules.

### 1. Main App Project
- **Project Root:** Repository root (`.`).
- **Framework:** TanStack Start (SSR built with Vite and Nitro).
- **Domain:** Main app domain (e.g. `https://www.shipfolio.xyz` or `https://your-app.vercel.app`).
- **Functions:** Handles all application routes (`src/routes/**`), user authentication, Studio editing, background generation jobs, OAuth endpoints (`/authorize`, `/token`, `/register`), MCP Streamable HTTP (`/mcp`), and path-based portfolio serving at `/s/<slug>`.

### 2. The `shipfolio-sites` Project
- **Project Root:** `sites-app/`.
- **Framework Preset:** Other / Serverless Function.
- **Rewrites:** Configured in `sites-app/vercel.json` to route all incoming requests `/(.*)` to `/api/serve`.
- **Domain & Purpose:** Custom domains only (e.g. `janedoe.com`). When a user attaches their custom domain and passes DNS TXT verification, the domain is added to this Vercel project via the Vercel REST API (`addDomain`).
- **Serving Isolation:** Serves HTML and images directly from the Supabase `sites` storage bucket with an opaque-origin Content Security Policy (`sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox`), preventing user scripts from interacting with app credentials.

### 3. Cron Jobs
- **Vercel Cron (`vercel.json`):**
  - `/api/cron/free-queue` (scheduled at `10 0 * * *`): Processes queued free generations once daily provider budgets reset.
  - `/api/cron/domains` (scheduled at `20 0 * * *`): Cleans up unverified pending custom domain claims older than 14 days.
  - `/api/cron/hosting` (scheduled at `30 0 * * *`): Unpublishes sites and detaches custom domains for users whose hosting lapsed (past the 14-day grace), and prunes processed webhook ids older than 30 days.
  - All three routes verify the `Authorization: Bearer <CRON_SECRET>` header.
- **Supabase `pg_cron` & Edge Functions:**
  - `purge-post-generation-uploads` (hourly): Deletes raw resumes and visual references 48 hours after generation.
  - `purge-stale-draft-uploads` (daily at 03:00): Deletes photos and project images for drafts inactive after 30 days.
  - `queue-stale-draft-warnings` (daily at 04:00): Flags warning notifications at day 27–28.

### 4. Database Migrations & The Golden Deployment Rule

> [!CAUTION]
> **Database migrations are NEVER applied automatically by developers or CI pipelines.**

1. **Review First:** Every migration script in `supabase/migrations/` is reviewed line-by-line, explained, and approved before execution.
2. **The Golden Rule:**
   > **After every push, check production serves the new code before applying a migration.**
   - *Rationale:* A Vercel build marked "Production" may not immediately receive live traffic until domain promotion completes. On 2026-10-12, migration 0010 was applied while production was still serving older code, causing Studio ("Could not load content") failures for active users until promoted.
   - *Verification Step:* Before applying any migration, curl or probe an endpoint or behavior unique to the newly pushed code on the production domain to confirm the new code is actively serving traffic.

---

## Folder Map

```
portfolio-builder-saas/
├── docs/                     # Architecture, handoff specs, and rules
│   ├── ARCHITECTURE.md       # Pipeline architecture, security boundary & table rules
│   ├── handoffs/             # Sequential agent task specs and reports
│   └── userflow.md           # End-to-end current and target user journeys
├── scripts/                  # Operational utility scripts
│   ├── hash-admin-password.mjs   # Generate scrypt hash for ADMIN_PASSWORD_HASH
│   └── setup-retention-cron.mjs  # Provision storage purge Edge Function & secrets
├── sites-app/                # Standalone Vercel project for user custom domains
│   ├── api/serve.ts          # Edge server serving sandboxed custom domain portfolios
│   ├── lib/                  # Shared domain & CSP verification logic
│   └── vercel.json           # Rewrite rules for custom domain routing
├── src/
│   ├── components/           # UI components (shadcn/radix primitives, studio, wizard, layout)
│   │   ├── auth/             # Authentication guards and forms
│   │   ├── byok/             # BYOK key management components
│   │   ├── hero/             # Landing page hero, video, and visual showcase
│   │   ├── layout/           # Navbar, footer, logos, shell layouts
│   │   ├── preview/          # Sandboxed iframe portfolio preview
│   │   ├── publish/          # Publish toolbar, domain settings, and dialogs
│   │   ├── settings/         # Account, connector, and custom domain settings
│   │   ├── ui/               # Base design system primitives (button, dialog, card, badge)
│   │   ├── upload/           # Drag-and-drop file uploaders with progress
│   │   └── waitlist/         # Pre-launch email capture components
│   ├── config/               # Static configuration (plans, free-models, vercel, payment-test)
│   ├── lib/                  # Browser & client utilities (supabase client, crypto, origin)
│   ├── routes/               # TanStack Start file-based routing
│   │   ├── -studio/          # Studio workspace UI (Editor.tsx, preview, shortcuts)
│   │   ├── api/              # Server route endpoints (auth, uploads, generations, sites, domains, mcp, export)
│   │   ├── [.]well-known.*   # OAuth 2.1 authorization-server and protected-resource discovery
│   │   ├── admin.tsx         # Standalone admin dashboard
│   │   ├── authorize.ts      # OAuth 2.1 consent & authorization screen
│   │   ├── connect.tsx       # External chat app connector view
│   │   ├── index.tsx         # Marketing landing page
│   │   ├── login.tsx         # User authentication
│   │   ├── mcp.ts            # Streamable HTTP Model Context Protocol endpoint
│   │   ├── onboarding.tsx    # Multi-step portfolio creation wizard
│   │   ├── register.ts       # RFC 7591 dynamic client registration
│   │   ├── s.$.ts            # Public sandboxed portfolio serving (/s/<slug>)
│   │   ├── settings.tsx      # User settings, key management, connectors & danger zone
│   │   ├── studio.tsx        # Studio route shell
│   │   └── token.ts          # OAuth 2.1 token grant & refresh endpoint
│   ├── server/               # Backend business logic & security infrastructure
│   │   ├── dodo/             # Dodo Payments checkout & webhook processing
│   │   ├── generation/       # Background jobs, free provider harness, queue & runner
│   │   ├── github/           # GitHub App installation token & Git Data API commit push
│   │   ├── llm/              # LLM adapters (Google Gemini, OpenAI-compatible) & guardrail prompts
│   │   ├── mcp/              # MCP JSON-RPC protocol, tool registry, and OAuth token store
│   │   ├── template/         # HTML image embedding and string escape utilities
│   │   ├── vercel/           # Vercel REST API client for domain registration & status checks
│   │   ├── auth-middleware.ts      # Session validation & AuthedContext extraction
│   │   ├── checked-generation.ts   # Guardrail generation + numeric fact check pipeline
│   │   ├── domains.ts              # Domain validation, TXT verification formatting & tokens
│   │   ├── fact-check.ts           # Fact-checking numbers, %, currency, and years
│   │   ├── finalize-html.ts        # Output verification, link sanitization, mXSS defense
│   │   ├── portfolio-inputs.ts     # Wizard inputs persistence
│   │   ├── portfolio-versions.ts   # Portfolio version history management
│   │   ├── rate-limit.ts           # Rolling-hour rate limiting
│   │   ├── resume-texts.ts         # Extracted resume text storage (service-role only)
│   │   ├── sites-serve.ts          # Core logic for sandboxed /s/<slug> response rendering
│   │   ├── sites.ts                # Site slug validation, routing, and reservations
│   │   ├── storage-markers.ts      # URL marker translation for persistent HTML
│   │   ├── users.ts                # User entitlements & server-side hasPaidAccess()
│   │   └── watermark.ts            # Server-side watermark injection for free tier
│   ├── styles.css            # Tailwind v4 theme tokens: Graphite/Ink/Mist neutrals, Aurora accents (the logo palette)
│   ├── routeTree.gen.ts      # Auto-generated TanStack router tree
│   └── start.ts              # TanStack Start server entry point & CSRF origin check
├── supabase/
│   ├── functions/            # Supabase Edge Functions (purge-storage-objects)
│   └── migrations/           # Postgres migrations (0001 through 0021)
├── brand/logo/               # Logo kit (Leaf Launch, Aurora): SVG/PNG masters, web icons, guidelines, presentation
├── API.md                    # Canonical API contract for all endpoints
├── DESIGN.md                 # Design system tokens, color calibration & taste standards
└── version2memory.md         # Source of truth for product architecture & decision history
```

---

## Documentation Links

- **[API Contract (`API.md`)](./API.md)** — Exhaustive specification of every endpoint (method, path, authentication, payload, responses, and error codes).
- **[Design System (`DESIGN.md`)](./DESIGN.md)** — Visual design contract, typography hierarchy, Aurora palette (blue `#3457E8`, cyan, mint) and Graphite neutrals, and layout guidelines.
- **[Architecture Guide (`docs/ARCHITECTURE.md`)](./docs/ARCHITECTURE.md)** — Detailed pipeline flow, security boundaries, database isolation, and CSP policies.
- **[User Journeys (`userflow.md`)](./userflow.md)** — Step-by-step current and proposed product flows with Mermaid sequence diagrams.
- **[Project Memory & Decision Log (`version2memory.md`)](./version2memory.md)** — The primary source of truth recording all technical decisions, scope boundaries, and architectural choices.
