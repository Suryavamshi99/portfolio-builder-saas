import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { failJob, getUserJob, toApiJob } from "@/server/generation/jobs";

const notFound = () => Response.json({ error: { code: "job_not_found", message: "Generation not found" } }, { status: 404 });

export const Route = createFileRoute("/api/generations/$id")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ params, context }) => {
        const { user } = context as AuthedContext;
        const job = await getUserJob(createSupabaseAdminClient(), user.id, params.id);
        return job ? Response.json(toApiJob(job)) : notFound();
      },
      // Cancels a job that is still waiting in the free queue.
      DELETE: async ({ params, context }) => {
        const { user } = context as AuthedContext;
        const admin = createSupabaseAdminClient();
        const job = await getUserJob(admin, user.id, params.id);
        if (!job) return notFound();
        if (job.status === "queued") await failJob(admin, job.id, { code: "cancelled", message: "Cancelled." });
        return Response.json({ ok: true });
      },
    },
  },
});
