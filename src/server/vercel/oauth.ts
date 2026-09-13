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

export async function exchangeVercelCode(code: string): Promise<{ accessToken: string }> {
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

  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new VercelOAuthError("Vercel token exchange response had no access_token");
  return { accessToken: json.access_token };
}

export async function fetchVercelUsername(accessToken: string): Promise<string | null> {
  const res = await fetch(`${VERCEL_API_BASE}/v2/user`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { user?: { username?: string } };
  return json.user?.username ?? null;
}
