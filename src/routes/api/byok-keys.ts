import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { isLlmProvider } from "@/config/llm";
import { bufferToBytea, encryptSecret } from "@/lib/crypto";

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export const Route = createFileRoute("/api/byok-keys")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ context }) => {
        const { user, supabase } = context as AuthedContext;

        const { data, error } = await supabase
          .from("byok_keys")
          .select("provider, created_at")
          .eq("user_id", user.id);

        if (error) return errorResponse(500, "internal_error", "Could not list keys");

        // Never includes key material — select() above doesn't even fetch it.
        return Response.json({
          keys: (data ?? []).map((row) => ({ provider: row.provider, connectedAt: row.created_at })),
        });
      },

      POST: async ({ request, context }) => {
        const { user, supabase } = context as AuthedContext;

        let body: { provider?: unknown; apiKey?: unknown };
        try {
          body = await request.json();
        } catch {
          return errorResponse(400, "invalid_json", "Body must be valid JSON");
        }

        if (!isLlmProvider(body.provider)) {
          return errorResponse(400, "invalid_provider", "provider must be one of: anthropic, openai, google");
        }
        if (typeof body.apiKey !== "string" || body.apiKey.trim().length === 0) {
          return errorResponse(400, "invalid_api_key", "apiKey is required");
        }

        const { ciphertext, nonce } = encryptSecret(body.apiKey.trim());

        const { data, error } = await supabase
          .from("byok_keys")
          .upsert(
            {
              user_id: user.id,
              provider: body.provider,
              encrypted_key: bufferToBytea(ciphertext),
              nonce: bufferToBytea(nonce),
            },
            { onConflict: "user_id,provider" },
          )
          .select("provider, created_at")
          .single();

        if (error || !data) return errorResponse(500, "internal_error", "Could not save key");

        return Response.json({ provider: data.provider, connectedAt: data.created_at });
      },
    },
  },
});
