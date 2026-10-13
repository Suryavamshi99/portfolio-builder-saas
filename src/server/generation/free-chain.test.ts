import { describe, expect, it, vi } from "vitest";
import { LlmAuthError, LlmProviderError, LlmRateLimitError } from "@/server/llm";
import { runFreeChain, type ChainProvider } from "./free-chain";

const P = (id: string): ChainProvider => ({ id, label: id, model: `${id}-model`, supportsImages: id === "vision", dailyRequestBudget: 10 });
const FINALIZE = { userId: "u1", supabaseUrl: "https://p.supabase.co", links: {}, referenceText: "Jane Doe cut latency by 40%" };
const page = (body: string) =>
  `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>b{}</style></head><body><nav><a href="#a">A</a></nav><section id="a">${body}</section></body></html>`;
const GOOD = page("<p>Cut latency by 40%</p>");
const BAD = page("<p>Grew revenue 35%</p>");
const reply = (text: string, finishReason: string | null = "stop") => ({ text, finishReason });

const run = (over: Partial<Parameters<typeof runFreeChain>[0]> & { providers: ChainProvider[] }) =>
  runFreeChain({
    claim: async () => true,
    cooldown: async () => {},
    call: async () => reply(GOOD),
    userMessage: "BRIEF",
    images: [{ mimeType: "image/png", base64Data: "AAAA" }],
    finalize: FINALIZE,
    deadlineMs: Date.now() + 60_000,
    ...over,
  });

describe("runFreeChain", () => {
  it("uses the first provider that works", async () => {
    const call = vi.fn().mockResolvedValue(reply(GOOD));
    const res = await run({ providers: [P("a"), P("b")], call });
    expect(res).toMatchObject({ ok: true, providerId: "a", model: "a-model" });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("skips a provider whose daily budget is spent", async () => {
    const res = await run({ providers: [P("a"), P("b")], claim: async (p) => p.id === "b" });
    expect(res).toMatchObject({ ok: true, providerId: "b" });
  });

  it("reports exhausted when no provider can be claimed", async () => {
    expect(await run({ providers: [P("a"), P("b")], claim: async () => false })).toEqual({ ok: false, reason: "exhausted" });
    expect(await run({ providers: [] })).toEqual({ ok: false, reason: "exhausted" });
  });

  it("cools down and moves on after a rate limit, a provider error and a bad key", async () => {
    const cooldown = vi.fn().mockResolvedValue(undefined);
    const call = vi
      .fn()
      .mockRejectedValueOnce(new LlmRateLimitError("slow down", 90))
      .mockRejectedValueOnce(new LlmProviderError("500"))
      .mockRejectedValueOnce(new LlmAuthError("bad key"))
      .mockResolvedValueOnce(reply(GOOD));
    const res = await run({ providers: [P("a"), P("b"), P("c"), P("d")], call, cooldown });
    expect(res).toMatchObject({ ok: true, providerId: "d" });
    expect(cooldown.mock.calls.map((c) => [c[0].id, c[1]])).toEqual([["a", 90], ["b", 120], ["c", 3600]]);
  });

  it("repairs once on the same provider before moving on", async () => {
    const call = vi.fn().mockResolvedValueOnce(reply(BAD)).mockResolvedValueOnce(reply(GOOD));
    const res = await run({ providers: [P("a"), P("b")], call });
    expect(res).toMatchObject({ ok: true, providerId: "a" });
    expect(call).toHaveBeenCalledTimes(2);
    expect(call.mock.calls[1]![1]).toContain("35%");
  });

  it("moves to the next provider when the repaired page still fails, and returns the last failure if all fail", async () => {
    const call = vi.fn().mockResolvedValue(reply(BAD));
    const res = await run({ providers: [P("a"), P("b")], call });
    expect(call).toHaveBeenCalledTimes(4);
    expect(res).toMatchObject({ ok: false, reason: "failed", code: "generation_unsupported_claims" });
  });

  it("treats a length-limited reply as cut off without a repair call", async () => {
    const call = vi.fn().mockResolvedValueOnce(reply(GOOD, "length")).mockResolvedValueOnce(reply(GOOD));
    const res = await run({ providers: [P("a"), P("b")], call });
    expect(res).toMatchObject({ ok: true, providerId: "b" });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("only sends reference images to providers that accept them", async () => {
    const call = vi.fn().mockResolvedValue(reply(GOOD));
    await run({ providers: [P("text-only")], call });
    expect(call.mock.calls[0]![2]).toEqual([]);
    await run({ providers: [P("vision")], call });
    expect(call.mock.calls[1]![2]).toHaveLength(1);
  });

  it("stops trying new providers once the time budget is used", async () => {
    const call = vi.fn();
    expect(await run({ providers: [P("a")], call, deadlineMs: Date.now() - 1 })).toEqual({ ok: false, reason: "exhausted" });
    expect(call).not.toHaveBeenCalled();
  });

  it("does not swallow unexpected errors", async () => {
    await expect(run({ providers: [P("a")], call: async () => Promise.reject(new TypeError("bug")) })).rejects.toThrow("bug");
  });
});
