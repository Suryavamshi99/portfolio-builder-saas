import { createSign } from "node:crypto";

export class GithubError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GithubError";
    this.status = status;
  }
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64url");
}

function getGithubAppConfig(): { appId: string; appSlug: string; privateKey: string } {
  const appId = process.env["GITHUB_APP_ID"];
  const appSlug = process.env["GITHUB_APP_SLUG"];
  const rawKey = process.env["GITHUB_APP_PRIVATE_KEY"];

  if (!appId) throw new GithubError("GITHUB_APP_ID is not configured", 500);
  if (!appSlug) throw new GithubError("GITHUB_APP_SLUG is not configured", 500);
  if (!rawKey) throw new GithubError("GITHUB_APP_PRIVATE_KEY is not configured", 500);

  // Unescape \n if private key was stored as a single escaped string
  const privateKey = rawKey.includes("\\n") ? rawKey.replace(/\\n/g, "\n") : rawKey;
  return { appId, appSlug, privateKey };
}

/**
 * Creates an RS256 JWT for GitHub App authentication.
 * Header: { alg: "RS256", typ: "JWT" }
 * Payload: { iss: GITHUB_APP_ID, iat: now - 60, exp: now + 540 }
 * Signed with GITHUB_APP_PRIVATE_KEY using node:crypto RSA-SHA256.
 */
export function createAppJwt(now?: number): string {
  const { appId, privateKey } = getGithubAppConfig();
  const currentTime = now !== undefined ? now : Math.floor(Date.now() / 1000);

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload = {
    iss: appId,
    iat: currentTime - 60,
    exp: currentTime + 540,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKey);
  const encodedSignature = base64UrlEncode(signature);

  return `${signingInput}.${encodedSignature}`;
}

/**
 * Exchanges the GitHub App JWT for a short-lived repository installation token.
 * POST https://api.github.com/app/installations/{id}/access_tokens
 */
export async function getInstallationToken(installationId: number): Promise<string> {
  const jwt = createAppJwt();
  const url = `https://api.github.com/app/installations/${installationId}/access_tokens`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) {
    let errDetail = "";
    try {
      const errJson = (await res.json()) as { message?: string };
      errDetail = errJson.message ? `: ${errJson.message}` : "";
    } catch {
      // ignore json parse error
    }
    throw new GithubError(`GitHub token request failed (${res.status})${errDetail}`, res.status);
  }

  const json = (await res.json()) as { token?: string };
  if (!json.token) {
    throw new GithubError("GitHub token response did not contain token", 502);
  }

  return json.token;
}

/**
 * Confirms an installation id belongs to our app and returns the account login.
 * GET https://api.github.com/app/installations/{id}
 */
export async function getInstallation(installationId: number): Promise<{ account_login: string }> {
  const jwt = createAppJwt();
  const url = `https://api.github.com/app/installations/${installationId}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) {
    throw new GithubError(`GitHub get installation failed (${res.status})`, res.status);
  }

  const json = (await res.json()) as { account?: { login?: string } };
  const accountLogin = json.account?.login;
  if (!accountLogin) {
    throw new GithubError("GitHub installation did not contain account login", 502);
  }

  return { account_login: accountLogin };
}

/**
 * Generates the installation URL for users to install the GitHub App.
 */
export function installUrl(state: string): string {
  const { appSlug } = getGithubAppConfig();
  return `https://github.com/apps/${appSlug}/installations/new?state=${encodeURIComponent(state)}`;
}

/**
 * Confirms the signed-in user really owns an installation: the sign-in `code`
 * GitHub sends back (the app must have "Request user authorization (OAuth)
 * during installation" on) is exchanged for a token for THAT GitHub user, and
 * the installation id must be in that user's own installation list. Without
 * this, anyone could attach someone else's installation by guessing its id.
 */
export async function userOwnsInstallation(code: string, installationId: number): Promise<boolean> {
  const clientId = process.env["GITHUB_APP_CLIENT_ID"];
  const clientSecret = process.env["GITHUB_APP_CLIENT_SECRET"];
  if (!clientId || !clientSecret) throw new GithubError("GitHub sign-in is not configured", 500);

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  if (!tokenRes.ok) return false;
  const token = ((await tokenRes.json()) as { access_token?: unknown }).access_token;
  if (typeof token !== "string" || !token) return false;

  for (let page = 1; page <= 5; page++) {
    const res = await fetch(`https://api.github.com/user/installations?per_page=100&page=${page}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    });
    if (!res.ok) return false;
    const list = ((await res.json()) as { installations?: Array<{ id?: number }> }).installations ?? [];
    if (list.some((i) => i.id === installationId)) return true;
    if (list.length < 100) return false;
  }
  return false;
}
