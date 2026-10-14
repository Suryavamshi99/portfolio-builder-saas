import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { parse as parseCookieHeader } from "cookie";

import { getAdminEnv } from "@/lib/admin/env";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_COOKIE_HOST,
  type AdminSessionPayload,
  createAdminSessionToken,
  getAdminSessionCookieName,
  isHttpsRequest,
  serializeAdminSessionCookie,
  verifyAdminSessionToken,
} from "@/lib/admin/session";
import { getAdminSecurity } from "@/lib/admin/security-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function unauthorized() {
  return new Response(JSON.stringify({ error: { code: "unauthorized", message: "Admin sign-in required" } }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

export function isStepUpValid(session?: AdminSessionPayload | null, now = Date.now()): boolean {
  return typeof session?.stepUpUntil === "number" && session.stepUpUntil > now;
}

export function stepUpRequiredResponse(): Response {
  return new Response(
    JSON.stringify({ error: { code: "step_up_required", message: "Step-up authentication required" } }),
    {
      status: 403,
      headers: { "content-type": "application/json" },
    },
  );
}

/**
 * Helper for 08a and mutating routes.
 * Returns 403 Response if step-up authentication is missing or expired, null if valid.
 */
export function requireStepUp(
  target?: AdminSessionPayload | { adminSession?: AdminSessionPayload } | null,
  now = Date.now(),
): Response | null {
  const session = target && typeof target === "object" && "adminSession" in target ? target.adminSession : target;
  if (!isStepUpValid(session as AdminSessionPayload | null | undefined, now)) {
    return stepUpRequiredResponse();
  }
  return null;
}

export interface AdminContext {
  adminSession: AdminSessionPayload;
}

/**
 * Request middleware for every `/api/admin/*` route except login endpoints.
 * Checks Session v2 cookie, validates DB session_epoch, and slides idle expiry.
 */
export const adminMiddleware = createMiddleware().server(async ({ next, request }) => {
  const { sessionSecret } = getAdminEnv();
  const isHttps = isHttpsRequest(request, getRequestHeader("x-forwarded-proto"));
  const header = getRequestHeader("cookie");
  const cookies = header ? parseCookieHeader(header) : {};

  // Check expected cookie name first, fall back to alternate prefix if present
  const cookieName = getAdminSessionCookieName(isHttps);
  const token = cookies[cookieName] || cookies[ADMIN_SESSION_COOKIE_HOST] || cookies[ADMIN_SESSION_COOKIE];

  if (!token) return unauthorized();

  const admin = createSupabaseAdminClient();
  let dbEpoch = 1;
  try {
    const sec = await getAdminSecurity(admin);
    dbEpoch = sec.session_epoch;
  } catch (err) {
    console.warn("Could not read admin_security session_epoch:", err);
    return unauthorized();
  }

  const now = Date.now();
  const verifyResult = verifyAdminSessionToken(token, sessionSecret, dbEpoch, now);
  if (!verifyResult.valid || !verifyResult.payload) {
    return unauthorized();
  }

  const session = verifyResult.payload;

  // Re-sign cookie with fresh seen timestamp at most once every minute
  if (now - session.seen >= 60 * 1000) {
    const updatedPayload: AdminSessionPayload = {
      ...session,
      seen: now,
    };
    const refreshedToken = createAdminSessionToken(updatedPayload, sessionSecret);
    setResponseHeader("set-cookie", serializeAdminSessionCookie(refreshedToken, isHttps));
    session.seen = now;
  }

  return next({
    context: {
      adminSession: session,
    },
  });
});

/** Middleware version of requireStepUp */
export const stepUpMiddleware = createMiddleware().server(async ({ next, context }) => {
  const session = (context as unknown as { adminSession?: AdminSessionPayload })?.adminSession;
  const check = requireStepUp(session);
  if (check) return check;
  return next();
});
