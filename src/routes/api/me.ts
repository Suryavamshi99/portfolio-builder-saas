import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { getOrCreateAppUser } from "@/server/users";
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

        const usedBytes = (uploads ?? []).reduce((sum, row) => sum + row.size_bytes, 0);

        return Response.json({
          id: appUser.id,
          email: user.email,
          plan: appUser.plan,
          createdAt: appUser.createdAt,
          storage: { usedBytes, quotaBytes: PLAN_STORAGE_QUOTA_BYTES[appUser.plan] },
          vercel: { connected: vercelConnection != null },
        });
      },
    },
  },
});
