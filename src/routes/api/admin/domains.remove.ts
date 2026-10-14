import { createFileRoute } from "@tanstack/react-router";

import { adminMiddleware, requireStepUp } from "@/server/admin-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { removeDomain, VercelDomainError } from "@/server/vercel/domains";
import { logAdminAction, validateReason } from "@/server/admin-audit";

export const Route = createFileRoute("/api/admin/domains/remove")({
  server: {
    middleware: [adminMiddleware],
    handlers: {
      POST: async ({ request }) => {
        let body: { hostname?: unknown; reason?: unknown } = {};
        try {
          body = ((await request.json()) ?? {}) as { hostname?: unknown; reason?: unknown };
        } catch {
          // Empty or non-JSON body
        }

        const stepUpError = await requireStepUp(request);
        if (stepUpError) return stepUpError;

        const reasonResult = validateReason(body.reason);
        if (!reasonResult.ok) return reasonResult.response;

        if (typeof body.hostname !== "string" || !body.hostname.trim()) {
          return Response.json(
            { error: { code: "invalid_hostname", message: "Hostname is required" } },
            { status: 400 },
          );
        }

        const normalizedHostname = body.hostname.trim().toLowerCase();
        const admin = createSupabaseAdminClient();

        const { data: domain } = await admin
          .from("custom_domains")
          .select("id, hostname, user_id")
          .eq("hostname", normalizedHostname)
          .maybeSingle();

        if (!domain) {
          return Response.json(
            { error: { code: "domain_not_found", message: "Domain not found" } },
            { status: 404 },
          );
        }

        try {
          await removeDomain(domain.hostname);
        } catch (e) {
          if (e instanceof VercelDomainError && e.status === 404) {
            // Treat 404 as success
          } else {
            console.warn("Could not remove domain from Vercel:", e);
          }
        }

        const { error: deleteError } = await admin.from("custom_domains").delete().eq("id", domain.id);
        if (deleteError) {
          return Response.json(
            { error: { code: "internal_error", message: "Could not delete domain" } },
            { status: 500 },
          );
        }

        await logAdminAction(admin, {
          action: "domain.remove",
          targetType: "domain",
          targetId: domain.hostname,
          reason: reasonResult.reason,
          detail: { userId: domain.user_id },
          request,
        });

        return Response.json({ ok: true });
      },
    },
  },
});
