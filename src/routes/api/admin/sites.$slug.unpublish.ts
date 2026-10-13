import { createFileRoute } from "@tanstack/react-router";

import { adminMiddleware } from "@/server/admin-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const SITES_BUCKET = "sites";

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export const Route = createFileRoute("/api/admin/sites/$slug/unpublish")({
  server: {
    middleware: [adminMiddleware],
    handlers: {
      POST: async ({ params }) => {
        const slug = params.slug;
        if (!slug || typeof slug !== "string") {
          return errorResponse(400, "invalid_slug", "Slug parameter is required");
        }

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
        const filesToRemove: string[] = [];

        const { data: rootFiles } = await admin.storage.from(SITES_BUCKET).list(slug);
        if (rootFiles) {
          for (const f of rootFiles) {
            if (f.name && f.id) {
              filesToRemove.push(`${slug}/${f.name}`);
            }
          }
        }

        const { data: imageFiles } = await admin.storage.from(SITES_BUCKET).list(`${slug}/images`);
        if (imageFiles) {
          for (const f of imageFiles) {
            if (f.name) {
              filesToRemove.push(`${slug}/images/${f.name}`);
            }
          }
        }

        if (filesToRemove.length > 0) {
          await admin.storage.from(SITES_BUCKET).remove(filesToRemove);
        }

        return Response.json({ ok: true });
      },
    },
  },
});
