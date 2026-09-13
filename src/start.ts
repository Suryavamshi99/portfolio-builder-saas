import { createStart, createMiddleware } from "@tanstack/react-start";

/**
 * SameSite=Lax on Supabase's session cookie already blocks most
 * cross-site CSRF against our POST/PUT/DELETE routes, but not a POST
 * launched from a sibling subdomain (Lax still allows that). This closes
 * that gap for every non-GET request, across all server routes and
 * functions — not just the ones added so far.
 */
const csrfMiddleware = createMiddleware().server(async ({ next, request }) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("origin");
    const appOrigin = process.env["APP_ORIGIN"];
    if (!appOrigin || !origin || new URL(origin).origin !== appOrigin) {
      return new Response(JSON.stringify({ error: { code: "origin_check_failed", message: "Origin check failed" } }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }
  }
  return next();
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
}));
