import { createFileRoute } from "@tanstack/react-router";
import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserJob, toApiJob } from "@/server/generation/jobs";
import { listConnections } from "@/server/mcp/store";

export const Route = createFileRoute("/api/mcp/status")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ context }) => {
        const { user } = context as AuthedContext;
        const admin = createSupabaseAdminClient();
        const connections = await listConnections(admin, user.id);
        const { data } = await admin
          .from("generation_jobs")
          .select("id")
          .eq("user_id", user.id)
          .eq("source", "mcp")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const job = data ? await getUserJob(admin, user.id, data.id) : null;
        return Response.json({ connected: connections.length > 0, connections, latestJob: job ? toApiJob(job) : null });
      },
    },
  },
});
