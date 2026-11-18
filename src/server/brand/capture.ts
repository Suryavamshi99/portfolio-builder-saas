import * as cheerio from "cheerio";

import { fetchPublicSite } from "./safe-fetch";

/**
 * Reads a company's public page for its look: colours, fonts and a few words of its own voice.
 * Everything here describes the COMPANY. It is used only to style and tone a portfolio, never as a fact about the user.
 */
export interface BrandCapture {
  name: string;
  description: string;
  palette: string[]; // up to 5 hex colours, most used first
  fonts: string[]; // up to 3 font family names, most used first
  voice: string[]; // up to 5 short headings from the page, for tone only
  roles: Record<string, string>; // colour roles read from CSS custom properties (primary, background, text, ...)
  nav: string[]; // up to 8 menu labels, in order: the page structure, not content to copy
  sections: string[]; // up to 10 section headings in page order
  /** True when the page was empty, a bot check or script-only: ask for screenshots instead of guessing. */
  needsScreenshots: boolean;
}

const ROLE_WORDS: Array<[string, RegExp]> = [
  ["primary", /(primary|brand|main)/i],
  ["accent", /accent|highlight/i],
  ["background", /(^|-)(bg|background|canvas|page)(-|$)/i],
  ["surface", /surface|card|panel/i],
  ["text", /(^|-)(text|foreground|fg|ink)(-|$)/i],
  ["muted", /muted|secondary-text/i],
  ["border", /border|divider|line/i],
];

/** Colour roles from `:root { --name: #hex }` lines, which is where brands usually keep them. */
export function rolesFromCss(css: string): Record<string, string> {
  const roles: Record<string, string> = {};
  for (const m of css.matchAll(/--([a-z0-9-]+)\s*:\s*([^;}]+)/gi)) {
    const hex = normaliseHex((m[2] ?? "").trim());
    if (!hex) continue;
    for (const [role, re] of ROLE_WORDS) {
      if (!roles[role] && re.test(m[1] ?? "")) {
        roles[role] = hex;
        break;
      }
    }
  }
  return roles;
}

const GENERIC_FONTS = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "inherit", "initial", "unset"]);
const NEUTRAL = /^#(0{3,6}|f{3}|f{6}|fff|ffffff|000|000000)$/i;

function normaliseHex(raw: string): string | null {
  const m = raw.trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(m);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(m)) return m.toLowerCase();
  const rgb = /^rgba?\(\s*(\d{1,3})[,\s]+(\d{1,3})[,\s]+(\d{1,3})/i.exec(m);
  if (rgb) {
    const parts = rgb.slice(1, 4).map((n) => Math.min(255, Number(n)));
    return `#${parts.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  }
  return null;
}

/** Colours from CSS text, most frequent first, leaving out pure black and white. */
export function paletteFromCss(css: string): string[] {
  const counts = new Map<string, number>();
  const pattern = /#[0-9a-f]{3}(?:[0-9a-f]{3})?\b|rgba?\(\s*\d{1,3}[,\s]+\d{1,3}[,\s]+\d{1,3}/gi;
  for (const match of css.match(pattern) ?? []) {
    const hex = normaliseHex(match);
    if (!hex || NEUTRAL.test(hex)) continue;
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([hex]) => hex);
}

/** Font family names from CSS text, most frequent first, without generic fallbacks. */
export function fontsFromCss(css: string): string[] {
  const counts = new Map<string, number>();
  for (const block of css.match(/font-family\s*:[^;}{]+/gi) ?? []) {
    const first = block.replace(/font-family\s*:/i, "").split(",")[0] ?? "";
    const name = first.replace(/["']/g, "").trim();
    if (!name || GENERIC_FONTS.has(name.toLowerCase()) || name.length > 60) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name);
}

const BLOCK_PAGE = /captcha|checking your browser|verify you are (a )?human|access denied|enable javascript/i;

/** Reads a fetched page (plus any CSS fetched from its stylesheets). Never throws: a thin page returns empty lists. */
export function captureBrand(html: string, extraCss = ""): BrandCapture {
  const $ = cheerio.load(html);
  const styleText = $("style").map((_, el) => $(el).text()).get().join("\n");
  const inlineText = $("[style]").map((_, el) => $(el).attr("style") ?? "").get().join("\n");
  const css = `${styleText}\n${inlineText}\n${extraCss}`;
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const nav = $("nav a, header a")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter((t) => t.length >= 2 && t.length <= 30);
  const sections = $("h1, h2")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter((t) => t.length >= 3 && t.length <= 80);

  const name = ($("meta[property='og:site_name']").attr("content") || $("title").first().text() || "").replace(/\s+/g, " ").trim().slice(0, 80);
  const description = ($("meta[name='description']").attr("content") || $("meta[property='og:description']").attr("content") || "").replace(/\s+/g, " ").trim().slice(0, 200);
  const voice = $("h1, h2")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter((t) => t.length >= 4 && t.length <= 120)
    .slice(0, 5);

  const palette = paletteFromCss(css);
  const needsScreenshots = BLOCK_PAGE.test(bodyText.slice(0, 600)) || (bodyText.length < 200 && palette.length === 0);
  return {
    name,
    description,
    palette,
    fonts: fontsFromCss(css),
    voice,
    roles: rolesFromCss(css),
    nav: [...new Set(nav)].slice(0, 8),
    sections: [...new Set(sections)].slice(0, 10),
    needsScreenshots,
  };
}

const MAX_STYLESHEETS = 4;
const MAX_CSS_CHARS = 600_000;

/** Fetches a company page safely, then up to four of its stylesheets (same address checks), and reads the brand from all of it. */
export async function captureBrandFromUrl(
  url: string,
  fetcher: typeof fetchPublicSite = fetchPublicSite,
): Promise<{ ok: true; brand: BrandCapture; url: string } | { ok: false; message: string }> {
  const page = await fetcher(url);
  if (!page.ok) return { ok: false, message: page.message };
  const $ = cheerio.load(page.html);
  const hrefs = $("link[rel~='stylesheet'][href]")
    .map((_, el) => $(el).attr("href") ?? "")
    .get()
    .slice(0, MAX_STYLESHEETS);
  let css = "";
  for (const href of hrefs) {
    let abs: string;
    try {
      abs = new URL(href, page.url).toString();
    } catch {
      continue;
    }
    const sheet = await fetcher(abs, undefined, "css");
    if (sheet.ok) css += `\n${sheet.html}`;
    if (css.length > MAX_CSS_CHARS) break;
  }
  return { ok: true, url: page.url, brand: captureBrand(page.html, css.slice(0, MAX_CSS_CHARS)) };
}
