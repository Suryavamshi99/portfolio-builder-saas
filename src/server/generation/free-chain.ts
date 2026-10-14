import { LlmAuthError, LlmProviderError, LlmRateLimitError, type LlmImageInput } from "@/server/llm";
import { finalizeWithFactCheck } from "@/server/checked-generation";
import type { FinalizeHtmlInput } from "@/server/finalize-html";

/** The part of a free provider (src/config/free-models.ts) the chain needs. */
export interface ChainProvider {
  id: string;
  label: string;
  model: string;
  supportsImages: boolean;
  dailyRequestBudget: number;
}

export type ChainOutcome =
  | { ok: true; html: string; warnings: string[]; providerId: string; model: string }
  | { ok: false; reason: "exhausted" }
  | { ok: false; reason: "busy" }
  | { ok: false; reason: "failed"; code: "generation_invalid_output" | "generation_unsupported_claims"; details: string[] };

const COOLDOWN_RATE_LIMIT_FALLBACK_S = 300;
const COOLDOWN_PROVIDER_ERROR_S = 60;
const COOLDOWN_AUTH_ERROR_S = 3600;

/**
 * Tries each provider in order (plan 6.3). A provider is skipped when its daily
 * budget is spent or it is cooling down; an error or a page that fails our
 * checks (after the one repair round on the same provider) moves on to the next.
 * Never retries a provider in a loop.
 */
export async function runFreeChain(opts: {
  providers: ChainProvider[];
  claim: (p: ChainProvider) => Promise<boolean>;
  cooldown: (p: ChainProvider, seconds: number) => Promise<void>;
  call: (p: ChainProvider, userMessage: string, images: LlmImageInput[]) => Promise<{ text: string; finishReason: string | null }>;
  userMessage: string;
  images: LlmImageInput[];
  finalize: Omit<FinalizeHtmlInput, "rawText">;
  deadlineMs: number;
  onProvider?: (p: ChainProvider) => void | Promise<void>;
}): Promise<ChainOutcome> {
  let lastFailure: Extract<ChainOutcome, { reason: "failed" }> | null = null;
  let providerErrors = 0;

  for (const provider of opts.providers) {
    if (Date.now() >= opts.deadlineMs) break;
    if (!(await opts.claim(provider))) continue;
    await opts.onProvider?.(provider);

    const images = provider.supportsImages ? opts.images : [];
    try {
      const first = await opts.call(provider, opts.userMessage, images);
      // A reply that stopped at the length limit is a cut-off page: don't spend a repair on it.
      const result = await finalizeWithFactCheck({
        firstReply: first.finishReason === "length" ? "" : first.text,
        finalize: opts.finalize,
        originalUserMessage: opts.userMessage,
        repair: async (repairMessage) => (await opts.call(provider, repairMessage, [])).text,
      });
      if (result.ok) {
        return { ok: true, html: result.html, warnings: result.warnings, providerId: provider.id, model: provider.model };
      }
      lastFailure = {
        ok: false,
        reason: "failed",
        code: result.reason === "unsupported_claims" ? "generation_unsupported_claims" : "generation_invalid_output",
        details: result.details,
      };
    } catch (e) {
      providerErrors += 1;
      console.warn("Free provider failed", provider.id, e instanceof Error ? e.constructor.name : "error", e instanceof Error ? e.message.slice(0, 300) : "");
      if (e instanceof LlmRateLimitError) await opts.cooldown(provider, e.retryAfterSeconds || COOLDOWN_RATE_LIMIT_FALLBACK_S);
      else if (e instanceof LlmAuthError) await opts.cooldown(provider, COOLDOWN_AUTH_ERROR_S);
      else if (e instanceof LlmProviderError) await opts.cooldown(provider, COOLDOWN_PROVIDER_ERROR_S);
      else throw e;
    }
  }
  if (lastFailure) return lastFailure;
  // Providers were tried and errored (timeouts, rate limits): the models are busy, the budget is not spent.
  return providerErrors > 0 ? { ok: false, reason: "busy" } : { ok: false, reason: "exhausted" };
}
