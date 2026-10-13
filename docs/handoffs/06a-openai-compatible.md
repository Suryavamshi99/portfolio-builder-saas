# Handoff 06a: OpenAI-compatible model caller + free provider config

**Worktree / branch:** `/Users/suryavamshi/portfolio-builder-saas-06a` on `feat/06a-openai-compatible`.
**Rules:** `docs/handoffs/_rules.md` (read first). **Plan:** `version2memory.md` section 6.3.
**Migration:** none.

## Why
Path A ("Free") runs the portfolio prompt on free models from OpenRouter, Groq and Cerebras, which all speak the OpenAI chat-completions format. Claude Code builds the chain/budget/queue logic; you build the caller and the config it reads.

## Read first
`src/server/llm/google.ts` (error mapping, 429 `retryAfterSeconds`, response parsing, how it logs), `src/server/llm/types.ts`, `src/server/llm/index.ts`, `src/config/llm.ts`.

## Task A: `src/server/llm/openai-compatible.ts` (new)
```ts
export type OpenAiCompatibleInput = LlmCallInput & {
  baseUrl: string;            // e.g. https://openrouter.ai/api/v1
  model: string;
  maxOutputTokens: number;
  timeoutMs: number;
};
export type OpenAiCompatibleResult = LlmCallResult & { finishReason: string | null };
export async function callOpenAICompatible(input: OpenAiCompatibleInput): Promise<OpenAiCompatibleResult>;
```
- `POST {baseUrl}/chat/completions`, header `Authorization: Bearer <apiKey>`, JSON body `{ model, max_tokens, messages: [{role:"system",...},{role:"user",content}] }`. `stream: false`.
- If `input.images` is non-empty, send `content` as an array: `{type:"text",text}` plus `{type:"image_url",image_url:{url:"data:<mime>;base64,<data>"}}` per image. Otherwise plain string content.
- Abort after `timeoutMs` (`AbortSignal.timeout`); an abort or network error throws `LlmProviderError("<provider> timed out" / message)`.
- Status mapping, same as `google.ts`: 401/403 → `LlmAuthError`; 429 → `LlmRateLimitError` with `retryAfterSeconds` from the `retry-after` header (seconds), else 60; other non-2xx → `LlmProviderError` with status and at most 300 chars of the body; 2xx with no `choices[0].message.content` string → `LlmProviderError("empty response")`. Never include the API key in an error message.
- Return `{ text: choices[0].message.content, finishReason: choices[0].finish_reason ?? null }`. (A `finishReason` of `"length"` means the page was cut off; the caller decides what to do.)
- OpenRouter-only extra headers `HTTP-Referer` and `X-Title: Shipfolio AI` are sent when `baseUrl` host is `openrouter.ai`.

## Task B: `src/config/free-models.ts` (new)
```ts
export interface FreeProvider {
  id: "openrouter-a" | "openrouter-b" | "groq" | "cerebras";
  label: string;
  baseUrl: string;
  apiKeyEnv: string;            // name of the env var holding the key
  model: string;                // resolved from env, see below
  supportsImages: boolean;
  maxOutputTokens: number;
  timeoutMs: number;
  dailyRequestBudget: number;   // shared across all users
}
export function getFreeProviderChain(env: NodeJS.ProcessEnv): FreeProvider[];
```
- Order: `openrouter-a`, `openrouter-b`, `groq`, `cerebras`. `baseUrl`: `https://openrouter.ai/api/v1` (both OpenRouter entries), `https://api.groq.com/openai/v1`, `https://api.cerebras.ai/v1`.
- Env vars for keys: `OPENROUTER_API_KEY` (both OpenRouter entries), `GROQ_API_KEY`, `CEREBRAS_API_KEY`.
- **Model ids come from env, no hard-coded guess:** `FREE_MODEL_OPENROUTER_A`, `FREE_MODEL_OPENROUTER_B`, `FREE_MODEL_GROQ`, `FREE_MODEL_CEREBRAS`. A provider is **left out of the returned chain** when its key or its model env var is missing/empty. Budgets: `FREE_BUDGET_<ID>` (integer env, default 200), `maxOutputTokens` default 12000 (`FREE_MAX_OUTPUT_TOKENS`), `timeoutMs` default 100000, `supportsImages` false except where `FREE_IMAGES_<ID>=true`.
- Read `env` only inside the function (it is passed in); no module-scope reads.

## Task C: tests (`src/server/llm/openai-compatible.test.ts`, `src/config/free-models.test.ts`)
Mock `fetch` (`vi.stubGlobal`). Cover: request URL/headers/body (text-only and with images); success text + `finishReason`; 401 → auth error; 429 with and without `retry-after`; 500 body truncated to 300 chars and key not present; empty choices; timeout; OpenRouter headers only for openrouter. Config: order, missing key/model drops that provider, defaults, overrides.

## Out of scope
Don't touch `src/server/llm/index.ts`, `google.ts`, `types.ts`, `src/config/llm.ts`, routes, or migrations. Claude Code wires the chain.

## Handoff report

### 1. Summary of changes
- **`src/server/llm/openai-compatible.ts`** (new): Created `callOpenAICompatible(input: OpenAiCompatibleInput): Promise<OpenAiCompatibleResult>`. Handles `POST {baseUrl}/chat/completions` with bearer authorization, optional OpenRouter headers (`HTTP-Referer`, `X-Title`) when target hostname is `openrouter.ai`, text or image payload structure with `data:<mime>;base64,<data>` data URLs, `AbortSignal.timeout(timeoutMs)`, mapping 401/403 to `LlmAuthError`, 429 to `LlmRateLimitError` (respecting `retry-after` header or defaulting to 60s), non-2xx status to `LlmProviderError` (truncated to 300 chars with API key redacted), and empty response checks.
- **`src/config/free-models.ts`** (new): Created `getFreeProviderChain(env: NodeJS.ProcessEnv): FreeProvider[]`. Implements the provider chain order: `openrouter-a`, `openrouter-b`, `groq`, `cerebras`. Reads env vars per provider inside the function (no module-scope reads), drops providers whose API key or model id is missing or empty, sets defaults (`dailyRequestBudget: 200`, `maxOutputTokens: 12000`, `timeoutMs: 100000`, `supportsImages: false`), and supports overrides (`FREE_BUDGET_<ID>`, `FREE_MAX_OUTPUT_TOKENS`, `FREE_IMAGES_<ID>`).
- **`.env.example`**: Appended documentation and placeholders for all free provider API keys, model variables, and optional overrides.
- **`src/server/llm/openai-compatible.test.ts`** (new): 12 unit tests verifying endpoint construction, payload format (text-only and images), OpenRouter-specific headers, finish reasons, error status mappings (401, 403, 429 with/without retry-after, 500 with truncation & key redaction, empty choices/content), timeouts, and network errors.
- **`src/config/free-models.test.ts`** (new): 4 unit tests verifying provider ordering, omitted providers on missing key/model, defaults, and overrides.

### 2. Verification
All verification checks executed in `/Users/suryavamshi/portfolio-builder-saas-06a`:
- `npx tsc --noEmit -p .` passed with 0 errors.
- `npm run lint` passed with 0 errors (17 existing pre-task warnings in unrelated files).
- `npx vitest run` passed: 9 test files, 127 tests passed (including all 16 new tests).
- `npm run build` passed with 0 errors.

### 3. Open questions / notes
- None. All contracts and types adhere strictly to the specification in `docs/handoffs/06a-openai-compatible.md`.
