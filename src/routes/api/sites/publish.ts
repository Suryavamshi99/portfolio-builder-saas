import { createHash } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { embedStorageImagesInHtml } from "@/server/template/images";
import { sanitizeHtmlForServing, UnstableHtmlError } from "@/server/finalize-html";
import { getOrCreateAppUser, hasPaidAccess } from "@/server/users";
import { siteUrl, validateSlug } from "@/server/sites";
import { hasHostingAccess } from "@/server/billing";

const SITES_BUCKET = "sites";

const ALLOWED_IMAGE_MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
};

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export const Route = createFileRoute("/api/sites/publish")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      POST: async ({ request, context }) => {
        const { user, supabase } = context as AuthedContext;

        const appUser = await getOrCreateAppUser(supabase, user.id);
        if (!appUser) return errorResponse(500, "internal_error", "Could not load account");

        if (!hasPaidAccess(appUser)) {
          return errorResponse(402, "payment_required", "Upgrade to Pro to publish your site");
        }

        const admin = createSupabaseAdminClient();

        if (!(await hasHostingAccess(admin, appUser))) {
          return errorResponse(402, "hosting_required", "Your hosting has ended. Renew it to publish your site");
        }

        // 1. Load generated_html
        const { data: portfolio } = await admin
          .from("portfolios")
          .select("generated_html")
          .eq("user_id", user.id)
          .maybeSingle();

        const generatedHtml = portfolio?.generated_html;
        if (!generatedHtml || !generatedHtml.trim()) {
          return errorResponse(400, "no_portfolio", "Generate a portfolio before publishing");
        }

        let body: { slug?: unknown } = {};
        try {
          body = (await request.json()) ?? {};
        } catch {
          // Empty body or invalid json is handled gracefully
        }

        // 2. Slug determination and reservation
        const { data: existingSite } = await admin
          .from("sites")
          .select("slug, status")
          .eq("user_id", user.id)
          .maybeSingle();

        let targetSlug: string;

        if (existingSite) {
          // The slug is fixed after first publish (ignore a different slug later)
          targetSlug = existingSite.slug;
        } else {
          if (!body.slug || typeof body.slug !== "string") {
            return errorResponse(400, "slug_invalid", "slug is required for the first publish");
          }

          const validation = validateSlug(body.slug);
          if (!validation.ok) {
            const code = validation.status === "reserved" ? "slug_reserved" : "slug_invalid";
            const message = validation.status === "reserved" ? "This slug is reserved" : "Invalid slug format";
            return errorResponse(400, code, message);
          }

          targetSlug = validation.slug;

          // Check if slug is taken by someone else
          const { data: siteWithSlug } = await admin
            .from("sites")
            .select("user_id")
            .eq("slug", targetSlug)
            .maybeSingle();

          if (siteWithSlug && siteWithSlug.user_id !== user.id) {
            return errorResponse(409, "slug_taken", "This slug is already taken");
          }
        }

        // 3. Build files like zip.ts: embed images & sanitize HTML
        const { html, files: imageFiles } = await embedStorageImagesInHtml(
          generatedHtml,
          supabase,
          user.id,
        );

        let sanitizedHtml: string;
        try {
          sanitizedHtml = sanitizeHtmlForServing(html);
        } catch (e) {
          if (!(e instanceof UnstableHtmlError)) throw e;
          return errorResponse(
            422,
            "publish_unsafe_html",
            "Your page couldn't be cleaned safely. Regenerate it, then publish again.",
          );
        }

        // Find latest portfolio_versions row id
        const { data: latestVersion } = await admin
          .from("portfolio_versions")
          .select("id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const publishedVersionId = latestVersion?.id ?? null;
        const htmlHash = createHash("sha256").update(sanitizedHtml).digest("hex");

        // Insert-then-upload order: reserve the slug (insert/upsert the sites row, unique violation -> 409)
        // BEFORE uploading files, so two users can't race for one slug.
        const { error: upsertError } = await admin
          .from("sites")
          .upsert(
            {
              user_id: user.id,
              slug: targetSlug,
              status: "published",
              published_version_id: publishedVersionId,
              published_html_hash: htmlHash,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );

        if (upsertError) {
          // If unique constraint on slug is violated: 23505 in PostgreSQL
          if (upsertError.code === "23505" || upsertError.message.includes("unique")) {
            return errorResponse(409, "slug_taken", "This slug is already taken");
          }
          return errorResponse(500, "internal_error", "Could not reserve site slug");
        }

        // 4. Upload with the admin client to bucket sites:
        // {slug}/index.html
        const indexUpload = await admin.storage
          .from(SITES_BUCKET)
          .upload(`${targetSlug}/index.html`, Buffer.from(sanitizedHtml, "utf-8"), {
            contentType: "text/html; charset=utf-8",
            upsert: true,
          });

        if (indexUpload.error) {
          return errorResponse(500, "internal_error", "Could not upload index.html");
        }

        // Upload images: {slug}/images/<name>
        const uploadedImageNames = new Set<string>();
        for (const [filePath, buffer] of Object.entries(imageFiles)) {
          const rawName = filePath.startsWith("images/") ? filePath.slice("images/".length) : filePath;
          const ext = rawName.split(".").pop()?.toLowerCase() ?? "";
          const contentType = ALLOWED_IMAGE_MIME_BY_EXT[ext];

          if (!contentType) {
            // skip disallowed image types
            continue;
          }

          const uploadPath = `${targetSlug}/images/${rawName}`;
          const imgUpload = await admin.storage
            .from(SITES_BUCKET)
            .upload(uploadPath, buffer, {
              contentType,
              upsert: true,
            });

          if (!imgUpload.error) {
            uploadedImageNames.add(rawName);
          }
        }

        // Remove stale files under {slug}/images/ that are no longer referenced
        const { data: existingStorageFiles } = await admin.storage
          .from(SITES_BUCKET)
          .list(`${targetSlug}/images`);

        if (existingStorageFiles && existingStorageFiles.length > 0) {
          const stalePaths: string[] = [];
          for (const file of existingStorageFiles) {
            if (file.name && !uploadedImageNames.has(file.name)) {
              stalePaths.push(`${targetSlug}/images/${file.name}`);
            }
          }
          if (stalePaths.length > 0) {
            await admin.storage.from(SITES_BUCKET).remove(stalePaths);
          }
        }

        return Response.json({
          url: siteUrl(targetSlug),
        });
      },
    },
  },
});
