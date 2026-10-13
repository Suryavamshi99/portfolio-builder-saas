# Handoff 06b: Push the portfolio to GitHub (GitHub App)

**Worktree / branch:** `/Users/suryavamshi/portfolio-builder-saas-06b` on `feat/06b-github-push`.
**Rules:** `docs/handoffs/_rules.md` (read first). **Plan:** `version2memory.md` sections 6.10 and 6.12.
**Migration number:** `0014_github_connections_exports.sql`.
**Reviewer:** Claude Code reviews this line by line (it handles tokens and a user's repository).

## Design decisions (final, don't revisit)
- A **GitHub App** with Repository permission *Contents: read & write* (and Metadata: read). The user installs it **on a repository they already created** (empty or not). We do **not** create repositories (an installation token can't create repos on a personal account).
- v1 has no GitHub Pages toggle and no pull requests: each push is a plain new commit on the default branch.
- Paid feature: `hasPaidAccess()` on the server (returns 402).

## Env (add to `.env.example`)
`GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY` (the PEM, with `\n` escaped in one line; unescape when reading).

## Task A: Migration `supabase/migrations/0014_github_connections_exports.sql`
```sql
create table public.github_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  installation_id bigint not null,
  account_login text not null,
  created_at timestamptz not null default now()
);
create table public.exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('zip', 'html', 'github', 'vercel')),
  detail text,
  created_at timestamptz not null default now()
);
create index exports_user_created_idx on public.exports (user_id, created_at desc);
alter table public.github_connections enable row level security;
alter table public.exports enable row level security;
revoke all on public.github_connections from anon, authenticated;
revoke all on public.exports from anon, authenticated;
```
Write exactly this. **Do not apply it.**

## Task B: `src/server/github/app.ts`
- `createAppJwt(now?: number): string`: RS256 JWT with `iss = GITHUB_APP_ID`, `iat = now-60`, `exp = now+540`, signed with `node:crypto` (`createSign("RSA-SHA256")`), base64url, no dependency.
- `getInstallationToken(installationId: number): Promise<string>`: `POST https://api.github.com/app/installations/{id}/access_tokens` with the app JWT (`Authorization: Bearer`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`). Not cached; throws `GithubError` (exported class with `status`) on non-2xx.
- `getInstallation(installationId)`: `GET /app/installations/{id}` with the JWT → `{ account_login }`. Used to confirm an installation id from the callback really belongs to our app.
- `installUrl(state)`: `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new?state=<state>`.

## Task C: `src/server/github/push.ts`
```ts
export async function pushSiteToRepo(opts: {
  token: string; repo: string /* "owner/name" */; files: Record<string, Buffer | string>;
  branch?: string; message: string;
}): Promise<{ commitUrl: string; branch: string; created: boolean }>;
```
- Validate `repo` against `^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$` (throw before any request).
- `GET /repos/{repo}` → default branch (use `opts.branch` only if it equals the default branch; otherwise ignore). Needs the token to have access to this repo; 404/403 → throw `GithubError` with a message "The Shipfolio app isn't installed on that repository".
- If the repo is **empty** (`GET /repos/{repo}/git/ref/heads/{branch}` → 404/409): create the first commit through the Contents API (`PUT /repos/{repo}/contents/index.html`, base64, branch default) then continue below for the remaining files with the normal flow. If there is only `index.html`, stop after it.
- Normal flow (Git Data API): get the branch head commit and its tree → `POST git/blobs` for each file (`encoding: "base64"`) → `POST git/trees` with `base_tree` and one entry per file (`mode: "100644"`) → `POST git/commits` (parents = [head]) → `PATCH git/refs/heads/{branch}` (`force: false`). Return the commit's `html_url`.
- File paths must not start with `/`, contain `..`, or be empty (throw).
- Never log tokens. All requests via a small `gh(token, method, path, body)` helper.

## Task D: Routes (`src/routes/api/github/` and `src/routes/api/export/github.ts`)
- `GET /api/github/status` → `{ connected: boolean, account: string | null, installUrl: string }`. `installUrl` is built with a `state` that is a **signed, expiring** value containing the user id (copy how `src/routes/api/vercel/oauth/` creates and checks its `state`; reuse its helper if there is one).
- `GET /api/github/callback?installation_id=&state=` → verify the state (user must match the session user; reject expired/forged), call `getInstallation(installation_id)` to confirm it is ours, upsert `github_connections` (admin client, `user_id` from the session), then redirect to `/studio?github=connected`. Any failure redirects to `/studio?github_error=<code>` (same style as `vercel_error`).
- `POST /api/export/github` body `{ repo: string }` → 402 if not `hasPaidAccess`; 400 `github_not_connected` if no `github_connections` row; load `generated_html`; build files **exactly like `src/routes/api/export/zip.ts`** (`embedStorageImagesInHtml(html, supabase, user.id)` → `sanitizeHtmlForServing` with the `UnstableHtmlError` → 422 handling → `index.html` + `images/*` + `README.txt`); `getInstallationToken` → `pushSiteToRepo`; insert an `exports` row (`kind: "github"`, `detail: repo`); respond `{ commitUrl, repo }`. Map `GithubError` 404/403 → 400 `github_repo_unavailable` with its message; other failures → 502 `github_error`. Rate limit nothing extra.
- Also insert an `exports` row (`kind: "zip"` / `"html"`) in `src/routes/api/export/zip.ts` and `html.ts` after a successful response is built. These are the only edits allowed in those two files.

## Task E: Tests
`src/server/github/app.test.ts` (JWT header/claims/signature verifies with the matching public key generated in the test; token endpoint success/failure), `push.test.ts` (mock `fetch`: normal flow order and payloads; empty-repo flow; repo/path validation; 403/404 message), `src/routes/api/github/state.test.ts` only if you add a state helper. Never assert on a real network call.

## Out of scope
UI (handoff 06c builds the Studio buttons against these routes), Pages, PRs, creating repos, `src/routes/api/publish.ts`, other migrations.

## Handoff report
