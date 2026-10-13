import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { getAppOrigin } from "@/config/app";
import { verifyOAuthState } from "@/lib/oauth-state";
import { getInstallation, GithubError } from "@/server/github/app";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const Route = createFileRoute("/api/github/callback")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ request, context }) => {
        const { user } = context as AuthedContext;
        const url = new URL(request.url);
        const installationIdRaw = url.searchParams.get("installation_id");
        const state = url.searchParams.get("state");

        if (!installationIdRaw || !state || !verifyOAuthState(state, user.id)) {
          return Response.redirect(`${getAppOrigin()}/studio?github_error=invalid_state`, 302);
        }

        const installationId = Number(installationIdRaw);
        if (!Number.isSafeInteger(installationId) || installationId <= 0) {
          return Response.redirect(`${getAppOrigin()}/studio?github_error=invalid_installation`, 302);
        }

        let accountLogin: string;
        try {
          const result = await getInstallation(installationId);
          accountLogin = result.account_login;
        } catch (e) {
          console.error("GitHub getInstallation failed in callback:", e instanceof GithubError ? e.message : e);
          return Response.redirect(`${getAppOrigin()}/studio?github_error=installation_failed`, 302);
        }

        const admin = createSupabaseAdminClient();
        const { error } = await admin.from("github_connections").upsert(
          {
            user_id: user.id,
            installation_id: installationId,
            account_login: accountLogin,
          },
          { onConflict: "user_id" },
        );

        if (error) {
          console.error("Failed to save github_connections:", error.message);
          return Response.redirect(`${getAppOrigin()}/studio?github_error=save_failed`, 302);
        }

        return Response.redirect(`${getAppOrigin()}/studio?github=connected`, 302);
      },
    },
  },
});
