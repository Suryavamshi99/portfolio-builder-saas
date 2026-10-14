import { createFileRoute } from "@tanstack/react-router";

import { adminMiddleware, requireStepUp } from "@/server/admin-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { removeSiteFiles } from "@/server/sites-storage";
import { siteUrl } from "@/server/sites";
import { listConnections } from "@/server/mcp/store";
import { logAdminAction, validateReason } from "@/server/admin-audit";
import type { Plan } from "@/config/plans";

const UPLOADS_BUCKET = "uploads";

export const Route = createFileRoute("/api/admin/users/$id")({
  server: {
    middleware: [adminMiddleware],
    handlers: {
      GET: async ({ params }) => {
        const admin = createSupabaseAdminClient();

        const { data: authUser, error: authError } = await admin.auth.admin.getUserById(params.id);
        if (authError || !authUser?.user) {
          return Response.json({ error: { code: "not_found", message: "User not found" } }, { status: 404 });
        }

        const [
          { data: appUser },
          { data: portfolio },
          { data: uploads },
          { data: byokKeys },
          { data: vercelConn },
          { data: versions },
          { data: jobs },
          { data: siteRow },
          { data: domainRow },
          { data: githubRow },
          mcpConnections,
        ] = await Promise.all([
          admin.from("users").select("plan, created_at, is_admin").eq("id", params.id).maybeSingle(),
          admin.from("portfolios").select("generated_html, updated_at").eq("user_id", params.id).maybeSingle(),
          admin.from("uploads").select("id, kind, filename, size_bytes, created_at").eq("user_id", params.id),
          // Metadata only — never the encrypted_key/nonce columns.
          admin.from("byok_keys").select("provider, created_at").eq("user_id", params.id),
          admin.from("vercel_connections").select("vercel_username, connected_at").eq("user_id", params.id).maybeSingle(),
          admin
            .from("portfolio_versions")
            .select("id, source, model, warnings, html, created_at")
            .eq("user_id", params.id)
            .order("created_at", { ascending: false })
            .limit(20),
          admin
            .from("generation_jobs")
            .select("id, source, status, provider, error, created_at, updated_at")
            .eq("user_id", params.id)
            .order("created_at", { ascending: false })
            .limit(10),
          admin.from("sites").select("slug, status, updated_at").eq("user_id", params.id).maybeSingle(),
          admin.from("custom_domains").select("hostname, status").eq("user_id", params.id).maybeSingle(),
          admin.from("github_connections").select("account_login").eq("user_id", params.id).maybeSingle(),
          listConnections(admin, params.id).catch(() => []),
        ]);

        const mappedUploads = (uploads ?? []).map((u) => ({
          id: u.id,
          kind: u.kind,
          filename: u.filename,
          size_bytes: u.size_bytes,
          sizeBytes: u.size_bytes,
          created_at: u.created_at,
          createdAt: u.created_at,
        }));

        const mappedVersions = (versions ?? []).map((v) => ({
          id: v.id,
          source: v.source,
          model: v.model ?? null,
          warningsCount: Array.isArray(v.warnings) ? v.warnings.length : 0,
          htmlBytes: (v.html as string)?.length ?? 0,
          createdAt: v.created_at,
        }));

        const mappedJobs = (jobs ?? []).map((j) => ({
          id: j.id,
          source: j.source,
          status: j.status,
          provider: j.provider ?? null,
          errorCode: (j.error as { code?: string } | null)?.code ?? null,
          errorMessage: (j.error as { message?: string } | null)?.message ?? null,
          createdAt: j.created_at,
          updatedAt: j.updated_at,
        }));

        const mappedSite = siteRow
          ? {
              slug: siteRow.slug,
              status: siteRow.status,
              url: siteUrl(siteRow.slug),
              updatedAt: siteRow.updated_at,
            }
          : null;

        const mappedDomain = domainRow
          ? {
              hostname: domainRow.hostname,
              status: domainRow.status,
            }
          : null;

        const mappedConnections = {
          github: githubRow ? { account: githubRow.account_login } : null,
          vercel: Boolean(vercelConn),
          mcp: mcpConnections,
        };

        return Response.json({
          id: authUser.user.id,
          email: authUser.user.email ?? null,
          createdAt: authUser.user.created_at,
          plan: appUser?.plan ?? "free",
          isAdmin: appUser?.is_admin ?? false,
          portfolio: portfolio ? { html: portfolio.generated_html, updatedAt: portfolio.updated_at } : null,
          uploads: mappedUploads,
          byokProviders: byokKeys ?? [],
          vercelConnection: vercelConn,
          versions: mappedVersions,
          jobs: mappedJobs,
          site: mappedSite,
          domain: mappedDomain,
          connections: mappedConnections,
        });
      },

      PATCH: async ({ request, params }) => {
        const admin = createSupabaseAdminClient();

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: { code: "invalid_body", message: "Invalid request body" } }, { status: 400 });
        }
        const bodyObj = (body ?? {}) as { plan?: unknown; isAdmin?: unknown; html?: unknown; reason?: unknown };
        const { plan, isAdmin, html } = bodyObj;

        const { data: currentUser } = await admin
          .from("users")
          .select("plan, is_admin")
          .eq("id", params.id)
          .maybeSingle();

        if (plan !== undefined) {
          if (plan !== "free" && plan !== "pro") {
            return Response.json({ error: { code: "invalid_plan", message: "plan must be 'free' or 'pro'" } }, { status: 422 });
          }
          const currentPlan = (currentUser?.plan as Plan) ?? "free";
          if (currentPlan !== plan && (currentPlan === "pro" || plan === "pro")) {
            const reasonResult = validateReason(bodyObj.reason);
            if (!reasonResult.ok) return reasonResult.response;

            const stepUpError = await requireStepUp(request);
            if (stepUpError) return stepUpError;

            const { error } = await admin.from("users").update({ plan: plan as Plan }).eq("id", params.id);
            if (error) return Response.json({ error: { code: "internal_error", message: "Could not update plan" } }, { status: 500 });

            await logAdminAction(admin, {
              action: "user.plan_change",
              targetType: "user",
              targetId: params.id,
              reason: reasonResult.reason,
              detail: { from: currentPlan, to: plan },
              request,
            });
          } else {
            const { error } = await admin.from("users").update({ plan: plan as Plan }).eq("id", params.id);
            if (error) return Response.json({ error: { code: "internal_error", message: "Could not update plan" } }, { status: 500 });
          }
        }

        if (isAdmin !== undefined) {
          if (typeof isAdmin !== "boolean") {
            return Response.json({ error: { code: "invalid_admin_flag", message: "isAdmin must be a boolean" } }, { status: 422 });
          }
          const currentIsAdmin = Boolean(currentUser?.is_admin);
          if (currentIsAdmin !== isAdmin) {
            const reasonResult = validateReason(bodyObj.reason);
            if (!reasonResult.ok) return reasonResult.response;

            const stepUpError = await requireStepUp(request);
            if (stepUpError) return stepUpError;

            if (currentIsAdmin && !isAdmin) {
              const { count: adminCount } = await admin
                .from("users")
                .select("id", { count: "exact", head: true })
                .eq("is_admin", true);

              if ((adminCount ?? 0) <= 1) {
                return Response.json(
                  { error: { code: "last_admin", message: "Cannot remove admin status from the last remaining admin" } },
                  { status: 409 },
                );
              }
            }

            const { error } = await admin.from("users").update({ is_admin: isAdmin }).eq("id", params.id);
            if (error) return Response.json({ error: { code: "internal_error", message: "Could not update admin flag" } }, { status: 500 });

            await logAdminAction(admin, {
              action: "user.admin_flag",
              targetType: "user",
              targetId: params.id,
              reason: reasonResult.reason,
              detail: { from: currentIsAdmin, to: isAdmin },
              request,
            });
          }
        }

        if (html !== undefined) {
          if (typeof html !== "string") {
            return Response.json({ error: { code: "invalid_html", message: "html must be a string" } }, { status: 422 });
          }
          const { error } = await admin
            .from("portfolios")
            .upsert(
              { user_id: params.id, generated_html: html, updated_at: new Date().toISOString() },
              { onConflict: "user_id" },
            );
          if (error) return Response.json({ error: { code: "internal_error", message: "Could not update portfolio" } }, { status: 500 });

          const reasonStr = typeof bodyObj.reason === "string" ? bodyObj.reason.trim() : null;
          await logAdminAction(admin, {
            action: "user.html_edit",
            targetType: "user",
            targetId: params.id,
            reason: reasonStr,
            detail: { htmlBytes: html.length },
            request,
          });
        }

        return Response.json({ ok: true });
      },

      DELETE: async ({ request, params }) => {
        const admin = createSupabaseAdminClient();

        let bodyObj: { confirmEmail?: unknown; reason?: unknown } = {};
        try {
          bodyObj = ((await request.json()) ?? {}) as { confirmEmail?: unknown; reason?: unknown };
        } catch {
          // Empty or non-JSON body
        }

        const stepUpError = await requireStepUp(request);
        if (stepUpError) return stepUpError;

        const reasonResult = validateReason(bodyObj.reason);
        if (!reasonResult.ok) return reasonResult.response;

        const { data: authUser, error: authError } = await admin.auth.admin.getUserById(params.id);
        if (authError || !authUser?.user) {
          return Response.json({ error: { code: "not_found", message: "User not found" } }, { status: 404 });
        }

        const confirmEmail = typeof bodyObj.confirmEmail === "string" ? bodyObj.confirmEmail.trim().toLowerCase() : "";
        const expectedEmail = (authUser.user.email ?? "").trim().toLowerCase();
        if (!confirmEmail || confirmEmail !== expectedEmail) {
          return Response.json(
            { error: { code: "confirm_mismatch", message: "confirmEmail does not match user email" } },
            { status: 400 },
          );
        }

        const { data: userRow } = await admin.from("users").select("is_admin").eq("id", params.id).maybeSingle();
        if (userRow?.is_admin) {
          const { count: adminCount } = await admin
            .from("users")
            .select("id", { count: "exact", head: true })
            .eq("is_admin", true);

          if ((adminCount ?? 0) <= 1) {
            return Response.json(
              { error: { code: "last_admin", message: "Cannot delete the last remaining admin" } },
              { status: 409 },
            );
          }
        }

        try {
          const { data: site } = await admin
            .from("sites")
            .select("slug")
            .eq("user_id", params.id)
            .maybeSingle();

          if (site?.slug) {
            try {
              await removeSiteFiles(admin, site.slug);
            } catch {
              console.warn(`Could not remove site files for slug: ${site.slug}`);
            }
          }
        } catch {
          // Failure to lookup site must not block user deletion
        }

        const { data: uploads } = await admin.from("uploads").select("storage_path").eq("user_id", params.id);
        if (uploads && uploads.length > 0) {
          await admin.storage.from(UPLOADS_BUCKET).remove(uploads.map((u) => u.storage_path as string));
        }

        const { error: deleteError } = await admin.auth.admin.deleteUser(params.id);
        if (deleteError) {
          return Response.json({ error: { code: "internal_error", message: "Could not delete user" } }, { status: 500 });
        }

        await logAdminAction(admin, {
          action: "user.delete",
          targetType: "user",
          targetId: params.id,
          reason: reasonResult.reason,
          detail: { email: authUser.user.email },
          request,
        });

        return new Response(null, { status: 204 });
      },
    },
  },
});
