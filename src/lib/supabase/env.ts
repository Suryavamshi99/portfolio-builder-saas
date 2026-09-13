/**
 * Read inside request-scoped code only (server route handlers, middleware,
 * server functions) — never at module scope. See
 * @tanstack/react-start's auth-server-primitives guidance: module-level env
 * reads run before any request exists and are undefined on edge runtimes.
 */
export function getSupabaseEnv() {
  const url = process.env["SUPABASE_URL"];
  const anonKey = process.env["SUPABASE_ANON_KEY"];
  if (!url || !anonKey) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set");
  }
  return { url, anonKey };
}

export function getSupabaseServiceRoleKey() {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY must be set");
  return key;
}
