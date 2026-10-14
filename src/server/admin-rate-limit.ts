import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

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

/** Reset in-memory rate limiter (useful in tests) */
export function resetAdminLoginRateLimit(): void {
  attempts.clear();
}

/** Compute sha256(ip + username + ADMIN_SESSION_SECRET), never raw */
export function computeAdminKeyHash(ip: string, username: string, sessionSecret: string): string {
  return createHash("sha256")
    .update((ip || "unknown") + (username || "") + sessionSecret)
    .digest("hex");
}

export interface LockoutCheckResult {
  locked: boolean;
  retryAfterSeconds?: number;
  failureCount: number;
}

/**
 * Check DB-backed lockout: counts failed attempts for the keyHash & stage in the last 15 minutes.
 * Threshold: >= 5 failures -> 429 locked.
 * Backoff schedule: 1 min (5-7 fails), 5 min (8-10 fails), 15 min (11+ fails) from most recent failure.
 */
export async function checkAdminLockout(
  admin: SupabaseClient,
  keyHash: string,
  stage: "password" | "totp",
  nowMs: number = Date.now(),
): Promise<LockoutCheckResult> {
  const fifteenMinutesAgo = new Date(nowMs - 15 * 60 * 1000).toISOString();

  const { data: records, error } = await admin
    .from("admin_login_attempts")
    .select("created_at")
    .eq("key_hash", keyHash)
    .eq("stage", stage)
    .eq("ok", false)
    .gte("created_at", fifteenMinutesAgo)
    .order("created_at", { ascending: false });

  if (error || !records) {
    return { locked: false, failureCount: 0 };
  }

  const count = records.length;
  if (count < 5) {
    return { locked: false, failureCount: count };
  }

  const backoffSeconds = count >= 11 ? 15 * 60 : count >= 8 ? 5 * 60 : 1 * 60;
  const mostRecentFailedAt = new Date(records[0]!.created_at).getTime();
  const elapsedSeconds = (nowMs - mostRecentFailedAt) / 1000;

  if (elapsedSeconds < backoffSeconds) {
    const retryAfterSeconds = Math.ceil(backoffSeconds - elapsedSeconds);
    return { locked: true, retryAfterSeconds, failureCount: count };
  }

  return { locked: false, failureCount: count };
}

/** Record login attempt (stage, ok) in public.admin_login_attempts */
export async function recordAdminAttempt(
  admin: SupabaseClient,
  keyHash: string,
  stage: "password" | "totp",
  ok: boolean,
): Promise<void> {
  try {
    await admin.from("admin_login_attempts").insert({
      key_hash: keyHash,
      stage,
      ok,
    });
  } catch (err) {
    console.warn("Failed to record admin login attempt:", err);
  }
}
