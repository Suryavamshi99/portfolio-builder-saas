import { createFileRoute } from "@tanstack/react-router";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";

import { getAdminEnv } from "@/lib/admin/env";
import { DUMMY_SCRYPT_HASH, verifyPassword } from "@/lib/admin/password";
import {
  createAdminPendingToken,
  isHttpsRequest,
  serializeAdminPendingCookie,
} from "@/lib/admin/session";
import { getAdminSecurity } from "@/lib/admin/security-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAdminAction } from "@/server/admin-audit";
import {
  checkAdminLoginRateLimit,
  checkAdminLockout,
  computeAdminKeyHash,
  recordAdminAttempt,
} from "@/server/admin-rate-limit";

function errorResponse(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return Response.json({ error: { code, message, ...extra } }, { status });
}

export const Route = createFileRoute("/api/admin/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const admin = createSupabaseAdminClient();
        const clientIp = getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

        // Keep existing in-memory per-IP limiter as defense-in-depth
        const ipRateLimit = checkAdminLoginRateLimit(clientIp);
        if (ipRateLimit.limited) {
          return Response.json(
            { error: { code: "locked", message: "Too many attempts. Try again later." }, retryAfterSeconds: ipRateLimit.retryAfterSeconds },
            { status: 429, headers: { "retry-after": String(ipRateLimit.retryAfterSeconds) } },
          );
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return errorResponse(400, "invalid_body", "Invalid request body");
        }
        if (typeof body !== "object" || body === null) {
          return errorResponse(400, "invalid_body", "Invalid request body");
        }
        const { username, password } = body as { username?: unknown; password?: unknown };
        if (typeof username !== "string" || typeof password !== "string") {
          return errorResponse(400, "invalid_body", "username and password are required");
        }

        const { username: expectedUsername, passwordHash, sessionSecret } = getAdminEnv();
        const keyHash = computeAdminKeyHash(clientIp, username, sessionSecret);

        // Lockout check before verifying credentials
        const lockout = await checkAdminLockout(admin, keyHash, "password");
        if (lockout.locked) {
          await logAdminAction(admin, {
            action: "admin.login_locked",
            targetType: "system",
            detail: { stage: "password" },
            request,
          });
          return Response.json(
            {
              error: { code: "locked", message: "Too many failed attempts. Try again later." },
              retryAfterSeconds: lockout.retryAfterSeconds,
            },
            { status: 429, headers: { "retry-after": String(lockout.retryAfterSeconds) } },
          );
        }

        // Timing-safe comparison: if username mismatches, run scrypt against dummy hash
        const usernameOk = username === expectedUsername;
        let passwordOk = false;
        if (usernameOk) {
          passwordOk = verifyPassword(password, passwordHash);
        } else {
          verifyPassword(password, DUMMY_SCRYPT_HASH);
        }

        if (!usernameOk || !passwordOk) {
          await recordAdminAttempt(admin, keyHash, "password", false);
          await logAdminAction(admin, {
            action: "admin.login_fail",
            targetType: "system",
            detail: { stage: "password" },
            request,
          });
          return errorResponse(401, "invalid_credentials", "Invalid credentials");
        }

        // Password passed
        await recordAdminAttempt(admin, keyHash, "password", true);

        // Check if 2FA is enrolled
        const security = await getAdminSecurity(admin);
        const twoFactorEnrolled = security.totp_enabled_at !== null;

        // Issue 5-minute admin_pending cookie
        const isHttps = isHttpsRequest(request, getRequestHeader("x-forwarded-proto"));
        const pendingToken = createAdminPendingToken(username, sessionSecret);
        setResponseHeader("set-cookie", serializeAdminPendingCookie(pendingToken, isHttps));

        if (!twoFactorEnrolled) {
          return Response.json({ step: "enroll" });
        }

        return Response.json({ step: "totp" });
      },
    },
  },
});
