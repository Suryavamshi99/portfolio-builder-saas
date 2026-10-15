/**
 * Step-by-step page generation for the free models.
 *
 * A free model cannot write a whole page in one call (a few tokens a second, and the
 * provider and our own limits cut the call off), so the page is built in small steps,
 * each one a short model call whose result is saved:
 *   plan -> design -> hero -> one call per section -> assemble + checks.
 * Every step has a fallback made in code, so a build always finishes.
 */
import type { ProfileLinks } from "@/server/llm";

export type SectionKind = "about" | "experience" | "projects" | "skills" | "education" | "certifications" | "contact" | "other";

export interface Theme {
  mood: string;
  colors: { bg: string; surface: string; text: string; muted: string; accent: string; accent2: string };
  fonts: { display: string; body: string };
}

/** The page's character, chosen from fixed menus. Each choice maps to vetted CSS (default-design.ts), so contrast and layout stay safe. */
export interface Design {
  hero: "plain" | "glow" | "split" | "band";
  heading: "plain" | "marker" | "highlight" | "rule";
  cards: "flat" | "bordered" | "accent-bar" | "lifted";
  radius: "sharp" | "soft" | "round";
  motion: "none" | "rise";
}

export const DESIGN_OPTIONS: { [K in keyof Design]: readonly Design[K][] } = {
  hero: ["plain", "glow", "split", "band"],
  heading: ["plain", "marker", "highlight", "rule"],
  cards: ["flat", "bordered", "accent-bar", "lifted"],
  radius: ["sharp", "soft", "round"],
  motion: ["none", "rise"],
};

export interface PlanSection {
  /** Anchor id, lowercase letters, digits and hyphens. */
  id: string;
  title: string;
  kind: SectionKind;
  /** 1-based inclusive line ranges of the resume that belong to this section. Our code slices the text, the model never copies it. */
  lines: Array<[number, number]>;
}

export interface Plan {
  name: string;
  headline: string;
  tagline: string;
  theme: Theme;
  design: Design;
  sections: PlanSection[];
}

export interface StepLogEntry {
  step: string;
  provider: string | null;
  ms: number;
  ok: boolean;
  note?: string;
}

/** Everything saved between steps, in generation_jobs.params.pipeline. */
export interface PipelineState {
  v: 1;
  plan?: Plan;
  planFallback?: boolean;
  css?: string;
  /** Finished page parts by key: "hero" or a section id. */
  fragments: Record<string, string>;
  /** Keys whose part was made in code because the models could not produce it. */
  fallbacks: string[];
  /** Steps finished, in order: "plan", "design", "hero", section ids, then "finish". */
  done: string[];
  /** The one-correction round after the fact check has been used. */
  repaired?: boolean;
  log: StepLogEntry[];
  lease?: { owner: string; until: string };
}

export const emptyState = (): PipelineState => ({ v: 1, fragments: {}, fallbacks: [], done: [], log: [] });

/** What the steps need to know about the person's inputs. */
export interface BuildInput {
  /** The resume, one entry per line (line N in the plan is lines[N - 1]). */
  lines: string[];
  specifics?: string | undefined;
  instructions?: string | undefined;
  designIntensity: "minimal" | "bold";
  photoUrl?: string | undefined;
  links: ProfileLinks;
}

/** Steps after the plan, in order, for a plan. */
export function stepsFor(plan: Plan): string[] {
  return ["design", "hero", ...plan.sections.map((s) => s.id), "finish"];
}

/** { done, total } for the progress bar. Before the plan exists the total is an estimate. */
export function progressOf(state: PipelineState | undefined): { done: number; total: number } {
  if (!state) return { done: 0, total: 9 };
  const total = state.plan ? 1 + stepsFor(state.plan).length : 9;
  return { done: Math.min(state.done.length, total), total };
}
