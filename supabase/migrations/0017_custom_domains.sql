create table public.custom_domains (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  hostname text not null unique check (hostname = lower(hostname)),
  status text not null default 'pending' check (status in ('pending', 'verified', 'live')),
  verify_token text not null,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  last_checked_at timestamptz
);
alter table public.custom_domains enable row level security;
revoke all on public.custom_domains from anon, authenticated;
