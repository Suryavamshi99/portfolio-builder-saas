import { createFileRoute } from "@tanstack/react-router";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";

import { isHttpsRequest, serializeClearAdminCookies } from "@/lib/admin/session";

export const Route = createFileRoute("/api/admin/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const isHttps = isHttpsRequest(request, getRequestHeader("x-forwarded-proto"));
        setResponseHeader("set-cookie", serializeClearAdminCookies(isHttps));
        return Response.json({ ok: true });
      },
    },
  },
});
