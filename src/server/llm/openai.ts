import { LLM_MODELS } from "@/config/llm";
import { LlmAuthError, LlmProviderError, type LlmCallInput, type LlmCallResult } from "./types";

export async function callOpenAI({ apiKey, systemPrompt, userMessage }: LlmCallInput): Promise<LlmCallResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: LLM_MODELS.openai,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (res.status === 401 || res.status === 403) {
    throw new LlmAuthError("OpenAI rejected the API key");
  }
  if (!res.ok) {
    throw new LlmProviderError(`OpenAI API error (${res.status}): ${(await res.text()).slice(0, 500)}`);
  }

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content ?? "";
  return { text };
}
