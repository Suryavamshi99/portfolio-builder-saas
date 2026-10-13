/** Minimal MCP over Streamable HTTP, stateless: JSON-RPC 2.0 in a POST, JSON out. */

export const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}
export type ToolContent = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };
export interface ToolResult {
  content: ToolContent[];
  isError?: boolean;
}
export interface Tools {
  list: ToolDef[];
  call: (name: string, args: Record<string, unknown>) => Promise<ToolResult | null>; // null = unknown tool
}

type Id = string | number | null;
interface Req {
  jsonrpc?: unknown;
  id?: Id;
  method?: unknown;
  params?: Record<string, unknown>;
}

const err = (id: Id, code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });
const ok = (id: Id, result: unknown) => ({ jsonrpc: "2.0", id, result });

export async function handleRpc(
  body: unknown,
  tools: Tools,
  info: { name: string; version: string; instructions: string },
): Promise<{ status: number; body: unknown | null }> {
  // Batches are not used by the supported protocol versions we need.
  if (Array.isArray(body) || typeof body !== "object" || body === null) {
    return { status: 400, body: err(null, -32600, "Invalid request") };
  }
  const req = body as Req;
  const id = req.id ?? null;
  if (req.jsonrpc !== "2.0" || typeof req.method !== "string") {
    return { status: 400, body: err(id, -32600, "Invalid request") };
  }
  // Notifications have no id and get no body back.
  if (req.id === undefined) return { status: 202, body: null };

  switch (req.method) {
    case "initialize": {
      const asked = typeof req.params?.["protocolVersion"] === "string" ? req.params["protocolVersion"] : "";
      return {
        status: 200,
        body: ok(id, {
          protocolVersion: SUPPORTED_PROTOCOLS.includes(asked) ? asked : SUPPORTED_PROTOCOLS[0],
          capabilities: { tools: {} },
          serverInfo: { name: info.name, version: info.version },
          instructions: info.instructions,
        }),
      };
    }
    case "ping":
      return { status: 200, body: ok(id, {}) };
    case "tools/list":
      return { status: 200, body: ok(id, { tools: tools.list }) };
    case "tools/call": {
      const name = req.params?.["name"];
      const args = req.params?.["arguments"];
      if (typeof name !== "string") return { status: 200, body: err(id, -32602, "Missing tool name") };
      const result = await tools.call(name, typeof args === "object" && args !== null ? (args as Record<string, unknown>) : {});
      return { status: 200, body: result ? ok(id, result) : err(id, -32602, `Unknown tool: ${name}`) };
    }
    default:
      return { status: 200, body: err(id, -32601, `Method not found: ${req.method}`) };
  }
}
