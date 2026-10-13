# Architecture & Security Specification

This document details the core architecture, generation pipeline, security boundaries, and database isolation model for **Shipfolio AI**.

---

## 1. Pipeline Overview

Every portfolio generation path (Free chain, Claude/ChatGPT MCP server, or user Gemini key) follows a shared, rigorous processing and sanitization pipeline before HTML is stored or served:

```
[Resume PDF/DOCX] + [Wizard Inputs / Specifics]
                      │
                      ▼
            [Text Extraction] ──▶ Stored in public.resume_texts (Service-role only)
                      │
                      ▼
         [LLM Generation (Path A / B / D)] ──▶ Raw Model-Written HTML Document
                      │
                      ▼
             [finalizeHtml() Pipeline]
               ├── Extract HTML Document (strip markdown code fences)
               ├── Output Rules Enforcement (Google Fonts only, verified links only)
               └── Safety Sanitization (strip external scripts, iframes, forms, mXSS)
                      │
                      ▼
             [factCheckHtml() Verification]
               ├── Extract visible text
               ├── Verify numbers, percentages, currency, and years against resume_texts
               └── Trigger 1 repair round if unsupported claims are discovered
                      │
                      ▼
         [Normalize Expiring Storage URLs] ──▶ Stable storage markers (storage:uploads/...)
                      │
                      ▼
         [Save Version] ──▶ Stored in public.portfolio_versions & public.portfolios
                      │
                      ▼
               [Studio Workspace]
                 ├── Free users: Injected server-side watermark (data-shipfolio-watermark)
                 └── Sandboxed <iframe> (allow-scripts, without allow-same-origin)
                      │
                      ▼
             [Publish / Export Gate (hasPaidAccess() == true)]
               ├── Subdomain Hosting: slug.shipfolio.xyz (Strict CSP Sandbox)
               ├── Custom Domain: userdomain.com (Vercel Domains API + HTTPS)
               ├── ZIP Export: Bundled images + clean index.html
               └── GitHub Push: Commit directly via GitHub App
```

---

## 2. Security Boundaries & Rule Implementation

Security is enforced at multiple defense-in-depth boundaries across the application stack:

### A. HTML Sanitization & Safety (`src/server/finalize-html.ts`)
- **Malicious Tag Removal:** Prohibits external `<script src="...">`, `<iframe>`, `<object>`, `<embed>`, `<base>`, `<meta http-equiv="refresh">`, and form tags submitting to remote hosts. Small inline scripts for visual effects are permitted.
- **Mutual/Nested XSS (mXSS) Immunity:** Runs multi-pass cleaning until the DOM tree reaches stability against mutational XSS injections.
- **Link Whitelisting:** Rewrites outgoing hyperlink `href` attributes to keep only URLs explicitly supplied by the user in `portfolio_inputs` (plus internal `#anchor` links and `mailto:`/`tel:` addresses present in the resume). Disallowed links have their `href` removed while retaining label text.
- **Asset Restrictions:** Restricts external resources exclusively to Google Fonts (`https://fonts.googleapis.com` and `https://fonts.gstatic.com`). Remote external images are stripped; only verified user uploads and inline SVG/data URIs are permitted.

### B. Numeric Fact Checking (`src/server/fact-check.ts` & `checked-generation.ts`)
- **No-Hallucination Guardrail:** Analyzes visible text extracted from generated HTML against stored `resume_texts`.
- **Claim Extraction:** Extracts all numbers, percentages, currency quantities, and calendar years. If claims appear in the HTML that cannot be reconciled with the resume text, a structured repair prompt is triggered. If claims remain unresolved, generation fails with `422 generation_unsupported_claims`.

### C. Server-Side Watermark Injection (`src/server/watermark.ts`)
- **Preview Isolation:** For unpaid users (`hasPaidAccess() === false`), `injectWatermark()` adds a prominent banner tag carrying `data-shipfolio-watermark`.
- **Integrity Guarantee:** When saving or revising versions, `finalizeHtml()` automatically strips any element tagged with `data-shipfolio-watermark`, ensuring clean master copies in the database while never delivering clean HTML to unpaid clients.

### D. CSRF & Origin Validation (`src/start.ts` & `src/lib/origin.ts`)
- Evaluates incoming request headers on all state-changing HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`).
- Rejects requests whose `Origin` does not match `APP_ORIGIN` or `APP_EXTRA_ORIGINS` with `403 origin_check_failed` (exempting signed external webhooks under `/api/webhooks/*`).

### E. Content Security Policy (CSP) & Sandbox Isolation
- **Studio Preview:** Sandboxed with `<iframe sandbox="allow-scripts">` (strictly omitting `allow-same-origin`) to execute inline animations while completely isolating parent app cookies and storage.
- **Hosted Sites (`sites-app`):** Served with restrictive headers:
  ```http
  Content-Security-Policy: default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; media-src 'self'; connect-src 'none'; form-action 'none'; frame-src 'none'; base-uri 'none'; sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox
  ```
  The sandbox directive ensures user-hosted pages operate with an opaque origin, preventing cookie access against the parent domain.

---

## 3. Database Privilege Lockdown & Rules for New Tables

### The Rule for New Tables
A column-level `REVOKE` in PostgreSQL does not prevent access if a table-wide `GRANT` to `authenticated` or `anon` exists. Therefore, **every new database table must enforce total privilege revocation**:

```sql
-- 1. Enable Row Level Security
alter table public.<table_name> enable row level security;

-- 2. Revoke all privileges from public roles
revoke all on public.<table_name> from anon, authenticated;

-- 3. Explicitly grant ONLY minimum required operations (or none, relying on service-role)
```

### Established Migrations & Privileges
- **`0010_lock_down_privileges.sql`:** Revoked all direct table privileges on `public.portfolios` from `anon` and `authenticated`. Users cannot read or update `generated_html` via Supabase client SDKs; all access is mediated by server routes using the service-role client scoped to the authenticated session user ID.
- **`0011_portfolio_versions.sql`:** Created `portfolio_versions` with RLS enabled and all privileges revoked from `anon` and `authenticated`.
- **`0012_resume_texts.sql`:** Created `resume_texts` with RLS enabled and all privileges revoked from `anon` and `authenticated`.
