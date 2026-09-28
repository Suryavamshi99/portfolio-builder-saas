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

/** The provider is rate-limiting this key (429) — distinct so callers can suggest a concrete retry time instead of a generic failure. */
export class LlmRateLimitError extends Error {
  retryAfterSeconds: number;
  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Any other provider-side failure (network, 5xx, malformed response). */
export class LlmProviderError extends Error {}
