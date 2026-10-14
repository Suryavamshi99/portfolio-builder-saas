import { createFileRoute } from "@tanstack/react-router";

import { adminMiddleware, requireStepUp } from "@/server/admin-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAdminAction, validateReason } from "@/server/admin-audit";

export const Route = createFileRoute("/api/admin/users/$id/revoke-mcp")({
  server: {
    middleware: [adminMiddleware],
    handlers: {
      POST: async ({ request, params }) => {
        let body: { reason?: unknown } = {};
        try {
          body = ((await request.json()) ?? {}) as { reason?: unknown };
        } catch {
          // Empty or non-JSON body
        }

        const stepUpError = await requireStepUp(request);
        if (stepUpError) return stepUpError;

        const reasonResult = validateReason(body.reason);
        if (!reasonResult.ok) return reasonResult.response;

        const admin = createSupabaseAdminClient();

        const { data: tokens, error: tokensError } = await admin
          .from("mcp_tokens")
          .select("client_id")
          .eq("user_id", params.id)
          .is("revoked_at", null);

        if (tokensError) {
          return Response.json({ error: { code: "internal_error", message: "Could not look up MCP tokens" } }, { status: 500 });
        }

        const clientIds = new Set((tokens ?? []).map((t) => t.client_id as string));
        const revokedClients = clientIds.size;

        if (revokedClients > 0) {
          const { error: updateError } = await admin
            .from("mcp_tokens")
            .update({ revoked_at: new Date().toISOString() })
            .eq("user_id", params.id)
            .is("revoked_at", null);

          if (updateError) {
            return Response.json({ error: { code: "internal_error", message: "Could not revoke MCP tokens" } }, { status: 500 });
          }
        }

        await logAdminAction(admin, {
          action: "user.mcp_revoke",
          targetType: "user",
          targetId: params.id,
          reason: reasonResult.reason,
          detail: { revokedClients },
          request,
        });

        return Response.json({ ok: true, revokedClients });
      },
    },
  },
});
