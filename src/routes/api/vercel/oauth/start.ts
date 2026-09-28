import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { getAppOrigin } from "@/config/app";
import { createOAuthState } from "@/lib/oauth-state";
import { buildVercelAuthorizeUrl } from "@/server/vercel/oauth";

/**
 * Not a JSON endpoint — the UI should navigate the top-level window here
 * (`window.location.href = ...`), not `fetch()` it. See API.md.
 *
 * A misconfigured/missing Vercel OAuth integration (OAUTH_VERCEL_CLIENT_ID/
 * SECRET unset — a real gap in local dev, see .env.example) must never
 * surface as a raw unhandled-exception page here: this is a full-page
 * navigation, so whatever this returns is literally what the user sees.
 */
export const Route = createFileRoute("/api/vercel/oauth/start")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: ({ context }) => {
        const { user } = context as AuthedContext;
        try {
          const state = createOAuthState(user.id);
          return Response.redirect(buildVercelAuthorizeUrl(state), 302);
        } catch {
          return Response.redirect(`${getAppOrigin()}/studio?vercel_error=not_configured`, 302);
        }
      },
    },
  },
});
