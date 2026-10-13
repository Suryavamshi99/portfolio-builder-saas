# User Flow: Current and Target Architecture

Status as of 2026-10-13.

- **Part 1** describes how the product works today, traced directly through the implemented code on `main`.
- **Part 2** describes the target architecture specified in `version2memory.md` section 6: three model generation paths, hosting on `name.<sites-domain>`, custom domain management, and paid exports.

---

# Part 1: Current flow (as built)

Publishing today deploys to **the user's own Vercel account** via OAuth. HTML and ZIP exports are gated behind `hasPaidAccess` (server-side 402 checks). Payments are processed exclusively via **Dodo Payments** ($19 one-time Pro unlock).

## Diagram: current user journey

```mermaid
flowchart TD
    A["Landing page /"] --> B{"VITE_LAUNCH_MODE"}
    B -- "waitlist" --> W["Email form → POST /api/waitlist → Google Sheet"]
    B -- "live" --> L["/login: email + password"]
    L --> L2{"Portfolio exists?"}
    L2 -- "no" --> S1
    L2 -- "yes" --> ST

    subgraph WIZ["Onboarding wizard"]
        S1["1. Resume PDF/DOCX → POST /api/uploads"] --> S2["2. Reference screenshots + Minimal/Bold"]
        S2 --> S3["3. Profile photo"]
        S3 --> S4["4. Links + specifics → PUT /api/portfolio/inputs"]
        S4 --> S5["5. Gemini key → encrypted in byok_keys"]
        S5 --> S6["6. Generate → POST /api/generate"]
    end

    S6 --> FCK["Numeric Fact Check + 1 Repair Round"]
    FCK --> FIN["finalizeHtml: sanitize + markers"]
    FIN --> VER["Save to portfolio_versions"]
    VER --> ST["Studio /studio"]

    ST --> P{"Paid?"}
    P -- "no" --> WTR["Watermarked preview: data-shipfolio-watermark"]
    WTR --> PAY["Dodo checkout $19 → POST /api/billing/checkout"]
    PAY --> DODO["Dodo webhook → users.plan = pro"]
    DODO --> P
    P -- "yes" --> CLN["Clean unwatermarked preview"]
    CLN --> EXP["Export: Download HTML / ZIP"]
    CLN --> VCL["Publish: Deploy to own Vercel"]
```

## Diagram: generation request in detail

```mermaid
sequenceDiagram
    actor U as User
    participant UI as Wizard / Studio
    participant API as /api/generate
    participant DB as Supabase DB
    participant ST as Supabase Storage
    participant G as Google Gemini

    U->>UI: Click Generate
    UI->>API: provider: google, resumeUploadId, links, designIntensity
    API->>DB: Hourly rate limit check (generations table)
    API->>DB: Load encrypted Gemini key
    API->>DB: Load resume_texts (or extract from Storage)
    API->>ST: Temporary signed photo URL + reference images
    API->>G: System prompt + resume text + instructions
    G-->>API: Model-written HTML document
    API->>API: factCheckHtml(): check numbers, %, currency, years
    opt Facts flagged
        API->>G: One repair round with flagged claims
        G-->>API: Repaired HTML
    end
    API->>API: finalizeHtml(): structure, links, Google fonts, markers
    API->>DB: Record in portfolio_versions table
    API->>DB: Upsert portfolios.generated_html
    API->>DB: Record generations row (triggers 48h resume retention)
    API-->>UI: html (watermarked for free users)
    UI-->>U: "Your portfolio is ready" → Studio
```

## Diagram: background data retention

```mermaid
flowchart LR
    subgraph CRON["pg_cron (Database)"]
        H["Hourly: purge-post-generation-uploads"]
        D1["Daily 03:00: purge-stale-draft-uploads"]
        D2["Daily 04:00: queue-stale-draft-warnings"]
    end

    H --> EF["Edge Function: purge-storage-objects"]
    D1 --> EF

    EF --> S1["Deletes resumes & screenshots 48h after generation"]
    EF --> S2["Deletes photos & project images unchanged for 30 days"]
    D2 --> WN["Queues warning notifications at day 27-28"]
```

## Stage 0: Landing page (`/`)
- `getLaunchMode()`: In waitlist mode (`VITE_LAUNCH_MODE=waitlist`), calls to action trigger an email submission to `POST /api/waitlist` which forwards to Google Apps Script. In live mode, CTAs route directly to `/login`.

