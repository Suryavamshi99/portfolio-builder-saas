import { isAllowedOrigin } from "@/lib/origin";

export const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, mcp-protocol-version, mcp-session-id",
  "access-control-expose-headers": "www-authenticate",
};

export const preflight = () => new Response(null, { status: 204, headers: CORS });

export function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS, ...extra },
  });
}

/** The public origin this request came in on, if it is one of ours; otherwise the canonical APP_ORIGIN. */
export function publicOrigin(request: Request): string {
  const seen = new URL(request.url).origin;
  return isAllowedOrigin(seen, process.env) ? seen : (process.env["APP_ORIGIN"] ?? seen);
}
