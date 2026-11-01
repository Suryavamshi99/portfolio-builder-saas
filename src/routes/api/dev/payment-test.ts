import { randomUUID } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { getAppOrigin } from "@/config/app";
import { isDemoPaymentUser, isDummyPaymentModeEnabled, usesDummyCheckout } from "@/config/payment-test";
import { PRO_PRICE_USD } from "@/config/plans";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { grantProAccess } from "@/server/payments";

/**
 * Stand-in for Dodo's hosted checkout, used only when
 * PAYMENT_TEST_MODE=dummy (see src/config/payment-test.ts — non-production
 * only). Lets you exercise the full paywall → publish flow — including the
 * failure path, which is awkward to trigger against Dodo's real test mode —
 * without leaving the app. Deliberately unstyled; this is a test fixture,
 * not a page anyone but the developer running it ever sees.
 *
 * 404s (not just a permission error) when disabled, matching the "no trace
 * it exists" posture the /admin panel already uses for its own hidden route.
 */
function notFound() {
  return new Response("Not found", { status: 404 });
}

function safeReturnUrl(raw: string | null): string {
  const fallback = `${getAppOrigin()}/settings?upgrade=pending`;
  if (!raw) return fallback;
  return raw.startsWith(getAppOrigin()) ? raw : fallback;
}

export const Route = createFileRoute("/api/dev/payment-test")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ request, context }) => {
        const { user } = context as AuthedContext;
        if (!usesDummyCheckout(user.id)) return notFound();
        const demo = isDemoPaymentUser(user.id);

        const returnUrl = safeReturnUrl(new URL(request.url).searchParams.get("returnUrl"));
        const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Demo payment</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 32rem; margin: 4rem auto; padding: 0 1rem;">
  <h1>${demo ? "Demo checkout" : "Test-mode checkout"}</h1>
  <p>${demo ? "Demo account: no real charge is made." : "PAYMENT_TEST_MODE=dummy is set"} — this stands in for Dodo's real checkout so you can simulate either outcome. One-time Pro unlock: $${PRO_PRICE_USD}.</p>
  <form method="POST" action="/api/dev/payment-test" style="display:inline">
    <input type="hidden" name="returnUrl" value="${returnUrl}">
    <input type="hidden" name="outcome" value="success">
    ${demo ? '<label>Card number <input name="card" inputmode="numeric" value="" placeholder="0000000000" style="padding:0.5rem;font-size:1rem;"></label><br><br>' : ""}
    <button type="submit" style="padding:0.75rem 1.5rem;font-size:1rem;">Success</button>
  </form>
  <form method="POST" action="/api/dev/payment-test" style="display:inline;margin-left:0.5rem">
    <input type="hidden" name="returnUrl" value="${returnUrl}">
    <input type="hidden" name="outcome" value="fail">
    <button type="submit" style="padding:0.75rem 1.5rem;font-size:1rem;">Fail</button>
  </form>
</body>
</html>`;
        return new Response(html, { headers: { "content-type": "text/html" } });
      },

      POST: async ({ request, context }) => {
        const { user } = context as AuthedContext;
        if (!usesDummyCheckout(user.id)) return notFound();
        const demo = isDemoPaymentUser(user.id);
        const form = await request.formData();
        const outcome = form.get("outcome");
        const returnUrl = safeReturnUrl(form.get("returnUrl")?.toString() ?? null);

        const cardOk = !demo || form.get("card")?.toString().trim() === "0000000000";
        if (outcome === "success" && !cardOk) {
          const badUrl = new URL(returnUrl);
          badUrl.searchParams.set("upgrade", "failed");
          return Response.redirect(badUrl.toString(), 303);
        }

        if (outcome === "success") {
          const admin = createSupabaseAdminClient();
          await grantProAccess(admin, {
            userId: user.id,
            // "demo_" ids and a zero amount keep demo grants out of revenue counts.
            paymentId: `${demo ? "demo" : "dummy"}_${randomUUID()}`,
            amountCents: demo ? 0 : PRO_PRICE_USD * 100,
            currency: "USD",
          });
          return Response.redirect(returnUrl, 303);
        }

        const failUrl = new URL(returnUrl);
        failUrl.searchParams.set("upgrade", "failed");
        return Response.redirect(failUrl.toString(), 303);
      },
    },
  },
});
