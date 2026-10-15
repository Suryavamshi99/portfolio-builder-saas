import { createFileRoute } from "@tanstack/react-router";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isTrustedRedirect, isValidRedirectUri, redirectUriMatches } from "@/server/mcp/oauth";
import { createAuthCode, getClient } from "@/server/mcp/store";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// The consent page must never be framed (clickjacking). `form-action` also governs the redirect that
// follows the form post, so the consent page must allow the app's own return address, or the browser
// refuses to send the user back to Claude / ChatGPT after they click Allow.
export const consentCsp = (returnOrigin?: string) =>
  `default-src 'none'; style-src 'unsafe-inline'; form-action 'self'${returnOrigin ? ` ${returnOrigin}` : ""}; frame-ancestors 'none'; base-uri 'none'`;

const pageHeaders = (returnOrigin?: string) => ({
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "content-security-policy": consentCsp(returnOrigin),
  "x-frame-options": "DENY",
});

const page = (title: string, body: string, status = 200, returnOrigin?: string) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>` +
      `<style>body{font-family:system-ui,sans-serif;background:#0B0D12;color:#F6F6F3;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}` +
      `main{max-width:440px;background:#14161C;border:1px solid #232732;border-radius:14px;padding:28px}h1{font-size:20px;margin:0 0 12px}p{color:#9AA0B0;line-height:1.5}` +
      `code{background:#232732;padding:2px 6px;border-radius:6px;color:#F6F6F3}.row{display:flex;gap:10px;margin-top:20px}` +
      `button{flex:1;padding:11px 14px;border-radius:9px;border:1px solid #2E3342;background:#232732;color:#F6F6F3;font-size:15px;cursor:pointer}` +
      `button.allow{background:#F6F6F3;color:#0B0D12;border-color:#F6F6F3;font-weight:600}</style></head><body><main>${body}</main></body></html>`,
    { status, headers: pageHeaders(returnOrigin) },
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

async function sessionUser(): Promise<{ id: string; email: string } | null> {
  const {
    data: { user },
  } = await createSupabaseServerClient().auth.getUser();
  return user ? { id: user.id, email: user.email ?? "" } : null;
}

export const Route = createFileRoute("/authorize")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const v = await validate((k) => url.searchParams.get(k) ?? "");
        if (!v.ok) return v.response;

        const me = await sessionUser();
        if (!me) {
          const back = encodeURIComponent(`/authorize${url.search}`);
          return new Response(null, { status: 302, headers: { location: `/login?redirect=${back}`, "cache-control": "no-store" } });
        }
        const host = new URL(v.p.redirectUri).host;
        const verified = isTrustedRedirect(v.p.redirectUri);
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
            (verified
              ? ""
              : `<p style="background:#451a03;border:1px solid #b45309;color:#fde68a;padding:10px 12px;border-radius:8px"><strong>Unverified app.</strong> This app is not Claude or ChatGPT and we can't confirm who runs it. Only continue if you started this connection yourself, from an app you trust, just now.</p>`) +
            `<p><strong>${esc(v.clientName)}</strong> will send you back to <code>${esc(host)}</code>. It will be able to read your resume details and portfolio, and save a portfolio page for you.</p>` +
            `<p>You are signed in as <strong>${esc(me.email)}</strong>.</p>` +
            `<p>You can disconnect it any time in Shipfolio settings.</p>` +
            `<form method="post" action="/authorize">${hidden}<div class="row">` +
            `<button name="decision" value="deny" type="submit">Cancel</button><button class="allow" name="decision" value="allow" type="submit">Allow</button></div></form>`,
          200,
          new URL(v.p.redirectUri).origin,
        );
      },
      // Same-origin form post: protected by the Origin check in src/start.ts and the session cookie.
      POST: async ({ request }) => {
        const form = new URLSearchParams(await request.text());
        const v = await validate((k) => form.get(k) ?? "");
        if (!v.ok) return v.response;
        const userId = (await sessionUser())?.id;
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
