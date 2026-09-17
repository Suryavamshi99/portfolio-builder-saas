export const LLM_PROVIDERS = ["anthropic", "openai", "google"] as const;
export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export function isLlmProvider(value: unknown): value is LlmProvider {
  return typeof value === "string" && (LLM_PROVIDERS as readonly string[]).includes(value);
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
