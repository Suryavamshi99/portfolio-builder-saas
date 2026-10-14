import { createFileRoute } from "@tanstack/react-router";

import { adminMiddleware } from "@/server/admin-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parsePagination } from "@/server/admin-audit";
import { siteUrl } from "@/server/sites";

export const Route = createFileRoute("/api/admin/sites")({
  server: {
    middleware: [adminMiddleware],
    handlers: {
      GET: async ({ request }) => {
        const admin = createSupabaseAdminClient();
        const url = new URL(request.url);
        const query = url.searchParams.get("query")?.trim().toLowerCase() || "";
        const statusParam = url.searchParams.get("status")?.trim();
        const { page, pageSize, offset } = parsePagination(url);

        try {
          if (!query) {
            let sitesQuery = admin
              .from("sites")
              .select("slug, status, user_id, updated_at", { count: "exact" });

            if (statusParam) {
              sitesQuery = sitesQuery.eq("status", statusParam);
            }

            const { data: siteRows, count, error } = await sitesQuery
              .order("updated_at", { ascending: false })
              .range(offset, offset + pageSize - 1);

            if (error) {
              return Response.json({ error: { code: "internal_error", message: "Could not load sites" } }, { status: 500 });
            }

            const paged = siteRows ?? [];
            const userIds = Array.from(new Set(paged.map((s) => s.user_id as string)));

            const [authUsers, domainsRes] = await Promise.all([
              Promise.all(
                userIds.map(async (uid) => {
                  try {
                    const { data } = await admin.auth.admin.getUserById(uid);
                    return { uid, email: data?.user?.email ?? null };
                  } catch {
                    return { uid, email: null };
                  }
                }),
              ),
              userIds.length > 0
                ? admin.from("custom_domains").select("user_id, hostname, status").in("user_id", userIds)
                : Promise.resolve({ data: [] }),
            ]);

            const emailMap = new Map(authUsers.map((u) => [u.uid, u.email]));
            const domainMap = new Map(
              (domainsRes.data ?? []).map((d) => [
                d.user_id as string,
                { hostname: d.hostname as string, status: d.status as string },
              ]),
            );

            const sites = paged.map((s) => ({
              slug: s.slug as string,
              url: siteUrl(s.slug as string),
              status: s.status as string,
              ownerEmail: emailMap.get(s.user_id as string) ?? null,
              ownerId: s.user_id as string,
              updatedAt: s.updated_at as string,
              domain: domainMap.get(s.user_id as string) ?? null,
            }));

            return Response.json({
              sites,
              page,
              pageSize,
              total: count ?? 0,
            });
          }

          // When query is provided, match against slug or owner email
          let allSitesQuery = admin.from("sites").select("slug, status, user_id, updated_at");
          if (statusParam) {
            allSitesQuery = allSitesQuery.eq("status", statusParam);
          }
          const { data: allSites, error: allSitesError } = await allSitesQuery.order("updated_at", { ascending: false });
          if (allSitesError) {
            return Response.json({ error: { code: "internal_error", message: "Could not load sites" } }, { status: 500 });
          }

          const siteList = allSites ?? [];
          const allUserIds = Array.from(new Set(siteList.map((s) => s.user_id as string)));

          const authUsers = await Promise.all(
            allUserIds.map(async (uid) => {
              try {
                const { data } = await admin.auth.admin.getUserById(uid);
                return { uid, email: data?.user?.email ?? null };
              } catch {
                return { uid, email: null };
              }
            }),
          );
          const emailMap = new Map(authUsers.map((u) => [u.uid, u.email]));

          const filtered = siteList.filter((s) => {
            const slugMatch = (s.slug as string).toLowerCase().includes(query);
            const email = (emailMap.get(s.user_id as string) ?? "").toLowerCase();
            const emailMatch = email.includes(query);
            return slugMatch || emailMatch;
          });

          const total = filtered.length;
          const paged = filtered.slice(offset, offset + pageSize);
          const pagedUserIds = Array.from(new Set(paged.map((s) => s.user_id as string)));

          const { data: domainsData } =
            pagedUserIds.length > 0
              ? await admin.from("custom_domains").select("user_id, hostname, status").in("user_id", pagedUserIds)
              : { data: [] };

          const domainMap = new Map(
            (domainsData ?? []).map((d) => [
              d.user_id as string,
              { hostname: d.hostname as string, status: d.status as string },
            ]),
          );

          const sites = paged.map((s) => ({
            slug: s.slug as string,
            url: siteUrl(s.slug as string),
            status: s.status as string,
            ownerEmail: emailMap.get(s.user_id as string) ?? null,
            ownerId: s.user_id as string,
            updatedAt: s.updated_at as string,
            domain: domainMap.get(s.user_id as string) ?? null,
          }));

          return Response.json({
            sites,
            page,
            pageSize,
            total,
          });
        } catch {
          return Response.json({ error: { code: "internal_error", message: "Could not load sites" } }, { status: 500 });
        }
      },
    },
  },
});
