import type { PortfolioFacts } from "../facts";

// A tiny grey square: a stand-in for the user's photo in tests and previews.
export const FIXTURE_PHOTO = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#9aa3b2"/><circle cx="200" cy="160" r="70" fill="#e6e9ef"/><rect x="80" y="250" width="240" height="150" rx="80" fill="#e6e9ef"/></svg>');

/** A full resume: every section has data. Fictional person and employers. */
export const RICH_FACTS: PortfolioFacts = {
  name: "Jordan Ellis",
  headline: "Product manager",
  tagline: "Turns messy customer problems into shipped products",
  summary: "Product manager with 7 years across logistics and fintech. Led a team of 12 and shipped a returns portal that cut support tickets by 38%.",
  location: "Leeds, United Kingdom",
  email: "jordan.ellis@example.com",
  phone: "+44 7700 900123",
  photoUrl: FIXTURE_PHOTO,
  links: [
    { label: "LinkedIn", url: "https://www.linkedin.com/in/jordan-ellis-example" },
    { label: "GitHub", url: "https://github.com/jordan-ellis-example" },
  ],
  stats: [
    { value: "7 years", label: "in product" },
    { value: "38%", label: "fewer support tickets" },
    { value: "12", label: "people led" },
  ],
  experience: [
    { org: "Harbourline Freight", role: "Senior Product Manager", period: "2021 - Present", location: "Leeds", summary: "Owns the customer portal.", bullets: ["Shipped a returns portal that cut support tickets by 38%", "Led a team of 12 across 3 squads"] },
    { org: "Brightpay", role: "Product Manager", period: "2018 - 2021", bullets: ["Launched invoicing for 4,500 small businesses"] },
  ],
  projects: [
    { name: "Returns Portal", description: "Self-serve returns for freight customers.", role: "Product lead", period: "2022", link: "https://example.com/returns", metrics: [{ value: "38%", label: "fewer tickets" }], tags: ["B2B", "Self-serve"], bullets: ["Interviewed 40 customers"] },
    { name: "Invoice Lite", description: "Invoicing for small businesses.", metrics: [{ value: "4,500", label: "businesses" }], tags: ["Fintech"], bullets: [] },
  ],
  education: [{ school: "University of Leeds", degree: "BSc Business Information Systems", period: "2014 - 2017", detail: "First class honours" }],
  skills: [
    { group: "Product", items: ["Roadmapping", "Discovery", "Pricing"] },
    { group: "Tools", items: ["SQL", "Figma", "Jira"] },
  ],
  achievements: [{ title: "Product Team of the Year", detail: "Harbourline Freight", year: "2023" }],
  certifications: [{ name: "Certified Scrum Product Owner", issuer: "Scrum Alliance", year: "2020" }],
  testimonials: [{ quote: "Jordan made hard trade-offs easy to follow.", author: "Dana Whitfield", role: "Head of Operations" }],
  extras: [{ label: "Languages", items: ["English", "French"] }],
};

/** A thin resume: name, one role, one skill list. Every other section must be hidden, with no placeholder text. */
export const SPARSE_FACTS: PortfolioFacts = {
  name: "Sam Rivera",
  links: [],
  stats: [],
  experience: [{ org: "Northgate Studio", role: "Designer", bullets: [] }],
  projects: [],
  education: [],
  skills: [{ items: ["Figma", "Prototyping"] }],
  achievements: [],
  certifications: [],
  testimonials: [],
  extras: [],
};
