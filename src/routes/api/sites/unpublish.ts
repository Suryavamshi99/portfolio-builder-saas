import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const SITES_BUCKET = "sites";

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
        // 1. Files in {slug} root (like index.html)
        const { data: rootFiles } = await admin.storage.from(SITES_BUCKET).list(slug);
        const filesToRemove: string[] = [];
        if (rootFiles) {
          for (const f of rootFiles) {
            if (f.name && f.id) {
              // It's a file, not a folder
              filesToRemove.push(`${slug}/${f.name}`);
            }
          }
        }

        // 2. Files in {slug}/images
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
