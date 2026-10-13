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

  it("returns providers in the exact specified order with defaults", () => {
    const chain = getFreeProviderChain(fullValidEnv);

    expect(chain).toHaveLength(4);
    expect(chain.map((p) => p.id)).toEqual([
      "openrouter-a",
      "openrouter-b",
      "groq",
      "cerebras",
    ]);

    // Check OpenRouter A
    expect(chain[0]).toEqual({
      id: "openrouter-a",
      label: "OpenRouter (A)",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKeyEnv: "OPENROUTER_API_KEY",
      model: "meta-llama/llama-3.3-70b-instruct:free",
      supportsImages: false,
      maxOutputTokens: 12000,
      timeoutMs: 100000,
      dailyRequestBudget: 200,
    });

    // Check OpenRouter B
    expect(chain[1]).toEqual({
      id: "openrouter-b",
      label: "OpenRouter (B)",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKeyEnv: "OPENROUTER_API_KEY",
      model: "qwen/qwen-2.5-72b-instruct:free",
      supportsImages: false,
      maxOutputTokens: 12000,
      timeoutMs: 100000,
      dailyRequestBudget: 200,
    });

    // Check Groq
    expect(chain[2]).toEqual({
      id: "groq",
      label: "Groq",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKeyEnv: "GROQ_API_KEY",
      model: "llama-3.3-70b-versatile",
      supportsImages: false,
      maxOutputTokens: 12000,
      timeoutMs: 100000,
      dailyRequestBudget: 200,
    });

    // Check Cerebras
    expect(chain[3]).toEqual({
      id: "cerebras",
      label: "Cerebras",
      baseUrl: "https://api.cerebras.ai/v1",
      apiKeyEnv: "CEREBRAS_API_KEY",
      model: "llama3.3-70b",
      supportsImages: false,
      maxOutputTokens: 12000,
      timeoutMs: 100000,
      dailyRequestBudget: 200,
    });
  });

  it("omits providers when apiKey or model is missing or whitespace only", () => {
    const partialEnv: NodeJS.ProcessEnv = {
      // openrouter-a: has key and model -> kept
      OPENROUTER_API_KEY: "sk-or-test",
      FREE_MODEL_OPENROUTER_A: "model-a:free",
      // openrouter-b: key exists (shares OPENROUTER_API_KEY), but model is missing -> omitted
      // groq: model exists, but key is missing -> omitted
      FREE_MODEL_GROQ: "groq-model",
      // cerebras: key and model are empty/whitespace -> omitted
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
      FREE_IMAGES_GROQ: "false",
    };

    const chain = getFreeProviderChain(customEnv);
    expect(chain).toHaveLength(4);

    const openrouterA = chain.find((p) => p.id === "openrouter-a");
    expect(openrouterA?.maxOutputTokens).toBe(16000);
    expect(openrouterA?.dailyRequestBudget).toBe(500);
    expect(openrouterA?.supportsImages).toBe(true);

    const groq = chain.find((p) => p.id === "groq");
    expect(groq?.maxOutputTokens).toBe(16000);
    expect(groq?.dailyRequestBudget).toBe(150);
    expect(groq?.supportsImages).toBe(false);

    const cerebras = chain.find((p) => p.id === "cerebras");
    expect(cerebras?.maxOutputTokens).toBe(16000);
    expect(cerebras?.dailyRequestBudget).toBe(200); // default
    expect(cerebras?.supportsImages).toBe(false); // default
  });

  it("falls back to default budget and token limits when env strings are invalid numbers", () => {
    const invalidNumbersEnv: NodeJS.ProcessEnv = {
      ...fullValidEnv,
      FREE_MAX_OUTPUT_TOKENS: "invalid-number",
      FREE_BUDGET_GROQ: "not-a-number",
    };

    const chain = getFreeProviderChain(invalidNumbersEnv);
    expect(chain[0]?.maxOutputTokens).toBe(12000);
    const groq = chain.find((p) => p.id === "groq");
    expect(groq?.dailyRequestBudget).toBe(200);
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
