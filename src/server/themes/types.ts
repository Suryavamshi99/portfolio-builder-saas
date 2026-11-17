/**
 * A theme is a design language, not a template: a short brief the page-writing model follows (palette, type, layout,
 * interaction), so every portfolio is written from the user's own resume in that look. The brief carries no facts.
 */
export const PROFESSIONS = ["Product", "Consulting", "Operations", "Marketing", "Data", "HR", "Sales", "Finance", "Founder's Office"] as const;
export type Profession = (typeof PROFESSIONS)[number];

export const FEELS = ["Editorial", "Playable", "App-style", "3D"] as const;
export type Feel = (typeof FEELS)[number];

export type ThemeTier = "free" | "paid";

export interface Theme {
  /** URL-safe id; stored in the job so a rebuild keeps the look. */
  id: string;
  name: string;
  tagline: string;
  /** The job this look suits best. Any user may pick any theme. */
  profession: Profession;
  feel: Feel;
  tier: ThemeTier;
  /** Swatches for the gallery card: background first, accent last. */
  palette: string[];
  /** Google Fonts family names the look uses. */
  fonts: string[];
  /** Design direction handed to the model. No names, numbers or claims about any person. */
  brief: string;
  /** Code-derived design fingerprint of the original sample (techniques, scripted behaviours, outline). Facts-free. */
  reference?: string | undefined;
}

export interface ThemeRequest {
  id: string;
}

/** Validates the theme part of a request body. Returns null when it is not valid. */
export function parseThemeRequest(raw: unknown): ThemeRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const id = (raw as Record<string, unknown>)["id"];
  return typeof id === "string" && /^[a-z0-9-]{1,40}$/.test(id) ? { id } : null;
}
