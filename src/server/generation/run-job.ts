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
import { getFreeChain } from "./free-wiring";
import { advancePipeline, scheduleContinue } from "./pipeline/run-pipeline-job";
import { resumeLines } from "./pipeline/plan";
import type { BuildInput } from "./pipeline/types";
import {
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
import { registry } from "@/server/themes/registry";
import { runThemedBuild } from "@/server/themes/run";
import type { ModelCall } from "@/server/themes/content";
import { callOpenAICompatible } from "@/server/llm/openai-compatible";

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
  // A step-by-step build that is being continued keeps its own progress message.
  if (!job.params.pipeline) await setStatus(admin, job.id, "reading");

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
  if (job.source !== "free") await setStatus(admin, job.id, "writing");

  let html: string;
  let warnings: string[];
  let model: string;
  let source: "gemini" | "free";

  if (job.params.theme && (job.source === "gemini" || job.source === "free")) {
    const manifest = registry.getReady(job.params.theme.id);
    const template = manifest ? registry.template(manifest.id) : undefined;
    if (!manifest || !template) return failJob(admin, job.id, { code: "theme_unavailable", message: "That theme isn't available. Pick another or build a custom page." });
    const modelCall = await themeModelCall(admin, job);
    await setStatus(admin, job.id, "writing");
    const built = await runThemedBuild({
      manifest,
      template,
      request: job.params.theme,
      resumeText: prepared.resumeText,
      referenceText: [prepared.referenceText, ...Object.values(job.params.theme.answers ?? {})].join("\n"),
      finalize,
      model: modelCall,
    });
    if (!built.ok) {
      await recordGeneration(admin, job.user_id, job.resume_upload_id, "failed");
      return failJob(admin, job.id, { code: built.code, message: CHECK_FAILED[built.code], details: built.details });
    }
    await setStatus(admin, job.id, "saving");
    await savePortfolioVersion(admin, job.user_id, {
      html: built.html,
      source: job.source,
      model: `theme:${manifest.id}`,
      warnings: [...built.warnings, ...built.declined.map((d) => `Not applied: ${d}`)],
    });
    await recordGeneration(admin, job.user_id, job.resume_upload_id, "succeeded");
    return completeJob(admin, job.id);
  }

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
    // The step-by-step builder (see pipeline/): a free model cannot write a whole page in one call.
    const input: BuildInput = {
      lines: resumeLines(prepared.resumeText),
      specifics: prepared.specifics,
      instructions: job.params.instructions,
      designIntensity: prepared.designIntensity,
      photoUrl: prepared.photoUrl,
      links: prepared.links,
    };
    // setStatus() above moved updated_at; the pipeline's lease compares against the current row.
    const current = (await getJobById(admin, job.id)) ?? job;
    const outcome = await advancePipeline(admin, current, input, finalize);

    if (outcome.kind === "stopped") return; // another run owns this build
    if (outcome.kind === "yield") {
      scheduleContinue(job.id); // not finished: continue in a fresh invocation
      return;
    }
    if (outcome.kind === "no_capacity") {
      // Queue for tomorrow only when every budget is genuinely spent. If some provider still has budget left
      // and is just cooling down after an error, the models are busy: let the user retry in a few minutes.
      const { data: rows } = await admin.from("provider_budgets").select("provider, used").eq("day", day);
      const used = new Map((rows ?? []).map((r) => [r.provider as string, r.used as number]));
      const someBudgetLeft = providers.some((p) => (used.get(p.id) ?? 0) < p.dailyRequestBudget);
      if (!someBudgetLeft) return queueJob(admin, job.id, nextBudgetReset());
      return failJob(admin, job.id, {
        code: "free_models_busy",
        message: "The free AI models are busy right now. Please try again in a few minutes.",
      });
    }
    if (outcome.kind === "failed") {
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

/** One bounded text call for a themed build: the user's Gemini key, or the first free provider with budget left. */
async function themeModelCall(admin: SupabaseClient, job: JobRow): Promise<ModelCall | undefined> {
  if (job.source === "gemini") {
    const { data: keyRow } = await admin.from("byok_keys").select("encrypted_key, nonce").eq("user_id", job.user_id).eq("provider", "google").maybeSingle();
    if (!keyRow) return undefined;
    const apiKey = decryptSecret(byteaToBuffer(keyRow.encrypted_key), byteaToBuffer(keyRow.nonce));
    return async (system, user) => (await callLlmProvider("google", { apiKey, systemPrompt: system, userMessage: user, images: [] })).text;
  }
  const day = budgetDay();
  for (const p of getFreeChain()) {
    const apiKey = process.env[p.apiKeyEnv]?.trim();
    if (!apiKey) continue;
    const { data } = await admin.rpc("claim_provider_budget", { p_provider: p.id, p_day: day, p_limit: p.dailyRequestBudget });
    if (data !== true) continue;
    return async (system, user, maxTokens) =>
      (await callOpenAICompatible({ apiKey, systemPrompt: system, userMessage: user, images: [], baseUrl: p.baseUrl, model: p.model, maxOutputTokens: maxTokens, timeoutMs: 60_000, extraBody: p.extraBody })).text;
  }
  return undefined;
}
