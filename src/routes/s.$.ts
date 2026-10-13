import { createFileRoute } from "@tanstack/react-router";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { responseHeaders, serveSite } from "@/server/sites-serve";

// Published portfolios at /s/<slug>/... Public, read-only, no session: it never reads cookies.
export const Route = createFileRoute("/s/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const res = await serveSite(createSupabaseAdminClient(), params["_splat"] ?? "");
        return new Response(typeof res.body === "string" ? res.body : new Blob([res.body as BlobPart]), { status: res.status, headers: responseHeaders(res.contentType) });
      },
    },
  },
});
