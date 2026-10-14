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
  getAdminSecurity,
  updateLastTotpStep,
  verifyAndConsumeRecoveryCode,
} from "@/lib/admin/security-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAdminAction } from "@/server/admin-audit";
import {
  checkAdminLockout,
  computeAdminKeyHash,
  recordAdminAttempt,
} from "@/server/admin-rate-limit";

function errorResponse(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return Response.json({ error: { code, message, ...extra } }, { status });
}

export const Route = createFileRoute("/api/admin/login/totp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { sessionSecret } = getAdminEnv();
        const admin = createSupabaseAdminClient();
        const clientIp = getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
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

        const username = pendingResult.payload.username;

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

        const keyHash = computeAdminKeyHash(clientIp, username, sessionSecret);

        // Lockout check before verifying TOTP/recovery code
        const lockout = await checkAdminLockout(admin, keyHash, "totp");
        if (lockout.locked) {
          await logAdminAction(admin, {
            action: "admin.login_locked",
            targetType: "system",
            detail: { stage: "totp" },
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

        const security = await getAdminSecurity(admin);
        if (!security.totp_enabled_at || !security.totp_secret_enc) {
          return errorResponse(400, "2fa_not_enrolled", "Two-factor authentication is not enrolled");
        }

        const trimmedCode = code.trim();
        let authOk = false;
        let usedRecovery = false;

        // Try TOTP code first if 6 digits
        if (/^\d{6}$/.test(trimmedCode)) {
          try {
            const rawSecret = decryptTotpSecret(security.totp_secret_enc);
            const totpResult = verifyTotpCode(rawSecret, trimmedCode, {
              lastStep: security.last_totp_step,
            });

            if (totpResult.ok && totpResult.step !== undefined) {
              authOk = true;
              await updateLastTotpStep(admin, totpResult.step);
            }
          } catch (e) {
            console.warn("Error verifying TOTP code:", e);
          }
        }

        // If not valid TOTP, try recovery code
        if (!authOk) {
          const recoveryMatch = await verifyAndConsumeRecoveryCode(admin, trimmedCode);
          if (recoveryMatch) {
            authOk = true;
            usedRecovery = true;
            await logAdminAction(admin, {
              action: "admin.recovery_used",
              targetType: "system",
              request,
            });
          }
        }

        if (!authOk) {
          await recordAdminAttempt(admin, keyHash, "totp", false);
          await logAdminAction(admin, {
            action: "admin.login_fail",
            targetType: "system",
            detail: { stage: "totp" },
            request,
          });
          return errorResponse(401, "invalid_code", "Invalid verification code");
        }

        // Record successful login
        await recordAdminAttempt(admin, keyHash, "totp", true);
        await logAdminAction(admin, {
          action: "admin.login_ok",
          targetType: "system",
          detail: { usedRecovery },
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

        return Response.json({ ok: true, usedRecovery });
      },
    },
  },
});
