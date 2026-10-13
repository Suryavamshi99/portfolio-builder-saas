# Shipfolio — AI Developer Portfolio Builder SaaS

Turn a resume into a bespoke, model-written HTML portfolio website in minutes.
Free preview with watermarked studio inspection; paid unlocks everything: clean HTML, zip export, GitHub push, Vercel deployment, and subdomain hosting.
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

3. **Run database migrations:**
   Apply migrations in order from `supabase/migrations/` (0001 through 0012) using the Supabase CLI (`supabase db push`) or the Supabase SQL Editor.

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
├── src/
│   ├── components/           # UI components (shadcn/radix primitives, studio, wizard, layout)
│   │   ├── auth/             # Authentication guards and forms
│   │   ├── byok/             # BYOK key management components
│   │   ├── hero/             # Landing page hero, video, and visual showcase
│   │   ├── layout/           # Navbar, footer, logos, shell layouts
│   │   ├── preview/          # Sandboxed iframe portfolio preview
│   │   ├── publish/          # Publish toolbar and dialogs
│   │   ├── ui/               # Base design system primitives (button, dialog, card, badge)
│   │   ├── upload/           # Drag-and-drop file uploaders with progress
│   │   └── waitlist/         # Pre-launch email capture components
│   ├── config/               # Static configuration (plans, llm, vercel, payment-test)
│   ├── lib/                  # Browser & client utilities (supabase client, crypto, origin)
│   ├── routes/               # TanStack Start file-based routing
│   │   ├── -studio/          # Studio workspace UI (Editor.tsx, preview, shortcuts)
│   │   ├── api/              # Server route endpoints (auth, uploads, generate, publish, exports)
│   │   ├── admin.tsx         # Standalone admin dashboard
│   │   ├── index.tsx         # Marketing landing page
│   │   ├── login.tsx         # User authentication
│   │   ├── onboarding.tsx    # 6-step portfolio creation wizard
│   │   ├── settings.tsx      # User settings, key management, danger zone
│   │   └── studio.tsx        # Studio route shell
│   ├── server/               # Backend business logic & security infrastructure
│   │   ├── dodo/             # Dodo Payments checkout & webhook processing
│   │   ├── llm/              # LLM adapters (Google, Anthropic, OpenAI) & guardrail prompts
│   │   ├── template/         # HTML image embedding and string escape utilities
│   │   ├── vercel/           # Vercel OAuth client and deployment pipeline
│   │   ├── auth-middleware.ts      # Session validation & AuthedContext extraction
│   │   ├── checked-generation.ts   # Guardrail generation + numeric fact check pipeline
│   │   ├── fact-check.ts           # Fact-checking numbers, %, currency, and years
│   │   ├── finalize-html.ts        # Output verification, link sanitization, mXSS defense
│   │   ├── portfolio-inputs.ts     # Wizard inputs persistence
│   │   ├── portfolio-versions.ts   # Portfolio version history management
│   │   ├── rate-limit.ts           # Rolling-hour rate limiting
│   │   ├── resume-texts.ts         # Extracted resume text storage (service-role only)
│   │   ├── storage-markers.ts      # URL marker translation for persistent HTML
│   │   ├── users.ts                # User entitlements & server-side hasPaidAccess()
│   │   └── watermark.ts            # Server-side watermark injection for free tier
│   ├── styles.css            # Tailwind v4 theme tokens, obsidian dark neutrals & electric blue
│   ├── routeTree.gen.ts      # Auto-generated TanStack router tree
│   └── start.ts              # TanStack Start server entry point & CSRF origin check
├── supabase/
│   ├── functions/            # Supabase Edge Functions (purge-storage-objects)
│   └── migrations/           # Postgres migrations (0001 through 0012)
├── API.md                    # Canonical API contract for all endpoints
├── DESIGN.md                 # Design system tokens, color calibration & taste standards
└── version2memory.md         # Source of truth for product architecture & decision history
```

---

## Documentation Links

- **[API Contract (`API.md`)](./API.md)** — Exhaustive specification of every endpoint (method, path, authentication, payload, responses, and error codes).
- **[Design System (`DESIGN.md`)](./DESIGN.md)** — Visual design contract, typography hierarchy, Electric Blue (`#3457E8`) accent tokens, Obsidian neutrals, and layout guidelines.
- **[Architecture Guide (`docs/ARCHITECTURE.md`)](./docs/ARCHITECTURE.md)** — Detailed pipeline flow, security boundaries, database isolation, and CSP policies.
- **[User Journeys (`userflow.md`)](./userflow.md)** — Step-by-step current and proposed product flows with Mermaid sequence diagrams.
- **[Project Memory & Decision Log (`version2memory.md`)](./version2memory.md)** — The primary source of truth recording all technical decisions, scope boundaries, and architectural choices.
