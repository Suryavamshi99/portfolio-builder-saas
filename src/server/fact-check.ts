import * as cheerio from "cheerio";

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
  $("script, style, noscript, template, shipfolio-watermark, [data-shipfolio-watermark]").remove();

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
  /(?<![\p{L}\p{N}_.@#])([$€£₹]\s?)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(?:\s?(%|percent\b|thousand\b|million\b|billion\b|[kKmMbB](?!\p{L})|x(?!\p{L})))?(?![\p{L}\p{N}])/gu;

// Ten or more digits with phone-style separators.
const PHONE = /(?<![\p{L}\p{N}])\+?\d[\d\s().-]{8,}\d(?![\p{L}\p{N}])/gu;

const SCALE: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, b: 1e9, billion: 1e9 };

interface NumberToken {
  text: string;
  index: number;
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
      raw: m[2]!,
      values: scale ? [value, value * scale] : [value],
    });
  }
  return tokens;
}

const key = (n: number) => n.toFixed(6);
const digitsOnly = (s: string) => s.replace(/\D/g, "");

export function findUnsupportedClaims(
  html: string,
  referenceText: string,
  opts: { currentYear?: number } = {},
): UnsupportedClaim[] {
  const currentYear = opts.currentYear ?? new Date().getFullYear();
  let text = visibleText(html);

  const refValues = new Set(numberTokens(referenceText).flatMap((t) => t.values.map(key)));
  const refDigits = digitsOnly(referenceText);

  const unsupported: string[] = [];

  // Phone numbers first: compare their digits, then blank them out so their
  // parts aren't checked again as separate numbers.
  text = text.replace(PHONE, (match) => {
    if (digitsOnly(match).length < 10) return match;
    if (!refDigits.includes(digitsOnly(match))) unsupported.push(match.trim());
    return " ";
  });

  for (const token of numberTokens(text)) {
    // Section labels ("01 / About") and 0/1, which are almost never claims.
    if (/^0\d$/.test(token.raw) || token.values[0] === 0 || token.values[0] === 1) continue;
    // "© 2026 Jane Doe": the current year in a copyright line is not a claim.
    const before = text.slice(Math.max(0, token.index - 25), token.index).toLowerCase();
    if (token.values[0] === currentYear && (before.includes("©") || before.includes("copyright"))) continue;

    if (!token.values.some((v) => refValues.has(key(v)))) unsupported.push(token.text);
  }

  return [...new Set(unsupported)].slice(0, MAX_REPORTED_CLAIMS).map((claim) => ({
    claim,
    message: `"${claim}" isn't in your resume or your details.`,
  }));
}
