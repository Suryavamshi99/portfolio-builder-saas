-- Background generation jobs and shared daily budgets for the free-model chain (handoff 05).
-- Only the service-role client (server routes, the cron route) reads or writes these.

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null check (source in ('gemini', 'free', 'mcp')),
  status text not null default 'reading'
    check (status in ('queued', 'reading', 'writing', 'checking', 'saving', 'done', 'failed')),
  message text not null default '',
  error jsonb,
  retry_at timestamptz,
  resume_upload_id uuid references public.uploads (id) on delete set null,
  params jsonb not null default '{}'::jsonb,
  provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

create index generation_jobs_user_created_idx on public.generation_jobs (user_id, created_at desc);
create index generation_jobs_queue_idx on public.generation_jobs (retry_at) where status = 'queued';

-- One unfinished job per user: a double click or a second tab can't double the cost.
create unique index generation_jobs_one_active_per_user
  on public.generation_jobs (user_id)
  where status in ('queued', 'reading', 'writing', 'checking', 'saving');

create table public.provider_budgets (
  provider text not null,
  day date not null,
  used integer not null default 0,
  cooldown_until timestamptz,
  primary key (provider, day)
);

alter table public.generation_jobs enable row level security;
alter table public.provider_budgets enable row level security;
revoke all on public.generation_jobs from anon, authenticated;
revoke all on public.provider_budgets from anon, authenticated;

-- Atomically takes one request from a provider's daily budget. False when the
-- budget is spent or the provider is cooling down after an error.
create function public.claim_provider_budget(p_provider text, p_day date, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used integer;
begin
  insert into public.provider_budgets (provider, day) values (p_provider, p_day)
  on conflict (provider, day) do nothing;

  update public.provider_budgets
  set used = used + 1
  where provider = p_provider
    and day = p_day
    and used < p_limit
    and (cooldown_until is null or cooldown_until <= now())
  returning used into v_used;

  return v_used is not null;
end;
$$;

revoke execute on function public.claim_provider_budget(text, date, integer) from public, anon, authenticated;
grant execute on function public.claim_provider_budget(text, date, integer) to service_role;
