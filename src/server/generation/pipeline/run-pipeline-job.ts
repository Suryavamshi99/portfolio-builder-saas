import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getAppOrigin } from "@/config/app";
import type { FreeProvider } from "@/config/free-models";
import { findUnsupportedClaims } from "@/server/fact-check";
import { finalizeHtml, type FinalizeHtmlInput } from "@/server/finalize-html";
import { LlmProviderError } from "@/server/llm";
import { callOpenAICompatible } from "@/server/llm/openai-compatible";
import { runInBackground } from "../background";
import { budgetDay, type JobRow } from "../jobs";
import { getFreeChain } from "../free-wiring";
import { runPipeline, type EngineDeps, type EngineOutcome } from "./engine";
import { emptyState, type BuildInput, type PipelineState } from "./types";

/** One run works for this long, then hands over to a fresh invocation (a serverless function lives at most 300 s). */
export const PIPELINE_TICK_MS = 170_000;
const LEASE_MS = 250_000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function pipelineStateOf(job: JobRow): PipelineState | undefined {
  return job.params.pipeline;
}

/** True when a run is working on this job right now. */
export function leaseActive(state: PipelineState | undefined, now = Date.now()): boolean {
  return Boolean(state?.lease && Date.parse(state.lease.until) > now);
}

/**
 * Runs the free build for a job as far as one invocation allows. The caller turns the outcome into a final job state;
 * on "yield" the build is not finished and must be continued (see scheduleContinue).
 */
export async function advancePipeline(
  admin: SupabaseClient,
  job: JobRow,
  input: BuildInput,
  finalizeCtx: Omit<FinalizeHtmlInput, "rawText">,
): Promise<EngineOutcome> {
  const state = pipelineStateOf(job) ?? emptyState();
  const now = Date.now();
  if (leaseActive(state, now)) return { kind: "stopped" };

  // Take the lease. If another run took it between our read and now, updated_at has moved and this matches nothing.
  const owner = randomUUID();
  state.lease = { owner, until: new Date(now + LEASE_MS).toISOString() };
  const nowIso = new Date(now).toISOString();
  const { data: acquired } = await admin
    .from("generation_jobs")
    .update({ params: { ...job.params, pipeline: state }, status: "writing", retry_at: null, updated_at: nowIso })
    .eq("id", job.id)
    .eq("updated_at", job.updated_at)
    .select("id");
  if (!acquired || acquired.length === 0) return { kind: "stopped" };

  const providers = getFreeChain();
  const day = budgetDay();

  const writeState = async (message: string, extra: Record<string, unknown> = {}): Promise<boolean> => {
    const lastOk = [...state.log].reverse().find((l) => l.ok && l.provider);
    const { data } = await admin
      .from("generation_jobs")
      .update({
        params: { ...job.params, pipeline: state },
        status: "writing",
        message,
        updated_at: new Date().toISOString(),
        ...(lastOk?.provider ? { provider: lastOk.provider } : {}),
        ...extra,
      })
      .eq("id", job.id)
      .eq("params->pipeline->lease->>owner", owner)
      .select("id");
    return (data?.length ?? 0) > 0;
  };

  const deps: EngineDeps = {
    providers,
    call: async (p: FreeProvider, system, user, maxTokens, timeoutMs) => {
      const apiKey = process.env[p.apiKeyEnv]?.trim();
      if (!apiKey) throw new LlmProviderError(`${p.label} is not configured`);
      return callOpenAICompatible({
        apiKey,
        systemPrompt: system,
        userMessage: user,
        images: [],
        baseUrl: p.baseUrl,
        model: p.model,
        maxOutputTokens: maxTokens,
        timeoutMs,
        extraBody: p.extraBody,
      });
    },
    claim: async (p) => {
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
    save: (s, message) => {
      // `s` is the same object as `state`; writeState reads it.
      void s;
      return writeState(message);
    },
    finalize: (html) => finalizeHtml({ ...finalizeCtx, rawText: html }),
    claims: (html) => findUnsupportedClaims(html, finalizeCtx.referenceText),
    sleep,
    now: Date.now,
  };

  let outcome: EngineOutcome;
  try {
    outcome = await runPipeline(deps, input, state, now + PIPELINE_TICK_MS);
  } catch (e) {
    // Hand the lease back so the next run can continue from the last saved step, then let the caller fail the job.
    await releaseLease(admin, job, state, owner);
    throw e;
  }

  if (outcome.kind === "stopped") return outcome;
  // Release the lease and keep the final state (its log shows which model did what) with the job.
  await releaseLease(admin, job, state, owner);
  return outcome;
}

async function releaseLease(admin: SupabaseClient, job: JobRow, state: PipelineState, owner: string): Promise<void> {
  delete state.lease;
  await admin
    .from("generation_jobs")
    .update({ params: { ...job.params, pipeline: state }, updated_at: new Date().toISOString() })
    .eq("id", job.id)
    .eq("params->pipeline->lease->>owner", owner);
}

/**
 * Starts the next run of an unfinished build in a fresh invocation (a new serverless function), so one build can use
 * many short runs. The target answers at once and does its work in the background.
 */
export function scheduleContinue(jobId: string): void {
  const secret = process.env["CRON_SECRET"];
  if (!secret) return;
  let origin: string;
  try {
    origin = getAppOrigin();
  } catch {
    return;
  }
  const url = `${origin}/api/cron/generation-advance?id=${encodeURIComponent(jobId)}`;
  runInBackground(
    fetch(url, { headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(15_000) }).then(
      () => undefined,
      () => undefined,
    ),
  );
}
