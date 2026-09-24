import { createFileRoute } from "@tanstack/react-router";

import { adminMiddleware } from "@/server/admin-middleware";

export const Route = createFileRoute("/api/admin/session")({
  server: {
    middleware: [adminMiddleware],
    handlers: {
      GET: async () => Response.json({ ok: true }),
    },
  },
});
