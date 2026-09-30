import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { getAppOrigin } from "@/config/app";
import { isDummyPaymentModeEnabled } from "@/config/payment-test";
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
      POST: async ({ request, context }) => {
        const { user } = context as AuthedContext;

        if (!user.email) {
          return errorResponse(400, "email_required", "Your account has no email on file");
        }

        // Where to land the user after payment — Studio (so they can go
        // straight into Connect Vercel → Publish without an extra hop) or
        // Settings (the Plan & Billing card). Defaults to Settings for any
        // caller that doesn't specify one, matching the original behavior.
        const body = await request.json().catch(() => ({}) as Record<string, unknown>);
        const returnTo = body["returnTo"] === "studio" ? "studio" : "settings";
        const returnUrl = `${getAppOrigin()}/${returnTo}?upgrade=pending`;

        // PAYMENT_TEST_MODE=dummy (non-production only, see
        // isDummyPaymentModeEnabled) skips Dodo entirely and hands back a
        // same-origin page with Success/Fail buttons, so the full
        // paywall → publish flow can be tested without touching real
        // payment infra or needing to trigger Dodo test-mode failures.
        if (isDummyPaymentModeEnabled()) {
          const checkoutUrl = `${getAppOrigin()}/api/dev/payment-test?returnUrl=${encodeURIComponent(returnUrl)}`;
          return Response.json({ checkoutUrl });
        }

        try {
          const { checkoutUrl } = await createProCheckoutSession({
            userId: user.id,
            email: user.email,
            returnUrl,
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
