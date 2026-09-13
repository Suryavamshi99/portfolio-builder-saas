import { LLM_MODELS } from "@/config/llm";
import { LlmAuthError, LlmProviderError, type LlmCallInput, type LlmCallResult } from "./types";

export async function callGoogle({ apiKey, systemPrompt, userMessage }: LlmCallInput): Promise<LlmCallResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${LLM_MODELS.google}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });

  if (res.status === 401 || res.status === 403) {
    throw new LlmAuthError("Google rejected the API key");
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
