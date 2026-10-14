create table public.admin_security (
  id boolean primary key default true check (id),   -- single row
  totp_secret_enc text,
  totp_enabled_at timestamptz,
  recovery_hashes text[] not null default '{}',
  session_epoch integer not null default 1,
  last_totp_step bigint,
  updated_at timestamptz not null default now()
);
alter table public.admin_security enable row level security;
revoke all on public.admin_security from anon, authenticated;

create table public.admin_login_attempts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  key_hash text not null,          -- sha256(ip + username + ADMIN_SESSION_SECRET), never raw
  stage text not null check (stage in ('password','totp')),
  ok boolean not null
);
create index admin_login_attempts_key_idx on public.admin_login_attempts (key_hash, created_at desc);
alter table public.admin_login_attempts enable row level security;
revoke all on public.admin_login_attempts from anon, authenticated;
