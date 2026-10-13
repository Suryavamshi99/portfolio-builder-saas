# API Contract — Shipfolio AI

This is the definitive API contract for **Shipfolio AI**. It serves as the single source of truth for UI development, API integrations, and client tooling.

**Hard Rule:** Every validation, upload quota, authorization boundary, content-integrity check, and rate limit described here is enforced **server-side**. The frontend must never attempt to duplicate or circumvent these rules client-side.

Status key:
- **✅ Shipped** — Implemented on `main`, tested, and operational.
- **⏳ Planned (in progress)** — Designed in handoffs `06a`–`06d`, under active development.

---

## 1. Authentication & Account

| Method | Path | Auth | Paid-only? | Request Body | Response Shape | Error Codes |
|---|---|---|---|---|---|---|
| `GET` | `/api/me` | Session Cookie | No | None | `{ id: string, email: string, plan: "free" \| "pro", isAdmin: boolean, hasPaidAccess: boolean, createdAt: string, storageUsedBytes: number, storageLimitBytes: number, vercel: { connected: boolean, username: string \| null } }` | `401 unauthorized`, `500 internal_error` |

*Note:* Session creation and password resets are handled directly by the browser Supabase Auth client (`supabase.auth.signUp`, `supabase.auth.signInWithPassword`). `GET /api/me` ensures the `public.users` row exists and computes `hasPaidAccess` on the server.

---

## 2. File Uploads

| Method | Path | Auth | Paid-only? | Request Body | Response Shape | Error Codes |
|---|---|---|---|---|---|---|
| `GET` | `/api/uploads` | Session Cookie | No | None (query: `?kind=resume \| visual_reference \| photo \| project_image`) | `{ uploads: Array<{ id: string, kind: string, filename: string, sizeBytes: number, mimeType: string, url: string, published: boolean, createdAt: string }> }` | `400 upload_invalid_kind`, `401 unauthorized`, `500 internal_error` |
| `POST` | `/api/uploads` | Session Cookie | No | `multipart/form-data` (`kind`, `file`) | `{ upload: { id: string, kind: string, filename: string, sizeBytes: number, mimeType: string, url: string, published: boolean, createdAt: string } }` | `400 invalid_form`, `400 upload_invalid_kind`, `400 upload_missing_file`, `400 upload_invalid_type`, `400 upload_too_large`, `409 upload_limit_exceeded`, `409 upload_quota_exceeded`, `429 rate_limited`, `401 unauthorized`, `500 internal_error` |
| `DELETE` | `/api/uploads/:id` | Session Cookie | No | None | `{ ok: true }` | `400 upload_id_required`, `404 upload_not_found`, `401 unauthorized`, `500 internal_error` |

*Upload Limits:*
- `resume`: Single slot (replaces existing), PDF/DOCX only, 5 MB max. Extracted text stored in `resume_texts`.
- `photo`: Single slot (replaces existing), PNG/JPEG/WEBP only, 5 MB max. EXIF/GPS stripped via `sharp`.
- `visual_reference`: Max 3 slots, PNG/JPEG/WEBP only, 5 MB max.
- `project_image`: Max 10 slots, PNG/JPEG/WEBP only, 5 MB max.
- Rate limits: 10 uploads/hr for free users; 30 uploads/hr for pro users. Storage quotas: 50 MB (free), 250 MB (pro).

---

## 3. Portfolio Inputs, Content & Version History

| Method | Path | Auth | Paid-only? | Request Body | Response Shape | Error Codes |
|---|---|---|---|---|---|---|
| `GET` | `/api/content` | Session Cookie | No | None | `{ html: string \| null, updatedAt: string \| null }` | `401 unauthorized`, `500 internal_error` |
| `PUT` | `/api/content` | Session Cookie | No | `{ html: string }` | `{ ok: true, updatedAt: string }` | `400 invalid_json`, `400 invalid_html`, `422 unsafe_html`, `401 unauthorized`, `500 internal_error` |
| `PUT` | `/api/portfolio/inputs` | Session Cookie | No | `{ links?: { linkedin?: string, github?: string, projectLinks?: string[], otherLinks?: string[] }, specifics?: string, designIntensity?: "minimal" \| "bold", preferredSource?: string }` | `{ ok: true, inputs: object }` | `400 invalid_json`, `400 invalid_links`, `401 unauthorized`, `500 internal_error` |
| `GET` | `/api/portfolio/versions` | Session Cookie | No | None | `{ versions: Array<{ id: string, source: string, model: string \| null, warnings: string[], createdAt: string }> }` | `401 unauthorized`, `500 internal_error` |
| `POST` | `/api/portfolio/versions/:id/restore` | Session Cookie | No | None | `{ ok: true, versionId: string, restoredAt: string }` | `400 invalid_request`, `404 version_not_found`, `401 unauthorized`, `500 internal_error` |
| `POST` | `/api/reset` | Session Cookie | No | None | `{ ok: true, resetAt: string }` | `401 unauthorized`, `500 internal_error` |

