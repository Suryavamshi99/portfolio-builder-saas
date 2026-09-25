-- Admin exemption flag — Studio always unlocked, deploy never requires
-- payment. Settable only via the service-role client (the /admin panel,
-- src/routes/api/admin/users.$id.ts), never by a user's own session.

alter table public.users add column is_admin boolean not null default false;

-- RLS's "users can update their own row" policy (0001_init.sql) governs
-- which ROWS a user's session can touch, not which COLUMNS within an
-- allowed row. Without this, any authenticated user could PATCH their own
-- `plan` straight to 'pro' via a direct Supabase REST call — bypassing
-- Dodo payment entirely — since RLS alone doesn't stop that. Column-level
-- privileges are the actual boundary here. This closes that gap for
-- `plan` (pre-existing, only ever meant to be set by the Dodo webhook) and
-- covers `is_admin` the same way from day one.
revoke update (plan, is_admin) on public.users from authenticated;
