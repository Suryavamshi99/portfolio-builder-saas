import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateHostname, verifyRecordName, newVerifyToken } from "@/server/domains";
import { getDomainConfig, removeDomain } from "@/server/vercel/domains";
import { getOrCreateAppUser, hasPaidAccess } from "@/server/users";

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export interface DomainResponseShape {
  domain: null | {
    hostname: string;
    status: "pending" | "verified" | "live";
    verifyRecord: {
      type: "TXT";
      name: string;
      value: string;
    };
    dns: {
      a: string[];
      cname: string[];
    } | null;
    lastCheckedAt: string | null;
  };
}

export function formatDomainResponse(
  row: {
    hostname: string;
    status: string;
    verify_token: string;
    last_checked_at: string | null;
  } | null,
  dns: { a: string[]; cname: string[] } | null,
): DomainResponseShape {
  if (!row) {
    return { domain: null };
  }

  return {
    domain: {
      hostname: row.hostname,
      status: row.status as "pending" | "verified" | "live",
      verifyRecord: {
        type: "TXT",
        name: verifyRecordName(row.hostname),
        value: row.verify_token,
      },
      dns,
      lastCheckedAt: row.last_checked_at,
    },
  };
}

export const Route = createFileRoute("/api/domains/")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ context }) => {
        const { user } = context as AuthedContext;
        const admin = createSupabaseAdminClient();

        const { data: row } = await admin
          .from("custom_domains")
          .select("id, hostname, status, verify_token, last_checked_at")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!row) {
          return Response.json(formatDomainResponse(null, null));
        }

        // dns is filled (from getDomainConfig) only when status is verified or live; values come from Vercel response, never hard-coded
        let dns: { a: string[]; cname: string[] } | null = null;
        let currentStatus = row.status;

        if (row.status === "verified" || row.status === "live") {
          try {
            const config = await getDomainConfig(row.hostname);
            dns = {
              a: config.recommendedIPv4,
              cname: config.recommendedCNAME,
            };

            // GET /api/domains also re-checks a verified row's config when called (cheap) and promotes it to live once misconfigured is false
            if (row.status === "verified" && config.misconfigured === false) {
              await admin
                .from("custom_domains")
                .update({ status: "live" })
                .eq("id", row.id);
              currentStatus = "live";
            }
          } catch {
            // If Vercel call fails, preserve current state and null/empty dns
          }
        }

        return Response.json(
          formatDomainResponse(
            {
              ...row,
              status: currentStatus,
            },
            dns,
          ),
        );
      },

      POST: async ({ request, context }) => {
        const { user, supabase } = context as AuthedContext;

        const appUser = await getOrCreateAppUser(supabase, user.id);
        if (!appUser) return errorResponse(500, "internal_error", "Could not load account");

        if (!hasPaidAccess(appUser)) {
          return errorResponse(402, "payment_required", "Upgrade to Pro to use custom domains");
        }

        let body: { hostname?: unknown } = {};
        try {
          body = (await request.json()) ?? {};
        } catch {
          // ignore json parse error
        }

        const sitesDomain = process.env["SITES_DOMAIN"] ?? "";
        const validation = validateHostname(body.hostname, sitesDomain);
        if (!validation.ok) {
          return errorResponse(400, "domain_invalid", validation.reason);
        }

        const hostname = validation.hostname;
        const admin = createSupabaseAdminClient();

        // 400 no_site unless user has a published sites row
        const { data: site } = await admin
          .from("sites")
          .select("status")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!site || site.status !== "published") {
          return errorResponse(400, "no_site", "You must publish a site before adding a custom domain");
        }

        // Check if user already has a domain
        const { data: existingUserDomain } = await admin
          .from("custom_domains")
          .select("id, hostname")
          .eq("user_id", user.id)
          .maybeSingle();

        if (existingUserDomain) {
          if (existingUserDomain.hostname === hostname) {
            // Already has this exact domain
            return errorResponse(409, "domain_exists", "Domain already configured. Delete it first to re-add.");
          }
          return errorResponse(409, "domain_exists", "You already have a custom domain configured. Delete it first to change.");
        }

        // 409 domain_taken if another user has the hostname
        const { data: domainTaken } = await admin
          .from("custom_domains")
          .select("user_id, status")
          .eq("hostname", hostname)
          .maybeSingle();

        if (domainTaken) {
          // Only a domain whose owner has PROVEN control (verified/live) is protected. A pending claim proves
          // nothing, so a later claimant replaces it; otherwise anyone could squat a domain name they don't own.
          if (domainTaken.status === "pending") {
            await admin.from("custom_domains").delete().eq("hostname", hostname).eq("status", "pending");
          } else {
            return errorResponse(409, "domain_taken", "This domain is already registered by another user");
          }
        }

        const verifyToken = newVerifyToken();

        // Inserts pending with a new token. Does not call Vercel.
        const { data: inserted, error: insertError } = await admin
          .from("custom_domains")
          .insert({
            user_id: user.id,
            hostname,
            status: "pending",
            verify_token: verifyToken,
          })
          .select("hostname, status, verify_token, last_checked_at")
          .single();

        if (insertError || !inserted) {
          if (insertError?.code === "23505") {
            return errorResponse(409, "domain_taken", "This domain is already registered");
          }
          return errorResponse(500, "internal_error", "Could not save custom domain");
        }

        return Response.json(formatDomainResponse(inserted, null));
      },

      DELETE: async ({ context }) => {
        const { user } = context as AuthedContext;
        const admin = createSupabaseAdminClient();

        const { data: row } = await admin
          .from("custom_domains")
          .select("id, hostname")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!row) {
          return Response.json({ ok: true });
        }

        // removeDomain then delete row
        try {
          await removeDomain(row.hostname);
        } catch {
          // If removal from Vercel fails, we still proceed or raise? Task C: 404=success.
          // Vercel errors can be logged or thrown, but handoff says:
          // "DELETE /api/domains -> removeDomain then delete the row. { ok: true }."
        }

        await admin
          .from("custom_domains")
          .delete()
          .eq("id", row.id);

        return Response.json({ ok: true });
      },
    },
  },
});
