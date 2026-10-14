import { createFileRoute } from "@tanstack/react-router";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { parse as parseCookieHeader, serialize as serializeCookie } from "cookie";

import { getAdminEnv } from "@/lib/admin/env";
import {
  ADMIN_PENDING_COOKIE,
  ADMIN_PENDING_COOKIE_HOST,
  createAdminSessionToken,
  getAdminPendingCookieName,
  isHttpsRequest,
  serializeAdminSessionCookie,
  SESSION_TTL_MS,
  verifyAdminPendingToken,
} from "@/lib/admin/session";
import { verifyTotpCode } from "@/lib/admin/totp";
import {
  decryptTotpSecret,
  enableTotp,
  generateRecoveryCodes,
  getAdminSecurity,
} from "@/lib/admin/security-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAdminAction } from "@/server/admin-audit";

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export const Route = createFileRoute("/api/admin/2fa/enroll/confirm")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { sessionSecret } = getAdminEnv();
        const admin = createSupabaseAdminClient();
        const isHttps = isHttpsRequest(request, getRequestHeader("x-forwarded-proto"));

        // Verify pending cookie
        const cookieHeader = getRequestHeader("cookie");
        const cookies = cookieHeader ? parseCookieHeader(cookieHeader) : {};
        const pendingCookieName = getAdminPendingCookieName(isHttps);
        const pendingToken = cookies[pendingCookieName] || cookies[ADMIN_PENDING_COOKIE_HOST] || cookies[ADMIN_PENDING_COOKIE];

        const pendingResult = verifyAdminPendingToken(pendingToken, sessionSecret);
        if (!pendingResult.valid || !pendingResult.payload) {
          return errorResponse(401, "pending_required", "Pending sign-in required");
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
        const { code } = body as { code?: unknown };
        if (typeof code !== "string" || !code.trim()) {
          return errorResponse(400, "invalid_body", "code is required");
        }

        const security = await getAdminSecurity(admin);
        // Once 2FA is on, this route must never act as a second login door (no lockout, no replay guard here).
        if (security.totp_enabled_at) {
          return errorResponse(400, "already_enrolled", "Two-factor authentication is already enrolled");
        }
        if (!security.totp_secret_enc) {
          return errorResponse(400, "no_pending_secret", "Enrollment must be started before confirming");
        }

        const rawSecret = decryptTotpSecret(security.totp_secret_enc);
        const verifyResult = verifyTotpCode(rawSecret, code.trim());

        if (!verifyResult.ok || verifyResult.step === undefined) {
          return errorResponse(401, "invalid_code", "Invalid verification code");
        }

        // Generate recovery codes and enable 2FA
        const { plaintextCodes, hashes } = generateRecoveryCodes();
        await enableTotp(admin, hashes, verifyResult.step);

        // Audit events
        await logAdminAction(admin, {
          action: "admin.2fa_enrolled",
          targetType: "system",
          request,
        });
        await logAdminAction(admin, {
          action: "admin.login_ok",
          targetType: "system",
          detail: { enrolled: true },
          request,
        });

        // Issue full session cookie and clear pending cookies
        const now = Date.now();
        const sessionToken = createAdminSessionToken(
          {
            iat: now,
            exp: now + SESSION_TTL_MS,
            seen: now,
            epoch: security.session_epoch,
            stepUpUntil: null,
          },
          sessionSecret,
        );

        const sessionCookie = serializeAdminSessionCookie(sessionToken, isHttps);
        const clearPendingHost = serializeCookie(ADMIN_PENDING_COOKIE_HOST, "", {
          httpOnly: true,
          secure: isHttps,
          sameSite: "strict",
          path: "/",
          maxAge: 0,
        });
        const clearPendingPlain = serializeCookie(ADMIN_PENDING_COOKIE, "", {
          httpOnly: true,
          secure: isHttps,
          sameSite: "strict",
          path: "/",
          maxAge: 0,
        });

        setResponseHeader("set-cookie", [sessionCookie, clearPendingHost, clearPendingPlain]);

        return Response.json({ recoveryCodes: plaintextCodes });
      },
    },
  },
});
