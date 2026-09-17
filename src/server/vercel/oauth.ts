import { getAppOrigin } from "@/config/app";
import { VERCEL_OAUTH_AUTHORIZE_URL, VERCEL_OAUTH_TOKEN_URL, VERCEL_API_BASE, getVercelOAuthCredentials } from "@/config/vercel";

export function getVercelRedirectUri(): string {
  return `${getAppOrigin()}/api/vercel/oauth/callback`;
}

export function buildVercelAuthorizeUrl(state: string): string {
  const { clientId } = getVercelOAuthCredentials();
  const url = new URL(VERCEL_OAUTH_AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getVercelRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return url.toString();
}

export class VercelOAuthError extends Error {}

/**
 * Verified against Vercel's official Integrations docs (not Sign-in-with-
 * Vercel, a separate identity product with a different token endpoint and
 * mandatory PKCE — this one needs neither). Response includes `team_id`,
 * non-null whenever the integration is installed on a Team rather than the
 * user's personal account — every later API call must carry that as a
 * `teamId` query param, so callers need it back from here, not just the token.
 */
export async function exchangeVercelCode(code: string): Promise<{ accessToken: string; teamId: string | null }> {
  const { clientId, clientSecret } = getVercelOAuthCredentials();

  const res = await fetch(VERCEL_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: getVercelRedirectUri(),
    }),
  });

  if (!res.ok) {
    throw new VercelOAuthError(`Vercel token exchange failed (${res.status}): ${(await res.text()).slice(0, 500)}`);
  }

  const json = (await res.json()) as { access_token?: string; team_id?: string | null };
  if (!json.access_token) throw new VercelOAuthError("Vercel token exchange response had no access_token");
  return { accessToken: json.access_token, teamId: json.team_id ?? null };
}

export function withTeamId(url: string, teamId: string | null): string {
  if (!teamId) return url;
  const withParam = new URL(url);
  withParam.searchParams.set("teamId", teamId);
  return withParam.toString();
}

export async function fetchVercelUsername(accessToken: string, teamId: string | null): Promise<string | null> {
  const res = await fetch(withTeamId(`${VERCEL_API_BASE}/v2/user`, teamId), {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { user?: { username?: string } };
  return json.user?.username ?? null;
}
