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

- **2026-09-20** — Rebranded from "Portfol.io" to **Shipfolio** (the former
  domain was already taken) — every user-facing brand string, the badge
  link, and the landing-page mockup URL updated; the generic English word
  "portfolio" describing the product itself is untouched. Also shipped
  Milestone 7 (`POST /api/waitlist`) and `VITE_LAUNCH_MODE`, a pre-launch
  GTM toggle — see that milestone's section for the full contract. Fixed a
  real bug found while doing this: the free-tier badge hardcoded
  `href="https://portfol.io"`, a domain nobody owns — now links to the
  app's own `APP_ORIGIN` instead.
- **2026-09-17 (2)** — Milestone 6 (payments) shipped: `POST /api/billing/checkout`,
  `POST /api/webhooks/dodo`. Shape change from the original stub: dropped
  "unlimited portfolios" as a Pro benefit — the schema only supports one
  portfolio per user, for everyone, which wasn't discovered as a real
  constraint until this milestone was actually being scoped. Pro instead
  gates storage quota, generation/upload rate limits, and the published-
  site badge — see the milestone's intro paragraph for the full table.
  One-time lifetime unlock, not a subscription, per explicit product
  decision — no renewal/coupon/plan-downgrade logic exists.
- **2026-09-17** — Closed loose ends flagged in earlier entries. Fixed two
  real bugs, not just uncertainty: (1) `gemini-2.0-flash` (google model id)
  was actually shut down by Google on 2026-06-01 — any generation with that
  provider was broken; replaced with `gemini-3.5-flash`, and `gpt-4o`
  (deprecated) with `gpt-5.6-terra`, both verified against each provider's
  current docs. (2) Vercel's OAuth token response includes `team_id`
  (non-null when installed on a Team, not a personal account) which was
  never captured — every Vercel API call after connecting needed it as a
  `teamId` query param or would 403; fixed via migration `0004` and
  `src/server/vercel/deploy.ts`. Also confirmed DOCX extraction (`mammoth`)
  actually works end-to-end via a standalone smoke test (previously only
  PDF had been verified this way).
- **2026-09-16** — Added `POST /api/reset` ("start over" — see its own section
  below, after milestone 2). Not part of the original six milestones; added
  as a product requirement once real usage surfaced the need for a clean-
  slate action distinct from a wizard re-run (which only overwrites content,
  keeps uploads). Also: the frontend now gates `/studio` behind having a
  ready portfolio (`profile.name`/`role`/`thesis` non-empty) — a UI-only
  routing decision, not a new server rule, so no contract change for
  `GET /api/content` itself.
- **2026-09-13 (4)** — Milestone 5 (Vercel OAuth + publish) shipped:
  `GET /api/vercel/oauth/{start,callback}`, `GET /api/vercel/status`,
  `DELETE /api/vercel`, `POST /api/publish`, `GET /api/publish/status`. New
  `404 no_publications` on the status endpoint (not in the original stub —
  the real first-call case needed a shape). Also corrected a retention-cron
  bug from milestone 1: `uploads.published` was implemented to permanently
  exempt a row from the 30-day inactivity purge, but the brief's actual
  intent (re-read carefully once publish existed to clarify it) is that
  publish copying bytes into the Vercel bundle is what protects a live
  site — once that's done, our copy is disposable under the same 30-day
  rule as any draft. Fixed in `0001`–`0003`'s migrations; not an API.md
  contract change (internal cron behavior). Flagging clearly: the Vercel
  OAuth/Deployments API endpoint shapes in `src/config/vercel.ts` and
  `src/server/vercel/*` are unverified against live traffic — isolated
  there specifically so a correction doesn't ripple into the `/api/vercel/*`
  contract below.
