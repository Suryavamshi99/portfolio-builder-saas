import { createFileRoute } from "@tanstack/react-router";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { json, preflight } from "@/server/mcp/http";
import { IMITATES_KNOWN_APP, cleanClientName, isTrustedClient, isValidRedirectUri } from "@/server/mcp/oauth";
import { registerClient } from "@/server/mcp/store";

const bad = (description: string) => json({ error: "invalid_client_metadata", error_description: description }, 400);

// Dynamic client registration (RFC 7591) for public clients such as Claude and ChatGPT.
// Registering grants nothing: a client still needs a signed-in user's consent.
export const Route = createFileRoute("/register")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request }) => {
        let body: Record<string, unknown>;
        try {
          body = await request.json();
        } catch {
          return bad("Body must be JSON");
        }
        const uris = body["redirect_uris"];
        if (!Array.isArray(uris) || uris.length < 1 || uris.length > 5 || !uris.every((u) => typeof u === "string" && isValidRedirectUri(u))) {
          return bad("redirect_uris must be 1-5 https (or loopback http) URLs");
        }
        const name = cleanClientName(typeof body["client_name"] === "string" ? body["client_name"] : "") || "Unnamed app";
        if (IMITATES_KNOWN_APP.test(name) && !isTrustedClient(uris as string[])) {
          return bad("client_name can't imitate a known app unless it returns to that app's own address");
        }

        const created = await registerClient(createSupabaseAdminClient(), { name, redirectUris: uris as string[] });
        if (!created) return json({ error: "server_error", error_description: "Registration is unavailable" }, 503);
        return json(
          {
            client_id: created.clientId,
            client_name: name,
            redirect_uris: uris,
            token_endpoint_auth_method: "none",
            grant_types: ["authorization_code", "refresh_token"],
            response_types: ["code"],
          },
          201,
        );
      },
    },
  },
});
