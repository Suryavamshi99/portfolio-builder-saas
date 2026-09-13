/**
 * Vercel's OAuth2 + Deployments API endpoints. These are believed correct
 * for a standard Vercel Integration (authorization-code flow) as of
 * implementation time, but — unlike the Anthropic model ids elsewhere in
 * this repo — were NOT given with certainty; verify against
 * https://vercel.com/docs/integrations before relying on this in
 * production. Kept as named constants (not inlined) specifically so a
 * correction is a one-line change.
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
