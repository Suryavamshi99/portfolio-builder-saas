import { z } from "zod";

/**
 * CONTENT SCHEMA
 * ------------------------------------------------------------------
 * The single, shared schema for a portfolio's content — filled in either
 * by the BYOK resume-extraction endpoint or hand-edited in /studio.
 * Ported from the personal-portfolio repo's `src/data/content.ts`
 * (same shape) — kept in sync manually for now. In this repo there is no
 * static `content.json`: each user's Content lives as a row in the DB,
 * loaded per-request by the authenticated /studio route (see API.md,
 * milestone 2).
 */

const linkTuple = z.object({
  github: z.string().optional(),
  paper: z.string().optional(),
  external: z.string().optional(),
  demo: z.string().optional(),
});

const projectBlock = z.object({
  heading: z.string().optional(),
  text: z.string().optional(),
  points: z.array(z.string()).optional(),
});

const project = z.object({
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  category: z.string().optional(),
  date: z.string(),
  status: z.enum(["shipped", "ongoing", "exploration"]).optional(),
  role: z.string().optional(),
  links: linkTuple.optional(),
  tech: z.array(z.string()).optional(),
  images: z.array(z.object({ src: z.string(), alt: z.string() })).optional(),
  body: z.array(projectBlock).optional(),
  counterpoint: z.string().optional(),
});

const metric = z.object({ value: z.string(), label: z.string() });

const role = z.object({
  id: z.string(),
  org: z.string(),
  orgNote: z.string().optional(),
  title: z.string(),
  period: z.string(),
  location: z.string(),
  claim: z.string(),
  metrics: z.array(metric).optional(),
  groups: z.array(z.object({ heading: z.string(), points: z.array(z.string()) })),
});

const education = z.object({
  org: z.string(),
  qualification: z.string(),
  period: z.string(),
  location: z.string(),
  notes: z.array(z.string()),
});

const skill = z.object({
  name: z.string(),
  evidence: z.string(),
  href: z.string().optional(),
  logo: z.string().optional(),
});

const skillGroup = z.object({
  id: z.string(),
  title: z.string(),
  claim: z.string(),
  skills: z.array(skill),
});

export const contentSchema = z.object({
  profile: z.object({
    name: z.string(),
    role: z.string(),
    location: z.string(),
    thesis: z.string(),
    portrait: z.string(),
    phone: z.string(),
    emails: z.array(z.object({ label: z.string(), value: z.string() })),
    links: z.object({
      linkedin: z.string(),
      github: z.string(),
      instagram: z.string().optional().default(""),
    }),
  }),
  nav: z.array(
    z.object({
      to: z.string(),
      label: z.string(),
      short: z.string(),
      index: z.string(),
    }),
  ),
  resumes: z.array(
    z.object({
      label: z.string(),
      description: z.string(),
      url: z.string(),
      filename: z.string(),
    }),
  ),
  home: z.object({
    nowTitle: z.string(),
    nowText: z.string(),
    marquee: z.array(z.string()),
  }),
  about: z.object({
    title: z.string(),
    intro: z.string(),
    stats: z.array(metric),
    offHours: z.array(
      z.object({
        title: z.string(),
        note: z.string(),
        icon: z.enum(["film", "racquet", "philosophy", "running", "generic"]),
      }),
    ),
  }),
  work: z.object({
    roles: z.array(role),
    education: z.array(education),
    certifications: z.array(z.object({ name: z.string(), year: z.string() })),
  }),
  skills: z.object({ groups: z.array(skillGroup) }),
  projects: z.array(project),
});

export type Content = z.infer<typeof contentSchema>;

/**
 * Empty Content used only where a value is required before a real row
 * has loaded (new-account bootstrap, Editor default state in isolation).
 * Never persisted as-is — /studio always overwrites it with the fetched
 * per-user row before the editor is interactive.
 */
export const emptyContent: Content = {
  profile: {
    name: "",
    role: "",
    location: "",
    thesis: "",
    portrait: "",
    phone: "",
    emails: [],
    links: { linkedin: "", github: "", instagram: "" },
  },
  nav: [],
  resumes: [],
  home: { nowTitle: "", nowText: "", marquee: [] },
  about: { title: "", intro: "", stats: [], offHours: [] },
  work: { roles: [], education: [], certifications: [] },
  skills: { groups: [] },
  projects: [],
};

/** Placeholder for local dev until milestone 2 wires /studio to a real per-user fetch. */
export const content: Content = emptyContent;
