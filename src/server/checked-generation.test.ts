import { describe, expect, it, vi } from "vitest";
import { finalizeWithFactCheck } from "./checked-generation";

const REFERENCE = "Jane Doe\nCut latency by 40% at Acme, 2019 to 2023";
const FINALIZE = {
  userId: "user-1",
  supabaseUrl: "https://project.supabase.co",
  links: {},
  referenceText: REFERENCE,
};
const page = (body: string) =>
  `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>b{}</style></head><body><nav><a href="#a">A</a></nav><section id="a">${body}</section></body></html>`;

const run = (firstReply: string, repair: (msg: string) => Promise<string>) =>
  finalizeWithFactCheck({
    firstReply,
    finalize: FINALIZE,
    originalUserMessage: "ORIGINAL BRIEF",
    repair,
    currentYear: 2026,
  });

describe("finalizeWithFactCheck", () => {
  it("returns the page without a repair call when every number is supported", async () => {
    const repair = vi.fn();
    const res = await run(page("<p>Cut latency by 40% (2019–2023)</p>"), repair);
    expect(res).toMatchObject({ ok: true, repaired: false });
    expect(repair).not.toHaveBeenCalled();
  });

  it("fails without a repair call when the first page is cut off", async () => {
    const repair = vi.fn();
    const res = await run(`<!DOCTYPE html><html><body><p>${"words ".repeat(60)}half a pa`, repair);
    expect(res).toEqual({ ok: false, reason: "invalid_output", details: ["The page was cut off before it finished."] });
    expect(repair).not.toHaveBeenCalled();
  });

  it("asks the same model once to fix the flagged claims, and accepts the fixed page", async () => {
    const repair = vi.fn().mockResolvedValue(page("<p>Cut latency by 40%</p>"));
    const res = await run(page("<p>Cut latency by 40% and grew revenue 35% with a team of 12</p>"), repair);

    expect(repair).toHaveBeenCalledTimes(1);
    const message = repair.mock.calls[0]![0] as string;
    expect(message).toContain("ORIGINAL BRIEF");
    expect(message).toContain('"35%"');
    expect(message).toContain('"12"');
    expect(message).toContain("grew revenue 35%");
    expect(res).toMatchObject({ ok: true, repaired: true });
    if (res.ok) expect(res.html).not.toContain("35%");
  });

  it("fails with the remaining claims when the fixed page still has unsupported numbers", async () => {
    const repair = vi.fn().mockResolvedValue(page("<p>Team of 12</p>"));
    const res = await run(page("<p>Team of 12, revenue up 35%</p>"), repair);
    expect(repair).toHaveBeenCalledTimes(1);
    expect(res).toEqual({
      ok: false,
      reason: "unsupported_claims",
      details: [`"12" isn't in your resume or your details.`],
    });
  });

  it("fails as invalid output when the fixed page is cut off", async () => {
    const res = await run(page("<p>revenue up 35%</p>"), async () => `<!DOCTYPE html><html><body><p>${"words ".repeat(60)}cut`);
    expect(res).toEqual({ ok: false, reason: "invalid_output", details: ["The page was cut off before it finished."] });
  });

  it("lets an error from the repair call propagate so the route can map it", async () => {
    const boom = new Error("provider down");
    await expect(run(page("<p>revenue up 35%</p>"), async () => Promise.reject(boom))).rejects.toBe(boom);
  });
});
