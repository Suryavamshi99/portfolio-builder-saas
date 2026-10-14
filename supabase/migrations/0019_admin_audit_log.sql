create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  action text not null,
  target_type text not null check (target_type in ('user', 'site', 'domain', 'job', 'provider', 'mcp', 'system')),
  target_id text,
  reason text,
  detail jsonb not null default '{}'::jsonb,
  actor_hash text
);
create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
create index admin_audit_log_target_idx on public.admin_audit_log (target_type, target_id);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon, authenticated;