- **2026-09-13 (3)** — Milestone 3 (BYOK + resume extraction) shipped:
  `POST/GET /api/byok-keys`, `DELETE /api/byok-keys/:provider`,
  `POST /api/generate`. Milestone 4's generation rate limit shipped alongside
  it (same endpoint, couldn't responsibly ship one without the other) — both
  milestone 4 bullets are now ✅. Shape refinements from the original stub:
  the single documented `401` became two codes (`byok_key_missing` vs.
  `byok_key_invalid`), a new `502 llm_provider_error` covers provider-side
  failures distinct from both of those, and every `429` (uploads and
  generate) now carries a real `retryAfterSeconds` computed from the rolling
  window, not a placeholder. Also closed the Storage-cleanup gap flagged in
  the previous entry — see `supabase/functions/purge-storage-objects/` and
  `0003_storage_cleanup.sql`; not an API.md endpoint (internal cron
  infrastructure), so no contract change, just noting it's no longer a known
  gap.
- **2026-09-13 (2)** — Milestone 2b (file uploads) shipped: `POST/GET
  /api/uploads`, `DELETE /api/uploads/:id`. Shape changes from the original
  stub: the 409 response now uses two distinct codes — `upload_limit_exceeded`
  (per-kind count cap) vs `upload_quota_exceeded` (storage bytes) — instead of
  one shared code; `POST /api/uploads`'s 400 also covers `upload_invalid_kind`
  and `upload_missing_file`, not just `upload_invalid_type`/`upload_too_large`.
  Everything else matches the original design.
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

## "Start over" — reset a draft to blank

Not one of the original six milestones — added as a product requirement.
Distinct from re-running the wizard's Generate step (which only overwrites
`portfolios.content`, leaving uploads and BYOK keys untouched): this wipes
everything a user would need to re-enter to build fresh, while explicitly
preserving what they'd have to go re-obtain from a third party.

### `POST /api/reset` — ✅ Shipped

**Auth:** required. No request body.

Deletes every upload row **and its Storage object** for the user (resume,
visual references, photo, project images), then resets `portfolios.content`
to the empty `Content` shape. Does **not** touch `byok_keys`,
`vercel_connections`, `generations`, or `publications` — connected provider
keys stay connected, and a previously published site stays live and
unaffected (this only resets the draft, not anything already deployed).

Irreversible — the UI must get explicit confirmation before calling this;
the endpoint does not ask twice or support undo.

Response `200`:

```json
{ "ok": true, "updatedAt": "2026-09-16T00:00:00Z" }
```

Response `500`: `{ "error": { "code": "internal_error", "message": "..." } }`
— note the message distinguishes a failure that happened before vs. after
uploads were cleared (e.g. `"Uploads cleared, but could not reset content"`),
since those leave the account in different partial states worth surfacing.

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

Singleton kinds (`resume`, `photo`) — a new upload **replaces** the existing
one automatically. Capped kinds (`visual_reference`, `project_image`) reject
a new upload once the count limit is hit instead — the user removes one via
`DELETE` first. Uploaded files get a **signed URL, 1 hour TTL** — the bucket
is private, so re-fetch `GET /api/uploads` (or re-`POST`) rather than caching
a `url` past its expiry.

