import { createMiddleware } from "@tanstack/react-start";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";

function unauthorized() {
  return new Response(JSON.stringify({ error: { code: "unauthorized", message: "Sign in required" } }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Request middleware for every `/api/*` server route that touches
 * per-user data. Loads the session from the Supabase cookie (never from
 * client-sent context — see the framework's auth-server-primitives
 * guidance) and attaches `{ user, supabase }` to the handler context.
 *
 * A route's own existence behind e.g. a UI login redirect is not this
 * boundary — this middleware IS the boundary, applied per-route below.
 */
export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return unauthorized();

  return next({ context: { user, supabase } });
});

export type AuthedContext = { user: User; supabase: SupabaseClient };
