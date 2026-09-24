import { createFileRoute } from "@tanstack/react-router";

import { adminMiddleware } from "@/server/admin-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { contentSchema } from "@/data/content";
import type { Plan } from "@/config/plans";

const UPLOADS_BUCKET = "uploads";

export const Route = createFileRoute("/api/admin/users/$id")({
  server: {
    middleware: [adminMiddleware],
    handlers: {
      GET: async ({ params }) => {
        const admin = createSupabaseAdminClient();

        const { data: authUser, error: authError } = await admin.auth.admin.getUserById(params.id);
        if (authError || !authUser?.user) {
          return Response.json({ error: { message: "User not found" } }, { status: 404 });
        }

        const [{ data: appUser }, { data: portfolio }, { data: uploads }, { data: byokKeys }, { data: vercelConn }] =
          await Promise.all([
            admin.from("users").select("plan, created_at").eq("id", params.id).maybeSingle(),
            admin.from("portfolios").select("content, updated_at").eq("user_id", params.id).maybeSingle(),
            admin.from("uploads").select("id, kind, filename, size_bytes, created_at").eq("user_id", params.id),
            // Metadata only — never the encrypted_key/nonce columns. Decrypting
            // a user's BYOK key is not something this panel does, ever.
            admin.from("byok_keys").select("provider, created_at").eq("user_id", params.id),
            admin.from("vercel_connections").select("vercel_username, connected_at").eq("user_id", params.id).maybeSingle(),
          ]);

        return Response.json({
          id: authUser.user.id,
          email: authUser.user.email ?? null,
          createdAt: authUser.user.created_at,
          plan: appUser?.plan ?? "free",
          portfolio: portfolio ? { content: portfolio.content, updatedAt: portfolio.updated_at } : null,
          uploads: uploads ?? [],
          byokProviders: byokKeys ?? [],
          vercelConnection: vercelConn,
        });
      },

      PATCH: async ({ request, params }) => {
        const admin = createSupabaseAdminClient();

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: { message: "Invalid request body" } }, { status: 400 });
        }
        const { plan, content } = (body ?? {}) as { plan?: unknown; content?: unknown };

        if (plan !== undefined) {
          if (plan !== "free" && plan !== "pro") {
            return Response.json({ error: { message: "plan must be 'free' or 'pro'" } }, { status: 422 });
          }
          const { error } = await admin.from("users").update({ plan: plan as Plan }).eq("id", params.id);
          if (error) return Response.json({ error: { message: "Could not update plan" } }, { status: 500 });
        }

        if (content !== undefined) {
          const parsed = contentSchema.safeParse(content);
          if (!parsed.success) {
            return Response.json(
              { error: { message: "content failed validation", issues: parsed.error.issues } },
              { status: 422 },
            );
          }
          const { error } = await admin
            .from("portfolios")
            .upsert(
              { user_id: params.id, content: parsed.data, updated_at: new Date().toISOString() },
              { onConflict: "user_id" },
            );
          if (error) return Response.json({ error: { message: "Could not update portfolio" } }, { status: 500 });
        }

        return Response.json({ ok: true });
      },

      DELETE: async ({ params }) => {
        const admin = createSupabaseAdminClient();

        // Storage objects aren't foreign-keyed to auth.users, so the table
        // cascade (on delete cascade, see supabase/migrations/0001_init.sql)
        // won't clean these up — remove them explicitly first.
        const { data: uploads } = await admin.from("uploads").select("storage_path").eq("user_id", params.id);
        if (uploads && uploads.length > 0) {
          await admin.storage.from(UPLOADS_BUCKET).remove(uploads.map((u) => u.storage_path as string));
        }

        const { error } = await admin.auth.admin.deleteUser(params.id);
        if (error) return Response.json({ error: { message: "Could not delete user" } }, { status: 500 });

        return new Response(null, { status: 204 });
      },
    },
  },
});
