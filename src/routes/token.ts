import { createFileRoute } from "@tanstack/react-router";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { json, preflight } from "@/server/mcp/http";
import { exchangeCode, refreshTokens } from "@/server/mcp/store";

const oauthError = (error: string, description: string, status = 400) => json({ error, error_description: description }, status);

export const Route = createFileRoute("/token")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request }) => {
        // Public clients only: no cookies are read here, only the code/refresh token + PKCE verifier.
        const form = new URLSearchParams(await request.text());
        const get = (k: string) => form.get(k) ?? "";
        const clientId = get("client_id");
        if (!clientId) return oauthError("invalid_client", "client_id is required");
        const admin = createSupabaseAdminClient();

        let result;
        if (get("grant_type") === "authorization_code") {
          if (!get("code") || !get("code_verifier") || !get("redirect_uri")) return oauthError("invalid_request", "code, code_verifier and redirect_uri are required");
          result = await exchangeCode(admin, { code: get("code"), clientId, redirectUri: get("redirect_uri"), verifier: get("code_verifier") });
        } else if (get("grant_type") === "refresh_token") {
          if (!get("refresh_token")) return oauthError("invalid_request", "refresh_token is required");
          result = await refreshTokens(admin, { refreshToken: get("refresh_token"), clientId });
        } else {
          return oauthError("unsupported_grant_type", "Use authorization_code or refresh_token");
        }
        return result.ok ? json(result.tokens) : oauthError(result.error, "The code or token is invalid, expired or already used");
      },
    },
  },
});
