# Rules for every handoff (read first)

- Work **only** in your own worktree folder named in your handoff; run `npm ci` there first. Never open or edit `/Users/suryavamshi/portfolio-builder-saas` (Claude Code works there).
- Change **only** the files your handoff lists. New files are fine inside your listed folders. Don't reformat, rename or refactor anything else. If a listed rule looks wrong, write it under "open questions" in your report; don't work around it.
- Migrations: use **only** the number your handoff names. **Never apply a migration** (Claude Code applies it after review). Every new table: `enable row level security`, then `revoke all on <table> from anon, authenticated;`, no policies (only the service-role client touches it; see `0011_portfolio_versions.sql` and `0012_resume_texts.sql`). Never rely on a column-level REVOKE.
- Routes: copy the pattern of `src/routes/api/export/zip.ts` (`authMiddleware`, `AuthedContext`, `{ error: { code, message } }`, server-side `hasPaidAccess()` where the handoff says so). Service-role client only with `user.id` from the session, never from the request.
- Env vars are read inside handlers only (never at module scope); add each new one to `.env.example`.
- No new dependencies unless the handoff names one. Match existing style; comments only where the "why" isn't obvious.
- Tests: vitest, next to the code; assert on outputs (returned values, HTML strings, recorded DB calls), not on internal calls. Security rules need a test each.
- Done = in your folder: `npx tsc --noEmit -p .`, `npm run lint` (0 errors), `npx vitest run`, `npm run build` all pass, and `git diff main --stat` shows only your listed files.
- Commit on your branch (one commit per task is fine). **Don't push, merge, rebase or open a PR.** Don't touch the untracked files `brag-output/`, `showreel/`, `LAUNCH_VIDEO.md`, `.agents/`, `.claude/skills/brag-slim`, `skills-lock.json`.
- Finish by appending a **"Handoff report"** to your handoff file: files changed, tests, anything done differently and why, open questions. Every claim must match the code (quote changed lines for anything security-related). Also **do not write a separate log file**.
- **No accounts, data or test traffic on production without the owner's approval.** Test against local code or mocks. If a handoff truly needs a live account, use a throwaway address on a domain you control (never a stranger's real address, never a public temp-mail service), prefix it `shipfolio-livecheck-`, list it in your report, and delete it (and its storage files) before you finish.
- Never read, copy or use browser cookies, saved passwords or tokens that were not given to you for this task.
