import { createFileRoute } from "@tanstack/react-router";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isValidRedirectUri, redirectUriMatches } from "@/server/mcp/oauth";
import { createAuthCode, getClient } from "@/server/mcp/store";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const PAGE_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  // The consent page must never be framed (clickjacking).
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  "x-frame-options": "DENY",
};

const page = (title: string, body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>` +
      `<style>body{font-family:system-ui,sans-serif;background:#0b0b0f;color:#f4f4f5;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}` +
      `main{max-width:440px;background:#18181b;border:1px solid #27272a;border-radius:14px;padding:28px}h1{font-size:20px;margin:0 0 12px}p{color:#a1a1aa;line-height:1.5}` +
      `code{background:#27272a;padding:2px 6px;border-radius:6px;color:#f4f4f5}.row{display:flex;gap:10px;margin-top:20px}` +
      `button{flex:1;padding:11px 14px;border-radius:9px;border:1px solid #3f3f46;background:#27272a;color:#f4f4f5;font-size:15px;cursor:pointer}` +
      `button.allow{background:#f4f4f5;color:#09090b;border-color:#f4f4f5;font-weight:600}</style></head><body><main>${body}</main></body></html>`,
    { status, headers: PAGE_HEADERS },
  );

type Params = { clientId: string; redirectUri: string; state: string; codeChallenge: string };

/** Validates what the client sent. A bad client or redirect is shown to the user, never redirected to. */
async function validate(get: (k: string) => string): Promise<{ ok: true; p: Params; clientName: string } | { ok: false; response: Response }> {
  const fail = (msg: string) => ({ ok: false as const, response: page("Can't connect", `<h1>Can't connect</h1><p>${esc(msg)}</p>`, 400) });
  const clientId = get("client_id");
  const redirectUri = get("redirect_uri");
  if (!clientId || !redirectUri || !isValidRedirectUri(redirectUri)) return fail("This connection request is invalid.");
  const client = await getClient(createSupabaseAdminClient(), clientId);
  if (!client || !redirectUriMatches(client.redirect_uris, redirectUri)) return fail("This app isn't registered for that address.");
  if (get("response_type") !== "code") return fail("Unsupported response type.");
  const codeChallenge = get("code_challenge");
  if (get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9\-._~]{43,128}$/.test(codeChallenge)) {
    return fail("This app didn't use a secure sign-in method (PKCE).");
  }
  return { ok: true, p: { clientId, redirectUri, state: get("state").slice(0, 500), codeChallenge }, clientName: client.client_name };
}

const redirect = (uri: string, params: Record<string, string>) => {
  const u = new URL(uri);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  return new Response(null, { status: 303, headers: { location: u.toString(), "cache-control": "no-store" } });
};

async function sessionUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await createSupabaseServerClient().auth.getUser();
  return user?.id ?? null;
}

export const Route = createFileRoute("/authorize")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const v = await validate((k) => url.searchParams.get(k) ?? "");
        if (!v.ok) return v.response;

        if (!(await sessionUserId())) {
          const back = encodeURIComponent(`/authorize${url.search}`);
          return new Response(null, { status: 302, headers: { location: `/login?redirect=${back}`, "cache-control": "no-store" } });
        }
        const host = new URL(v.p.redirectUri).host;
        const hidden = Object.entries({
          client_id: v.p.clientId,
          redirect_uri: v.p.redirectUri,
          response_type: "code",
          code_challenge: v.p.codeChallenge,
          code_challenge_method: "S256",
          state: v.p.state,
        })
          .map(([k, val]) => `<input type="hidden" name="${k}" value="${esc(val)}">`)
          .join("");
        return page(
          "Connect to Shipfolio",
          `<h1>Connect ${esc(v.clientName)} to Shipfolio?</h1>` +
            `<p><strong>${esc(v.clientName)}</strong> (returns to <code>${esc(host)}</code>) will be able to read your resume details and portfolio, and save a portfolio page for you.</p>` +
            `<p>You can disconnect it any time in Shipfolio settings.</p>` +
            `<form method="post" action="/authorize">${hidden}<div class="row">` +
            `<button name="decision" value="deny" type="submit">Cancel</button><button class="allow" name="decision" value="allow" type="submit">Allow</button></div></form>`,
        );
      },
      // Same-origin form post: protected by the Origin check in src/start.ts and the session cookie.
      POST: async ({ request }) => {
        const form = new URLSearchParams(await request.text());
        const v = await validate((k) => form.get(k) ?? "");
        if (!v.ok) return v.response;
        const userId = await sessionUserId();
        if (!userId) return page("Sign in required", "<h1>Sign in required</h1><p>Your session ended. Start the connection again from your chat.</p>", 401);

        if (form.get("decision") !== "allow") return redirect(v.p.redirectUri, { error: "access_denied", state: v.p.state });
        const code = await createAuthCode(createSupabaseAdminClient(), {
          userId,
          clientId: v.p.clientId,
          redirectUri: v.p.redirectUri,
          codeChallenge: v.p.codeChallenge,
        });
        return redirect(v.p.redirectUri, { code, state: v.p.state });
      },
    },
  },
});
