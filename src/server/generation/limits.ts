import type { SupabaseClient } from "@supabase/supabase-js";
import type { Plan } from "@/config/plans";

/** Free-model generations per user per UTC day (plan 6.3). The hourly limit applies to every source on top. */
export const FREE_GENERATIONS_PER_DAY: Record<Plan, number> = { free: 3, pro: 10 };

export async function countFreeRunsToday(admin: SupabaseClient, userId: string, now = new Date()): Promise<number> {
  const dayStart = `${now.toISOString().slice(0, 10)}T00:00:00.000Z`;
  const { count } = await admin
    .from("generation_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("source", "free")
    .neq("status", "failed")
    .gte("created_at", dayStart);
  return count ?? 0;
}
