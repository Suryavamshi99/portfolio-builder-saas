import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PLAN_GENERATIONS_PER_HOUR } from "@/config/plans";
import { checkHourlyRateLimit } from "@/server/rate-limit";
import { getOrCreateAppUser } from "@/server/users";
import { savePortfolioInputs } from "@/server/portfolio-inputs";
import { runInBackground } from "@/server/generation/background";
import { createJob, toApiJob } from "@/server/generation/jobs";
import { FREE_GENERATIONS_PER_DAY, countFreeRunsToday } from "@/server/generation/limits";
import { getFreeChain } from "@/server/generation/free-wiring";
import { runJob } from "@/server/generation/run-job";

function errorResponse(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return Response.json({ error: { code, message, ...extra } }, { status });
}

export const Route = createFileRoute("/api/generations")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      POST: async ({ request, context }) => {
        const { user, supabase } = context as AuthedContext;

        let body: Record<string, unknown>;
        try {
          body = await request.json();
        } catch {
          return errorResponse(400, "invalid_json", "Body must be valid JSON");
        }
        const { source, resumeUploadId, designIntensity, instructions } = body;
        if (source !== "free" && source !== "gemini") {
          return errorResponse(400, "invalid_request", "source must be 'free' or 'gemini'");
        }
        if (typeof resumeUploadId !== "string") return errorResponse(400, "invalid_request", "resumeUploadId is required");
        if (designIntensity !== undefined && designIntensity !== "minimal" && designIntensity !== "bold") {
          return errorResponse(400, "invalid_request", "designIntensity must be 'minimal' or 'bold'");
        }
        if (instructions !== undefined && (typeof instructions !== "string" || instructions.length > 2000)) {
          return errorResponse(400, "invalid_request", "instructions must be a string up to 2000 characters");
        }

        if (body["links"] !== undefined || body["otherSpecifics"] !== undefined || designIntensity !== undefined) {
          try {
            await savePortfolioInputs(supabase, user.id, {
              links: body["links"],
              specifics: body["otherSpecifics"],
              designIntensity,
            });
          } catch {
            return errorResponse(500, "internal_error", "Could not save portfolio inputs");
          }
        }

        const appUser = await getOrCreateAppUser(supabase, user.id);
        if (!appUser) return errorResponse(500, "internal_error", "Could not load account");

        const hourly = await checkHourlyRateLimit(supabase, "generations", user.id, PLAN_GENERATIONS_PER_HOUR[appUser.plan]);
        if (hourly.limited) {
          return errorResponse(429, "rate_limited", "Generation limit reached, try again later", {
            retryAfterSeconds: hourly.retryAfterSeconds,
          });
        }

        const admin = createSupabaseAdminClient();
        if (source === "gemini") {
          const { data: keyRow } = await admin
            .from("byok_keys")
            .select("provider")
            .eq("user_id", user.id)
            .eq("provider", "google")
            .maybeSingle();
          if (!keyRow) return errorResponse(401, "byok_key_missing", "Connect a Google Gemini API key first");
        } else {
          if (getFreeChain().length === 0) {
            return errorResponse(503, "free_unavailable", "Free generation isn't available right now. Use your own Gemini key.");
          }
          if ((await countFreeRunsToday(admin, user.id)) >= FREE_GENERATIONS_PER_DAY[appUser.plan]) {
            return errorResponse(429, "free_daily_limit", "You've used today's free generations. They reset at midnight UTC.");
          }
        }

        const { data: resumeRow } = await admin
          .from("uploads")
          .select("id")
          .eq("id", resumeUploadId)
          .eq("user_id", user.id)
          .eq("kind", "resume")
          .maybeSingle();
        if (!resumeRow) return errorResponse(400, "resume_not_found", "Resume upload not found");

        const created = await createJob(admin, {
          userId: user.id,
          source,
          resumeUploadId,
          instructions: typeof instructions === "string" && instructions.trim() ? instructions.trim() : undefined,
        });
        if (!created.ok) {
          return errorResponse(409, "job_in_progress", "A generation is already running.", { jobId: created.activeJobId });
        }

        runInBackground(runJob(admin, created.job.id));
        return Response.json({ jobId: created.job.id, status: toApiJob(created.job).status }, { status: 202 });
      },
    },
  },
});
