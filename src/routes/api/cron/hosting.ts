import { timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { enforceHostingLapse } from "@/server/billing";

function authorised(request: Request): boolean {
  const secret = process.env["CRON_SECRET"];
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Daily: unpublish sites whose hosting lapsed (after the 14-day grace) and prune old webhook ids. */
export const Route = createFileRoute("/api/cron/hosting")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authorised(request)) return new Response("Unauthorized", { status: 401 });
        try {
          return Response.json(await enforceHostingLapse(createSupabaseAdminClient()));
        } catch (e) {
          return Response.json(
            { error: { code: "internal_error", message: e instanceof Error ? e.message : "failed" } },
            { status: 500 },
          );
        }
      },
    },
  },
});
