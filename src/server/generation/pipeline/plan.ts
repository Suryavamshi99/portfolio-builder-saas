import { z } from "zod";

import type { BuildInput, Plan, PlanSection, SectionKind, Theme } from "./types";

const MAX_SECTIONS = 7;
const KINDS: SectionKind[] = ["about", "experience", "projects", "skills", "education", "certifications", "contact", "other"];

export const DEFAULT_THEMES: Record<"minimal" | "bold", Theme> = {
  minimal: {
    mood: "clean, editorial, quietly premium",
    colors: { bg: "#FAFAF7", surface: "#FFFFFF", text: "#14161C", muted: "#5B6170", accent: "#3457E8", accent2: "#0E7490" },
    fonts: { display: "Inter", body: "Inter" },
  },
  bold: {
    mood: "expressive, high contrast, confident",
    colors: { bg: "#0B0D12", surface: "#14161C", text: "#F6F6F3", muted: "#9AA0B0", accent: "#6D83FF", accent2: "#22D3EE" },
    fonts: { display: "Space Grotesk", body: "Inter" },
  },
};

/** The resume with line numbers, for the plan call. Very long lines are shortened (the plan only needs to see where things start). */
export function numberLines(lines: string[]): string {
  return lines.map((l, i) => `L${i + 1}: ${l.length > 220 ? `${l.slice(0, 220)}…` : l}`).join("\n");
}

export function resumeLines(resumeText: string): string[] {
  return resumeText
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/g, ""))
    .slice(0, 400);
}

export function buildPlanMessage(input: BuildInput): string {
  const extra = [
    input.specifics?.trim() ? `Emphasis the user asked for:\n"""\n${input.specifics.trim()}\n"""` : null,
    input.instructions?.trim() ? `Changes the user asked for:\n"""\n${input.instructions.trim()}\n"""` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
  const dir =
    input.designIntensity === "bold"
      ? "The user wants a bold, design-heavy look: expressive type, a strong accent, dark or high-contrast colours are fine."
      : "The user wants a minimal, editorial look: lots of whitespace, one accent colour, restrained.";
  return `Plan a portfolio website from this resume. Each resume line is numbered (L1, L2, ...).

${numberLines(input.lines)}

${extra}

${dir}

Reply with ONLY one JSON object, no markdown, in exactly this shape:
{
  "name": "the person's name as written in the resume",
  "headline": "their role in 3-8 words, using only words from the resume",
  "tagline": "one short sentence positioning them, using only facts from the resume, with NO numbers",
  "theme": {
    "mood": "3-6 words",
    "colors": {"bg":"#rrggbb","surface":"#rrggbb","text":"#rrggbb","muted":"#rrggbb","accent":"#rrggbb","accent2":"#rrggbb"},
    "fonts": {"display":"a Google Fonts family","body":"a Google Fonts family"}
  },
  "sections": [
    {"id":"about","title":"About","kind":"about","lines":[[start,end]]}
  ]
}
Rules for "sections": only sections the resume has content for; at most ${MAX_SECTIONS}; kinds are one of ${KINDS.join(", ")};
ids are lowercase letters and hyphens; "lines" are inclusive resume line numbers that hold that section's content (one or more ranges).
Pick colours with good text contrast. Do not invent anything that is not in the resume.`;
}

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const family = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9 ]{1,38}$/);

const planSchema = z.object({
  name: z.string().trim().min(1).max(80),
  headline: z.string().trim().max(120).optional(),
  tagline: z.string().trim().max(240).optional(),
  theme: z
    .object({
      mood: z.string().trim().max(60).optional(),
      colors: z.object({ bg: hex, surface: hex, text: hex, muted: hex, accent: hex, accent2: hex }).partial().optional(),
      fonts: z.object({ display: family, body: family }).partial().optional(),
    })
    .optional(),
  sections: z
    .array(
      z.object({
        id: z.string().optional(),
        title: z.string().trim().min(1).max(60),
        kind: z.string().optional(),
        lines: z.array(z.tuple([z.number(), z.number()])).min(1).max(6),
      }),
    )
    .min(1),
});

