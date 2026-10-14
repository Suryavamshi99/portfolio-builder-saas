import { createHmac, timingSafeEqual } from "node:crypto";
import { serialize as serializeCookie } from "cookie";

export const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours absolute
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes idle
export const STEP_UP_TTL_MS = 5 * 60 * 1000; // 5 minutes step-up
export const PENDING_TTL_MS = 5 * 60 * 1000; // 5 minutes pending 2FA

export const ADMIN_SESSION_COOKIE = "admin_session";
export const ADMIN_SESSION_COOKIE_HOST = "__Host-admin_session";
export const ADMIN_PENDING_COOKIE = "admin_pending";
export const ADMIN_PENDING_COOKIE_HOST = "__Host-admin_pending";

export interface AdminSessionPayload {
  iat: number;
  exp: number;
  seen: number;
  epoch: number;
  stepUpUntil?: number | null;
}

export interface AdminPendingPayload {
  type: "admin_pending";
  username: string;
  iat: number;
  exp: number;
}

function sign(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

export function getAdminSessionCookieName(isHttps: boolean): string {
  return isHttps ? ADMIN_SESSION_COOKIE_HOST : ADMIN_SESSION_COOKIE;
}

export function getAdminPendingCookieName(isHttps: boolean): string {
  return isHttps ? ADMIN_PENDING_COOKIE_HOST : ADMIN_PENDING_COOKIE;
}

export function isHttpsRequest(request?: Request, forwardedProto?: string | null): boolean {
  if (forwardedProto) {
    return forwardedProto.split(",")[0]?.trim() === "https";
  }
  if (request) {
    try {
      const url = new URL(request.url);
      if (url.protocol === "https:") return true;
      const protoHdr = request.headers.get("x-forwarded-proto");
      if (protoHdr && protoHdr.split(",")[0]?.trim() === "https") return true;
    } catch {
      // ignore
    }
  }
  return process.env["NODE_ENV"] === "production";
}

/** Create signed Session v2 token */
export function createAdminSessionToken(payload: AdminSessionPayload, secret: string): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${sign(payloadB64, secret)}`;
}

export interface VerifySessionResult {
  valid: boolean;
  payload?: AdminSessionPayload;
  reason?: "missing" | "tampered" | "expired" | "idle" | "epoch_mismatch" | "invalid_shape";
}

/**
 * Verify Session v2 token.
 * Rejects old v1 tokens (lacking iat/seen/epoch).
 * Rejects tokens past exp (8h), past idle (30m), or with epoch mismatch.
 */
export function verifyAdminSessionToken(
  token: string | undefined,
  secret: string,
  expectedEpoch?: number,
  now: number = Date.now(),
): VerifySessionResult {
  if (!token) return { valid: false, reason: "missing" };

  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return { valid: false, reason: "tampered" };

  const expectedSig = Buffer.from(sign(payloadB64, secret));
  const actualSig = Buffer.from(signature);
  if (expectedSig.length !== actualSig.length || !timingSafeEqual(expectedSig, actualSig)) {
    return { valid: false, reason: "tampered" };
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return { valid: false, reason: "tampered" };
  }

  // Reject v1 tokens or malformed payloads
  if (
    typeof payload["iat"] !== "number" ||
    typeof payload["exp"] !== "number" ||
    typeof payload["seen"] !== "number" ||
    typeof payload["epoch"] !== "number"
  ) {
    return { valid: false, reason: "invalid_shape" };
  }

  const sessionPayload: AdminSessionPayload = {
    iat: payload["iat"],
    exp: payload["exp"],
    seen: payload["seen"],
    epoch: payload["epoch"],
    stepUpUntil: typeof payload["stepUpUntil"] === "number" ? payload["stepUpUntil"] : null,
  };

  // Absolute expiry check (8 hours)
  if (now >= sessionPayload.exp) {
    return { valid: false, reason: "expired" };
  }

  // Idle timeout check (30 minutes)
  if (now - sessionPayload.seen >= IDLE_TIMEOUT_MS) {
    return { valid: false, reason: "idle" };
  }

  // Database epoch check
  if (expectedEpoch !== undefined && sessionPayload.epoch !== expectedEpoch) {
    return { valid: false, reason: "epoch_mismatch" };
  }

  return { valid: true, payload: sessionPayload };
}

/** Create short-lived pending 2FA token (5 minutes) */
export function createAdminPendingToken(username: string, secret: string, now: number = Date.now()): string {
  const payload: AdminPendingPayload = {
    type: "admin_pending",
    username,
    iat: now,
    exp: now + PENDING_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${sign(payloadB64, secret)}`;
}

/** Verify short-lived pending 2FA token */
export function verifyAdminPendingToken(
  token: string | undefined,
  secret: string,
  now: number = Date.now(),
): { valid: boolean; payload?: AdminPendingPayload } {
  if (!token) return { valid: false };

  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return { valid: false };

  const expectedSig = Buffer.from(sign(payloadB64, secret));
  const actualSig = Buffer.from(signature);
  if (expectedSig.length !== actualSig.length || !timingSafeEqual(expectedSig, actualSig)) {
    return { valid: false };
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as Record<string, unknown>;
    if (
      payload["type"] !== "admin_pending" ||
      typeof payload["username"] !== "string" ||
      typeof payload["exp"] !== "number" ||
      typeof payload["iat"] !== "number"
    ) {
      return { valid: false };
    }
    if (now >= payload["exp"]) {
      return { valid: false };
    }
    return {
      valid: true,
      payload: {
        type: "admin_pending",
        username: payload["username"],
        iat: payload["iat"],
        exp: payload["exp"],
      },
    };
  } catch {
    return { valid: false };
  }
}

/** Serialize session cookie */
export function serializeAdminSessionCookie(
  token: string,
  isHttps: boolean,
  maxAgeSeconds = Math.floor(SESSION_TTL_MS / 1000),
): string {
  const name = getAdminSessionCookieName(isHttps);
  return serializeCookie(name, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: "strict",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

/** Serialize pending 2FA cookie */
export function serializeAdminPendingCookie(
  token: string,
  isHttps: boolean,
  maxAgeSeconds = Math.floor(PENDING_TTL_MS / 1000),
): string {
  const name = getAdminPendingCookieName(isHttps);
  return serializeCookie(name, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: "strict",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

/** Clear all admin cookies (both session and pending, both host and plain names) */
export function serializeClearAdminCookies(isHttps: boolean): string[] {
  const cookieNames = [
    ADMIN_SESSION_COOKIE,
    ADMIN_SESSION_COOKIE_HOST,
    ADMIN_PENDING_COOKIE,
    ADMIN_PENDING_COOKIE_HOST,
  ];

  return cookieNames.map((name) =>
    serializeCookie(name, "", {
      httpOnly: true,
      secure: isHttps,
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    }),
  );
}
