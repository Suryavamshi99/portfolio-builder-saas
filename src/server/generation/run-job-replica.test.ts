import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  job: null as unknown,
  failJob: vi.fn(async (..._args: unknown[]) => {}),
  capture: vi.fn(),
  images: [] as unknown[],
}));

vi.mock("./jobs", () => ({
  getJobById: async () => m.job,
  setStatus: async () => {},
  failJob: m.failJob,
  completeJob: async () => {},
  queueJob: async () => {},
  budgetDay: () => "2026-01-01",
  nextBudgetReset: () => new Date(),
}));
vi.mock("./prepare", () => ({
  prepareGeneration: async () => ({
    ok: true, userMessage: "", referenceText: "Ada", resumeText: "Ada Lovelace", specifics: undefined,
    designIntensity: "minimal", photoUrl: undefined, images: m.images, links: {},
  }),
}));
vi.mock("@/server/brand/capture", () => ({ captureBrandFromUrl: m.capture }));
vi.mock("@/server/generations", () => ({ recordGeneration: async () => {} }));
vi.mock("@/lib/supabase/env", () => ({ getSupabaseEnv: () => ({ url: "https://x.supabase.co" }) }));

import { runJob } from "./run-job";

const admin = { from: () => ({ update: () => ({ eq: async () => ({}) }) }) } as never;
const job = (source: "free" | "gemini") => ({
  id: "j1", user_id: "u1", source, status: "reading", message: "", error: null, retry_at: null, resume_upload_id: "r1",
  params: { replica: { url: "https://www.acme.com/", company: "Acme" } }, provider: null, created_at: "", updated_at: "",
});

describe("runJob with a replica", () => {
  beforeEach(() => {
    m.failJob.mockClear();
    m.images = [];
    m.capture.mockResolvedValue({ ok: false, message: "blocked" });
  });

  it("fails a free build with the plain message when the site can't be read", async () => {
    m.job = job("free");
    await runJob(admin, "j1");
    expect(m.failJob).toHaveBeenCalledWith(admin, "j1", {
      code: "replica_unreadable",
      message: "This site could not be read. Use your own Gemini key or Claude/ChatGPT so we can use your screenshots, or check the address.",
    });
  });

  it("fails a free build even when screenshots exist (free models can't see them)", async () => {
    m.job = job("free");
    m.images = [{ mimeType: "image/png", base64Data: "x" }];
    await runJob(admin, "j1");
    expect(m.failJob.mock.calls[0]?.[2]).toMatchObject({ code: "replica_unreadable" });
  });

  it("asks a Gemini build without screenshots to add some", async () => {
    m.job = job("gemini");
    await runJob(admin, "j1");
    expect(m.failJob.mock.calls[0]?.[2]).toMatchObject({ code: "replica_unreadable", message: expect.stringContaining("Add up to 3 screenshots") });
  });
});
