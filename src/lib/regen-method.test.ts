import { describe, expect, it } from "vitest";

import { chatgptUrl, claudeUrl, mcpEditPrompt, otherMethod, pickRegenMethod } from "./regen-method";

describe("pickRegenMethod", () => {
  it("follows the method that built the page", () => {
    expect(pickRegenMethod(null, "free")).toBe("free");
    expect(pickRegenMethod(null, "gemini")).toBe("gemini");
    expect(pickRegenMethod(undefined, "mcp")).toBe("mcp");
  });

  it("lets the user's own saved choice win", () => {
    expect(pickRegenMethod("mcp", "free")).toBe("mcp");
    expect(pickRegenMethod("free", "gemini")).toBe("free");
  });

  it("defaults to the free models when nothing is known or the value is not a method", () => {
    expect(pickRegenMethod(null, null)).toBe("free");
    expect(pickRegenMethod("bogus", "also-bogus")).toBe("free");
  });
});

describe("otherMethod", () => {
  it("suggests the other API method after a failure", () => {
    expect(otherMethod("free")).toBe("gemini");
    expect(otherMethod("gemini")).toBe("free");
    expect(otherMethod("mcp")).toBe("free");
  });
});

describe("mcpEditPrompt", () => {
  it("tells the chat to read, change and save the page, with the user's changes", () => {
    const p = mcpEditPrompt("  Make the hero bolder  ");
    expect(p).toContain("get_portfolio_html");
    expect(p).toContain("save_portfolio_html");
    expect(p).toContain("Changes: Make the hero bolder");
  });

  it("asks the user to describe the change when there is none yet", () => {
    expect(mcpEditPrompt("")).toContain("(describe what you want changed)");
  });

  it("builds links that carry the prompt, encoded", () => {
    const p = mcpEditPrompt("a & b?");
    expect(claudeUrl(p).startsWith("https://claude.ai/new?q=")).toBe(true);
    expect(chatgptUrl(p).startsWith("https://chatgpt.com/?q=")).toBe(true);
    expect(decodeURIComponent(claudeUrl(p).split("q=")[1]!)).toBe(p);
  });
});
