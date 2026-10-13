import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { callOpenAICompatible, type OpenAiCompatibleInput } from "./openai-compatible";
import { LlmAuthError, LlmProviderError, LlmRateLimitError } from "./types";

describe("callOpenAICompatible", () => {
  const baseInput: OpenAiCompatibleInput = {
    apiKey: "test-secret-key-12345",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    systemPrompt: "You are a web designer.",
    userMessage: "Build my portfolio.",
    maxOutputTokens: 8000,
    timeoutMs: 5000,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends correct URL, headers, and body for text-only input", async () => {
    let capturedUrl = "";
    let capturedOptions: RequestInit | undefined;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, options: RequestInit) => {
        capturedUrl = url;
        capturedOptions = options;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              choices: [
                {
                  message: { content: "<html><body>Hello</body></html>" },
                  finish_reason: "stop",
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }),
    );

    const result = await callOpenAICompatible(baseInput);

    expect(capturedUrl).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(capturedOptions?.method).toBe("POST");
    expect(capturedOptions?.headers).toEqual({
      Authorization: "Bearer test-secret-key-12345",
      "Content-Type": "application/json",
    });

    const parsedBody = JSON.parse(capturedOptions?.body as string);
    expect(parsedBody).toEqual({
      model: "llama-3.3-70b-versatile",
      max_tokens: 8000,
      stream: false,
      messages: [
        { role: "system", content: "You are a web designer." },
        { role: "user", content: "Build my portfolio." },
      ],
    });

    expect(result).toEqual({
      text: "<html><body>Hello</body></html>",
      finishReason: "stop",
    });
  });

  it("handles trailing slash in baseUrl properly", async () => {
    let capturedUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        capturedUrl = url;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }),
    );

    await callOpenAICompatible({
      ...baseInput,
      baseUrl: "https://api.groq.com/openai/v1/",
    });

    expect(capturedUrl).toBe("https://api.groq.com/openai/v1/chat/completions");
  });

  it("adds OpenRouter headers only when baseUrl host is openrouter.ai", async () => {
    let capturedHeaders: Record<string, string> | undefined;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, options: RequestInit) => {
        capturedHeaders = options.headers as Record<string, string>;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: "openrouter response" }, finish_reason: null }],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }),
    );

    // With OpenRouter
    await callOpenAICompatible({
      ...baseInput,
      baseUrl: "https://openrouter.ai/api/v1",
    });

    expect(capturedHeaders?.["HTTP-Referer"]).toBe("https://www.shipfolio.xyz");
    expect(capturedHeaders?.["X-Title"]).toBe("Shipfolio AI");

    // With non-OpenRouter
    await callOpenAICompatible({
      ...baseInput,
      baseUrl: "https://api.cerebras.ai/v1",
    });

    expect(capturedHeaders?.["HTTP-Referer"]).toBeUndefined();
    expect(capturedHeaders?.["X-Title"]).toBeUndefined();
  });

  it("formats user content as an array with text and image_url parts when images are present", async () => {
    let capturedBody: unknown;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, options: RequestInit) => {
        capturedBody = JSON.parse(options.body as string);
        return Promise.resolve(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: "image seen" }, finish_reason: "stop" }],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }),
    );

    await callOpenAICompatible({
      ...baseInput,
      images: [
        { mimeType: "image/png", base64Data: "iVBORw0KGgoAAAANSUhEUg==" },
        { mimeType: "image/jpeg", base64Data: "/9j/4AAQSkZJRg==" },
      ],
    });

    expect(capturedBody).toEqual({
      model: "llama-3.3-70b-versatile",
      max_tokens: 8000,
      stream: false,
      messages: [
        { role: "system", content: "You are a web designer." },
        {
          role: "user",
          content: [
            { type: "text", text: "Build my portfolio." },
            {
              type: "image_url",
              image_url: { url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==" },
            },
            {
              type: "image_url",
              image_url: { url: "data:image/jpeg;base64,/9j/4AAQSkZJRg==" },
            },
          ],
        },
      ],
    });
  });

  it("handles null or missing finish_reason as null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "some text" } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const result = await callOpenAICompatible(baseInput);
    expect(result.finishReason).toBeNull();
    expect(result.text).toBe("some text");
  });

  it("maps 401 and 403 to LlmAuthError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Unauthorized", { status: 401 })),
    );

    await expect(callOpenAICompatible(baseInput)).rejects.toThrow(LlmAuthError);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Forbidden", { status: 403 })),
    );

    await expect(callOpenAICompatible(baseInput)).rejects.toThrow(LlmAuthError);
  });

  it("maps 429 with retry-after header to LlmRateLimitError with specified seconds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("Rate limited", {
          status: 429,
          headers: { "retry-after": "45" },
        }),
      ),
    );

    const promise = callOpenAICompatible(baseInput);
    await expect(promise).rejects.toThrow(LlmRateLimitError);
    await expect(promise).rejects.toMatchObject({ retryAfterSeconds: 45 });
  });

  it("maps 429 without retry-after header to LlmRateLimitError with default 60 seconds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Rate limited", { status: 429 })),
    );

    const promise = callOpenAICompatible(baseInput);
    await expect(promise).rejects.toThrow(LlmRateLimitError);
    await expect(promise).rejects.toMatchObject({ retryAfterSeconds: 60 });
  });

  it("maps non-2xx status to LlmProviderError with body truncated to 300 chars, never exposing api key", async () => {
    const longSecretBody = `Error: Something went terrible with key ${baseInput.apiKey} ` + "x".repeat(400);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(longSecretBody, { status: 500 })),
    );

    try {
      await callOpenAICompatible(baseInput);
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(LlmProviderError);
      const msg = (err as Error).message;
      expect(msg).toContain("Provider API error (500):");
      expect(msg).not.toContain(baseInput.apiKey);
      expect(msg).toContain("[REDACTED]");
      // Total error prefix is `Provider API error (500): ` (26 chars), body sliced to 300
      expect(msg.length).toBeLessThanOrEqual(330);
    }
  });

  it("throws LlmProviderError('empty response') when choices array is empty or content is missing/empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ choices: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(callOpenAICompatible(baseInput)).rejects.toThrowError(
      new LlmProviderError("empty response"),
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "" } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(callOpenAICompatible(baseInput)).rejects.toThrowError(
      new LlmProviderError("empty response"),
    );
  });

  it("throws LlmProviderError with timeout message when request aborts/times out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("The operation was aborted", "TimeoutError")),
    );

    await expect(callOpenAICompatible(baseInput)).rejects.toThrow(LlmProviderError);
    await expect(callOpenAICompatible(baseInput)).rejects.toThrow(
      `${baseInput.model} timed out`,
    );
  });

  it("throws LlmProviderError on network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed: ECONNREFUSED")),
    );

    await expect(callOpenAICompatible(baseInput)).rejects.toThrow(LlmProviderError);
    await expect(callOpenAICompatible(baseInput)).rejects.toThrow(
      "fetch failed: ECONNREFUSED",
    );
  });
});

