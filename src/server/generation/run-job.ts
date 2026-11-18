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
import { advancePipeline, freeProviderIO, scheduleContinue } from "./pipeline/run-pipeline-job";
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
import { resolveReplica } from "@/server/brand/replica-brief";
import { applyReplicaGuard, nameFromResume } from "@/server/brand/replica-guard";
import { designBriefFor } from "@/server/themes/brief";
import { extractFacts } from "@/server/themes/extract-facts";
import { getTemplate, renderTheme } from "@/server/themes/templates";
import { findUnsupportedClaims } from "@/server/fact-check";
import { finalizeHtml } from "@/server/finalize-html";
import { registry } from "@/server/themes/registry";
import { buildThemedPage, completeViaFreeChain, type ThemedDeps } from "./themed-build";

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

async function loadGeminiKey(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data: keyRow } = await admin.from("byok_keys").select("encrypted_key, nonce").eq("user_id", userId).eq("provider", "google").maybeSingle();
  return keyRow ? decryptSecret(byteaToBuffer(keyRow.encrypted_key), byteaToBuffer(keyRow.nonce)) : null;
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
  // A "look like this company" build: read the site once (kept with the job), and let its style, not its words, drive the brief.
  const replica = job.params.replica;
  const replicaRes = replica ? await resolveReplica(replica) : null;
  if (replica && replicaRes && !replica.brief) {
    job.params = { ...job.params, replica: { ...replica, brief: replicaRes.brief, companyName: replicaRes.companyName, warnings: replicaRes.warnings, needsImages: replicaRes.needsImages } };
    await admin.from("generation_jobs").update({ params: job.params, updated_at: new Date().toISOString() }).eq("id", job.id);
  }
  const designBrief = replicaRes?.brief ?? designBriefFor(job.params.theme?.id);

  const prepared = await prepareGeneration(admin, job.user_id, {
    resumeUploadId: job.resume_upload_id,
    instructions: job.params.instructions,
    designBrief,
  });
  if (!prepared.ok) return failJob(admin, job.id, { code: prepared.code, message: prepared.message });

  // Only a model that can see images can use screenshots; never fall back to a generic page.
  if (replicaRes?.needsImages && (job.source !== "gemini" || prepared.images.length === 0)) {
    await recordGeneration(admin, job.user_id, job.resume_upload_id, "failed");
    return failJob(admin, job.id, {
      code: "replica_unreadable",
      message:
        job.source === "gemini"
          ? "This site could not be read. Add up to 3 screenshots of it, or check the address."
          : "This site could not be read. Use your own Gemini key or Claude/ChatGPT so we can use your screenshots, or check the address.",
    });
  }

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
  let geminiKey: string | null = null;

  // A theme with a real template is built from facts (one extraction call + a template); any problem falls back to the brief path below.
  let themeWarnings = [...(job.params.themeWarnings ?? []), ...(replicaRes?.warnings ?? [])];
  const themeId = job.params.theme?.id;
  if (getTemplate(themeId) && !job.params.pipeline && (job.source === "gemini" || job.source === "free")) {
    if (job.source === "gemini") {
      geminiKey = await loadGeminiKey(admin, job.user_id);
      if (!geminiKey) return failJob(admin, job.id, { code: "byok_key_missing", message: "Connect a Google Gemini API key first" });
    }
    const themeName = registry.get(themeId!)?.name ?? "chosen";
    await setStatus(admin, job.id, "writing", { message: `Reading your resume into the ${themeName} look…` });
    const providers = getFreeChain();
    const io = freeProviderIO(admin, budgetDay());
    const key = geminiKey;
    const deps: ThemedDeps = {
      extract: extractFacts,
      complete:
        job.source === "gemini"
          ? async (system, user) => (await callLlmProvider("google", { apiKey: key!, systemPrompt: system, userMessage: user, images: [] })).text
          : (system, user) => completeViaFreeChain(io, providers, system, user),
      render: renderTheme,
      finalize: (h) => finalizeHtml({ ...finalize, rawText: h }),
      claims: (h, ref) => findUnsupportedClaims(h, ref),
    };
    let outcome: Awaited<ReturnType<typeof buildThemedPage>>;
    try {
      outcome = await buildThemedPage(deps, {
        themeId: themeId!,
        typed: job.params.theme?.custom,
        input: {
          resumeText: prepared.resumeText,
          ...(prepared.specifics ? { specifics: prepared.specifics } : {}),
          links: prepared.links,
          ...(prepared.photoUrl ? { photoUrl: prepared.photoUrl } : {}),
          ...(job.params.instructions ? { instructions: job.params.instructions } : {}),
        },
        referenceText: prepared.referenceText,
      });
    } catch (e) {
      console.warn("Themed build crashed, using the brief path", job.id, e instanceof Error ? e.message : e);
      outcome = { kind: "fallback", warning: "This look couldn't be built, so the AI designed your page instead." };
    }
    if (outcome.kind === "provider_error" && job.source === "gemini") {
      await recordGeneration(admin, job.user_id, job.resume_upload_id, "failed");
      return failJob(admin, job.id, llmJobError(outcome.error));
    }
    if (outcome.kind === "no_capacity") {
      const { data: rows } = await admin.from("provider_budgets").select("provider, used").eq("day", budgetDay());
      const used = new Map((rows ?? []).map((r) => [r.provider as string, r.used as number]));
      if (!providers.some((p) => (used.get(p.id) ?? 0) < p.dailyRequestBudget)) return queueJob(admin, job.id, nextBudgetReset());
      return failJob(admin, job.id, { code: "free_models_busy", message: "The free AI models are busy right now. Please try again in a few minutes." });
    }
    if (outcome.kind === "done") {
      await setStatus(admin, job.id, "saving");
      await savePortfolioVersion(admin, job.user_id, {
        html: outcome.html,
        source: job.source,
        model: job.source === "gemini" ? LLM_MODELS.google : "template",
        warnings: outcome.warnings,
      });
      await recordGeneration(admin, job.user_id, job.resume_upload_id, "succeeded");
      return completeJob(admin, job.id);
    }
    const warning = outcome.kind === "fallback" ? outcome.warning : "This look couldn't be built right now, so the AI designed your page instead.";
    themeWarnings = [...themeWarnings, warning];
    // Kept with the job so a build that continues in later runs still tells the user.
    await admin.from("generation_jobs").update({ params: { ...job.params, themeWarnings }, updated_at: new Date().toISOString() }).eq("id", job.id);
    if (job.source === "gemini") await setStatus(admin, job.id, "writing");
  }

  if (job.source === "gemini") {
    source = "gemini";
    model = LLM_MODELS.google;
    const apiKey = geminiKey ?? (await loadGeminiKey(admin, job.user_id));
    if (!apiKey) return failJob(admin, job.id, { code: "byok_key_missing", message: "Connect a Google Gemini API key first" });
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
      instructions: [designBrief, job.params.instructions].filter(Boolean).join("\n\n") || undefined,
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

  if (replicaRes) {
    // Disclaimer, noindex and no company-hosted graphics, then the same safety rules and fact check as any page.
    const company = replicaRes.companyName;
    const guarded = applyReplicaGuard(html, { name: nameFromResume(prepared.resumeText), company, companyUrl: job.params.replica?.url ?? "" });
    const again = finalizeHtml({ ...finalize, rawText: guarded.html });
    if (!again.ok || findUnsupportedClaims(again.html, `${prepared.referenceText}\n${company}`).length > 0) {
      await recordGeneration(admin, job.user_id, job.resume_upload_id, "failed");
      return failJob(admin, job.id, { code: "generation_invalid_output", message: CHECK_FAILED.generation_invalid_output });
    }
    html = again.html;
    warnings = [...warnings, ...again.warnings];
  }

  await setStatus(admin, job.id, "saving");
  await savePortfolioVersion(admin, job.user_id, { html, source, model, warnings: [...themeWarnings, ...warnings] });
  await recordGeneration(admin, job.user_id, job.resume_upload_id, "succeeded");
  await completeJob(admin, job.id);
}
