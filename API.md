# API Contract — Shipfolio AI

This is the definitive API contract for **Shipfolio AI**. It serves as the single source of truth for UI development, API integrations, and client tooling.

**Hard Rule:** Every validation, upload quota, authorization boundary, content-integrity check, and rate limit described here is enforced **server-side**. The frontend must never attempt to duplicate or circumvent these rules client-side.

All endpoints return JSON responses unless otherwise noted (such as binary downloads, redirects, or raw HTML pages). Error responses universally use the `{ error: { code: string, message: string, ...extra } }` format.

---

## 1. Authentication & Account

| Method | Path | Auth | Paid-only? | Request Body | Response Shape | Error Codes |
|---|---|---|---|---|---|---|
| `GET` | `/api/me` | Session Cookie | No | None | `{ id: string, email: string, plan: "free" \| "pro", isAdmin: boolean, hasPaidAccess: boolean, createdAt: string, storageUsedBytes: number, storageLimitBytes: number, vercel: { connected: boolean, username: string \| null } }` | `401 unauthorized`, `500 internal_error` |

*Note:* Session creation, sign-in, and password resets are handled directly by the browser Supabase Auth client (`supabase.auth.signUp`, `supabase.auth.signInWithPassword`). `GET /api/me` ensures the `public.users` row exists and computes `hasPaidAccess` on the server.

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

## 4. Background Generation Jobs & Free Provider Chain

The old synchronous `/api/generate` has been replaced by background jobs (`generation_jobs`) with real-time status polling.

| Method | Path | Auth | Paid-only? | Request Body | Response Shape | Error Codes |
|---|---|---|---|---|---|---|
| `POST` | `/api/generations` | Session Cookie | No | `{ source: "free" \| "gemini", resumeUploadId: string, designIntensity?: "minimal" \| "bold", otherSpecifics?: string, instructions?: string, links?: object }` | `202 { jobId: string, status: "queued" \| "reading" \| "writing" \| "checking" \| "saving" }` | `400 invalid_json`, `400 invalid_request`, `400 resume_not_found`, `401 unauthorized`, `401 byok_key_missing`, `409 job_in_progress`, `429 rate_limited`, `429 free_daily_limit`, `500 internal_error`, `503 free_unavailable` |
| `GET` | `/api/generations/:id` | Session Cookie | No | None | `{ id: string, source: "free" \| "gemini" \| "mcp", status: "queued" \| "reading" \| "writing" \| "checking" \| "saving" \| "done" \| "failed", message: string, error: { code: string, message: string, details?: string[], retryAfterSeconds?: number } \| null, retryAt: string \| null, updatedAt: string }` | `401 unauthorized`, `404 job_not_found`, `500 internal_error` |
| `GET` | `/api/generations/latest` | Session Cookie | No | None | `{ id: string, source: "free" \| "gemini" \| "mcp", status: string, message: string, error: object \| null, retryAt: string \| null, updatedAt: string } \| null` | `401 unauthorized`, `500 internal_error` |
| `DELETE` | `/api/generations/:id` | Session Cookie | No | None | `{ ok: true }` | `401 unauthorized`, `404 job_not_found`, `500 internal_error` |
| `GET` | `/api/free/status` | Session Cookie | No | None | `{ available: boolean, usedToday: number, limitToday: number, resetsAt: string }` | `401 unauthorized`, `500 internal_error` |

*Job Lifecycle & Execution Rules:*
- Concurrency: Exactly one active job per user. If a job is currently running, `POST /api/generations` returns `409 job_in_progress` with `{ activeJobId }`.
- Status Progression: `queued` → `reading` (resume extraction) → `writing` (LLM call) → `checking` (numeric fact check) → `saving` (finalizeHtml, versions) → `done` (or `failed`).
- Free Chain Order: OpenRouter A (`FREE_MODEL_OPENROUTER_A`) → OpenRouter B → OpenRouter C → OpenRouter D. Only `:free` models are executed.
- Cancellation: `DELETE /api/generations/:id` marks a job waiting in `queued` status as cancelled.

