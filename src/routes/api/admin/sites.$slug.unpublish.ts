import { createFileRoute } from "@tanstack/react-router";

import { adminMiddleware, requireStepUp } from "@/server/admin-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { removeSiteFiles } from "@/server/sites-storage";
import { logAdminAction, validateReason } from "@/server/admin-audit";

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export const Route = createFileRoute("/api/admin/sites/$slug/unpublish")({
  server: {
    middleware: [adminMiddleware],
    handlers: {
      POST: async ({ request, params, context }) => {
        const slug = params.slug;
        if (!slug || typeof slug !== "string") {
          return errorResponse(400, "invalid_slug", "Slug parameter is required");
        }

        let body: { reason?: unknown } = {};
        try {
          body = ((await request.json()) ?? {}) as { reason?: unknown };
        } catch {
          // Empty or non-JSON body
        }

        const stepUpError = requireStepUp(context);
        if (stepUpError) return stepUpError;

        const reasonResult = validateReason(body.reason);
        if (!reasonResult.ok) return reasonResult.response;

        const admin = createSupabaseAdminClient();

        const { data: site } = await admin
          .from("sites")
          .select("slug, user_id, status")
          .eq("slug", slug)
          .maybeSingle();

        if (!site) {
          return errorResponse(404, "site_not_found", "No site found for this slug");
        }

        // Set status: "unpublished"
        const { error: updateError } = await admin
          .from("sites")
          .update({
            status: "unpublished",
            updated_at: new Date().toISOString(),
          })
          .eq("slug", slug);

        if (updateError) {
          return errorResponse(500, "internal_error", "Could not update site status");
        }

        // Delete {slug}/... files from bucket
        // The page is already unpublished (nothing is served), so a clean-up failure must not
        // turn this into an error; leftover files are removed by the daily clean-up job.
        try {
          await removeSiteFiles(admin, slug);
        } catch (e) {
          console.warn("Could not remove site files for", slug, e instanceof Error ? e.message : "");
        }

        await logAdminAction(admin, {
          action: "site.takedown",
          targetType: "site",
          targetId: slug,
          reason: reasonResult.reason,
          detail: { userId: site.user_id },
          request,
        });

        return Response.json({ ok: true });
      },
    },
  },
});
