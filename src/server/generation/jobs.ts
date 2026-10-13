import type { SupabaseClient } from "@supabase/supabase-js";

export type JobStatus = "queued" | "reading" | "writing" | "checking" | "saving" | "done" | "failed";
export type JobSource = "gemini" | "free" | "mcp";
export interface JobError {
  code: string;
  message: string;
  details?: string[];
  retryAfterSeconds?: number;
}
export interface JobRow {
  id: string;
  user_id: string;
  source: JobSource;
  status: JobStatus;
  message: string;
  error: JobError | null;
  retry_at: string | null;
  resume_upload_id: string | null;
  params: { instructions?: string };
  provider: string | null;
  created_at: string;
  updated_at: string;
}

/** A running job that hasn't moved for this long is dead (the function was cut off). */
export const STALE_AFTER_MS = 330_000;
/** Total time one run may take; the free chain stops starting new providers after this. */
export const RUN_BUDGET_MS = 270_000;

export const STATUS_MESSAGES: Record<JobStatus, string> = {
  queued: "Free capacity is used up for today. We'll run this when it resets.",
  reading: "Reading your resume…",
  writing: "Writing your portfolio. This takes 1–2 minutes…",
  checking: "Checking every fact against your resume…",
  saving: "Saving your portfolio…",
  done: "Your portfolio is ready!",
  failed: "Generation failed.",
};

const COLUMNS =
  "id, user_id, source, status, message, error, retry_at, resume_upload_id, params, provider, created_at, updated_at";

export function toApiJob(row: JobRow) {
  return {
    id: row.id,
    source: row.source,
    status: row.status,
    message: row.status === "failed" ? (row.error?.message ?? row.message) : row.message,
    error: row.error,
    retryAt: row.retry_at,
    updatedAt: row.updated_at,
  };
}

export async function createJob(
  admin: SupabaseClient,
  job: { userId: string; source: JobSource; resumeUploadId: string; instructions?: string | undefined },
): Promise<{ ok: true; job: JobRow } | { ok: false; activeJobId: string | null }> {
  const { data, error } = await admin
    .from("generation_jobs")
    .insert({
      user_id: job.userId,
      source: job.source,
      status: "reading",
      message: STATUS_MESSAGES.reading,
      resume_upload_id: job.resumeUploadId,
      params: job.instructions ? { instructions: job.instructions } : {},
    })
    .select(COLUMNS)
    .single();
  if (!error && data) return { ok: true, job: data as JobRow };

  // 23505 = the one-active-job-per-user index.
  const { data: active } = await admin
    .from("generation_jobs")
    .select("id")
    .eq("user_id", job.userId)
    .in("status", ["queued", "reading", "writing", "checking", "saving"])
    .maybeSingle();
  return { ok: false, activeJobId: active?.id ?? null };
}

export async function getJobById(admin: SupabaseClient, id: string): Promise<JobRow | null> {
  const { data } = await admin.from("generation_jobs").select(COLUMNS).eq("id", id).maybeSingle();
  return (data as JobRow | null) ?? null;
}

/** The user's job by id (or their newest), failing it first if it stopped moving. */
export async function getUserJob(admin: SupabaseClient, userId: string, id: string | "latest"): Promise<JobRow | null> {
  let query = admin.from("generation_jobs").select(COLUMNS).eq("user_id", userId);
  query = id === "latest" ? query.order("created_at", { ascending: false }).limit(1) : query.eq("id", id);
  const { data } = await query.maybeSingle();
  const row = (data as JobRow | null) ?? null;
  if (!row || !isStale(row)) return row;
  await failJob(admin, row.id, {
    code: "generation_timeout",
    message: "This took too long and was stopped. Please try again.",
  });
  return getJobById(admin, row.id);
}

/** A chat can take a while to write a page, so MCP jobs get longer before they count as dead. */
const MCP_STALE_AFTER_MS = 30 * 60_000;

export function isStale(row: JobRow, now = Date.now()): boolean {
  const limit = row.source === "mcp" ? MCP_STALE_AFTER_MS : STALE_AFTER_MS;
  return ["reading", "writing", "checking", "saving"].includes(row.status) && now - new Date(row.updated_at).getTime() > limit;
}

export async function setStatus(admin: SupabaseClient, id: string, status: JobStatus, extra: { provider?: string } = {}) {
  await admin
    .from("generation_jobs")
    .update({ status, message: STATUS_MESSAGES[status], retry_at: null, updated_at: new Date().toISOString(), ...extra })
    .eq("id", id);
}

export async function queueJob(admin: SupabaseClient, id: string, retryAt: Date) {
  await admin
    .from("generation_jobs")
    .update({ status: "queued", message: STATUS_MESSAGES.queued, retry_at: retryAt.toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function failJob(admin: SupabaseClient, id: string, error: JobError) {
  const now = new Date().toISOString();
  await admin
    .from("generation_jobs")
    .update({ status: "failed", message: error.message, error, retry_at: null, updated_at: now, finished_at: now })
    .eq("id", id)
    .in("status", ["queued", "reading", "writing", "checking", "saving"]);
}

export async function completeJob(admin: SupabaseClient, id: string) {
  const now = new Date().toISOString();
  await admin
    .from("generation_jobs")
    .update({ status: "done", message: STATUS_MESSAGES.done, error: null, retry_at: null, updated_at: now, finished_at: now })
    .eq("id", id);
}

/** Next 00:05 UTC: when the free providers' daily budgets reset. */
export function nextBudgetReset(now = new Date()): Date {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 5, 0));
  return next;
}

/** UTC calendar day used as the budget key. */
export function budgetDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