*Security & Watermarking:*
- `GET /api/content`: Free users receive watermarked HTML with `data-shipfolio-watermark`. Paid users receive clean, unwatermarked HTML.
- `POST /api/reset`: Wipes all uploads from storage, deletes `portfolio_inputs`, `resume_texts`, `portfolio_versions`, and resets `portfolios.generated_html = null`. Preserves purchases, generations history, BYOK keys, and Vercel connections.

---

## 4. BYOK Keys & Direct Generation

| Method | Path | Auth | Paid-only? | Request Body | Response Shape | Error Codes |
|---|---|---|---|---|---|---|
| `GET` | `/api/byok-keys` | Session Cookie | No | None | `{ keys: Array<{ provider: string, createdAt: string }> }` | `401 unauthorized`, `500 internal_error` |
| `POST` | `/api/byok-keys` | Session Cookie | No | `{ provider: "google", apiKey: string }` | `{ ok: true, provider: string }` | `400 invalid_json`, `400 invalid_provider`, `400 invalid_api_key`, `401 unauthorized`, `500 internal_error` |
| `DELETE` | `/api/byok-keys/:provider` | Session Cookie | No | None | `{ ok: true }` | `400 provider_required`, `401 unauthorized`, `500 internal_error` |
| `POST` | `/api/generate` | Session Cookie | No | `{ provider: "google", resumeUploadId: string, designIntensity?: "minimal" \| "bold", otherSpecifics?: string, instructions?: string, links?: object }` | `{ ok: true, html: string }` | `400 invalid_json`, `400 invalid_provider`, `400 invalid_request`, `400 resume_not_found`, `401 byok_key_missing`, `401 byok_key_invalid`, `422 generation_invalid_output`, `422 generation_unsupported_claims`, `429 rate_limited`, `429 provider_rate_limited`, `502 llm_provider_error`, `500 internal_error` |

*Generation Pipeline:*
- Performs numeric fact check against stored `resume_texts` (or resume extraction fallback).
- Performs one repair round if unverified numbers, percentages, currency, or years appear.
- Passes generated HTML through `finalizeHtml()` (validating semantic tags, sanitizing malicious tags/mXSS, ensuring Google Fonts only, replacing signed storage URLs with permanent storage markers).
- Records new version in `portfolio_versions` and updates `portfolios.generated_html`.

---

## 5. Exports (Paid Only)

| Method | Path | Auth | Paid-only? | Request Body | Response Shape | Error Codes |
|---|---|---|---|---|---|---|
| `GET` | `/api/export/html` | Session Cookie | Yes | None | File download (`portfolio.html`, `text/html; charset=utf-8`) | `400 no_portfolio`, `401 unauthorized`, `402 payment_required`, `422 export_unsafe_html`, `500 internal_error` |
| `GET` | `/api/export/zip` | Session Cookie | Yes | None | Binary zip package (`portfolio.zip`, `application/zip`) containing `index.html`, bundled `images/*`, and `README.txt` | `400 no_portfolio`, `401 unauthorized`, `402 payment_required`, `422 export_unsafe_html`, `500 internal_error` |

---

## 6. Publish to User's Vercel Account

