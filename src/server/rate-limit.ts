import type { SupabaseClient } from "@supabase/supabase-js";

const WINDOW_MS = 60 * 60 * 1000;

/**
 * Rolling-hour rate limit shared by /api/uploads and /api/generate. Returns
 * null when under the limit, or the seconds until the oldest row in the
 * current window ages out (for the 429's `retryAfterSeconds`).
 */
export async function checkHourlyRateLimit(
  supabase: SupabaseClient,
  table: string,
  userId: string,
  limit: number,
): Promise<{ limited: false } | { limited: true; retryAfterSeconds: number }> {
  const windowStart = new Date(Date.now() - WINDOW_MS);

  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", windowStart.toISOString());

  if ((count ?? 0) < limit) return { limited: false };

  const { data: oldest } = await supabase
    .from(table)
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", windowStart.toISOString())
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const oldestAt = oldest ? new Date(oldest.created_at).getTime() : Date.now();
  const retryAfterSeconds = Math.max(1, Math.ceil((oldestAt + WINDOW_MS - Date.now()) / 1000));

  return { limited: true, retryAfterSeconds };
}
