import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listPortfolioVersions } from "@/server/portfolio-versions";

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export const Route = createFileRoute("/api/portfolio/versions")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ context }) => {
        const { user } = context as AuthedContext;

        try {
          const admin = createSupabaseAdminClient();
          const versions = await listPortfolioVersions(admin, user.id);
          return Response.json({ versions });
        } catch {
          return errorResponse(500, "internal_error", "Could not load portfolio versions");
        }
      },
    },
  },
});
