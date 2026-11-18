import { z } from "zod";

/** The sections a theme can show, in the default order. A section is shown only when it has data and is not hidden. */
export const SECTION_KEYS = ["about", "experience", "projects", "skills", "education", "achievements", "certifications", "testimonials", "extras", "contact"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

const s = (max = 400) => z.string().trim().min(1).max(max);
const link = z.object({ label: s(60), url: s(300) });
const stat = z.object({ value: s(40), label: s(80) });

/**
 * Everything the resume and the user's attached details say, as data. This is the ONLY input a template renders.
 * Every string must come from the resume or the user's details: nothing is invented, and a field with no source is left out
 * (optional fields absent, lists empty). Templates hide any section whose data is empty.
 */
export const portfolioFactsSchema = z.object({
  name: s(80),
  headline: s(160).optional(), // e.g. "Product manager"
  tagline: s(240).optional(), // one line the resume supports
  summary: s(1200).optional(),
  location: s(80).optional(),
  email: s(120).optional(),
  phone: s(40).optional(),
  photoUrl: s(2000).optional(), // a shipfolio-storage:// marker or a data:image URL; never an external URL
  links: z.array(link).max(12).default([]), // verified links: LinkedIn, GitHub, site, etc.
  stats: z.array(stat).max(6).default([]), // headline numbers that appear in the resume
  experience: z
    .array(z.object({ org: s(120), role: s(120), period: s(60).optional(), location: s(80).optional(), summary: s(600).optional(), bullets: z.array(s(500)).max(8).default([]) }))
    .max(12)
    .default([]),
  projects: z
    .array(
      z.object({
        name: s(120),
        description: s(700).optional(),
        role: s(100).optional(),
        period: s(60).optional(),
        link: z.string().trim().max(300).optional(),
        metrics: z.array(stat).max(4).default([]),
        tags: z.array(s(40)).max(8).default([]),
        bullets: z.array(s(400)).max(6).default([]),
      }),
    )
    .max(12)
    .default([]),
  education: z.array(z.object({ school: s(140), degree: s(140).optional(), period: s(60).optional(), detail: s(300).optional() })).max(6).default([]),
  skills: z.array(z.object({ group: s(60).optional(), items: z.array(s(60)).min(1).max(24) })).max(8).default([]),
  achievements: z.array(z.object({ title: s(160), detail: s(300).optional(), year: s(10).optional() })).max(10).default([]),
  certifications: z.array(z.object({ name: s(140), issuer: s(100).optional(), year: s(10).optional() })).max(10).default([]),
  testimonials: z.array(z.object({ quote: s(500), author: s(80), role: s(100).optional() })).max(6).default([]),
  extras: z.array(z.object({ label: s(60), items: z.array(s(100)).min(1).max(12) })).max(4).default([]), // languages, interests, volunteering
});
export type PortfolioFacts = z.infer<typeof portfolioFactsSchema>;

export const FONT_CHOICES = ["theme", "serif", "sans", "mono"] as const;

/** What the user changed on top of the theme. Look and sections only; the theme keeps its layout. */
export const customisationsSchema = z.object({
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), // replaces the theme's main accent colour
  fonts: z.enum(FONT_CHOICES).default("theme"),
  hidden: z.array(z.enum(SECTION_KEYS)).default([]),
  order: z.array(z.enum(SECTION_KEYS)).default([]), // sections listed here come first, in this order
});
export type Customisations = z.infer<typeof customisationsSchema>;
export const NO_CUSTOMISATIONS: Customisations = { fonts: "theme", hidden: [], order: [] };

/** True when the facts have something to show for this section. */
export function sectionHasData(f: PortfolioFacts, key: SectionKey): boolean {
  switch (key) {
    case "about": return Boolean(f.summary || f.tagline);
    case "experience": return f.experience.length > 0;
    case "projects": return f.projects.length > 0;
    case "skills": return f.skills.length > 0;
    case "education": return f.education.length > 0;
    case "achievements": return f.achievements.length > 0;
    case "certifications": return f.certifications.length > 0;
    case "testimonials": return f.testimonials.length > 0;
    case "extras": return f.extras.length > 0;
    case "contact": return Boolean(f.email || f.phone || f.links.length > 0);
  }
}

/** Every string in the facts as one text, used as the reference for the fact check. */
export function factsText(f: PortfolioFacts): string {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(f);
  return out.join("\n");
}
