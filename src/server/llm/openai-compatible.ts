import {
  LlmAuthError,
  LlmProviderError,
  LlmRateLimitError,
  type LlmCallInput,
  type LlmCallResult,
} from "./types";

export type OpenAiCompatibleInput = LlmCallInput & {
  baseUrl: string; // e.g. https://openrouter.ai/api/v1
  model: string;
  maxOutputTokens: number;
  timeoutMs: number;
  /** Extra JSON fields merged into the request body (provider-specific options such as reasoning_effort). */
  extraBody?: Record<string, unknown> | undefined;
};

export type OpenAiCompatibleResult = LlmCallResult & {
  finishReason: string | null;
};

const DEFAULT_RATE_LIMIT_RETRY_SECONDS = 60;

function parseRetryAfterSeconds(res: Response): number {
  const header = res.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds > 0) return seconds;
  }
  return DEFAULT_RATE_LIMIT_RETRY_SECONDS;
}

function isOpenRouterHost(baseUrl: string): boolean {
  try {
    const url = new URL(baseUrl);
    return url.hostname === "openrouter.ai" || url.hostname.endsWith(".openrouter.ai");
  } catch {
    return false;
  }
}

export async function callOpenAICompatible(
  input: OpenAiCompatibleInput,
): Promise<OpenAiCompatibleResult> {
  const { apiKey, systemPrompt, userMessage, images, baseUrl, model, maxOutputTokens, timeoutMs, extraBody } =
    input;

  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  if (isOpenRouterHost(baseUrl)) {
    headers["HTTP-Referer"] = "https://www.shipfolio.xyz";
    headers["X-Title"] = "Shipfolio AI";
  }

  let userContent:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;

  if (images && images.length > 0) {
    userContent = [
      { type: "text", text: userMessage },
      ...images.map((img) => ({
        type: "image_url" as const,
        image_url: {
          url: `data:${img.mimeType};base64,${img.base64Data}`,
        },
      })),
    ];
  } else {
    userContent = userMessage;
  }

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];

  const body = JSON.stringify({
    ...extraBody,
    model,
    max_tokens: maxOutputTokens,
    stream: false,
    messages,
  });

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new LlmProviderError(`${model} timed out`);
    }
    if (err instanceof Error) {
      if (err.name === "AbortError" || err.name === "TimeoutError") {
        throw new LlmProviderError(`${model} timed out`);
      }
      throw new LlmProviderError(err.message);
    }
    throw new LlmProviderError("Network error calling OpenAI-compatible provider");
  }

  if (res.status === 401 || res.status === 403) {
    throw new LlmAuthError("Provider rejected the API key");
  }

  if (res.status === 429) {
    const retryAfter = parseRetryAfterSeconds(res);
    throw new LlmRateLimitError("Provider rate limit reached", retryAfter);
  }

  // The time limit also covers reading the reply, so a slow model can time out here too.
  const readFailure = (err: unknown) =>
    new LlmProviderError(
      err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError") ? `${model} timed out` : "Provider sent an unreadable response",
    );

  if (!res.ok) {
    let rawBody: string;
    try {
      rawBody = await res.text();
    } catch (err) {
      throw readFailure(err);
    }
    // Safety: ensure api key is never in error message
    const safeBody = (apiKey ? rawBody.replaceAll(apiKey, "[REDACTED]") : rawBody).slice(0, 300);
    throw new LlmProviderError(`Provider API error (${res.status}): ${safeBody}`);
  }

  let json: {
    choices?: Array<{
      message?: { content?: unknown };
      finish_reason?: string | null;
    }>;
  };
  try {
    json = await res.json();
  } catch (err) {
    throw readFailure(err);
  }

  const choice = json.choices?.[0];
  const content = choice?.message?.content;

  if (typeof content !== "string" || content.length === 0) {
    throw new LlmProviderError("empty response");
  }

  return {
    text: content,
    finishReason: choice?.finish_reason ?? null,
  };
}
