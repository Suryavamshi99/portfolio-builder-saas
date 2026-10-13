# Handoff 07a: Settings page: connected apps, GitHub, custom domain

**Worktree / branch:** `/Users/suryavamshi/portfolio-builder-saas-07a` on `feat/07a-settings-ui` (based on the merged integration branch).
**Rules:** `docs/handoffs/_rules.md` (read first). UI only, no migrations. You may edit `src/routes/settings.tsx`, add components under `src/components/settings/`, and extend `src/lib/api-client.ts`.

## Task: three new sections on Settings (match the existing section style)
1. **Connected apps** (Claude / ChatGPT): `GET /api/mcp/status` → `{ connected, connections: [{ clientId, name, connectedAt }], latestJob }`. List each connection (name, "connected <relative date>") with a **Disconnect** button (confirm) → `DELETE /api/mcp/connections/:clientId` → `{ ok: true }`, then reload the list. Empty state: "Not connected. Connect Claude or ChatGPT" linking to `/connect`.
2. **GitHub**: `GET /api/github/status` → `{ connected, account, installUrl }`. Shows "Connected as <account>" or a **Connect GitHub** button (`installUrl`). Show the `?github=connected` / `?github_error=<code>` result as a banner (codes: `invalid_state`, `invalid_installation`, `not_your_installation` → "That GitHub installation isn't yours", `installation_failed`, `save_failed`).
3. **Custom domain** (paid): contract from `docs/handoffs/06e-custom-domains.md` (Task D): `GET /api/domains`, `POST /api/domains {hostname}`, `POST /api/domains/verify`, `DELETE /api/domains`. States: no domain → input + Add; `pending` → show the TXT record (type, name, value, copy buttons), a **Verify now** button and the plain-language message from the response; `verified`/`live` → show the A/CNAME records from `dns` with copy buttons, a status badge (Verified / Live) and **Remove**. Free users see the section with an Upgrade prompt (402). Poll `GET /api/domains` every 15 s while `pending`/`verified` and the section is visible.

All API calls go through `src/lib/api-client.ts` with TypeScript types. A 404 (endpoint not deployed yet) shows "Coming soon", never an error. Tests for the client functions and any pure helpers (mock `fetch`). Check at desktop and 390 px width if you have a browser tool.

## Out of scope
Anything under `src/server/` or `src/routes/api/`, migrations.

## Handoff report
