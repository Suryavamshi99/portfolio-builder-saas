import { captureBrandFromUrl, type BrandCapture } from "./capture";
import type { ReplicaParams } from "./replica";

/** Google Fonts stand-ins for common site fonts. Keys are lower case. */
const FONT_MAP: Record<string, string> = {
  helvetica: "Inter",
  "helvetica neue": "Inter",
  arial: "Inter",
  "sf pro": "Inter",
  "sf pro display": "Inter",
  "sf pro text": "Inter",
  "segoe ui": "Inter",
  graphik: "Inter",
  roboto: "Roboto",
  gotham: "Montserrat",
  "proxima nova": "Montserrat",
  avenir: "Nunito Sans",
  "avenir next": "Nunito Sans",
  futura: "Jost",
  circular: "DM Sans",
  "circular std": "DM Sans",
  "neue haas grotesk": "Inter",
  georgia: "Lora",
  "times new roman": "Tinos",
  times: "Tinos",
  garamond: "EB Garamond",
  didot: "Playfair Display",
  bodoni: "Playfair Display",
  "playfair display": "Playfair Display",
  courier: "IBM Plex Mono",
  "courier new": "IBM Plex Mono",
  menlo: "JetBrains Mono",
  monaco: "JetBrains Mono",
  consolas: "JetBrains Mono",
  "sf mono": "JetBrains Mono",
};

/** Families that already exist on Google Fonts, used as they are. */
const GOOGLE_NATIVE = new Set(
  [
    "Inter", "Roboto", "Poppins", "Montserrat", "Open Sans", "Lato", "DM Sans", "Manrope", "Space Grotesk", "Merriweather",
    "IBM Plex Sans", "IBM Plex Serif", "IBM Plex Mono", "Work Sans", "Raleway", "Nunito", "Nunito Sans", "Source Sans 3",
    "Source Serif 4", "Lora", "Playfair Display", "Plus Jakarta Sans", "Outfit", "Sora", "Figtree", "Rubik", "Karla",
    "JetBrains Mono", "Fira Sans", "Fira Code", "Space Mono", "Bricolage Grotesque", "Instrument Serif", "Fraunces",
  ].map((f) => f.toLowerCase()),
);

export interface FontChoice {
  family: string;
  /** False when the closest match was a guess from the font's name. */
  exact: boolean;
}

