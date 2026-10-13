insert into storage.buckets (id, name, public) values ('sites', 'sites', false) on conflict (id) do nothing;
create table public.sites (
  user_id uuid primary key references auth.users (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$'),
  status text not null default 'published' check (status in ('published', 'unpublished')),
  published_version_id uuid references public.portfolio_versions (id) on delete set null,
  published_html_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sites enable row level security;
revoke all on public.sites from anon, authenticated;
