import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Self-contained, signed OAuth `state` — no server-side session store or
 * extra cookie needed. Encodes the initiating user's id + a random nonce +
 * an expiry, HMAC-signed with ENCRYPTION_KEY so it can't be forged. The
 * callback verifies the signature AND that the embedded user id matches
 * the currently authenticated session — never trusts the state's userId
 * as authorization by itself (a parsed value isn't an authorized one).
 */

const TTL_MS = 10 * 60 * 1000;

function getSigningKey(): Buffer {
  const raw = process.env["ENCRYPTION_KEY"];
  if (!raw) throw new Error("ENCRYPTION_KEY must be set");
  return Buffer.from(raw, "base64");
}

function sign(payload: string): string {
  return createHmac("sha256", getSigningKey()).update(payload).digest("base64url");
}

export function createOAuthState(userId: string): string {
  const nonce = randomBytes(16).toString("base64url");
  const expiresAt = Date.now() + TTL_MS;
  const payload = `${userId}.${nonce}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyOAuthState(state: string, expectedUserId: string): boolean {
  const parts = state.split(".");
  if (parts.length !== 4) return false;
  const [userId, nonce, expiresAtStr, signature] = parts;
  const payload = `${userId}.${nonce}.${expiresAtStr}`;
  const expected = sign(payload);

  const sigBuffer = Buffer.from(signature!, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
    return false;
  }

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  return userId === expectedUserId;
}