---

## 5. BYOK Keys (Google Gemini)

| Method | Path | Auth | Paid-only? | Request Body | Response Shape | Error Codes |
|---|---|---|---|---|---|---|
| `GET` | `/api/byok-keys` | Session Cookie | No | None | `{ keys: Array<{ provider: string, createdAt: string }> }` | `401 unauthorized`, `500 internal_error` |
| `POST` | `/api/byok-keys` | Session Cookie | No | `{ provider: "google", apiKey: string }` | `{ ok: true, provider: string }` | `400 invalid_json`, `400 invalid_provider`, `400 invalid_api_key`, `401 unauthorized`, `500 internal_error` |
| `DELETE` | `/api/byok-keys/:provider` | Session Cookie | No | None | `{ ok: true }` | `400 provider_required`, `401 unauthorized`, `500 internal_error` |

*Security:* API keys are envelope-encrypted with AES-256-GCM using `ENCRYPTION_KEY` and stored in `public.byok_keys`. Plaintext keys are never returned.

---

## 6. Portfolio Exports (Paid Only)

| Method | Path | Auth | Paid-only? | Request Body | Response Shape | Error Codes |
|---|---|---|---|---|---|---|
| `GET` | `/api/export/html` | Session Cookie | Yes | None | File download (`portfolio.html`, `text/html; charset=utf-8`) | `400 no_portfolio`, `401 unauthorized`, `402 payment_required`, `422 export_unsafe_html`, `500 internal_error` |
| `GET` | `/api/export/zip` | Session Cookie | Yes | None | Binary zip package (`portfolio.zip`, `application/zip`) containing `index.html`, bundled `images/*`, and `README.txt` | `400 no_portfolio`, `401 unauthorized`, `402 payment_required`, `422 export_unsafe_html`, `500 internal_error` |
| `POST` | `/api/export/github` | Session Cookie | Yes | `{ repo: string }` (format: `"owner/repo"`) | `{ commitUrl: string, repo: string }` | `400 invalid_body`, `400 invalid_repo`, `400 github_not_connected`, `400 no_portfolio`, `400 github_repo_unavailable`, `400 github_invalid_request`, `401 unauthorized`, `402 payment_required`, `422 export_unsafe_html`, `500 internal_error`, `502 github_error` |

*GitHub Export:* Requires an active GitHub App installation linked via `/api/github/*`. Pushes clean `index.html`, bundled images, and `README.txt` directly to the repository via GitHub Git Data API with an installation token.

---

## 7. Subdomain & Path Hosting (Shipfolio Sites)

Portfolios can be published and hosted on the owner's domain. When wildcard DNS is unavailable, sites are served at `/s/<slug>` on the app domain; otherwise at `https://{slug}.${SITES_DOMAIN}`.

| Method | Path | Auth | Paid-only? | Request Body | Response Shape | Error Codes |
|---|---|---|---|---|---|---|
| `GET` | `/api/sites/check` | Session Cookie | No | None (query: `?slug=<string>`) | `{ status: "available" \| "yours" \| "taken" \| "reserved" \| "invalid", url: string \| null }` | `401 unauthorized`, `429 rate_limited`, `500 internal_error` |
| `GET` | `/api/sites/me` | Session Cookie | No | None | `{ site: { slug: string, url: string, status: "published" \| "unpublished", publishedVersionId: string \| null, updatedAt: string } \| null, draftNewer: boolean }` | `401 unauthorized`, `500 internal_error` |
| `POST` | `/api/sites/publish` | Session Cookie | Yes | `{ slug?: string }` | `{ url: string }` | `400 no_portfolio`, `400 slug_invalid`, `400 slug_reserved`, `401 unauthorized`, `402 payment_required`, `409 slug_taken`, `422 publish_unsafe_html`, `500 internal_error` |
| `POST` | `/api/sites/unpublish` | Session Cookie | No | None | `{ ok: true }` | `401 unauthorized`, `404 site_not_found`, `500 internal_error` |
| `POST` | `/api/admin/sites/:slug/unpublish` | Admin Cookie | No (Admin) | None | `{ ok: true }` | `400 invalid_slug`, `401 unauthorized`, `404 site_not_found`, `500 internal_error` |
| `GET` | `/s/<slug>` | Public | No | None | HTML document (`text/html; charset=utf-8`) with strict CSP sandbox | `404 HTML document` |
| `GET` | `/s/<slug>/images/:image` | Public | No | None | Binary image (`image/png`, `image/jpeg`, `image/webp`, `image/gif`) | `404 HTML document` |

