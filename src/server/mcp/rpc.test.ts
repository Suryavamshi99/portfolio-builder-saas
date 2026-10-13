import { describe, expect, it, vi } from "vitest";
import { handleRpc, type Tools } from "./rpc";

const info = { name: "shipfolio", version: "1", instructions: "hi" };
const tools: Tools = {
  list: [{ name: "t", description: "d", inputSchema: { type: "object" } }],
  call: vi.fn(async (name) => (name === "t" ? { content: [{ type: "text" as const, text: "ok" }] } : null)),
};
const rpc = (b: unknown) => handleRpc(b, tools, info);

describe("handleRpc", () => {
  it("negotiates the protocol version", async () => {
    const a = (await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } })).body as any;
    expect(a.result.protocolVersion).toBe("2025-03-26");
    const b = (await rpc({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "1999-01-01" } })).body as any;
    expect(b.result.protocolVersion).toBe("2025-06-18");
    expect(b.result.capabilities).toEqual({ tools: {} });
  });
  it("answers notifications with 202 and no body", async () => {
    expect(await rpc({ jsonrpc: "2.0", method: "notifications/initialized" })).toEqual({ status: 202, body: null });
  });
  it("lists and calls tools, and reports unknown ones", async () => {
    expect(((await rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" })).body as any).result.tools).toHaveLength(1);
    expect(((await rpc({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "t" } })).body as any).result.content[0].text).toBe("ok");
    expect(((await rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "nope" } })).body as any).error.code).toBe(-32602);
  });
  it("rejects malformed requests, batches and unknown methods", async () => {
    expect((await rpc("x")).status).toBe(400);
    expect((await rpc([])).status).toBe(400);
    expect((await rpc({ id: 1, method: "ping" })).status).toBe(400);
    expect(((await rpc({ jsonrpc: "2.0", id: 1, method: "nope" })).body as any).error.code).toBe(-32601);
    expect(((await rpc({ jsonrpc: "2.0", id: 1, method: "ping" })).body as any).result).toEqual({});
  });
});
