import type { FreeProvider } from "@/config/free-models";
import { LlmAuthError, LlmProviderError, LlmRateLimitError } from "@/server/llm";
import type { FinalizeHtmlResult } from "@/server/finalize-html";

import { assembleDocument, cleanFragment, keysContaining } from "./assemble";
import { cleanModelCss, defaultCss } from "./default-design";
import { fallbackHero, fallbackSection } from "./fallback-render";
import { buildPlanMessage, fallbackPlan, parsePlan, sliceFor } from "./plan";
import { STEP_SYSTEM_PROMPT, buildDesignMessage, buildHeroMessage, buildSectionMessage } from "./prompts";
import { stepsFor, type BuildInput, type PipelineState, type Plan } from "./types";

/** How the steps reach the outside world. The real ones are in run-pipeline-job.ts; tests pass fakes. */
export interface EngineDeps {
  providers: FreeProvider[];
  call(p: FreeProvider, system: string, user: string, maxTokens: number, timeoutMs: number): Promise<{ text: string; finishReason: string | null }>;
  /** Uses one request of the provider's daily budget; false when it is spent or the provider is cooling down. */
  claim(p: FreeProvider): Promise<boolean>;
  cooldown(p: FreeProvider, seconds: number): Promise<void>;
  /** Saves the state and a progress message. False means another run took over this job: stop. */
  save(state: PipelineState, message: string): Promise<boolean>;
  finalize(html: string): FinalizeHtmlResult;
  /** Numbers on the page that the resume does not support. */
  claims(html: string): Array<{ claim: string; message: string }>;
  sleep(ms: number): Promise<void>;
  now(): number;
}

export type EngineOutcome =
  | { kind: "done"; html: string; warnings: string[]; model: string }
  | { kind: "failed"; code: "generation_invalid_output" | "generation_unsupported_claims"; details: string[] }
  | { kind: "no_capacity" }
  | { kind: "yield" }
  | { kind: "stopped" };

const CALL_TIMEOUT_MS = 40_000;
const MAX_ATTEMPTS = 3;
const COOLDOWN_RATE_LIMIT_FALLBACK_S = 60;
const COOLDOWN_RATE_LIMIT_MAX_S = 300;
const COOLDOWN_PROVIDER_ERROR_S = 60;
const COOLDOWN_AUTH_ERROR_S = 3600;
const WAIT_FOR_CAPACITY_MS = 15_000;

const MAX_TOKENS = { plan: 1600, design: 4500, hero: 1500, section: 2200 } as const;

const MESSAGES = {
  plan: "Reading your resume and planning the page…",
  design: "Designing the look…",
  hero: "Writing the top of your page…",
  finish: "Putting it together and checking every fact…",
};

type CallResult<T> = { value: T; provider: FreeProvider } | { none: "no_capacity" | "failed" | "deadline" };

