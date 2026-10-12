import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BUCKET = "uploads";

/**
 * "Start over" — wipes a user's draft back to a blank slate: every upload
 * (resume, visual references, photo, project images) and the portfolio
 * content itself. Deliberately does NOT touch byok_keys, vercel_connections,
 * generations, or publications — reconnecting a provider key and any
 * already-published site are untouched by starting a fresh draft.
 *
 * Irreversible from the app's point of view (Storage objects are actually
 * deleted, not soft-deleted) — the client must get explicit confirmation
 * before calling this; the server doesn't ask twice.
 */
export const Route = createFileRoute("/api/reset")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      POST: async ({ context }) => {
        const { user, supabase } = context as AuthedContext;

        const { data: uploads, error: uploadsError } = await supabase
          .from("uploads")
          .select("id, storage_path")
          .eq("user_id", user.id);

        if (uploadsError) {
          return Response.json(
            { error: { code: "internal_error", message: "Could not look up uploads" } },
            { status: 500 },
          );
        }

        const paths = (uploads ?? []).map((row) => row.storage_path);
        if (paths.length > 0) {
          await supabase.storage.from(BUCKET).remove(paths);
        }

        const { error: deleteError } = await supabase.from("uploads").delete().eq("user_id", user.id);
        if (deleteError) {
          return Response.json(
            { error: { code: "internal_error", message: "Could not delete uploads" } },
            { status: 500 },
          );
        }

        const { error: inputsError } = await supabase.from("portfolio_inputs").delete().eq("user_id", user.id);
        if (inputsError) {
          return Response.json(
            { error: { code: "internal_error", message: "Could not reset portfolio inputs" } },
            { status: 500 },
          );
        }

        const updatedAt = new Date().toISOString();
        const admin = createSupabaseAdminClient();

        const { error: versionsError } = await admin
          .from("portfolio_versions")
          .delete()
          .eq("user_id", user.id);

        if (versionsError) {
          return Response.json(
            { error: { code: "internal_error", message: "Uploads cleared, but could not reset portfolio versions" } },
            { status: 500 },
          );
        }

        const { error: contentError } = await admin
          .from("portfolios")
          .upsert({ user_id: user.id, generated_html: null, updated_at: updatedAt }, { onConflict: "user_id" });

        if (contentError) {
          return Response.json(
            { error: { code: "internal_error", message: "Uploads cleared, but could not reset content" } },
            { status: 500 },
          );
        }

        return Response.json({ ok: true, updatedAt });
      },
    },
  },
});
