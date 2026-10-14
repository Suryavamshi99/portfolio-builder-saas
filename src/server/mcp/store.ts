import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ACCESS_TOKEN_TTL_S,
  CODE_TTL_S,
  REFRESH_TOKEN_TTL_S,
  SCOPE,
  hashSecret,
  newSecret,
  redirectUriMatches,
  verifyPkce,
} from "./oauth";

// Registration is open to anyone, so it is capped per hour (it heals itself) and unused entries are swept.
const MAX_REGISTRATIONS_PER_HOUR = 300;
const REFRESH_RETRY_GRACE_MS = 10_000;
const inSeconds = (s: number) => new Date(Date.now() + s * 1000).toISOString();

export interface TokenSet {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}
export type GrantResult = { ok: true; tokens: TokenSet } | { ok: false; error: "invalid_grant" | "invalid_client" };

export async function registerClient(
  admin: SupabaseClient,
  client: { name: string; redirectUris: string[] },
): Promise<{ clientId: string } | null> {
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  // Sweep registrations that never produced a token.
  const { data: old } = await admin.from("mcp_clients").select("client_id").lt("created_at", hourAgo).limit(500);
  if (old && old.length > 0) {
    const ids = old.map((c) => c.client_id);
    const { data: used } = await admin.from("mcp_tokens").select("client_id").in("client_id", ids);
    const inUse = new Set((used ?? []).map((t) => t.client_id));
    const unused = ids.filter((id) => !inUse.has(id));
    if (unused.length > 0) await admin.from("mcp_clients").delete().in("client_id", unused);
  }
  const { count } = await admin.from("mcp_clients").select("client_id", { count: "exact", head: true }).gte("created_at", hourAgo);
  if ((count ?? 0) >= MAX_REGISTRATIONS_PER_HOUR) return null;
  const clientId = newSecret(18);
  const { error } = await admin
    .from("mcp_clients")
    .insert({ client_id: clientId, client_name: client.name, redirect_uris: client.redirectUris });
  return error ? null : { clientId };
}

export async function getClient(admin: SupabaseClient, clientId: string) {
  const { data } = await admin.from("mcp_clients").select("client_id, client_name, redirect_uris").eq("client_id", clientId).maybeSingle();
  return (data as { client_id: string; client_name: string; redirect_uris: string[] } | null) ?? null;
}

export async function createAuthCode(
  admin: SupabaseClient,
  a: { userId: string; clientId: string; redirectUri: string; codeChallenge: string },
): Promise<string> {
  const code = newSecret();
  const { error } = await admin.from("mcp_tokens").insert({
    kind: "code",
    token_hash: hashSecret(code),
    user_id: a.userId,
    client_id: a.clientId,
    family_id: crypto.randomUUID(),
    scope: SCOPE,
    redirect_uri: a.redirectUri,
    code_challenge: a.codeChallenge,
    expires_at: inSeconds(CODE_TTL_S),
  });
  if (error) throw new Error("Could not create authorization code");
  return code;
}

async function issueTokens(admin: SupabaseClient, g: { userId: string; clientId: string; familyId: string }): Promise<TokenSet> {
  const access = newSecret();
  const refresh = newSecret();
  const base = { user_id: g.userId, client_id: g.clientId, family_id: g.familyId, scope: SCOPE };
  const { error } = await admin.from("mcp_tokens").insert([
    { ...base, kind: "access", token_hash: hashSecret(access), expires_at: inSeconds(ACCESS_TOKEN_TTL_S) },
    { ...base, kind: "refresh", token_hash: hashSecret(refresh), expires_at: inSeconds(REFRESH_TOKEN_TTL_S) },
  ]);
  if (error) throw new Error("Could not issue tokens");
  // Housekeeping: drop rows that expired more than a day ago.
  await admin.from("mcp_tokens").delete().lt("expires_at", new Date(Date.now() - 86_400_000).toISOString());
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_TOKEN_TTL_S, refresh_token: refresh, scope: SCOPE };
}

