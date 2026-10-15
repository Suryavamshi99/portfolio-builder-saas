import { describe, expect, it, vi } from "vitest";

import type { FreeProvider } from "@/config/free-models";
import { findUnsupportedClaims } from "@/server/fact-check";
import { finalizeHtml } from "@/server/finalize-html";
import { LlmProviderError, LlmRateLimitError } from "@/server/llm";
import { assembleDocument, cleanFragment, linksHtml } from "./assemble";
import { cleanModelCss, defaultCss } from "./default-design";
import { runPipeline, type EngineDeps } from "./engine";
import { fallbackPlan, parsePlan, resumeLines, sliceFor } from "./plan";
import { emptyState, progressOf, stepsFor, type BuildInput, type PipelineState } from "./types";

const RESUME = `Jane Doe
Senior Software Engineer

Summary
Backend engineer focused on distributed systems.

Experience
Acme Corp, Senior Engineer, 2021 - 2024
- Cut API latency by 40%
- Led the migration to PostgreSQL

Projects
Pipeline - an ETL tool written in Python

Skills
Python, Go, PostgreSQL

Education
BSc Computer Science, State University`;

const input = (over: Partial<BuildInput> = {}): BuildInput => ({
  lines: resumeLines(RESUME),
  designIntensity: "minimal",
  links: { github: "https://github.com/janedoe" },
  ...over,
});

const P = (id: string): FreeProvider => ({
  id,
  label: id,
  baseUrl: "https://x.test/v1",
  apiKeyEnv: "K",
  model: `${id}-model`,
  supportsImages: false,
  maxOutputTokens: 1000,
  timeoutMs: 1000,
  dailyRequestBudget: 100,
});

const PLAN_JSON = JSON.stringify({
  name: "Jane Doe",
  headline: "Senior Software Engineer",
  tagline: "Backend engineer focused on distributed systems.",
  theme: {
    mood: "clean and calm",
    colors: { bg: "#FAFAF7", surface: "#FFFFFF", text: "#14161C", muted: "#5B6170", accent: "#3457E8", accent2: "#0E7490" },
    fonts: { display: "Inter", body: "Inter" },
  },
  sections: [
    { id: "about", title: "About", kind: "about", lines: [[4, 5]] },
    { id: "experience", title: "Experience", kind: "experience", lines: [[7, 10]] },
    { id: "skills", title: "Skills", kind: "skills", lines: [[15, 16]] },
  ],
});

const GOOD_CSS = `:root{--a:#3457E8}.wrap{max-width:1000px;margin:0 auto}.sec{padding:60px 0}.card{border:1px solid #ccc}.grid{display:grid;gap:16px}${".x{color:red}".repeat(60)}@media (max-width:768px){.grid{display:block}}`;

const sectionHtml = (id: string, body: string) => `<section id="${id}" class="sec"><div class="wrap"><h2 class="sec-title">${id}</h2>${body}</div></section>`;

/** A well-behaved model that answers each kind of request. */
function goodReply(user: string, sectionBody: (id: string) => string = (id) => `<p>Text for the ${id} section from the resume.</p>`): string {
  if (user.includes("Plan a portfolio website")) return PLAN_JSON;
  if (user.includes("Write the complete CSS")) return GOOD_CSS;
  if (user.includes("Write the hero section")) return `<section id="top" class="hero"><div class="wrap"><h1>Jane Doe</h1><p class="lead">Backend engineer focused on distributed systems.</p></div></section>`;
  const id = /<section id="([a-z0-9-]+)" class="sec">/.exec(user)?.[1] ?? "x";
  return sectionHtml(id, sectionBody(id));
}

function makeDeps(over: Partial<EngineDeps> = {}) {
  const saves: string[] = [];
  let t = 1_000_000;
  const deps: EngineDeps = {
    providers: [P("a"), P("b"), P("c")],
    call: vi.fn(async (_p, _s, user) => ({ text: goodReply(user), finishReason: "stop" })),
    claim: vi.fn(async () => true),
    cooldown: vi.fn(async () => {}),
    save: vi.fn(async (_s: PipelineState, message: string) => {
      saves.push(message);
      return true;
    }),
    finalize: (html) => finalizeHtml({ rawText: html, userId: "u1", supabaseUrl: "https://p.supabase.co", links: { github: "https://github.com/janedoe" }, referenceText: RESUME }),
    claims: (html) => findUnsupportedClaims(html, RESUME),
    sleep: vi.fn(async () => {}),
    now: () => (t += 10),
    ...over,
  };
  return { deps, saves };
}

