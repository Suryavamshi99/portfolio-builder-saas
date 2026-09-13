import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";

const BUCKET = "uploads";

export const Route = createFileRoute("/api/uploads/$id")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      DELETE: async ({ params, context }) => {
        const { user, supabase } = context as AuthedContext;

        const { data: row, error } = await supabase
          .from("uploads")
          .select("id, storage_path")
          .eq("id", params.id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          return Response.json(
            { error: { code: "internal_error", message: "Could not look up upload" } },
            { status: 500 },
          );
        }
        if (!row) {
          return Response.json({ error: { code: "not_found", message: "Upload not found" } }, { status: 404 });
        }

        await supabase.storage.from(BUCKET).remove([row.storage_path]);
        await supabase.from("uploads").delete().eq("id", row.id);

        return new Response(null, { status: 204 });
      },
    },
  },
});
