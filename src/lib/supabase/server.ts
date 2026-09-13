import { createServerClient } from "@supabase/ssr";
import { parse as parseCookieHeader, serialize as serializeCookie } from "cookie";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";

import { getSupabaseEnv } from "./env";

/**
 * Per-request Supabase client for use inside server routes / server
 * functions / middleware. Reads the session from the incoming Cookie
 * header and writes any refreshed session back as Set-Cookie headers on
 * the response — both via TanStack Start's request-scoped h3 event, so
 * this works the same whether called from a server route handler or a
 * createServerFn handler.
 *
 * Never construct this at module scope (see env.ts) and never reuse an
 * instance across requests — it closes over the current request's cookies.
 */
export function createSupabaseServerClient() {
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        const header = getRequestHeader("cookie");
        if (!header) return [];
        const parsed = parseCookieHeader(header);
        return Object.entries(parsed).map(([name, value]) => ({ name, value: value ?? "" }));
      },
      setAll(cookiesToSet) {
        const serialized = cookiesToSet.map(({ name, value, options }) =>
          serializeCookie(name, value, options),
        );
        if (serialized.length > 0) setResponseHeader("set-cookie", serialized);
      },
    },
  });
}
