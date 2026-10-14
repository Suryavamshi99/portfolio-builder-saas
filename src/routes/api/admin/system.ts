import { createFileRoute } from "@tanstack/react-router";

import { adminMiddleware } from "@/server/admin-middleware";
import { getAppOrigin } from "@/config/app";
import { isDummyPaymentModeEnabled } from "@/config/payment-test";

const SETTING_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ENCRYPTION_KEY",
  "ADMIN_SESSION_SECRET",
  "OPENROUTER_API_KEY",
  "FREE_MODEL_OPENROUTER_A",
  "CRON_SECRET",
  "SITES_BASE_URL",
  "GITHUB_APP_ID",
  "GITHUB_APP_PRIVATE_KEY",
  "VERCEL_API_TOKEN",
  "SITES_PROJECT_ID",
  "DODO_PAYMENTS_API_KEY",
  "DODO_PRODUCT_ID_PRO",
  "DODO_WEBHOOK_SECRET",
] as const;

export const Route = createFileRoute("/api/admin/system")({
  server: {
    middleware: [adminMiddleware],
    handlers: {
      GET: async () => {
        let appOrigin = "";
        try {
          appOrigin = getAppOrigin();
        } catch {
          appOrigin = process.env["APP_ORIGIN"] || "";
        }

        const commit = process.env["VERCEL_GIT_COMMIT_SHA"] ?? null;
        const sitesBaseUrl = process.env["SITES_BASE_URL"] ?? null;

        const paymentsEnabled =
          Boolean(process.env["DODO_PAYMENTS_API_KEY"] && process.env["DODO_PRODUCT_ID_PRO"] && process.env["DODO_WEBHOOK_SECRET"]) ||
          isDummyPaymentModeEnabled();

        const settings = SETTING_KEYS.map((name) => ({
          name,
          set: Boolean(process.env[name]?.trim()),
        }));

        return Response.json({
          commit,
          appOrigin,
          sitesBaseUrl,
          payments: {
            enabled: paymentsEnabled,
          },
          settings,
        });
      },
    },
  },
});
