import { SECTION_KEYS, sectionHasData, type Customisations, type PortfolioFacts, type SectionKey } from "../facts";

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
/** Escape text for HTML content and attribute values. Every user string goes through this. */
export function esc(v: string | undefined | null): string {
  return (v ?? "").replace(/[&<>"']/g, (c) => ESC[c] as string);
}
export const attr = esc;

/** JSON for an inline <script type="application/json"> or a JS literal: safe against </script>, <!-- and line separators. */
export function safeJson(v: unknown): string {
  return JSON.stringify(v).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

/** Inline JS that cannot close its own script tag. */
export function scriptTag(js: string): string {
  return `<script>${js.replace(/<\/(script)/gi, "<\\/$1")}</script>`;
}

/** Sections to render, in order: only those the layout supports, that have data, and that the user has not hidden. User order first. */
export function visibleSections(facts: PortfolioFacts, custom: Customisations, supported: readonly SectionKey[]): SectionKey[] {
  const ok = (k: SectionKey) => supported.includes(k) && !custom.hidden.includes(k) && sectionHasData(facts, k);
  const first = custom.order.filter(ok);
  const rest = supported.filter((k) => ok(k) && !first.includes(k));
  return [...first, ...rest];
}

const FONT_STACKS = {
  serif: { family: "Newsreader", stack: "'Newsreader', Georgia, serif" },
  sans: { family: "Inter", stack: "'Inter', system-ui, sans-serif" },
  mono: { family: "IBM Plex Mono", stack: "'IBM Plex Mono', ui-monospace, monospace" },
} as const;

/** The user's font choice, or null to keep the theme's own fonts. */
export function fontOverride(custom: Customisations): { family: string; stack: string } | null {
  return custom.fonts === "theme" ? null : FONT_STACKS[custom.fonts];
}

/** One Google Fonts stylesheet URL for the given families (the only outside resource a page may load). */
export function googleFontsHref(families: Array<string | { family: string; weights?: string }>): string {
  const parts = families.map((f) => {
    const { family, weights } = typeof f === "string" ? { family: f, weights: "400;500;600;700" } : { family: f.family, weights: f.weights ?? "400;500;600;700" };
    return `family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@${weights}`;
  });
  return `https://fonts.googleapis.com/css2?${parts.join("&")}&display=swap`;
}

/** The accent to use: the user's choice if it reads on the given background, otherwise the theme's. */
export function accentColour(custom: Customisations, themeDefault: string, background = "#ffffff"): string {
  const a = custom.accent;
  if (!a) return themeDefault;
  return contrast(a, background) >= 3 ? a : themeDefault;
}

function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (c[0] as number) + 0.7152 * (c[1] as number) + 0.0722 * (c[2] as number);
}
export function contrast(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return ((x as number) + 0.05) / ((y as number) + 0.05);
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

/** Only these URL shapes may appear in a link href. */
export function safeHref(url: string | undefined): string | null {
  if (!url) return null;
  const u = url.trim();
  return /^(https?:\/\/|mailto:|tel:|#)/i.test(u) ? u : /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(u) ? `https://${u}` : null;
}

/** An <img> for the user's photo, or "" when they gave none. Never a placeholder. */
export function photoTag(facts: PortfolioFacts, opts: { alt?: string; className?: string } = {}): string {
  if (!facts.photoUrl) return "";
  const cls = opts.className ? ` class="${attr(opts.className)}"` : "";
  return `<img src="${attr(facts.photoUrl)}" alt="${attr(opts.alt ?? facts.name)}"${cls}>`;
}

export { SECTION_KEYS };
