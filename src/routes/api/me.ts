import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { PLAN_STORAGE_QUOTA_BYTES, type Plan } from "@/config/plans";

export const Route = createFileRoute("/api/me")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ context }) => {
        const { user, supabase } = context as AuthedContext;

        // Lazily provision the app-level user record on first call.
        const { data: userRow, error: userError } = await supabase
          .from("users")
          .upsert({ id: user.id }, { onConflict: "id" })
          .select("id, plan, created_at")
          .single();

        if (userError || !userRow) {
          return Response.json(
            { error: { code: "internal_error", message: "Could not load account" } },
            { status: 500 },
          );
        }

        const plan = userRow.plan as Plan;

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
          id: userRow.id,
          email: user.email,
          plan,
          createdAt: userRow.created_at,
          storage: { usedBytes, quotaBytes: PLAN_STORAGE_QUOTA_BYTES[plan] },
          vercel: { connected: vercelConnection != null },
        });
      },
    },
  },
});
