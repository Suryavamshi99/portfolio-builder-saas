import type { ProfileLinks } from "@/server/llm";

import type { BuildInput, Plan, PlanSection, SectionKind, Theme } from "./types";

/** Short on purpose: these models have small per-minute limits, and every step sends this. */
export const STEP_SYSTEM_PROMPT = `You write one part of a premium, mobile-friendly portfolio web page for a job-seeker.

CORE RULE: use ONLY facts that are in the SOURCE TEXT you are given. Never invent technologies, employers, projects, numbers, dates, links or achievements, and never add skills just because they are common for a role. Every number you show must appear in the source. You may rewrite for clarity and strength, but never change the meaning.
Output ONLY what is asked for: no markdown fences, no explanations.`;

/** The class names every page part uses. The design step styles exactly these, and section calls use exactly these. */
export const CLASS_VOCABULARY = `Class names (the page's stylesheet defines these; use them, and add inline-free semantic HTML):
.wrap (centered container, put it inside every section), .eyebrow (small label above a heading), .lead (large intro paragraph),
.sec (a section), .sec-title (the section's h2), .grid (responsive card grid), .card (a boxed item; may hold h3, .meta, p, ul.list),
.meta (small muted line: dates, place, role), .tags (row) with .tag (a small pill), ul.list (clean bullet list),
.btn (a link styled as a button), .links (row of links), .stat (a highlighted number with a label, only when the source has the number).`;

const KIND_GUIDE: Record<SectionKind, string> = {
  about: "A short, confident positioning paragraph (.lead) and, if the source has them, 2-3 highlights as .card items.",
  experience: "One .card per role inside a .grid or stacked: h3 with the role and company, a .meta line with dates, then ul.list of achievements. Start bullets with strong verbs. Show metrics only if the source has them.",
  projects: "One .card per project: h3 with the name, a sentence of what it is, a .tags row of technologies named in the source, and a link only if a URL is in the source.",
  skills: "Group the skills into 3-5 sensible domains, each a .card with an h3 and a .tags row. Use only skills named in the source.",
  education: "One .card per entry: h3 with the school or course, a .meta line, and a short note only if the source has one.",
  certifications: "A tidy .grid of .card items, one per certification or award in the source.",
  contact: "A short invitation and the links given. Use only the links in the source or the links list.",
  other: "Present the source clearly with .card items or a ul.list.",
};

function linksBlock(links: ProfileLinks): string {
  const lines: string[] = [];
  if (links.linkedin) lines.push(`- LinkedIn: ${links.linkedin}`);
  if (links.github) lines.push(`- GitHub: ${links.github}`);
  for (const p of links.githubProjects ?? []) lines.push(`- GitHub project: ${p}`);
  for (const o of links.other ?? []) lines.push(`- ${o.label}: ${o.url}`);
  return lines.length ? `Verified links (use these exact URLs, never invent others):\n${lines.join("\n")}` : "No links were provided: do not add any links.";
}

export function buildHeroMessage(plan: Plan, input: BuildInput): string {
  const sourceTop = input.lines.slice(0, 14).join("\n");
  return `Write the hero section for ${plan.name}'s portfolio.

Name: ${plan.name}
${plan.headline ? `Headline: ${plan.headline}` : ""}
${plan.tagline ? `Tagline: ${plan.tagline}` : ""}
SOURCE TEXT (top of the resume):
"""
${sourceTop}
"""
${input.photoUrl ? `Profile photo URL (use this exact URL as the <img src>, with alt text): ${input.photoUrl}` : "No photo was provided: design the hero without a photo and without a placeholder image."}
${linksBlock(input.links)}
${CLASS_VOCABULARY}

Output exactly one element: <section id="top" class="hero"><div class="wrap">...</div></section> with an h1 for the name, a .lead positioning sentence (no numbers unless in the source), and the links as .btn or .links items. Nothing else.`;
}

export function buildSectionMessage(plan: Plan, section: PlanSection, source: string, input: BuildInput, correction?: string): string {
  return `Write the "${section.title}" section for ${plan.name}'s portfolio.

SOURCE TEXT for this section:
"""
${source}
"""
${section.kind === "contact" || section.kind === "projects" ? linksBlock(input.links) : ""}
${CLASS_VOCABULARY}

How to present it: ${KIND_GUIDE[section.kind]}
Output exactly one element: <section id="${section.id}" class="sec"><div class="wrap"><h2 class="sec-title">${section.title}</h2>...</div></section>. Nothing else.${
    correction ? `\n\nCORRECTION REQUIRED: the previous version contained facts that are not in the source text. Remove or fix these, change nothing else:\n${correction}` : ""
  }`;
}

/** A readable summary of the theme for the design call's log. */
export function themeSummary(t: Theme): string {
  return `${t.mood}; ${t.colors.accent}; ${t.fonts.display}/${t.fonts.body}`;
}
