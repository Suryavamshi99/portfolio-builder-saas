// Deno Edge Function — deletes Storage objects on behalf of the retention
// cron (see supabase/migrations/0003_storage_cleanup.sql). SQL alone can't
// call the Storage API, so this is the "extra service" that closes that gap
// — invoked by pg_net from a SQL function, never called by the app itself.
//
// Auth: a shared secret, NOT the anon/service keys — this function must be
// reachable from pg_net (which can't easily carry a user session), so it
// checks a bearer token against CRON_SECRET (set via `supabase secrets set`)
// rather than relying on Supabase's default JWT verification.
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically into
// every Edge Function's environment — nothing to configure for those two.

import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) {
    return new Response(JSON.stringify({ error: "CRON_SECRET not configured" }), { status: 500 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  let body: { bucket?: unknown; paths?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid JSON body" }), { status: 400 });
  }

  const bucket = body.bucket;
  const paths = body.paths;
  if (typeof bucket !== "string" || !Array.isArray(paths) || !paths.every((p) => typeof p === "string")) {
    return new Response(JSON.stringify({ error: "expected { bucket: string, paths: string[] }" }), {
      status: 400,
    });
  }
  if (paths.length === 0) {
    return new Response(JSON.stringify({ ok: true, removed: 0 }));
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase.storage.from(bucket).remove(paths);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, removed: data?.length ?? 0 }));
});
