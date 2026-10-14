import { createFileRoute } from "@tanstack/react-router";

import { adminMiddleware } from "@/server/admin-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { budgetDay } from "@/server/generation/jobs";
import { getFreeProviderChain } from "@/config/free-models";
import { isDummyPaymentModeEnabled } from "@/config/payment-test";

export const Route = createFileRoute("/api/admin/overview")({
  server: {
    middleware: [adminMiddleware],
    handlers: {
      GET: async () => {
        const admin = createSupabaseAdminClient();
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const today = budgetDay(now);

        const [
          totalUsersRes,
          new7dUsersRes,
          proUsersRes,
          adminUsersRes,
          portfoliosRes,
          versionsRes,
          uploadsRes,
          publishedSitesRes,
          unpublishedSitesRes,
          pendingDomainsRes,
          verifiedDomainsRes,
          liveDomainsRes,
          last24hJobsRes,
          oldestQueuedJobRes,
          activeMcpRes,
          budgetRowsRes,
        ] = await Promise.all([
          admin.from("users").select("*", { count: "exact", head: true }),
          admin.from("users").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
          admin.from("users").select("*", { count: "exact", head: true }).eq("plan", "pro"),
          admin.from("users").select("*", { count: "exact", head: true }).eq("is_admin", true),
          admin.from("portfolios").select("*", { count: "exact", head: true }),
          admin.from("portfolio_versions").select("*", { count: "exact", head: true }),
          admin.from("uploads").select("size_bytes"),
          admin.from("sites").select("*", { count: "exact", head: true }).eq("status", "published"),
          admin.from("sites").select("*", { count: "exact", head: true }).eq("status", "unpublished"),
          admin.from("custom_domains").select("*", { count: "exact", head: true }).eq("status", "pending"),
          admin.from("custom_domains").select("*", { count: "exact", head: true }).eq("status", "verified"),
          admin.from("custom_domains").select("*", { count: "exact", head: true }).eq("status", "live"),
          admin.from("generation_jobs").select("status, source, error").gte("created_at", last24h),
          admin
            .from("generation_jobs")
            .select("retry_at")
            .eq("status", "queued")
            .not("retry_at", "is", null)
            .order("retry_at", { ascending: true })
            .limit(1)
            .maybeSingle(),
          admin
            .from("mcp_tokens")
            .select("*", { count: "exact", head: true })
            .eq("kind", "refresh")
            .is("revoked_at", null)
            .gt("expires_at", now.toISOString()),
          admin.from("provider_budgets").select("provider, used, cooldown_until").eq("day", today),
        ]);

        const uploadsBytes = (uploadsRes.data ?? []).reduce(
          (sum, row) => sum + (typeof row.size_bytes === "number" ? row.size_bytes : 0),
          0,
        );

        const jobRows = last24hJobsRes.data ?? [];
        const jobsTotal = jobRows.length;
        const jobsDone = jobRows.filter((j) => j.status === "done").length;
        const jobsFailed = jobRows.filter((j) => j.status === "failed").length;
        const jobsQueued = jobRows.filter((j) => j.status === "queued").length;
        const jobsRunning = jobRows.filter((j) => ["reading", "writing", "checking", "saving"].includes(j.status)).length;
        const bySource = {
          free: jobRows.filter((j) => j.source === "free").length,
          gemini: jobRows.filter((j) => j.source === "gemini").length,
          mcp: jobRows.filter((j) => j.source === "mcp").length,
        };

        const errorCountMap = new Map<string, number>();
        for (const j of jobRows) {
          const err = j.error as { code?: string } | null;
          if (err?.code) {
            errorCountMap.set(err.code, (errorCountMap.get(err.code) ?? 0) + 1);
          }
        }
        const topErrors = Array.from(errorCountMap.entries())
          .map(([code, count]) => ({ code, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        const oldestQueuedRetryAt = oldestQueuedJobRes.data?.retry_at
          ? new Date(oldestQueuedJobRes.data.retry_at).toISOString()
          : null;

        const chain = getFreeProviderChain(process.env);
        const budgetMap = new Map((budgetRowsRes.data ?? []).map((r) => [r.provider as string, r]));
        const freeProviders = chain.map((p) => {
          const b = budgetMap.get(p.id);
          return {
            id: p.id,
            label: p.label,
            model: p.model,
            usedToday: (b?.used as number | undefined) ?? 0,
            dailyBudget: p.dailyRequestBudget,
            cooldownUntil: b?.cooldown_until ? new Date(b.cooldown_until as string).toISOString() : null,
          };
        });

        const paymentsEnabled =
          Boolean(process.env["DODO_PAYMENTS_API_KEY"] && process.env["DODO_PRODUCT_ID_PRO"] && process.env["DODO_WEBHOOK_SECRET"]) ||
          isDummyPaymentModeEnabled();

        return Response.json({
          users: {
            total: totalUsersRes.count ?? 0,
            new7d: new7dUsersRes.count ?? 0,
            pro: proUsersRes.count ?? 0,
            admins: adminUsersRes.count ?? 0,
          },
          content: {
            portfolios: portfoliosRes.count ?? 0,
            versions: versionsRes.count ?? 0,
            uploadsBytes,
          },
          sites: {
            published: publishedSitesRes.count ?? 0,
            unpublished: unpublishedSitesRes.count ?? 0,
          },
          domains: {
            pending: pendingDomainsRes.count ?? 0,
            verified: verifiedDomainsRes.count ?? 0,
            live: liveDomainsRes.count ?? 0,
          },
          jobs: {
            last24h: {
              total: jobsTotal,
              done: jobsDone,
              failed: jobsFailed,
              queued: jobsQueued,
              running: jobsRunning,
              bySource,
            },
            topErrors,
            oldestQueuedRetryAt,
          },
          mcp: {
            activeConnections: activeMcpRes.count ?? 0,
          },
          freeProviders,
          payments: {
            enabled: paymentsEnabled,
          },
        });
      },
    },
  },
});
