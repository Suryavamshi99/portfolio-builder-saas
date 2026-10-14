import { createFileRoute } from "@tanstack/react-router";

import { adminMiddleware } from "@/server/admin-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parsePagination, sanitizeAuditDetail } from "@/server/admin-audit";

export const Route = createFileRoute("/api/admin/audit")({
  server: {
    middleware: [adminMiddleware],
    handlers: {
      GET: async ({ request }) => {
        const admin = createSupabaseAdminClient();
        const url = new URL(request.url);
        const action = url.searchParams.get("action")?.trim();
        const targetType = url.searchParams.get("targetType")?.trim();
        const { page, pageSize, offset } = parsePagination(url);

        let query = admin
          .from("admin_audit_log")
          .select("id, created_at, action, target_type, target_id, reason, detail", { count: "exact" });

        if (action) {
          query = query.eq("action", action);
        }
        if (targetType) {
          query = query.eq("target_type", targetType);
        }

        const { data: rows, count, error } = await query
          .order("created_at", { ascending: false })
          .range(offset, offset + pageSize - 1);

        if (error) {
          return Response.json({ error: { code: "internal_error", message: "Could not load audit log" } }, { status: 500 });
        }

        const entries = (rows ?? []).map((row) => ({
          id: row.id,
          createdAt: row.created_at,
          action: row.action,
          targetType: row.target_type,
          targetId: row.target_id,
          reason: row.reason,
          detail: sanitizeAuditDetail(row.detail),
        }));

        return Response.json({
          entries,
          page,
          pageSize,
          total: count ?? 0,
        });
      },
    },
  },
});
