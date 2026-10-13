import type { SupabaseClient } from "@supabase/supabase-js";
import { LLM_MODELS } from "@/config/llm";
import { byteaToBuffer, decryptSecret } from "@/lib/crypto";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { finalizeWithFactCheck } from "@/server/checked-generation";
import { recordGeneration } from "@/server/generations";
import {
  GUARDRAIL_SYSTEM_PROMPT,
  LlmAuthError,
  LlmRateLimitError,
  callLlmProvider,
} from "@/server/llm";
import { savePortfolioVersion } from "@/server/portfolio-versions";
import { runFreeChain, type ChainProvider } from "./free-chain";
import { callFreeProvider, getFreeChain } from "./free-wiring";
import {
  RUN_BUDGET_MS,
  budgetDay,
  completeJob,
  failJob,
  getJobById,
  nextBudgetReset,
  queueJob,
  setStatus,
  type JobError,
  type JobRow,
} from "./jobs";
import { prepareGeneration } from "./prepare";

function llmJobError(e: unknown): JobError {
  if (e instanceof LlmAuthError) return { code: "byok_key_invalid", message: "Your API key was rejected by the provider" };
  if (e instanceof LlmRateLimitError) {
    return {
      code: "provider_rate_limited",
      message: "The AI model is busy handling other requests right now. Please try again shortly.",
      retryAfterSeconds: e.retryAfterSeconds,
    };
  }
  return { code: "llm_provider_error", message: e instanceof Error ? e.message : String(e) };
}

const CHECK_FAILED: Record<"generation_invalid_output" | "generation_unsupported_claims", string> = {
  generation_invalid_output: "The AI's page didn't pass our checks. Please try again.",
  generation_unsupported_claims:
    "The AI's page included facts that aren't in your resume, even after one correction. Please try again or add those details in your specifics.",
};

/** Runs one job to a final state. Never throws: every failure ends in a failed job. */
export async function runJob(admin: SupabaseClient, jobId: string): Promise<void> {
  const job = await getJobById(admin, jobId);
  if (!job || job.status === "done" || job.status === "failed") return;
  try {
    await execute(admin, job);
  } catch (e) {
    console.error("Generation job crashed", job.id, e instanceof Error ? e.message : e);
    await recordGeneration(admin, job.user_id, job.resume_upload_id, "failed").catch(() => {});
    await failJob(admin, job.id, { code: "internal_error", message: "Something went wrong on our side. Please try again." });
  }
}

async function execute(admin: SupabaseClient, job: JobRow): Promise<void> {
  const deadlineMs = Date.now() + RUN_BUDGET_MS;
  await setStatus(admin, job.id, "reading");

  if (!job.resume_upload_id) {
    return failJob(admin, job.id, { code: "resume_not_found", message: "Resume upload not found" });
  }
  const prepared = await prepareGeneration(admin, job.user_id, {
    resumeUploadId: job.resume_upload_id,
    instructions: job.params.instructions,
  });
  if (!prepared.ok) return failJob(admin, job.id, { code: prepared.code, message: prepared.message });

  const finalize = {
    userId: job.user_id,
    supabaseUrl: getSupabaseEnv().url,
    links: prepared.links,
    referenceText: prepared.referenceText,
  };
  await setStatus(admin, job.id, "writing");

  let html: string;
  let warnings: string[];
  let model: string;
  let source: "gemini" | "free";

  if (job.source === "gemini") {
    source = "gemini";
    model = LLM_MODELS.google;
    const { data: keyRow } = await admin
      .from("byok_keys")
      .select("encrypted_key, nonce")
      .eq("user_id", job.user_id)
      .eq("provider", "google")
      .maybeSingle();
    if (!keyRow) return failJob(admin, job.id, { code: "byok_key_missing", message: "Connect a Google Gemini API key first" });
    const apiKey = decryptSecret(byteaToBuffer(keyRow.encrypted_key), byteaToBuffer(keyRow.nonce));
    const call = async (userMessage: string, images: typeof prepared.images) =>
      (await callLlmProvider("google", { apiKey, systemPrompt: GUARDRAIL_SYSTEM_PROMPT, userMessage, images })).text;

    let result: Awaited<ReturnType<typeof finalizeWithFactCheck>>;
    try {
      const first = await call(prepared.userMessage, prepared.images);
      await setStatus(admin, job.id, "checking");
      result = await finalizeWithFactCheck({
        firstReply: first,
        finalize,
        originalUserMessage: prepared.userMessage,
        repair: (m) => call(m, []),
      });
    } catch (e) {
      await recordGeneration(admin, job.user_id, job.resume_upload_id, "failed");
      return failJob(admin, job.id, llmJobError(e));
    }
    if (!result.ok) {
      await recordGeneration(admin, job.user_id, job.resume_upload_id, "failed");
      const code = result.reason === "unsupported_claims" ? "generation_unsupported_claims" : "generation_invalid_output";
      return failJob(admin, job.id, { code, message: CHECK_FAILED[code], details: result.details });
    }
    ({ html, warnings } = result);
  } else if (job.source === "free") {
    source = "free";
    const day = budgetDay();
    const providers = getFreeChain();
    const outcome = await runFreeChain({
      providers,
      claim: async (p: ChainProvider) => {
        const { data } = await admin.rpc("claim_provider_budget", { p_provider: p.id, p_day: day, p_limit: p.dailyRequestBudget });
        return data === true;
      },
      cooldown: async (p, seconds) => {
        await admin
          .from("provider_budgets")
          .update({ cooldown_until: new Date(Date.now() + seconds * 1000).toISOString() })
          .eq("provider", p.id)
          .eq("day", day);
      },
      call: callFreeProvider,
      userMessage: prepared.userMessage,
      images: prepared.images,
      finalize,
      deadlineMs,
      onProvider: async (p) => {
        await setStatus(admin, job.id, "writing", { provider: p.id });
      },
    });
    if (!outcome.ok && outcome.reason === "exhausted") {
      // Nothing was spent on this user; try again when the budgets reset.
      return queueJob(admin, job.id, nextBudgetReset());
    }
    if (!outcome.ok) {
      await recordGeneration(admin, job.user_id, job.resume_upload_id, "failed");
      return failJob(admin, job.id, { code: outcome.code, message: CHECK_FAILED[outcome.code], details: outcome.details });
    }
    ({ html, warnings, model } = outcome);
  } else {
    return failJob(admin, job.id, { code: "invalid_source", message: "This generation method isn't available here." });
  }

  await setStatus(admin, job.id, "saving");
  await savePortfolioVersion(admin, job.user_id, { html, source, model, warnings });
  await recordGeneration(admin, job.user_id, job.resume_upload_id, "succeeded");
  await completeJob(admin, job.id);
}
