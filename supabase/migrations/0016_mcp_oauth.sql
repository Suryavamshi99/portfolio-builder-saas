-- OAuth sign-in and tokens for the Claude / ChatGPT connector (MCP server). Handoff 07.
-- Only the service-role client (server routes) reads or writes these.

create table public.mcp_clients (
  client_id text primary key,
  client_name text not null,
  redirect_uris text[] not null,
  created_at timestamptz not null default now()
);

-- One row per authorization code, access token and refresh token. Only the
-- SHA-256 hash of each secret is stored. `family_id` ties a refresh chain
-- together so reuse of an old refresh token revokes the whole chain.
create table public.mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('code', 'access', 'refresh')),
  token_hash text not null unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id text not null references public.mcp_clients (client_id) on delete cascade,
  family_id uuid not null,
  scope text not null,
  redirect_uri text,
  code_challenge text,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index mcp_tokens_user_idx on public.mcp_tokens (user_id, client_id);
create index mcp_tokens_family_idx on public.mcp_tokens (family_id);
create index mcp_tokens_expiry_idx on public.mcp_tokens (expires_at);

alter table public.mcp_clients enable row level security;
alter table public.mcp_tokens enable row level security;
revoke all on public.mcp_clients from anon, authenticated;
revoke all on public.mcp_tokens from anon, authenticated;
