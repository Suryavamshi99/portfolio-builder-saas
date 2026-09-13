import { LLM_MODELS } from "@/config/llm";
import { LlmAuthError, LlmProviderError, type LlmCallInput, type LlmCallResult } from "./types";

export async function callAnthropic({ apiKey, systemPrompt, userMessage }: LlmCallInput): Promise<LlmCallResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: LLM_MODELS.anthropic,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (res.status === 401 || res.status === 403) {
    throw new LlmAuthError("Anthropic rejected the API key");
  }
  if (!res.ok) {
    throw new LlmProviderError(`Anthropic API error (${res.status}): ${(await res.text()).slice(0, 500)}`);
  }

  const json = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (json.content ?? []).map((block) => block.text ?? "").join("");
  return { text };
}
