import { createClient } from "@supabase/supabase-js";

import { getSupabaseEnv, getSupabaseServiceRoleKey } from "./env";

/**
 * Service-role client — bypasses RLS entirely. Use only for operations
 * that must cross the per-user boundary by design (none in milestone 1/2;
 * this exists for later work like Storage cleanup callbacks and the
 * retention cron's webhook target). Never expose this client or its key
 * to a request handler that echoes data back to the caller without an
 * explicit ownership check first.
 */
export function createSupabaseAdminClient() {
  const { url } = getSupabaseEnv();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
