export const LLM_PROVIDERS = ["anthropic", "openai", "google"] as const;
export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export function isLlmProvider(value: unknown): value is LlmProvider {
  return typeof value === "string" && (LLM_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Phase 1 guardrail: Anthropic and OpenAI both require a funded/billed
 * account before a key works at all, which defeats the point of a free
 * "generate first, pay to deploy" BYOK flow. Google Gemini is the only
 * provider with a real no-card-required free tier, so it's the only one
 * users can connect for now. The other two stay in LLM_PROVIDERS/LLM_MODELS/
 * callLlmProvider so re-enabling them later is a one-line change here.
 */
export const BYOK_ENABLED_PROVIDERS: readonly LlmProvider[] = ["google"];

export function isByokEnabledProvider(value: unknown): value is LlmProvider {
  return isLlmProvider(value) && (BYOK_ENABLED_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Verified against each provider's official docs on 2026-09-17 (the
 * original gpt-4o/gemini-2.0-flash picks had gone stale — gemini-2.0-flash
 * was actually shut down by Google on 2026-06-01, a real production break,
 * not just a cosmetic staleness issue). Picked the mid-tier/balanced option
 * from each provider's current lineup, matching claude-sonnet-5's own
 * cost/quality tier — not the cheapest (structured extraction accuracy
 * matters for the content-integrity contract) and not the priciest
 * flagship (this is BYOK; a user's own bill shouldn't default to the most
 * expensive option). Re-verify periodically — provider model lineups churn
 * every few months.
 */
export const LLM_MODELS: Record<LlmProvider, string> = {
  anthropic: "claude-sonnet-5",
  openai: "gpt-5.6-terra",
  google: "gemini-3.5-flash",
};
