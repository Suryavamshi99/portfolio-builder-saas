import { createFileRoute } from "@tanstack/react-router";

import { adminMiddleware } from "@/server/admin-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parsePagination } from "@/server/admin-audit";

export const Route = createFileRoute("/api/admin/jobs")({
  server: {
    middleware: [adminMiddleware],
    handlers: {
      GET: async ({ request }) => {
        const admin = createSupabaseAdminClient();
        const url = new URL(request.url);
        const status = url.searchParams.get("status")?.trim();
        const source = url.searchParams.get("source")?.trim();
        const { page, pageSize, offset } = parsePagination(url);

        let query = admin
          .from("generation_jobs")
          .select("id, user_id, source, status, provider, error, created_at, updated_at, retry_at", { count: "exact" });

        if (status) {
          query = query.eq("status", status);
        }
        if (source) {
          query = query.eq("source", source);
        }

        const { data: rows, count, error } = await query
          .order("created_at", { ascending: false })
          .range(offset, offset + pageSize - 1);

        if (error) {
          return Response.json({ error: { code: "internal_error", message: "Could not load jobs" } }, { status: 500 });
        }

        const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id as string)));
        const userEmailMap = new Map<string, string | null>();

        await Promise.all(
          userIds.map(async (uid) => {
            try {
              const { data: authUser } = await admin.auth.admin.getUserById(uid);
              userEmailMap.set(uid, authUser?.user?.email ?? null);
            } catch {
              userEmailMap.set(uid, null);
            }
          }),
        );

        const jobs = (rows ?? []).map((row) => ({
          id: row.id,
          userEmail: userEmailMap.get(row.user_id) ?? null,
          source: row.source,
          status: row.status,
          provider: row.provider ?? null,
          errorCode: (row.error as { code?: string } | null)?.code ?? null,
          errorMessage: (row.error as { message?: string } | null)?.message ?? null,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          retryAt: row.retry_at ?? null,
        }));

        return Response.json({
          jobs,
          page,
          pageSize,
          total: count ?? 0,
        });
      },
    },
  },
});
