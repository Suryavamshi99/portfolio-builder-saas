-- Payments v2: one checkout = $9 Pro unlock + 1 year hosting, then a yearly
-- hosting renewal (Dodo subscription with a 365-day paid trial).
--
-- hosting_subscriptions: one row per user. Access to hosting (publishing a
-- site, custom domains) lasts while now() < grace_until. grace_until is the
-- paid-through date, plus 14 days when a renewal fails (on_hold), so a
-- missed card renewal does not unpublish a site instantly.
--
-- webhook_events: Standard Webhooks delivery ids, so a replayed webhook is a
-- no-op. Rows older than 30 days are removed by /api/cron/hosting.
--
-- purchases: +kind (the first payment unlocks Pro, later ones are hosting
-- renewals) and +refunded_at (audit trail for a refund or lost dispute).
--
-- Same lock-down pattern as sites/custom_domains: no table privileges for
-- anon or authenticated; only the service-role webhook and cron write here.

create table public.hosting_subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  dodo_subscription_id text not null unique,
  status text not null check (status in ('active', 'on_hold', 'cancelled', 'expired', 'failed')),
  current_period_end timestamptz,
  grace_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hosting_subscriptions enable row level security;
revoke all on public.hosting_subscriptions from anon, authenticated;

create table public.webhook_events (
  webhook_id text primary key,
  event_type text,
  received_at timestamptz not null default now()
);

alter table public.webhook_events enable row level security;
revoke all on public.webhook_events from anon, authenticated;

create index webhook_events_received_at_idx on public.webhook_events (received_at);

alter table public.purchases
  add column kind text not null default 'pro' check (kind in ('pro', 'hosting_renewal')),
  add column refunded_at timestamptz;
