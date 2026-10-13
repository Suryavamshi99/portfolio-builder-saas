import type { LlmImageInput } from "@/server/llm";
import type { ChainProvider } from "./free-chain";

// The real providers come from src/config/free-models.ts and
// callOpenAICompatible (handoff 06a). Until that is merged the free chain is
// empty and free generation reports "unavailable".
export function getFreeChain(): ChainProvider[] {
  return [];
}

export async function callFreeProvider(
  _provider: ChainProvider,
  _userMessage: string,
  _images: LlmImageInput[],
): Promise<{ text: string; finishReason: string | null }> {
  throw new Error("Free providers are not configured");
}