export async function runPipeline(deps: EngineDeps, input: BuildInput, state: PipelineState, deadlineMs: number): Promise<EngineOutcome> {
  const stepStarted = () => deps.now();

  /** One model call with up to MAX_ATTEMPTS different providers; validate() turns a reply into a value or null. */
  async function ask<T>(step: string, user: string, maxTokens: number, validate: (text: string) => T | null, allowCutOff = false): Promise<CallResult<T>> {
    let attempts = 0;
    let waited = false;
    // Best (fastest) provider first, in the configured order; a failure or a rate limit moves to the next one.
    const order = deps.providers;
    let i = 0;
    while (i < order.length && attempts < MAX_ATTEMPTS) {
      if (deps.now() >= deadlineMs) return { none: "deadline" };
      const p = order[i]!;
      if (!(await deps.claim(p))) {
        i += 1;
        // Nothing could be claimed at all: the providers may only be cooling down. Wait once, then look again.
        if (i >= order.length && attempts === 0 && !waited && deps.now() + WAIT_FOR_CAPACITY_MS < deadlineMs) {
          waited = true;
          await deps.sleep(WAIT_FOR_CAPACITY_MS);
          i = 0;
        }
        continue;
      }
      attempts += 1;
      i += 1;
      const t0 = stepStarted();
      try {
        const r = await deps.call(p, STEP_SYSTEM_PROMPT, user, maxTokens, CALL_TIMEOUT_MS);
        if (r.finishReason === "length" && !allowCutOff) {
          state.log.push({ step, provider: p.id, ms: deps.now() - t0, ok: false, note: "cut off" });
          continue;
        }
        const value = validate(r.text);
        if (value === null) {
          state.log.push({ step, provider: p.id, ms: deps.now() - t0, ok: false, note: `unusable reply: ${r.text.replace(/\s+/g, " ").slice(0, 110)}` });
          continue;
        }
        state.log.push({ step, provider: p.id, ms: deps.now() - t0, ok: true });
        return { value, provider: p };
      } catch (e) {
        const note = e instanceof Error ? e.message.slice(0, 120) : "error";
        state.log.push({ step, provider: p.id, ms: deps.now() - t0, ok: false, note });
        if (e instanceof LlmRateLimitError) await deps.cooldown(p, Math.min(e.retryAfterSeconds || COOLDOWN_RATE_LIMIT_FALLBACK_S, COOLDOWN_RATE_LIMIT_MAX_S));
        else if (e instanceof LlmAuthError) await deps.cooldown(p, COOLDOWN_AUTH_ERROR_S);
        else if (e instanceof LlmProviderError) await deps.cooldown(p, COOLDOWN_PROVIDER_ERROR_S);
        else throw e;
      }
    }
    return { none: attempts === 0 ? "no_capacity" : "failed" };
  }

  const finishStep = async (key: string, message: string): Promise<boolean> => {
    state.done.push(key);
    return deps.save(state, message);
  };

  // ---- plan ----
  if (!state.done.includes("plan")) {
    if (!(await deps.save(state, MESSAGES.plan))) return { kind: "stopped" };
    const res = await ask("plan", buildPlanMessage(input), MAX_TOKENS.plan, (t) => parsePlan(t, input));
    if ("none" in res) {
      if (res.none === "deadline") return { kind: "yield" };
      if (res.none === "no_capacity") return { kind: "no_capacity" };
    }
    let plan: Plan;
    if ("value" in res) plan = res.value;
    else {
      plan = fallbackPlan(input);
      state.planFallback = true;
    }
    // The headline and tagline are model-written and sit in the page title: drop any that state numbers the resume does not.
    for (const field of ["tagline", "headline"] as const) {
      if (plan[field] && deps.claims(`<p>${plan[field]}</p>`).length > 0) plan = { ...plan, [field]: "" };
    }
    state.plan = plan;
    if (!(await finishStep("plan", MESSAGES.design))) return { kind: "stopped" };
  }

  const plan = state.plan!;
  const bold = input.designIntensity === "bold";

  for (const step of stepsFor(plan)) {
    if (state.done.includes(step)) continue;
    if (deps.now() >= deadlineMs) return { kind: "yield" };

    if (step === "design") {
      const res = await ask("design", buildDesignMessage(plan, input.designIntensity), MAX_TOKENS.design, cleanModelCss);
      if ("none" in res && res.none === "deadline") return { kind: "yield" };
      if ("value" in res) state.css = res.value;
      else {
        state.css = defaultCss(plan.theme, bold);
        state.cssFallback = true;
      }
      if (!(await finishStep("design", MESSAGES.hero))) return { kind: "stopped" };
    } else if (step === "hero") {
      const res = await ask("hero", buildHeroMessage(plan, input), MAX_TOKENS.hero, (t) => {
        const f = cleanFragment(t, "top", "hero");
        return f && /<h1\b/i.test(f) ? f : null;
      });
      if ("none" in res && res.none === "deadline") return { kind: "yield" };
      if ("value" in res) state.fragments["hero"] = res.value;
      else {
        state.fragments["hero"] = fallbackHero(plan, input);
        state.fallbacks.push("hero");
      }
      const next = plan.sections[0];
      if (!(await finishStep("hero", next ? `Writing: ${next.title}` : MESSAGES.finish))) return { kind: "stopped" };
    } else if (step === "finish") {
      return await finishPage(deps, input, state, plan, ask);
    } else {
      const section = plan.sections.find((s) => s.id === step)!;
      const source = sliceFor(section, input.lines);
      const res = await ask(step, buildSectionMessage(plan, section, source, input), MAX_TOKENS.section, (t) => cleanFragment(t, section.id, "sec"));
      if ("none" in res && res.none === "deadline") return { kind: "yield" };
      if ("value" in res) state.fragments[section.id] = res.value;
      else {
        state.fragments[section.id] = fallbackSection(section, source);
        state.fallbacks.push(section.id);
      }
      const idx = plan.sections.findIndex((s) => s.id === section.id);
      const next = plan.sections[idx + 1];
      if (!(await finishStep(step, next ? `Writing: ${next.title}` : MESSAGES.finish))) return { kind: "stopped" };
    }
  }
  return { kind: "yield" };
}