## Stage 1: Sign up or log in (`/login`)
- Supabase Auth handles email/password registration and sign-in.
- Destination: redirect parameter if provided; otherwise queries `GET /api/content` and routes to `/studio` if content exists, else `/onboarding`.
- Global CSRF Origin verification in `src/start.ts` protects all state-changing endpoints.

## Stage 2: The 6-step wizard (`/onboarding`)
1. **Resume**: `POST /api/uploads` (kind `resume`, PDF/DOCX, 5 MB limit). Magic bytes sniffed, text extracted and saved to `resume_texts`.
2. **Visual style**: Up to 3 reference screenshots + Minimal/Bold intensity toggle.
3. **Profile photo**: Single image slot, metadata and GPS EXIF stripped via `sharp`.
4. **Links and specifics**: LinkedIn, GitHub, project links, free-text instructions saved to `portfolio_inputs`.
5. **Gemini key**: Saved to `byok_keys` with AES-256-GCM encryption.
6. **Generate**: `POST /api/generate` runs fact checking, HTML sanitization, version storage, and server-side watermarking.

## Stage 3: Studio (`/studio`)
- Preview displayed in an isolated iframe with `sandbox="allow-scripts"` (without `allow-same-origin`).
- Free users see the `data-shipfolio-watermark` banner injected by the server.
- Paid users have access to clean unwatermarked preview, HTML download (`GET /api/export/html`), ZIP download (`GET /api/export/zip`), and Vercel publishing.

## Stage 4: Payment (Dodo Payments only)
- One-time $19 lifetime Pro unlock via `POST /api/billing/checkout`.
- Webhook `POST /api/webhooks/dodo` validates standard HMAC signature and activates `users.plan = 'pro'`.
- Server evaluates `hasPaidAccess()` across all protected actions.

## Stage 5: Publish (to user's own Vercel)
- OAuth connection established via `GET /api/vercel/oauth/start` and callback.
- `POST /api/publish` requires paid access (402 if unpaid), bundles storage images locally, uploads file blobs, and triggers deployment on user's Vercel account.

## Stage 6: Data retention
- Hourly pg_cron job deletes resumes and reference screenshots 48 hours after generation.
- Daily pg_cron job purges photos and project images for drafts inactive after 30 days.

---

# Part 2: Proposed architecture (Version 2)

Key architectural updates:
1. **Three generation paths:** (A) Free model fallback chain, (B) User's own Claude/ChatGPT subscription via MCP server, (D) User's own Gemini key.
2. **Model-written HTML:** Every path produces a complete, bespoke HTML/CSS document directly (no templates, no JSON intermediate step).
3. **Subdomain hosting:** Sites published to `name.<sites-domain>` with Content Security Policy sandbox isolation.
4. **Custom domains:** Custom domain mapping and HTTPS provisioning via Vercel Domains API.
5. **Comprehensive export:** Clean ZIP, HTML, and direct GitHub App repository push.

## Diagram: proposed user journey

```mermaid
flowchart TD
    A["Landing page"] --> L["Sign up / log in"]
    L --> U["Upload resume, photo, screenshots"]
    U --> I["Links + specifics → portfolio_inputs"]
    I --> CH{"Choose how to generate"}

    CH -- "A. Free" --> PA["Free model chain on server"]
    CH -- "B. Claude / ChatGPT" --> PB["User's chat app via MCP server"]
    CH -- "D. Gemini key" --> PD["User's Gemini key on server"]

    PA --> FH["finalizeHtml: fact check + security clean-up"]
    PB --> FH
    PD --> FH

    FH --> ST["Studio: live sandboxed preview & version history"]

    ST --> P{"Paid?"}
    P -- "no" --> W["Watermarked preview: data-shipfolio-watermark"]
    W --> PAY["Dodo checkout $19 (plus optional yearly hosting)"]
    PAY --> P
    P -- "yes" --> PUB["Publish → name.yoursites.domain"]
    P -- "yes" --> EX["Export menu"]
    PUB --> CD["Optional: connect custom domain"]
    EX --> Z["Download ZIP"]
    EX --> GH["Push to GitHub (+ Pages)"]
    EX --> VC["Deploy to own Vercel"]
```

## Diagram: the shared pipeline (finalizeHtml)

