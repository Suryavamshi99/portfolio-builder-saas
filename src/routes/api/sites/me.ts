import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/server/sites";

export const Route = createFileRoute("/api/sites/me")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ context }) => {
        const { user } = context as AuthedContext;
        const admin = createSupabaseAdminClient();

        const [{ data: site }, { data: portfolio }] = await Promise.all([
          admin
            .from("sites")
            .select("slug, status, published_version_id, updated_at")
            .eq("user_id", user.id)
            .maybeSingle(),
          admin
            .from("portfolios")
            .select("updated_at")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        if (!site) {
          return Response.json({
            site: null,
            draftNewer: false,
          });
        }

        const draftNewer = Boolean(
          portfolio?.updated_at &&
            site.updated_at &&
            new Date(portfolio.updated_at).getTime() > new Date(site.updated_at).getTime(),
        );

        return Response.json({
          site: {
            slug: site.slug,
            url: siteUrl(site.slug),
            status: site.status,
            publishedVersionId: site.published_version_id,
            updatedAt: site.updated_at,
          },
          draftNewer,
        });
      },
    },
  },
});
