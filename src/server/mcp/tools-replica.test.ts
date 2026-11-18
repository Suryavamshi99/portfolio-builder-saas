import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  plan: "pro",
  saved: [] as Array<{ html: string }>,
  jobs: [] as Array<{ id: string; source: string; status: string; params: Record<string, unknown>; seq: number }>,
  seq: 0,
  capture: { ok: true, brand: { name: "Acme | Home", description: "", palette: ["#112233"], fonts: ["Inter"], voice: ["Build fast"], roles: {}, nav: ["Product", "About"], sections: ["Hero", "Features"], needsScreenshots: false } } as unknown,
  images: [] as unknown[],
}));

vi.mock("@/lib/supabase/env", () => ({ getSupabaseEnv: () => ({ url: "https://x.supabase.co" }) }));
vi.mock("@/server/users", () => ({
  getOrCreateAppUser: async () => ({ plan: state.plan, isAdmin: false }),
  hasPaidAccess: (u: { plan: string }) => u.plan === "pro",
}));
vi.mock("@/server/rate-limit", () => ({ checkHourlyRateLimit: async () => ({ limited: false }) }));
vi.mock("@/server/generations", () => ({ recordGeneration: async () => {} }));
vi.mock("@/server/portfolio-versions", () => ({
  savePortfolioVersion: async (_a: unknown, _u: string, v: { html: string }) => {
    state.saved.push(v);
    return { versionId: "v1", updatedAt: "now" };
  },
}));
vi.mock("@/server/brand/capture", () => ({ captureBrandFromUrl: async () => state.capture }));
vi.mock("@/server/generation/jobs", () => ({
  createJob: async (_a: unknown, job: { replica?: unknown; theme?: unknown }) => {
    const id = `j${++state.seq}`;
    state.jobs.push({ id, source: "mcp", status: "reading", seq: state.seq, params: { ...(job.replica ? { replica: job.replica } : {}), ...(job.theme ? { theme: job.theme } : {}) } });
    return { ok: true, job: { id } };
  },
  setStatus: async () => {},
  completeJob: async () => {
    for (const j of state.jobs) if (j.status !== "done") j.status = "done";
  },
}));

const RESUME = ["Jordan Ellis", "Product manager", "Harbourline Freight, Senior Product Manager, 2021 - Present", "Shipped a returns portal that cut support tickets by 38%", "jordan.ellis@example.com"].join("\n");
vi.mock("@/server/generation/prepare", () => ({
  prepareGeneration: async () => ({
    ok: true, userMessage: "USERDATA", referenceText: RESUME, resumeText: RESUME, specifics: undefined, designIntensity: "minimal", photoUrl: undefined, images: state.images, links: {},
  }),
}));

import { buildTools } from "./tools";
import { applyReplicaGuard } from "@/server/brand/replica-guard";

const admin = {
  from: (table: string) => {
    const eq: Record<string, unknown> = {};
    let statuses: string[] | null = null;
    let newest = false;
    let patch: { params?: Record<string, unknown> } | null = null;
    const rows = () => {
      let r = state.jobs.filter((j) => (eq["id"] === undefined || j.id === eq["id"]) && (statuses === null || statuses.includes(j.status)));
      if (newest) r = [...r].sort((a, b) => b.seq - a.seq);
      return r;
    };
    const chain: Record<string, unknown> = {};
    chain["select"] = () => chain;
    chain["eq"] = (k: string, v: unknown) => ((eq[k] = v), chain);
    chain["in"] = (_k: string, v: string[]) => ((statuses = v), chain);
    chain["order"] = () => ((newest = true), chain);
    chain["limit"] = () => chain;
    chain["update"] = (p: { params?: Record<string, unknown> }) => ((patch = p), chain);
    chain["then"] = (res: (v: unknown) => void) => {
      if (table === "generation_jobs" && patch?.params) for (const j of rows()) j.params = patch.params;
      res({});
    };
    chain["maybeSingle"] = async () => ({ data: table === "uploads" ? { id: "r1" } : (rows()[0] ?? null) });
    return chain;
  },
} as never;
const tools = buildTools({ admin, userId: "u1", origin: "https://app.example" });
const txt = (r: { content: Array<{ type: string; text?: string }> } | null) => r!.content.map((c) => c.text ?? "").join("\n");

const PAGE = (extra = "") =>
  `<!DOCTYPE html><html><head><title>Jordan Ellis</title><style>body{font-family:Inter}</style></head><body><main><h1>Jordan Ellis</h1><p>Product manager. Senior Product Manager at Harbourline Freight, 2021 - Present.</p>${extra}${"<p>Shipped a returns portal that cut support tickets by 38%</p>".repeat(3)}</main><footer>Contact jordan.ellis@example.com</footer></body></html>`;

