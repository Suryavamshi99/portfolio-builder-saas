import { createFileRoute } from "@tanstack/react-router";

import { adminMiddleware } from "@/server/admin-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { failJob, getJobById } from "@/server/generation/jobs";
import { logAdminAction, validateReason } from "@/server/admin-audit";

export const Route = createFileRoute("/api/admin/jobs/$id/cancel")({
  server: {
    middleware: [adminMiddleware],
    handlers: {
      POST: async ({ request, params }) => {
        let body: { reason?: unknown } = {};
        try {
          body = ((await request.json()) ?? {}) as { reason?: unknown };
        } catch {
          // Empty or non-JSON body
        }

        const reasonResult = validateReason(body.reason);
        if (!reasonResult.ok) return reasonResult.response;

        const admin = createSupabaseAdminClient();
        const job = await getJobById(admin, params.id);
        if (!job) {
          return Response.json({ error: { code: "job_not_found", message: "Job not found" } }, { status: 404 });
        }

        if (job.status === "done" || job.status === "failed") {
          return Response.json(
            { error: { code: "job_finished", message: "Job is already completed or failed" } },
            { status: 409 },
          );
        }

        await failJob(admin, params.id, {
          code: "cancelled_by_admin",
          message: reasonResult.reason,
        });

        await logAdminAction(admin, {
          action: "job.cancel",
          targetType: "job",
          targetId: params.id,
          reason: reasonResult.reason,
          detail: { previousStatus: job.status },
          request,
        });

        return Response.json({ ok: true });
      },
    },
  },
});