/** The closest Google Font for a captured family name. Never throws; unknown names fall back by keyword, then to Inter. */
export function closestGoogleFont(name: string): FontChoice {
  const key = name.replace(/["']/g, "").trim().toLowerCase();
  if (GOOGLE_NATIVE.has(key)) return { family: titleCase(key), exact: true };
  const mapped = FONT_MAP[key];
  if (mapped) return { family: mapped, exact: false };
  if (/mono|code|console/.test(key)) return { family: "JetBrains Mono", exact: false };
  if (/serif/.test(key) && !/sans/.test(key)) return { family: "Source Serif 4", exact: false };
  if (/display|grotesk|grotesque/.test(key)) return { family: "Space Grotesk", exact: false };
  return { family: "Inter", exact: false };
}

function titleCase(s: string): string {
  const special: Record<string, string> = { "ibm plex sans": "IBM Plex Sans", "ibm plex serif": "IBM Plex Serif", "ibm plex mono": "IBM Plex Mono", "dm sans": "DM Sans", "jetbrains mono": "JetBrains Mono" };
  return special[s] ?? s.replace(/\b\w/g, (c) => c.toUpperCase());
}

const TONE_WORDS: Array<[RegExp, string]> = [
  [/\b(build|ship|engineer|developer|api|platform|data|infrastructure|code)\b/i, "technical"],
  [/\b(play|fun|joy|love|delight|happy|friends?)\b/i, "playful"],
  [/\b(premium|luxury|craft|heritage|elegant|exclusive)\b/i, "refined"],
  [/\b(simple|easy|minimal|clear|plain)\b/i, "plain-spoken"],
  [/\b(bold|disrupt|revolution|future|reimagin|change the world)\b/i, "bold"],
  [/\b(trust|secure|safe|reliable|enterprise|compliance)\b/i, "dependable"],
  [/\b(together|community|people|team|human|care)\b/i, "warm"],
  [/\b(fast|speed|instant|quick|now)\b/i, "energetic"],
];

/** A few tone words from the site's headings, without repeating any of its wording. */
export function toneWords(voice: string[], description = ""): string[] {
  const text = [...voice, description].join(" . ");
  const words = TONE_WORDS.filter(([re]) => re.test(text)).map(([, w]) => w);
  return words.length ? words.slice(0, 4) : ["clear", "confident"];
}

function classifyNav(label: string): string | null {
  const l = label.toLowerCase();
  if (/about|story|who we|mission|team/.test(l)) return "About";
  if (/product|solution|work|project|case|platform|feature|portfolio|app/.test(l)) return "Projects";
  if (/skill|stack|tech|capab|service/.test(l)) return "Skills";
  if (/contact|talk|demo|get started|sign|book|join|career/.test(l)) return "Contact";
  if (/blog|news|resource|learn|docs|writing|insight/.test(l)) return "Writing";
  return null; // pricing, login, customers and the like have no honest equivalent for a person
}

function classifySection(heading: string, index: number): string {
  const l = heading.toLowerCase();
  if (index === 0) return "hero";
  if (/customer|testimonial|trusted|loved|review/.test(l)) return "logo or quote strip (leave out: we never invent reviews)";
  if (/pricing|plan/.test(l)) return "(skip: no pricing for a person)";
  if (/feature|why|benefit|how it works|capab/.test(l)) return "feature grid, used for the person's skills or strengths";
  if (/product|solution|work|case|project/.test(l)) return "card grid, used for the person's projects";
  if (/about|story|mission|team/.test(l)) return "story block, used for the person's summary";
  if (/contact|start|demo|join|ready/.test(l)) return "closing call to action, used for contact";
  return "content block";
}

function skeleton(brand: BrandCapture): string {
  const lines: string[] = [];
  if (brand.nav.length) {
    const roles = [...new Set(brand.nav.map(classifyNav).filter((r): r is string => !!r))];
    lines.push(
      `Header: a top bar with ${Math.min(brand.nav.length, 6)} links in the company's style. Label them only with the person's own sections${roles.length ? ` (suggested: ${roles.join(", ")})` : ""}. Never use the company's menu wording.`,
    );
  }
  if (brand.sections.length) {
    const blocks = brand.sections.map((s, i) => classifySection(s, i)).filter((s) => !s.startsWith("(skip") && !s.includes("leave out"));
    lines.push(`Page rhythm from top to bottom: ${blocks.join(" > ")}. This is structure only. Fill every block from the resume.`);
  }
  if (!lines.length) lines.push("The site's structure could not be read. Use a simple header, a hero, then the person's sections.");
  return lines.join("\n");
}

export interface ReplicaBrief {
  brief: string;
  warnings: string[];
  /** The name used in the disclaimer. */
  companyName: string;
}

function safeName(raw: string): string {
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
}

export function companyNameFor(replica: { url: string; company?: string | undefined }, brand?: BrandCapture): string {
  const typed = replica.company ? safeName(replica.company) : "";
  if (typed) return typed;
  const site = brand ? safeName(brand.name.split(/[|–—-]/)[0] ?? "") : "";
  if (site) return site;
  try {
    return new URL(replica.url).hostname.replace(/^www\./, "");
  } catch {
    return "the company";
  }
}

export const DISCLAIMER_TEXT = (name: string, company: string) => `An independent concept by ${name}, not affiliated with ${company}.`;

const HARD_RULES = (company: string) =>
  [
    "HARD RULES for this page:",
    `- Show this sentence in a visible line at the very top of the page (readable without scrolling) and again in the footer, with the person's real name: "An independent concept by <the person's name>, not affiliated with ${company}."`,
    '- Put <meta name="robots" content="noindex,nofollow"> in the head.',
    `- Never use ${company}'s logo, images, icons, code or any of its text. Describe nothing as ${company}'s product, and never claim the person works there or was hired, endorsed or approved by them.`,
    "- Do not invent reviews, ratings, offers, prices, customer names or statistics. Only the resume provides facts.",
    "- Use Google Fonts only, loaded from fonts.googleapis.com.",
    "- The page must be the person's own portfolio in the company's visual style: same kind of layout, colours, type feel and UI patterns, with the person's own details in every slot.",
  ].join("\n");

/** Turns a captured brand into the design brief handed to the page writer. Describes style and structure; carries none of the company's text. */
export function buildReplicaBrief(brand: BrandCapture | null, replica: { url: string; company?: string | undefined }): ReplicaBrief {
  const company = companyNameFor(replica, brand ?? undefined);
  const warnings: string[] = [];
  const parts: string[] = [`DESIGN BRIEF: build this person's portfolio so it feels like the website of ${company}, as an independent concept.`];

  if (!brand || brand.needsScreenshots) {
    warnings.push(`We couldn't read ${company}'s site automatically, so the look follows your screenshots.`);
    parts.push("The company's site could not be read. Take colours, layout, type feel and UI patterns only from the attached screenshots. Do not guess anything the screenshots do not show.");
    parts.push(HARD_RULES(company));
    return { brief: parts.join("\n\n"), warnings, companyName: company };
  }

  const roleEntries = Object.entries(brand.roles);
  if (roleEntries.length) {
    parts.push(`Colour roles: ${roleEntries.map(([r, hex]) => `${r} ${hex}`).join(", ")}.${brand.palette.length ? ` Other colours seen, most used first: ${brand.palette.join(", ")}.` : ""}`);
  } else if (brand.palette.length) {
    parts.push(`Main colours, most used first: ${brand.palette.join(", ")}. Use the first as the accent and a calm neutral for the page background and text unless the screenshots show otherwise.`);
  } else {
    warnings.push("We couldn't read the site's main colours, so a neutral palette was used.");
    parts.push("Main colours were not captured. Use a neutral palette (off-white and near-black with one restrained accent), or match the screenshots if given. Do not guess brand colours.");
  }

  if (brand.fonts.length) {
    const choices = brand.fonts.map((f) => closestGoogleFont(f));
    const unique = [...new Map(choices.map((c) => [c.family, c])).values()];
    parts.push(`Typography: use these Google Fonts for the same feel: ${unique.map((c) => c.family).join(", ")} (headings first, then body). The site's own fonts are not available to us.`);
    if (unique.some((c) => !c.exact)) warnings.push("The site's fonts aren't on Google Fonts, so the closest matches were used.");
  } else {
    warnings.push("We couldn't read the site's fonts, so Inter was used.");
    parts.push("Fonts were not captured. Use Inter from Google Fonts, or match the screenshots' type feel if given.");
  }

  parts.push(`Layout skeleton (structure only):\n${skeleton(brand)}`);

  if (brand.voice.length) {
    parts.push(`Tone of the site, for the feel of the person's own wording only: ${toneWords(brand.voice, brand.description).join(", ")}. Do not reuse or paraphrase the company's sentences. The person's own resume stays the only source of text.`);
  } else {
    warnings.push("We couldn't read the site's tone, so a clear, confident voice was used.");
    parts.push("Tone was not captured. Write plainly and confidently from the resume.");
  }

  parts.push(HARD_RULES(company));
  return { brief: parts.join("\n\n"), warnings, companyName: company };
}

export interface ReplicaResolution {
  brief: string;
  companyName: string;
  warnings: string[];
  /** True when the site could not be read, so the build may only continue from the user's screenshots. */
  needsImages: boolean;
}

/** Reads the site once and returns the brief. A continued build reuses what the first run stored. */
export async function resolveReplica(replica: ReplicaParams, capture: typeof captureBrandFromUrl = captureBrandFromUrl): Promise<ReplicaResolution> {
  if (replica.brief && replica.companyName) {
    return { brief: replica.brief, companyName: replica.companyName, warnings: replica.warnings ?? [], needsImages: replica.needsImages === true };
  }
  let result: Awaited<ReturnType<typeof captureBrandFromUrl>>;
  try {
    result = await capture(replica.url);
  } catch {
    result = { ok: false, message: "unreadable" };
  }
  if (!result.ok) return { ...buildReplicaBrief(null, replica), needsImages: true };
  return { ...buildReplicaBrief(result.brand, replica), needsImages: result.brand.needsScreenshots };
}
