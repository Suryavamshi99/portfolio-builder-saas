import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { isLlmProvider } from "@/config/llm";

export const Route = createFileRoute("/api/byok-keys/$provider")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      DELETE: async ({ params, context }) => {
        const { user, supabase } = context as AuthedContext;

        if (!isLlmProvider(params.provider)) {
          return Response.json(
            { error: { code: "invalid_provider", message: "provider must be one of: anthropic, openai, google" } },
            { status: 400 },
          );
        }

        await supabase
          .from("byok_keys")
          .delete()
          .eq("user_id", user.id)
          .eq("provider", params.provider);

        return new Response(null, { status: 204 });
      },
    },
  },
});
