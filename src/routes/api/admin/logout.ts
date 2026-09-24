import { createFileRoute } from "@tanstack/react-router";
import { serialize as serializeCookie } from "cookie";
import { setResponseHeader } from "@tanstack/react-start/server";

import { ADMIN_SESSION_COOKIE } from "@/lib/admin/session";

export const Route = createFileRoute("/api/admin/logout")({
  server: {
    handlers: {
      POST: async () => {
        setResponseHeader(
          "set-cookie",
          serializeCookie(ADMIN_SESSION_COOKIE, "", {
            httpOnly: true,
            secure: process.env["NODE_ENV"] === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 0,
          }),
        );
        return Response.json({ ok: true });
      },
    },
  },
});
