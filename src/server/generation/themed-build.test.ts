import { describe, expect, it, vi } from "vitest";
import { LlmAuthError, LlmProviderError, LlmRateLimitError } from "@/server/llm";
import type { FreeProvider } from "@/config/free-models";
import { NO_CUSTOMISATIONS, portfolioFactsSchema } from "@/server/themes/facts";
import { NoFreeCapacityError, buildThemedPage, completeViaFreeChain, mergeCustomisations, type ThemedDeps } from "./themed-build";

const facts = portfolioFactsSchema.parse({ name: "Ada Lovelace", headline: "Engineer" });
const base = (over: Partial<ThemedDeps> = {}): ThemedDeps => ({
  extract: async () => ({ facts, custom: NO_CUSTOMISATIONS, usedFallback: false, notes: [] }),
  complete: async () => "{}",
  render: () => "<html></html>",
  finalize: (html) => ({ ok: true, html, warnings: ["w1"] }),
  claims: () => [],
  ...over,
});
const args = { themeId: "t", input: { resumeText: "Ada", links: {} }, referenceText: "Ada" };

describe("mergeCustomisations", () => {
  it("lets typed choices win over derived ones", () => {
    const derived = { accent: "#111111", fonts: "mono" as const, hidden: ["skills" as const], order: [] };
    expect(mergeCustomisations({ accent: "#222222", fonts: "theme", hidden: [], order: ["projects"] }, derived)).toEqual({
      accent: "#222222",
      fonts: "mono",
      hidden: ["skills"],
      order: ["projects"],
    });
    expect(mergeCustomisations(undefined, derived)).toEqual(derived);
  });
});

describe("buildThemedPage", () => {
  it("renders, finalizes and returns warnings", async () => {
    const render = vi.fn(() => "<html>x</html>");
    const r = await buildThemedPage(base({ render }), { ...args, typed: { accent: "#abcdef", fonts: "serif", hidden: [], order: [] } });
    expect(r).toEqual({ kind: "done", html: "<html>x</html>", warnings: ["w1"] });
    expect(render).toHaveBeenCalledWith("t", facts, { accent: "#abcdef", fonts: "serif", hidden: [], order: [] });
  });
  it("warns when extraction used the heuristic", async () => {
    const r = await buildThemedPage(base({ extract: async () => ({ facts, custom: NO_CUSTOMISATIONS, usedFallback: true, notes: [] }) }), args);
    expect(r.kind === "done" && r.warnings[0]).toMatch(/couldn't read your resume in detail/);
  });
  it("renders curated facts, and ignores a failing or unchanged curation", async () => {
    const curated = portfolioFactsSchema.parse({ name: "Ada Lovelace", headline: "Punchy" });
    const render = vi.fn(() => "<html></html>");
    const curate = vi.fn(async () => ({ facts: curated, curated: true, notes: [] }));
    await buildThemedPage(base({ render, curate }), { ...args, input: { ...args.input, instructions: "calm" } });
    expect(render).toHaveBeenLastCalledWith("t", curated, NO_CUSTOMISATIONS);
    expect(curate).toHaveBeenCalledWith(expect.objectContaining({ themeId: "t", instructions: "calm" }), expect.any(Function));
    for (const c of [async () => { throw new Error("boom"); }, async () => ({ facts: curated, curated: false, notes: [] })]) {
      const r2 = vi.fn(() => "<html></html>");
      const out = await buildThemedPage(base({ render: r2, curate: c }), args);
      expect(out.kind).toBe("done");
      expect(r2).toHaveBeenCalledWith("t", facts, NO_CUSTOMISATIONS);
    }
  });
  it("skips curation when extraction used the plain reader", async () => {
    const curate = vi.fn();
    await buildThemedPage(base({ curate, extract: async () => ({ facts, custom: NO_CUSTOMISATIONS, usedFallback: true, notes: [] }) }), args);
    expect(curate).not.toHaveBeenCalled();
  });
  it("falls back when the template throws, the check fails or unsupported claims appear", async () => {
    for (const over of [
      { render: () => { throw new Error("boom"); } },
      { finalize: () => ({ ok: false as const, errors: ["bad"] }) },
      { claims: () => [{ claim: "99%", message: "no" }] },
      { extract: async () => { throw new Error("x"); } },
    ]) {
      const r = await buildThemedPage(base(over), args);
      expect(r.kind).toBe("fallback");
    }
  });
  it("reports no capacity and provider errors instead of hiding them", async () => {
    const heuristic = async (_i: unknown, complete: (s: string, u: string) => Promise<string>) => {
      await complete("s", "u").catch(() => {});
      return { facts, custom: NO_CUSTOMISATIONS, usedFallback: true, notes: [] };
    };
    const cap = await buildThemedPage(base({ extract: heuristic, complete: async () => { throw new NoFreeCapacityError("x"); } }), args);
    expect(cap.kind).toBe("no_capacity");
    const auth = await buildThemedPage(base({ extract: heuristic, complete: async () => { throw new LlmAuthError("bad key"); } }), args);
    expect(auth.kind).toBe("provider_error");
  });
});

const provider = (id: string): FreeProvider => ({ id, label: id, baseUrl: "u", apiKeyEnv: "K", model: "m", supportsImages: false, maxOutputTokens: 8000, timeoutMs: 1, dailyRequestBudget: 10 });

describe("completeViaFreeChain", () => {
  const io = (call: (p: FreeProvider) => Promise<{ text: string; finishReason: string | null }>, claim: (p: FreeProvider) => boolean = () => true) => ({
    call: vi.fn((p: FreeProvider) => call(p)),
    claim: vi.fn(async (p: FreeProvider) => claim(p)),
    cooldown: vi.fn(async () => {}),
  });
  it("moves to the next provider after a rate limit and cools the first down", async () => {
    const f = io(async (p) => {
      if (p.id === "a") throw new LlmRateLimitError("slow", 30);
      return { text: "ok", finishReason: "stop" };
    });
    expect(await completeViaFreeChain(f, [provider("a"), provider("b")], "s", "u")).toBe("ok");
    expect(f.cooldown).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }), 30);
  });
  it("throws no-capacity when nothing can be claimed, and stops after two attempts", async () => {
    await expect(completeViaFreeChain(io(async () => ({ text: "", finishReason: "stop" }), () => false), [provider("a")], "s", "u")).rejects.toBeInstanceOf(NoFreeCapacityError);
    const f = io(async () => { throw new LlmProviderError("down"); });
    await expect(completeViaFreeChain(f, ["a", "b", "c"].map(provider), "s", "u")).rejects.toBeInstanceOf(LlmProviderError);
    expect(f.call).toHaveBeenCalledTimes(2);
  });
  it("treats a cut-off reply as a failed attempt", async () => {
    const f = io(async (p) => ({ text: p.id, finishReason: p.id === "a" ? "length" : "stop" }));
    expect(await completeViaFreeChain(f, [provider("a"), provider("b")], "s", "u")).toBe("b");
  });
});
