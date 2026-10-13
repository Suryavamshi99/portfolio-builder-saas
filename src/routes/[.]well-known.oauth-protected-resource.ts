import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, publicOrigin } from "@/server/mcp/http";
import { protectedResourceMetadata } from "@/server/mcp/oauth";

export const Route = createFileRoute("/.well-known/oauth-protected-resource")({
  server: {
    handlers: {
      GET: ({ request }) => json(protectedResourceMetadata(publicOrigin(request))),
      OPTIONS: () => preflight(),
    },
  },
});
