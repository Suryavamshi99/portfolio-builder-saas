import { describe, expect, it } from "vitest";
import { STALE_AFTER_MS, budgetDay, isStale, nextBudgetReset, toApiJob, type JobRow } from "./jobs";

const row = (over: Partial<JobRow> = {}): JobRow => ({
  id: "j1",
  user_id: "u1",
  source: "free",
  status: "writing",
  message: "Writing your portfolio. This takes 1–2 minutes…",
  error: null,
  retry_at: null,
  resume_upload_id: "r1",
  params: {},
  provider: "groq",
  created_at: "2026-10-13T10:00:00.000Z",
  updated_at: "2026-10-13T10:00:00.000Z",
  ...over,
});

describe("generation jobs", () => {
  it("exposes only what the client needs", () => {
    const api = toApiJob(row({ user_id: "secret", provider: "groq", params: { instructions: "x" } }));
    expect(Object.keys(api).sort()).toEqual(["error", "id", "message", "retryAt", "source", "status", "updatedAt"]);
  });

  it("shows the failure message for a failed job", () => {
    const api = toApiJob(row({ status: "failed", message: "Generation failed.", error: { code: "x", message: "Specific reason" } }));
    expect(api.message).toBe("Specific reason");
  });

  it("calls a running job stale only after it stops moving", () => {
    const t = new Date("2026-10-13T10:00:00.000Z").getTime();
    expect(isStale(row(), t + STALE_AFTER_MS - 1000)).toBe(false);
    expect(isStale(row(), t + STALE_AFTER_MS + 1000)).toBe(true);
  });

  it("never calls queued or finished jobs stale", () => {
    const late = new Date("2026-10-20T00:00:00.000Z").getTime();
    for (const status of ["queued", "done", "failed"] as const) expect(isStale(row({ status }), late)).toBe(false);
  });

  it("resets budgets at 00:05 UTC the next day", () => {
    expect(nextBudgetReset(new Date("2026-10-13T23:59:00Z")).toISOString()).toBe("2026-10-14T00:05:00.000Z");
    expect(nextBudgetReset(new Date("2026-12-31T12:00:00Z")).toISOString()).toBe("2027-01-01T00:05:00.000Z");
    expect(budgetDay(new Date("2026-10-13T23:59:00Z"))).toBe("2026-10-13");
  });
});
