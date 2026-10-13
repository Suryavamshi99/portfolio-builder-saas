import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createOAuthState } from "@/lib/oauth-state";
import { installUrl } from "@/server/github/app";

export const Route = createFileRoute("/api/github/status")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ context }) => {
        const { user } = context as AuthedContext;

        const admin = createSupabaseAdminClient();
        const { data } = await admin
          .from("github_connections")
          .select("account_login, created_at")
          .eq("user_id", user.id)
          .maybeSingle();

        const state = createOAuthState(user.id);
        const url = installUrl(state);

        if (!data) {
          return Response.json({
            connected: false,
            account: null,
            installUrl: url,
          });
        }

        return Response.json({
          connected: true,
          account: data.account_login,
          installUrl: url,
        });
      },
    },
  },
});
