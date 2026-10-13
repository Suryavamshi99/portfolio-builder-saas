import { timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { RUN_BUDGET_MS } from "@/server/generation/jobs";
import { runJob } from "@/server/generation/run-job";

function authorised(request: Request): boolean {
  const secret = process.env["CRON_SECRET"];
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Vercel Cron (vercel.json) calls this once a day, right after the free
// providers' budgets reset, to run jobs that were waiting in the queue.
export const Route = createFileRoute("/api/cron/free-queue")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authorised(request)) return new Response("Unauthorized", { status: 401 });
        const admin = createSupabaseAdminClient();
        const { data } = await admin
          .from("generation_jobs")
          .select("id")
          .eq("status", "queued")
          .lte("retry_at", new Date().toISOString())
          .order("created_at", { ascending: true })
          .limit(20);

        const started = Date.now();
        let ran = 0;
        for (const job of data ?? []) {
          // Each run can take up to RUN_BUDGET_MS; leave the rest for the next day's run.
          if (Date.now() - started > RUN_BUDGET_MS) break;
          await runJob(admin, job.id);
          ran++;
        }
        return Response.json({ ran, waiting: (data?.length ?? 0) - ran });
      },
    },
  },
});
