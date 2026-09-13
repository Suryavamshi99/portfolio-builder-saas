# API contract — Portfolio Builder SaaS

This is the one file Antigravity's UI session needs to read to build the entire
frontend. It should never need this repo's DB schema, server internals, or the
LLM/Vercel integration code — only this contract.

**Hard rule:** every check described here (upload limits, content-integrity
guardrails, rate limits, retention rules) is enforced **server-side, in these
endpoints**. The UI must never reimplement or bypass them client-side — it only
calls the API and renders what comes back.

Status key: **✅ Shipped** (implemented, response shape is real) · **🚧 Stub**
(designed, not implemented — shape may still change) · **⏳ Planned** (not yet
designed in detail).

---

## Changelog

- **2026-09-13** — Milestone 1 (auth + per-user storage) and the milestone 2
  content endpoints shipped: `GET /api/me`, `GET /api/content`,
  `PUT /api/content` are now real, backed by Supabase (Postgres + Auth).
  Response shapes below match what's actually implemented, not just design —
  the earlier draft shapes for these three were confirmed unchanged. Studio
  (`/studio`) now reads/writes through `PUT /api/content` instead of the old
  dev-only disk write. Auth itself is Supabase Auth directly from the
  browser client — no custom login endpoint exists or is planned.
- **2026-09-11** — Initial version. All endpoints are 🚧 Stub. No server code
  exists yet; milestone 1 (auth + per-user storage) hasn't started. This
  document exists first so the contract shape is visible from day one.

---

## Conventions

- Base URL: same origin as the app (this is a TanStack Start app; endpoints
  are server routes under `/api/*`, not a separate service).
- Auth: session cookie set by Supabase Auth (via `@supabase/ssr` or
  equivalent). Endpoints marked **Auth: required** return `401` with no body
  detail if there's no valid session — never a redirect, so the UI decides how
  to handle it.
- All responses are plain JSON. No server-rendering assumptions — safe to call
  from anywhere.
- Error shape, always:
  ```json
  { "error": { "code": "string_machine_code", "message": "human-readable string" } }
  ```
- Success shape has no fixed envelope — each endpoint documents its own body.
- Timestamps are ISO 8601 UTC strings.
- File size limits below are enforced against the **actual byte size and
  real file content** (magic-byte sniffing), never the client-reported
  `Content-Type` or filename extension.

---

## Milestone 1 — Auth + per-user storage

Auth itself is handled client-side by the Supabase Auth SDK (sign up, sign in,
sign out, session refresh) — Antigravity talks to Supabase directly for that,
not to a custom endpoint here. The one endpoint this repo adds is for reading
the app-specific user record (plan, quota, etc.) that lives in our own table
alongside the Supabase-managed auth user.

### `GET /api/me` — ✅ Shipped

**Auth:** required.

Returns the current user's app-level record. Creates it on first call if this
is a brand-new Supabase Auth user (lazy provisioning, no separate signup
endpoint needed).

