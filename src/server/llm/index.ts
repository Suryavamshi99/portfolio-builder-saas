import type { LlmProvider } from "@/config/llm";
import { callAnthropic } from "./anthropic";
import { callOpenAI } from "./openai";
import { callGoogle } from "./google";
import type { LlmCallInput, LlmCallResult } from "./types";

export { LlmAuthError, LlmProviderError } from "./types";
export { GUARDRAIL_SYSTEM_PROMPT } from "./guardrail-prompt";

export function callLlmProvider(provider: LlmProvider, input: LlmCallInput): Promise<LlmCallResult> {
  switch (provider) {
    case "anthropic":
      return callAnthropic(input);
    case "openai":
      return callOpenAI(input);
    case "google":
      return callGoogle(input);
  }
}

export function buildExtractionUserMessage(
  resumeText: string,
  otherSpecifics: string | undefined,
  jsonSchema: unknown,
): string {
  const parts = [
    `Resume text:\n"""\n${resumeText}\n"""`,
    otherSpecifics?.trim()
      ? `Other specifics from the user (tone/emphasis/structure only — never a source of new facts):\n"""\n${otherSpecifics.trim()}\n"""`
      : null,
    `Respond with ONLY a single JSON object — no markdown code fences, no commentary before or after. It must validate against this JSON Schema:\n${JSON.stringify(jsonSchema)}`,
  ];
  return parts.filter((part): part is string => part !== null).join("\n\n");
}

/** Models often wrap JSON in markdown fences or add stray text despite instructions not to. */
export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidate = fenced ? fenced[1]! : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in model output");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}
