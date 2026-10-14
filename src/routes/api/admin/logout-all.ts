import { createFileRoute } from "@tanstack/react-router";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";

import { adminMiddleware, requireStepUp } from "@/server/admin-middleware";
import { isHttpsRequest, serializeClearAdminCookies, type AdminSessionPayload } from "@/lib/admin/session";
import { bumpSessionEpoch } from "@/lib/admin/security-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAdminAction } from "@/server/admin-audit";

export const Route = createFileRoute("/api/admin/logout-all")({
  server: {
    middleware: [adminMiddleware],
    handlers: {
      POST: async ({ request, context }) => {
        const session = (context as { adminSession?: AdminSessionPayload })?.adminSession;
        const stepUpError = requireStepUp(session);
        if (stepUpError) return stepUpError;

        const admin = createSupabaseAdminClient();
        await bumpSessionEpoch(admin);

        await logAdminAction(admin, {
          action: "admin.logout_all",
          targetType: "system",
          request,
        });

        const isHttps = isHttpsRequest(request, getRequestHeader("x-forwarded-proto"));
        setResponseHeader("set-cookie", serializeClearAdminCookies(isHttps));

        return Response.json({ ok: true });
      },
    },
  },
});