| Method | Path | Auth | Paid-only? | Request Body | Response Shape | Error Codes |
|---|---|---|---|---|---|---|
| `GET` | `/api/vercel/oauth/start` | Session Cookie | Yes | None | Redirects to Vercel OAuth authorization URL with signed state | `401 unauthorized`, `402 payment_required` |
| `GET` | `/api/vercel/oauth/callback` | Session Cookie | No | Query: `?code=&state=` | Redirects to `/studio?vercel=connected` (or `/studio?vercel_error=<code>`) | `302 redirect` |
| `GET` | `/api/vercel/status` | Session Cookie | No | None | `{ connected: boolean, username: string \| null }` | `401 unauthorized`, `500 internal_error` |
| `DELETE` | `/api/vercel` | Session Cookie | No | None | `{ ok: true }` | `401 unauthorized`, `500 internal_error` |
| `POST` | `/api/publish` | Session Cookie | Yes | None | `202 { publication: { id: string, status: "queued", deploymentUrl: string \| null } }` | `400 no_portfolio`, `401 unauthorized`, `402 payment_required`, `409 vercel_not_connected`, `422 publish_unsafe_html`, `502 vercel_deploy_failed`, `500 internal_error` |
| `GET` | `/api/publish/status` | Session Cookie | No | None | `{ publication: { id: string, status: "queued" \| "building" \| "ready" \| "error", deploymentUrl: string \| null, finishedAt: string \| null } }` | `401 unauthorized`, `404 no_publications`, `500 internal_error` |

---

## 7. Billing & Payments (Dodo Payments)

| Method | Path | Auth | Paid-only? | Request Body | Response Shape | Error Codes |
|---|---|---|---|---|---|---|
| `POST` | `/api/billing/checkout` | Session Cookie | No | `{ returnTo?: "studio" \| "settings" }` | `{ checkoutUrl: string }` | `400 email_required`, `401 unauthorized`, `502 checkout_failed`, `500 internal_error` |
| `POST` | `/api/webhooks/dodo` | Webhook Signature | No | Dodo Webhook payload (`payment.succeeded`) | `{ ok: true }` | `400 invalid_signature`, `400 invalid_event` |
| `POST` | `/api/dev/payment-test` | Session Cookie | Dev only | `{ returnTo?: "studio" \| "settings" }` | HTML redirect to simulated checkout success/failure | `403 forbidden` (production) |

---

## 8. Admin & Waitlist

| Method | Path | Auth | Paid-only? | Request Body | Response Shape | Error Codes |
|---|---|---|---|---|---|---|
| `POST` | `/api/admin/login` | None | No | `{ username: string, password: string }` | `{ ok: true }` (sets `admin_session` httpOnly cookie) | `400 invalid_json`, `401 invalid_credentials`, `429 rate_limited` |
| `POST` | `/api/admin/logout` | None | No | None | `{ ok: true }` (clears cookie) | None |
| `GET` | `/api/admin/session` | Admin Cookie | No | None | `{ authenticated: boolean, username: string \| null }` | None |
| `GET` | `/api/admin/users` | Admin Cookie | No | None (query: `?page=1&limit=50&search=`) | `{ users: Array<object>, total: number, page: number, limit: number }` | `401 unauthorized`, `500 internal_error` |
| `GET` | `/api/admin/users/:id` | Admin Cookie | No | None | `{ user: object, portfolio: object \| null, uploads: Array<object>, generations: Array<object>, publications: Array<object>, purchases: Array<object> }` | `401 unauthorized`, `404 user_not_found`, `500 internal_error` |
| `PATCH` | `/api/admin/users/:id` | Admin Cookie | No | `{ plan?: "free" \| "pro", isAdmin?: boolean, html?: string }` | `{ ok: true, user: object }` | `400 invalid_body`, `401 unauthorized`, `404 user_not_found`, `500 internal_error` |
| `DELETE` | `/api/admin/users/:id` | Admin Cookie | No | None | `{ ok: true }` | `401 unauthorized`, `404 user_not_found`, `500 internal_error` |
| `POST` | `/api/waitlist` | None | No | `{ email: string, source?: string }` | `{ ok: true, duplicate?: boolean }` | `400 invalid_json`, `400 invalid_email`, `502 waitlist_webhook_unreachable`, `502 waitlist_webhook_failed` |

---

## 9. Background Jobs & Database Maintenance (pg_cron)

These cron routines run directly in Postgres via `pg_cron` and invoke Supabase Edge Functions:

