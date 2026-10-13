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

### Files changed
- `supabase/migrations/0018_retention_new_tables.sql`: New migration defining pg_cron maintenance functions and scheduled daily jobs for the tables introduced in v2 / milestone 6 (`generation_jobs`, `portfolio_versions`, `mcp_tokens`, `mcp_clients`, `sites`, `provider_budgets`).

### Changes made
1. `purge_stale_generation_jobs()`:
   Deletes rows from `public.generation_jobs` where `finished_at is not null and finished_at < now() - interval '30 days'`.
2. `purge_old_portfolio_versions()`:
   Retains the newest 20 versions per `user_id` using window function ranking (`row_number() over (partition by user_id order by created_at desc)`) and deletes versions with rank > 20.
3. `purge_expired_mcp_tokens_and_clients()`:
   Deletes rows from `public.mcp_tokens` where `expires_at < now() - interval '1 day'`.
   Deletes clients from `public.mcp_clients` where `created_at < now() - interval '7 days'` and no tokens exist for that `client_id`.
4. `purge_unpublished_sites()`:
   Iterates through sites where `status = 'unpublished' and updated_at < now() - interval '30 days'`, gathers file object paths in bucket `sites` matching `{slug}/%` from `storage.objects`, dispatches `public.notify_storage_purge('sites', paths)` if objects exist, and deletes the `sites` record.
5. `purge_stale_provider_budgets()`:
   Deletes rows from `public.provider_budgets` where `day < (current_date - 7)`.
6. Privileges & Schedules:
   All functions are created `security definer set search_path = public` (or `set search_path = public, storage`), and `revoke execute ... from public, anon, authenticated` is applied to each function.
   Schedules are staggered between 03:15 and 03:45 UTC:
   - `15 3 * * *`: `purge-stale-generation-jobs`
   - `20 3 * * *`: `purge-old-portfolio-versions`
   - `25 3 * * *`: `purge-expired-mcp-tokens`
   - `35 3 * * *`: `purge-unpublished-sites`
   - `45 3 * * *`: `purge-stale-provider-budgets`

### How to verify (manual verification queries)
The migration was not applied against the live database, and SQL has no automated test runner in this repository. Once applied in a staging/test environment, the predicates can be verified with the following SQL queries against test rows:

1. `generation_jobs`:
```sql
-- Target rows to delete:
select id, user_id, status, finished_at
from public.generation_jobs
where finished_at is not null
  and finished_at < now() - interval '30 days';
```

2. `portfolio_versions`:
```sql
-- Target rows to delete (ranked > 20 per user):
select id, user_id, created_at, rn
from (
  select id, user_id, created_at,
         row_number() over (partition by user_id order by created_at desc) as rn
  from public.portfolio_versions
) ranked
where rn > 20;
```

3. `mcp_tokens` and `mcp_clients`:
```sql
-- Target tokens to delete:
select id, client_id, kind, expires_at
from public.mcp_tokens
where expires_at < now() - interval '1 day';

-- Target orphaned clients to delete:
select c.client_id, c.created_at
from public.mcp_clients c
where c.created_at < now() - interval '7 days'
  and not exists (
    select 1 from public.mcp_tokens t
    where t.client_id = c.client_id
  );
```

4. `sites` and storage files:
```sql
-- Target unpublished sites to delete:
select slug, user_id, status, updated_at
from public.sites
where status = 'unpublished'
  and updated_at < now() - interval '30 days';

-- Target storage files queued for purge:
select o.bucket_id, o.name
from storage.objects o
join public.sites s on o.name like s.slug || '/%'
where o.bucket_id = 'sites'
  and s.status = 'unpublished'
  and s.updated_at < now() - interval '30 days';
```

5. `provider_budgets`:
```sql
-- Target budget rows to delete:
select provider, day, used
from public.provider_budgets
where day < (current_date - 7);
```

### Security rule verification
All maintenance functions have security-definer execution and explicit privilege revocation:
```sql
revoke execute on function public.purge_stale_generation_jobs() from public, anon, authenticated;
revoke execute on function public.purge_old_portfolio_versions() from public, anon, authenticated;
revoke execute on function public.purge_expired_mcp_tokens_and_clients() from public, anon, authenticated;
revoke execute on function public.purge_unpublished_sites() from public, anon, authenticated;
revoke execute on function public.purge_stale_provider_budgets() from public, anon, authenticated;
```

### Anything done differently and why
None. Followed the exact patterns established in `0002_retention_cron.sql`, `0003_storage_cleanup.sql`, and `0008_purge_orphaned_uploads.sql`.

### Open questions
None.
