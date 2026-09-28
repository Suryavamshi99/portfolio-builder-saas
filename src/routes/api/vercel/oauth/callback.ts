import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { getAppOrigin } from "@/config/app";
import { verifyOAuthState } from "@/lib/oauth-state";
import { exchangeVercelCode, fetchVercelUsername, VercelOAuthError } from "@/server/vercel/oauth";
import { bufferToBytea, encryptSecret } from "@/lib/crypto";

/**
 * Vercel redirects the browser here after the user approves the
 * connection. Requires an active session (authMiddleware) AND the
 * embedded state's userId to match it — the state alone is never treated
 * as authorization, per the framework's own auth guidance.
 */
export const Route = createFileRoute("/api/vercel/oauth/callback")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ request, context }) => {
        const { user, supabase } = context as AuthedContext;
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");

        // This whole flow is a full-page navigation (Vercel redirects the
        // browser here directly) — every failure branch must redirect back
        // into the app with an error the UI can show, never return raw JSON,
        // or the user just sees an unstyled error blob instead of the app.
        if (!code || !state || !verifyOAuthState(state, user.id)) {
          return Response.redirect(`${getAppOrigin()}/studio?vercel_error=invalid_state`, 302);
        }

        let accessToken: string;
        let teamId: string | null;
        try {
          const result = await exchangeVercelCode(code);
          accessToken = result.accessToken;
          teamId = result.teamId;
        } catch (e) {
          console.error("Vercel OAuth code exchange failed:", e instanceof VercelOAuthError ? e.message : e);
          return Response.redirect(`${getAppOrigin()}/studio?vercel_error=oauth_failed`, 302);
        }

        const username = await fetchVercelUsername(accessToken, teamId);
        const { ciphertext, nonce } = encryptSecret(accessToken);

        const { error } = await supabase.from("vercel_connections").upsert(
          {
            user_id: user.id,
            encrypted_access_token: bufferToBytea(ciphertext),
            nonce: bufferToBytea(nonce),
            vercel_username: username,
            team_id: teamId,
          },
          { onConflict: "user_id" },
        );

        if (error) {
          return Response.redirect(`${getAppOrigin()}/studio?vercel_error=save_failed`, 302);
        }

        return Response.redirect(`${getAppOrigin()}/studio?vercel=connected`, 302);
      },
    },
  },
});
