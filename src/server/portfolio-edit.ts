import * as cheerio from "cheerio";
import type { SupabaseClient } from "@supabase/supabase-js";

import { EDIT_ATTR, MAX_EDIT_HTML_CHARS } from "@/lib/inline-edit-protocol";
import { finalizeHtml, signedUrlsToMarkers } from "@/server/finalize-html";
import { savePortfolioVersion } from "@/server/portfolio-versions";
import { loadPortfolioInputs } from "@/server/portfolio-inputs";
import { stripWatermark } from "@/server/watermark";
import type { ProfileLinks } from "@/server/llm";

export type PortfolioEditResult =
  | { ok: true; updatedAt: string; warnings: string[]; unchanged: boolean }
  | { ok: false; status: number; code: string; message: string; details?: string[] };

/** Removes everything the in-frame editor adds, in case the frame (which is untrusted) did not. */
export function stripEditorArtifacts(html: string): string {
  const $ = cheerio.load(html);
  $(`[${EDIT_ATTR.ui}], style[${EDIT_ATTR.style}], script[${EDIT_ATTR.style}], script[${EDIT_ATTR.guard}]`).remove();
  $(`[${EDIT_ATTR.text}]`).removeAttr("contenteditable").removeAttr(EDIT_ATTR.text);
  $(`[${EDIT_ATTR.image}]`).each((_, el) => {
    const $el = $(el);
    if ($el.attr(EDIT_ATTR.addedTabindex) !== undefined) $el.removeAttr("tabindex");
    if ($el.attr(EDIT_ATTR.addedRole) !== undefined) $el.removeAttr("role");
    if ($el.attr(EDIT_ATTR.addedLabel) !== undefined) $el.removeAttr("aria-label");
    $el.removeAttr(EDIT_ATTR.image).removeAttr(EDIT_ATTR.addedTabindex).removeAttr(EDIT_ATTR.addedRole).removeAttr(EDIT_ATTR.addedLabel);
  });
  return $.html();
}

/** Links already on the stored page stay allowed: a text edit cannot add a link, and those were verified when the page was built. */
function existingLinks(storedHtml: string): { extra: ProfileLinks["other"]; reference: string[] } {
  const $ = cheerio.load(storedHtml);
  const extra: { label: string; url: string }[] = [];
  const reference: string[] = [];
  $("a[href], area[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    if (/^https?:\/\//i.test(href)) extra.push({ label: "existing", url: href });
    else if (/^(mailto|tel):/i.test(href)) reference.push(href.replace(/^(mailto|tel):/i, "").split("?")[0] ?? "");
  });
  return { extra, reference };
}

/**
 * Saves a page the user edited by hand in the Studio preview.
 *
 * The HTML comes from an untrusted frame, so it goes through the same sanitiser as every other page (finalizeHtml) and
 * may only reference the user's own Storage files. The numbers fact-check is deliberately NOT run: these are the user's
 * own words about themselves, and the check exists to catch invented claims from a model.
 */
export async function savePortfolioEdit(
  admin: SupabaseClient,
  userId: string,
  input: { html: unknown; baseUpdatedAt: unknown; supabaseUrl: string },
): Promise<PortfolioEditResult> {
  const fail = (status: number, code: string, message: string, details?: string[]): PortfolioEditResult => ({
    ok: false, status, code, message, ...(details ? { details } : {}),
  });
  if (typeof input.html !== "string" || input.html.trim() === "") return fail(400, "invalid_request", "html is required");
  if (input.html.length > MAX_EDIT_HTML_CHARS) return fail(413, "page_too_large", "That page is too large to save.");
  const base = typeof input.baseUpdatedAt === "string" ? Date.parse(input.baseUpdatedAt) : NaN;
  if (Number.isNaN(base)) return fail(400, "invalid_request", "baseUpdatedAt is required");

  const { data: stored, error } = await admin
    .from("portfolios").select("generated_html, updated_at").eq("user_id", userId).maybeSingle();
  if (error) return fail(500, "internal_error", "Could not load your page");
  if (!stored?.generated_html) return fail(404, "no_portfolio", "There is no page to edit yet.");
  if (Date.parse(stored.updated_at as string) > base) {
    return fail(409, "portfolio_stale", "Your page was changed somewhere else since you opened it. Reload to see the latest version.");
  }

  let links: ProfileLinks = {};
  try {
    links = (await loadPortfolioInputs(admin, userId)).links;
  } catch {
    return fail(500, "internal_error", "Could not load your details");
  }
  const kept = existingLinks(stored.generated_html as string);

  // Never let user text that looks like a code fence reach the extractor, which would treat it as the page boundary.
  let html = stripEditorArtifacts(stripWatermark(input.html)).replace(/```/g, "`​``");
  const marked = signedUrlsToMarkers(html, userId, input.supabaseUrl);
  if (marked.foreign > 0) return fail(422, "foreign_storage", "The page uses an image that is not yours.", ["Only your own uploaded photos can be used."]);
  html = marked.html;

  const final = finalizeHtml({
    rawText: html,
    userId,
    supabaseUrl: input.supabaseUrl,
    links: { ...links, other: [...(links.other ?? []), ...(kept.extra ?? [])] },
    referenceText: kept.reference.join("\n"),
  });
  if (!final.ok) return fail(422, "html_invalid", "The page did not pass our checks.", final.errors);

  if (final.html === stored.generated_html) return { ok: true, updatedAt: stored.updated_at as string, warnings: final.warnings, unchanged: true };

  const { data: latest } = await admin
    .from("portfolio_versions").select("source, model").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  // portfolio_versions.source only allows gemini, free or mcp; an edit keeps the source of the version it started from.
  const source = latest?.source === "gemini" || latest?.source === "mcp" ? latest.source : "free";
  const saved = await savePortfolioVersion(admin, userId, { html: final.html, source, model: (latest?.model as string | null) ?? null, warnings: final.warnings });
  return { ok: true, updatedAt: saved.updatedAt, warnings: final.warnings, unchanged: false };
}
