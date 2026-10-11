-- Save wizard inputs and user preferences (handoff 01).
--
-- Persists the user's entered profile links, specifics, and Minimal/Bold
-- design intensity choice across reloads and studio regenerations.
-- Row-level security is scoped to auth.uid(), matching portfolios in 0001_init.sql.

create table public.portfolio_inputs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  links jsonb not null default '{}'::jsonb,
  specifics text,
  design_intensity text not null default 'minimal' check (design_intensity in ('minimal', 'bold')),
  updated_at timestamptz not null default now()
);

alter table public.portfolio_inputs enable row level security;

create policy "users can read their own portfolio inputs"
  on public.portfolio_inputs for select
  using (auth.uid() = user_id);

create policy "users can insert their own portfolio inputs"
  on public.portfolio_inputs for insert
  with check (auth.uid() = user_id);

-- Needed so POST /api/reset (which runs as the user) can clear the row;
-- without it the delete silently affects 0 rows. Inputs aren't sensitive.
create policy "users can delete their own portfolio inputs"
  on public.portfolio_inputs for delete
  using (auth.uid() = user_id);

create policy "users can update their own portfolio inputs"
  on public.portfolio_inputs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
