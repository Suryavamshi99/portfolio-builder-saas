import { createFileRoute } from "@tanstack/react-router";

import { adminMiddleware } from "@/server/admin-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listAdminUsers } from "@/server/admin-users";

export const Route = createFileRoute("/api/admin/users")({
  server: {
    middleware: [adminMiddleware],
    handlers: {
      GET: async () => {
        const admin = createSupabaseAdminClient();
        try {
          const users = await listAdminUsers(admin);
          return Response.json({ users });
        } catch {
          return Response.json({ error: { message: "Could not load users" } }, { status: 500 });
        }
      },
    },
  },
});
