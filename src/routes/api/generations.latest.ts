import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserJob, toApiJob } from "@/server/generation/jobs";

export const Route = createFileRoute("/api/generations/latest")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ context }) => {
        const { user } = context as AuthedContext;
        const job = await getUserJob(createSupabaseAdminClient(), user.id, "latest");
        return Response.json(job ? toApiJob(job) : null);
      },
    },
  },
});
