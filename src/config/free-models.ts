export interface FreeProvider {
  id: "openrouter-a" | "openrouter-b" | "groq" | "cerebras";
  label: string;
  baseUrl: string;
  apiKeyEnv: string; // name of the env var holding the key
  model: string; // resolved from env, see below
  supportsImages: boolean;
  maxOutputTokens: number;
  timeoutMs: number;
  dailyRequestBudget: number; // shared across all users
}

interface ProviderDefinition {
  id: FreeProvider["id"];
  label: string;
  baseUrl: string;
  apiKeyEnv: string;
  modelEnv: string;
  budgetEnv: string;
  imagesEnv: string;
}

const PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  {
    id: "openrouter-a",
    label: "OpenRouter (A)",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKeyEnv: "OPENROUTER_API_KEY",
    modelEnv: "FREE_MODEL_OPENROUTER_A",
    budgetEnv: "FREE_BUDGET_OPENROUTER_A",
    imagesEnv: "FREE_IMAGES_OPENROUTER_A",
  },
  {
    id: "openrouter-b",
    label: "OpenRouter (B)",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKeyEnv: "OPENROUTER_API_KEY",
    modelEnv: "FREE_MODEL_OPENROUTER_B",
    budgetEnv: "FREE_BUDGET_OPENROUTER_B",
    imagesEnv: "FREE_IMAGES_OPENROUTER_B",
  },
  {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKeyEnv: "GROQ_API_KEY",
    modelEnv: "FREE_MODEL_GROQ",
    budgetEnv: "FREE_BUDGET_GROQ",
    imagesEnv: "FREE_IMAGES_GROQ",
  },
  {
    id: "cerebras",
    label: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    apiKeyEnv: "CEREBRAS_API_KEY",
    modelEnv: "FREE_MODEL_CEREBRAS",
    budgetEnv: "FREE_BUDGET_CEREBRAS",
    imagesEnv: "FREE_IMAGES_CEREBRAS",
  },
];

const DEFAULT_BUDGET = 200;
const DEFAULT_MAX_OUTPUT_TOKENS = 12000;
const DEFAULT_TIMEOUT_MS = 100000;

export function getFreeProviderChain(env: NodeJS.ProcessEnv): FreeProvider[] {
  const chain: FreeProvider[] = [];

  const maxOutputTokens = env["FREE_MAX_OUTPUT_TOKENS"]
    ? parseInt(env["FREE_MAX_OUTPUT_TOKENS"], 10) || DEFAULT_MAX_OUTPUT_TOKENS
    : DEFAULT_MAX_OUTPUT_TOKENS;

  for (const def of PROVIDER_DEFINITIONS) {
    const apiKey = env[def.apiKeyEnv]?.trim();
    const model = env[def.modelEnv]?.trim();

    if (!apiKey || !model) {
      continue;
    }

    // Free tier only: an OpenRouter model that isn't a ":free" variant can bill the account, so it is never used.
    if (def.baseUrl.includes("openrouter.ai") && !model.endsWith(":free")) {
      continue;
    }

    const budgetVal = env[def.budgetEnv]?.trim();
    const dailyRequestBudget = budgetVal ? parseInt(budgetVal, 10) || DEFAULT_BUDGET : DEFAULT_BUDGET;

    const supportsImages = env[def.imagesEnv]?.trim() === "true";

    chain.push({
      id: def.id,
      label: def.label,
      baseUrl: def.baseUrl,
      apiKeyEnv: def.apiKeyEnv,
      model,
      supportsImages,
      maxOutputTokens,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      dailyRequestBudget,
    });
  }

  return chain;
}
