import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { byteaToBuffer, decryptSecret } from "@/lib/crypto";
import { embedStorageImagesInHtml } from "@/server/template/images";
import { createVercelDeployment, VercelDeployError } from "@/server/vercel/deploy";
import { getOrCreateAppUser, hasPaidAccess } from "@/server/users";

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

/**
 * Pushes the generated portfolio HTML to the user's own Vercel account.
 * Studio never calls this on its own — only an explicit Publish action does.
 */
export const Route = createFileRoute("/api/publish")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      POST: async ({ context }) => {
        const { user, supabase } = context as AuthedContext;

        const { data: connection } = await supabase
          .from("vercel_connections")
          .select("encrypted_access_token, nonce, team_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!connection) {
          return errorResponse(409, "vercel_not_connected", "Connect your Vercel account first");
        }

        const appUser = await getOrCreateAppUser(supabase, user.id);
        if (!appUser) return errorResponse(500, "internal_error", "Could not load account");

        // The one server-side gate that actually enforces "generate free,
        // pay to deploy": this is the only place the generated HTML ever
        // leaves the server. Studio's own live preview renders it inline
        // (an iframe over the same stored string), never through this route.
        if (!hasPaidAccess(appUser)) {
          return errorResponse(402, "payment_required", "Upgrade to Pro to publish your portfolio");
        }

        const { data: portfolio } = await supabase
          .from("portfolios")
          .select("generated_html")
          .eq("user_id", user.id)
          .maybeSingle();

        const generatedHtml = portfolio?.generated_html;
        if (!generatedHtml || !generatedHtml.trim()) {
          return errorResponse(400, "no_portfolio", "Generate a portfolio before publishing");
        }

        const { html, files: imageFiles, embeddedStoragePaths } = await embedStorageImagesInHtml(
          generatedHtml,
          supabase,
        );

        const accessToken = decryptSecret(
          byteaToBuffer(connection.encrypted_access_token),
          byteaToBuffer(connection.nonce),
        );

        const projectName = slugifyProjectName(extractTitle(html) ?? user.email ?? user.id);

        let deployment: { deploymentId: string; url: string };
        try {
          deployment = await createVercelDeployment(accessToken, connection.team_id, projectName, {
            "index.html": html,
            ...imageFiles,
          });
        } catch (e) {
          const message = e instanceof VercelDeployError ? e.message : String(e);
          return errorResponse(502, "vercel_deploy_failed", message);
        }

        const { data: publication, error: insertError } = await supabase
          .from("publications")
          .insert({
            user_id: user.id,
            vercel_deployment_id: deployment.deploymentId,
            status: "queued",
            url: deployment.url || null,
          })
          .select("id")
          .single();

        if (insertError || !publication) {
          return errorResponse(500, "internal_error", "Deployed, but could not record the publication");
        }

        if (embeddedStoragePaths.length > 0) {
          await supabase
            .from("uploads")
            .update({ published: true })
            .eq("user_id", user.id)
            .in("storage_path", embeddedStoragePaths);
        }

        return Response.json({ deploymentId: deployment.deploymentId, status: "queued" }, { status: 202 });
      },
    },
  },
});

function extractTitle(html: string): string | null {
  const match = /<title>([^<]*)<\/title>/i.exec(html);
  return match?.[1]?.trim() || null;
}

function slugifyProjectName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug.slice(0, 50) : "portfolio";
}
