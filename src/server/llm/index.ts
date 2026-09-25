import type { LlmProvider } from "@/config/llm";
import { callAnthropic } from "./anthropic";
import { callOpenAI } from "./openai";
import { callGoogle } from "./google";
import type { LlmCallInput, LlmCallResult } from "./types";

export { LlmAuthError, LlmProviderError } from "./types";
export type { LlmImageInput } from "./types";
export { GUARDRAIL_SYSTEM_PROMPT } from "./guardrail-prompt";

export function callLlmProvider(provider: LlmProvider, input: LlmCallInput): Promise<LlmCallResult> {
  switch (provider) {
    case "anthropic":
      return callAnthropic(input);
    case "openai":
      return callOpenAI(input);
    case "google":
      return callGoogle(input);
  }
}

const RESUME_IO_COPY_GUIDELINES = `
COPYWRITING GUIDELINES (Resume.io Career-Optimized Style) — apply these to whatever
sections the resume actually supports; skip any that don't apply:
1. Impact-Driven Action Verbs (Google X-Y-Z Formula):
   - Start bullet points with strong, dynamic verbs (e.g., "Architected", "Engineered",
     "Spearheaded", "Optimized", "Scaled", "Automated", "Streamlined", "Deployed").
   - Frame accomplishments around impact: [Action Verb] + [Context & Scope] + [Quantified Result].
   - When metrics, percentages, throughput numbers, latency drops, or scale exist in the
     resume, surface them prominently (stat callouts, not buried in paragraphs).
2. A sharp, confident 1-2 sentence positioning statement in the hero — the candidate's core
   domain, focus, and value. Avoid passive filler or student clichés.
3. Group skills into 3-5 clean domains (e.g., "Languages & Core Runtimes", "Frontend & UI
   Architecture", "Backend & Distributed Systems", "DevOps & Cloud", "AI/ML & Data") with
   concrete evidence per skill (which project/role it came from).
4. Project entries: clear one-line summary, tech used, and 2-4 concise, impact-focused points
   per project — never vague marketing language.
`;

export function buildPortfolioHtmlUserMessage(opts: {
  resumeText: string;
  otherSpecifics?: string | undefined;
  photoUrl?: string | undefined;
  hasReferenceImages: boolean;
}): string {
  const parts = [
    `Resume text:\n"""\n${opts.resumeText}\n"""`,
    opts.otherSpecifics?.trim()
      ? `User specifics and desired emphasis/target role:\n"""\n${opts.otherSpecifics.trim()}\n"""`
      : null,
    opts.photoUrl
      ? `Profile photo URL (use this exact URL as the hero <img> src): ${opts.photoUrl}`
      : `No profile photo was provided — design the hero section without a photo (e.g. typographic hero, or an abstract/geometric visual), don't use a placeholder image.`,
    opts.hasReferenceImages
      ? `${opts.hasReferenceImages ? "Reference screenshots are attached as images above" : ""} — use them as design/mood inspiration only, never as a source of facts.`
      : null,
    RESUME_IO_COPY_GUIDELINES.trim(),
    `Respond with ONLY the raw HTML document — no markdown code fences, no commentary before or after.`,
  ];
  return parts.filter((part): part is string => Boolean(part)).join("\n\n");
}

/** Models sometimes wrap the document in markdown fences or add stray commentary despite instructions not to. */
export function extractHtmlDocument(text: string): string {
  const trimmed = text.trim();
  const fenced = /```(?:html)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidate = (fenced ? fenced[1] : trimmed)?.trim() ?? "";

  const start = candidate.search(/<(!doctype|html)/i);
  if (start === -1) {
    throw new Error("No HTML document found in model output");
  }
  const end = candidate.toLowerCase().lastIndexOf("</html>");
  const html = end === -1 ? candidate.slice(start) : candidate.slice(start, end + "</html>".length);

  if (html.length < 200) {
    throw new Error("Model output was too short to be a real portfolio page");
  }
  return html;
}
