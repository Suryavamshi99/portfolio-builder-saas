-- Closes the gap left in 0002_retention_cron.sql: the purge functions there
-- only deleted the `public.uploads` row, never the actual Storage object,
-- since SQL alone can't call the Storage API. This wires that call through
-- pg_net to the `purge-storage-objects` Edge Function
-- (supabase/functions/purge-storage-objects/index.ts).

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------
-- Config the cron functions need at runtime: the deployed Edge Function's
-- URL and a shared secret it checks (see that function's own auth note).
-- Both depend on this specific Supabase project, so they can't be baked
-- into a portable migration — populate them once, manually, after
-- deploying the function:
--
--   insert into public.app_config (key, value) values
--     ('purge_edge_function_url', 'https://<project-ref>.supabase.co/functions/v1/purge-storage-objects'),
--     ('purge_cron_secret', '<same value passed to `supabase secrets set CRON_SECRET=...`>');
--
-- RLS is enabled with NO policies — this table is reachable only from
-- security-definer SQL functions (below), never from PostgREST/the app.
-- ---------------------------------------------------------------------

create table public.app_config (
  key text primary key,
  value text not null
);

alter table public.app_config enable row level security;

create or replace function public.notify_storage_purge(p_bucket text, p_paths text[])
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_secret text;
begin
  if array_length(p_paths, 1) is null then
    return;
  end if;

  select value into v_url from public.app_config where key = 'purge_edge_function_url';
  select value into v_secret from public.app_config where key = 'purge_cron_secret';

  if v_url is null or v_secret is null then
    raise warning 'notify_storage_purge: app_config missing purge_edge_function_url/purge_cron_secret — skipping % paths in bucket %', array_length(p_paths, 1), p_bucket;
    return;
  end if;

  -- Fire-and-forget: pg_net queues the request and returns immediately: this
  -- is best-effort cleanup, not a transactional guarantee. A failed call
  -- leaves an orphaned Storage object with no DB row pointing at it — safe
  -- (nothing references it), just not immediately reclaimed. Inspect
  -- `net._http_response` to debug a failed run.
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := jsonb_build_object('bucket', p_bucket, 'paths', to_jsonb(p_paths))
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Redefine both purge functions to notify Storage cleanup before deleting
-- the row that pointed at it.
-- ---------------------------------------------------------------------

create or replace function public.purge_post_generation_uploads()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paths text[];
begin
  select array_agg(u.storage_path) into v_paths
  from public.uploads u
  join public.generations g on g.status = 'succeeded' and g.created_at < now() - interval '48 hours'
  where u.kind in ('resume', 'visual_reference')
    and (u.id = g.resume_upload_id or u.user_id = g.user_id and u.kind = 'visual_reference');

  perform public.notify_storage_purge('uploads', v_paths);

  delete from public.uploads u
  using public.generations g
  where u.kind in ('resume', 'visual_reference')
    and g.status = 'succeeded'
    and g.created_at < now() - interval '48 hours'
    and (u.id = g.resume_upload_id or u.user_id = g.user_id and u.kind = 'visual_reference');
end;
$$;

-- Milestone 5 correction: `published` does NOT gate this purge (0001/0002's
-- original comments claimed it would, before publish existed to clarify the
-- intent). Per the brief: publish copies image bytes into the Vercel deploy
-- bundle, so the live site never depends on this Storage object staying
-- populated — at that point our copy is "just a working copy for future
-- edits," safe to fall under the same 30-day inactivity rule as an
-- unpublished draft. `published` is still recorded (informational — "this
-- made it into a deploy"), just not read here.
create or replace function public.purge_stale_draft_uploads()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paths text[];
begin
  select array_agg(u.storage_path) into v_paths
  from public.uploads u
  join public.portfolios p on p.user_id = u.user_id
  where u.kind in ('photo', 'project_image')
    and p.updated_at < now() - interval '30 days';

  perform public.notify_storage_purge('uploads', v_paths);

  delete from public.uploads u
  using public.portfolios p
  where u.kind in ('photo', 'project_image')
    and u.user_id = p.user_id
    and p.updated_at < now() - interval '30 days';
end;
$$;
