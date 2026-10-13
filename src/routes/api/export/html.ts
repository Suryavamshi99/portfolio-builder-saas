import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { embedStorageImagesInHtml } from "@/server/template/images";
import { sanitizeHtmlForServing, UnstableHtmlError } from "@/server/finalize-html";
import { getOrCreateAppUser, hasPaidAccess } from "@/server/users";

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export const Route = createFileRoute("/api/export/html")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ context }) => {
        const { user, supabase } = context as AuthedContext;

        const appUser = await getOrCreateAppUser(supabase, user.id);
        if (!appUser) return errorResponse(500, "internal_error", "Could not load account");

        if (!hasPaidAccess(appUser)) {
          return errorResponse(402, "payment_required", "Upgrade to Pro to export your portfolio HTML file");
        }

        const admin = createSupabaseAdminClient();
        const { data: portfolio } = await admin
          .from("portfolios")
          .select("generated_html")
          .eq("user_id", user.id)
          .maybeSingle();

        const generatedHtml = portfolio?.generated_html;
        if (!generatedHtml || !generatedHtml.trim()) {
          return errorResponse(400, "no_portfolio", "Generate a portfolio before exporting");
        }

        const { html } = await embedStorageImagesInHtml(
          generatedHtml,
          supabase,
          user.id,
        );

        let sanitizedHtml: string;
        try {
          sanitizedHtml = sanitizeHtmlForServing(html);
        } catch (e) {
          if (!(e instanceof UnstableHtmlError)) throw e;
          return errorResponse(
            422,
            "export_unsafe_html",
            "Your page couldn't be cleaned safely. Regenerate it, then export again.",
          );
        }

        return new Response(sanitizedHtml, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Disposition": 'attachment; filename="portfolio.html"',
          },
        });
      },
    },
  },
});
