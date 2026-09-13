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

        if (!code || !state || !verifyOAuthState(state, user.id)) {
          return Response.json(
            { error: { code: "invalid_oauth_state", message: "OAuth state missing, expired, or mismatched" } },
            { status: 400 },
          );
        }

        let accessToken: string;
        try {
          const result = await exchangeVercelCode(code);
          accessToken = result.accessToken;
        } catch (e) {
          const message = e instanceof VercelOAuthError ? e.message : String(e);
          return Response.json({ error: { code: "vercel_oauth_failed", message } }, { status: 502 });
        }

        const username = await fetchVercelUsername(accessToken);
        const { ciphertext, nonce } = encryptSecret(accessToken);

        const { error } = await supabase.from("vercel_connections").upsert(
          {
            user_id: user.id,
            encrypted_access_token: bufferToBytea(ciphertext),
            nonce: bufferToBytea(nonce),
            vercel_username: username,
          },
          { onConflict: "user_id" },
        );

        if (error) {
          return Response.json(
            { error: { code: "internal_error", message: "Could not save Vercel connection" } },
            { status: 500 },
          );
        }

        // Placeholder destination — Antigravity owns the actual "connected" page.
        return Response.redirect(`${getAppOrigin()}/?vercel=connected`, 302);
      },
    },
  },
});