### `POST /api/uploads` — ✅ Shipped

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
  "url": "https://.../object/sign/uploads/...?token=...",
  "createdAt": "2026-09-13T00:00:00Z"
}
```

Response `400` (rejected — bad type/size/missing field, never touches
storage; `code` is one of `upload_invalid_kind`, `upload_missing_file`,
`upload_invalid_type`, `upload_too_large`):

```json
{ "error": { "code": "upload_invalid_type", "message": "Expected one of: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document" } }
```

Response `409` — two distinct codes depending on which limit was hit:

```json
{ "error": { "code": "upload_limit_exceeded", "message": "You can have at most 3 visual_reference uploads — remove one first" } }
```

```json
{ "error": { "code": "upload_quota_exceeded", "message": "Storage quota exceeded (50MB on the free plan)" } }
```

Response `429` (hourly upload cap, separate from the LLM rate limit):

```json
{ "error": { "code": "rate_limited", "message": "Upload limit reached, try again later" } }
```

### `GET /api/uploads` — ✅ Shipped

**Auth:** required. Query: optional `?kind=`. `storage` in the response is
always account-wide totals, even when `kind` filters which uploads are
listed.

Response `200`:

```json
{
  "uploads": [
    { "id": "...", "kind": "photo", "filename": "headshot.jpg", "sizeBytes": 812004, "url": "https://.../sign/...", "createdAt": "2026-09-13T00:00:00Z" }
  ],
  "storage": { "usedBytes": 1234000, "quotaBytes": 52428800 }
}
```

### `DELETE /api/uploads/:id` — ✅ Shipped

**Auth:** required. `204` on success, `404` (`{ "error": { "code": "not_found", ... } }`) if the upload doesn't exist or isn't yours.

---

## Milestone 3 — BYOK key management + resume extraction

### `POST /api/byok-keys` — ✅ Shipped

**Auth:** required.

Body: `{ "provider": "anthropic" | "openai" | "google", "apiKey": "sk-..." }`.
Key is encrypted at rest immediately (AES-256-GCM, key lives only in this
app's env — never in Postgres); never logged, never echoed back in any
response. Calling this again for a provider you've already connected
**rotates** the key (upsert) rather than erroring.

Response `200`: `{ "provider": "anthropic", "connectedAt": "2026-09-13T00:00:00Z" }`

Response `400`: `{ "error": { "code": "invalid_provider" | "invalid_api_key", "message": "..." } }`

### `GET /api/byok-keys` — ✅ Shipped

**Auth:** required. Response `200`:

```json
{ "keys": [ { "provider": "anthropic", "connectedAt": "2026-09-13T00:00:00Z" } ] }
```

Never includes the actual key material — the query behind this doesn't even
select the encrypted columns.

### `DELETE /api/byok-keys/:provider` — ✅ Shipped

**Auth:** required. `204` on success (also 204 if that provider wasn't
connected — delete is idempotent, not "not found").

### `POST /api/generate` — ✅ Shipped

**Auth:** required.

The core BYOK extraction call. Takes an already-uploaded resume (PDF/DOCX —
text is extracted server-side with `pdf-parse`/`mammoth` before it ever
reaches the LLM, so the same code path works identically across providers)
plus free-text "any other specifics," calls the user's own key with the
guardrail system prompt **verbatim** (content-integrity rules are non-
negotiable and identical regardless of provider — see
`src/server/llm/guardrail-prompt.ts`), and returns data validated against
`contentSchema` — never raw HTML. The model is asked to emit JSON matching a
JSON Schema generated from that same zod schema (`zod-to-json-schema`), not a
hand-written duplicate.

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
{ "content": { "profile": { "...": "..." }, "projects": [] }, "updatedAt": "2026-09-13T00:12:03Z" }
```

Response `422` — two distinct causes, same code:

```json
{ "error": { "code": "generation_invalid_output", "message": "Model output wasn't valid JSON" } }
```

```json
{
  "error": { "code": "generation_invalid_output", "message": "Model output didn't match the content schema" },
  "issues": [{ "path": "work.roles.0.id", "message": "Required" }]
}
```

Response `400`: `{ "error": { "code": "invalid_provider" | "invalid_request" | "resume_not_found", "message": "..." } }`
— `resume_not_found` covers both a bad id and an id that isn't a `kind: "resume"` upload owned by you.

Response `401` — two distinct codes, since they mean different things to the UI:

```json
{ "error": { "code": "byok_key_missing", "message": "Connect an Anthropic/OpenAI/Google API key first" } }
```

```json
{ "error": { "code": "byok_key_invalid", "message": "Your API key was rejected by the provider" } }
```

Response `502` (the provider's API itself failed — network error, 5xx, rate
limited on their end — distinct from anything about the key or our schema):

```json
{ "error": { "code": "llm_provider_error", "message": "..." } }
```

Response `429`: rate limited — see milestone 4.

A "succeeded" generation is recorded (starting the 48h resume-retention
clock) as soon as the LLM call itself completes, even if the output then
fails our schema validation — the resume has been used for an attempt
either way. Only a provider-call failure (`byok_key_invalid`,
`llm_provider_error`) records "failed."

---

## Milestone 4 — Rate limiting

Not a separate endpoint — behavior layered onto the above, from the same
rolling-hour check (`src/server/rate-limit.ts`). Documented here so the UI
knows what to expect and render (never to re-implement the limit itself):

