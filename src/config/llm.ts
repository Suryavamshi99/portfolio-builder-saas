export const LLM_PROVIDERS = ["anthropic", "openai", "google"] as const;
export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export function isLlmProvider(value: unknown): value is LlmProvider {
  return typeof value === "string" && (LLM_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Only Anthropic's current lineup was known with certainty at
 * implementation time (claude-sonnet-5) — verify/update the OpenAI and
 * Google model ids against each provider's current offering before
 * relying on this for real traffic.
 */
export const LLM_MODELS: Record<LlmProvider, string> = {
  anthropic: "claude-sonnet-5",
  openai: "gpt-4o",
  google: "gemini-2.0-flash",
};

/** Our own compute cost, independent of whose API key is used. */
export const GENERATIONS_PER_HOUR_LIMIT = 5;
