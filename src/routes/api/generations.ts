import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PLAN_GENERATIONS_PER_HOUR } from "@/config/plans";
import { checkHourlyRateLimit } from "@/server/rate-limit";
import { getOrCreateAppUser, hasPaidAccess } from "@/server/users";
import { checkThemeAccess } from "@/server/themes/gate";
import { parseThemeRequest } from "@/server/themes/types";
import { checkReplicaRequest, replicaEnabled, type ReplicaRequest } from "@/server/brand/replica";
import { savePortfolioInputs } from "@/server/portfolio-inputs";
import { runInBackground } from "@/server/generation/background";
import { createJob, toApiJob } from "@/server/generation/jobs";
import { FREE_GENERATIONS_PER_DAY, countFreeRunsToday } from "@/server/generation/limits";
import { getFreeChain } from "@/server/generation/free-wiring";
import { runJob } from "@/server/generation/run-job";
import { storeMcpReplica } from "@/server/mcp/replica-job";

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
        if (source !== "free" && source !== "gemini" && source !== "mcp") {
          return errorResponse(400, "invalid_request", "source must be 'free', 'gemini' or 'mcp'");
        }
        if (typeof resumeUploadId !== "string") return errorResponse(400, "invalid_request", "resumeUploadId is required");
        if (designIntensity !== undefined && designIntensity !== "minimal" && designIntensity !== "bold") {
          return errorResponse(400, "invalid_request", "designIntensity must be 'minimal' or 'bold'");
        }
        if (instructions !== undefined && (typeof instructions !== "string" || instructions.length > 2000)) {
          return errorResponse(400, "invalid_request", "instructions must be a string up to 2000 characters");
        }

        const appUser = await getOrCreateAppUser(supabase, user.id);
        if (!appUser) return errorResponse(500, "internal_error", "Could not load account");

        // A themed build. Unknown or not-ready themes are rejected; paid themes need paid access (checked here, not in the page).
        let theme: ReturnType<typeof parseThemeRequest> = null;
        if (body["theme"] !== undefined) {
          theme = parseThemeRequest(body["theme"]);
          if (!theme) return errorResponse(400, "invalid_request", "theme is not valid");
          const access = checkThemeAccess(theme.id, hasPaidAccess(appUser));
          if (!access.ok) return errorResponse(access.status, access.code, access.message);
        }

        // A "look like this company" build: behind a flag, never with a theme. Free users get the preview; publishing and downloads stay paid (see checkReplicaRequest).
        // For the connector (mcp) the request is only stored on the user's connector job; their chat reads it before the first build.
        // `replica: null` clears an earlier choice.
        let replica: ReplicaRequest | undefined;
        if (body["replica"] !== undefined && !(source === "mcp" && body["replica"] === null)) {
          const check = checkReplicaRequest(body["replica"], { enabled: replicaEnabled(), hasTheme: body["theme"] !== undefined });
          if (!check.ok) return errorResponse(check.status, check.code, check.message);
          replica = check.replica;
        }

        if (source === "mcp") {
          const admin = createSupabaseAdminClient();
          const { data: resumeRow } = await admin.from("uploads").select("id").eq("id", resumeUploadId).eq("user_id", user.id).eq("kind", "resume").maybeSingle();
          if (!resumeRow) return errorResponse(400, "resume_not_found", "Resume upload not found");
          const stored = await storeMcpReplica(admin, user.id, resumeUploadId, replica ?? null);
          if (!stored) return errorResponse(409, "job_in_progress", "A generation is already running.");
          return Response.json({ ok: true }, { status: 200 });
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
          theme: theme ?? undefined,
          replica,
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
