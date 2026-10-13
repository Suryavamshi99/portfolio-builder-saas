import { timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function authorised(request: Request): boolean {
  const secret = process.env["CRON_SECRET"];
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const Route = createFileRoute("/api/cron/domains")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authorised(request)) return new Response("Unauthorized", { status: 401 });

        const admin = createSupabaseAdminClient();
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

        // Delete pending rows older than 14 days
        const { data, error } = await admin
          .from("custom_domains")
          .delete()
          .eq("status", "pending")
          .lt("created_at", fourteenDaysAgo)
          .select("id");

        if (error) {
          return Response.json(
            { error: { code: "internal_error", message: error.message } },
            { status: 500 },
          );
        }

        return Response.json({ deleted: data?.length ?? 0 });
      },
    },
  },
});
