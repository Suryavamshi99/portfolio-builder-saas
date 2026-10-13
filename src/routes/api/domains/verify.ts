import { resolveTxt } from "node:dns/promises";
import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyRecordName, txtMatches } from "@/server/domains";
import { addDomain, getDomainConfig } from "@/server/vercel/domains";
import { formatDomainResponse } from "./index";

export let txtResolver = resolveTxt;

export function setTxtResolver(fn: typeof resolveTxt) {
  txtResolver = fn;
}

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export const Route = createFileRoute("/api/domains/verify")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      POST: async ({ context }) => {
        const { user } = context as AuthedContext;
        const admin = createSupabaseAdminClient();

        // Load the user's row (404 no_domain)
        const { data: row } = await admin
          .from("custom_domains")
          .select("id, hostname, status, verify_token, last_checked_at")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!row) {
          return errorResponse(404, "no_domain", "No custom domain configured");
        }

        const now = Date.now();
        if (row.last_checked_at) {
          const lastCheckedTime = new Date(row.last_checked_at).getTime();
          if (now - lastCheckedTime < 10000) {
            return errorResponse(429, "rate_limited", "Please wait at least 10 seconds between verification checks");
          }
        }

        const recordName = verifyRecordName(row.hostname);
        let txtRecords: string[][] = [];

        try {
          txtRecords = await txtResolver(recordName);
        } catch (err: any) {
          // Catch ENODATA / ENOTFOUND / etc as not found yet
          if (
            err &&
            (err.code === "ENODATA" ||
              err.code === "ENOTFOUND" ||
              err.code === "EREFUSED" ||
              err.code === "ETIMEOUT" ||
              err.code === "ESERVFAIL")
          ) {
            txtRecords = [];
          } else {
            txtRecords = [];
          }
        }

        const matched = txtMatches(txtRecords, row.verify_token);
        const nowIso = new Date(now).toISOString();

        if (!matched) {
          // Not matching -> update last_checked_at, respond pending
          await admin
            .from("custom_domains")
            .update({ last_checked_at: nowIso })
            .eq("id", row.id);

          return Response.json({
            status: "pending",
            message: "We can't see the TXT record yet. DNS changes can take a few minutes.",
          });
        }

        // Matching -> addDomain, set verified + verified_at, then getDomainConfig: if misconfigured === false set live.
        await addDomain(row.hostname);

        const verifiedAtIso = nowIso;
        let finalStatus: "verified" | "live" = "verified";
        let dns: { a: string[]; cname: string[] } | null = null;

        try {
          const config = await getDomainConfig(row.hostname);
          dns = {
            a: config.recommendedIPv4,
            cname: config.recommendedCNAME,
          };
          if (config.misconfigured === false) {
            finalStatus = "live";
          }
        } catch {
          // keep verified if config call fails
        }

        await admin
          .from("custom_domains")
          .update({
            status: finalStatus,
            verified_at: verifiedAtIso,
            last_checked_at: nowIso,
          })
          .eq("id", row.id);

        return Response.json(
          formatDomainResponse(
            {
              hostname: row.hostname,
              status: finalStatus,
              verify_token: row.verify_token,
              last_checked_at: nowIso,
            },
            dns,
          ),
        );
      },
    },
  },
});
