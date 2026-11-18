import type { FreeProvider } from "@/config/free-models";
import { LlmAuthError, LlmProviderError, LlmRateLimitError, type ProfileLinks } from "@/server/llm";
import type { FinalizeHtmlResult } from "@/server/finalize-html";
import { customisationsSchema, NO_CUSTOMISATIONS, factsText, type Customisations, type PortfolioFacts } from "@/server/themes/facts";
import { curateFacts, type CurateInput, type CurateResult } from "@/server/themes/curate-facts";
import type { EngineDeps } from "./pipeline/engine";

/** The extraction step's contract (src/server/themes/extract-facts.ts), restated so this file can be tested with a stub. */
export interface ThemedExtractInput { resumeText: string; specifics?: string; links: ProfileLinks; photoUrl?: string; instructions?: string }
export interface ThemedExtractResult { facts: PortfolioFacts; custom: Customisations; usedFallback: boolean; notes: string[] }

export interface ThemedDeps {
  extract(input: ThemedExtractInput, complete: (system: string, user: string) => Promise<string>): Promise<ThemedExtractResult>;
  /** One non-streaming model call (the user's key, or the free chain). Throws the Llm*Error classes. */
  complete(system: string, user: string): Promise<string>;
  /** Text curation (src/server/themes/curate-facts.ts). Optional: defaults to the real curateFacts. Must never fail the build. */
  curate?(input: CurateInput, complete: (system: string, user: string) => Promise<string>): Promise<CurateResult>;
  render(id: string, facts: unknown, custom: unknown): string;
  finalize(html: string): FinalizeHtmlResult;
  claims(html: string, referenceText: string): Array<{ claim: string; message: string }>;
}

export type ThemedOutcome =
  | { kind: "done"; html: string; warnings: string[] }
  /** Use the brief path instead; `warning` tells the user why. */
  | { kind: "fallback"; warning: string }
  /** The model could not be reached and only the heuristic ran: let the caller handle the provider error as it does elsewhere. */
  | { kind: "provider_error"; error: unknown }
  | { kind: "no_capacity" };

export class NoFreeCapacityError extends Error {}

/** What the user typed on the picker wins over what was derived from their free-text instructions. */
export function mergeCustomisations(typed: Customisations | undefined, derived: Customisations | undefined): Customisations {
  const d = derived ?? NO_CUSTOMISATIONS;
  if (!typed) return d;
  return {
    ...(typed.accent ?? d.accent ? { accent: (typed.accent ?? d.accent)! } : {}),
    fonts: typed.fonts !== "theme" ? typed.fonts : d.fonts,
    hidden: typed.hidden.length > 0 ? typed.hidden : d.hidden,
    order: typed.order.length > 0 ? typed.order : d.order,
  };
}

/** Builds the page from facts and a template. Never throws for template or check problems: those come back as "fallback". */
export async function buildThemedPage(
  deps: ThemedDeps,
  args: { themeId: string; typed?: Customisations | undefined; input: ThemedExtractInput; referenceText: string },
): Promise<ThemedOutcome> {
  let capacityMissing = false;
  let providerError: unknown;
  const complete = async (system: string, user: string) => {
    try {
      return await deps.complete(system, user);
    } catch (e) {
      if (e instanceof NoFreeCapacityError) capacityMissing = true;
      else providerError = e;
      throw e;
    }
  };

  let extracted: ThemedExtractResult;
  try {
    extracted = await deps.extract(args.input, complete);
  } catch (e) {
    if (capacityMissing) return { kind: "no_capacity" };
    if (e instanceof LlmAuthError || e instanceof LlmRateLimitError) return { kind: "provider_error", error: e };
    return { kind: "fallback", warning: "We couldn't read your details into this look, so the AI designed your page instead." };
  }
  if (extracted.usedFallback) {
    if (capacityMissing) return { kind: "no_capacity" };
    if (providerError instanceof LlmAuthError || providerError instanceof LlmRateLimitError) return { kind: "provider_error", error: providerError };
  }

  // Curation: reword the text for this look. Skipped when extraction fell back to the plain reader (the model already failed once).
  let facts = extracted.facts;
  if (!extracted.usedFallback) {
    try {
      const curate = deps.curate ?? curateFacts;
      const c = await curate(
        {
          facts,
          themeId: args.themeId,
          source: { resumeText: args.input.resumeText, links: args.input.links, ...(args.input.specifics ? { specifics: args.input.specifics } : {}) },
          ...(args.input.instructions ? { instructions: args.input.instructions } : {}),
        },
        complete,
      );
      if (c.curated) facts = c.facts;
    } catch {
      /* curation never fails the build: use the facts as extracted */
    }
  }

  const custom = customisationsSchema.safeParse(mergeCustomisations(args.typed, extracted.custom));
  let html: string;
  try {
    html = deps.render(args.themeId, facts, custom.success ? custom.data : NO_CUSTOMISATIONS);
  } catch (e) {
    console.warn("Theme template failed", args.themeId, e instanceof Error ? e.message : e);
    return { kind: "fallback", warning: "This look couldn't be built from your details, so the AI designed your page instead." };
  }
  const fin = deps.finalize(html);
  if (!fin.ok) return { kind: "fallback", warning: "This look didn't pass our page checks, so the AI designed your page instead." };
  // The facts text is what the template shows; the resume and the user's words are still the reference for numbers.
  const unsupported = deps.claims(fin.html, `${args.referenceText}\n${factsText(facts)}`);
  if (unsupported.length > 0) {
    return { kind: "fallback", warning: "Some details in this look weren't found in your resume, so the AI designed your page instead." };
  }

  const warnings = [...fin.warnings];
  if (extracted.usedFallback) {
    warnings.unshift("The AI couldn't read your resume in detail, so some sections may be shorter than usual. Check your page and add anything missing in your details.");
  }
  return { kind: "done", html: fin.html, warnings };
}

const FREE_MAX_ATTEMPTS = 2;
const FREE_MAX_TOKENS = 6000;
const FREE_TIMEOUT_MS = 45_000;
const COOLDOWN_RATE_LIMIT_MAX_S = 300;

/**
 * One reply through the free chain, with the same claim/cooldown handling as the step-by-step build.
 * At most FREE_MAX_ATTEMPTS provider calls, so a themed build fits well inside one serverless invocation.
 */
export async function completeViaFreeChain(
  io: Pick<EngineDeps, "call" | "claim" | "cooldown">,
  providers: FreeProvider[],
  system: string,
  user: string,
): Promise<string> {
  let attempts = 0;
  let lastError: unknown;
  for (const p of providers) {
    if (attempts >= FREE_MAX_ATTEMPTS) break;
    if (!(await io.claim(p))) continue;
    attempts += 1;
    try {
      const r = await io.call(p, system, user, Math.min(FREE_MAX_TOKENS, p.maxOutputTokens || FREE_MAX_TOKENS), FREE_TIMEOUT_MS);
      if (r.finishReason === "length") {
        lastError = new LlmProviderError("The reply was cut off");
        continue;
      }
      return r.text;
    } catch (e) {
      lastError = e;
      if (e instanceof LlmRateLimitError) await io.cooldown(p, Math.min(e.retryAfterSeconds || 60, COOLDOWN_RATE_LIMIT_MAX_S));
      else if (e instanceof LlmAuthError) await io.cooldown(p, 3600);
      else if (e instanceof LlmProviderError) await io.cooldown(p, 60);
      else throw e;
    }
  }
  if (attempts === 0) throw new NoFreeCapacityError("No free model has capacity");
  throw lastError instanceof Error ? lastError : new LlmProviderError("The free models could not answer");
}
