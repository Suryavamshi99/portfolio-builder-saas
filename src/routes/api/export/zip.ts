import JSZip from "jszip";
import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { embedStorageImagesInHtml } from "@/server/template/images";
import { sanitizeHtmlForServing, UnstableHtmlError } from "@/server/finalize-html";
import { getOrCreateAppUser, hasPaidAccess } from "@/server/users";

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export const Route = createFileRoute("/api/export/zip")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ context }) => {
        const { user, supabase } = context as AuthedContext;

        const appUser = await getOrCreateAppUser(supabase, user.id);
        if (!appUser) return errorResponse(500, "internal_error", "Could not load account");

        if (!hasPaidAccess(appUser)) {
          return errorResponse(402, "payment_required", "Upgrade to Pro to export your portfolio zip package");
        }

        const admin = createSupabaseAdminClient();
        const { data: portfolio } = await admin
          .from("portfolios")
          .select("generated_html")
          .eq("user_id", user.id)
          .maybeSingle();

        const generatedHtml = portfolio?.generated_html;
        if (!generatedHtml || !generatedHtml.trim()) {
          return errorResponse(400, "no_portfolio", "Generate a portfolio before exporting");
        }

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
            "export_unsafe_html",
            "Your page couldn't be cleaned safely. Regenerate it, then export again.",
          );
        }

        const zip = new JSZip();
        zip.file("index.html", sanitizedHtml);

        const imgFolder = zip.folder("images");
        if (imgFolder) {
          for (const [filePath, buffer] of Object.entries(imageFiles)) {
            const fileName = filePath.startsWith("images/") ? filePath.slice("images/".length) : filePath;
            imgFolder.file(fileName, buffer);
          }
        }

        const readme = `Shipfolio Portfolio Export
========================

Thank you for building your portfolio with Shipfolio!

Contents:
- index.html: Your standalone portfolio website.
- images/: Self-contained bundled image assets used by your site.

How to run or host:
1. Double-click index.html to view your portfolio in any web browser.
2. Upload this directory or zip to any static hosting provider (Vercel, Netlify, GitHub Pages, Cloudflare Pages).
`;
        zip.file("README.txt", readme);

        const zipBuffer = await zip.generateAsync({
          type: "nodebuffer",
          compression: "DEFLATE",
          compressionOptions: { level: 6 },
        });

        return new Response(new Uint8Array(zipBuffer), {
          status: 200,
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": 'attachment; filename="portfolio.zip"',
            "Content-Length": String(zipBuffer.byteLength),
          },
        });
      },
    },
  },
});