*Hosting Security & Cache Rules:*
- Strict Sandbox: Every response from `/s/*` includes `Content-Security-Policy: ... sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox` (strictly omitting `allow-same-origin`). This gives the page an opaque origin: scripts cannot read or write the app's cookies or localStorage.
- Fast Takedown: Responses use `Cache-Control: public, max-age=0, s-maxage=20`. Unpublishing takes down the site from the edge cache within 20 seconds.

---

## 8. Custom Domain Management

Users who have published a portfolio can link a custom domain (e.g. `janedoe.com`).

| Method | Path | Auth | Paid-only? | Request Body | Response Shape | Error Codes |
|---|---|---|---|---|---|---|
| `GET` | `/api/domains` | Session Cookie | No | None | `{ domain: { hostname: string, status: "pending" \| "verified" \| "live", verifyRecord: { type: "TXT", name: string, value: string }, dns: { a: string[], cname: string[] } \| null, lastCheckedAt: string \| null } \| null }` | `401 unauthorized`, `500 internal_error` |
| `POST` | `/api/domains` | Session Cookie | Yes | `{ hostname: string }` | `{ domain: { hostname: string, status: "pending", verifyRecord: { type: "TXT", name: string, value: string }, dns: null, lastCheckedAt: null } }` | `400 domain_invalid`, `400 no_site`, `401 unauthorized`, `402 payment_required`, `409 domain_exists`, `409 domain_taken`, `500 internal_error` |
| `DELETE` | `/api/domains` | Session Cookie | No | None | `{ ok: true }` | `401 unauthorized`, `500 internal_error` |
| `POST` | `/api/domains/verify` | Session Cookie | No | None | On pending: `{ status: "pending", message: string }`<br>On success: `{ domain: { hostname: string, status: "verified" \| "live", verifyRecord: object, dns: object \| null, lastCheckedAt: string } }` | `401 unauthorized`, `404 no_domain`, `409 domain_unavailable`, `429 rate_limited`, `500 internal_error`, `502 domain_unavailable` |

*Domain Verification Workflow:*
1. User submits hostname via `POST /api/domains`. Server generates a unique verification token (`newVerifyToken()`).
2. User creates a DNS TXT record at `_shipfolio-verify.<hostname>` with that token.
3. User triggers `POST /api/domains/verify` (throttled to 1 check per 10s). The server performs DNS resolution (`resolveTxt`).
4. Once verified, the domain is registered with the Vercel REST API (`addDomain`). When Vercel reports `misconfigured: false`, the domain is promoted to `live`.

---

## 9. GitHub App Integration

| Method | Path | Auth | Paid-only? | Request Body | Response Shape | Error Codes |
|---|---|---|---|---|---|---|
| `GET` | `/api/github/status` | Session Cookie | No | None | `{ connected: boolean, account: string \| null, installUrl: string }` | `401 unauthorized`, `500 internal_error` |
| `GET` | `/api/github/callback` | Session Cookie | No | None (query: `?installation_id=&state=&code=`) | `302 redirect` to `/studio?github=connected` or `/studio?github_error=<code>` | `302 redirect` |

