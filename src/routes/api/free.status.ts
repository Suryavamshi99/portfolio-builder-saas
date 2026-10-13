import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOrCreateAppUser } from "@/server/users";
import { getFreeChain } from "@/server/generation/free-wiring";
import { nextBudgetReset } from "@/server/generation/jobs";
import { FREE_GENERATIONS_PER_DAY, countFreeRunsToday } from "@/server/generation/limits";

export const Route = createFileRoute("/api/free/status")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ context }) => {
        const { user, supabase } = context as AuthedContext;
        const appUser = await getOrCreateAppUser(supabase, user.id);
        const limitToday = FREE_GENERATIONS_PER_DAY[appUser?.plan ?? "free"];
        const usedToday = await countFreeRunsToday(createSupabaseAdminClient(), user.id);
        return Response.json({
          available: getFreeChain().length > 0 && usedToday < limitToday,
          usedToday,
          limitToday,
          resetsAt: nextBudgetReset().toISOString(),
        });
      },
    },
  },
});
