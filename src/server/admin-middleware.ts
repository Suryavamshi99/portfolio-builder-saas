import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { parse as parseCookieHeader } from "cookie";

import { getAdminEnv } from "@/lib/admin/env";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin/session";

function unauthorized() {
  return new Response(JSON.stringify({ error: { code: "unauthorized", message: "Admin sign-in required" } }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Request middleware for every `/api/admin/*` route except login itself.
 * Checks the signed admin_session cookie — this is a separate identity
 * from Supabase auth (see src/lib/admin/session.ts), not a user session.
 */
export const adminMiddleware = createMiddleware().server(async ({ next }) => {
  const { sessionSecret } = getAdminEnv();
  const header = getRequestHeader("cookie");
  const cookies = header ? parseCookieHeader(header) : {};

  if (!verifyAdminSessionToken(cookies[ADMIN_SESSION_COOKIE], sessionSecret)) return unauthorized();

  return next();
});