const FAR = Number.MAX_SAFE_INTEGER;

describe("plan", () => {
  it("parses a good plan and cleans ids, kinds and line ranges", () => {
    const text = `Here you go:\n${JSON.stringify({
      ...JSON.parse(PLAN_JSON),
      sections: [
        { title: "About", kind: "about", lines: [[5, 4]] }, // reversed range is fixed
        { id: "about", title: "More about", kind: "weird", lines: [[1, 9999]] }, // duplicate id, unknown kind, range clamped
        { title: "Nothing", kind: "other", lines: [[900, 950]] }, // outside the resume: dropped
      ],
    })}`;
    const plan = parsePlan(text, input())!;
    expect(plan.sections.map((s) => s.id)).toEqual(["about", "about-2"]);
    expect(plan.sections[0]?.lines).toEqual([[4, 5]]);
    expect(plan.sections[1]?.kind).toBe("other");
    expect(plan.sections[1]?.lines[0]?.[1]).toBe(input().lines.length);
  });

  it("returns null for text that is not a usable plan", () => {
    expect(parsePlan("no json here", input())).toBeNull();
    expect(parsePlan("{broken", input())).toBeNull();
    expect(parsePlan(JSON.stringify({ name: "x", sections: [] }), input())).toBeNull();
  });

  it("replaces unreadable colours with the default theme", () => {
    const bad = JSON.parse(PLAN_JSON);
    bad.theme.colors = { ...bad.theme.colors, bg: "#FFFFFF", text: "#FEFEFE" };
    const plan = parsePlan(JSON.stringify(bad), input())!;
    expect(plan.theme.colors.text).not.toBe("#FEFEFE");
  });

  it("builds a plan from the resume's own headings when the model's plan is unusable", () => {
    const plan = fallbackPlan(input());
    expect(plan.name).toBe("Jane Doe");
    expect(plan.sections.map((s) => s.kind)).toEqual(["about", "experience", "projects", "skills", "education"]);
    const exp = plan.sections.find((s) => s.kind === "experience")!;
    expect(sliceFor(exp, input().lines)).toContain("Cut API latency by 40%");
    expect(sliceFor(exp, input().lines)).not.toContain("Pipeline");
  });

  it("still makes one section when the resume has no headings", () => {
    const plan = fallbackPlan(input({ lines: ["Jane Doe", "I build things."] }));
    expect(plan.sections).toHaveLength(1);
  });
});

describe("page parts", () => {
  it("cleanFragment keeps one section with our id and class and strips scripts and handlers", () => {
    const raw = "Sure!\n```html\n<section id=\"whatever\" class=\"x\"><div onclick=\"evil()\"><p>Hello there, this is long enough to count.</p></div><script>alert(1)</script></section>\n```";
    const out = cleanFragment(raw, "about", "sec")!;
    expect(out.startsWith('<section id="about" class="sec">')).toBe(true);
    expect(out).not.toMatch(/script|onclick/i);
  });

  it("cleanFragment rejects replies that are not a usable section", () => {
    expect(cleanFragment("just words", "a", "sec")).toBeNull();
    expect(cleanFragment('<section id="a"><p>hi</p></section>', "a", "sec")).toBeNull(); // too little text
    expect(cleanFragment('<section id="a"><p>This is a long enough sentence for sure.', "a", "sec")).toBeNull(); // never closed
  });

  it("cleanModelCss accepts a real stylesheet and rejects unsafe or incomplete ones", () => {
    expect(cleanModelCss(GOOD_CSS)).toBe(GOOD_CSS);
    expect(cleanModelCss("```css\n" + GOOD_CSS + "\n```")).toBe(GOOD_CSS);
    expect(cleanModelCss(GOOD_CSS + "body{background:url(https://evil.test/x.png)}")).toBeNull();
    expect(cleanModelCss("@import 'x';" + GOOD_CSS)).toBeNull();
    expect(cleanModelCss(GOOD_CSS.replace("@media (max-width:768px){.grid{display:block}}", ""))).toBeNull();
    expect(cleanModelCss(".wrap{}")).toBeNull();
  });

  it("assembles a page that passes the sanitiser, with anchors that match the sections", () => {
    const plan = parsePlan(PLAN_JSON, input())!;
    const frags: Record<string, string> = { hero: `<section id="top" class="hero"><div class="wrap"><h1>Jane Doe</h1></div></section>` };
    for (const s of plan.sections) frags[s.id] = sectionHtml(s.id, `<p>Text for ${s.id} section here.</p>`);
    const html = assembleDocument(plan, defaultCss(plan.theme, false), frags, input());
    for (const s of plan.sections) expect(html).toContain(`href="#${s.id}"`);
    const fin = finalizeHtml({ rawText: html, userId: "u1", supabaseUrl: "https://p.supabase.co", links: {}, referenceText: RESUME });
    expect(fin.ok).toBe(true);
    if (fin.ok) expect(fin.warnings.join(" ")).not.toMatch(/no <nav>|no <section>|in-page navigation|viewport/i);
  });

  it("escapes names and link labels", () => {
    expect(linksHtml({ other: [{ label: "<b>x</b>", url: 'https://e.test/?a="1"' }] })).not.toContain("<b>");
  });
});

