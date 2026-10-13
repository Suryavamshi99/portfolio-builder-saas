import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { embedStorageImagesInHtml } from "@/server/template/images";
import { sanitizeHtmlForServing, UnstableHtmlError } from "@/server/finalize-html";
import { getOrCreateAppUser, hasPaidAccess } from "@/server/users";
import { getInstallationToken, GithubError } from "@/server/github/app";
import { pushSiteToRepo } from "@/server/github/push";

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export const Route = createFileRoute("/api/export/github")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      POST: async ({ request, context }) => {
        const { user, supabase } = context as AuthedContext;

        const appUser = await getOrCreateAppUser(supabase, user.id);
        if (!appUser) return errorResponse(500, "internal_error", "Could not load account");

        if (!hasPaidAccess(appUser)) {
          return errorResponse(402, "payment_required", "Upgrade to Pro to export your portfolio to GitHub");
        }

        let body: { repo?: string };
        try {
          body = (await request.json()) as { repo?: string };
        } catch {
          return errorResponse(400, "invalid_body", "Request body must be JSON");
        }

        const repo = body.repo?.trim();
        if (!repo) {
          return errorResponse(400, "invalid_repo", "Repository name is required");
        }

        const admin = createSupabaseAdminClient();

        // Check if user has an active GitHub connection
        const { data: connection } = await admin
          .from("github_connections")
          .select("installation_id, account_login")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!connection) {
          return errorResponse(
            400,
            "github_not_connected",
            "Connect your GitHub account before exporting to GitHub",
          );
        }

        // Load generated_html
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

        // Build files exactly like zip export
        const files: Record<string, Buffer | string> = {
          "index.html": sanitizedHtml,
        };

        for (const [filePath, buffer] of Object.entries(imageFiles)) {
          const relativePath = filePath.startsWith("images/") ? filePath : `images/${filePath}`;
          files[relativePath] = buffer;
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
        files["README.txt"] = readme;

        // Obtain short-lived installation token and push
        let token: string;
        try {
          token = await getInstallationToken(Number(connection.installation_id));
        } catch (e) {
          console.error("Failed to get installation token:", e instanceof GithubError ? e.message : e);
          return errorResponse(502, "github_error", "Failed to authenticate with GitHub");
        }

        let pushResult: { commitUrl: string; branch: string; created: boolean };
        try {
          pushResult = await pushSiteToRepo({
            token,
            repo,
            files,
            message: "Deploy portfolio from Shipfolio",
          });
        } catch (e) {
          if (e instanceof GithubError) {
            if (e.status === 404 || e.status === 403) {
              return errorResponse(400, "github_repo_unavailable", e.message);
            }
            if (e.status === 400) {
              return errorResponse(400, "github_invalid_request", e.message);
            }
          }
          console.error("Failed to push site to GitHub repo:", e);
          return errorResponse(502, "github_error", "Failed to push portfolio to GitHub");
        }

        // Insert exports record
        const { error: exportInsertError } = await admin.from("exports").insert({
          user_id: user.id,
          kind: "github",
          detail: repo,
        });

        if (exportInsertError) {
          console.warn("Failed to record export in exports table:", exportInsertError.message);
        }

        return Response.json({
          commitUrl: pushResult.commitUrl,
          repo,
        });
      },
    },
  },
});
