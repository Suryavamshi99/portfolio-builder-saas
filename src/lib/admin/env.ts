/**
 * Read inside request-scoped code only (server route handlers, middleware) —
 * never at module scope. See src/lib/supabase/env.ts for why.
 */
export function getAdminEnv() {
  const username = process.env["ADMIN_USERNAME"];
  const passwordHash = process.env["ADMIN_PASSWORD_HASH"];
  const sessionSecret = process.env["ADMIN_SESSION_SECRET"];
  if (!username || !passwordHash || !sessionSecret) {
    throw new Error("ADMIN_USERNAME, ADMIN_PASSWORD_HASH, and ADMIN_SESSION_SECRET must be set");
  }
  return { username, passwordHash, sessionSecret };
}
