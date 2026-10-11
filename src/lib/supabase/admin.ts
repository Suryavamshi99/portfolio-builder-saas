import { createClient } from "@supabase/supabase-js";

import { getSupabaseEnv, getSupabaseServiceRoleKey } from "./env";

/**
 * Service-role client — bypasses RLS and table privileges entirely.
 *
 * Used for:
 * 1. Operations that cross the per-user boundary by design (Dodo webhook,
 *    admin panel /api/admin/*, retention cleanup).
 * 2. All reads and writes to `public.portfolios` (/api/content, /api/generate,
 *    /api/publish, /api/reset), because all direct access to portfolios is
 *    revoked from authenticated users to protect generated HTML.
 *
 * CRITICAL RULE: When used in user-facing routes (e.g. portfolios), it must
 * ONLY be used with an explicit `user.id` scope taken directly from the
 * authenticated session (`AuthedContext.user.id`) — NEVER from request
 * parameters, body, or query strings.
 */
export function createSupabaseAdminClient() {
  const { url } = getSupabaseEnv();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
