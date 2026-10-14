import { createFileRoute } from "@tanstack/react-router";

import { adminMiddleware } from "@/server/admin-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AdminUserSummary } from "@/server/admin-users";
import { parsePagination } from "@/server/admin-audit";
import type { Plan } from "@/config/plans";

export const Route = createFileRoute("/api/admin/users")({
  server: {
    middleware: [adminMiddleware],
    handlers: {
      GET: async ({ request }) => {
        const admin = createSupabaseAdminClient();
        const url = new URL(request.url);
        const query = url.searchParams.get("query")?.trim().toLowerCase() || "";
        const planParam = url.searchParams.get("plan")?.trim().toLowerCase() || "";
        const adminParam = url.searchParams.get("admin")?.trim().toLowerCase() || "";
        const siteParam = url.searchParams.get("site")?.trim().toLowerCase() || "";
        const { page, pageSize, offset } = parsePagination(url);

        try {
          const authUsers: Array<{ id: string; email?: string | null; created_at: string }> = [];
          let pageNum = 1;
          let truncated = false;
          while (authUsers.length < 5000) {
            const res = await admin.auth.admin.listUsers({ page: pageNum, perPage: 1000 });
            if (res.error) throw res.error;
            const batch = res.data.users ?? [];
            authUsers.push(...batch);
            if (batch.length < 1000) {
              break;
            }
            pageNum += 1;
          }
          if (authUsers.length >= 5000) {
            truncated = true;
            authUsers.splice(5000);
          }

          const [appUsersRes, sitesRes] = await Promise.all([
            admin.from("users").select("id, plan, is_admin"),
            admin.from("sites").select("user_id, slug, status"),
          ]);

          const appUserMap = new Map((appUsersRes.data ?? []).map((r) => [r.id as string, r]));
          const siteMap = new Map((sitesRes.data ?? []).map((r) => [r.user_id as string, r]));

          const filtered = authUsers.filter((u) => {
            if (query) {
              const email = (u.email ?? "").toLowerCase();
              if (!email.includes(query)) return false;
            }
            const appUser = appUserMap.get(u.id);
            if (planParam === "free" || planParam === "pro") {
              const userPlan = (appUser?.plan as Plan) ?? "free";
              if (userPlan !== planParam) return false;
            }
            if (adminParam === "true") {
              if (!appUser?.is_admin) return false;
            }
            if (siteParam === "published") {
              const site = siteMap.get(u.id);
              if (site?.status !== "published") return false;
            }
            return true;
          });

          filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          const total = filtered.length;
          const paged = filtered.slice(offset, offset + pageSize);
          const pagedIds = paged.map((u) => u.id);

          if (pagedIds.length === 0) {
            return Response.json({
              users: [],
              page,
              pageSize,
              total,
              ...(truncated ? { truncated: true } : {}),
            });
          }

          const [portfoliosRes, uploadsRes, vercelRes, byokRes] = await Promise.all([
            admin.from("portfolios").select("user_id, generated_html, updated_at").in("user_id", pagedIds),
            admin.from("uploads").select("user_id, size_bytes").in("user_id", pagedIds),
            admin.from("vercel_connections").select("user_id").in("user_id", pagedIds),
            admin.from("byok_keys").select("user_id, provider").in("user_id", pagedIds),
          ]);

          const portfolioMap = new Map(
            (portfoliosRes.data ?? []).map((r) => [
              r.user_id as string,
              { updatedAt: r.updated_at as string, hasContent: Boolean((r.generated_html as string | null)?.trim()) },
            ]),
          );

          const storageMap = new Map<string, number>();
          for (const row of uploadsRes.data ?? []) {
            const key = row.user_id as string;
            storageMap.set(key, (storageMap.get(key) ?? 0) + (row.size_bytes as number));
          }

          const vercelSet = new Set((vercelRes.data ?? []).map((r) => r.user_id as string));

          const byokMap = new Map<string, string[]>();
          for (const row of byokRes.data ?? []) {
            const key = row.user_id as string;
            const list = byokMap.get(key) ?? [];
            list.push(row.provider as string);
            byokMap.set(key, list);
          }

          const users: AdminUserSummary[] = paged.map((u) => {
            const appUser = appUserMap.get(u.id);
            const portfolio = portfolioMap.get(u.id);
            const site = siteMap.get(u.id);
            return {
              id: u.id,
              email: u.email ?? null,
              createdAt: u.created_at,
              plan: (appUser?.plan as Plan) ?? "free",
              isAdmin: Boolean(appUser?.is_admin),
              portfolioUpdatedAt: portfolio?.updatedAt ?? null,
              hasPortfolioContent: portfolio?.hasContent ?? false,
              storageUsedBytes: storageMap.get(u.id) ?? 0,
              vercelConnected: vercelSet.has(u.id),
              byokProviders: byokMap.get(u.id) ?? [],
              siteSlug: (site?.slug as string | null) ?? null,
            };
          });

          return Response.json({
            users,
            page,
            pageSize,
            total,
            ...(truncated ? { truncated: true } : {}),
          });
        } catch {
          return Response.json({ error: { message: "Could not load users" } }, { status: 500 });
        }
      },
    },
  },
});
