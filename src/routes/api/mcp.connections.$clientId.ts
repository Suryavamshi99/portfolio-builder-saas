import { createFileRoute } from "@tanstack/react-router";
import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revokeConnection } from "@/server/mcp/store";

// Disconnects a connected app: all its tokens for this user stop working at once.
export const Route = createFileRoute("/api/mcp/connections/$clientId")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      DELETE: async ({ params, context }) => {
        const { user } = context as AuthedContext;
        await revokeConnection(createSupabaseAdminClient(), user.id, params.clientId);
        return Response.json({ ok: true });
      },
    },
  },
});
