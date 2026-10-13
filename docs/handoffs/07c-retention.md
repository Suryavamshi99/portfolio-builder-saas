# Handoff 07c: Retention clean-up for the new tables

**Worktree / branch:** `/Users/suryavamshi/portfolio-builder-saas-07c` on `feat/07c-retention` (based on the merged integration branch).
**Rules:** `docs/handoffs/_rules.md` (read first). **Plan:** `version2memory.md` section 6.11. **Migration number:** `0018_retention_new_tables.sql`. **Do not apply it.**
**Read first:** `supabase/migrations/0002_retention_cron.sql`, `0003_storage_cleanup.sql` (how `notify_storage_purge` and the cron jobs work), `0008_purge_orphaned_uploads.sql`.

## Task: one migration with pg_cron jobs (same style as 0002/0003)
1. `generation_jobs`: delete rows finished (`finished_at`) more than 30 days ago. Daily.
2. `portfolio_versions`: keep the newest 20 per user (belt and braces; the app prunes on save): delete the rest. Daily.
3. `mcp_tokens`: delete rows whose `expires_at` is more than 1 day in the past. Daily. (`mcp_clients` with no tokens and older than 7 days: delete.)
4. `sites`: for rows with `status = 'unpublished'` and `updated_at` older than 30 days: delete the files under `sites/{slug}/` in Storage and then the row. Use `notify_storage_purge('sites', paths)` the way 0003 does for `uploads`; list the paths with `storage.objects` (`bucket_id = 'sites' and name like slug || '/%'`). Daily.
5. `provider_budgets`: delete rows older than 7 days. Daily.
All functions `security definer` with `set search_path = public`, `revoke execute ... from public, anon, authenticated`. Stagger the schedules (03:15–03:45 UTC).

## Tests
SQL has no test runner here: add a short "How to verify" section to your report with the exact `select` statements that prove each job's predicate (against sample rows) and say you could not run them. Do not touch application code.

## Handoff report
