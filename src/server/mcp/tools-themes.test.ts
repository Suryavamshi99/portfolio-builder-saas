import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ email: "student@mastersunion.org", plan: "free", saved: [] as Array<{ html: string }>, jobs: [] as unknown[] }));

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
vi.mock("@/server/generation/jobs", () => ({
  createJob: async (_a: unknown, job: unknown) => {
    state.jobs.push(job);
    return { ok: true, job: { id: "j1" } };
  },
  setStatus: async () => {},
  completeJob: async () => {},
}));

const RESUME = [
  "Jordan Ellis",
  "Product manager",
  "Harbourline Freight, Senior Product Manager, 2021 - Present",
  "Shipped a returns portal that cut support tickets by 38%",
  "Led a team of 12",
  "University of Leeds, BSc Business Information Systems, 2014 - 2017",
  "jordan.ellis@example.com",
].join("\n");
const LINKS = { linkedin: "https://www.linkedin.com/in/jordan-ellis-example" };
vi.mock("@/server/generation/prepare", () => ({
  prepareGeneration: async () => ({
    ok: true,
    userMessage: "x",
    referenceText: `${RESUME}\nhttps://www.linkedin.com/in/jordan-ellis-example`,
    resumeText: RESUME,
    specifics: undefined,
    designIntensity: "minimal",
    photoUrl: "data:image/png;base64,AAAA",
    images: [],
    links: LINKS,
  }),
}));

import { buildTools, TOOL_DEFS, SERVER_INSTRUCTIONS } from "./tools";
import { registry } from "@/server/themes/registry";
import { templateIds } from "@/server/themes/templates";

// uploads has a resume; no job is running.
const admin = {
  auth: { admin: { getUserById: async () => ({ data: { user: { email: state.email, email_confirmed_at: "2026-01-01T00:00:00Z" } } }) } },
  from: (table: string) => {
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "order", "limit", "update"]) chain[m] = () => chain;
    chain["maybeSingle"] = async () => ({ data: table === "uploads" ? { id: "r1" } : null });
    return chain;
  },
} as never;
const tools = buildTools({ admin, userId: "u1", origin: "https://app.example" });
const txt = (r: { content: Array<{ type: string; text?: string }> } | null) => r!.content.map((c) => c.text ?? "").join("\n");

const free = registry.list().find((t) => t.tier === "free" && templateIds().includes(t.id))!;
const paid = registry.list().find((t) => t.tier === "paid" && templateIds().includes(t.id))!;
const goodFacts = () => ({
  name: "Jordan Ellis",
  headline: "Product manager",
  email: "jordan.ellis@example.com",
  experience: [{ org: "Harbourline Freight", role: "Senior Product Manager", period: "2021 - Present", bullets: ["Shipped a returns portal that cut support tickets by 38%"] }],
  education: [{ school: "University of Leeds", degree: "BSc Business Information Systems", period: "2014 - 2017" }],
});

beforeEach(() => {
  state.email = "student@mastersunion.org";
  state.plan = "free";
  state.saved = [];
  state.jobs = [];
});

