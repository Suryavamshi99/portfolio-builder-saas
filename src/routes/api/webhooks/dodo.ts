import { createFileRoute } from "@tanstack/react-router";

import { getDodoWebhookSecret } from "@/config/dodo";
import { verifyStandardWebhook } from "@/lib/standard-webhooks";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

        // Only the event this app currently cares about. Any other event
        // type (failed payments, disputes, refunds — none of which exist
        // for a one-time non-refundable-by-us digital unlock in this
        // phase) is acknowledged and ignored, not an error.
        if (event.type !== "payment.succeeded") {
          return Response.json({ received: true });
        }

        const userId = event.data?.metadata?.userId;
        const paymentId = event.data?.payment_id;
        if (!userId || !paymentId) {
          return Response.json({ error: { code: "missing_fields" } }, { status: 400 });
        }

        const admin = createSupabaseAdminClient();

        // Idempotent: dodo_payment_id is unique, so a replayed webhook for
        // the same payment hits the conflict and does nothing further —
        // never double-processes, never double-"grants" anything.
        const { error: insertError } = await admin.from("purchases").insert({
          user_id: userId,
          dodo_payment_id: paymentId,
          status: "succeeded",
          amount_cents: event.data?.total_amount ?? null,
          currency: event.data?.currency ?? null,
        });

        const isDuplicate = insertError?.code === "23505";
        if (insertError && !isDuplicate) {
          return Response.json({ error: { code: "internal_error" } }, { status: 500 });
        }

        if (!isDuplicate) {
          await admin.from("users").upsert({ id: userId, plan: "pro" }, { onConflict: "id" });
        }

        return Response.json({ received: true });
      },
    },
  },
});
