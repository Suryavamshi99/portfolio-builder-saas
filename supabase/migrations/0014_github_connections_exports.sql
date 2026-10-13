create table public.github_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  installation_id bigint not null,
  account_login text not null,
  created_at timestamptz not null default now()
);
create table public.exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('zip', 'html', 'github', 'vercel')),
  detail text,
  created_at timestamptz not null default now()
);
create index exports_user_created_idx on public.exports (user_id, created_at desc);
alter table public.github_connections enable row level security;
alter table public.exports enable row level security;
revoke all on public.github_connections from anon, authenticated;
revoke all on public.exports from anon, authenticated;