describe("runPipeline", () => {
  it("builds a whole page in small steps and saves progress after each one", async () => {
    const { deps, saves } = makeDeps();
    const state = emptyState();
    const out = await runPipeline(deps, input(), state, FAR);
    expect(out.kind).toBe("done");
    if (out.kind !== "done") return;
    expect(state.fallbacks).toEqual([]);
    expect(state.planFallback).toBeUndefined();
    expect(state.done).toEqual(["plan", ...stepsFor(state.plan!)]);
    expect(deps.call).toHaveBeenCalledTimes(1 + 1 + 1 + 3); // plan, design, hero, three sections
    expect(out.html).toContain("Jane Doe");
    expect(out.warnings.join(" ")).not.toContain("simple mode");
    expect(saves[0]).toMatch(/planning/i);
    expect(saves.some((m) => m === "Writing: Experience")).toBe(true);
    expect(progressOf(state)).toEqual({ done: state.done.length, total: 1 + stepsFor(state.plan!).length });
  });

  it("uses the first (best) provider for every step and only moves on when it fails", async () => {
    const used: string[] = [];
    const { deps } = makeDeps({
      call: vi.fn(async (p, _s, user) => {
        used.push(p.id);
        return { text: goodReply(user), finishReason: "stop" };
      }),
    });
    await runPipeline(deps, input(), emptyState(), FAR);
    expect(new Set(used)).toEqual(new Set(["a"]));
  });

  it("uses a code-made plan when the model's plan is garbage, and still finishes", async () => {
    const { deps } = makeDeps({
      call: vi.fn(async (_p, _s, user) => ({ text: user.includes("Plan a portfolio website") ? "not json at all" : goodReply(user), finishReason: "stop" })),
    });
    const state = emptyState();
    const out = await runPipeline(deps, input(), state, FAR);
    expect(out.kind).toBe("done");
    expect(state.planFallback).toBe(true);
    if (out.kind === "done") expect(out.warnings.join(" ")).toContain("simple mode");
  });

  it("builds every part in code when the models keep failing after the plan, so a build always finishes", async () => {
    let first = true;
    const { deps } = makeDeps({
      call: vi.fn(async (_p, _s, user) => {
        if (first && user.includes("Plan a portfolio website")) {
          first = false;
          return { text: PLAN_JSON, finishReason: "stop" };
        }
        throw new LlmProviderError("provider down");
      }),
    });
    const state = emptyState();
    const out = await runPipeline(deps, input(), state, FAR);
    expect(out.kind).toBe("done");
    expect(state.cssFallback).toBe(true);
    expect(state.fallbacks.sort()).toEqual(["about", "experience", "hero", "skills"]);
    if (out.kind === "done") {
      expect(out.html).toContain("Cut API latency by 40%"); // the resume text itself
      expect(out.warnings.join(" ")).toContain("simple mode");
    }
    expect(deps.cooldown).toHaveBeenCalled();
  });

  it("puts a rate-limited provider on cooldown and moves to the next one", async () => {
    const calls: string[] = [];
    const { deps } = makeDeps({
      providers: [P("a"), P("b")],
      call: vi.fn(async (p, _s, user) => {
        calls.push(p.id);
        if (p.id === "a") throw new LlmRateLimitError("slow down", 42);
        return { text: goodReply(user), finishReason: "stop" };
      }),
    });
    const out = await runPipeline(deps, input(), emptyState(), FAR);
    expect(out.kind).toBe("done");
    expect(deps.cooldown).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }), 42);
    expect(calls.filter((c) => c === "b").length).toBeGreaterThan(0);
  });

  it("treats a reply cut off at the length limit as unusable and tries another provider", async () => {
    const { deps } = makeDeps({
      providers: [P("a"), P("b")],
      call: vi.fn(async (p, _s, user) => ({ text: goodReply(user), finishReason: p.id === "a" ? "length" : "stop" })),
    });
    const state = emptyState();
    await runPipeline(deps, input(), state, FAR);
    expect(state.log.some((l) => l.provider === "a" && l.note === "cut off")).toBe(true);
    expect(state.fallbacks).toEqual([]);
  });

  it("reports no capacity when no provider can be used for the plan", async () => {
    const { deps } = makeDeps({ claim: vi.fn(async () => false) });
    expect(await runPipeline(deps, input(), emptyState(), FAR)).toEqual({ kind: "no_capacity" });
    expect(deps.sleep).toHaveBeenCalledTimes(1); // waited once in case providers were only cooling down
  });

  it("redoes only the section with an unsupported number, and keeps the rest", async () => {
    const { deps } = makeDeps({
      call: vi.fn(async (_p, _s, user) => {
        const wrong = (id: string) => (id === "experience" && !user.includes("CORRECTION REQUIRED") ? "<p>Grew revenue 35% at Acme.</p>" : `<p>Text for the ${id} section.</p>`);
        return { text: goodReply(user, wrong), finishReason: "stop" };
      }),
    });
    const state = emptyState();
    const out = await runPipeline(deps, input(), state, FAR);
    expect(out.kind).toBe("done");
    expect(state.repaired).toBe(true);
    if (out.kind === "done") expect(out.html).not.toContain("35%");
    expect(state.fallbacks).toEqual([]); // the repair worked, no code-made part needed
  });

  it("rebuilds a section in code when the repair does not fix it, instead of failing the build", async () => {
    const { deps } = makeDeps({
      call: vi.fn(async (_p, _s, user) => ({ text: goodReply(user, (id) => (id === "experience" ? "<p>Grew revenue 35% at Acme.</p>" : "<p>Text from the resume here.</p>")), finishReason: "stop" })),
    });
    const state = emptyState();
    const out = await runPipeline(deps, input(), state, FAR);
    expect(out.kind).toBe("done");
    expect(state.fallbacks).toContain("experience");
    if (out.kind === "done") expect(out.html).not.toContain("35%");
  });

  it("yields at the deadline and a later run continues without redoing finished steps", async () => {
    const calls: string[] = [];
    let now = 1_000;
    const { deps } = makeDeps({
      now: () => now,
      call: vi.fn(async (_p, _s, user) => {
        calls.push(user.slice(0, 30));
        now += 60_000; // every call takes a minute
        return { text: goodReply(user), finishReason: "stop" };
      }),
    });
    const state = emptyState();
    const first = await runPipeline(deps, input(), state, now + 150_000);
    expect(first.kind).toBe("yield");
    const doneBefore = [...state.done];
    expect(doneBefore.length).toBeGreaterThan(0);
    const callsBefore = calls.length;

    const second = await runPipeline(deps, input(), JSON.parse(JSON.stringify(state)) as PipelineState, now + 10 * 60_000);
    expect(second.kind).toBe("done");
    // six model calls make a build here (plan, design, hero, three sections); only the unfinished ones are made again
    expect(calls.length - callsBefore).toBe(6 - doneBefore.length);
    expect(calls.slice(callsBefore).some((c) => c.includes("Plan a portfolio"))).toBe(false);
  });

  it("stops at once when another run has taken over the job", async () => {
    const { deps } = makeDeps({ save: vi.fn(async () => false) });
    expect(await runPipeline(deps, input(), emptyState(), FAR)).toEqual({ kind: "stopped" });
    expect(deps.call).not.toHaveBeenCalled();
  });
});
