import { createFileRoute } from "@tanstack/react-router";
import { serialize as serializeCookie } from "cookie";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";

import { getAdminEnv } from "@/lib/admin/env";
import { verifyPassword } from "@/lib/admin/password";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken } from "@/lib/admin/session";
import { checkAdminLoginRateLimit } from "@/server/admin-rate-limit";

function badRequest(message: string, status = 400) {
  return Response.json({ error: { message } }, { status });
}

export const Route = createFileRoute("/api/admin/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        const rateLimit = checkAdminLoginRateLimit(ip);
        if (rateLimit.limited) {
          return Response.json(
            { error: { message: "Too many attempts. Try again later." } },
            { status: 429, headers: { "retry-after": String(rateLimit.retryAfterSeconds) } },
          );
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return badRequest("Invalid request body");
        }
        if (typeof body !== "object" || body === null) return badRequest("Invalid request body");
        const { username, password } = body as { username?: unknown; password?: unknown };
        if (typeof username !== "string" || typeof password !== "string") {
          return badRequest("username and password are required");
        }

        const { username: expectedUsername, passwordHash, sessionSecret } = getAdminEnv();

        // Both checks always run (no early-return on username mismatch) so a
        // wrong username can't be timed against a wrong password.
        const usernameOk = username === expectedUsername;
        const passwordOk = verifyPassword(password, passwordHash);
        if (!usernameOk || !passwordOk) return badRequest("Invalid credentials", 401);

        const token = createAdminSessionToken(sessionSecret);
        setResponseHeader(
          "set-cookie",
          serializeCookie(ADMIN_SESSION_COOKIE, token, {
            httpOnly: true,
            // `secure` requires HTTPS, which local `vite dev` (http://localhost)
            // doesn't have — browsers silently refuse to set/send the cookie
            // otherwise, breaking admin login in dev.
            secure: process.env["NODE_ENV"] === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24,
          }),
        );

        return Response.json({ ok: true });
      },
    },
  },
});
