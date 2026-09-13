-- Retention policy, enforced by pg_cron (no extra service needed).
-- See the project brief's retention section for the rules being encoded here.

create extension if not exists pg_cron with schema extensions;

-- ---------------------------------------------------------------------
-- Rule 1: resumes + visual-reference screenshots are deleted within 48h
-- of a SUCCESSFUL generation, regardless of publish status — nothing on
-- a live site ever references them after generation.
-- ---------------------------------------------------------------------

-- NOTE: superseded by 0003_storage_cleanup.sql, which redefines both purge
-- functions below (via `create or replace`) to also delete the matching
-- Storage object, not just the row. Left as originally written here for
-- history; read 0003 for what actually runs.

create or replace function public.purge_post_generation_uploads()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.uploads u
  using public.generations g
  where u.kind in ('resume', 'visual_reference')
    and g.status = 'succeeded'
    and g.created_at < now() - interval '48 hours'
    and (u.id = g.resume_upload_id or u.user_id = g.user_id and u.kind = 'visual_reference');
end;
$$;

-- ---------------------------------------------------------------------
-- Rule 2: profile/project/certification images on an unpublished or
-- abandoned draft are deleted after 30 days of inactivity. `published`
-- must be false — a currently-published site's images are never
-- auto-deleted while live.
-- ---------------------------------------------------------------------

create or replace function public.purge_stale_draft_uploads()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.uploads u
  using public.portfolios p
  where u.kind in ('photo', 'project_image')
    and u.published = false
    and u.user_id = p.user_id
    and p.updated_at < now() - interval '30 days';
end;
$$;

-- ---------------------------------------------------------------------
-- Warning log for rule 2, a few days before deletion. This only records
-- that a warning is due — actually sending the email is a separate,
-- not-yet-built worker (no email provider has been chosen yet). Do not
-- treat a row here as "email sent."
-- ---------------------------------------------------------------------

create table public.upload_deletion_warnings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  queued_at timestamptz not null default now()
);

create or replace function public.queue_stale_draft_warnings()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.upload_deletion_warnings (user_id)
  select distinct u.user_id
  from public.uploads u
  join public.portfolios p on p.user_id = u.user_id
  where u.kind in ('photo', 'project_image')
    and u.published = false
    and p.updated_at < now() - interval '27 days'
    and p.updated_at >= now() - interval '28 days'
  on conflict (user_id) do nothing;
end;
$$;

select cron.schedule('purge-post-generation-uploads', '0 * * * *', 'select public.purge_post_generation_uploads();');
select cron.schedule('purge-stale-draft-uploads', '0 3 * * *', 'select public.purge_stale_draft_uploads();');
select cron.schedule('queue-stale-draft-warnings', '0 4 * * *', 'select public.queue_stale_draft_warnings();');