*Ownership Verification:* The callback verifies the OAuth `state` cookie and exchanges the authorization `code` with GitHub to prove the signing-in user owns the installation before saving the connection in `github_connections`.

---

## 10. Model Context Protocol (MCP) & OAuth 2.1 Connector

Enables users to connect their own Claude.ai or ChatGPT subscription to Shipfolio as a custom MCP connector.

### Protocol Endpoints

| Method | Path | Auth | Paid-only? | Request Body | Response Shape | Error Codes |
|---|---|---|---|---|---|---|
| `POST` | `/mcp` | Bearer Token | No | JSON-RPC 2.0 object (`method: "tools/list"` or `"tools/call"`) | JSON-RPC 2.0 result object | `400 Parse error`, `401 unauthorized`, `405 method_not_allowed`, `413 too_large` |
| `OPTIONS` | `/mcp`, `/register`, `/token` | Public | No | None | CORS preflight headers (`Access-Control-Allow-Origin: *`, `POST, OPTIONS`) | None |
| `GET` | `/authorize` | Session Cookie | No | Query: `client_id`, `redirect_uri`, `response_type=code`, `code_challenge`, `code_challenge_method=S256`, `state` | HTML consent page | `302 redirect` to `/login` if unauthenticated, `400` HTML on invalid client |
| `POST` | `/authorize` | Session Cookie | No | Form data: `client_id`, `redirect_uri`, `response_type`, `code_challenge`, `code_challenge_method`, `state`, `decision="allow" \| "deny"` | `303 redirect` to `redirect_uri?code=...&state=...` (or `error=access_denied`) | `400` HTML on invalid parameters, `401` on expired session |
| `POST` | `/token` | Public (PKCE) | No | Form data: `client_id`, `grant_type="authorization_code" \| "refresh_token"`, `code`, `code_verifier`, `redirect_uri`, `refresh_token` | `{ access_token: string, token_type: "Bearer", expires_in: 3600, refresh_token: string, scope: "portfolio:read portfolio:write" }` | `400 invalid_client`, `400 invalid_request`, `400 invalid_grant`, `400 unsupported_grant_type` |
| `POST` | `/register` | Public | No | `{ client_name?: string, redirect_uris: string[] }` | `201 { client_id: string, client_name: string, redirect_uris: string[], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }` | `400 invalid_client_metadata`, `503 server_error` |
| `GET` | `/.well-known/oauth-authorization-server` | Public | No | None | RFC 8414 metadata: `{ issuer, authorization_endpoint, token_endpoint, registration_endpoint, scopes_supported, grant_types_supported, code_challenge_methods_supported }` | None |
| `GET` | `/.well-known/oauth-protected-resource` | Public | No | None | RFC 9728 metadata: `{ resource, authorization_servers, scopes_supported, bearer_methods_supported }` | None |

### App Management Endpoints

| Method | Path | Auth | Paid-only? | Request Body | Response Shape | Error Codes |
|---|---|---|---|---|---|---|
| `GET` | `/api/mcp/status` | Session Cookie | No | None | `{ connected: boolean, connections: Array<{ clientId: string, clientName: string, createdAt: string, lastUsedAt: string \| null }>, latestJob: object \| null }` | `401 unauthorized`, `500 internal_error` |
| `DELETE` | `/api/mcp/connections/:clientId` | Session Cookie | No | None | `{ ok: true }` | `401 unauthorized`, `500 internal_error` |

*Available MCP Tools:*
1. `get_portfolio_brief`: Fetches the user's resume text, photo URL, reference screenshots, links, and guardrail rules.
2. `save_portfolio_html`: Accepts the complete generated HTML document (`{ html: string }`), runs `finalizeHtml()`, verifies facts, and saves a version. Returns `{ previewUrl }` or a list of specific issues to repair.
3. `get_portfolio_html`: Returns the current HTML so the model can apply revisions.