```mermaid
flowchart LR
    IN["Model-written HTML document"] --> EXT{"Extract HTML document"}
    EXT -- "Incomplete / Cut off" --> FAIL["Fail attempt / repair"]
    EXT -- "Valid document" --> RUL{"Check output rules"}
    RUL --> SAN["Safety clean-up: remove external JS, iframes, form POSTs"]
    SAN --> FCK{"Numeric fact check against resume_texts"}
    FCK -- "Flagged numbers/%/dates" --> REP["One repair round on model"]
    FCK -- "Clean" --> NRM["Normalise URLs to storage markers"]
    REP --> NRM
    NRM --> VER["Save to portfolio_versions"]
    VER --> UPD["Update portfolios.generated_html"]
    UPD --> GEN["Record generations row"]
```

## Diagram: path A (free models)

```mermaid
sequenceDiagram
    actor U as User
    participant UI as Wizard
    participant API as /api/generations
    participant DB as Supabase DB
    participant CH as Free Provider Chain

    U->>UI: Select ⚡ Free & Generate
    UI->>API: POST /api/generations { source: free }
    API->>DB: Check daily user limit & provider_budgets
    API-->>UI: 202 { jobId, status: reading }
    loop Polling
        UI->>API: GET /api/generations/:id
        API-->>UI: Real progress: reading → writing → checking → saving
    end
    API->>CH: OpenRouter-a → OpenRouter-b → Groq → Cerebras → Gemini
    CH-->>API: Generated HTML
    API->>API: finalizeHtml() & factCheckHtml()
    API->>DB: Save version & portfolio
    API-->>UI: status: done
    UI-->>U: Open in Studio
```

## Diagram: path B (Claude or ChatGPT via MCP)

```mermaid
sequenceDiagram
    actor U as User
    participant C as Claude.ai / ChatGPT
    participant M as /mcp (Streamable HTTP)
    participant AU as OAuth 2.1 Sign-in
    participant DB as Supabase DB

    Note over U,AU: One-time connection
    U->>C: Add custom connector (app domain /mcp)
    C->>AU: OAuth 2.1 + PKCE handshake
    AU->>U: Login + consent screen
    U->>AU: Authorize
    AU-->>C: Scoped access token (mcp_tokens)

    Note over U,DB: Execution
    U->>C: "Build my Shipfolio portfolio"
    C->>M: get_portfolio_brief()
    M->>DB: Read resume_texts, links, instructions, photo URL
    M-->>C: Brief + Guardrail prompt rules
    C->>C: Writes complete HTML document
    C->>M: save_portfolio_html(html)
    M->>M: finalizeHtml() & fact check
    alt Fact or rule issues
        M-->>C: List of specific issues to repair
        C->>M: save_portfolio_html(repaired)
    end
    M-->>C: previewUrl
    C-->>U: "Your portfolio is ready → Open in Studio"
```

## Diagram: publish, custom domain and serving

```mermaid
flowchart TD
    P["Click Publish (paid)"] --> SL["Validate subdomain slug availability"]
    SL --> B["Bundle images & upload to private 'sites' bucket"]
    B --> LV["Live at slug.yoursites.domain"]

    LV --> CD["Settings → Custom domain: janedoe.com"]
    CD --> VA["Vercel Domains API: add domain to 'sites' project"]
    VA --> DNS["User adds DNS records (A / CNAME / TXT token)"]
    DNS --> CK{"Verify domain ownership token"}
    CK -- "verified" --> SSL["Vercel provisions HTTPS certificate"]
    SSL --> LIVE2["Live at janedoe.com; subdomain redirects"]

    subgraph SERVE["Sites serving project (sites-app)"]
        RQ["HTTP Request"] --> H{"Host header"}
        H -- "slug.yoursites.domain" --> SG["Lookup sites.slug"]
        H -- "janedoe.com" --> CDL["Lookup custom_domains → slug"]
        SG --> F["Serve sites/slug/index.html with strict CSP sandbox"]
        CDL --> F
    end
```

## Diagram: export (paid)

```mermaid
flowchart TD
    E["Export menu (server-side paid check)"] --> Z["Download ZIP"]
    E --> H["Download HTML"]
    E --> G["Push to GitHub"]
    E --> V["Deploy to own Vercel"]

    Z --> Z1["index.html + images/* + README.txt with relative paths"]
    H --> H1["Single clean standalone HTML file"]

    G --> G1["Authenticate with GitHub App"]
    G1 --> G2["Push commit directly to repository via Git Data API"]
    G2 --> G3["Return commit URL and link"]

    V --> V1["Existing Vercel OAuth deployment pipeline"]
```
