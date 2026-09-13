import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";

/**
 * Disconnects locally only — does not call Vercel to revoke the token
 * (its exact revocation endpoint wasn't confirmed at implementation time;
 * see src/config/vercel.ts). The token stays valid on Vercel's side until
 * it expires or the user revokes access from their own Vercel account
 * settings. Deleting our copy is what actually matters here: we can no
 * longer deploy on their behalf either way.
 */
export const Route = createFileRoute("/api/vercel")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      DELETE: async ({ context }) => {
        const { user, supabase } = context as AuthedContext;
        await supabase.from("vercel_connections").delete().eq("user_id", user.id);
        return new Response(null, { status: 204 });
      },
    },
  },
});
