import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, publicOrigin } from "@/server/mcp/http";
import { authorizationServerMetadata } from "@/server/mcp/oauth";

export const Route = createFileRoute("/.well-known/oauth-authorization-server")({
  server: {
    handlers: {
      GET: ({ request }) => json(authorizationServerMetadata(publicOrigin(request))),
      OPTIONS: () => preflight(),
    },
  },
});