*Token Security:*
- Secrets are hashed using SHA-256 (`token_hash`) before storage; raw secrets are never persisted.
- Rotating refresh tokens with reuse detection: reuse within 10s is rejected without revocation (client retry tolerance); reuse after 10s revokes the entire token family.

---

## 11. Publish to User's Vercel Account

| Method | Path | Auth | Paid-only? | Request Body | Response Shape | Error Codes |
|---|---|---|---|---|---|---|
| `GET` | `/api/vercel/oauth/start` | Session Cookie | Yes | None | Redirects to Vercel OAuth authorization URL with signed state | `401 unauthorized`, `402 payment_required` |
| `GET` | `/api/vercel/oauth/callback` | Session Cookie | No | Query: `?code=&state=` | Redirects to `/studio?vercel=connected` (or `/studio?vercel_error=<code>`) | `302 redirect` |
| `GET` | `/api/vercel/status` | Session Cookie | No | None | `{ connected: boolean, username: string \| null }` | `401 unauthorized`, `500 internal_error` |
| `DELETE` | `/api/vercel` | Session Cookie | No | None | `{ ok: true }` | `401 unauthorized`, `500 internal_error` |
| `POST` | `/api/publish` | Session Cookie | Yes | None | `202 { publication: { id: string, status: "queued", deploymentUrl: string \| null } }` | `400 no_portfolio`, `401 unauthorized`, `402 payment_required`, `409 vercel_not_connected`, `422 publish_unsafe_html`, `502 vercel_deploy_failed`, `500 internal_error` |
| `GET` | `/api/publish/status` | Session Cookie | No | None | `{ publication: { id: string, status: "queued" \| "building" \| "ready" \| "error", deploymentUrl: string \| null, finishedAt: string \| null } }` | `401 unauthorized`, `404 no_publications`, `500 internal_error` |

---

## 12. Billing & Payments (Dodo Payments)

| Method | Path | Auth | Paid-only? | Request Body | Response Shape | Error Codes |
|---|---|---|---|---|---|---|
| `POST` | `/api/billing/checkout` | Session Cookie | No | `{ returnTo?: "studio" \| "settings" }` | `{ checkoutUrl: string }` | `400 email_required`, `401 unauthorized`, `502 checkout_failed`, `500 internal_error` |
| `POST` | `/api/webhooks/dodo` | Webhook Signature | No | Dodo Webhook payload (`payment.succeeded`, `refund.succeeded`, etc.) | `{ ok: true }` | `400 invalid_signature`, `400 invalid_event` |
| `POST` | `/api/dev/payment-test` | Session Cookie | Dev only | `{ returnTo?: "studio" \| "settings" }` | HTML redirect to simulated checkout success/failure | `403 forbidden` (production) |

---

## 13. Admin & Waitlist

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

## 14. Cron Jobs & System Maintenance

Scheduled tasks invoked by Vercel Cron (`vercel.json`) and Supabase `pg_cron`:

| Method | Path / Routine | Auth / Trigger | Action |
|---|---|---|---|
| `GET` | `/api/cron/free-queue` | `Authorization: Bearer <CRON_SECRET>` (Vercel Cron: `10 0 * * *`) | Processes up to 20 queued generation jobs waiting for free provider budget reset. |
| `GET` | `/api/cron/domains` | `Authorization: Bearer <CRON_SECRET>` (Vercel Cron: `20 0 * * *`) | Deletes pending custom domain verification records older than 14 days. |
| N/A | `purge-post-generation-uploads` | `pg_cron` Hourly (`0 * * * *`) → Edge Function | Purges resumes and visual references 48h after generation. |
| N/A | `purge-stale-draft-uploads` | `pg_cron` Daily (`0 3 * * *`) → Edge Function | Purges photos and project images for drafts inactive for 30+ days. |
| N/A | `queue-stale-draft-warnings` | `pg_cron` Daily (`0 4 * * *`) | Queues warning entries in `upload_deletion_warnings` for drafts inactive at 27–28 days. |
