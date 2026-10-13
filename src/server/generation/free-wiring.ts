import { getFreeProviderChain, type FreeProvider } from "@/config/free-models";
import { LlmProviderError, type LlmImageInput } from "@/server/llm";
import { GUARDRAIL_SYSTEM_PROMPT } from "@/server/llm";
import { callOpenAICompatible } from "@/server/llm/openai-compatible";
import type { ChainProvider } from "./free-chain";

/** Free providers that are configured (key and model set) in this environment. */
export function getFreeChain(): FreeProvider[] {
  return getFreeProviderChain(process.env);
}

export async function callFreeProvider(
  provider: ChainProvider,
  userMessage: string,
  images: LlmImageInput[],
): Promise<{ text: string; finishReason: string | null }> {
  const full = getFreeChain().find((p) => p.id === provider.id);
  const apiKey = full ? process.env[full.apiKeyEnv]?.trim() : undefined;
  if (!full || !apiKey) throw new LlmProviderError(`${provider.label} is not configured`);
  return callOpenAICompatible({
    apiKey,
    systemPrompt: GUARDRAIL_SYSTEM_PROMPT,
    userMessage,
    images,
    baseUrl: full.baseUrl,
    model: full.model,
    maxOutputTokens: full.maxOutputTokens,
    timeoutMs: full.timeoutMs,
  });
}