- `POST /api/generate`: capped at 5/hour per account (our compute cost even
  though the LLM cost is the user's own key) — ✅ Shipped, built alongside
  milestone 3 rather than separately, since generate couldn't responsibly
  ship without it.
- `POST /api/uploads`: capped at 10/hour per account, separately from the
  above — ✅ Shipped (see milestone 2b).

Both return `429` with the same shape:
`{ "error": { "code": "rate_limited", "message": "...", "retryAfterSeconds": 1800 } }`.
`retryAfterSeconds` is computed from the oldest request in the current
rolling window, not a fixed reset time.

---

## Milestone 5 — Vercel OAuth + publish

Studio's **Save** (`PUT /api/content`) only ever updates the draft. Nothing
below is triggered by Save — only by an explicit Publish action.

**Verified 2026-09-17** against Vercel's official docs (previously an
unconfirmed guess): the OAuth authorize/token URLs and the Deployments API
files-by-SHA flow were both correct as implemented. One real gap the
verification pass did catch and fix: the token response's `team_id` (set
when the integration is installed on a Vercel Team rather than a personal
account) was never being captured or threaded through to later API calls —
every one of those needs it as a `teamId` query param or Vercel 403s. Fixed
in `vercel_connections.team_id` (migration `0004`) and every call in
`src/server/vercel/deploy.ts`. Still not exercised against live traffic (no
registered OAuth app in this environment) — only the shapes are confirmed,
not the actual request/response behavior.

### `GET /api/vercel/oauth/start` — ✅ Shipped

**Auth:** required. Redirects the browser into Vercel's OAuth consent screen.
Not a JSON endpoint — the UI should navigate the top-level window to this URL,
not `fetch()` it.

### `GET /api/vercel/oauth/callback` — ✅ Shipped

Vercel redirects back here with `code` + `state`. Requires an active session
whose user id matches the one embedded in `state` (a self-signed, 10-minute-
TTL token — no server-side session store needed for this). Exchanges the code
for a token (AES-256-GCM at rest, same scheme as BYOK keys), then redirects
the browser to `${APP_ORIGIN}/?vercel=connected` — a placeholder; Antigravity
owns the real "connected" landing page and can request a different redirect
target be made configurable if needed.

Response `400` (state missing/expired/mismatched): `{ "error": { "code": "invalid_oauth_state", "message": "..." } }`