Response `200`:

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "plan": "free",
  "createdAt": "2026-09-11T00:00:00Z",
  "storage": { "usedBytes": 1234000, "quotaBytes": 52428800 },
  "vercel": { "connected": false }
}
```

`plan` is the extension point for future billing — always `"free"` in this
phase, not enforced against anything yet.

---

## Milestone 2 — Studio content (read/write the draft)

Replaces the old dev-only `POST /__studio/save` disk write. Studio's Save
button calls only this — **it never triggers a deploy.**

### `GET /api/content` — ✅ Shipped

**Auth:** required.

Returns the current user's `Content` row. If the user has none yet, creates
and returns an empty one (see `emptyContent` in `src/data/content.ts`) rather
than 404ing — Studio always has something to render.

Response `200`:

```json
{ "content": { "profile": { "...": "..." }, "projects": [] }, "updatedAt": "2026-09-11T00:00:00Z" }
```

### `PUT /api/content` — ✅ Shipped

**Auth:** required.

Body: `{ "content": <full Content object> }` (same shape Studio's `serialize()`
already produces, wrapped). Validated server-side in two passes before
writing — this is the server-side mirror of the client-side validation
Studio already does, not a replacement for it:

1. The full object against the shared zod `contentSchema` — issue paths here
   are dot-joined field paths (e.g. `profile.name`, `projects.1.date`).
2. `projects` specifically through the same `projectErrors()` business-rule
   check Studio's UI already runs (missing required fields, duplicate slugs)
   — issue paths here are just `projects.<index>`, one combined message per
   project, since that function flags a whole project rather than one field.

Request:

```json
{ "content": { "profile": { "...": "..." }, "projects": [] } }
```

Response `200`:

```json
{ "ok": true, "updatedAt": "2026-09-13T00:12:03Z" }
```

Response `422` (validation failed — a schema-shape issue and a business-rule
issue shown together):

```json
{
  "error": { "code": "content_invalid", "message": "2 problem(s) found" },
  "issues": [
    { "path": "profile.name", "message": "Required" },
    { "path": "projects.2", "message": "Duplicate slug \"decide\"" }
  ]
}
```

---

## Milestone 2b — File uploads

One reusable server-side module handles every upload type — the per-field
limits below are config passed into it, not separate implementations.

Guardrails enforced **before** anything is written to storage (order:
size → real content-type → remaining quota → strip metadata → store):

| kind | max count | max size each | allowed types |
|---|---|---|---|
| `resume` | 1 | 5MB | PDF, DOCX |
| `visual_reference` | 3 | 5MB | PNG, JPG, WEBP |
| `photo` | 1 | 5MB | PNG, JPG, WEBP |
| `project_image` | 10 total | 5MB | PNG, JPG, WEBP |

- Per-user total storage quota: config value (`plan.quotaBytes`, currently
  50MB flat on `"free"` — see `GET /api/me`), not hardcoded per-call.
- Uploads per hour: ~10 per account, tracked separately from LLM generation
  rate limits (see milestone 4).
- Images are stripped of EXIF/GPS metadata server-side before storage.
- Retention (enforced by a scheduled Postgres function, not this endpoint):
  resumes and `visual_reference` images expire 48h after a successful
  generation regardless of publish status; `photo`/`project_image` on an
  inactive draft expire after 30 days (warning email a few days prior);
  images tied to a **currently published** site are never auto-deleted.

### `POST /api/uploads` — 🚧 Stub

**Auth:** required. `multipart/form-data`.

Fields: `kind` (`resume` | `visual_reference` | `photo` | `project_image`),
`file`.

Response `201`:

```json
{
  "id": "upload_uuid",
  "kind": "resume",
  "filename": "surya-resume.pdf",
  "sizeBytes": 214532,
  "url": "https://.../signed-url-or-public-path",
  "createdAt": "2026-09-11T00:00:00Z"
}
```

Response `400` (rejected — bad type/size, never touches storage):

```json
{ "error": { "code": "upload_invalid_type", "message": "Expected PDF or DOCX" } }
```

Response `409` (quota or count exceeded):

```json
{ "error": { "code": "upload_quota_exceeded", "message": "Storage quota exceeded (50MB on the free plan)" } }
```

Response `429` (hourly upload cap):

```json
{ "error": { "code": "rate_limited", "message": "Upload limit reached, try again later" } }
```

### `GET /api/uploads` — 🚧 Stub

**Auth:** required. Query: optional `kind`.

Response `200`: `{ "uploads": [ { "id": "...", "kind": "photo", "...": "..." } ], "storage": { "usedBytes": 1234000, "quotaBytes": 52428800 } }`

### `DELETE /api/uploads/:id` — 🚧 Stub

**Auth:** required. `204` on success.

---

## Milestone 3 — BYOK key management + resume extraction

### `POST /api/byok-keys` — 🚧 Stub

**Auth:** required.

Body: `{ "provider": "anthropic" | "openai" | "google", "apiKey": "sk-..." }`.
Key is encrypted at rest immediately; never logged, never echoed back in any
response.

Response `200`: `{ "provider": "anthropic", "connectedAt": "2026-09-11T00:00:00Z" }`

### `GET /api/byok-keys` — 🚧 Stub

**Auth:** required. Response `200`:

```json
{ "keys": [ { "provider": "anthropic", "connectedAt": "2026-09-11T00:00:00Z" } ] }
```

Never includes the actual key material.

### `DELETE /api/byok-keys/:provider` — 🚧 Stub

**Auth:** required. `204` on success.

### `POST /api/generate` — 🚧 Stub

**Auth:** required.

The core BYOK extraction call. Takes an already-uploaded resume plus free-text
"any other specifics," calls the user's own key with the guardrail system
prompt (verbatim, see project brief — content-integrity rules are non-
negotiable and identical regardless of provider), and returns data validated
against `contentSchema` — never raw HTML.

Body:

```json
{
  "provider": "anthropic",
  "resumeUploadId": "upload_uuid",
  "otherSpecifics": "Emphasize the pricing/growth work, keep tone concise."
}
```

Response `200` (extraction succeeded and passed server-side validation — saved
as the user's new draft, same row `PUT /api/content` writes to):

```json
{ "content": { "profile": { "...": "..." }, "projects": [] }, "updatedAt": "2026-09-11T00:00:00Z" }
```

Response `422` (model output didn't validate against the schema — surfaced to
the user rather than silently retried with relaxed rules):

```json
{
  "error": { "code": "generation_invalid_output", "message": "Model output didn't match the content schema" },
  "issues": [{ "path": "work.roles.0.id", "message": "Required" }]
}
```

Response `401` (BYOK key missing/invalid — distinct from our own auth 401):

```json
{ "error": { "code": "byok_key_missing", "message": "Connect an Anthropic/OpenAI/Google API key first" } }
```

Response `429`: rate limited — see milestone 4.

---

## Milestone 4 — Rate limiting

Not a separate endpoint — behavior layered onto the above. Documented here so
the UI knows what to expect and render (never to re-implement the limit
itself):

- `POST /api/generate`: capped per account per hour (our compute cost even
  though the LLM cost is the user's own key). Exceeding it returns `429` with
  `{ "error": { "code": "rate_limited", "message": "...", "retryAfterSeconds": 1800 } }`.
- `POST /api/uploads`: capped at ~10/hour per account, separately from the
  above (see milestone 2b).

---

## Milestone 5 — Vercel OAuth + publish

Studio's **Save** (`PUT /api/content`) only ever updates the draft. Nothing
below is triggered by Save — only by an explicit Publish action.

### `GET /api/vercel/oauth/start` — 🚧 Stub

**Auth:** required. Redirects the browser into Vercel's OAuth consent screen.
Not a JSON endpoint — the UI should navigate the top-level window to this URL,
not `fetch()` it.

### `GET /api/vercel/oauth/callback` — 🚧 Stub

Vercel redirects back here with a `code`; this exchanges it for a token
(encrypted at rest), then redirects the browser to a UI-owned "connected"
page.

### `GET /api/vercel/status` — 🚧 Stub

**Auth:** required. Response `200`:

```json
{ "connected": true, "vercelUsername": "suryavamshi", "connectedAt": "2026-09-11T00:00:00Z" }
```

### `DELETE /api/vercel` — 🚧 Stub

**Auth:** required. Disconnects (revokes/discards the stored token). `204`.

### `POST /api/publish` — 🚧 Stub

**Auth:** required. Requires Vercel connected.

Renders the user's current `Content` through the shared template into static
HTML/CSS/JS, copies any referenced images into the deploy bundle itself (not
links back to our Storage — the live site never depends on our storage
staying populated), and pushes it via Vercel's Deployments API to the user's
own account.

Response `202` (deployment kicked off — this is not necessarily synchronous):

```json
{ "deploymentId": "dpl_uuid", "status": "queued" }
```

Response `409` (Vercel not connected):

```json
{ "error": { "code": "vercel_not_connected", "message": "Connect your Vercel account first" } }
```

### `GET /api/publish/status` — 🚧 Stub

**Auth:** required. Poll the last publish's status.

Response `200`:

```json
{ "deploymentId": "dpl_uuid", "status": "ready", "url": "https://their-site.vercel.app", "finishedAt": "2026-09-11T00:03:00Z" }
```

`status` is one of `queued | building | ready | error`.

---

## Milestone 6 — Payments

Out of scope this phase. The only forward-looking surface is the `plan` field
already returned by `GET /api/me` (`"free"` today, unenforced) — no Dodo
Payments code, coupons, or gating exists yet, intentionally.
