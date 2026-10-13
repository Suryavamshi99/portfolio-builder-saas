import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const SCOPE = "portfolio:read portfolio:write";
export const ACCESS_TOKEN_TTL_S = 60 * 60;
export const REFRESH_TOKEN_TTL_S = 60 * 60 * 24 * 30;
export const CODE_TTL_S = 10 * 60;

export const newSecret = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const hashSecret = (secret: string) => createHash("sha256").update(secret).digest("hex");

/** PKCE S256: base64url(sha256(verifier)) must equal the challenge sent at /authorize. */
export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  const expected = Buffer.from(createHash("sha256").update(verifier).digest("base64url"));
  const given = Buffer.from(challenge);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** https only, except loopback http (native/desktop clients). No fragments, no credentials. */
export function isValidRedirectUri(uri: string): boolean {
  if (uri.length > 500) return false;
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash || u.username || u.password) return false;
  if (u.protocol === "https:") return true;
  return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]");
}

/** Redirect URIs are matched exactly, except the port of a loopback URI may vary. */
export function redirectUriMatches(registered: string[], requested: string): boolean {
  if (registered.includes(requested)) return true;
  let r: URL;
  try {
    r = new URL(requested);
  } catch {
    return false;
  }
  if (r.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(r.hostname)) return false;
  return registered.some((reg) => {
    try {
      const u = new URL(reg);
      return u.protocol === "http:" && u.hostname === r.hostname && u.pathname === r.pathname && u.search === r.search;
    } catch {
      return false;
    }
  });
}

export function protectedResourceMetadata(origin: string) {
  return {
    resource: `${origin}/mcp`,
    authorization_servers: [origin],
    scopes_supported: SCOPE.split(" "),
    bearer_methods_supported: ["header"],
  };
}

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/authorize`,
    token_endpoint: `${origin}/token`,
    registration_endpoint: `${origin}/register`,
    scopes_supported: SCOPE.split(" "),
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  };
}

export const WWW_AUTHENTICATE = (origin: string) =>
  `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`;
