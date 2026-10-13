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

### Files changed / created
- `src/lib/api-client.ts`: Extended with TypeScript types (`McpConnection`, `McpStatusResponse.connections`, `CustomDomain`, `DomainVerifyRecord`, `DomainDnsRecords`, `GetDomainsResponse`, `VerifyDomainResponse`) and client methods (`disconnectMcpConnection`, `getDomains`, `addDomain`, `verifyDomain`, `deleteDomain`, `getGitHubStatus`). Handles 404 cleanly by throwing `ApiError` with `isNotFound = true` and `message = "Coming soon"`.
- `src/lib/api-client.test.ts`: Added unit tests verifying API calls with mock `fetch` for `disconnectMcpConnection`, `getDomains`, `addDomain`, `verifyDomain`, `deleteDomain`, and `getGitHubStatus`.
- `src/lib/date.ts`: Pure helper function `formatRelativeDate` to display relative time format ("connected <relative date>").
- `src/lib/date.test.ts`: Vitest unit tests verifying `formatRelativeDate` across all intervals and invalid date fallbacks.
- `src/components/settings/github-errors.ts`: Error code mapping and message helper for GitHub callback error codes (`invalid_state`, `invalid_installation`, `not_your_installation` -> "That GitHub installation isn't yours", `installation_failed`, `save_failed`).
- `src/components/settings/github-errors.test.ts`: Vitest unit tests verifying GitHub error message mapping.
- `src/components/settings/ConnectedAppsSection.tsx`: Component rendering the Connected Apps section for Claude/ChatGPT with connection list, relative timestamps, disconnect confirmation dialog, empty state linking to `/connect`, and coming soon state on 404.
- `src/components/settings/GitHubSection.tsx`: Component rendering GitHub integration status, `?github=connected` / `?github_error=<code>` banner handling, "Connected as <account>", Connect GitHub button (`installUrl`), and coming soon state on 404.
- `src/components/settings/CustomDomainSection.tsx`: Component rendering Custom Domain configuration for paid users and upgrade prompt for free users (or on 402). Supports no domain (add form), `pending` (TXT verification record table with copy buttons and Verify now button), `verified`/`live` (A/CNAME DNS records with copy buttons, status badge, remove dialog), and 15s polling while pending/verified.
- `src/routes/settings.tsx`: Integrated the 3 new sections as dedicated tabs (`domains`, `github`, `apps`) alongside existing tabs, matching existing section and tab styling. Updated search params validation for `github` and `github_error`.

### Tests
- `src/lib/api-client.test.ts`: 13 passing unit tests verifying client methods and 404 handling.
- `src/lib/date.test.ts`: 8 passing unit tests for relative date calculations.
- `src/components/settings/github-errors.test.ts`: 2 passing unit tests for error code resolution.
- Full vitest suite: 23 test files, 239 tests passing (`npx vitest run`).
- TypeScript check: 0 errors (`npx tsc --noEmit -p .`).
- Lint check: 0 errors (`npm run lint`).
- Production build: Succeeded (`npm run build`).

### Anything done differently and why
- Extracted `formatRelativeDate` and `github-errors.ts` into pure tested modules so their formatting and error resolution logic is decoupled and fully testable without mounting DOM components.
- Supported both direct API 402 status codes and user record plan checking (`userRecord?.plan !== "pro"`) so the Custom Domains upgrade CTA displays reliably for free tier users regardless of whether `/api/domains` is deployed yet or returns 402.

### Open questions
- None. All contracts from `docs/handoffs/07a-settings-ui.md` and `docs/handoffs/06e-custom-domains.md` Task D are implemented and verified.
