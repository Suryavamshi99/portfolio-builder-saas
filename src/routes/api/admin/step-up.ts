import { createFileRoute } from "@tanstack/react-router";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";

import { adminMiddleware } from "@/server/admin-middleware";
import { getAdminEnv } from "@/lib/admin/env";
import { verifyPassword } from "@/lib/admin/password";
import {
  type AdminSessionPayload,
  createAdminSessionToken,
  isHttpsRequest,
  serializeAdminSessionCookie,
  STEP_UP_TTL_MS,
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

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export const Route = createFileRoute("/api/admin/step-up")({
  server: {
    middleware: [adminMiddleware],
    handlers: {
      POST: async ({ request, context }) => {
        const session = (context as { adminSession?: AdminSessionPayload })?.adminSession;
        if (!session) {
          return errorResponse(401, "unauthorized", "Admin sign-in required");
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
        const { password, code } = body as { password?: unknown; code?: unknown };
        if (typeof password !== "string" || typeof code !== "string" || !password || !code.trim()) {
          return errorResponse(400, "invalid_body", "password and code are required");
        }

        const admin = createSupabaseAdminClient();
        const clientIp = getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        const { username, passwordHash, sessionSecret } = getAdminEnv();
        const keyHash = computeAdminKeyHash(clientIp, username, sessionSecret);

        // Check lockout for password stage
        const passwordLockout = await checkAdminLockout(admin, keyHash, "password");
        if (passwordLockout.locked) {
          await logAdminAction(admin, {
            action: "admin.login_locked",
            targetType: "system",
            detail: { stage: "password", stepUp: true },
            request,
          });
          return Response.json(
            {
              error: { code: "locked", message: "Too many failed attempts. Try again later." },
              retryAfterSeconds: passwordLockout.retryAfterSeconds,
            },
            { status: 429, headers: { "retry-after": String(passwordLockout.retryAfterSeconds) } },
          );
        }

        // Check password
        const passwordOk = verifyPassword(password, passwordHash);
        if (!passwordOk) {
          await recordAdminAttempt(admin, keyHash, "password", false);
          await logAdminAction(admin, {
            action: "admin.login_fail",
            targetType: "system",
            detail: { stage: "password", stepUp: true },
            request,
          });
          return errorResponse(401, "invalid_credentials", "Invalid credentials");
        }
        await recordAdminAttempt(admin, keyHash, "password", true);

        // Check lockout for totp stage
        const totpLockout = await checkAdminLockout(admin, keyHash, "totp");
        if (totpLockout.locked) {
          await logAdminAction(admin, {
            action: "admin.login_locked",
            targetType: "system",
            detail: { stage: "totp", stepUp: true },
            request,
          });
          return Response.json(
            {
              error: { code: "locked", message: "Too many failed attempts. Try again later." },
              retryAfterSeconds: totpLockout.retryAfterSeconds,
            },
            { status: 429, headers: { "retry-after": String(totpLockout.retryAfterSeconds) } },
          );
        }

        const security = await getAdminSecurity(admin);
        if (!security.totp_enabled_at || !security.totp_secret_enc) {
          return errorResponse(400, "2fa_not_enrolled", "Two-factor authentication is not enrolled");
        }

        const trimmedCode = code.trim();
        let codeOk = false;

        // Try TOTP code first
        if (/^\d{6}$/.test(trimmedCode)) {
          try {
            const rawSecret = decryptTotpSecret(security.totp_secret_enc);
            const totpResult = verifyTotpCode(rawSecret, trimmedCode, {
              lastStep: security.last_totp_step,
            });
            if (totpResult.ok && totpResult.step !== undefined) {
              codeOk = true;
              await updateLastTotpStep(admin, totpResult.step);
            }
          } catch (e) {
            console.warn("Error verifying TOTP code during step-up:", e);
          }
        }

        // Try recovery code fallback
        if (!codeOk) {
          const recoveryMatch = await verifyAndConsumeRecoveryCode(admin, trimmedCode);
          if (recoveryMatch) {
            codeOk = true;
            await logAdminAction(admin, {
              action: "admin.recovery_used",
              targetType: "system",
              detail: { stepUp: true },
              request,
            });
          }
        }

        if (!codeOk) {
          await recordAdminAttempt(admin, keyHash, "totp", false);
          await logAdminAction(admin, {
            action: "admin.login_fail",
            targetType: "system",
            detail: { stage: "totp", stepUp: true },
            request,
          });
          return errorResponse(401, "invalid_code", "Invalid verification code");
        }

        await recordAdminAttempt(admin, keyHash, "totp", true);

        // Step-up succeeded: grant 5-minute step-up window
        const now = Date.now();
        const stepUpUntil = now + STEP_UP_TTL_MS;
        const updatedPayload: AdminSessionPayload = {
          ...session,
          seen: now,
          stepUpUntil,
        };

        const isHttps = isHttpsRequest(request, getRequestHeader("x-forwarded-proto"));
        const updatedToken = createAdminSessionToken(updatedPayload, sessionSecret);
        setResponseHeader("set-cookie", serializeAdminSessionCookie(updatedToken, isHttps));

        await logAdminAction(admin, {
          action: "admin.step_up",
          targetType: "system",
          request,
        });

        return Response.json({
          ok: true,
          stepUpUntil: new Date(stepUpUntil).toISOString(),
        });
      },
    },
  },
});