Response `502` (Vercel's token endpoint rejected the exchange): `{ "error": { "code": "vercel_oauth_failed", "message": "..." } }`

### `GET /api/vercel/status` — ✅ Shipped

**Auth:** required. Response `200`:

```json
{ "connected": true, "vercelUsername": "suryavamshi", "connectedAt": "2026-09-13T00:00:00Z" }
```

or `{ "connected": false }` if never connected.

### `DELETE /api/vercel` — ✅ Shipped

**Auth:** required. Deletes our copy of the token; `204` always (idempotent —
also 204 if nothing was connected). Does **not** call Vercel to revoke the
token server-side (its exact revocation endpoint wasn't confirmed) — it
remains valid on Vercel's side until it expires or the user revokes it from
their own Vercel account settings. Deleting our copy is what actually
matters: we can no longer deploy on their behalf either way.

### `POST /api/publish` — ✅ Shipped

**Auth:** required. Requires Vercel connected.

Renders the user's current `Content` through the shared template
(`src/server/template/render.ts` — one static HTML file, embedded CSS, no
build step) into static HTML, copies any images that resolve to our own
Storage into the deploy bundle itself (external image URLs are left as
references — see `src/server/template/images.ts` for exactly what counts as
"ours"), and pushes the result via Vercel's Deployments API to the user's own
account. Marks the uploads whose bytes got embedded as `published: true`
(informational — see the retention cron's comments in
`0003_storage_cleanup.sql` for why this doesn't exempt them from anything).

Response `202` (deployment kicked off — this is not necessarily synchronous):

```json
{ "deploymentId": "dpl_uuid", "status": "queued" }
```

Response `409` (Vercel not connected):

```json
{ "error": { "code": "vercel_not_connected", "message": "Connect your Vercel account first" } }
```

Response `502` (Vercel's deployment API itself failed): `{ "error": { "code": "vercel_deploy_failed", "message": "..." } }`

### `GET /api/publish/status` — ✅ Shipped

**Auth:** required. Poll the last publish's status — a terminal state
(`ready`/`error`) is served from our own record; a non-terminal one
(`queued`/`building`) re-polls Vercel's API live and updates our record
before responding, so this is always current, not stale-until-next-webhook
(there's no webhook receiver in this phase).

Response `200`:

```json
{ "deploymentId": "dpl_uuid", "status": "ready", "url": "https://their-site.vercel.app", "finishedAt": "2026-09-13T00:03:00Z" }
```

`status` is one of `queued | building | ready | error`.

Response `404` (nothing published yet — not in the original stub, added
since it's the real first-call case): `{ "error": { "code": "no_publications", "message": "This account hasn't published yet" } }`

---

## Milestone 6 — Payments (Dodo Payments)

One-time lifetime "Pro" unlock — **not a subscription**, no renewal/coupon
logic exists or is planned. `GET /api/me`'s `plan` field (`"free"` | `"pro"`)
is the one thing that changes; what it gates is documented in `src/config/plans.ts`
(storage quota, generation/upload rate limits, and whether the published
template includes a small "Published with Shipfolio" badge — see
`src/server/template/render.ts`). Notably **not** gated: number of portfolios
— the schema only supports one portfolio per user, for everyone, so that
was dropped from the original pricing pitch once this was actually being
built; a real future feature, not a payments detail.

### `POST /api/billing/checkout` — ✅ Shipped

**Auth:** required. No request body.

Creates a Dodo hosted checkout session for the Pro unlock and returns its
URL — **not a redirect itself**; the UI does a top-level navigation to
`checkoutUrl` (same pattern as `GET /api/vercel/oauth/start`, just JSON
first since this needs the authenticated user's email before creating the
session). The actual plan flip does **not** happen here or from the
`return_url` redirect (a user could hit that without having paid, by
editing the URL) — only `POST /api/webhooks/dodo` flips `plan`, once Dodo
confirms the payment server-to-server.

Response `200`:

```json
{ "checkoutUrl": "https://test.checkout.dodopayments.com/session/cks_..." }
```

Response `400`: `{ "error": { "code": "email_required", "message": "..." } }` — no email on the Supabase Auth user.

Response `502`: `{ "error": { "code": "checkout_failed", "message": "..." } }` — Dodo's API itself rejected the request.

### `POST /api/webhooks/dodo` — ✅ Shipped (internal — not called by the UI)

Not part of the UI contract — Dodo calls this directly, server-to-server.
Documented here for completeness, since it's the only thing that actually
grants Pro.

Verifies the Standard Webhooks signature (`webhook-id`/`webhook-timestamp`/
`webhook-signature` headers, HMAC-SHA256 — see `src/lib/standard-webhooks.ts`,
generic to the open spec, not Dodo-specific) before trusting anything in the
body. On a valid `payment.succeeded` event: records a row in `purchases`
(idempotent — `dodo_payment_id` is unique, so a replayed webhook for the
same payment is a no-op, not a double-grant) and flips `users.plan` to
`"pro"`. Any other event type is acknowledged (`200`) and ignored — no
subscription/refund/dispute handling exists for this one-time,
non-recurring product.

Exempted from the global CSRF Origin check (`src/start.ts`) — every path
under `/api/webhooks/*` is, since these are never browser requests and have
no session cookie for CSRF to protect; authenticity comes from the
signature instead.

## Milestone 7 — Pre-launch waitlist

`VITE_LAUNCH_MODE` (`src/config/launch.ts`) is a client-visible toggle —
`"waitlist"` swaps every sign-up CTA on the landing page for an
email-capture form (`src/components/waitlist/WaitlistCta.tsx`); `"live"`
(the default) shows the real `/login` flow. Not a route guard — `/login`
and `/onboarding` still work if navigated to directly in either mode.

### `POST /api/waitlist` — ✅ Shipped

**Auth:** none — this exists precisely because there's no account yet.

Request body: `{ "email": string, "source"?: string }`.

Forwards to a Google Apps Script Web App (see README "Setup (Waitlist)"),
not Supabase — a waitlist is a marketing list someone wants to open in a
spreadsheet, not product data needing RLS or an admin UI. The shared
secret (`WAITLIST_WEBHOOK_SECRET`) is checked inside that script, not
here, so someone who finds the script's URL can't write rows directly.

Response `201`: `{ "ok": true }`.

Response `400`: `{ "error": { "code": "invalid_email", "message": "..." } }`.

Response `502`: `{ "error": { "code": "waitlist_webhook_failed" | "waitlist_webhook_unreachable", "message": "..." } }`
— `WAITLIST_WEBHOOK_URL`/`WAITLIST_WEBHOOK_SECRET` unset, or the Apps
Script itself rejected/errored.
