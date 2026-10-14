import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { removeSiteFiles } from "@/server/sites-storage";

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export const Route = createFileRoute("/api/sites/unpublish")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      POST: async ({ context }) => {
        const { user } = context as AuthedContext;
        const admin = createSupabaseAdminClient();

        const { data: site } = await admin
          .from("sites")
          .select("slug, status")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!site) {
          return errorResponse(404, "site_not_found", "No site found for this user");
        }

        const slug = site.slug;

        // Set status: "unpublished"
        const { error: updateError } = await admin
          .from("sites")
          .update({
            status: "unpublished",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);

        if (updateError) {
          return errorResponse(500, "internal_error", "Could not update site status");
        }

        // Delete {slug}/... files from the sites bucket
        // The page is already unpublished (nothing is served), so a clean-up failure must not
        // turn this into an error; leftover files are removed by the daily clean-up job.
        try {
          await removeSiteFiles(admin, slug);
        } catch (e) {
          console.warn("Could not remove site files for", slug, e instanceof Error ? e.message : "");
        }

        return Response.json({ ok: true });
      },
    },
  },
});