/** Relative luminance of a #rrggbb colour. */
function luminance(h: string): number {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Model colours are kept only when the text is readable on the background; otherwise the default theme for the chosen intensity is used. */
function cleanTheme(raw: z.infer<typeof planSchema>["theme"], intensity: "minimal" | "bold"): Theme {
  const base = DEFAULT_THEMES[intensity];
  const rc = raw?.colors;
  const colors = {
    bg: rc?.bg ?? base.colors.bg,
    surface: rc?.surface ?? base.colors.surface,
    text: rc?.text ?? base.colors.text,
    muted: rc?.muted ?? base.colors.muted,
    accent: rc?.accent ?? base.colors.accent,
    accent2: rc?.accent2 ?? base.colors.accent2,
  };
  if (contrast(colors.bg, colors.text) < 4.5 || contrast(colors.surface, colors.text) < 4.5 || contrast(colors.bg, colors.muted) < 3) {
    return { ...base, mood: raw?.mood ?? base.mood };
  }
  if (contrast(colors.bg, colors.accent) < 3) colors.accent = base.colors.accent;
  return {
    mood: raw?.mood ?? base.mood,
    colors,
    fonts: { display: raw?.fonts?.display ?? base.fonts.display, body: raw?.fonts?.body ?? base.fonts.body },
  };
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

function cleanRanges(ranges: Array<[number, number]>, lineCount: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const [a, b] of ranges) {
    const start = Math.max(1, Math.floor(Math.min(a, b)));
    const end = Math.min(lineCount, Math.floor(Math.max(a, b)));
    if (Number.isFinite(start) && Number.isFinite(end) && start <= end) out.push([start, end]);
  }
  return out;
}

/** Parses and cleans the model's plan. Returns null when there is nothing usable. */
export function parsePlan(text: string, input: BuildInput): Plan | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  let json: unknown;
  try {
    json = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const parsed = planSchema.safeParse(json);
  if (!parsed.success) return null;
  const p = parsed.data;

  const used = new Set<string>(["top"]);
  const sections: PlanSection[] = [];
  for (const raw of p.sections) {
    if (sections.length >= MAX_SECTIONS) break;
    const lines = cleanRanges(raw.lines, input.lines.length);
    if (lines.length === 0) continue;
    const kind = (KINDS as string[]).includes(raw.kind ?? "") ? (raw.kind as SectionKind) : "other";
    let id = slug(raw.id ?? raw.title) || kind;
    for (let n = 2; used.has(id); n++) id = `${slug(raw.id ?? raw.title) || kind}-${n}`.slice(0, 28);
    used.add(id);
    sections.push({ id, title: raw.title, kind, lines });
  }
  if (sections.length === 0) return null;

  return {
    name: p.name,
    headline: p.headline ?? "",
    tagline: p.tagline ?? "",
    theme: cleanTheme(p.theme, input.designIntensity),
    sections,
  };
}

const HEADINGS: Array<[RegExp, SectionKind, string]> = [
  [/^(professional\s+)?(summary|profile|about( me)?|objective)$/i, "about", "About"],
  [/^(work\s+|professional\s+)?(experience|employment|work history)$/i, "experience", "Experience"],
  [/^(personal\s+|selected\s+|key\s+)?projects?$/i, "projects", "Projects"],
  [/^(technical\s+|core\s+)?skills?( & tools| and tools)?$|^technologies$|^tech stack$/i, "skills", "Skills"],
  [/^education( & training)?$|^academics?$/i, "education", "Education"],
  [/^(certifications?|licen[sc]es?|courses|achievements|awards)$/i, "certifications", "Certifications"],
  [/^contact( me)?$/i, "contact", "Contact"],
];

/** A plan made in code from the resume's own headings, used when the model's plan is unusable. */
export function fallbackPlan(input: BuildInput): Plan {
  const lines = input.lines;
  const name = lines.find((l) => l.trim().length > 0)?.trim().slice(0, 80) || "My Portfolio";
  const marks: Array<{ at: number; kind: SectionKind; title: string }> = [];
  lines.forEach((raw, i) => {
    const t = raw.trim().replace(/[:\s]+$/g, "");
    if (!t || t.length > 40) return;
    for (const [re, kind, title] of HEADINGS) {
      if (re.test(t)) {
        marks.push({ at: i + 1, kind, title });
        return;
      }
    }
  });

  const sections: PlanSection[] = [];
  const used = new Set<string>(["top"]);
  marks.forEach((m, idx) => {
    const from = m.at + 1;
    const to = (marks[idx + 1]?.at ?? lines.length + 1) - 1;
    if (from > to || !lines.slice(from - 1, to).some((l) => l.trim())) return;
    let id: string = m.kind;
    for (let n = 2; used.has(id); n++) id = `${m.kind}-${n}`;
    used.add(id);
    if (sections.length < MAX_SECTIONS) sections.push({ id, title: m.title, kind: m.kind, lines: [[from, to]] });
  });
  if (sections.length === 0) {
    sections.push({ id: "about", title: "About", kind: "about", lines: [[Math.min(2, lines.length) || 1, Math.max(lines.length, 1)]] });
  }
  return { name, headline: "", tagline: "", theme: DEFAULT_THEMES[input.designIntensity], sections };
}

/** The resume text for a section, sliced in code from the plan's line ranges. */
export function sliceFor(section: PlanSection, lines: string[]): string {
  return section.lines
    .map(([a, b]) => lines.slice(a - 1, b).join("\n"))
    .join("\n\n")
    .trim();
}
