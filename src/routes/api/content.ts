import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";

export const Route = createFileRoute("/api/content")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ context }) => {
        const { user, supabase } = context as AuthedContext;

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

        return Response.json({ html: data?.generated_html ?? null, updatedAt: data?.updated_at ?? null });
      },
    },
  },
});