async function revokeFamily(admin: SupabaseClient, familyId: string) {
  await admin.from("mcp_tokens").update({ revoked_at: new Date().toISOString() }).eq("family_id", familyId).is("revoked_at", null);
}

type TokenRow = { user_id: string; client_id: string; family_id: string; redirect_uri: string | null; code_challenge: string | null };
const ROW = "user_id, client_id, family_id, redirect_uri, code_challenge";

/** Spends an authorization code (single use) and returns tokens if every binding checks out. */
export async function exchangeCode(
  admin: SupabaseClient,
  a: { code: string; clientId: string; redirectUri: string; verifier: string },
): Promise<GrantResult> {
  const hash = hashSecret(a.code);
  const { data } = await admin
    .from("mcp_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", hash)
    .eq("kind", "code")
    .is("used_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .select(ROW)
    .maybeSingle();
  const row = data as TokenRow | null;
  if (!row) {
    // A code presented twice means it may have leaked: revoke whatever it produced.
    const { data: prior } = await admin.from("mcp_tokens").select("family_id").eq("token_hash", hash).eq("kind", "code").maybeSingle();
    if (prior) await revokeFamily(admin, prior.family_id);
    return { ok: false, error: "invalid_grant" };
  }
  if (row.client_id !== a.clientId || row.redirect_uri !== a.redirectUri || !row.code_challenge || !verifyPkce(a.verifier, row.code_challenge)) {
    return { ok: false, error: "invalid_grant" };
  }
  return { ok: true, tokens: await issueTokens(admin, { userId: row.user_id, clientId: row.client_id, familyId: row.family_id }) };
}

/** Rotates a refresh token. Presenting an already-used one revokes the whole chain. */
export async function refreshTokens(admin: SupabaseClient, a: { refreshToken: string; clientId: string }): Promise<GrantResult> {
  const hash = hashSecret(a.refreshToken);
  const { data } = await admin
    .from("mcp_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", hash)
    .eq("kind", "refresh")
    .eq("client_id", a.clientId)
    .is("used_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .select(ROW)
    .maybeSingle();
  const row = data as TokenRow | null;
  if (!row) {
    const { data: prior } = await admin.from("mcp_tokens").select("family_id, used_at").eq("token_hash", hash).eq("kind", "refresh").maybeSingle();
    // A second use right after the first is a client retry or a double request, not theft: refuse it
    // but keep the new tokens. A use later than that means a stolen copy: revoke the whole chain.
    if (prior?.used_at && Date.now() - new Date(prior.used_at).getTime() > REFRESH_RETRY_GRACE_MS) {
      await revokeFamily(admin, prior.family_id);
    }
    return { ok: false, error: "invalid_grant" };
  }
  return { ok: true, tokens: await issueTokens(admin, { userId: row.user_id, clientId: row.client_id, familyId: row.family_id }) };
}

export async function authenticateAccessToken(admin: SupabaseClient, token: string): Promise<{ userId: string; clientId: string } | null> {
  const { data } = await admin
    .from("mcp_tokens")
    .select("user_id, client_id")
    .eq("token_hash", hashSecret(token))
    .eq("kind", "access")
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return data ? { userId: data.user_id, clientId: data.client_id } : null;
}

export async function listConnections(admin: SupabaseClient, userId: string) {
  const { data } = await admin
    .from("mcp_tokens")
    .select("client_id, created_at")
    .eq("user_id", userId)
    .eq("kind", "refresh")
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  const latest = new Map<string, string>();
  for (const r of data ?? []) if (!latest.has(r.client_id)) latest.set(r.client_id, r.created_at);
  if (latest.size === 0) return [];
  const { data: clients } = await admin.from("mcp_clients").select("client_id, client_name").in("client_id", [...latest.keys()]);
  return (clients ?? []).map((c) => ({ clientId: c.client_id, name: c.client_name, connectedAt: latest.get(c.client_id)! }));
}

export async function revokeConnection(admin: SupabaseClient, userId: string, clientId: string) {
  await admin.from("mcp_tokens").update({ revoked_at: new Date().toISOString() }).eq("user_id", userId).eq("client_id", clientId).is("revoked_at", null);
}
