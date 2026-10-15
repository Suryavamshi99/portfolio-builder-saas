import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { getOrCreateAppUser, hasPaidAccess } from "@/server/users";
import { hasHostingAccess } from "@/server/billing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PLAN_STORAGE_QUOTA_BYTES } from "@/config/plans";

export const Route = createFileRoute("/api/me")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ context }) => {
        const { user, supabase } = context as AuthedContext;

        const appUser = await getOrCreateAppUser(supabase, user.id);
        if (!appUser) {
          return Response.json(
            { error: { code: "internal_error", message: "Could not load account" } },
            { status: 500 },
          );
        }

        const [{ data: uploads }, { data: vercelConnection }] = await Promise.all([
          supabase.from("uploads").select("size_bytes").eq("user_id", user.id),
          supabase
            .from("vercel_connections")
            .select("user_id")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        const admin = createSupabaseAdminClient();
        const [hostingActive, { data: hostingRow }] = await Promise.all([
          hasHostingAccess(admin, appUser),
          admin
            .from("hosting_subscriptions")
            .select("status, current_period_end, grace_until")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        const usedBytes =(uploads ?? []).reduce((sum, row) => sum + row.size_bytes, 0);

        return Response.json({
          id: appUser.id,
          email: user.email,
          plan: appUser.plan,
          isAdmin: appUser.isAdmin,
          hasPaidAccess: hasPaidAccess(appUser),
          hosting: {
            active: hostingActive,
            status: hostingRow?.status ?? null,
            renewsOn: hostingRow?.current_period_end ?? null,
            endsOn: hostingRow?.grace_until ?? null,
          },
          createdAt: appUser.createdAt,
          storage: { usedBytes, quotaBytes: PLAN_STORAGE_QUOTA_BYTES[appUser.plan] },
          vercel: { connected: vercelConnection != null },
        });
      },
    },
  },
});
