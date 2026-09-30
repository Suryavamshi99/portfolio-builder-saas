-- Closes two retention gaps found while investigating why uploads were
-- observed sitting in Storage indefinitely (see also the app_config setup
-- note in 0003_storage_cleanup.sql — the cron below is necessary but not
-- sufficient without that one-time deploy step):
--
-- Gap A: a resume/visual_reference upload that the user never turned into a
-- successful generation (abandoned mid-onboarding) had no matching
-- `generations` row, so purge_post_generation_uploads' join never touched
-- it — it lived forever regardless of the 48h retention promise shown in
-- the UI.
--
-- Gap B: a photo/project_image upload from a user who never reached a
-- successful generation had no `portfolios` row yet (that row is only
-- created on first successful generation), so purge_stale_draft_uploads'
-- join never touched it either — same "lives forever" problem for the
-- 30-day rule.
--
-- Both are extended below to also purge on the upload's own age when no
-- matching generation/portfolio row exists at all, while leaving the
-- original "used" timing (measured from the generation/portfolio, not the
-- upload) completely unchanged.

create or replace function public.purge_post_generation_uploads()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paths text[];
begin
  select array_agg(path) into v_paths from (
    -- Original rule: tied to a generation that succeeded 48h+ ago.
    select u.storage_path as path
    from public.uploads u
    join public.generations g on g.status = 'succeeded' and g.created_at < now() - interval '48 hours'
    where u.kind in ('resume', 'visual_reference')
      and (u.id = g.resume_upload_id or (u.user_id = g.user_id and u.kind = 'visual_reference'))
    union
    -- Gap A: never used in any successful generation, abandoned 48h+ ago.
    select u.storage_path as path
    from public.uploads u
    where u.kind in ('resume', 'visual_reference')
      and u.created_at < now() - interval '48 hours'
      and not exists (
        select 1 from public.generations g2
        where g2.user_id = u.user_id and g2.status = 'succeeded'
      )
  ) unioned;

  perform public.notify_storage_purge('uploads', v_paths);

  delete from public.uploads u
  where u.kind in ('resume', 'visual_reference')
    and (
      exists (
        select 1 from public.generations g
        where g.status = 'succeeded'
          and g.created_at < now() - interval '48 hours'
          and (u.id = g.resume_upload_id or (u.user_id = g.user_id and u.kind = 'visual_reference'))
      )
      or (
        u.created_at < now() - interval '48 hours'
        and not exists (
          select 1 from public.generations g2 where g2.user_id = u.user_id and g2.status = 'succeeded'
        )
      )
    );
end;
$$;

create or replace function public.purge_stale_draft_uploads()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paths text[];
begin
  select array_agg(path) into v_paths from (
    -- Original rule: draft inactive 30d+, measured from the portfolio row.
    select u.storage_path as path
    from public.uploads u
    join public.portfolios p on p.user_id = u.user_id
    where u.kind in ('photo', 'project_image')
      and p.updated_at < now() - interval '30 days'
    union
    -- Gap B: no portfolio row exists yet (never generated) — measure from
    -- the upload's own age instead.
    select u.storage_path as path
    from public.uploads u
    where u.kind in ('photo', 'project_image')
      and u.created_at < now() - interval '30 days'
      and not exists (select 1 from public.portfolios p2 where p2.user_id = u.user_id)
  ) unioned;

  perform public.notify_storage_purge('uploads', v_paths);

  delete from public.uploads u
  where u.kind in ('photo', 'project_image')
    and (
      exists (
        select 1 from public.portfolios p
        where p.user_id = u.user_id and p.updated_at < now() - interval '30 days'
      )
      or (
        u.created_at < now() - interval '30 days'
        and not exists (select 1 from public.portfolios p2 where p2.user_id = u.user_id)
      )
    );
end;
$$;
