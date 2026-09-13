import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";

export const Route = createFileRoute("/api/vercel/status")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ context }) => {
        const { user, supabase } = context as AuthedContext;

        const { data } = await supabase
          .from("vercel_connections")
          .select("vercel_username, connected_at")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!data) return Response.json({ connected: false });

        return Response.json({
          connected: true,
          vercelUsername: data.vercel_username,
          connectedAt: data.connected_at,
        });
      },
    },
  },
});
