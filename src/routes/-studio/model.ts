import type { Content } from "@/data/content";

/* Factories + helpers for the /studio editor (dev only). */

export type Project = Content["projects"][number];
export type Role = Content["work"]["roles"][number];
export type SkillGroup = Content["skills"]["groups"][number];
export type Skill = SkillGroup["skills"][number];

/** Return a copy of `obj` with `key` set to `val`, or the key removed when `val` is empty. */
export function withOpt<T extends object>(obj: T, key: string, val: string): T {
  const next = { ...obj } as Record<string, unknown>;
  if (val.trim() === "") delete next[key];
  else next[key] = val;
  return next as T;
}

export function withLink(
  p: Project,
  key: "github" | "paper" | "external" | "demo",
  val: string,
): Project {
  const links = { ...(p.links ?? {}) } as Record<string, string>;
  if (val.trim() === "") delete links[key];
  else links[key] = val;
  const next = { ...p } as Record<string, unknown>;
  if (Object.keys(links).length === 0) delete next["links"];
  else next["links"] = links;
  return next as Project;
}

export const emptyProject = (): Project => ({
  slug: "",
  title: "",
  summary: "",
  date: new Date().toISOString().slice(0, 7),
});

export const emptyRole = (): Role => ({
  id: "",
  org: "",
  title: "",
  period: "",
  location: "",
  claim: "",
  groups: [],
});

export const emptySkillGroup = (): SkillGroup => ({
  id: "",
  title: "",
  claim: "",
  skills: [],
});

/** Per-project validation. Key = index, value = message. */
export function projectErrors(projects: Project[]): Map<number, string> {
  const errs = new Map<number, string>();
  const seen = new Map<string, number>();
  projects.forEach((p, i) => {
    const row = p as Record<string, unknown>;
    const missing = ["slug", "title", "summary", "date"].filter(
      (k) => String(row[k] ?? "").trim() === "",
    );
    if (missing.length) errs.set(i, `Missing ${missing.join(", ")}`);
    const slug = p.slug.trim();
    if (slug) {
      if (seen.has(slug)) errs.set(i, `Duplicate slug "${slug}"`);
      seen.set(slug, i);
    }
  });
  return errs;
}

export function serialize(draft: Content): string {
  return JSON.stringify(draft, null, 2) + "\n";
}
