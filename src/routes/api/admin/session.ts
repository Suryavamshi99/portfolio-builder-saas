import { createFileRoute } from "@tanstack/react-router";

import { adminMiddleware } from "@/server/admin-middleware";
import { IDLE_TIMEOUT_MS, type AdminSessionPayload } from "@/lib/admin/session";
import { getAdminSecurity } from "@/lib/admin/security-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const Route = createFileRoute("/api/admin/session")({
  server: {
    middleware: [adminMiddleware],
    handlers: {
      GET: async ({ context }) => {
        const session = (context as { adminSession?: AdminSessionPayload })?.adminSession;
        const admin = createSupabaseAdminClient();
        const security = await getAdminSecurity(admin);

        const now = Date.now();
        const expiresAt = session ? new Date(session.exp).toISOString() : new Date().toISOString();
        const idleExpiresAt = session
          ? new Date(session.seen + IDLE_TIMEOUT_MS).toISOString()
          : new Date().toISOString();
        const stepUpUntil =
          session?.stepUpUntil && session.stepUpUntil > now
            ? new Date(session.stepUpUntil).toISOString()
            : null;

        return Response.json({
          authenticated: true,
          expiresAt,
          idleExpiresAt,
          stepUpUntil,
          twoFactor: Boolean(security.totp_enabled_at),
        });
      },
    },
  },
});
