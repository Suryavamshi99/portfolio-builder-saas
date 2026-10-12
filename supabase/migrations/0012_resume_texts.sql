-- Extracted resume text, saved once at upload (handoff 04a).
-- Keyed by the resume's upload row: every path that deletes the upload
-- (48 h retention cron, reset, replace, delete, account deletion) cascades here.
create table public.resume_texts (
  upload_id uuid primary key references public.uploads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create index resume_texts_user_idx on public.resume_texts (user_id);

alter table public.resume_texts enable row level security;

-- No policies and no grants: only the service-role client (server routes)
-- reads or writes resume text. See 0010 for why table-level privileges are revoked.
revoke all on public.resume_texts from anon, authenticated;