| Routine | Schedule | Mechanism | Action |
|---|---|---|---|
| `purge-post-generation-uploads` | Hourly (`0 * * * *`) | `public.purge_post_generation_uploads()` → Edge Function | Purges resumes and visual reference screenshots 48 hours after generation (or abandoned uploads older than 48h). |
| `purge-stale-draft-uploads` | Daily (`0 3 * * *`) | `public.purge_stale_draft_uploads()` → Edge Function | Purges photos and project images for inactive drafts unchanged for 30+ days. |
| `queue-stale-draft-warnings` | Daily (`0 4 * * *`) | `public.queue_stale_draft_warnings()` | Queues warning entries in `upload_deletion_warnings` for inactive drafts at day 27–28. |

---

## 10. Planned (In Progress) Endpoints

The following endpoints are specified in handoffs `06a`–`06d` and `version2memory.md`, currently being integrated:

### A. Background Generation Jobs & Free Model Chain (Handoff 05 / 06a)
- `POST /api/generations`: Body `{ source: "free" \| "gemini", resumeUploadId: string, otherSpecifics?: string, designIntensity?: "minimal" \| "bold", links?: object, instructions?: string }` → `202 { jobId: string, status: "queued" \| "reading" \| "writing" \| "checking" \| "saving" \| "done" \| "failed" }`.
- `GET /api/generations/:id`: Polls real generation status → `{ id, source, status, message, error, retryAt, updatedAt }`.
- `GET /api/generations/latest`: Returns the most recent generation job.
- `DELETE /api/generations/:id`: Cancels an active queued generation job.
- `GET /api/free/status`: Returns free provider quota availability `{ available: boolean, usedToday: number, limitToday: number, resetsAt: string }`.
- `GET /api/cron/free-queue`: Cron endpoint (bearer `CRON_SECRET`) executing queued free-generation jobs when budgets reset.

### B. Subdomain Hosting & Sandbox Serving (Handoff 06d)
- `GET /api/sites/check?slug=`: Checks availability of subdomain `{ status: "available" \| "yours" \| "taken" \| "reserved" \| "invalid", url: string }`.
- `GET /api/sites/me`: Returns site status `{ site: { slug, url, status: "published" \| "unpublished", publishedVersionId, updatedAt } \| null, draftNewer: boolean }`.
- `POST /api/sites/publish`: Body `{ slug?: string }` → publishes portfolio HTML and bundles images into private storage bucket `sites` → `{ url: string }` (Paid: `402 payment_required`).
- `POST /api/sites/unpublish`: Unpublishes live site from subdomain.
- `POST /api/admin/sites/:slug/unpublish`: Superuser takedown route for hosted subdomains.

### C. GitHub Push Integration (Handoff 06b)
- `GET /api/github/status`: Returns `{ connected: boolean, account: string \| null, installUrl: string }`.
- `GET /api/github/callback?installation_id=&state=`: Verifies signed state, links GitHub App installation, and redirects to Studio.
- `POST /api/export/github`: Body `{ repo: "owner/repo" }` → pushes clean `index.html`, `images/*`, and `README.txt` directly to the specified GitHub repository via the Git Data API → `{ commitUrl: string, repo: string }` (Paid: `402 payment_required`).

### D. MCP Server & Custom Connector (Plan 6.4)
- `GET/POST /mcp`: Streamable HTTP Model Context Protocol endpoint for user's Claude.ai / ChatGPT. Tools: `get_portfolio_brief`, `save_portfolio_html`, `get_portfolio_html`.
- `GET /.well-known/oauth-protected-resource`, `GET /.well-known/oauth-authorization-server`: OAuth 2.1 metadata discovery endpoints.
- `/authorize`, `/token`, `/register`: OAuth 2.1 authorization server endpoints supporting PKCE.

### E. Custom Domain Management (Plan 6.9)
- `POST /api/domains`: Body `{ hostname: string }` → verifies format, registers domain with Vercel Domains API, stores verification token in `custom_domains` (Paid: `402 payment_required`).
- `POST /api/domains/:id/verify`: Queries Vercel and checks `_shipfolio-verify.<hostname>` TXT token → activates domain.
- `DELETE /api/domains/:id`: Removes custom domain mapping.
