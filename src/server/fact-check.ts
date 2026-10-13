import * as cheerio from "cheerio";
import { WATERMARK_ATTR } from "@/server/watermark";

/**
 * Fact check (plan 6.1 step 4), first version: numeric claims only. Numbers,
 * percentages, money, years and dates on the page must appear in the reference
 * text (resume + the user's specifics + verified links). Employer and
 * certification names are not checked yet: spotting them without a language
 * model rejects too many good pages.
 *
 * Matching is by value, not by unit: "$120,000" matches "$120k", "2.5 million"
 * matches "2.5M". A value that appears anywhere in the reference counts, so a
 * number reused with a different unit can slip through; that is the accepted
 * trade-off against rejecting real pages.
 */

// cheerio doesn't re-export its DOM node type; take it from its own API.
type AnyNode = ReturnType<ReturnType<typeof cheerio.load>>[number];

export interface UnsupportedClaim {
  claim: string;
  message: string;
}

const MAX_REPORTED_CLAIMS = 20;

/** The text a visitor can read: body text, image alt text, the title and meta description. */
export function visibleText(html: string): string {
  const $ = cheerio.load(html);
  $(`script, style, noscript, template, shipfolio-watermark, [${WATERMARK_ATTR}]`).remove();

  const parts: string[] = [$("title").text(), $('meta[name="description" i]').attr("content") ?? ""];
  const walk = (nodes: AnyNode[]) => {
    for (const node of nodes) {
      if (node.type === "text") parts.push(node.data);
      else if (node.type === "tag") {
        if (node.name === "img" && node.attribs["alt"]) parts.push(node.attribs["alt"]);
        walk(node.children);
      }
    }
  };
  walk($("body").toArray());
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

// A number standing on its own: not glued to letters (S3, Python3, 3D, 5G) or
// after a dot (v2.1). Optional currency before, and a %, k/M/B, word or "x" after.
const NUMBER =
  /(?<![\p{L}\p{N}_.@#])([$€£₹]\s?)?(\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})+,\d{3}|\d+)(?:\.(\d+))?(?:\s?(%|percent\b|thousand\b|million\b|billion\b|[kKmMbB](?!\p{L})|x(?!\p{L})))?(?![\p{L}\p{N}])/gu;

// Ten or more digits with phone-style separators.
const PHONE = /(?<![\p{L}\p{N}])\+?\d[\d\s().-]{8,}\d(?![\p{L}\p{N}])/gu;

const SCALE: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, b: 1e9, billion: 1e9 };

interface NumberToken {
  text: string;
  index: number;
  end: number;
  raw: string;
  values: number[]; // the number as written, and scaled when it has a k/M/B suffix
}

function numberTokens(text: string): NumberToken[] {
  const tokens: NumberToken[] = [];
  for (const m of text.matchAll(NUMBER)) {
    const raw = `${m[2]!.replace(/,/g, "")}${m[3] ? `.${m[3]}` : ""}`;
    const value = Number(raw);
    const scale = SCALE[(m[4] ?? "").toLowerCase()];
    tokens.push({
      text: m[0].trim(),
      index: m.index,
      end: m.index + m[0].length,
      raw: m[2]!,
      values: scale ? [value, value * scale] : [value],
    });
  }
  return tokens;
}

const valueKey = (n: number) => n.toFixed(6);
const digitsOnly = (s: string) => s.replace(/\D/g, "");

export function findUnsupportedClaims(
  html: string,
  referenceText: string,
  opts: { currentYear?: number } = {},
): UnsupportedClaim[] {
  const currentYear = opts.currentYear ?? new Date().getFullYear();
  let text = visibleText(html);

  const refValues = new Set(numberTokens(referenceText).flatMap((t) => t.values.map(valueKey)));
  const refDigits = digitsOnly(referenceText);

  const unsupported: string[] = [];

  // A phone number from the reference may be shown with or without a country
  // code or leading 0, so compare its last 9 digits and drop it if found.
  // Anything else that merely looks like one (separate elements joined by
  // spaces, e.g. "2016 - 2020 3.8") stays and is checked number by number.
  text = text.replace(PHONE, (match) => {
    const digits = digitsOnly(match);
    return digits.length >= 10 && refDigits.includes(digits.slice(-9)) ? " " : match;
  });
  text = text.replace(/(?<!\p{N})24\s*\/\s*7(?!\p{N})/gu, " "); // "24/7" is an idiom, not a claim

  // Years in the reference bound how long a career the page may claim ("7+ years").
  const refYears = numberTokens(referenceText)
    .map((t) => t.values[0]!)
    .filter((v) => Number.isInteger(v) && v >= 1950 && v <= currentYear);
  const maxYearsClaim = refYears.length > 0 ? currentYear - Math.min(...refYears) + 1 : 0;

  for (const token of numberTokens(text)) {
    const value = token.values[0]!;
    // A plain number: no currency, %, or k/M/B (so "$1M" and "1%" are still checked).
    const bare = token.values.length === 1 && !/[$€£₹%]/.test(token.text);
    // Section labels ("01 / About"), and a bare 0 or 1, are almost never claims.
    if (/^0\d$/.test(token.raw) || (bare && (value === 0 || value === 1))) continue;
    // The current year: a copyright line, or a role shown as running until now.
    if (bare && value === currentYear) continue;
    // "7+ years of experience" derived from the resume's own dates.
    if (bare && value <= maxYearsClaim && /^\s*\+?\s*(?:years?|yrs?)\b/i.test(text.slice(token.end))) continue;

    if (!token.values.some((v) => refValues.has(valueKey(v)))) unsupported.push(token.text);
  }

  return [...new Set(unsupported)].slice(0, MAX_REPORTED_CLAIMS).map((claim) => ({
    claim,
    message: `"${claim}" isn't in your resume or your details.`,
  }));
}
