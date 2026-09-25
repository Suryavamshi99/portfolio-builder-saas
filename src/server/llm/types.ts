export type LlmImageInput = {
  mimeType: string;
  /** Raw base64, no "data:" URL prefix. */
  base64Data: string;
};

export type LlmCallInput = {
  apiKey: string;
  systemPrompt: string;
  userMessage: string;
  /** Visual-reference screenshots for design inspiration — currently only callGoogle attaches these. */
  images?: LlmImageInput[];
};

export type LlmCallResult = { text: string };

/** The provider rejected the key itself (bad/expired/revoked) — distinct from any other failure. */
export class LlmAuthError extends Error {}

/** Any other provider-side failure (network, 5xx, malformed response, rate limit on their end). */
export class LlmProviderError extends Error {}
