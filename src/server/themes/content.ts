import { z } from "zod";
import type { ThemeContent, ThemeManifest } from "./types";

/** One model call: system prompt, user message, token limit. Returns the reply text. */
export type ModelCall = (system: string, user: string, maxTokens: number) => Promise<string>;

const str = (max: number) => z.string().trim().max(max);
const strList = (max: number, items: number) => z.array(str(max)).max(items);

const ContentSchema = z.object({
  person: z
    .object({
      first_name: str(60),
      last_name: str(60).optional(),
      headline: str(200),
      current: str(200).optional(),
      looking_for: str(200).optional(),
      location: str(100).optional(),
    })
    .partial()
    .optional(),
  contact: z
    .object({ email: str(120), phone: str(40), linkedin: str(200), github: str(200) })
    .partial()
    .optional(),
  pitch: z.object({ short: str(400), why_hire: strList(200, 4) }).partial().optional(),
  about: z.object({ intro: str(900), now: str(400) }).partial().optional(),
  journey: z.array(z.object({ year: str(30), title: str(120), detail: str(300) }).partial()).max(8).optional(),
  education: z
    .array(z.object({ school: str(120), degree: str(160), years: str(30), notes: str(300) }).partial())
    .max(5)
    .optional(),
  experience: z
    .array(
      z
        .object({ org: str(120), role: str(120), place: str(80), dates: str(60), points: strList(300, 6) })
        .partial(),
    )
    .max(8)
    .optional(),
  projects: z
    .array(
      z
        .object({
          title: str(120),
          org: str(120),
          year: str(20),
          role: str(100),
          type: str(60),
          summary: str(400),
          result: str(300),
          tags: strList(40, 6),
          tools: strList(40, 8),
        })
        .partial(),
    )
    .max(8)
    .optional(),
  skills: z.record(z.string().max(40), strList(40, 12)).optional(),
  certifications: z.array(z.object({ name: str(140), issuer: str(100), year: str(20) }).partial()).max(8).optional(),
});

export const EXTRACT_SYSTEM = `You turn a resume into JSON for a portfolio page. Reply with one JSON object and nothing else.
Rules:
- Use ONLY facts written in the resume or in the user's answers. Never invent, round, or add a number, date, employer, title or claim.
- Copy names, titles, employers, dates and numbers exactly as written.
- Leave out any key you have no facts for. An empty or missing key is correct.
- Keep each string short. Plain text only, no markdown.`;

const SHAPE = `{
 "person": {"first_name","last_name","headline" (one line: role and focus, from the resume),"current","looking_for","location"},
 "contact": {"email","phone","linkedin","github"},
 "pitch": {"short" (one or two sentences from the resume),"why_hire": [up to 3 short strengths taken from the resume]},
 "about": {"intro" (2-3 sentences, third person ok, resume facts only),"now"},
 "journey": [{"year","title","detail"}],
 "education": [{"school","degree","years","notes"}],
 "experience": [{"org","role","place","dates","points": [short bullets]}],
 "projects": [{"title","org","year","role","type","summary","result","tags": [],"tools": []}],
 "skills": {"Group name": ["skill"]},
 "certifications": [{"name","issuer","year"}]
}`;

export function buildExtractMessage(resumeText: string, answers: string): string {
  return `Resume:\n"""\n${resumeText.slice(0, 14_000)}\n"""\n${
    answers ? `\nThe user's own answers (also allowed as facts):\n"""\n${answers}\n"""\n` : ""
  }\nReturn JSON with this shape (omit keys you cannot fill):\n${SHAPE}`;
}

/** Pulls the first JSON object out of a model reply and keeps only the fields the schema knows. */
export function parseContentReply(text: string): ThemeContent | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const parsed = ContentSchema.safeParse(raw);
  if (!parsed.success) return null;
  return pruneEmpty(parsed.data) as ThemeContent;
}

/** Removes empty strings, empty lists and empty objects, so a section with nothing in it hides (R11). */
export function pruneEmpty<T>(value: T): T | undefined {
  if (typeof value === "string") return (value.trim() ? value : undefined) as T | undefined;
  if (Array.isArray(value)) {
    const items = value.map((v) => pruneEmpty(v)).filter((v) => v !== undefined);
    return (items.length ? items : undefined) as T | undefined;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const p = pruneEmpty(v);
      if (p !== undefined) out[k] = p;
    }
    return (Object.keys(out).length ? out : undefined) as T | undefined;
  }
  return value;
}

/** What code alone can read from a resume: the name, the first role line, and contact details. */
export function extractWithoutModel(resumeText: string): ThemeContent {
  const lines = resumeText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const nameLine = lines.find((l) => /^[\p{L}][\p{L}.'-]+(\s+[\p{L}][\p{L}.'-]+){1,3}$/u.test(l) && l.length < 50) ?? "";
  const [first = "", ...rest] = nameLine.split(/\s+/);
  const idx = lines.indexOf(nameLine);
  const next = idx >= 0 ? lines[idx + 1] : undefined;
  const headline = next && next.length < 120 && !/@|\d{5}/.test(next) ? next : "";
  const email = resumeText.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0];
  const phone = resumeText.match(/\+?\d[\d\s().-]{8,}\d/)?.[0];
  const linkedin = resumeText.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s)]+/i)?.[0];
  const github = resumeText.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s)/]+/i)?.[0];
  return (
    pruneEmpty({
      person: { first_name: first, last_name: rest.join(" "), headline },
      contact: { email, phone, linkedin, github },
    }) ?? {}
  ) as ThemeContent;
}

/** Signature answers become lines under `signature.<key>`. Empty answers leave nothing behind (R10). */
export function mergeAnswers(content: ThemeContent, manifest: ThemeManifest, answers: Record<string, string> | undefined): ThemeContent {
  const known = new Set(manifest.questions.map((q) => q.key));
  const signature: Record<string, string[]> = {};
  for (const [key, text] of Object.entries(answers ?? {})) {
    if (!known.has(key)) continue;
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 12);
    if (lines.length) signature[key] = lines;
  }
  const out = { ...content };
  if (Object.keys(signature).length) out.signature = signature;
  return out;
}

export async function buildContent(opts: {
  resumeText: string;
  manifest: ThemeManifest;
  answers?: Record<string, string> | undefined;
  model?: ModelCall | undefined;
}): Promise<{ content: ThemeContent; usedModel: boolean }> {
  const answerText = Object.entries(opts.answers ?? {})
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  let content: ThemeContent | null = null;
  if (opts.model) {
    try {
      content = parseContentReply(await opts.model(EXTRACT_SYSTEM, buildExtractMessage(opts.resumeText, answerText), 3000));
    } catch {
      content = null;
    }
  }
  const usedModel = content !== null;
  content ??= extractWithoutModel(opts.resumeText);
  return { content: mergeAnswers(content, opts.manifest, opts.answers), usedModel };
}
