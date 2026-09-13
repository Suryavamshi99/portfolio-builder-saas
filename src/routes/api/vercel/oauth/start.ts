import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { createOAuthState } from "@/lib/oauth-state";
import { buildVercelAuthorizeUrl } from "@/server/vercel/oauth";

/**
 * Not a JSON endpoint — the UI should navigate the top-level window here
 * (`window.location.href = ...`), not `fetch()` it. See API.md.
 */
export const Route = createFileRoute("/api/vercel/oauth/start")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: ({ context }) => {
        const { user } = context as AuthedContext;
        const state = createOAuthState(user.id);
        return Response.redirect(buildVercelAuthorizeUrl(state), 302);
      },
    },
  },
});
