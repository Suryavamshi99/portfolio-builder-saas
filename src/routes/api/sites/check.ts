import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { checkHourlyRateLimit } from "@/server/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { siteUrl, validateSlug } from "@/server/sites";

const HOURLY_CHECK_LIMIT = 120;

function errorResponse(status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return Response.json({ error: { code, message, ...extra } }, { status });
}

export const Route = createFileRoute("/api/sites/check")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ request, context }) => {
        const { user, supabase } = context as AuthedContext;

        const rateLimit = await checkHourlyRateLimit(
          supabase,
          "uploads",
          user.id,
          HOURLY_CHECK_LIMIT,
        );
        if (rateLimit.limited) {
          return errorResponse(429, "rate_limited", "Slug check limit reached, try again later", {
            retryAfterSeconds: rateLimit.retryAfterSeconds,
          });
        }

        const urlObj = new URL(request.url);
        const rawSlug = urlObj.searchParams.get("slug");

        const validation = validateSlug(rawSlug);
        if (!validation.ok) {
          const status = validation.status === "reserved" ? "reserved" : "invalid";
          const fallbackSlug = typeof rawSlug === "string" ? rawSlug.trim().toLowerCase() : "";
          return Response.json({
            status,
            url: fallbackSlug ? siteUrl(fallbackSlug) : null,
          });
        }

        const slug = validation.slug;
        const generatedUrl = siteUrl(slug);

        const admin = createSupabaseAdminClient();
        const { data: existingSite } = await admin
          .from("sites")
          .select("user_id")
          .eq("slug", slug)
          .maybeSingle();

        if (!existingSite) {
          return Response.json({
            status: "available",
            url: generatedUrl,
          });
        }

        if (existingSite.user_id === user.id) {
          return Response.json({
            status: "yours",
            url: generatedUrl,
          });
        }

        return Response.json({
          status: "taken",
          url: generatedUrl,
        });
      },
    },
  },
});
