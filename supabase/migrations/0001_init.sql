-- Portfolio Builder SaaS — initial schema (milestone 1).
--
-- Every table here is per-user and RLS-scoped to auth.uid(). The only
-- process allowed to see across users is the pg_cron retention job
-- (0002_retention_cron.sql), which runs as the postgres role.

-- ---------------------------------------------------------------------
-- App-level user record (extends auth.users, which we never touch)
-- ---------------------------------------------------------------------

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free',
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "users can read their own row"
  on public.users for select
  using (auth.uid() = id);

create policy "users can insert their own row"
  on public.users for insert
  with check (auth.uid() = id);

create policy "users can update their own row"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------
-- Portfolio content — one jsonb blob per user, validated by the app's
-- zod contentSchema, not by Postgres. See API.md's GET/PUT /api/content.
-- ---------------------------------------------------------------------

create table public.portfolios (
  user_id uuid primary key references auth.users (id) on delete cascade,
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.portfolios enable row level security;

create policy "users can read their own portfolio"
  on public.portfolios for select
  using (auth.uid() = user_id);

create policy "users can insert their own portfolio"
  on public.portfolios for insert
  with check (auth.uid() = user_id);

create policy "users can update their own portfolio"
  on public.portfolios for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Uploads (milestone 2b). `published` is informational only (set true at
-- Publish time once bytes are copied into the Vercel deploy bundle, see
-- milestone 5) — it does NOT exempt a row from the retention cron. Once
-- copied, the live site no longer depends on this row, so the normal
-- inactivity rule applies whether published or not; see
-- 0003_storage_cleanup.sql's comment on purge_stale_draft_uploads.
-- ---------------------------------------------------------------------

create type public.upload_kind as enum ('resume', 'visual_reference', 'photo', 'project_image');

create table public.uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.upload_kind not null,
  storage_path text not null,
  filename text not null,
  size_bytes bigint not null,
  mime_type text not null,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create index uploads_user_id_kind_idx on public.uploads (user_id, kind);

alter table public.uploads enable row level security;

create policy "users can read their own uploads"
  on public.uploads for select
  using (auth.uid() = user_id);

create policy "users can insert their own uploads"
  on public.uploads for insert
  with check (auth.uid() = user_id);

create policy "users can update their own uploads"
  on public.uploads for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete their own uploads"
  on public.uploads for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Generations (milestone 3) — one row per BYOK extraction call. Backs
-- both the hourly generation rate limit and the 48h resume/visual-
-- reference retention rule (see 0002_retention_cron.sql).
-- ---------------------------------------------------------------------

create type public.generation_status as enum ('succeeded', 'failed');

create table public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  resume_upload_id uuid references public.uploads (id) on delete set null,
  status public.generation_status not null,
  created_at timestamptz not null default now()
);

create index generations_user_id_created_at_idx on public.generations (user_id, created_at desc);

alter table public.generations enable row level security;

create policy "users can read their own generations"
  on public.generations for select
  using (auth.uid() = user_id);

create policy "users can insert their own generations"
  on public.generations for insert
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- BYOK provider keys (milestone 3) — encrypted_key/nonce are opaque to
-- Postgres; encryption/decryption happens in the app layer (see
-- src/lib/crypto.ts), never in SQL. Never select this table's raw
-- columns into a response body.
-- ---------------------------------------------------------------------

create type public.llm_provider as enum ('anthropic', 'openai', 'google');

create table public.byok_keys (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider public.llm_provider not null,
  encrypted_key bytea not null,
  nonce bytea not null,
  created_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.byok_keys enable row level security;

create policy "users can read their own byok keys"
  on public.byok_keys for select
  using (auth.uid() = user_id);

create policy "users can insert their own byok keys"
  on public.byok_keys for insert
  with check (auth.uid() = user_id);

create policy "users can update their own byok keys"
  on public.byok_keys for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete their own byok keys"
  on public.byok_keys for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Vercel OAuth connection (milestone 5) — one account per user for now.
-- ---------------------------------------------------------------------

create table public.vercel_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  encrypted_access_token bytea not null,
  nonce bytea not null,
  vercel_username text,
  connected_at timestamptz not null default now()
);

alter table public.vercel_connections enable row level security;

create policy "users can read their own vercel connection"
  on public.vercel_connections for select
  using (auth.uid() = user_id);

create policy "users can insert their own vercel connection"
  on public.vercel_connections for insert
  with check (auth.uid() = user_id);

create policy "users can update their own vercel connection"
  on public.vercel_connections for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete their own vercel connection"
  on public.vercel_connections for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Publications (milestone 5) — deployment history, backs
-- GET /api/publish/status.
-- ---------------------------------------------------------------------

create type public.publication_status as enum ('queued', 'building', 'ready', 'error');

create table public.publications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vercel_deployment_id text,
  status public.publication_status not null default 'queued',
  url text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index publications_user_id_created_at_idx on public.publications (user_id, created_at desc);

alter table public.publications enable row level security;

create policy "users can read their own publications"
  on public.publications for select
  using (auth.uid() = user_id);

create policy "users can insert their own publications"
  on public.publications for insert
  with check (auth.uid() = user_id);

create policy "users can update their own publications"
  on public.publications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Storage bucket for uploads. Path convention:
--   {user_id}/{kind}/{upload_id}-{filename}
-- Storage RLS mirrors the table policy: the first path segment must
-- match the requesting user's id.
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;

create policy "users can read their own upload objects"
  on storage.objects for select
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users can write their own upload objects"
  on storage.objects for insert
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users can delete their own upload objects"
  on storage.objects for delete
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