describe("slow or broken replies", () => {
  const input = { apiKey: "k", systemPrompt: "s", userMessage: "u", baseUrl: "https://openrouter.ai/api/v1", model: "m:free", maxOutputTokens: 100, timeoutMs: 1000 };
  const withBody = (body: () => Promise<unknown>, ok = true) =>
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok, status: ok ? 200 : 500, headers: new Headers(), json: body, text: body }) as unknown as Response));

  it("maps a time limit hit while reading the reply to a provider error (not a crash)", async () => {
    withBody(async () => { throw new DOMException("The operation was aborted due to timeout", "TimeoutError"); });
    await expect(callOpenAICompatible(input)).rejects.toThrow("m:free timed out");
    await expect(callOpenAICompatible(input)).rejects.toBeInstanceOf(LlmProviderError);
  });
  it("maps an unreadable reply to a provider error", async () => {
    withBody(async () => { throw new SyntaxError("Unexpected end of JSON input"); });
    await expect(callOpenAICompatible(input)).rejects.toBeInstanceOf(LlmProviderError);
  });
  it("maps a failure while reading an error body to a provider error", async () => {
    withBody(async () => { throw new DOMException("aborted", "AbortError"); }, false);
    await expect(callOpenAICompatible(input)).rejects.toBeInstanceOf(LlmProviderError);
  });
});
