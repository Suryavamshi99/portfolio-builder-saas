import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { getAppOrigin } from "@/config/app";
import { createOAuthState } from "@/lib/oauth-state";
import { buildVercelAuthorizeUrl } from "@/server/vercel/oauth";
import { getOrCreateAppUser, hasPaidAccess } from "@/server/users";

/**
 * Not a JSON endpoint — the UI should navigate the top-level window here
 * (`window.location.href = ...`), not `fetch()` it. See API.md.
 *
 * A misconfigured/missing Vercel OAuth integration (OAUTH_VERCEL_CLIENT_ID/
 * SECRET unset — a real gap in local dev, see .env.example) must never
 * surface as a raw unhandled-exception page here: this is a full-page
 * navigation, so whatever this returns is literally what the user sees.
 *
 * Payment gate lives here too, not just on /api/publish and in the UI:
 * connecting a Vercel account is meaningless before paying (nothing can be
 * deployed to it either way), and the product requirement is that BOTH
 * connecting and deploying only happen after a successful payment — this
 * endpoint is reachable by direct navigation, so hiding the "Connect
 * Vercel" button in the UI alone would not actually enforce that.
 */
export const Route = createFileRoute("/api/vercel/oauth/start")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ context }) => {
        const { user, supabase } = context as AuthedContext;

        const appUser = await getOrCreateAppUser(supabase, user.id);
        if (!appUser || !hasPaidAccess(appUser)) {
          return Response.redirect(`${getAppOrigin()}/studio?vercel_error=payment_required`, 302);
        }

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
