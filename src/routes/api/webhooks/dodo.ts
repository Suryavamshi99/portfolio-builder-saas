import { createFileRoute } from "@tanstack/react-router";

import { getDodoWebhookSecret } from "@/config/dodo";
import { verifyStandardWebhook } from "@/lib/standard-webhooks";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  applyOneTimeHosting,
  applySubscriptionEvent,
  claimWebhook,
  forgetWebhook,
  isOurProduct,
  REVOKING_EVENT_TYPES,
  revokeForPayment,
  SUBSCRIPTION_EVENT_TYPES,
  type SubscriptionEventType,
} from "@/server/billing";
import { grantProAccess } from "@/server/payments";

/**
 * Server-to-server call from Dodo — no user session, exempted from the
 * global CSRF Origin check in src/start.ts. Authenticity comes entirely
 * from the Standard Webhooks HMAC signature verified below; nothing here
 * should ever trust the request otherwise.
 *
 * Uses the service-role client deliberately: there is no authenticated
 * user making this request for RLS to scope against, and the whole point
 * is writing another user's row (whoever's payment this is) — the
 * standard per-request RLS-scoped client cannot do that by design.
 *
 * Events handled:
 *  - payment.succeeded: the first payment unlocks Pro; later ones are
 *    recorded as hosting renewals. A payment with no subscription id (India,
 *    one-time) also starts a one-year hosting term.
 *  - subscription.*: keeps hosting_subscriptions (the hosting term) in sync.
 *  - refund.succeeded / dispute.lost / dispute.accepted: takes back what the
 *    payment bought (see revokeForPayment).
 * Everything else is acknowledged and ignored.
 */
export const Route = createFileRoute("/api/webhooks/dodo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const id = request.headers.get("webhook-id");
        const timestamp = request.headers.get("webhook-timestamp");
        const signature = request.headers.get("webhook-signature");

        if (!id || !timestamp || !signature) {
          return Response.json({ error: { code: "missing_signature_headers" } }, { status: 400 });
        }

        const valid = verifyStandardWebhook({
          id,
          timestamp,
          signatureHeader: signature,
          rawBody,
          secret: getDodoWebhookSecret(),
        });
        if (!valid) {
          return Response.json({ error: { code: "invalid_signature" } }, { status: 401 });
        }

        let event: {
          type?: string;
          data?: {
            payment_id?: string;
            subscription_id?: string;
            next_billing_date?: string;
            product_id?: string;
            product_cart?: Array<{ product_id?: string }>;
            is_partial?: boolean;
            metadata?: { userId?: string };
            total_amount?: number;
            currency?: string;
            status?: string;
          };
        };
        try {
          event = JSON.parse(rawBody);
        } catch {
          return Response.json({ error: { code: "invalid_json" } }, { status: 400 });
        }

        const type = event.type ?? "";
        const handled =
          type === "payment.succeeded" || SUBSCRIPTION_EVENT_TYPES.includes(type) || REVOKING_EVENT_TYPES.includes(type);
        if (!handled) return Response.json({ received: true });

        // Only our own product may unlock anything (the Dodo account can hold others).
        // Refund and dispute events reference our payment ids, which the purchases table vouches for.
        if (!REVOKING_EVENT_TYPES.includes(type) && !isOurProduct(event.data ?? {})) {
          return Response.json({ received: true, ignored: "other_product" });
        }
        // A partial refund (e.g. goodwill) does not take back Pro or hosting.
        if (REVOKING_EVENT_TYPES.includes(type) && event.data?.is_partial === true) {
          return Response.json({ received: true, ignored: "partial_refund" });
        }

        const admin = createSupabaseAdminClient();

        try {
          // A redelivered webhook is a no-op.
          if (!(await claimWebhook(admin, id, type))) return Response.json({ received: true, duplicate: true });
        } catch {
          return Response.json({ error: { code: "internal_error" } }, { status: 500 });
        }

        try {
          if (type === "payment.succeeded") {
            const paymentId = event.data?.payment_id;
            if (!paymentId) {
              await forgetWebhook(admin, id);
              return Response.json({ error: { code: "missing_fields" } }, { status: 400 });
            }

            // metadata.userId comes from our own checkout session; fall back to the
            // subscription row when Dodo does not copy it onto a renewal payment.
            let userId = event.data?.metadata?.userId;
            if (!userId && event.data?.subscription_id) {
              const { data: sub } = await admin
                .from("hosting_subscriptions")
                .select("user_id")
                .eq("dodo_subscription_id", event.data.subscription_id)
                .maybeSingle();
              userId = sub?.user_id as string | undefined;
            }
            if (!userId) {
              // 500 so Dodo retries: the subscription row may simply not exist yet.
              await forgetWebhook(admin, id);
              return Response.json({ error: { code: "unknown_user" } }, { status: 500 });
            }

            // The first successful payment buys Pro; any later one is a hosting renewal.
            const { data: priorPro } = await admin
              .from("purchases")
              .select("id")
              .eq("user_id", userId)
              .eq("kind", "pro")
              .is("refunded_at", null)
              .limit(1);
            await grantProAccess(admin, {
              userId,
              paymentId,
              amountCents: event.data?.total_amount,
              currency: event.data?.currency,
              kind: priorPro && priorPro.length > 0 ? "hosting_renewal" : "pro",
            });
            // No subscription id means a one-time purchase (India): there will be no subscription
            // events, so this payment itself starts the one-year hosting term.
            if (!event.data?.subscription_id) await applyOneTimeHosting(admin, userId, paymentId);
          } else if (SUBSCRIPTION_EVENT_TYPES.includes(type)) {
            await applySubscriptionEvent(admin, type as SubscriptionEventType, event.data ?? {});
          } else {
            const paymentId = event.data?.payment_id;
            if (paymentId) await revokeForPayment(admin, paymentId);
          }
        } catch {
          await forgetWebhook(admin, id);
          return Response.json({ error: { code: "internal_error" } }, { status: 500 });
        }

        return Response.json({ received: true });
      },
    },
  },
});
