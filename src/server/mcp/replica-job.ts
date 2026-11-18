import type { SupabaseClient } from "@supabase/supabase-js";

import type { ReplicaParams, ReplicaRequest } from "@/server/brand/replica";
import { createJob } from "@/server/generation/jobs";

export const ACTIVE_STATUSES = ["queued", "reading", "writing", "checking", "saving"];

/** The user's running connector job (id and params), or null when there is none or another kind of build is running. */
export async function activeMcpJob(admin: SupabaseClient, userId: string): Promise<{ id: string; params: Record<string, unknown> } | null> {
  const { data } = await admin.from("generation_jobs").select("id, source, status, params").eq("user_id", userId).in("status", ACTIVE_STATUSES).maybeSingle();
  if (!data || data.source !== "mcp" || data.status === "queued") return null;
  return { id: data.id as string, params: (data.params ?? {}) as Record<string, unknown> };
}

async function latestJob(admin: SupabaseClient, userId: string): Promise<{ id: string; source: string; params: Record<string, unknown> } | null> {
  const { data } = await admin.from("generation_jobs").select("id, source, params").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data ? { id: data.id as string, source: data.source as string, params: (data.params ?? {}) as Record<string, unknown> } : null;
}

/** The company look the user chose for their connector build, if any. Carries over to revisions (new jobs) until the wizard clears it. */
export async function activeReplica(admin: SupabaseClient, userId: string): Promise<ReplicaParams | null> {
  const job = await activeMcpJob(admin, userId);
  let params = job?.params;
  if (!job) {
    // No running connector job: the choice carries over from the user's latest job, if that was a connector job.
    const latest = await latestJob(admin, userId);
    params = latest?.source === "mcp" ? latest.params : undefined;
  }
  const r = params?.["replica"];
  return r && typeof r === "object" && typeof (r as ReplicaParams).url === "string" ? (r as ReplicaParams) : null;
}

/**
 * Stores (or, with null, clears) the user's company look on their connector job, so their chat reads it before the first build.
 * Uses generation_jobs.params, so no database change. False when another kind of build is running.
 */
export async function storeMcpReplica(admin: SupabaseClient, userId: string, resumeId: string, replica: ReplicaRequest | null): Promise<boolean> {
  const { data: active } = await admin.from("generation_jobs").select("id, source, status, params").eq("user_id", userId).in("status", ACTIVE_STATUSES).maybeSingle();
  if (active && active.status !== "queued") {
    if (active.source !== "mcp") return false;
    const rest = { ...((active.params ?? {}) as Record<string, unknown>) };
    delete rest["replica"];
    delete rest["theme"];
    await admin.from("generation_jobs").update({ params: replica ? { ...rest, replica } : rest }).eq("id", active.id);
    return true;
  }
  if (!replica) {
    // Wizard run with the toggle off: end the carried-over company look too.
    const latest = await latestJob(admin, userId);
    if (latest?.source === "mcp" && latest.params["replica"]) {
      const rest = { ...latest.params };
      delete rest["replica"];
      await admin.from("generation_jobs").update({ params: rest }).eq("id", latest.id);
    }
    return true;
  }
  const created = await createJob(admin, { userId, source: "mcp", resumeUploadId: resumeId, replica });
  return created.ok;
}
