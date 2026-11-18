import { findUnsupportedClaims } from "@/server/fact-check";
import { portfolioFactsSchema, type PortfolioFacts } from "./facts";
import { registry } from "./registry";
import { getTemplate } from "./templates";

/**
 * Shared pieces of the text-curation step (see curate-facts.ts): the theme guidance given to the model, and the merge
 * that decides which reworded strings are allowed into the facts. No model calls here, and no import of extract-facts,
 * so extract-facts can use it for the combined path without a cycle.
 */

export interface CurateResult {
  facts: PortfolioFacts;
  curated: boolean;
  notes: string[];
}

/** Soft length targets (characters) given to the model. The schema caps are the hard limits. */
export const LENGTH_TARGETS = {
  headline: 60,
  tagline: 110,
  summary: 450,
  projectDescription: 140,
  experienceSummary: 200,
  bullet: 140,
  achievementDetail: 120,
} as const;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, " ").trim();
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// eslint-disable-next-line no-control-regex -- stripping control characters from model output is the point
const tidy = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();

/** Stops text from closing our delimiters. */
export const defangCuration = (s: string) => s.replace(/<(\/?)(facts|instructions|theme|resume|details|verified_links)\b/gi, "‹$1$2");

/** What the model is told about the chosen look and the slots it fills. Undefined for an unknown theme. */
export function curationGuidance(themeId: string): string | undefined {
  const theme = registry.get(themeId);
  const tpl = getTemplate(themeId);
  if (!theme || !tpl) return undefined;
  const t = LENGTH_TARGETS;
  return `THE LOOK: "${theme.name}" (${theme.feel}, suits ${theme.profession}). Its design language, so you can match the TONE only (never copy or mention it in your output):
<theme>
${defangCuration(theme.brief.slice(0, 1500))}
</theme>
SLOTS this layout shows: ${tpl.sections.join(", ")}. Content for other sections is simply not shown, so spend no effort on it.
LENGTH TARGETS (characters, aim at or under): headline ${t.headline}, tagline ${t.tagline}, summary ${t.summary}, project description ${t.projectDescription}, experience summary ${t.experienceSummary}, each bullet ${t.bullet}, achievement detail ${t.achievementDetail}. Hard limits: headline 160, tagline 240, summary 1200, project description 700, experience summary 600, bullet 500 (projects 400), achievement detail 300.
YOU MAY reword ONLY these text fields: headline, tagline, summary, project description, experience summary, bullets (experience and project), achievement detail. Make the headline and tagline suit the look (punchy for a bold look, calm and conclusion-first for a quiet one). Tighten long text, shorten bullets, merge or drop redundant bullets, reorder bullets so the strongest come first.
YOU MUST NOT change: names, employers, schools, job titles, project names, dates, periods, locations, email, phone, links, stats and metrics, skills, tags, certifications, testimonials, extras. Never add an item, a list entry that is not a rewording of an existing one, or a new fact. Every number, percentage, currency amount and year you write must already be in the facts. No claims, adjectives of achievement or superlatives the facts do not support. Keep the language of the facts.`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Merge: only checked rewording gets through
// ---------------------------------------------------------------------------------------------------------------------

const STOP = new Set(["with", "that", "this", "from", "have", "has", "were", "been", "into", "over", "their", "they", "than", "then", "your", "about", "which", "while", "through"]);
const words = (s: string) => norm(s).split(" ").filter((w) => w.length > 3 && !STOP.has(w));

/**
 * Checks a reworded string against the source. Returns it if acceptable, otherwise the original (which may be undefined).
 * A rewrite must fit the cap, add no numbers or years the source lacks, add no markup, and mostly reuse words from the source.
 */
function makeFitter(source: string) {
  const sourceWords = new Set(words(source));
  let rejected = 0;
  let changed = 0;
  const numbersOk = (s: string) => !/\d/.test(s) || findUnsupportedClaims(`<html><body><p>${escapeHtml(s)}</p></body></html>`, source).length === 0;

  const text = (cand: unknown, orig: string | undefined, max: number): string | undefined => {
    if (typeof cand !== "string") return orig;
    const s = tidy(cand);
    if (!s || s === orig) return orig;
    const ws = words(s);
    const reuse = ws.length === 0 ? 1 : ws.filter((w) => sourceWords.has(w)).length / ws.length;
    if (s.length > max || /[<>]/.test(s) || !numbersOk(s) || reuse < 0.5) {
      rejected++;
      return orig;
    }
    changed++;
    return s;
  };

  const list = (cand: unknown, orig: string[], max: number): string[] => {
    if (!Array.isArray(cand)) return orig;
    if (cand.length === 0 || cand.length > orig.length) {
      if (cand.length > 0) rejected++;
      return orig;
    }
    const out: string[] = [];
    for (const c of cand) {
      const r = typeof c === "string" ? text(c, undefined, max) : undefined;
      if (!r) {
        rejected++;
        return orig; // one bad bullet keeps the whole original list, so nothing is lost
      }
      out.push(r);
    }
    return out;
  };

  return { text, list, stats: () => ({ rejected, changed }) };
}

function findBy(candidates: unknown[], key: (o: Obj) => string, want: string, index: number): Obj | undefined {
  const objs = candidates.filter(isObj);
  return objs.find((o) => key(o) === want) ?? (objs[index] && key(objs[index]!) === want ? objs[index] : undefined);
}
const strKey = (v: unknown) => (typeof v === "string" ? norm(v) : "");

/**
 * Merges a model's reworded copy into the original facts. Starts from the original, so every protected field (names, employers,
 * dates, contact, links, metrics, skills, photo) is the original by construction. Only the allowed text fields can change,
 * each one on its own: a rewrite that fails a check is replaced by the original string.
 */
export function applyCuration(baseline: PortfolioFacts, candidate: unknown, sourceText: string): CurateResult {
  const unchanged = (note: string): CurateResult => ({ facts: baseline, curated: false, notes: [note] });
  const cand: Obj | undefined = isObj(candidate) ? (isObj(candidate["facts"]) ? candidate["facts"] : candidate) : undefined;
  if (!cand) return unchanged("The wording was kept as written (no usable rewrite).");

  const f = makeFitter(sourceText);
  const out: PortfolioFacts = {
    ...baseline,
    ...(opt("headline", f.text(cand["headline"], baseline.headline, 160))),
    ...(opt("tagline", f.text(cand["tagline"], baseline.tagline, 240))),
    ...(opt("summary", f.text(cand["summary"], baseline.summary, 1200))),
    experience: baseline.experience.map((e, i) => {
      const c = findBy(arr(cand["experience"]), (o) => `${strKey(o["org"])}|${strKey(o["role"])}`, `${norm(e.org)}|${norm(e.role)}`, i);
      if (!c) return e;
      const summary = f.text(c["summary"], e.summary, 600);
      return { ...e, ...(summary === undefined ? {} : { summary }), bullets: f.list(c["bullets"], e.bullets, 500) };
    }),
    projects: baseline.projects.map((p, i) => {
      const c = findBy(arr(cand["projects"]), (o) => strKey(o["name"]), norm(p.name), i);
      if (!c) return p;
      const description = f.text(c["description"], p.description, 700);
      return { ...p, ...(description === undefined ? {} : { description }), bullets: f.list(c["bullets"], p.bullets, 400) };
    }),
    achievements: baseline.achievements.map((a, i) => {
      const c = findBy(arr(cand["achievements"]), (o) => strKey(o["title"]), norm(a.title), i);
      if (!c) return a;
      const detail = f.text(c["detail"], a.detail, 300);
      return { ...a, ...(detail === undefined ? {} : { detail }) };
    }),
  };

  const { rejected, changed } = f.stats();
  const parsed = portfolioFactsSchema.safeParse(out);
  if (!parsed.success) return unchanged("The wording was kept as written (the rewrite did not fit the page).");
  const notes: string[] = [];
  if (rejected > 0) notes.push(`Kept your original wording for ${rejected} line${rejected === 1 ? "" : "s"} where the rewrite added details the resume does not support.`);
  const differs = JSON.stringify(parsed.data) !== JSON.stringify(baseline);
  if (!differs || changed === 0) return { facts: baseline, curated: false, notes: notes.length ? notes : ["The wording was kept as written."] };
  return { facts: parsed.data, curated: true, notes };
}

function opt<K extends string, V>(k: K, v: V | undefined): { [P in K]?: V } {
  return v === undefined ? {} : ({ [k]: v } as { [P in K]?: V });
}
