const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

const attempts = new Map<string, { count: number; resetAt: number }>();

/**
 * In-memory, per-instance — on Vercel's serverless functions this resets
 * across cold starts and isn't shared between concurrent instances, so it's
 * defense-in-depth, not the primary defense (that's the hashed, hopefully-
 * strong password itself). Still stops a naive scripted retry loop hitting
 * a single warm instance.
 */
export function checkAdminLoginRateLimit(key: string): { limited: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { limited: false };
  }

  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    return { limited: true, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { limited: false };
}
