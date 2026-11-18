import type { ProfileLinks } from "@/server/llm";
import { SECTION_KEYS, type PortfolioFacts } from "@/server/themes/facts";
import type { Theme } from "@/server/themes/types";
import type { ThemeTemplate } from "@/server/themes/templates/types";

/** Facts and customisations come from the user's chat model: treat them as untrusted and bounded. */
export const MAX_FACTS_JSON_CHARS = 200_000;
export const MAX_CUSTOM_JSON_CHARS = 1_000;
export const THEME_ID_PATTERN = /^[a-z0-9-]{1,40}$/;

/** Compact description of PortfolioFacts with the length limits the template slots can hold. Keep in step with themes/facts.ts. */
export const FACTS_SHAPE = `{
  "name": "string, max 80 (required)",
  "headline": "string, max 160, e.g. 'Product manager'",
  "tagline": "string, max 240, one line the resume supports",
  "summary": "string, max 1200, a short intro paragraph",
  "location": "string, max 80",
  "email": "string, max 120",
  "phone": "string, max 40",
  "stats": [{ "value": "max 40, e.g. '38%'", "label": "max 80" }],            // up to 6, only numbers in the resume
  "experience": [{ "org": "max 120", "role": "max 120", "period": "max 60", "location": "max 80", "summary": "max 600", "bullets": ["max 500 each, up to 8"] }],  // up to 12
  "projects": [{ "name": "max 120", "description": "max 700", "role": "max 100", "period": "max 60", "link": "a link from the user's list", "metrics": [{ "value": "", "label": "" }], "tags": ["max 40 each, up to 8"], "bullets": ["max 400 each, up to 6"] }],  // up to 12
  "education": [{ "school": "max 140", "degree": "max 140", "period": "max 60", "detail": "max 300" }],   // up to 6
  "skills": [{ "group": "max 60", "items": ["max 60 each, 1 to 24"] }],         // up to 8 groups
  "achievements": [{ "title": "max 160", "detail": "max 300", "year": "max 10" }],  // up to 10
  "certifications": [{ "name": "max 140", "issuer": "max 100", "year": "max 10" }], // up to 10
  "testimonials": [{ "quote": "max 500", "author": "max 80", "role": "max 100" }],  // up to 6; only quotes that are in the user's details
  "extras": [{ "label": "max 60, e.g. 'Languages'", "items": ["max 100 each, 1 to 12"] }]  // up to 4
}`;

export const CUSTOM_SHAPE = `{ "accent": "#rrggbb (optional)", "fonts": "theme | serif | sans | mono", "hidden": ["section keys to hide"], "order": ["section keys to show first, in this order"] }
Section keys: ${SECTION_KEYS.join(", ")}`;

export const FACT_RULES = [
  "Use ONLY facts that are in the resume text or the extra details below. The resume is the single source of truth.",
  "You may reword, shorten and reorder text so it fits the slots and reads well. Keep the meaning exactly the same.",
  "Never change names, employers, schools, job titles, dates, contact details or links.",
  "Never invent or round numbers, percentages, years or amounts. Use a number only if it appears in the resume or details.",
  "If the resume has nothing for a section, leave that section empty (an empty list) or leave the field out. Never make something up to fill it.",
  "Do not include photoUrl or links in your facts: Shipfolio adds the user's photo and verified links itself.",
  "Do not write HTML. Write plain text only.",
];

/** One theme's feel line (the brief's own "Feel:" sentence when it has one). */
export function feelOf(theme: Theme): string {
  const line = theme.brief.split("\n").find((l) => l.startsWith("Feel:"));
  return line ? line.slice(5).trim() : `${theme.feel}. ${theme.tagline}`;
}

export function describeTheme(theme: Theme, template: ThemeTemplate, canUse: boolean): string {
  return [
    `- ${theme.name} (id: ${theme.id}): ${theme.tagline}`,
    `  Suits: ${theme.profession}. Style: ${theme.feel}. Plan: ${theme.tier === "paid" ? "paid" : "free"}. This user can use it: ${canUse ? "yes" : "no, it needs the paid plan"}.`,
    `  Sections it shows: ${template.sections.join(", ")}. Default accent colour: ${template.defaultAccent}.`,
  ].join("\n");
}

/** The links the server vouches for, in the order the user gave them. */
export function verifiedLinks(links: ProfileLinks): { label: string; url: string }[] {
  const out: { label: string; url: string }[] = [];
  const add = (label: string, url: string | undefined) => {
    if (url && !out.some((o) => o.url === url)) out.push({ label, url });
  };
  add("LinkedIn", links.linkedin);
  add("GitHub", links.github);
  for (const p of links.githubProjects ?? []) add(`GitHub: ${p.replace(/\/+$/, "").split("/").pop() ?? "project"}`, p);
  for (const o of links.other ?? []) add(o.label, o.url);
  return out.slice(0, 12);
}

/** Replaces what the model said about the photo and links with what the server knows. */
export function withServerValues(facts: PortfolioFacts, links: ProfileLinks, photoUrl: string | undefined): PortfolioFacts {
  const rest: PortfolioFacts = { ...facts };
  delete rest.photoUrl;
  return { ...rest, links: verifiedLinks(links), ...(photoUrl ? { photoUrl } : {}) };
}

/** Parses a JSON size-limited value; returns null when it is not an object or is too large. */
export function boundedObject(v: unknown, maxChars: number): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  try {
    if (JSON.stringify(v).length > maxChars) return null;
  } catch {
    return null;
  }
  return v as Record<string, unknown>;
}

export const AFTER_BUILD_GUIDANCE = [
  "Saved. The page is ready to look at in Studio: {LINK}",
  "",
  "NEXT STEPS FOR YOU (the assistant):",
  "1. Tell the user the Studio link above. Do not paste any HTML or the facts into the chat.",
  "2. Then ASK the user, in plain words, whether they want to keep this page as it is or change anything. Offer these choices:",
  "   - Change the wording or what is emphasised: revise the facts and call build_themed_portfolio again with the same themeId.",
  "   - Change the colour, font style or which sections show and their order: call build_themed_portfolio again with the same facts and a `custom` setting.",
  "   - Try a different look: call list_portfolio_themes and start again with the look they pick.",
  "   - Deeper edits to the design itself: call get_portfolio_html, change the page, then call save_portfolio_html (it is checked the same way).",
  "3. Do whatever they choose, and offer changes again after every new version.",
].join("\n");
