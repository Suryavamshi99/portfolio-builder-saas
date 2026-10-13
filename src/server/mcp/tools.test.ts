import { describe, expect, it } from "vitest";
import { TOOL_DEFS, buildTools } from "./tools";

// A client that fails loudly if a tool touches the database before validating its input.
const strictAdmin = new Proxy({}, { get: () => () => { throw new Error("database used"); } }) as never;
const tools = buildTools({ admin: strictAdmin, userId: "u1", origin: "https://app.example" });

describe("MCP tools", () => {
  it("exposes exactly the three tools, each with an object input schema", () => {
    expect(TOOL_DEFS.map((t) => t.name)).toEqual(["get_portfolio_brief", "save_portfolio_html", "get_portfolio_html"]);
    for (const t of TOOL_DEFS) expect(t.inputSchema["type"]).toBe("object");
  });
  it("tells the model not to paste the HTML into the chat", () => {
    for (const name of ["save_portfolio_html", "get_portfolio_html"]) {
      expect(TOOL_DEFS.find((t) => t.name === name)!.description).toMatch(/not paste|NOT paste/);
    }
  });
  it("rejects missing, tiny or huge html before touching the database", async () => {
    for (const html of [undefined, 42, "<html></html>", "x".repeat(600_001)]) {
      const res = await tools.call("save_portfolio_html", { html });
      expect(res?.isError).toBe(true);
    }
  });
  it("returns null for an unknown tool and an error (not a crash) when a tool fails", async () => {
    expect(await tools.call("nope", {})).toBeNull();
    const res = await tools.call("get_portfolio_brief", {});
    expect(res?.isError).toBe(true);
    expect((res!.content[0] as { text: string }).text).toMatch(/Something went wrong/);
  });
});
