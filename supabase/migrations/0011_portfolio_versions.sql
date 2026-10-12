create table public.portfolio_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  html text not null,
  source text not null check (source in ('gemini', 'free', 'mcp')),
  model text,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index portfolio_versions_user_created_idx
  on public.portfolio_versions (user_id, created_at desc);

alter table public.portfolio_versions enable row level security;

-- No policies and no grants: only the service-role client (server routes)
-- reads or writes versions. See 0010 for why table-level privileges are revoked.
revoke all on public.portfolio_versions from anon, authenticated;
