-- Column-level REVOKE (0006) is a no-op while the table-wide grant Supabase
-- gives `authenticated` exists. Replace table-wide privileges with explicit ones.

-- users: a session may only create/touch its own row's id (getOrCreateAppUser's
-- upsert). plan and is_admin are written only by the service role
-- (Dodo webhook, /admin).
revoke insert, update on public.users from anon, authenticated;
grant insert (id), update (id) on public.users to authenticated;

-- portfolios: no direct access at all. Every read/write goes through server
-- routes using the service-role client scoped to the session's user id, so the
-- clean HTML never reaches a free user and unchecked HTML can't be stored.
revoke all on public.portfolios from anon, authenticated;
