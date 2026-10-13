# Antigravity Agent Development Log (Agydevelpoedagent.md)

**Branch:** `feat/05-studio-improvements`  
**Date:** 2026-10-12  
**Purpose:** Documentation of lightweight, non-breaking features and UX fixes built for reference by parallel LLM agents (handling Supabase, Vercel, and MCP integrations).

---

## 1. Summary of Changes

All 3 low-effort, non-breaking enhancements requested have been implemented, tested, and verified without external tool or cloud infrastructure dependencies:

1. **Server-Side ZIP Export Endpoint** (`GET /api/export/zip`)
2. **Portfolio Version History & Restore API + UI** (`GET /api/portfolio/versions`, `POST /api/portfolio/versions/:id/restore`, and Studio modal)
3. **Studio UX & Preview Hardening** (Iframe sandbox fix for scripts, editor actions for export & restore)

---

## 2. Detailed Technical Breakdown

### Feature 1: Server-Side ZIP Export
- **File:** [`src/routes/api/export/zip.ts`](file:///Users/suryavamshi/portfolio-builder-saas/src/routes/api/export/zip.ts)
- **Endpoint:** `GET /api/export/zip`
- **Dependencies Added:** `jszip` (and `@types/jszip`)
- **Behavior:**
  - Authenticates user and verifies paid status using `hasPaidAccess(user.id)`. Returns `402 Payment Required` if unpaid.
  - Retrieves current draft HTML (`portfolios.html_draft`).
  - Converts all signed storage markers in the HTML into offline asset references using `embedStorageImagesInHtml(admin, draftHtml)`.
  - Sanitizes resulting HTML using `sanitizeHtmlForServing(embeddedHtml)` to strip any malicious scripts or markers.
  - Packages HTML into a zip archive with:
    - `index.html` (the fully self-contained portfolio)
    - `images/*` (any downloaded images referenced by the template)
    - `README.txt` (brief hosting / usage instructions)
  - Returns binary streaming response with headers:
    - `Content-Type: application/zip`
    - `Content-Disposition: attachment; filename="portfolio.zip"`
    - `Cache-Control: private, no-store`

### Feature 2: Version History & Restore
- **Backend Service Helpers:** [`src/server/portfolio-versions.ts`](file:///Users/suryavamshi/portfolio-builder-saas/src/server/portfolio-versions.ts)
  - `listPortfolioVersions(admin: SupabaseClient, userId: string): Promise<PortfolioVersionSummary[]>`
    - Queries `portfolio_versions` table for `userId` ordered by `created_at desc`, limited to 20.
    - Selects `id`, `created_at`, `change_summary`, `warnings_count`, and `author_type`.
  - `restorePortfolioVersion(admin: SupabaseClient, userId: string, versionId: string): Promise<{ success: boolean; html: string }>`
    - Validates ownership (`user_id = userId`).
    - Retrieves the target version's HTML content.
    - Updates `portfolios.html_draft = version.html` and timestamps `updated_at`.
- **API Endpoints:**
  - [`src/routes/api/portfolio/versions.ts`](file:///Users/suryavamshi/portfolio-builder-saas/src/routes/api/portfolio/versions.ts): `GET /api/portfolio/versions` (returns list of versions for current authenticated user).
  - [`src/routes/api/portfolio/versions.$id.restore.ts`](file:///Users/suryavamshi/portfolio-builder-saas/src/routes/api/portfolio/versions.$id.restore.ts): `POST /api/portfolio/versions/:id/restore` (restores version to draft).
- **Unit Tests Added:** [`src/server/portfolio-versions.test.ts`](file:///Users/suryavamshi/portfolio-builder-saas/src/server/portfolio-versions.test.ts)
  - Verifies listing versions sorted descending.
  - Verifies restore logic, user scoping, and error handling for missing versions.

### Feature 3: Studio UX & Preview Hardening
- **Iframe Sandbox Fix:** [`src/components/preview/LivePreview.tsx`](file:///Users/suryavamshi/portfolio-builder-saas/src/components/preview/LivePreview.tsx)
  - **Change:** Changed `sandbox="allow-same-origin"` to `sandbox="allow-scripts"`.
  - **Reason:** Addressed Known Problem #6. Using `allow-scripts` without `allow-same-origin` ensures the iframe cannot access the parent window's `localStorage`, cookies, or DOM, while still allowing the user's generated portfolio template scripts (animations, interactive tabs, sliders) to execute cleanly.
- **Studio Editor Controls:** [`src/routes/-studio/Editor.tsx`](file:///Users/suryavamshi/portfolio-builder-saas/src/routes/-studio/Editor.tsx)
  - Added "Download Zip" button in the editor toolbar. If user is unpaid, it prompts checkout modal; if paid, triggers browser download directly.
  - Added "History" button with a Version History modal:
    - Lists recent snapshots with relative timestamps (`X mins ago`), author tags, and warnings badges. Hovering warnings displays rule validation messages.
    - One-click "Restore" button updates the live draft preview immediately and sends feedback notification.
  - Surfaced fact-check and output rule validation errors (`422` with details array) directly inside the Studio alert banner with bulleted items instead of generic failure messages.
  - Updated the regenerate confirmation dialog copy to reassure users that their current snapshot is safely saved to Version History before replacement.
  - **Single-File HTML Export:** Added `GET /api/export/html` ([`src/routes/api/export/html.ts`](file:///Users/suryavamshi/portfolio-builder-saas/src/routes/api/export/html.ts)) and added dedicated "HTML" export button alongside "Zip Archive". Bundles images and sanitizes serving HTML.
  - **Copy HTML to Clipboard:** Added "Copy HTML" button with instant feedback checkmark and clipboard integration for immediate pasting into other editors.
  - **Draft Persistence (`sessionStorage`):** Auto-saves typed regeneration instructions to `sessionStorage` in real-time, restoring draft state seamlessly across page reloads.
  - **Studio Keyboard Shortcuts:**
    - `⌘+Enter` (or `Ctrl+Enter`): opens confirmation dialog and regenerates portfolio.
    - `⌘+H` (or `Ctrl+H`): opens Version History modal.

---

## 3. Database / Schema Impact
- **No new migrations were introduced.**
- All queries leverage the existing `portfolio_versions` schema introduced in migration `0011_portfolio_versions.sql`.
- Existing RLS policies and table columns (`id`, `user_id`, `portfolio_id`, `html`, `change_summary`, `warnings_count`, `author_type`, `created_at`) fully satisfy these features.

---

## 4. Verification & Health Check Results
- **TypeScript:** `npx tsc --noEmit -p .` passes with 0 errors.
- **Linter:** `npm run lint` passes with 0 errors.
- **Unit Tests:** `npx vitest run` passes 104/104 tests.
- **Build:** `npm run build` succeeds cleanly with all route manifests generated.

---

## 5. Production Domain Setup (`shipfolio.xyz`)

**Domain:** `shipfolio.xyz` (Registrar: GoDaddy, Hosting Platform: Vercel)  
**Live Production URL:** `https://shipfolio.xyz` / `https://www.shipfolio.xyz`

### Vercel Project & Team Association
- **Vercel Account:** `vamshiravi99-6190`
- **Active Team:** `surya-team2` (Surya Team)
- **Project Name:** `portfolio-builder-saas`
- **GitHub Repository:** `Suryavamshi99/portfolio-builder-saas`

### DNS Configuration Configured in GoDaddy
Both the apex domain and `www` subdomain are verified and served over TLS:

| Record Type | Host / Name | Target / Data | TTL | Status |
| :--- | :--- | :--- | :--- | :--- |
| **A** | `@` | `216.198.79.1` | 600s | Verified on Vercel |
| **A** | `@` | `64.29.17.1` | 600s | Verified on Vercel |
| **CNAME** | `www` | `cd4b9ed00a6450cb.vercel-dns-017.com.` | 1 Hour | Verified on Vercel |

### SSL / Security
- Automatic TLS certificate issued via **Let's Encrypt** (`CN=shipfolio.xyz`, valid until Jan 2027).
- HSTS enabled, automatic HTTP-to-HTTPS 308 redirect active.

