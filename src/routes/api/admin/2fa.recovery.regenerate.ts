import { createFileRoute } from "@tanstack/react-router";

import { adminMiddleware, requireStepUp } from "@/server/admin-middleware";
import type { AdminSessionPayload } from "@/lib/admin/session";
import { regenerateRecoveryCodes } from "@/lib/admin/security-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAdminAction } from "@/server/admin-audit";

export const Route = createFileRoute("/api/admin/2fa/recovery/regenerate")({
  server: {
    middleware: [adminMiddleware],
    handlers: {
      POST: async ({ request, context }) => {
        const session = (context as { adminSession?: AdminSessionPayload })?.adminSession;
        const stepUpError = requireStepUp(session);
        if (stepUpError) return stepUpError;

        const admin = createSupabaseAdminClient();
        const recoveryCodes = await regenerateRecoveryCodes(admin);

        await logAdminAction(admin, {
          action: "admin.recovery_regenerated",
          targetType: "system",
          request,
        });

        return Response.json({ recoveryCodes });
      },
    },
  },
});
