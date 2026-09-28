import { LLM_MODELS } from "@/config/llm";
import { LlmAuthError, LlmProviderError, LlmRateLimitError, type LlmCallInput, type LlmCallResult } from "./types";

/** Used when the provider doesn't tell us how long to wait. */
const DEFAULT_RATE_LIMIT_RETRY_SECONDS = 60;

/**
 * Gemini's 429 body embeds a google.rpc.RetryInfo detail like
 * `{"@type": "...RetryInfo", "retryDelay": "31s"}` — prefer the standard
 * Retry-After header if present, fall back to parsing that, then a default.
 */
function parseRetryAfterSeconds(res: Response, bodyText: string): number {
  const header = res.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds > 0) return seconds;
  }
  const match = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(bodyText);
  if (match?.[1]) return Math.ceil(Number(match[1]));
  return DEFAULT_RATE_LIMIT_RETRY_SECONDS;
}

export async function callGoogle({ apiKey, systemPrompt, userMessage, images }: LlmCallInput): Promise<LlmCallResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${LLM_MODELS.google}:generateContent`;

  const imageParts = (images ?? []).map((img) => ({
    inline_data: { mime_type: img.mimeType, data: img.base64Data },
  }));

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      // Images first, then the text instructions — Gemini reads visual
      // context better when it precedes what to do with it. Output is a
      // free-form HTML document now, not JSON, so no responseMimeType.
      contents: [{ role: "user", parts: [...imageParts, { text: userMessage }] }],
    }),
  });

  if (res.status === 401 || res.status === 403) {
    throw new LlmAuthError("Google rejected the API key");
  }
  if (res.status === 429) {
    const bodyText = await res.text();
    const retryAfterSeconds = parseRetryAfterSeconds(res, bodyText);
    throw new LlmRateLimitError("Gemini is rate-limiting this key right now", retryAfterSeconds);
  }
  if (!res.ok) {
    throw new LlmProviderError(`Google API error (${res.status}): ${(await res.text()).slice(0, 500)}`);
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = (json.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? "").join("");
  return { text };
}
