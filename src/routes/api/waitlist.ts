import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getWaitlistWebhookSecret, getWaitlistWebhookUrl } from "@/config/waitlist";

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  source: z.string().trim().max(100).optional(),
});

/**
 * Public — no auth, no user session yet (that's the whole point of a
 * waitlist). Forwards to a Google Apps Script Web App instead of a
 * Supabase table: a waitlist is a marketing list someone wants to open
 * and skim in a spreadsheet, not product data that needs RLS or an
 * admin UI. The shared secret stops randoms who find the Apps Script
 * URL from writing rows directly, bypassing this route's validation.
 */
export const Route = createFileRoute("/api/waitlist")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return errorResponse(400, "invalid_json", "Request body must be JSON");
        }

        const parsed = bodySchema.safeParse(body);
        if (!parsed.success) {
          return errorResponse(400, "invalid_email", "Enter a valid email address");
        }

        const { email, source } = parsed.data;

        let webhookRes: Response;
        try {
          webhookRes = await fetch(getWaitlistWebhookUrl(), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              secret: getWaitlistWebhookSecret(),
              email,
              source: source || "landing",
              submittedAt: new Date().toISOString(),
            }),
          });
        } catch {
          return errorResponse(502, "waitlist_webhook_unreachable", "Could not record signup — try again shortly");
        }

        if (!webhookRes.ok) {
          return errorResponse(502, "waitlist_webhook_failed", "Could not record signup — try again shortly");
        }

        return Response.json({ ok: true }, { status: 201 });
      },
    },
  },
});
