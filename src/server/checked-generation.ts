import { finalizeHtml, type FinalizeHtmlInput } from "@/server/finalize-html";
import { findUnsupportedClaims, type UnsupportedClaim } from "@/server/fact-check";

export type CheckedGenerationResult =
  | { ok: true; html: string; warnings: string[]; repaired: boolean }
  | { ok: false; reason: "invalid_output" | "unsupported_claims"; details: string[] };

/**
 * finalizeHtml() + the fact check, with one repair round (plan 6.1 step 4):
 * if the page has numbers the resume doesn't support, the same model gets
 * the list once and must fix it. Anything still unsupported fails. A page
 * that fails finalizeHtml (cut off, not a page) is not repaired.
 *
 * `repair` sends one more request to the same provider with the same system
 * prompt; its errors (auth, rate limit, provider) propagate to the caller.
 */
export async function finalizeWithFactCheck(opts: {
  firstReply: string;
  finalize: Omit<FinalizeHtmlInput, "rawText">;
  originalUserMessage: string;
  repair: (userMessage: string) => Promise<string>;
  currentYear?: number;
}): Promise<CheckedGenerationResult> {
  const check = (html: string) =>
    findUnsupportedClaims(html, opts.finalize.referenceText, opts.currentYear ? { currentYear: opts.currentYear } : {});

  const first = finalizeHtml({ ...opts.finalize, rawText: opts.firstReply });
  if (!first.ok) return { ok: false, reason: "invalid_output", details: first.errors };

  const firstClaims = check(first.html);
  if (firstClaims.length === 0) return { ok: true, html: first.html, warnings: first.warnings, repaired: false };

  const secondReply = await opts.repair(buildRepairMessage(opts.originalUserMessage, first.html, firstClaims));
  const second = finalizeHtml({ ...opts.finalize, rawText: secondReply });
  if (!second.ok) return { ok: false, reason: "invalid_output", details: second.errors };

  const secondClaims = check(second.html);
  if (secondClaims.length > 0) {
    return { ok: false, reason: "unsupported_claims", details: secondClaims.map((c) => c.message) };
  }
  return { ok: true, html: second.html, warnings: second.warnings, repaired: true };
}

function buildRepairMessage(originalUserMessage: string, previousHtml: string, claims: UnsupportedClaim[]): string {
  return `${originalUserMessage}

---
CORRECTION REQUIRED. The page you wrote (below) states facts that are not in the resume or the user's
details. Every number, percentage, amount and date on the page must come from them. For each item listed,
remove the claim or replace it with what the resume actually says. Change nothing else: keep the same
design, sections, links and images (keep every image src exactly as it is).

Unsupported:
${claims.map((c) => `- "${c.claim}"`).join("\n")}

Return the complete corrected HTML document only.

Previous page:
\`\`\`html
${previousHtml}
\`\`\``;
}
