#!/usr/bin/env node
// One-time bootstrap for the upload retention system (see
// supabase/migrations/0002_retention_cron.sql, 0003_storage_cleanup.sql,
// 0008_purge_orphaned_uploads.sql, and supabase/functions/purge-storage-objects).
//
// The pg_cron jobs and purge SQL functions are created by migrations alone,
// but they can't actually delete a Storage object from SQL — that needs the
// purge-storage-objects Edge Function, plus a shared secret only pg_net and
// that function agree on. This script does the one-time wiring:
//   1. applies pending migrations (`supabase db push`)
//   2. deploys the edge function
//   3. generates (or reuses) a CRON_SECRET and sets it as a function secret
//   4. seeds public.app_config with the function's URL + that same secret
//
// After this runs once, the three cron jobs (hourly/daily, see 0002's
// `cron.schedule` calls) work with zero further manual steps — this is not
// a recurring chore. Re-running this script is safe (every step here is
// idempotent) if you ever need to rotate the secret or redeploy the function.
//
// Requires: the Supabase CLI installed and `supabase login` already done
// (this script does not attempt to log you in). Run from the repo root:
//   node scripts/setup-retention-cron.mjs
// or:
//   npm run setup:retention

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

function readEnvVar(name) {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    const match = readFileSync(file, "utf8").match(new RegExp(`^${name}=(.*)$`, "m"));
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  }
  return undefined;
}

function run(cmd, args, opts = {}) {
  console.log(`\n$ ${cmd} ${args.join(" ")}`);
  return execFileSync(cmd, args, { stdio: "inherit", ...opts });
}

function runCapture(cmd, args) {
  return execFileSync(cmd, args, { encoding: "utf8" });
}

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

// --- 0. Preconditions -------------------------------------------------

try {
  runCapture("supabase", ["--version"]);
} catch {
  fail(
    "Supabase CLI not found. Install it first: https://supabase.com/docs/guides/cli/getting-started\n" +
      "  macOS: brew install supabase/tap/supabase",
  );
}

const supabaseUrl = readEnvVar("SUPABASE_URL");
if (!supabaseUrl) fail("SUPABASE_URL not found in .env or .env.local");

const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
console.log(`Project ref: ${projectRef} (from SUPABASE_URL)`);

// --- 1. Link + apply pending migrations --------------------------------

try {
  run("supabase", ["link", "--project-ref", projectRef]);
} catch {
  fail("Could not link to the project. Make sure you've run `supabase login` first.");
}

console.log(
  "\nAbout to run `supabase db push` — this applies any migrations not yet recorded as\n" +
    "applied on this project (should just be 0008_purge_orphaned_uploads.sql, plus 0002/0003\n" +
    "if this is the very first run). Review the plan it prints before confirming.",
);
try {
  run("supabase", ["db", "push"]);
} catch {
  fail(
    "`supabase db push` failed. If earlier migrations were applied by hand (e.g. via the\n" +
      "SQL editor) rather than through this CLI, its migration-history table may be out of\n" +
      "sync — check the error above; you may need `supabase migration repair` first.",
  );
}

// --- 2. Deploy the edge function ---------------------------------------
// --no-verify-jwt: this function is called by pg_net (no Supabase user
// session to verify), and checks its own bearer secret instead — see the
// auth note at the top of purge-storage-objects/index.ts.

try {
  run("supabase", ["functions", "deploy", "purge-storage-objects", "--no-verify-jwt"]);
} catch {
  fail("Edge function deploy failed — see output above.");
}

// --- 3. Generate/reuse CRON_SECRET and set it on the function ----------

const cronSecret = readEnvVar("CRON_SECRET") ?? process.env.CRON_SECRET ?? randomBytes(32).toString("hex");

try {
  run("supabase", ["secrets", "set", `CRON_SECRET=${cronSecret}`]);
} catch {
  fail("Could not set the CRON_SECRET function secret.");
}

// --- 4. Seed app_config with the function URL + the same secret --------

const functionUrl = `https://${projectRef}.supabase.co/functions/v1/purge-storage-objects`;
const sql = `
insert into public.app_config (key, value) values
  ('purge_edge_function_url', '${functionUrl}'),
  ('purge_cron_secret', '${cronSecret}')
on conflict (key) do update set value = excluded.value;
`.trim();

const tmpFile = join(mkdtempSync(join(tmpdir(), "retention-cron-")), "seed.sql");
writeFileSync(tmpFile, sql);

try {
  run("supabase", ["db", "execute", "--file", tmpFile]);
  console.log("\n✓ app_config seeded.");
} catch {
  console.warn(
    "\n⚠ Could not run `supabase db execute` automatically (this subcommand isn't in every\n" +
      "CLI version). Paste this into the Supabase Dashboard's SQL editor instead:\n",
  );
  console.log(`\n${sql}\n`);
}

console.log(
  "\n✓ Done. The three cron jobs (purge-post-generation-uploads hourly,\n" +
    "purge-stale-draft-uploads + queue-stale-draft-warnings daily) will now actually delete\n" +
    "the underlying Storage objects, not just the DB rows. Nothing further to run manually\n" +
    "unless you rotate CRON_SECRET or change the edge function's code.",
);
