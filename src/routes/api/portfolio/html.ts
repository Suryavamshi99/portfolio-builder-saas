import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { savePortfolioEdit } from "@/server/portfolio-edit";

function errorResponse(status: number, code: string, message: string, details?: string[]) {
  return Response.json({ error: { code, message, ...(details ? { details } : {}) } }, { status });
}

export const Route = createFileRoute("/api/portfolio/html")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      PUT: async ({ request, context }) => {
        const { user } = context as AuthedContext;
        // JSON escaping can inflate the page a little; the exact character cap is enforced in savePortfolioEdit.
        if (Number(request.headers.get("content-length") ?? 0) > 2_000_000) {
          return errorResponse(413, "page_too_large", "That page is too large to save.");
        }
        let body: { html?: unknown; baseUpdatedAt?: unknown };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return errorResponse(400, "invalid_request", "Body must be JSON");
        }
        try {
          const res = await savePortfolioEdit(createSupabaseAdminClient(), user.id, {
            html: body?.html, baseUpdatedAt: body?.baseUpdatedAt, supabaseUrl: getSupabaseEnv().url,
          });
          if (!res.ok) return errorResponse(res.status, res.code, res.message, res.details);
          return Response.json({ updatedAt: res.updatedAt, warnings: res.warnings, unchanged: res.unchanged });
        } catch {
          return errorResponse(500, "internal_error", "Could not save your page");
        }
      },
    },
  },
});
