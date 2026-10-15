import { timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runInBackground } from "@/server/generation/background";
import { getJobById } from "@/server/generation/jobs";
import { leaseActive, pipelineStateOf } from "@/server/generation/pipeline/run-pipeline-job";
import { runJob } from "@/server/generation/run-job";

function authorised(request: Request): boolean {
  const secret = process.env["CRON_SECRET"];
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Starts the next run of an unfinished step-by-step build (free source). A run lasts about 200 seconds, so one
 * build is a chain of runs: each ends by calling this route, and the status poll calls the same code to restart a
 * build that stopped moving. It answers at once (202) and does the work in the background.
 */
export const Route = createFileRoute("/api/cron/generation-advance")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authorised(request)) return new Response("Unauthorized", { status: 401 });
        const id = new URL(request.url).searchParams.get("id") ?? "";
        const admin = createSupabaseAdminClient();
        const job = id ? await getJobById(admin, id) : null;
        if (!job || job.source !== "free" || !["reading", "writing"].includes(job.status)) {
          return Response.json({ started: false, reason: "not_running" });
        }
        if (leaseActive(pipelineStateOf(job))) return Response.json({ started: false, reason: "already_running" }, { status: 202 });
        runInBackground(runJob(admin, job.id));
        return Response.json({ started: true }, { status: 202 });
      },
    },
  },
});
