import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAN_GENERATIONS_PER_HOUR } from "@/config/plans";
import { findUnsupportedClaims } from "@/server/fact-check";
import { finalizeHtml } from "@/server/finalize-html";
import { recordGeneration } from "@/server/generations";
import { GUARDRAIL_SYSTEM_PROMPT } from "@/server/llm";
import { savePortfolioVersion } from "@/server/portfolio-versions";
import { checkHourlyRateLimit } from "@/server/rate-limit";
import { getOrCreateAppUser, hasPaidAccess } from "@/server/users";
import { addWatermark } from "@/server/watermark";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { checkReplicaRequest, replicaEnabled, type ReplicaParams } from "@/server/brand/replica";
import { companyNameFor, resolveReplica, DISCLAIMER_TEXT } from "@/server/brand/replica-brief";
import { applyReplicaGuard, nameFromResume } from "@/server/brand/replica-guard";
import { activeMcpJob, activeReplica } from "./replica-job";
import { registry } from "@/server/themes/registry";
import { templatesEnabled } from "@/config/templates";
import { canUseTemplatesById } from "@/server/themes/audience";
import { checkThemeAccess } from "@/server/themes/gate";
import { getTemplate, renderTheme } from "@/server/themes/templates";
import { customisationsSchema, portfolioFactsSchema } from "@/server/themes/facts";
import { verifyFacts } from "@/server/themes/extract-facts";
import {
  AFTER_BUILD_GUIDANCE,
  CUSTOM_SHAPE,
  FACTS_SHAPE,
  FACT_RULES,
  MAX_CUSTOM_JSON_CHARS,
  MAX_FACTS_JSON_CHARS,
  THEME_ID_PATTERN,
  boundedObject,
  describeTheme,
  feelOf,
  verifiedLinks,
  withServerValues,
} from "./themed";
import { completeJob, createJob, setStatus, type JobError } from "@/server/generation/jobs";
import { prepareGeneration } from "@/server/generation/prepare";
import type { ToolContent, ToolDef, ToolResult, Tools } from "./rpc";

const MAX_HTML_CHARS = 600_000;
const ACTIVE = ["queued", "reading", "writing", "checking", "saving"];

export const SERVER_INSTRUCTIONS =
  "Shipfolio builds the user's personal portfolio website. COMPANY LOOK RULE: if the user opted into a company look (they chose it in the Shipfolio setup, or they explicitly ask in chat for a page that looks like a named company's website), the FIRST build must already follow that company's site (layout, colours, type feel, UI patterns) with the user's own details. Never build a generic or ready-made-look page first and wait to be corrected, and never ask the user to confirm the company look after the fact. If the user did not opt in, do not apply a company look, and never guess one from a company named in their resume. First step, always: call list_portfolio_themes. If it says the user already chose a company look, call get_portfolio_brief next and follow it. Otherwise show the user the looks in plain language and ask which one they want, or 'Custom' for a one-of-a-kind design. If they ask for a company's look instead, call get_company_look with the address they give. If they pick a look: call get_themed_brief with its id, write the curated text it asks for, and call build_themed_portfolio. If they pick Custom: call get_portfolio_brief, write the page it asks for, then call save_portfolio_html. After ANY build, give the user the Studio link and ask whether they want to keep it or change something (wording, colours and sections, a different look, or deeper edits), then do what they choose. Never paste the page HTML into the chat.";

