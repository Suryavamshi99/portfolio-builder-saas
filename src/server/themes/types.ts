/**
 * Theme templates: ready-made page designs filled with a user's resume facts.
 *
 * A theme is a page skeleton plus ONE JSON data island. Every string the page shows comes from that island, so a
 * single fact check (fact.ts) covers all of it, including text the theme's script draws at runtime.
 */

export const PROFESSIONS = [
  "Product",
  "Consulting",
  "Operations",
  "Marketing",
  "Data",
  "HR",
  "Sales",
  "Finance",
  "Founder's Office",
] as const;
export type Profession = (typeof PROFESSIONS)[number];

export const FEELS = ["Editorial", "Playable", "App-style", "3D"] as const;
export type Feel = (typeof FEELS)[number];

export type ThemeTier = "free" | "paid";

/** A short question for a theme's signature feature. Always skippable. */
export interface ThemeQuestion {
  /** Key under `content[signatureKey]`; the answer is stored there as plain text lines. */
  key: string;
  label: string;
  hint?: string;
}

export interface ThemeSection {
  /** Matches the id the template uses on the section element. */
  id: string;
  label: string;
}

/** CSS variables a user's typed look preferences may change. */
export interface ThemeCssVar {
  name: string; // e.g. "--accent"
  label: string;
}

export interface ThemeManifest {
  /** URL-safe id, also the folder name under src/server/themes. */
  id: string;
  /** Working name. The owner sets final names before launch. */
  name: string;
  tagline: string;
  profession: Profession;
  feel: Feel;
  tier: ThemeTier;
  /** True only after the theme was rendered in a browser and compared with its original. */
  ready: boolean;
  sections: ThemeSection[];
  questions: ThemeQuestion[];
  cssVars: ThemeCssVar[];
  /** Fonts a user may ask for (Google Fonts family names). */
  fonts: string[];
  /** CSS variables the theme reads its fonts from. Without them, font requests are declined. */
  fontVars?: { display?: string; body?: string };
  /** CSS variable the theme reads its corner radius from. Without it, corner requests are declined. */
  radiusVar?: string;
}

/**
 * What the page is filled with. The shape follows the sample sites' shared content file, so a theme's own script reads
 * it unchanged. Every field is optional: a missing one hides its section.
 */
export interface ThemeContent {
  meta?: { site_title?: string; description?: string };
  person?: {
    first_name?: string;
    last_name?: string;
    headline?: string;
    current?: string;
    looking_for?: string;
    location?: string;
  };
  contact?: {
    email?: string;
    phone?: string;
    linkedin?: string;
    resume_pdf?: string;
    [k: string]: string | undefined;
  };
  pitch?: { short?: string; why_hire?: string[] };
  about?: { intro?: string; now?: string };
  journey?: Array<Record<string, unknown>>;
  education?: Array<Record<string, unknown>>;
  experience?: Array<Record<string, unknown>>;
  projects?: Array<Record<string, unknown>>;
  skills?: Record<string, string[]>;
  certifications?: Array<Record<string, unknown>>;
  /** Signature answers, by question key: lines the user typed. */
  signature?: Record<string, string[]>;
  [k: string]: unknown;
}

export interface ThemeOptions {
  /** CSS variable name to a hex colour. */
  colors?: Record<string, string>;
  fontDisplay?: string;
  fontBody?: string;
  /** Corner style. */
  radius?: "sharp" | "soft" | "round";
  /** Section ids in the order to show them. */
  order?: string[];
  /** Section ids to hide. */
  hidden?: string[];
}

export interface ThemeRequest {
  id: string;
  /** Answers to the theme's signature questions, by question key. Skipped questions are absent. */
  answers?: Record<string, string>;
  /** The user's typed look and section preferences. */
  preferences?: string;
}

export const MAX_ANSWER_CHARS = 1500;
export const MAX_PREFERENCE_CHARS = 1000;

/** Validates the theme part of a request body. Returns null when it is not valid. */
export function parseThemeRequest(raw: unknown): ThemeRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r["id"] !== "string" || !/^[a-z0-9-]{1,40}$/.test(r["id"])) return null;
  const out: ThemeRequest = { id: r["id"] };
  if (r["answers"] !== undefined) {
    if (!r["answers"] || typeof r["answers"] !== "object" || Array.isArray(r["answers"])) return null;
    const answers: Record<string, string> = {};
    for (const [k, v] of Object.entries(r["answers"] as Record<string, unknown>)) {
      if (!/^[a-z0-9_]{1,40}$/.test(k) || typeof v !== "string" || v.length > MAX_ANSWER_CHARS) return null;
      if (v.trim()) answers[k] = v.trim();
    }
    out.answers = answers;
  }
  if (r["preferences"] !== undefined) {
    if (typeof r["preferences"] !== "string" || r["preferences"].length > MAX_PREFERENCE_CHARS) return null;
    if (r["preferences"].trim()) out.preferences = r["preferences"].trim();
  }
  return out;
}
