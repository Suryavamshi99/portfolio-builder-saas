-- Milestone 6 — payments (Dodo Payments, one-time lifetime Pro unlock).
--
-- No subscription/renewal state needed: this is a single one-time purchase
-- that flips users.plan from 'free' to 'pro' and stays there. purchases is
-- an audit trail + idempotency guard (dodo_payment_id unique — a replayed
-- webhook for the same payment is a no-op, not a double-grant), not a
-- billing ledger to build more logic on top of.

alter table public.users
  add constraint users_plan_check check (plan in ('free', 'pro'));

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  dodo_payment_id text not null unique,
  status text not null,
  amount_cents integer,
  currency text,
  created_at timestamptz not null default now()
);

create index purchases_user_id_created_at_idx on public.purchases (user_id, created_at desc);

alter table public.purchases enable row level security;

-- Read-only from the app's side — a user can see their own purchase
-- history, but only the webhook handler (running as the service-role
-- client, which bypasses RLS entirely) ever writes a row here. No
-- insert/update/delete policy is intentional, not an oversight.
create policy "users can read their own purchases"
  on public.purchases for select
  using (auth.uid() = user_id);
