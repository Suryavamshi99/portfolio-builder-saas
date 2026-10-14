import { createFileRoute } from "@tanstack/react-router";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CORS, json, preflight, publicOrigin } from "@/server/mcp/http";
import { WWW_AUTHENTICATE } from "@/server/mcp/oauth";
import { handleRpc } from "@/server/mcp/rpc";
import { authenticateAccessToken } from "@/server/mcp/store";
import { SERVER_INSTRUCTIONS, buildTools } from "@/server/mcp/tools";

const MAX_BODY_BYTES = 1_000_000;

const unauthorized = (origin: string) =>
  json({ error: { code: "unauthorized", message: "Sign in required" } }, 401, { "www-authenticate": WWW_AUTHENTICATE(origin) });

// MCP over Streamable HTTP (stateless, JSON responses only). Authenticated by a
// bearer token alone; cookies are never read, so a browser can't be tricked into
// calling it, which is why it is exempt from the Origin check in src/start.ts.
export const Route = createFileRoute("/mcp")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: () => new Response("Use POST", { status: 405, headers: { allow: "POST", ...CORS } }),
      DELETE: () => new Response(null, { status: 405, headers: { allow: "POST", ...CORS } }),
      POST: async ({ request }) => {
        const origin = publicOrigin(request);
        const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
        if (!token) return unauthorized(origin);
        const admin = createSupabaseAdminClient();
        const auth = await authenticateAccessToken(admin, token);
        if (!auth) return unauthorized(origin);

        // Refuse oversized requests before reading them into memory.
        if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
          return json({ error: { code: "too_large", message: "Request too large" } }, 413);
        }
        const raw = await request.text();
        if (raw.length > MAX_BODY_BYTES) return json({ error: { code: "too_large", message: "Request too large" } }, 413);
        let body: unknown;
        try {
          body = JSON.parse(raw);
        } catch {
          return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
        }

        const res = await handleRpc(body, buildTools({ admin, userId: auth.userId, origin }), {
          name: "shipfolio",
          version: "1.0.0",
          instructions: SERVER_INSTRUCTIONS,
        });
        return res.body === null ? new Response(null, { status: res.status, headers: CORS }) : json(res.body, res.status);
      },
    },
  },
});
