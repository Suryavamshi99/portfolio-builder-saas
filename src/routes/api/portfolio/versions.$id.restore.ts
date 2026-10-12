import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { restorePortfolioVersion } from "@/server/portfolio-versions";
import { getOrCreateAppUser, hasPaidAccess } from "@/server/users";
import { addWatermark } from "@/server/watermark";
import { PHOTO_SIGNED_URL_TTL_SECONDS, signStorageMarkers } from "@/server/storage-markers";
import { signedUrlsToMarkers } from "@/server/finalize-html";
import { getSupabaseEnv } from "@/lib/supabase/env";

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export const Route = createFileRoute("/api/portfolio/versions/$id/restore")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      POST: async ({ params, context }) => {
        const { user, supabase } = context as AuthedContext;
        const versionId = params.id;

        if (!versionId || typeof versionId !== "string") {
          return errorResponse(400, "invalid_request", "versionId is required");
        }

        const appUser = await getOrCreateAppUser(supabase, user.id);
        if (!appUser) return errorResponse(500, "internal_error", "Could not load account");

        const admin = createSupabaseAdminClient();
        let restored: { html: string; updatedAt: string };
        try {
          restored = await restorePortfolioVersion(admin, user.id, versionId);
        } catch {
          return errorResponse(404, "version_not_found", "Portfolio version not found");
        }

        let html = restored.html;
        if (html) {
          html = signedUrlsToMarkers(html, user.id, getSupabaseEnv().url).html;
          html = await signStorageMarkers(html, supabase, user.id, PHOTO_SIGNED_URL_TTL_SECONDS);
          if (!hasPaidAccess(appUser)) {
            html = addWatermark(html);
          }
        }

        return Response.json({ html, updatedAt: restored.updatedAt });
      },
    },
  },
});
