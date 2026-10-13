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
