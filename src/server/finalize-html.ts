import * as cheerio from "cheerio";
import { extractHtmlDocument, type ProfileLinks } from "@/server/llm";

export const STORAGE_MARKER_PREFIX = "shipfolio-storage://uploads/";

export interface FinalizeHtmlInput {
  rawText: string; // the model's whole reply
  userId: string; // the session user's id; only their own Storage paths are allowed
  supabaseUrl: string; // getSupabaseEnv().url from src/lib/supabase/env.ts; only signed URLs from this origin are recognised
  links: ProfileLinks; // the verified links from portfolio_inputs
  referenceText: string; // resume text + specifics + every verified link value (used only for mailto:/tel: in B4)
}

export type FinalizeHtmlResult =
  | { ok: true; html: string; warnings: string[] }
  | { ok: false; errors: string[] };

/** B3a. The one ownership check for Storage paths. Used here and by storage-markers.ts / images.ts. */
export function ownStoragePath(rawPath: string, userId: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return null;
  }

  // Check for \, %, or any character below U+0020 or U+007F
  for (let i = 0; i < decoded.length; i++) {
    const code = decoded.charCodeAt(i);
    if (code < 32 || code === 127) {
      return null;
    }
  }
  if (decoded.includes("\\") || decoded.includes("%")) {
    return null;
  }

  if (!decoded.startsWith(`${userId}/`)) {
    return null;
  }

  const segments = decoded.split("/");
  if (segments.some((seg) => seg === "" || seg === "." || seg === "..")) {
    return null;
  }

  return decoded;
}

function parseSignedStorageUrl(urlStr: string, supabaseUrl: string): { rawPath: string } | null {
  try {
    const parsed = new URL(urlStr);
    const expectedOrigin = new URL(supabaseUrl).origin;
    if (
      parsed.origin === expectedOrigin &&
      parsed.pathname.startsWith("/storage/v1/object/sign/uploads/")
    ) {
      const rawPath = parsed.pathname.slice("/storage/v1/object/sign/uploads/".length);
      return { rawPath };
    }
  } catch {
    // not a valid URL
  }
  return null;
}

