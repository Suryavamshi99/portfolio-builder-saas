import { createFileRoute } from "@tanstack/react-router";

import { SITES_CSP } from "@/server/sites-serve";
import { renderThemeDemo } from "@/server/themes/demo";

/** A theme filled with a made-up sample person, served under the same CSP and sandbox as a published page. Public. */
export const Route = createFileRoute("/api/themes/$id/demo")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const html = renderThemeDemo(params.id);
        if (!html) return new Response("Not found", { status: 404 });
        return new Response(html, {
          headers: { "content-type": "text/html; charset=utf-8", "content-security-policy": SITES_CSP, "x-content-type-options": "nosniff", "cache-control": "public, max-age=300" },
        });
      },
    },
  },
});
