export type LlmCallInput = {
  apiKey: string;
  systemPrompt: string;
  userMessage: string;
};

export type LlmCallResult = { text: string };

/** The provider rejected the key itself (bad/expired/revoked) — distinct from any other failure. */
export class LlmAuthError extends Error {}

/** Any other provider-side failure (network, 5xx, malformed response, rate limit on their end). */
export class LlmProviderError extends Error {}
