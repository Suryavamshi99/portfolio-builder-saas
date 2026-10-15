export interface FreeProvider {
  /** "openrouter-a".."d", "cerebras", or "groq:<model>" (each Groq model has its own daily limits, so each is its own provider). */
  id: string;
  label: string;
  baseUrl: string;
  apiKeyEnv: string; // name of the env var holding the key
  model: string; // resolved from env, see below
  supportsImages: boolean;
  maxOutputTokens: number;
  timeoutMs: number;
  dailyRequestBudget: number; // shared across all users
  /** Extra JSON fields sent with every request (for example reasoning_effort for gpt-oss models). */
  extraBody?: Record<string, unknown>;
}

interface ProviderDefinition {
  id: string;
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
    id: "openrouter-c",
    label: "OpenRouter (C)",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKeyEnv: "OPENROUTER_API_KEY",
    modelEnv: "FREE_MODEL_OPENROUTER_C",
    budgetEnv: "FREE_BUDGET_OPENROUTER_C",
    imagesEnv: "FREE_IMAGES_OPENROUTER_C",
  },
  {
    id: "openrouter-d",
    label: "OpenRouter (D)",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKeyEnv: "OPENROUTER_API_KEY",
    modelEnv: "FREE_MODEL_OPENROUTER_D",
    budgetEnv: "FREE_BUDGET_OPENROUTER_D",
    imagesEnv: "FREE_IMAGES_OPENROUTER_D",
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
// OpenRouter's free models share ONE account-wide cap (50 requests a day unless the account has ever bought $10 of credit),
// however many model ids we use, so the four ids split it. Raise FREE_BUDGET_OPENROUTER_* if the account has more.
const DEFAULT_OPENROUTER_BUDGET = 12;
// Groq's free tier is per model: about 200K tokens a day. A pipeline call uses roughly 3-4K tokens.
const DEFAULT_GROQ_BUDGET = 55;
const DEFAULT_GROQ_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"];
const DEFAULT_MAX_OUTPUT_TOKENS = 12000;
const DEFAULT_TIMEOUT_MS = 100000;

function groqExtraBody(model: string): Record<string, unknown> | undefined {
  // gpt-oss models "think" before answering; low effort keeps a section call to a few seconds.
  return model.includes("gpt-oss") ? { reasoning_effort: "low" } : undefined;
}

/**
 * The free providers that are configured in this environment, fastest first:
 * Groq's models (very fast, small per-minute limits), then OpenRouter's ":free" models, then Cerebras.
 * Groq models come from FREE_MODELS_GROQ (comma separated), or the older FREE_MODEL_GROQ, or the built-in defaults.
 */
export function getFreeProviderChain(env: NodeJS.ProcessEnv): FreeProvider[] {
  const chain: FreeProvider[] = [];

  const maxOutputTokens = env["FREE_MAX_OUTPUT_TOKENS"]
    ? parseInt(env["FREE_MAX_OUTPUT_TOKENS"], 10) || DEFAULT_MAX_OUTPUT_TOKENS
    : DEFAULT_MAX_OUTPUT_TOKENS;

  const groqKey = env["GROQ_API_KEY"]?.trim();
  if (groqKey) {
    const listed = (env["FREE_MODELS_GROQ"] ?? env["FREE_MODEL_GROQ"] ?? "")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    const budgetVal = env["FREE_BUDGET_GROQ"]?.trim();
    const budget = budgetVal ? parseInt(budgetVal, 10) || DEFAULT_GROQ_BUDGET : DEFAULT_GROQ_BUDGET;
    for (const model of listed.length > 0 ? listed : DEFAULT_GROQ_MODELS) {
      chain.push({
        id: `groq:${model}`,
        label: `Groq (${model})`,
        baseUrl: "https://api.groq.com/openai/v1",
        apiKeyEnv: "GROQ_API_KEY",
        model,
        supportsImages: false,
        maxOutputTokens,
        timeoutMs: DEFAULT_TIMEOUT_MS,
        dailyRequestBudget: budget,
      });
      const extra = groqExtraBody(model);
      if (extra) chain[chain.length - 1]!.extraBody = extra;
    }
  }

  for (const def of PROVIDER_DEFINITIONS) {
    const apiKey = env[def.apiKeyEnv]?.trim();
    const model = env[def.modelEnv]?.trim();

    if (!apiKey || !model) {
      continue;
    }

    // Free tier only: an OpenRouter model that isn't a ":free" variant can bill the account, so it is never used.
    const isOpenRouter = def.baseUrl.includes("openrouter.ai");
    if (isOpenRouter && !model.endsWith(":free")) {
      continue;
    }

    const budgetVal = env[def.budgetEnv]?.trim();
    const fallbackBudget = isOpenRouter ? DEFAULT_OPENROUTER_BUDGET : DEFAULT_BUDGET;
    const dailyRequestBudget = budgetVal ? parseInt(budgetVal, 10) || fallbackBudget : fallbackBudget;

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
