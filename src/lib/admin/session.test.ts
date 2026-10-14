import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  ADMIN_PENDING_COOKIE,
  ADMIN_PENDING_COOKIE_HOST,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_COOKIE_HOST,
  createAdminPendingToken,
  createAdminSessionToken,
  getAdminPendingCookieName,
  getAdminSessionCookieName,
  isHttpsRequest,
  serializeAdminPendingCookie,
  serializeAdminSessionCookie,
  serializeClearAdminCookies,
  SESSION_TTL_MS,
  verifyAdminPendingToken,
  verifyAdminSessionToken,
} from "./session";

describe("Session v2 and Pending tokens", () => {
  const secret = "super-secret-admin-session-signing-key-32chars";

  it("creates and verifies a valid v2 session token", () => {
    const now = Date.now();
    const token = createAdminSessionToken(
      {
        iat: now,
        exp: now + SESSION_TTL_MS,
        seen: now,
        epoch: 1,
        stepUpUntil: null,
      },
      secret,
    );

    const res = verifyAdminSessionToken(token, secret, 1, now);
    expect(res.valid).toBe(true);
    expect(res.payload?.epoch).toBe(1);
    expect(res.payload?.stepUpUntil).toBeNull();
  });

  it("rejects tampered signature or modified payload", () => {
    const now = Date.now();
    const token = createAdminSessionToken(
      {
        iat: now,
        exp: now + SESSION_TTL_MS,
        seen: now,
        epoch: 1,
      },
      secret,
    );

    const [payloadB64, sig] = token.split(".");
    // Modifying signature
    expect(verifyAdminSessionToken(`${payloadB64}.badSig`, secret, 1, now).valid).toBe(false);

    // Modifying payload
    const decoded = JSON.parse(Buffer.from(payloadB64!, "base64url").toString("utf8"));
    decoded.epoch = 99;
    const modifiedB64 = Buffer.from(JSON.stringify(decoded)).toString("base64url");
    expect(verifyAdminSessionToken(`${modifiedB64}.${sig}`, secret, 1, now).valid).toBe(false);
  });

  it("rejects old v1 tokens missing iat/seen/epoch", () => {
    // Old v1 token format: JSON.stringify({ exp: Date.now() + 24*3600*1000 })
    const v1Payload = JSON.stringify({ exp: Date.now() + 24 * 60 * 60 * 1000 });
    const payloadB64 = Buffer.from(v1Payload).toString("base64url");
    const sig = createHmac("sha256", secret).update(payloadB64).digest("base64url");
    const v1Token = `${payloadB64}.${sig}`;

    const res = verifyAdminSessionToken(v1Token, secret, 1);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe("invalid_shape");
  });

  it("rejects token past 8 hour absolute expiry", () => {
    const now = Date.now();
    const token = createAdminSessionToken(
      {
        iat: now - 9 * 60 * 60 * 1000,
        exp: now - 1 * 60 * 60 * 1000,
        seen: now - 5 * 60 * 1000,
        epoch: 1,
      },
      secret,
    );

    const res = verifyAdminSessionToken(token, secret, 1, now);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe("expired");
  });

  it("rejects token past 30 minute idle timeout", () => {
    const now = Date.now();
    const token = createAdminSessionToken(
      {
        iat: now - 2 * 60 * 60 * 1000,
        exp: now + 6 * 60 * 60 * 1000,
        seen: now - 31 * 60 * 1000, // 31 min idle
        epoch: 1,
      },
      secret,
    );

    const res = verifyAdminSessionToken(token, secret, 1, now);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe("idle");
  });

  it("rejects token on epoch mismatch (sign-out everywhere)", () => {
    const now = Date.now();
    const token = createAdminSessionToken(
      {
        iat: now,
        exp: now + SESSION_TTL_MS,
        seen: now,
        epoch: 1, // signed for epoch 1
      },
      secret,
    );

    // DB epoch bumped to 2
    const res = verifyAdminSessionToken(token, secret, 2, now);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe("epoch_mismatch");
  });

  it("creates and verifies short-lived pending token", () => {
    const now = Date.now();
    const token = createAdminPendingToken("admin-user", secret, now);

    const res = verifyAdminPendingToken(token, secret, now);
    expect(res.valid).toBe(true);
    expect(res.payload?.username).toBe("admin-user");

    // Fails after 5 minutes (300 seconds)
    const expiredRes = verifyAdminPendingToken(token, secret, now + 301 * 1000);
    expect(expiredRes.valid).toBe(false);
  });

  it("uses correct cookie names and flags for HTTPS vs HTTP", () => {
    expect(getAdminSessionCookieName(true)).toBe(ADMIN_SESSION_COOKIE_HOST);
    expect(getAdminSessionCookieName(false)).toBe(ADMIN_SESSION_COOKIE);
    expect(getAdminPendingCookieName(true)).toBe(ADMIN_PENDING_COOKIE_HOST);
    expect(getAdminPendingCookieName(false)).toBe(ADMIN_PENDING_COOKIE);

    // HTTPS session cookie
    const httpsCookie = serializeAdminSessionCookie("tok123", true);
    expect(httpsCookie).toContain("__Host-admin_session=tok123");
    expect(httpsCookie).toContain("Secure");
    expect(httpsCookie).toContain("HttpOnly");
    expect(httpsCookie).toContain("SameSite=Strict");
    expect(httpsCookie).toContain("Path=/");

    // HTTP session cookie (local dev)
    const httpCookie = serializeAdminSessionCookie("tok123", false);
    expect(httpCookie).toContain("admin_session=tok123");
    expect(httpCookie).not.toContain("Secure");
    expect(httpCookie).toContain("HttpOnly");
    expect(httpCookie).toContain("SameSite=Strict");

    // Pending cookies
    const pendingHttps = serializeAdminPendingCookie("pend123", true);
    expect(pendingHttps).toContain("__Host-admin_pending=pend123");
    expect(pendingHttps).toContain("Secure");

    // Clear cookies
    const clearHeaders = serializeClearAdminCookies(true);
    expect(clearHeaders).toHaveLength(4);
    for (const h of clearHeaders) {
      expect(h).toContain("Max-Age=0");
    }
  });

  it("correctly identifies HTTPS requests from URL or headers", () => {
    expect(isHttpsRequest(new Request("https://example.com/admin"))).toBe(true);
    expect(isHttpsRequest(new Request("http://localhost:3000/admin"))).toBe(false);
    expect(
      isHttpsRequest(
        new Request("http://proxy.internal/admin", {
          headers: { "x-forwarded-proto": "https" },
        }),
      ),
    ).toBe(true);
  });
});
