/**
 * Browser origins allowed to make state-changing requests (the CSRF check in
 * src/start.ts): the app's own `APP_ORIGIN`, plus any extra hostnames the app
 * is also served on (`APP_EXTRA_ORIGINS`, comma-separated, e.g. the branded
 * domain while OAuth redirects still point at the canonical one).
 */
export function isAllowedOrigin(
  origin: string | null,
  env: { APP_ORIGIN?: string | undefined; APP_EXTRA_ORIGINS?: string | undefined },
): boolean {
  if (!origin || !env.APP_ORIGIN) return false;
  let requested: string;
  try {
    requested = new URL(origin).origin;
  } catch {
    return false; // e.g. the literal "null" origin
  }
  const allowed = [env.APP_ORIGIN, ...(env.APP_EXTRA_ORIGINS ?? "").split(",")]
    .map((o) => o.trim())
    .filter(Boolean);
  return allowed.includes(requested);
}

/**
 * Endpoints called by other companies' servers (Claude, ChatGPT) rather than by
 * our own pages. They never read the session cookie, only bearer tokens or PKCE
 * secrets, so the browser Origin check doesn't apply. `/authorize` is NOT here:
 * its consent form is posted by a signed-in browser and stays protected.
 */
export function isMachineEndpoint(pathname: string): boolean {
  return pathname === "/mcp" || pathname === "/token" || pathname === "/register" || pathname.startsWith("/.well-known/");
}
