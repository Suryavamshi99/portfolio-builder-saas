import type { SupabaseClient } from "@supabase/supabase-js";

import type { Plan } from "@/config/plans";

/** Lazily provisions the app-level user record on first touch, from any endpoint. */
export async function getOrCreateAppUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ id: string; plan: Plan; createdAt: string } | null> {
  const { data, error } = await supabase
    .from("users")
    .upsert({ id: userId }, { onConflict: "id" })
    .select("id, plan, created_at")
    .single();

  if (error || !data) return null;
  return { id: data.id, plan: data.plan as Plan, createdAt: data.created_at };
}
