import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { getOrCreateAppUser, hasPaidAccess } from "@/server/users";
import { addWatermark } from "@/server/watermark";

export const Route = createFileRoute("/api/content")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ context }) => {
        const { user, supabase } = context as AuthedContext;

        const appUser = await getOrCreateAppUser(supabase, user.id);
        if (!appUser) {
          return Response.json(
            { error: { code: "internal_error", message: "Could not load account" } },
            { status: 500 },
          );
        }

        const { data, error } = await supabase
          .from("portfolios")
          .select("generated_html, updated_at")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          return Response.json(
            { error: { code: "internal_error", message: "Could not load content" } },
            { status: 500 },
          );
        }

        let html = data?.generated_html ?? null;
        if (html && !hasPaidAccess(appUser)) {
          html = addWatermark(html);
        }

        return Response.json({ html, updatedAt: data?.updated_at ?? null });
      },
    },
  },
});
