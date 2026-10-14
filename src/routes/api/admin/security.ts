import { createFileRoute } from "@tanstack/react-router";

import { adminMiddleware } from "@/server/admin-middleware";
import { getAdminSecurity } from "@/lib/admin/security-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const Route = createFileRoute("/api/admin/security")({
  server: {
    middleware: [adminMiddleware],
    handlers: {
      GET: async () => {
        const admin = createSupabaseAdminClient();
        const security = await getAdminSecurity(admin);

        const { data: attempts } = await admin
          .from("admin_login_attempts")
          .select("created_at, stage, ok")
          .order("created_at", { ascending: false })
          .limit(20);

        const recentAttempts = (attempts ?? []).map((row) => ({
          createdAt: row.created_at,
          stage: row.stage as "password" | "totp",
          ok: Boolean(row.ok),
        }));

        return Response.json({
          twoFactorEnabledAt: security.totp_enabled_at,
          recoveryCodesLeft: security.recovery_hashes?.length ?? 0,
          recentAttempts,
        });
      },
    },
  },
});