describe("themed MCP tools", () => {
  it("exposes the themed, company look and existing tools", () => {
    expect(TOOL_DEFS.map((t) => t.name)).toEqual([
      "list_portfolio_themes",
      "get_themed_brief",
      "build_themed_portfolio",
      "get_portfolio_brief",
      "get_company_look",
      "save_portfolio_html",
      "get_portfolio_html",
    ]);
    expect(SERVER_INSTRUCTIONS).toMatch(/list_portfolio_themes/);
    expect(SERVER_INSTRUCTIONS).toMatch(/Custom/);
  });

  it("lists themes with can-use false for a paid theme on a free account, and asks the user to choose", async () => {
    const out = txt(await tools.call("list_portfolio_themes", {}));
    const block = out.split("\n- ").find((b) => b.includes(`id: ${paid.id}`))!;
    expect(block).toMatch(/can use it: no/);
    expect(out.split("\n- ").find((b) => b.includes(`id: ${free.id}`))).toMatch(/can use it: yes/);
    expect(out).toMatch(/Custom/);
    expect(out).toMatch(/ask the user which look/);
    state.plan = "pro";
    expect(txt(await tools.call("list_portfolio_themes", {}))).not.toMatch(/can use it: no/);
  });

  it("shows no ready-made look to an account outside Masters' Union and sends the chat to Custom", async () => {
    state.email = "someone@gmail.com";
    const out = txt(await tools.call("list_portfolio_themes", {}));
    expect(out).toMatch(/only for Masters' Union/);
    expect(out).toMatch(/get_portfolio_brief/);
    expect(out).not.toContain(`id: ${free.id}`);
    const refused = await tools.call("get_themed_brief", { themeId: free.id });
    expect(refused?.isError).toBe(true);
    expect(txt(refused)).toMatch(/Masters' Union/);
    expect(state.jobs).toHaveLength(0);
    const build = await tools.call("build_themed_portfolio", { themeId: free.id, facts: goodFacts() });
    expect(build?.isError).toBe(true);
    expect(state.saved).toHaveLength(0);
  });

  it("get_themed_brief rejects unknown and gated themes, and stores the theme on the job", async () => {
    for (const themeId of [undefined, 5, "nope", "../x"]) expect((await tools.call("get_themed_brief", { themeId }))?.isError).toBe(true);
    const gated = await tools.call("get_themed_brief", { themeId: paid.id });
    expect(gated?.isError).toBe(true);
    expect(state.jobs).toHaveLength(0);
    const ok = await tools.call("get_themed_brief", { themeId: free.id, instructions: "focus on logistics" });
    expect(ok?.isError).toBeFalsy();
    const t = txt(ok);
    expect(t).toMatch(/build_themed_portfolio/);
    expect(t).toMatch(/Never change names/);
    expect(t).toMatch(/=== RESUME ===/);
    expect(t).toContain("focus on logistics");
    expect(state.jobs[0]).toMatchObject({ source: "mcp", theme: { id: free.id } });
  });

  it("build rejects a gated theme, bad facts and invalid custom", async () => {
    expect((await tools.call("build_themed_portfolio", { themeId: paid.id, facts: goodFacts() }))?.isError).toBe(true);
    expect((await tools.call("build_themed_portfolio", { themeId: free.id, facts: "nope" }))?.isError).toBe(true);
    expect((await tools.call("build_themed_portfolio", { themeId: free.id, facts: { name: "x", pad: "y".repeat(210_000) } }))?.isError).toBe(true);
    for (const custom of [{ accent: "red" }, { evil: 1 }, { hidden: ["nope"] }, "x"]) {
      const r = await tools.call("build_themed_portfolio", { themeId: free.id, facts: goodFacts(), custom });
      expect(r?.isError, JSON.stringify(custom)).toBe(true);
    }
    expect(state.saved).toHaveLength(0);
  });

  it("drops an invented number from the page, and tells the model what to fix", async () => {
    const facts = goodFacts();
    facts.experience[0]!.bullets = ["Cut support tickets by 87% across 41 markets"];
    const r = await tools.call("build_themed_portfolio", { themeId: free.id, facts });
    const t = txt(r);
    expect(state.saved.every((s) => !s.html.includes("87%"))).toBe(true);
    expect(t).toMatch(/Left out because the resume doesn't support them/);
    expect(t).toContain("87%");
  });

  it("takes photo and links from the server, ignoring the model's", async () => {
    const facts = { ...goodFacts(), photoUrl: "https://evil.example/p.png", links: [{ label: "Me", url: "https://evil.example" }] };
    const r = await tools.call("build_themed_portfolio", { themeId: free.id, facts });
    expect(r?.isError).toBeFalsy();
    const html = state.saved[0]!.html;
    expect(html).not.toContain("evil.example");
    expect(html).toContain("linkedin.com/in/jordan-ellis-example");
  });

  it("on success returns the Studio link and asks the user whether to change anything", async () => {
    const r = await tools.call("build_themed_portfolio", { themeId: free.id, facts: goodFacts(), custom: { accent: "#336699" } });
    expect(r?.isError).toBeFalsy();
    const t = txt(r);
    expect(t).toContain("https://app.example/studio");
    expect(t).toMatch(/ASK the user/);
    expect(t).toMatch(/keep this page as it is or change anything/);
    expect(t).toMatch(/build_themed_portfolio again/);
    expect(t).toMatch(/list_portfolio_themes/);
    expect(t).toMatch(/get_portfolio_html/);
    expect(t).toMatch(/Do not paste/);
    expect(state.saved).toHaveLength(1);
  });

  it("keeps the Custom flow tools working as before", async () => {
    const res = await tools.call("save_portfolio_html", { html: "<html></html>" });
    expect(res?.isError).toBe(true);
    expect(TOOL_DEFS.find((t) => t.name === "get_portfolio_brief")!.description).toMatch(/Custom/);
  });
});
