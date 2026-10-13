-- Retention cleanup for new tables added in milestone 6 / v2.
-- Enforces data retention rules via pg_cron.
-- See version2memory.md section 6.11 and handoff 07c.

-- ---------------------------------------------------------------------
-- 1. generation_jobs: delete rows finished (finished_at) > 30 days ago.
-- ---------------------------------------------------------------------

create or replace function public.purge_stale_generation_jobs()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.generation_jobs
  where finished_at is not null
    and finished_at < now() - interval '30 days';
end;
$$;

revoke execute on function public.purge_stale_generation_jobs() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. portfolio_versions: keep the newest 20 per user, delete the rest.
-- ---------------------------------------------------------------------

create or replace function public.purge_old_portfolio_versions()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.portfolio_versions pv
  where pv.id in (
    select id
    from (
      select id,
             row_number() over (partition by user_id order by created_at desc) as rn
      from public.portfolio_versions
    ) ranked
    where rn > 20
  );
end;
$$;

revoke execute on function public.purge_old_portfolio_versions() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. mcp_tokens: delete rows whose expires_at is > 1 day in the past.
--    mcp_clients: delete clients older than 7 days that have no tokens.
-- ---------------------------------------------------------------------

create or replace function public.purge_expired_mcp_tokens_and_clients()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Delete expired tokens older than 1 day past expires_at
  delete from public.mcp_tokens
  where expires_at < now() - interval '1 day';

  -- Delete clients older than 7 days that have no tokens left
  delete from public.mcp_clients c
  where c.created_at < now() - interval '7 days'
    and not exists (
      select 1 from public.mcp_tokens t
      where t.client_id = c.client_id
    );
end;
$$;

revoke execute on function public.purge_expired_mcp_tokens_and_clients() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. sites: for rows with status = 'unpublished' and updated_at > 30 days ago:
--    delete the files under sites/{slug}/ in Storage and then the row.
-- ---------------------------------------------------------------------

create or replace function public.purge_unpublished_sites()
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_site record;
  v_paths text[];
begin
  for v_site in
    select slug
    from public.sites
    where status = 'unpublished'
      and updated_at < now() - interval '30 days'
  loop
    -- Gather all Storage object paths for this site's slug
    select coalesce(array_agg(o.name), array[]::text[]) into v_paths
    from storage.objects o
    where o.bucket_id = 'sites'
      and o.name like v_site.slug || '/%';

    -- Trigger asynchronous storage object purge via edge function
    if array_length(v_paths, 1) is not null and array_length(v_paths, 1) > 0 then
      perform public.notify_storage_purge('sites', v_paths);
    end if;

    -- Delete the site row
    delete from public.sites
    where slug = v_site.slug
      and status = 'unpublished'
      and updated_at < now() - interval '30 days';
  end loop;
end;
$$;

revoke execute on function public.purge_unpublished_sites() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. provider_budgets: delete rows older than 7 days.
-- ---------------------------------------------------------------------

create or replace function public.purge_stale_provider_budgets()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.provider_budgets
  where day < (current_date - 7);
end;
$$;

revoke execute on function public.purge_stale_provider_budgets() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Cron schedules: staggered daily execution between 03:15 and 03:45 UTC
-- ---------------------------------------------------------------------

select cron.schedule('purge-stale-generation-jobs', '15 3 * * *', 'select public.purge_stale_generation_jobs();');
select cron.schedule('purge-old-portfolio-versions', '20 3 * * *', 'select public.purge_old_portfolio_versions();');
select cron.schedule('purge-expired-mcp-tokens', '25 3 * * *', 'select public.purge_expired_mcp_tokens_and_clients();');
select cron.schedule('purge-unpublished-sites', '35 3 * * *', 'select public.purge_unpublished_sites();');
select cron.schedule('purge-stale-provider-budgets', '45 3 * * *', 'select public.purge_stale_provider_budgets();');
