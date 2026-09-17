/**
 * Vercel's OAuth2 + Deployments API endpoints — verified against Vercel's
 * official docs on 2026-09-17 (previously flagged as unverified guesses;
 * both turned out correct). Two things worth knowing if this ever needs
 * revisiting:
 * - "Sign in with Vercel" is a DIFFERENT product with a different token
 *   endpoint (api.vercel.com/login/oauth/token) and mandatory PKCE — don't
 *   confuse it with this one (the Integrations OAuth flow), which needs
 *   neither PKCE nor a code_verifier.
 * - The token response includes `team_id` (non-null when installed on a
 *   Team, not a personal account) — every API call after that must carry
 *   it as a `teamId` query param or Vercel 403s. See withTeamId() in
 *   src/server/vercel/oauth.ts, used by every call in deploy.ts.
 */
export const VERCEL_OAUTH_AUTHORIZE_URL = "https://vercel.com/oauth/authorize";
export const VERCEL_OAUTH_TOKEN_URL = "https://api.vercel.com/v2/oauth/access_token";
export const VERCEL_API_BASE = "https://api.vercel.com";

export function getVercelOAuthCredentials() {
  const clientId = process.env["VERCEL_CLIENT_ID"];
  const clientSecret = process.env["VERCEL_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    throw new Error("VERCEL_CLIENT_ID and VERCEL_CLIENT_SECRET must be set");
  }
  return { clientId, clientSecret };
}