export const TOOL_DEFS: ToolDef[] = [
  {
    name: "list_portfolio_themes",
    description:
      "Call this FIRST. Lists the ready-made looks (themes) for the user's portfolio and whether they can use each one. Show them to the user in plain language and ask which look they want, or 'Custom' for a one-of-a-kind design built from scratch. Do nothing else until they answer. If the result says the user already chose a company look, do not ask them to pick a look: follow its instructions and call get_portfolio_brief.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_themed_brief",
    description:
      "After the user picks a look from list_portfolio_themes: returns their resume text, verified links, the look's text slots and the strict rules. Write the curated facts it asks for, then call build_themed_portfolio. Not for 'Custom' (use get_portfolio_brief for that). Refused when the user chose a company look (use get_portfolio_brief); a ready-made look and a company look are never combined.",
    inputSchema: {
      type: "object",
      properties: {
        themeId: { type: "string", description: "The id of the look the user picked, from list_portfolio_themes." },
        instructions: { type: "string", description: "Optional: anything the user asked for, in their words (for example 'focus on my data work')." },
      },
      required: ["themeId"],
      additionalProperties: false,
    },
  },
  {
    name: "build_themed_portfolio",
    description:
      "Builds the page from your curated facts in the chosen look, checks it against the resume, and saves it. If it lists problems, fix exactly those and call it again. On success, tell the user the Studio link and ASK whether they want to keep it or change something. Do NOT paste HTML or the facts in the chat.",
    inputSchema: {
      type: "object",
      properties: {
        themeId: { type: "string", description: "The id of the chosen look." },
        facts: { type: "object", description: "The curated facts, in the shape get_themed_brief gave you.", additionalProperties: true },
        custom: { type: "object", description: "Optional look changes: accent colour, font style, hidden or reordered sections.", additionalProperties: true },
      },
      required: ["themeId", "facts"],
      additionalProperties: false,
    },
  },
  {
    name: "get_portfolio_brief",
    description:
      "For the 'Custom' choice, or when the user chose a company look in the Shipfolio setup (then the company look brief is the FIRST thing this returns, and your first build must follow it; never build generic first). Returns the rules, the user's resume text, links, preferences, photo URL and reference screenshots for building their portfolio. Write ONE complete HTML document and pass it to save_portfolio_html.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_company_look",
    description:
      "ONLY for when the user explicitly asks, in the conversation, for a page that looks like a named company's website, and gave you its address. Never call it because their resume mentions a company. Checks the request, records it, and returns the company look brief; your FIRST build must then follow that look with the user's own details, then call save_portfolio_html. Do not build a generic page first or ask the user to confirm the look afterwards.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The company's public website address, starting with https://." },
        company: { type: "string", description: "Optional: how to name the company in the disclaimer." },
      },
      required: ["url"],
      additionalProperties: false,
    },
  },
  {
    name: "save_portfolio_html",
    description:
      "Checks and saves the complete portfolio HTML document. If it lists problems, fix exactly those and call this tool again with the whole corrected page. For a company look build it also adds the independent-concept disclaimer and noindex itself. On success give the user the Studio link, then ask whether they want to keep it or change anything; do NOT paste the HTML in the chat.",
    inputSchema: {
      type: "object",
      properties: { html: { type: "string", description: "The complete HTML document, from <!DOCTYPE html> to </html>." } },
      required: ["html"],
      additionalProperties: false,
    },
  },
  {
    name: "get_portfolio_html",
    description:
      "Returns the user's current portfolio HTML so you can revise it (for example 'make the hero bolder'). Save the revised, complete page with save_portfolio_html. Do not paste the HTML in the chat.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

const text = (t: string, isError = false): ToolResult => ({ content: [{ type: "text", text: t }], ...(isError ? { isError: true } : {}) });

async function latestResumeId(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await admin
    .from("uploads")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "resume")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/** The user's running MCP job (kept alive while their chat works), or a new one; null if another kind is running. */
async function ensureMcpJob(admin: SupabaseClient, userId: string, resumeId: string, themeId?: string, replica?: ReplicaParams): Promise<string | null> {
  const { data: active } = await admin.from("generation_jobs").select("id, source, status, params").eq("user_id", userId).in("status", ACTIVE).maybeSingle();
  // A job parked in the queue (waiting for free capacity) doesn't block: createJob() replaces it.
  if (active && active.status !== "queued") {
    if (active.source !== "mcp") return null;
    const params = (active.params ?? {}) as Record<string, unknown>;
    const withoutTheme = { ...params };
    delete withoutTheme["theme"];
    const nextParams = replica ? { ...withoutTheme, replica } : themeId ? { ...params, theme: { id: themeId } } : params;
    await admin.from("generation_jobs").update({ error: null, ...(themeId || replica ? { params: nextParams } : {}) }).eq("id", active.id);
    await setStatus(admin, active.id, "writing");
    return active.id;
  }
  // A revision after a finished build keeps the user's company look until the wizard clears it.
  const carried = replica ?? (themeId ? null : await activeReplica(admin, userId));
  const created = await createJob(admin, { userId, source: "mcp", resumeUploadId: resumeId, ...(themeId ? { theme: { id: themeId } } : {}), ...(carried ? { replica: carried } : {}) });
  if (!created.ok) return null;
  await setStatus(admin, created.job.id, "writing");
  return created.job.id;
}

export function buildTools(ctx: { admin: SupabaseClient; userId: string; origin: string }): Tools {
  const { admin, userId, origin } = ctx;

  /** The company look the user opted into, checked again now (flag, paid), or a plain message when it can't be used. */
  async function replicaFor(replica: ReplicaParams | null): Promise<{ replica: ReplicaParams } | { error: ToolResult } | null> {
    if (!replica) return null;
    const check = checkReplicaRequest({ url: replica.url, ...(replica.company ? { company: replica.company } : {}) }, { enabled: replicaEnabled(), hasTheme: false });
    if (!check.ok) {
      return { error: text(`${check.message} The user chose a company look, so do NOT build a generic page instead. Tell the user this and ask how they want to continue.`, true) };
    }
    return { replica };
  }

  async function brief(replicaIn?: ReplicaParams): Promise<ToolResult> {
    const resumeId = await latestResumeId(admin, userId);
    if (!resumeId) return text(`The user hasn't uploaded a resume yet. Ask them to upload it at ${origin}/onboarding first, then try again.`, true);
    const gate = await replicaFor(replicaIn ?? (await activeReplica(admin, userId)));
    if (gate && "error" in gate) return gate.error;
    const replica = gate?.replica ?? null;
    const jobId = await ensureMcpJob(admin, userId, resumeId);
    if (!jobId) {
      return text("Another portfolio generation is already running for this user. Ask them to wait for it to finish, then try again.", true);
    }
    const prepared = await prepareGeneration(admin, userId, { resumeUploadId: resumeId });
    if (!prepared.ok) return text(prepared.message, true);

    let lookSection: string[] = [];
    if (replica) {
      const res = await resolveReplica(replica);
      if (res.needsImages && prepared.images.length === 0) {
        return text(
          [
            `The user chose the look of ${res.companyName}'s website, but Shipfolio could not read that site automatically.`,
            "Ask the user to attach screenshots of the site (home page and one more page) in this chat, or to upload up to 3 at " + `${origin}/onboarding, then build from those screenshots. Do NOT fall back to a generic or ready-made design, and do not write the page until you have screenshots.`,
            "",
            res.brief,
          ].join("\n"),
        );
      }
      if (!replica.brief) {
        const cached: ReplicaParams = { ...replica, ...(res.needsImages ? {} : { brief: res.brief, companyName: res.companyName, warnings: res.warnings, needsImages: false }) };
        if (!res.needsImages) {
          const job = await activeMcpJob(admin, userId);
          if (job) await admin.from("generation_jobs").update({ params: { ...job.params, replica: cached } }).eq("id", job.id);
        }
      }
      const disclaimer = DISCLAIMER_TEXT(nameFromResume(prepared.resumeText) || "a candidate", res.companyName);
      lookSection = [
        "=== COMPANY LOOK (the user chose this; your FIRST build must follow it) ===",
        `The user asked for a portfolio in the look of ${res.companyName}'s website. Follow this from your first draft: do not build a generic or ready-made-look page first, and do not ask the user to confirm the look afterwards.`,
        res.brief,
        res.needsImages ? "The site could not be read, so take the look from the attached screenshots only." : "",
        "Layout, colours, type feel and UI patterns come from the company; every word, name, date and number comes from the USER DATA below.",
        `Include this disclaimer text verbatim, at the top and in the footer: "${disclaimer}"`,
        "Shipfolio also adds the disclaimer and a noindex tag when you save, so do not worry about them being missing, but write them in anyway.",
        "",
      ];
    }

    const content: ToolContent[] = [
      {
        type: "text",
        text: [
          "You are building the user's personal portfolio website.",
          "1. Follow the RULES below. They are mandatory.",
          "2. Use the USER DATA below; the resume is the ONLY source of facts about the user.",
          "3. Write ONE complete HTML document (from <!DOCTYPE html> to </html>) with an inline <style> block and no external files except Google Fonts.",
          "4. Call save_portfolio_html with that complete document. Do NOT paste the HTML into this chat.",
          "5. If the tool lists problems, fix exactly those and call save_portfolio_html again with the whole corrected page.",
          "6. When it succeeds, reply with only the Studio link it gives you.",
          "",
          ...lookSection,
          "=== RULES ===",
          GUARDRAIL_SYSTEM_PROMPT,
          "",
          "=== USER DATA ===",
          prepared.userMessage,
        ].join("\n"),
      },
      ...prepared.images.map((i): ToolContent => ({ type: "image", data: i.base64Data, mimeType: i.mimeType })),
    ];
    return { content };
  }

  /** Chat-only opt-in: the user explicitly asked for a company's look. Same checks as the setup toggle. */
  async function companyLook(args: Record<string, unknown>): Promise<ToolResult> {
    const resumeId = await latestResumeId(admin, userId);
    if (!resumeId) return text(`The user hasn't uploaded a resume yet. Ask them to upload it at ${origin}/onboarding first, then try again.`, true);
    const raw = { url: args["url"], ...(args["company"] !== undefined && args["company"] !== null ? { company: args["company"] } : {}) };
    const check = checkReplicaRequest(raw, { enabled: replicaEnabled(), hasTheme: false });
    if (!check.ok) return text(`${check.message} Tell the user, and do not build a generic page instead without asking them.`, true);
    if (!(await ensureMcpJob(admin, userId, resumeId, undefined, check.replica))) {
      return text("Another portfolio generation is already running for this user. Ask them to wait for it to finish, then try again.", true);
    }
    return await brief(check.replica);
  }

  async function save(args: Record<string, unknown>): Promise<ToolResult> {
    const html = args["html"];
    if (typeof html !== "string" || html.length < 200) return text("html must be the complete HTML document as a string.", true);
    if (html.length > MAX_HTML_CHARS) return text("That page is too large. Make it smaller and try again.", true);

    const resumeId = await latestResumeId(admin, userId);
    if (!resumeId) return text(`The user hasn't uploaded a resume yet. Ask them to upload it at ${origin}/onboarding first.`, true);
    const appUser = await getOrCreateAppUser(admin, userId);
    if (!appUser) return text("Could not load the user's account.", true);
    const limit = await checkHourlyRateLimit(admin, "generations", userId, PLAN_GENERATIONS_PER_HOUR[appUser.plan]);
    if (limit.limited) return text(`The hourly limit was reached. Try again in about ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`, true);

    const jobId = await ensureMcpJob(admin, userId, resumeId);
    if (!jobId) return text("Another portfolio generation is already running for this user. Ask them to wait for it to finish.", true);
    await setStatus(admin, jobId, "checking");

    const prepared = await prepareGeneration(admin, userId, { resumeUploadId: resumeId, skipImages: true });
    if (!prepared.ok) return text(prepared.message, true);

    return await checkAndSave({ html, jobId, resumeId, prepared, retryTool: "save_portfolio_html", retryWhat: "the complete page" });
  }

  /** The checks and saving shared by every build: sanitise, fact-check, then save a version and finish the job. */
  async function checkAndSave(a: {
    html: string;
    jobId: string;
    resumeId: string;
    prepared: Extract<Awaited<ReturnType<typeof prepareGeneration>>, { ok: true }>;
    retryTool: string;
    retryWhat: string;
    successText?: (notes: string) => string;
  }): Promise<ToolResult> {
    const { jobId, resumeId, prepared } = a;
    const problems = async (error: JobError) => {
      await admin
        .from("generation_jobs")
        .update({ status: "writing", message: "Your chat is fixing a few things…", error, updated_at: new Date().toISOString() })
        .eq("id", jobId);
    };

    // A company look: disclaimer, noindex and no company-hosted graphics first, then the same checks as any page.
    const replica = await activeReplica(admin, userId);
    let rawHtml = a.html;
    let company = "";
    if (replica) {
      company = replica.companyName ?? companyNameFor(replica);
      rawHtml = applyReplicaGuard(a.html, { name: nameFromResume(prepared.resumeText), company, companyUrl: replica.url }).html;
    }
    const final = finalizeHtml({
      rawText: rawHtml,
      userId,
      supabaseUrl: getSupabaseEnv().url,
      links: prepared.links,
      referenceText: prepared.referenceText,
    });
    if (!final.ok) {
      await problems({ code: "generation_invalid_output", message: "The page didn't pass our checks.", details: final.errors });
      return text(`The page can't be saved yet. Fix these and call ${a.retryTool} again with ${a.retryWhat}:\n- ${final.errors.join("\n- ")}`, true);
    }
    const claims = findUnsupportedClaims(final.html, replica ? `${prepared.referenceText}\n${company}` : prepared.referenceText);
    if (claims.length > 0) {
      const details = claims.map((c) => c.message);
      await problems({ code: "generation_unsupported_claims", message: "The page includes facts that aren't in the resume.", details });
      return text(
        `These numbers or dates are not in the user's resume or details. Remove them or replace them with what the resume says, then call ${a.retryTool} again with ${a.retryWhat}:\n- ${details.join("\n- ")}`,
        true,
      );
    }

    await setStatus(admin, jobId, "saving");
    await savePortfolioVersion(admin, userId, { html: final.html, source: "mcp", model: null, warnings: final.warnings });
    await recordGeneration(admin, userId, resumeId, "succeeded");
    await completeJob(admin, jobId);
    const notes = final.warnings.length > 0 ? `\nNotes: ${final.warnings.join(" ")}` : "";
    if (a.successText) return text(a.successText(notes));
    const guardNote = replica ? `\nShipfolio added the "independent concept, not affiliated with ${company}" disclaimer (top and footer) and a noindex tag, and removed any graphics hosted by the company. Do not add or remove them.` : "";
    return text(`Saved. The user can open it in Studio: ${origin}/studio${guardNote}\nGive the user that link, then ask whether they want to keep it or change anything (you can revise it with get_portfolio_html and save_portfolio_html). Do not paste the HTML.${notes}`);
  }

  async function listThemes(): Promise<ToolResult> {
    const chosen = await activeReplica(admin, userId);
    if (chosen) {
      const company = chosen.company ?? companyNameFor(chosen);
      return text(`The user already chose to have their portfolio look like ${company}'s website (their choice in the Shipfolio setup). Do not show ready-made looks and do not ask which look they want. Call get_portfolio_brief now; your FIRST build must follow that company's look with the user's own details.`);
    }
    const appUser = await getOrCreateAppUser(admin, userId);
    if (!appUser) return text("Could not load the user's account.", true);
    if (!templatesEnabled()) {
      return text(
        [
          "Ready-made looks are switched off right now. Do not show or offer any ready-made look.",
          "Tell the user in one friendly line that their portfolio will be a one-of-a-kind custom design, then call get_portfolio_brief now. (If they ask for a particular company's look, call get_company_look; that is open to everyone.)",
        ].join("\n"),
      );
    }
    if (!(await canUseTemplatesById(admin, userId, appUser.isAdmin))) {
      return text(
        [
          "Ready-made looks are only for Masters' Union students (a verified @mastersunion.org account), and this account is not one. Do not show or offer any ready-made look.",
          "Tell the user in one friendly line that their portfolio will be a one-of-a-kind custom design, then call get_portfolio_brief now. (If they ask for a particular company's look, call get_company_look; that is open to everyone.)",
        ].join("\n"),
      );
    }
    const paid = hasPaidAccess(appUser);
    const lines: string[] = [];
    for (const theme of registry.list()) {
      const template = getTemplate(theme.id);
      if (!template) continue;
      lines.push(describeTheme(theme, template, checkThemeAccess(theme.id, paid, true).ok));
    }
    return text(
      [
        "These are the ready-made looks for the user's portfolio. The user's own details fill each one.",
        "",
        ...lines,
        "",
        "- Custom: a one-of-a-kind design written just for them (no ready-made look).",
        "",
        "NEXT STEP FOR YOU: show the user these looks in plain, friendly words (name, what it suits, how it feels, and which they can use) and ask the user which look they want, or Custom. Do nothing else until they answer.",
        "If they pick a look they can use: call get_themed_brief with its id. If they pick Custom: call get_portfolio_brief. If they pick a look marked 'needs the paid plan', explain that and offer a free look or Custom.",
      ].join("\n"),
    );
  }

  /** Validates the theme id and checks the user may use it and that it has a template. */
  async function themeFor(args: Record<string, unknown>) {
    const id = args["themeId"];
    if (typeof id !== "string" || !THEME_ID_PATTERN.test(id)) return { error: text("themeId must be one of the ids from list_portfolio_themes.", true) } as const;
    const appUser = await getOrCreateAppUser(admin, userId);
    if (!appUser) return { error: text("Could not load the user's account.", true) } as const;
    const access = checkThemeAccess(id, hasPaidAccess(appUser), await canUseTemplatesById(admin, userId, appUser.isAdmin));
    if (!access.ok) {
      const msg = access.code === "templates_disabled"
        ? "Ready-made looks are switched off right now. Tell the user, and build a Custom design with get_portfolio_brief instead."
        : access.code === "templates_muy_only"
        ? "Ready-made looks are only for Masters' Union students and this account is not one. Tell the user, and build a Custom design with get_portfolio_brief instead."
        : access.code === "theme_requires_pro"
        ? "That look is part of the paid plan and this account is on the free plan. Tell the user, and offer a free look from list_portfolio_themes or Custom."
        : "That look isn't available. Call list_portfolio_themes and ask the user to pick one of those.";
      return { error: text(msg, true) } as const;
    }
    const theme = registry.get(id);
    const template = getTemplate(id);
    if (!theme || !template) return { error: text("That look can't be built here yet. Ask the user to pick another look or Custom.", true) } as const;
    return { id, theme, template, appUser } as const;
  }

  const COMPANY_LOOK_CHOSEN =
    "The user chose a company look, so a ready-made look is not used with it. Do not show or pick a look. Call get_portfolio_brief now and build the page in the company's look on the first try.";

  async function themedBrief(args: Record<string, unknown>): Promise<ToolResult> {
    if (await activeReplica(admin, userId)) return text(COMPANY_LOOK_CHOSEN, true);
    const t = await themeFor(args);
    if ("error" in t) return t.error;
    const instructions = typeof args["instructions"] === "string" ? args["instructions"].trim().slice(0, 2000) : "";
    const resumeId = await latestResumeId(admin, userId);
    if (!resumeId) return text(`The user hasn't uploaded a resume yet. Ask them to upload it at ${origin}/onboarding first, then try again.`, true);
    if (!(await ensureMcpJob(admin, userId, resumeId, t.id))) {
      return text("Another portfolio generation is already running for this user. Ask them to wait for it to finish, then try again.", true);
    }
    const prepared = await prepareGeneration(admin, userId, { resumeUploadId: resumeId, skipImages: true });
    if (!prepared.ok) return text(prepared.message, true);
    const links = verifiedLinks(prepared.links);

    return text(
      [
        `You are writing the text for the user's portfolio in the "${t.theme.name}" look. Shipfolio puts your text into the look's ready-made layout, so you only write the content, never HTML.`,
        "",
        "STEPS",
        "1. Read the RESUME and EXTRA DETAILS below. They are the only source of facts.",
        "2. Write the facts as one JSON object in the SHAPE below, with text that fits the slots.",
        "3. Call build_themed_portfolio with themeId and facts (and `custom` only if the user asked for colour, font or section changes).",
        "4. If it lists problems, fix exactly those and call it again. If it says some facts were left out, that is fine unless the user needs them.",
        "5. When it succeeds, follow the instructions it gives you: tell the user the link and ask whether they want to keep it or change anything.",
        "",
        "RULES (mandatory)",
        ...FACT_RULES.map((r) => `- ${r}`),
        "",
        `THE LOOK: ${t.theme.name}. ${t.theme.tagline} Suits ${t.theme.profession}. Tone and feel: ${feelOf(t.theme)}`,
        `Sections this look can show: ${t.template.sections.join(", ")}. Write only sections the resume supports; the look hides empty ones.`,
        "Aim for punchy, concrete wording; keep each field under its limit.",
        "",
        "FACTS SHAPE (JSON; leave out any field or list you have no source for)",
        FACTS_SHAPE,
        "",
        "CUSTOM SHAPE (optional, only when the user asks)",
        CUSTOM_SHAPE,
        "",
        ...(instructions ? ["THE USER ASKED FOR (still only use resume facts)", instructions, ""] : []),
        "VERIFIED LINKS (the server adds these itself; copy none of them into your facts)",
        links.length > 0 ? links.map((l) => `- ${l.label}: ${l.url}`).join("\n") : "(none)",
        "",
        "=== RESUME ===",
        prepared.resumeText,
        "",
        "=== EXTRA DETAILS FROM THE USER ===",
        prepared.specifics ?? "(none)",
      ].join("\n"),
    );
  }

  async function buildThemed(args: Record<string, unknown>): Promise<ToolResult> {
    if (await activeReplica(admin, userId)) return text(COMPANY_LOOK_CHOSEN, true);
    const t = await themeFor(args);
    if ("error" in t) return t.error;
    const factsIn = boundedObject(args["facts"], MAX_FACTS_JSON_CHARS);
    if (!factsIn) return text("facts must be a JSON object in the shape get_themed_brief gave you, and under 200 KB.", true);

    let custom = customisationsSchema.parse({});
    if (args["custom"] !== undefined && args["custom"] !== null) {
      const raw = boundedObject(args["custom"], MAX_CUSTOM_JSON_CHARS);
      const parsed = raw ? customisationsSchema.strict().safeParse(raw) : null;
      if (!parsed || !parsed.success) {
        return text(`custom isn't valid. Use only these settings, or leave custom out:\n${CUSTOM_SHAPE}`, true);
      }
      custom = parsed.data;
    }

    const resumeId = await latestResumeId(admin, userId);
    if (!resumeId) return text(`The user hasn't uploaded a resume yet. Ask them to upload it at ${origin}/onboarding first.`, true);
    const limit = await checkHourlyRateLimit(admin, "generations", userId, PLAN_GENERATIONS_PER_HOUR[t.appUser.plan]);
    if (limit.limited) return text(`The hourly limit was reached. Try again in about ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`, true);

    const jobId = await ensureMcpJob(admin, userId, resumeId, t.id);
    if (!jobId) return text("Another portfolio generation is already running for this user. Ask them to wait for it to finish.", true);
    await setStatus(admin, jobId, "checking");

    // Not skipping images: the photo link is needed. The server, not the model, decides the photo and the links.
    const prepared = await prepareGeneration(admin, userId, { resumeUploadId: resumeId });
    if (!prepared.ok) return text(prepared.message, true);

    const verified = verifyFacts(factsIn, { resumeText: prepared.resumeText, ...(prepared.specifics ? { specifics: prepared.specifics } : {}), links: prepared.links });
    const facts = withServerValues(verified.facts, prepared.links, prepared.photoUrl);
    const droppedList = verified.dropped.length > 0 ? `\nLeft out because the resume doesn't support them:\n- ${verified.dropped.join("\n- ")}` : "";

    const checked = portfolioFactsSchema.safeParse(facts);
    if (!checked.success) {
      const issues = checked.error.issues.slice(0, 10).map((i) => `${i.path.join(".") || "facts"}: ${i.message}`);
      return text(`The facts don't fit the look yet. Fix these and call build_themed_portfolio again:\n- ${issues.join("\n- ")}${droppedList}`, true);
    }

    let html: string;
    try {
      html = renderTheme(t.id, checked.data, custom);
    } catch (e) {
      console.warn("MCP theme render failed", t.id, e instanceof Error ? e.message : e);
      return text("This look couldn't be built from those facts. Check them against the shape and try again, or ask the user to pick another look.", true);
    }

    // Numbers in the page must be in the resume or details (the curated facts are not a reference of their own).
    const result = await checkAndSave({
      html,
      jobId,
      resumeId,
      prepared,
      retryTool: "build_themed_portfolio",
      retryWhat: "the corrected facts",
      successText: (notes) => `${AFTER_BUILD_GUIDANCE.replace("{LINK}", `${origin}/studio`)}${droppedList}${notes}`,
    });
    if (result.isError && droppedList) {
      const first = result.content[0];
      if (first && first.type === "text") first.text += droppedList;
    }
    return result;
  }

  async function current(): Promise<ToolResult> {
    const { data } = await admin.from("portfolios").select("generated_html").eq("user_id", userId).maybeSingle();
    if (!data?.generated_html) return text("There is no portfolio yet. Call get_portfolio_brief to build one.", true);
    const appUser = await getOrCreateAppUser(admin, userId);
    const html = appUser && hasPaidAccess(appUser) ? data.generated_html : addWatermark(data.generated_html);
    return text(html);
  }

  return {
    list: TOOL_DEFS,
    call: async (name, args) => {
      try {
        if (name === "list_portfolio_themes") return await listThemes();
        if (name === "get_themed_brief") return await themedBrief(args);
        if (name === "build_themed_portfolio") return await buildThemed(args);
        if (name === "get_portfolio_brief") return await brief();
        if (name === "get_company_look") return await companyLook(args);
        if (name === "save_portfolio_html") return await save(args);
        if (name === "get_portfolio_html") return await current();
        return null;
      } catch (e) {
        console.error("MCP tool failed", name, e instanceof Error ? e.message : e);
        return text("Something went wrong on our side. Try again in a moment.", true);
      }
    },
  };
}
