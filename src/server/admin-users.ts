import type { SupabaseClient } from "@supabase/supabase-js";

import type { Plan } from "@/config/plans";

export type AdminUserSummary = {
  id: string;
  email: string | null;
  createdAt: string;
  plan: Plan;
  portfolioUpdatedAt: string | null;
  hasPortfolioContent: boolean;
  storageUsedBytes: number;
  vercelConnected: boolean;
  byokProviders: string[];
};

/**
 * One bulk query per table (service-role, bypasses RLS by design — see
 * src/lib/supabase/admin.ts) grouped by user_id in memory, instead of N+1
 * per-user queries. Fine at the scale a single hidden admin panel needs to
 * handle; revisit with real pagination if the user table gets large.
 */
export async function listAdminUsers(admin: SupabaseClient): Promise<AdminUserSummary[]> {
  const [authUsersRes, appUsersRes, portfoliosRes, uploadsRes, vercelRes, byokRes] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("users").select("id, plan"),
    admin.from("portfolios").select("user_id, content, updated_at"),
    admin.from("uploads").select("user_id, size_bytes"),
    admin.from("vercel_connections").select("user_id"),
    admin.from("byok_keys").select("user_id, provider"),
  ]);

  if (authUsersRes.error) throw authUsersRes.error;

  const planByUser = new Map((appUsersRes.data ?? []).map((r) => [r.id as string, r.plan as Plan]));
  const portfolioByUser = new Map(
    (portfoliosRes.data ?? []).map((r) => [
      r.user_id as string,
      { updatedAt: r.updated_at as string, hasContent: Object.keys((r.content as object) ?? {}).length > 0 },
    ]),
  );
  const storageByUser = new Map<string, number>();
  for (const row of uploadsRes.data ?? []) {
    const key = row.user_id as string;
    storageByUser.set(key, (storageByUser.get(key) ?? 0) + (row.size_bytes as number));
  }
  const vercelConnectedUsers = new Set((vercelRes.data ?? []).map((r) => r.user_id as string));
  const byokByUser = new Map<string, string[]>();
  for (const row of byokRes.data ?? []) {
    const key = row.user_id as string;
    const list = byokByUser.get(key) ?? [];
    list.push(row.provider as string);
    byokByUser.set(key, list);
  }

  return authUsersRes.data.users
    .map((u): AdminUserSummary => {
      const portfolio = portfolioByUser.get(u.id);
      return {
        id: u.id,
        email: u.email ?? null,
        createdAt: u.created_at,
        plan: planByUser.get(u.id) ?? "free",
        portfolioUpdatedAt: portfolio?.updatedAt ?? null,
        hasPortfolioContent: portfolio?.hasContent ?? false,
        storageUsedBytes: storageByUser.get(u.id) ?? 0,
        vercelConnected: vercelConnectedUsers.has(u.id),
        byokProviders: byokByUser.get(u.id) ?? [],
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
