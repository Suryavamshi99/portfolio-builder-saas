import { createFileRoute } from "@tanstack/react-router";
import { getRequestHeader } from "@tanstack/react-start/server";
import { parse as parseCookieHeader } from "cookie";

import { getAdminEnv } from "@/lib/admin/env";
import {
  ADMIN_PENDING_COOKIE,
  ADMIN_PENDING_COOKIE_HOST,
  getAdminPendingCookieName,
  isHttpsRequest,
  verifyAdminPendingToken,
} from "@/lib/admin/session";
import { generateTotpSecret, getTotpUri } from "@/lib/admin/totp";
import { getAdminSecurity, savePendingTotpSecret } from "@/lib/admin/security-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export const Route = createFileRoute("/api/admin/2fa/enroll/start")({
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

        const security = await getAdminSecurity(admin);
        if (security.totp_enabled_at) {
          return errorResponse(400, "already_enrolled", "Two-factor authentication is already enrolled");
        }

        const secret = generateTotpSecret();
        await savePendingTotpSecret(admin, secret);

        const otpauthUri = getTotpUri(pendingResult.payload.username, secret);

        return Response.json({ otpauthUri, secret });
      },
    },
  },
});
