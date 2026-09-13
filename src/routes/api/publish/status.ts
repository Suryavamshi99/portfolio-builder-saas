import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { byteaToBuffer, decryptSecret } from "@/lib/crypto";
import { getVercelDeployment, mapReadyStateToPublicationStatus } from "@/server/vercel/deploy";

export const Route = createFileRoute("/api/publish/status")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ context }) => {
        const { user, supabase } = context as AuthedContext;

        const { data: publication } = await supabase
          .from("publications")
          .select("id, vercel_deployment_id, status, url, finished_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!publication) {
          return Response.json(
            { error: { code: "no_publications", message: "This account hasn't published yet" } },
            { status: 404 },
          );
        }

        // Terminal states don't need re-polling Vercel.
        if (publication.status === "ready" || publication.status === "error") {
          return Response.json({
            deploymentId: publication.vercel_deployment_id,
            status: publication.status,
            url: publication.url,
            finishedAt: publication.finished_at,
          });
        }

        const { data: connection } = await supabase
          .from("vercel_connections")
          .select("encrypted_access_token, nonce")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!connection || !publication.vercel_deployment_id) {
          return Response.json({
            deploymentId: publication.vercel_deployment_id,
            status: publication.status,
            url: publication.url,
            finishedAt: publication.finished_at,
          });
        }

        const accessToken = decryptSecret(
          byteaToBuffer(connection.encrypted_access_token),
          byteaToBuffer(connection.nonce),
        );
        const live = await getVercelDeployment(accessToken, publication.vercel_deployment_id);

        if (!live) {
          return Response.json({
            deploymentId: publication.vercel_deployment_id,
            status: publication.status,
            url: publication.url,
            finishedAt: publication.finished_at,
          });
        }

        const status = mapReadyStateToPublicationStatus(live.readyState);
        const isTerminal = status === "ready" || status === "error";
        const finishedAt = isTerminal ? new Date().toISOString() : null;

        await supabase
          .from("publications")
          .update({ status, url: live.url || publication.url, finished_at: finishedAt })
          .eq("id", publication.id);

        return Response.json({
          deploymentId: publication.vercel_deployment_id,
          status,
          url: live.url || publication.url,
          finishedAt,
        });
      },
    },
  },
});
