import { describe, it, expect } from "vitest";
import { getFreeProviderChain } from "./free-models";

describe("getFreeProviderChain", () => {
  const fullValidEnv: NodeJS.ProcessEnv = {
    OPENROUTER_API_KEY: "sk-or-test",
    GROQ_API_KEY: "gsk-test",
    CEREBRAS_API_KEY: "csk-test",
    FREE_MODEL_OPENROUTER_A: "meta-llama/llama-3.3-70b-instruct:free",
    FREE_MODEL_OPENROUTER_B: "qwen/qwen-2.5-72b-instruct:free",
    FREE_MODEL_GROQ: "llama-3.3-70b-versatile",
    FREE_MODEL_CEREBRAS: "llama3.3-70b",
  };

  it("lists Groq first (fastest), then OpenRouter, then Cerebras, with realistic default budgets", () => {
    const chain = getFreeProviderChain(fullValidEnv);

    expect(chain.map((p) => p.id)).toEqual(["groq:llama-3.3-70b-versatile", "openrouter-a", "openrouter-b", "cerebras"]);

    expect(chain[0]).toEqual({
      id: "groq:llama-3.3-70b-versatile",
      label: "Groq (llama-3.3-70b-versatile)",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKeyEnv: "GROQ_API_KEY",
      model: "llama-3.3-70b-versatile",
      supportsImages: false,
      maxOutputTokens: 12000,
      timeoutMs: 100000,
      dailyRequestBudget: 55, // Groq's free tier is about 200K tokens a day per model
    });
    // OpenRouter's free models share one small account-wide cap, so the four ids split it
    expect(chain[1]).toMatchObject({ id: "openrouter-a", baseUrl: "https://openrouter.ai/api/v1", dailyRequestBudget: 12 });
    expect(chain[2]).toMatchObject({ id: "openrouter-b", dailyRequestBudget: 12 });
    expect(chain[3]).toMatchObject({ id: "cerebras", baseUrl: "https://api.cerebras.ai/v1", dailyRequestBudget: 200 });
  });

  it("uses the three built-in Groq models when none are configured, and asks gpt-oss for low reasoning effort", () => {
    const chain = getFreeProviderChain({ GROQ_API_KEY: "gsk-test" });
    expect(chain.map((p) => p.model)).toEqual(["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]);
    expect(chain.map((p) => p.id)).toEqual(["groq:openai/gpt-oss-120b", "groq:openai/gpt-oss-20b", "groq:qwen/qwen3.8-27b"]);
    expect(chain[0]?.extraBody).toEqual({ reasoning_effort: "low" });
    expect(chain[1]?.extraBody).toEqual({ reasoning_effort: "low" });
    expect(chain[2]?.extraBody).toBeUndefined();
  });

  it("takes the Groq models from FREE_MODELS_GROQ (comma separated)", () => {
    const chain = getFreeProviderChain({ GROQ_API_KEY: "gsk-test", FREE_MODELS_GROQ: " model-a , model-b ,, " });
    expect(chain.map((p) => p.model)).toEqual(["model-a", "model-b"]);
  });

  it("omits providers when apiKey or model is missing or whitespace only", () => {
    const partialEnv: NodeJS.ProcessEnv = {
      // openrouter-a: has key and model -> kept
      OPENROUTER_API_KEY: "sk-or-test",
      FREE_MODEL_OPENROUTER_A: "model-a:free",
      // openrouter-b: key exists (shares OPENROUTER_API_KEY), but model is missing -> omitted
      // groq: a model is set, but the key is missing -> no Groq providers at all
      FREE_MODEL_GROQ: "groq-model",
      // cerebras: key is whitespace -> omitted
      CEREBRAS_API_KEY: "   ",
      FREE_MODEL_CEREBRAS: "cerebras-model",
    };

    const chain = getFreeProviderChain(partialEnv);
    expect(chain).toHaveLength(1);
    expect(chain[0]?.id).toBe("openrouter-a");
  });

  it("applies budget, maxOutputTokens, and image support overrides", () => {
    const customEnv: NodeJS.ProcessEnv = {
      ...fullValidEnv,
      FREE_MAX_OUTPUT_TOKENS: "16000",
      FREE_BUDGET_OPENROUTER_A: "500",
      FREE_BUDGET_GROQ: "150",
      FREE_IMAGES_OPENROUTER_A: "true",
    };

    const chain = getFreeProviderChain(customEnv);
    expect(chain).toHaveLength(4);

    const openrouterA = chain.find((p) => p.id === "openrouter-a");
    expect(openrouterA?.maxOutputTokens).toBe(16000);
    expect(openrouterA?.dailyRequestBudget).toBe(500);
    expect(openrouterA?.supportsImages).toBe(true);

    const groq = chain.find((p) => p.id.startsWith("groq:"));
    expect(groq?.maxOutputTokens).toBe(16000);
    expect(groq?.dailyRequestBudget).toBe(150);
    expect(groq?.supportsImages).toBe(false);

    const cerebras = chain.find((p) => p.id === "cerebras");
    expect(cerebras?.dailyRequestBudget).toBe(200); // default
    expect(cerebras?.supportsImages).toBe(false); // default
  });

  it("falls back to default budget and token limits when env strings are invalid numbers", () => {
    const chain = getFreeProviderChain({ ...fullValidEnv, FREE_MAX_OUTPUT_TOKENS: "invalid-number", FREE_BUDGET_GROQ: "not-a-number" });
    expect(chain[0]?.maxOutputTokens).toBe(12000);
    expect(chain.find((p) => p.id.startsWith("groq:"))?.dailyRequestBudget).toBe(55);
  });
});

describe("free tier only", () => {
  const base = { OPENROUTER_API_KEY: "k" } as NodeJS.ProcessEnv;
  it("never uses an OpenRouter model that is not a :free variant", () => {
    const chain = getFreeProviderChain({
      ...base,
      FREE_MODEL_OPENROUTER_A: "google/gemma-4-31b-it",
      FREE_MODEL_OPENROUTER_B: "nvidia/nemotron-3-super-120b-a12b:free",
    });
    expect(chain.map((p) => p.id)).toEqual(["openrouter-b"]);
  });
});

describe("four OpenRouter slots", () => {
  it("keeps the configured order and skips empty slots", () => {
    const chain = getFreeProviderChain({
      OPENROUTER_API_KEY: "k",
      FREE_MODEL_OPENROUTER_A: "a:free",
      FREE_MODEL_OPENROUTER_C: "c:free",
      FREE_MODEL_OPENROUTER_D: "d:free",
    } as NodeJS.ProcessEnv);
    expect(chain.map((p) => [p.id, p.model])).toEqual([
      ["openrouter-a", "a:free"],
      ["openrouter-c", "c:free"],
      ["openrouter-d", "d:free"],
    ]);
  });
});
