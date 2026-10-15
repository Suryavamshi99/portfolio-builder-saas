import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runInBackground } from "@/server/generation/background";
import { failJob, getUserJob, toApiJob } from "@/server/generation/jobs";
import { leaseActive, pipelineStateOf } from "@/server/generation/pipeline/run-pipeline-job";
import { runJob } from "@/server/generation/run-job";

const notFound = () => Response.json({ error: { code: "job_not_found", message: "Generation not found" } }, { status: 404 });

export const Route = createFileRoute("/api/generations/$id")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ params, context }) => {
        const { user } = context as AuthedContext;
        const admin = createSupabaseAdminClient();
        const job = await getUserJob(admin, user.id, params.id);
        // Self-heal: a step-by-step build that has not moved for 45 s with nobody working on it lost its continuation
        // (a dropped hand-over). Restart it from the last saved step; a run that is working holds a lease and wins.
        if (job && job.source === "free" && job.status === "writing") {
          const state = pipelineStateOf(job);
          if (state && !leaseActive(state) && Date.now() - Date.parse(job.updated_at) > 45_000) runInBackground(runJob(admin, job.id));
        }
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