/** B3d. Turns this user's signed Storage URLs anywhere in the text into markers (used by finalizeHtml and by /api/content for rows saved before this change). */
export function signedUrlsToMarkers(
  html: string,
  userId: string,
  supabaseUrl: string,
): { html: string; foreign: number } {
  let foreign = 0;

  // Terminators: ", ', ), whitespace, < or &quot;
  const CANDIDATE_REGEX = /(?:https?:\/\/|shipfolio-storage:\/\/uploads\/)(?:(?!&quot;)[^"')\s<])+/g;

  const nextHtml = html.replace(CANDIDATE_REGEX, (candidate) => {
    // 1. Marker candidate
    if (candidate.startsWith(STORAGE_MARKER_PREFIX)) {
      const rest = candidate.slice(STORAGE_MARKER_PREFIX.length);
      const own = ownStoragePath(rest, userId);
      if (own) {
        return `${STORAGE_MARKER_PREFIX}${own}`;
      }
      foreign++;
      return "";
    }

    // 2. Signed URL candidate
    const signed = parseSignedStorageUrl(candidate, supabaseUrl);
    if (!signed) {
      return candidate;
    }

    const own = ownStoragePath(signed.rawPath, userId);
    if (own) {
      return `${STORAGE_MARKER_PREFIX}${own}`;
    }

    // Not own signed URL -> replaced by empty string
    foreign++;
    return "";
  });

  return { html: nextHtml, foreign };
}

function normalizeVerifiedTarget(raw: string): string | null {
  let urlStr = raw.trim();
  if (!urlStr) return null;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(urlStr)) {
    urlStr = `https://${urlStr}`;
  }
  try {
    const parsed = new URL(urlStr);
    let host = parsed.host.toLowerCase();
    if (host.startsWith("www.")) {
      host = host.slice(4);
    }
    let pathname = parsed.pathname;
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    } else if (pathname === "/") {
      pathname = "";
    }
    return `${host}${pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

function normalizeCandidateHref(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  let host = parsed.host.toLowerCase();
  if (host.startsWith("www.")) {
    host = host.slice(4);
  }
  let pathname = parsed.pathname;
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  } else if (pathname === "/") {
    pathname = "";
  }
  return `${host}${pathname}${parsed.search}`;
}

function cleanDocForServing($: cheerio.CheerioAPI): void {
  // 1. Elements with their contents to remove
  // <script> with src or href attribute (SVG <script href>)
  $("script[src], script[href]").remove();
  $("iframe, frame, frameset, object, embed, applet, portal, base").remove();
  // cheerio parses <noscript> as raw text (scripting on), so nothing inside it
  // can be checked, yet browsers with scripting off render it as markup.
  $("noscript").remove();
  $("meta[http-equiv]").remove();

  $("link").each((_, el) => {
    const rel = ($(el).attr("rel") || "").trim().toLowerCase();
    const href = ($(el).attr("href") || "").trim();
    const isAllowedRel = rel === "stylesheet" || rel === "preconnect";
    let isAllowedHref = false;
    try {
      const u = new URL(href);
      if (
        u.protocol === "https:" &&
        (u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com")
      ) {
        isAllowedHref = true;
      }
    } catch {
      isAllowedHref = false;
    }
    if (!isAllowedRel || !isAllowedHref) {
      $(el).remove();
    }
  });

  // 2. Attributes to remove
  $("form").removeAttr("action").removeAttr("method").removeAttr("target");
  $("[formaction]").removeAttr("formaction");
  $("[formmethod]").removeAttr("formmethod");
  $("[formtarget]").removeAttr("formtarget");
  $("[ping]").removeAttr("ping");

  // SMIL can set an href at render time, bypassing the static href checks.
  // parse5 keeps SVG's camelCase tag names, which CSS selectors don't match.
  $("svg *").each((_, el) => {
    const tag = el.tagName.toLowerCase();
    if (tag === "animate" || tag === "set" || tag === "animatemotion" || tag === "animatetransform") {
      const target = ($(el).attr("attributeName") ?? "").trim().toLowerCase().replace(/^xlink:/, "");
      if (target === "href") $(el).remove();
    }
  });

  // 3. CSS @import cleaning in <style> elements
  $("style").each((_, el) => {
    const css = $(el).text();
    const cleaned = css.replace(/@import\b[^;]*(?:;|$)/gi, (match) => {
      const urlMatch = /@import\s+(?:url\(\s*['"]?|['"])([^'")\s]+)/i.exec(match);
      if (urlMatch?.[1]?.startsWith("https://fonts.googleapis.com/")) {
        return match;
      }
      return "";
    });
    $(el).text(cleaned);
  });
}

/** Safety clean-up only (B5). Publish runs this again on whatever it serves. */
export function sanitizeHtmlForServing(html: string): string {
  return untilStable(html, (current) => {
    const $ = cheerio.load(current);
    cleanDocForServing($);
    return $.html();
  });
}

/** Thrown when re-parsing keeps changing the cleaned HTML (a mutation-XSS shape). */
export class UnstableHtmlError extends Error {}

const MAX_CLEAN_ROUNDS = 4;

// Serialising and re-parsing can turn text the parser saw as inert (e.g. inside
// <style> after a nested-<form> trick) into live elements. Clean again until the
// output is a fixed point, so what we store is what a browser will build.
function untilStable(html: string, clean: (html: string) => string): string {
  let current = clean(html);
  for (let round = 1; round < MAX_CLEAN_ROUNDS; round++) {
    const next = clean(current);
    if (next === current) return current;
    current = next;
  }
  throw new UnstableHtmlError("HTML did not stabilise after cleaning");
}

export function finalizeHtml(input: FinalizeHtmlInput): FinalizeHtmlResult {
  const { rawText } = input;

  // B2. Step 1: extract (hard errors)
  let extracted: string;
  try {
    extracted = extractHtmlDocument(rawText);
  } catch {
    return { ok: false, errors: ["The AI reply didn't contain a web page."] };
  }

  const errors: string[] = [];
  if (!extracted.trim().toLowerCase().endsWith("</html>")) {
    errors.push("The page was cut off before it finished.");
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const warnings: string[] = [];

  // B6 raw-string checks (before parsing)
  let needsDoctypePrepended = false;
  if (!/<!doctype\s+html/i.test(extracted)) {
    needsDoctypePrepended = true;
    warnings.push("Added a missing doctype.");
  }
  if (!/<head\b/i.test(extracted) || !/<body\b/i.test(extracted)) {
    warnings.push("The page was missing its <head> or <body> section; it was repaired.");
  }
  const styleMatches = [...extracted.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)];
  const hasNonEmptyStyle = styleMatches.some((m) => (m[1]?.trim().length ?? 0) > 0);
  if (!hasNonEmptyStyle) {
    warnings.push("The page has no inline styles, so it may look unstyled.");
  }

  let html: string;
  try {
    html = untilStable(extracted, (current) => cleanOnce(current, input, warnings));
  } catch (e) {
    if (e instanceof UnstableHtmlError) {
      return { ok: false, errors: ["The page's HTML couldn't be cleaned safely."] };
    }
    throw e;
  }
  if (needsDoctypePrepended && !/^\s*<!doctype\s+html/i.test(html)) {
    html = `<!DOCTYPE html>\n${html}`;
  }

  const dedupedWarnings = Array.from(new Set(warnings));
  return { ok: true, html, warnings: dedupedWarnings };
}

/** One full B5 → B3 → B4 → B6 → B3d pass. Warnings accumulate across rounds and are de-duplicated. */
function cleanOnce(source: string, input: FinalizeHtmlInput, warnings: string[]): string {
  const { userId, supabaseUrl, links, referenceText } = input;
  const $ = cheerio.load(source);

  // Watermark removal (B6)
  $("[data-shipfolio-watermark], shipfolio-watermark").remove();

  // B5: Safety clean-up
  const linkCountBefore = $("link").length;
  const scriptCountBefore = $("script").length;
  cleanDocForServing($);
  const linkCountAfter = $("link").length;
  const scriptCountAfter = $("script").length;
  if (linkCountAfter < linkCountBefore || scriptCountAfter < scriptCountBefore) {
    warnings.push("Removed outside style sheets or scripts; anything they provided (such as icon fonts) won't show.");
  }

  // B3c: Media sources
  let removedMediaCount = 0;

  // Process video posters first
  $("video[poster]").each((_, el) => {
    const poster = $(el).attr("poster");
    if (!poster) return;

    const signed = parseSignedStorageUrl(poster, supabaseUrl);
    if (signed && ownStoragePath(signed.rawPath, userId)) {
      const own = ownStoragePath(signed.rawPath, userId);
      $(el).attr("poster", `${STORAGE_MARKER_PREFIX}${own}`);
      return;
    }

    if (poster.startsWith(STORAGE_MARKER_PREFIX)) {
      const rest = poster.slice(STORAGE_MARKER_PREFIX.length);
      if (ownStoragePath(rest, userId)) {
        return;
      }
      $(el).removeAttr("poster");
      removedMediaCount++;
      return;
    }

    if (poster.toLowerCase().startsWith("data:image/")) {
      return;
    }

    $(el).removeAttr("poster");
    removedMediaCount++;
  });

  // Process src on media elements: img, video, audio, track, input[type="image"]
  $("img, video, audio, track, input[type='image']").each((_, el) => {
    const tagName = el.tagName.toLowerCase();
    const isImgOrInput = tagName === "img" || tagName === "input";
    const src = $(el).attr("src");

    if (!src) {
      if (tagName !== "video") {
        $(el).remove();
        removedMediaCount++;
      }
      return;
    }

    const signed = parseSignedStorageUrl(src, supabaseUrl);
    if (signed && ownStoragePath(signed.rawPath, userId)) {
      const own = ownStoragePath(signed.rawPath, userId);
      $(el).attr("src", `${STORAGE_MARKER_PREFIX}${own}`);
      return;
    }

    if (src.startsWith(STORAGE_MARKER_PREFIX)) {
      const rest = src.slice(STORAGE_MARKER_PREFIX.length);
      if (ownStoragePath(rest, userId)) {
        return;
      }
      $(el).remove();
      removedMediaCount++;
      return;
    }

    if (src.toLowerCase().startsWith("data:image/")) {
      if (isImgOrInput) {
        return;
      }
    }

    // Anything else -> remove element
    $(el).remove();
    removedMediaCount++;
  });

  if (removedMediaCount > 0) {
    warnings.push(
      removedMediaCount === 1
        ? "Removed 1 image or media file that wasn't your own upload."
        : `Removed ${removedMediaCount} images or media files that weren't your own uploads.`,
    );
  }

  // Remove srcset everywhere and <source> elements
  $("[srcset]").removeAttr("srcset");
  $("source").remove();

  // In <svg>, on <image> and <use>: remove href unless # or data:image/
  // Notice: cheerio stores namespaced xlink:href under href
  $("svg *").each((_, el) => {
    const tag = el.tagName.toLowerCase();
    if (tag !== "image" && tag !== "use" && tag !== "feimage") return;
    const h = $(el).attr("href");
    if (h && !h.startsWith("#") && !h.startsWith("data:image/")) {
      $(el).removeAttr("href");
    }
  });

  // B4: Links (including <a> inside <svg>)
  const verifiedNormalizedLinks = new Set<string>();
  const addVerified = (raw: string | undefined) => {
    if (!raw) return;
    const n = normalizeVerifiedTarget(raw);
    if (n) verifiedNormalizedLinks.add(n);
  };
  addVerified(links.linkedin);
  addVerified(links.github);
  for (const p of links.githubProjects ?? []) addVerified(p);
  for (const o of links.other ?? []) addVerified(o.url);

  const refDigits = referenceText.replace(/\D/g, "");
  const refLower = referenceText.toLowerCase();

  let removedLinksCount = 0;
  $("a, area").each((_, el) => {
    const $el = $(el);
    const href = $el.attr("href");
    if (href === undefined) {
      return;
    }

    const lowerHref = href.toLowerCase();

    // 1. In-page anchor
    if (href.startsWith("#")) {
      return;
    }

    // 2. mailto:
    if (lowerHref.startsWith("mailto:")) {
      const address = (href.slice("mailto:".length).split("?")[0] ?? "").trim();
      if (address.length > 0 && refLower.includes(address.toLowerCase())) {
        return;
      }
      $el.removeAttr("href");
      $el.removeAttr("target");
      removedLinksCount++;
      return;
    }

    // 3. tel:
    if (lowerHref.startsWith("tel:")) {
      const numberStr = href.slice("tel:".length).split("?")[0] ?? "";
      const hrefDigits = numberStr.replace(/\D/g, "");
      if (hrefDigits.length > 0 && refDigits.includes(hrefDigits)) {
        return;
      }
      $el.removeAttr("href");
      $el.removeAttr("target");
      removedLinksCount++;
      return;
    }

    // 4. http(s) URL matching verified links
    const normalized = normalizeCandidateHref(href);
    if (normalized && verifiedNormalizedLinks.has(normalized)) {
      if (el.tagName.toLowerCase() === "a" && $el.attr("target") === "_blank") {
        $el.attr("rel", "noopener noreferrer");
      }
      return;
    }

    // Otherwise remove href and target
    $el.removeAttr("href");
    $el.removeAttr("target");
    removedLinksCount++;
  });

  if (removedLinksCount > 0) {
    warnings.push(
      removedLinksCount === 1
        ? "Removed 1 link that wasn't in your verified links."
        : `Removed ${removedLinksCount} links that weren't in your verified links.`,
    );
  }

  // B6: Viewport + structure warnings
  const hasViewport = $('meta[name="viewport" i]').length > 0;
  if (!hasViewport) {
    $("head").prepend('<meta name="viewport" content="width=device-width, initial-scale=1">');
    warnings.push("Added a mobile viewport tag.");
  }

  if ($("nav").length === 0) {
    warnings.push("The page has no <nav> section.");
  }

  if ($("section").length === 0) {
    warnings.push("The page has no <section> elements.");
  }

  let hasAnchorNav = false;
  $("a[href]").each((_, el) => {
    const h = $(el).attr("href");
    if (h && h.startsWith("#")) {
      hasAnchorNav = true;
    }
  });
  if (!hasAnchorNav) {
    warnings.push("The page has no in-page navigation.");
  }

  let hasMissingAlt = false;
  $("img").each((_, el) => {
    const alt = $(el).attr("alt");
    if (!alt || alt.trim().length === 0) {
      hasMissingAlt = true;
    }
  });
  if (hasMissingAlt) {
    warnings.push("One or more images are missing alt text.");
  }

  // B3d: signedUrlsToMarkers (text pass)
  const markerPass = signedUrlsToMarkers($.html(), userId, supabaseUrl);
  if (markerPass.foreign > 0) {
    warnings.push("The page referenced an image that isn't yours; it won't load.");
  }
  return markerPass.html;
}
