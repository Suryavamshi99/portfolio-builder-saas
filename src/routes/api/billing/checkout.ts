import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { getAppOrigin } from "@/config/app";
import { createProCheckoutSession, DodoCheckoutError } from "@/server/dodo/checkout";

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

/**
 * Creates a Dodo hosted checkout session for the one-time Pro unlock and
 * returns its URL — not a redirect itself. The actual plan flip happens
 * out-of-band via POST /api/webhooks/dodo once Dodo confirms payment, not
 * from this call or from the return_url redirect (which a user could reach
 * without having actually paid, by editing the URL).
 */
export const Route = createFileRoute("/api/billing/checkout")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      POST: async ({ context }) => {
        const { user } = context as AuthedContext;

        if (!user.email) {
          return errorResponse(400, "email_required", "Your account has no email on file");
        }

        try {
          const { checkoutUrl } = await createProCheckoutSession({
            userId: user.id,
            email: user.email,
            returnUrl: `${getAppOrigin()}/settings?upgrade=pending`,
          });
          return Response.json({ checkoutUrl });
        } catch (e) {
          const message = e instanceof DodoCheckoutError ? e.message : String(e);
          return errorResponse(502, "checkout_failed", message);
        }
      },
    },
  },
});