beforeEach(() => {
  process.env["REPLICA_ENABLED"] = "true";
  state.plan = "pro";
  state.saved = [];
  state.jobs = [];
  state.images = [];
  state.capture = { ok: true, brand: { name: "Acme | Home", description: "", palette: ["#112233"], fonts: ["Inter"], voice: ["Build fast"], roles: {}, nav: ["Product", "About"], sections: ["Hero", "Features"], needsScreenshots: false } };
});

describe("company look through the connector", () => {
  it("returns the company brief on the FIRST get_portfolio_brief when the user opted in", async () => {
    state.jobs = [{ id: "j1", source: "mcp", status: "reading", seq: ++state.seq, params: { replica: { url: "https://acme.com/", company: "Acme" } } }];
    const t = txt(await tools.call("get_portfolio_brief", {}));
    expect(t).toMatch(/=== COMPANY LOOK/);
    expect(t).toMatch(/#112233/);
    expect(t).toContain("An independent concept by Jordan Ellis, not affiliated with Acme.");
    expect(t).toMatch(/do not build a generic/i);
    expect(t).toContain("USERDATA");
  });

  it("returns the normal brief without an opt-in", async () => {
    const t = txt(await tools.call("get_portfolio_brief", {}));
    expect(t).not.toMatch(/COMPANY LOOK/);
    expect(t).toContain("USERDATA");
  });

  it("tells Claude to use the company look instead of showing themes", async () => {
    state.jobs = [{ id: "j1", source: "mcp", status: "reading", seq: ++state.seq, params: { replica: { url: "https://acme.com/" } } }];
    expect(txt(await tools.call("list_portfolio_themes", {}))).toMatch(/get_portfolio_brief/);
  });

  it("refuses themed tools when a company look was chosen", async () => {
    state.jobs = [{ id: "j1", source: "mcp", status: "reading", seq: ++state.seq, params: { replica: { url: "https://acme.com/" } } }];
    const r = await tools.call("get_themed_brief", { themeId: "anything" });
    expect(r?.isError).toBe(true);
    expect(txt(r)).toMatch(/company look/);
    expect((await tools.call("build_themed_portfolio", { themeId: "x", facts: {} }))?.isError).toBe(true);
  });

  it("asks for screenshots when the site cannot be read, never a generic design", async () => {
    state.capture = { ok: false, message: "blocked" };
    state.jobs = [{ id: "j1", source: "mcp", status: "reading", seq: ++state.seq, params: { replica: { url: "https://acme.com/", company: "Acme" } } }];
    const t = txt(await tools.call("get_portfolio_brief", {}));
    expect(t).toMatch(/screenshots/);
    expect(t).toMatch(/Do NOT fall back to a generic/);
    expect(t).not.toContain("USERDATA");
  });

  it("builds from screenshots when the site is unreadable but the user uploaded some", async () => {
    state.capture = { ok: false, message: "blocked" };
    state.images = [{ base64Data: "AAAA", mimeType: "image/png" }];
    state.jobs = [{ id: "j1", source: "mcp", status: "reading", seq: ++state.seq, params: { replica: { url: "https://acme.com/" } } }];
    const r = await tools.call("get_portfolio_brief", {});
    expect(txt(r)).toMatch(/attached screenshots only/);
    expect(r!.content.some((c) => c.type === "image")).toBe(true);
  });

  it("gates on the paid plan and the feature flag", async () => {
    state.jobs = [{ id: "j1", source: "mcp", status: "reading", seq: ++state.seq, params: { replica: { url: "https://acme.com/" } } }];
    state.plan = "free";
    const paid = await tools.call("get_portfolio_brief", {});
    expect(paid?.isError).toBe(true);
    expect(txt(paid)).toMatch(/paid plan/);
    state.plan = "pro";
    process.env["REPLICA_ENABLED"] = "false";
    expect((await tools.call("get_portfolio_brief", {}))?.isError).toBe(true);
    expect((await tools.call("get_company_look", { url: "https://acme.com" }))?.isError).toBe(true);
  });

  it("get_company_look validates, records the request on the job and returns the brief", async () => {
    const bad = await tools.call("get_company_look", { url: "http://10.0.0.1/" });
    expect(bad?.isError).toBe(true);
    expect(state.jobs).toHaveLength(0);
    state.plan = "free";
    expect((await tools.call("get_company_look", { url: "https://acme.com" }))?.isError).toBe(true);
    state.plan = "pro";
    const ok = await tools.call("get_company_look", { url: "https://acme.com", company: "Acme" });
    expect(txt(ok)).toMatch(/=== COMPANY LOOK/);
    expect(state.jobs[0]?.params["replica"]).toMatchObject({ url: "https://acme.com/", company: "Acme" });
  });

  it("save with a company look adds the disclaimer and noindex and removes company-hosted images", async () => {
    state.jobs = [{ id: "j1", source: "mcp", status: "writing", seq: ++state.seq, params: { replica: { url: "https://acme.com/", company: "Acme" } } }];
    const r = await tools.call("save_portfolio_html", { html: PAGE('<img src="https://cdn.acme.com/logo.png" alt="x"><img src="https://x.supabase.co/storage/v1/object/public/mine.png" alt="me">') });
    expect(r?.isError).toBeFalsy();
    expect(txt(r)).toMatch(/disclaimer/);
    const html = state.saved[0]!.html;
    expect(html).toContain("An independent concept by Jordan Ellis, not affiliated with Acme.");
    expect(html).toMatch(/noindex/);
    expect(html).not.toContain("cdn.acme.com");
  });

  it("save without a company look is unchanged", async () => {
    const r = await tools.call("save_portfolio_html", { html: PAGE() });
    expect(r?.isError).toBeFalsy();
    expect(txt(r)).not.toMatch(/disclaimer/);
    expect(state.saved[0]!.html).not.toMatch(/independent concept|noindex/);
    expect(applyReplicaGuard("<html><head></head><body></body></html>", { name: "A B", company: "C", companyUrl: "" }).html).toMatch(/noindex/);
  });
});

describe("storeMcpReplica", () => {
  it("writes params.replica on a running connector job, clears it, and refuses another kind of build", async () => {
    const { storeMcpReplica } = await import("./replica-job");
    state.jobs = [{ id: "j1", source: "mcp", status: "writing", seq: ++state.seq, params: { theme: { id: "x" } } }];
    expect(await storeMcpReplica(admin, "u1", "r1", { url: "https://acme.com/" })).toBe(true);
    expect(state.jobs[0]!.params).toEqual({ replica: { url: "https://acme.com/" } });
    expect(await storeMcpReplica(admin, "u1", "r1", null)).toBe(true);
    expect(state.jobs[0]!.params).toEqual({});
    state.jobs = [{ id: "j2", source: "free", status: "writing", seq: ++state.seq, params: {} }];
    expect(await storeMcpReplica(admin, "u1", "r1", { url: "https://acme.com/" })).toBe(false);
    state.jobs = [];
    expect(await storeMcpReplica(admin, "u1", "r1", { url: "https://acme.com/" })).toBe(true);
    expect(state.jobs[0]).toMatchObject({ source: "mcp", params: { replica: { url: "https://acme.com/" } } });
  });
});

describe("company look carries over to revisions", () => {
  const optedIn = (source = "mcp", status = "done") => {
    state.jobs = [{ id: "old", source, status, seq: ++state.seq, params: source === "mcp" ? { replica: { url: "https://acme.com/", company: "Acme" } } : {} }];
  };
  const saveWithCompanyImage = () => tools.call("save_portfolio_html", { html: PAGE('<img src="https://cdn.acme.com/logo.png" alt="x">') });

  it("a revision after a completed replica build gets the guard and the brief", async () => {
    optedIn();
    expect(txt(await tools.call("get_portfolio_brief", {}))).toMatch(/=== COMPANY LOOK/);
    expect(state.jobs).toHaveLength(2);
    expect(state.jobs[1]!.params["replica"]).toMatchObject({ url: "https://acme.com/" });
    await saveWithCompanyImage();
    const html = state.saved[0]!.html;
    expect(html).toMatch(/independent concept/);
    expect(html).toMatch(/noindex/);
    expect(html).not.toContain("cdn.acme.com");
    // and the revision after that, too
    await saveWithCompanyImage();
    expect(state.saved[1]!.html).toMatch(/noindex/);
  });

  it("a later non-connector job means no company look", async () => {
    optedIn();
    state.jobs.push({ id: "free1", source: "free", status: "done", seq: ++state.seq, params: {} });
    expect(txt(await tools.call("get_portfolio_brief", {}))).not.toMatch(/COMPANY LOOK/);
    await tools.call("save_portfolio_html", { html: PAGE() });
    expect(state.saved[0]!.html).not.toMatch(/noindex/);
  });

  it("the wizard clearing the choice stops the carry-over", async () => {
    const { storeMcpReplica } = await import("./replica-job");
    optedIn();
    expect(await storeMcpReplica(admin, "u1", "r1", null)).toBe(true);
    expect(state.jobs[0]!.params["replica"]).toBeUndefined();
    expect(txt(await tools.call("get_portfolio_brief", {}))).not.toMatch(/COMPANY LOOK/);
    await tools.call("save_portfolio_html", { html: PAGE() });
    expect(state.saved[0]!.html).not.toMatch(/noindex/);
  });

  it("a user who never opted in is unaffected", async () => {
    state.jobs = [{ id: "old", source: "mcp", status: "done", seq: ++state.seq, params: {} }];
    await tools.call("get_portfolio_brief", {});
    expect(state.jobs[1]!.params).toEqual({});
    await tools.call("save_portfolio_html", { html: PAGE() });
    expect(state.saved[0]!.html).not.toMatch(/independent concept|noindex/);
  });
});
