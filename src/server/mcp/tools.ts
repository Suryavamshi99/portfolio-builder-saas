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
import { completeJob, createJob, setStatus, type JobError } from "@/server/generation/jobs";
import { prepareGeneration } from "@/server/generation/prepare";
import type { ToolContent, ToolDef, ToolResult, Tools } from "./rpc";

const MAX_HTML_CHARS = 600_000;
const ACTIVE = ["queued", "reading", "writing", "checking", "saving"];

export const SERVER_INSTRUCTIONS =
  "Shipfolio builds the user's personal portfolio website. To build it: call get_portfolio_brief, write the page it asks for, then call save_portfolio_html. Never paste the page HTML into the chat; reply with the Studio link instead.";

export const TOOL_DEFS: ToolDef[] = [
  {
    name: "get_portfolio_brief",
    description:
      "Returns the rules, the user's resume text, links, preferences, photo URL and reference screenshots for building their portfolio. Call this first, then write ONE complete HTML document and pass it to save_portfolio_html.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "save_portfolio_html",
    description:
      "Checks and saves the complete portfolio HTML document. If it lists problems, fix exactly those and call this tool again with the whole corrected page. On success reply with the Studio link only; do NOT paste the HTML in the chat.",
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
async function ensureMcpJob(admin: SupabaseClient, userId: string, resumeId: string): Promise<string | null> {
  const { data: active } = await admin.from("generation_jobs").select("id, source").eq("user_id", userId).in("status", ACTIVE).maybeSingle();
  if (active) {
    if (active.source !== "mcp") return null;
    await admin.from("generation_jobs").update({ error: null }).eq("id", active.id);
    await setStatus(admin, active.id, "writing");
    return active.id;
  }
  const created = await createJob(admin, { userId, source: "mcp", resumeUploadId: resumeId });
  if (!created.ok) return null;
  await setStatus(admin, created.job.id, "writing");
  return created.job.id;
}

export function buildTools(ctx: { admin: SupabaseClient; userId: string; origin: string }): Tools {
  const { admin, userId, origin } = ctx;

  async function brief(): Promise<ToolResult> {
    const resumeId = await latestResumeId(admin, userId);
    if (!resumeId) return text(`The user hasn't uploaded a resume yet. Ask them to upload it at ${origin}/onboarding first, then try again.`, true);
    if (!(await ensureMcpJob(admin, userId, resumeId))) {
      return text("Another portfolio generation is already running for this user. Ask them to wait for it to finish, then try again.", true);
    }
    const prepared = await prepareGeneration(admin, userId, { resumeUploadId: resumeId });
    if (!prepared.ok) return text(prepared.message, true);

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

    const problems = async (error: JobError) => {
      await admin
        .from("generation_jobs")
        .update({ status: "writing", message: "Your chat is fixing a few things…", error, updated_at: new Date().toISOString() })
        .eq("id", jobId);
    };

    const final = finalizeHtml({
      rawText: html,
      userId,
      supabaseUrl: getSupabaseEnv().url,
      links: prepared.links,
      referenceText: prepared.referenceText,
    });
    if (!final.ok) {
      await problems({ code: "generation_invalid_output", message: "The page didn't pass our checks.", details: final.errors });
      return text(`The page can't be saved yet. Fix these and call save_portfolio_html again with the complete page:\n- ${final.errors.join("\n- ")}`, true);
    }
    const claims = findUnsupportedClaims(final.html, prepared.referenceText);
    if (claims.length > 0) {
      const details = claims.map((c) => c.message);
      await problems({ code: "generation_unsupported_claims", message: "The page includes facts that aren't in the resume.", details });
      return text(
        `These numbers or dates are not in the user's resume or details. Remove them or replace them with what the resume says, then call save_portfolio_html again with the complete page:\n- ${details.join("\n- ")}`,
        true,
      );
    }

    await setStatus(admin, jobId, "saving");
    await savePortfolioVersion(admin, userId, { html: final.html, source: "mcp", model: null, warnings: final.warnings });
    await recordGeneration(admin, userId, resumeId, "succeeded");
    await completeJob(admin, jobId);
    const notes = final.warnings.length > 0 ? `\nNotes: ${final.warnings.join(" ")}` : "";
    return text(`Saved. The user can open and refine it in Studio: ${origin}/studio\nReply with that link only. Do not paste the HTML.${notes}`);
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
        if (name === "get_portfolio_brief") return await brief();
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
