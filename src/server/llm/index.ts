import type { LlmProvider } from "@/config/llm";
import { callAnthropic } from "./anthropic";
import { callOpenAI } from "./openai";
import { callGoogle } from "./google";
import type { LlmCallInput, LlmCallResult } from "./types";

export { LlmAuthError, LlmProviderError } from "./types";
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

const RESUME_IO_STYLE_GUIDELINES = `
PROFESSIONAL PORTFOLIO COPYWRITING GUIDELINES (Resume.io Career-Optimized Style):
1. Impact-Driven Action Verbs (Google X-Y-Z Formula):
   - For all role groups, achievements, and project descriptions, start bullet points with strong, dynamic verbs (e.g., "Architected", "Engineered", "Spearheaded", "Optimized", "Scaled", "Automated", "Streamlined", "Deployed").
   - Frame accomplishments around impact: [Action Verb] + [Context & Scope] + [Quantified Result].
   - When metrics, percentages, throughput numbers, latency drops, or scale exist in the resume, highlight them in the role claims, project points, and metrics arrays.

2. Professional Developer Thesis (profile.thesis):
   - Craft a sharp, confident 1-2 sentence positioning statement highlighting the candidate's core technical domain, architecture focus, and value. Avoid passive filler or student clichés.

3. Structured Skill Categorization with Real Evidence (skills.groups):
   - Categorize detected skills into 3-5 clean technical domains (e.g., "Languages & Core Runtimes", "Frontend & UI Architecture", "Backend & Distributed Systems", "DevOps & Cloud", "AI/ML & Data").
   - For each group, provide a clear 'claim' summarizing expertise.
   - For each skill, provide concrete 'evidence' citing the specific project, role, or feature where it was used in the resume.

4. Current Focus ('Now' Section) & Marquee Tags:
   - home.nowTitle: 2-5 words summarizing current status (e.g., "Building High-Throughput Distributed Systems", "Shipping Web & Mobile Applications").
   - home.nowText: 1-2 sentences on what they are currently building, studying, or deploying based on their latest experience.
   - home.marquee: 5-8 modern technology keywords or domain tags from the resume (e.g. ["TypeScript", "Next.js", "Distributed Systems", "PostgreSQL", "React 19", "Docker"]).

5. Narrative 'About' & Quantified Metrics:
   - about.title: "Background & Engineering Philosophy"
   - about.intro: 2-3 engaging, professional sentences detailing their engineering journey and problem-solving mindset.
   - about.stats: 2-4 quantitative statistics derived strictly from resume facts (e.g., years of experience, production projects, users impacted, or graduation honors).
   - about.offHours: 2-4 authentic hobbies/interests if indicated, mapped to valid icons ("film", "racquet", "philosophy", "running", "generic").

6. Navigation (nav):
   - The published site is a single scrolling page with in-page anchor links, not
     separate routes. Use "#" + section id, matching these sections exactly:
     - { "to": "#about", "label": "About", "short": "01", "index": "01" }
     - { "to": "#work", "label": "Experience", "short": "02", "index": "02" }
     - { "to": "#skills", "label": "Skills", "short": "03", "index": "03" }
     - { "to": "#projects", "label": "Projects", "short": "04", "index": "04" }
     - { "to": "#contact", "label": "Contact", "short": "05", "index": "05" }
   - Omit an entry if the corresponding section will be empty (e.g. no projects).

7. Project Slugs & Structure:
   - Ensure every project has a clean URL-friendly kebab-case 'slug' (e.g., "distributed-cache-engine").
   - Populate 'role', 'tech', 'summary', and 'body' with structured blocks containing headings and concise points.
`;

export function buildExtractionUserMessage(
  resumeText: string,
  otherSpecifics: string | undefined,
  jsonSchema: unknown,
): string {
  const parts = [
    `Resume text:\n"""\n${resumeText}\n"""`,
    otherSpecifics?.trim()
      ? `User specifics and desired emphasis/target role:\n"""\n${otherSpecifics.trim()}\n"""`
      : null,
    RESUME_IO_STYLE_GUIDELINES.trim(),
    `Respond with ONLY a single JSON object — no markdown code fences, no commentary before or after. It must validate against this JSON Schema:\n${JSON.stringify(jsonSchema)}`,
  ];
  return parts.filter((part): part is string => part !== null).join("\n\n");
}

/** Models often wrap JSON in markdown fences or add stray text despite instructions not to. */
export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidate = fenced ? fenced[1]! : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in model output");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}
