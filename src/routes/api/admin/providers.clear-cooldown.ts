import { createFileRoute } from "@tanstack/react-router";

import { adminMiddleware } from "@/server/admin-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { budgetDay } from "@/server/generation/jobs";
import { getFreeProviderChain } from "@/config/free-models";
import { logAdminAction, validateReason } from "@/server/admin-audit";

export const Route = createFileRoute("/api/admin/providers/clear-cooldown")({
  server: {
    middleware: [adminMiddleware],
    handlers: {
      POST: async ({ request }) => {
        let body: { provider?: unknown; reason?: unknown } = {};
        try {
          body = ((await request.json()) ?? {}) as { provider?: unknown; reason?: unknown };
        } catch {
          // Empty or non-JSON body
        }

        const reasonResult = validateReason(body.reason);
        if (!reasonResult.ok) return reasonResult.response;

        if (typeof body.provider !== "string") {
          return Response.json(
            { error: { code: "invalid_provider", message: "Provider is required" } },
            { status: 400 },
          );
        }

        const chain = getFreeProviderChain(process.env);
        const configuredIds = new Set(chain.map((p) => p.id));
        if (!configuredIds.has(body.provider as any)) {
          return Response.json(
            { error: { code: "invalid_provider", message: "Provider is not one of the configured providers" } },
            { status: 400 },
          );
        }

        const admin = createSupabaseAdminClient();
        const today = budgetDay();

        const { error: updateError } = await admin
          .from("provider_budgets")
          .update({ cooldown_until: null })
          .eq("provider", body.provider)
          .eq("day", today);

        if (updateError) {
          return Response.json(
            { error: { code: "internal_error", message: "Could not clear cooldown" } },
            { status: 500 },
          );
        }

        await logAdminAction(admin, {
          action: "provider.clear_cooldown",
          targetType: "provider",
          targetId: body.provider,
          reason: reasonResult.reason,
          detail: { day: today },
          request,
        });

        return Response.json({ ok: true });
      },
    },
  },
});
