import type { SupabaseClient } from "@supabase/supabase-js";

import type { Plan } from "@/config/plans";
import { paymentsEnabled } from "@/config/payments";

/** Lazily provisions the app-level user record on first touch, from any endpoint. */
export async function getOrCreateAppUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ id: string; plan: Plan; createdAt: string; isAdmin: boolean } | null> {
  const { data, error } = await supabase
    .from("users")
    .upsert({ id: userId }, { onConflict: "id" })
    .select("id, plan, created_at, is_admin")
    .single();

  if (error || !data) return null;
  return { id: data.id, plan: data.plan as Plan, createdAt: data.created_at, isAdmin: data.is_admin as boolean };
}

/**
 * True if this plan (or the admin exemption) grants access to paid-gated
 * actions — deploying, in particular. Single source of truth, consumed
 * server-side by every gate (/api/publish, /api/vercel/oauth/start) and
 * exposed to the client via /api/me so the UI never recomputes this logic
 * itself. See paymentsEnabled() for the env-level kill switch.
 */
export function hasPaidAccess(appUser: { plan: Plan; isAdmin: boolean }): boolean {
  if (!paymentsEnabled()) return true;
  return appUser.isAdmin || appUser.plan === "pro";
}