type Ask = <T>(step: string, user: string, maxTokens: number, validate: (text: string) => T | null, allowCutOff?: boolean) => Promise<CallResult<T>>;

/** Assemble, run the checks, redo only the parts with unsupported facts, and fall back to code-made parts if that is not enough. */
async function finishPage(deps: EngineDeps, input: BuildInput, state: PipelineState, plan: Plan, ask: Ask): Promise<EngineOutcome> {
  const css = state.css ?? defaultCss(plan.theme, input.designIntensity === "bold");
  const build = () => assembleDocument(plan, css, state.fragments, input);
  const rebuildInCode = (key: string) => {
    state.fragments[key] = key === "hero" ? fallbackHero(plan, input) : fallbackSection(plan.sections.find((s) => s.id === key)!, sliceFor(plan.sections.find((s) => s.id === key)!, input.lines));
    if (!state.fallbacks.includes(key)) state.fallbacks.push(key);
  };

  let fin = deps.finalize(build());
  if (!fin.ok) {
    // Should not happen for a page we assembled; build every part in code and try once more.
    for (const key of ["hero", ...plan.sections.map((s) => s.id)]) rebuildInCode(key);
    fin = deps.finalize(build());
    if (!fin.ok) return { kind: "failed", code: "generation_invalid_output", details: fin.errors };
  }

  let claims = deps.claims(fin.html);
  if (claims.length > 0 && !state.repaired) {
    const keys = [...new Set(claims.flatMap((c) => keysContaining(state.fragments, c.claim)))].slice(0, 4);
    for (const key of keys) {
      if (key === "hero") {
        rebuildInCode("hero"); // the hero has no source slice to correct against, so it is rebuilt in code
        continue;
      }
      const section = plan.sections.find((s) => s.id === key);
      if (!section) continue;
      const mine = claims.filter((c) => keysContaining({ [key]: state.fragments[key]! }, c.claim).length > 0);
      const res = await ask(`repair-${key}`, buildSectionMessage(plan, section, sliceFor(section, input.lines), input, mine.map((c) => `- "${c.claim}"`).join("\n")), MAX_TOKENS.section, (t) => cleanFragment(t, section.id, "sec"));
      if ("value" in res) state.fragments[key] = res.value;
      else if (res.none === "deadline") return { kind: "yield" }; // out of time: the next run repeats the check and continues
      else rebuildInCode(key);
    }
    state.repaired = true;
    fin = deps.finalize(build());
    if (!fin.ok) return { kind: "failed", code: "generation_invalid_output", details: fin.errors };
    claims = deps.claims(fin.html);
  }

  if (claims.length > 0) {
    // Still unsupported: rebuild the parts that hold them in code. If a claim is somewhere we cannot place (the title), rebuild everything in code.
    const keys = [...new Set(claims.flatMap((c) => keysContaining(state.fragments, c.claim)))];
    if (keys.length === 0) for (const key of ["hero", ...plan.sections.map((s) => s.id)]) rebuildInCode(key);
    else for (const key of keys) rebuildInCode(key);
    fin = deps.finalize(build());
    if (!fin.ok) return { kind: "failed", code: "generation_invalid_output", details: fin.errors };
    claims = deps.claims(fin.html);
    if (claims.length > 0) return { kind: "failed", code: "generation_unsupported_claims", details: claims.map((c) => c.message) };
  }

  const warnings = [...fin.warnings];
  if (state.fallbacks.length > 0 || state.cssFallback || state.planFallback) {
    warnings.push("Some parts of this page were built in simple mode because the free AI models were busy. Use \"Improve with AI\" later to refine it.");
  }
  const used = [...new Set(state.log.filter((l) => l.ok && l.provider).map((l) => l.provider as string))];
  const model = used.length ? `step build: ${used.map((p) => deps.providers.find((x) => x.id === p)?.model ?? p).join(", ")}`.slice(0, 200) : "step build (simple mode)";
  state.done.push("finish");
  return { kind: "done", html: fin.html, warnings, model };
}
