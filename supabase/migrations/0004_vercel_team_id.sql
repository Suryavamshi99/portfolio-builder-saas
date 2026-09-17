-- Fixes a real gap found while verifying the Vercel Integrations OAuth flow
-- against official docs: the token-exchange response includes `team_id`,
-- which is non-null whenever the user installs the integration on a Vercel
-- Team rather than their personal account. Every subsequent API call (file
-- upload, deployment creation, status polling) must carry that team's id as
-- a `teamId` query param or Vercel returns 403. We were never capturing it.

alter table public.vercel_connections
  add column team_id text;
