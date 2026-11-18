import * as cheerio from "cheerio";

import { DISCLAIMER_TEXT } from "./replica-brief";

const NOINDEX = "noindex,nofollow";

function clean(raw: string, max: number): string {
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** The company's own host, without "www.". Anything on it, or on a subdomain of it, is the company's. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function onHost(value: string | undefined, host: string): boolean {
  if (!host || !value) return false;
  const m = /^\s*(?:https?:)?\/\/([^/?#\s]+)/i.exec(value);
  if (!m?.[1]) return false;
  const h = m[1].toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
  return h === host || h.endsWith(`.${host}`);
}

const BANNER_STYLE =
  "position:sticky;top:0;z-index:2147483000;margin:0;padding:8px 16px;background:#111;color:#fff;font:500 13px/1.4 system-ui,sans-serif;text-align:center";
const FOOTER_STYLE = "margin:0;padding:16px;font:400 12px/1.5 system-ui,sans-serif;text-align:center;opacity:.8";

export interface ReplicaGuardResult {
  html: string;
  /** How many company-hosted images, icons or graphics were removed. */
  removed: number;
}

/**
 * Makes a replica page safe to keep: the disclaimer is visible at the top and in the footer, search engines are told
 * not to index it, and anything loaded from the company's own site is removed. Safe to run more than once.
 */
export function applyReplicaGuard(html: string, opts: { name: string; company: string; companyUrl: string }): ReplicaGuardResult {
  const name = clean(opts.name, 80) || "a candidate";
  const company = clean(opts.company, 80) || "the company";
  const host = hostOf(opts.companyUrl);
  const text = DISCLAIMER_TEXT(name, company);
  const $ = cheerio.load(html);
  let removed = 0;

  // Company-hosted pictures and graphics.
  $("img").each((_, el) => {
    if (onHost($(el).attr("src"), host) || onHost($(el).attr("srcset")?.split(/\s+/)[0], host)) {
      $(el).remove();
      removed++;
    }
  });
  $("source").each((_, el) => {
    if (onHost($(el).attr("src"), host) || onHost($(el).attr("srcset")?.split(/\s+/)[0], host)) {
      $(el).remove();
      removed++;
    }
  });
  $("link[rel*='icon'], link[rel='apple-touch-icon']").each((_, el) => {
    if (onHost($(el).attr("href"), host)) {
      $(el).remove();
      removed++;
    }
  });
  $("meta[property='og:image'], meta[name='twitter:image']").each((_, el) => {
    if (onHost($(el).attr("content"), host)) $(el).remove();
  });
  $("svg").each((_, el) => {
    const refs = $(el)
      .find("image, use")
      .map((_, c) => $(c).attr("href") ?? $(c).attr("xlink:href"))
      .get();
    if (refs.some((r) => onHost(r, host))) {
      $(el).remove();
      removed++;
    }
  });
  // CSS url() pointing at the company's host.
  const stripUrls = (css: string) =>
    css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, _q: string, u: string) => {
      if (onHost(u, host)) {
        removed++;
        return "none";
      }
      return m;
    });
  $("style").each((_, el) => {
    $(el).text(stripUrls($(el).text()));
  });
  $("[style]").each((_, el) => {
    $(el).attr("style", stripUrls($(el).attr("style") ?? ""));
  });

  // Search engines: one robots meta, ours.
  $("meta[name='robots' i]").remove();
  $("head").prepend(`<meta name="robots" content="${NOINDEX}">`);

  // The disclaimer, replacing any earlier copy.
  $("[data-replica-disclaimer]").remove();
  const top = $("<div data-replica-disclaimer='top' role='note'></div>").attr("style", BANNER_STYLE).text(text);
  $("body").prepend(top);
  const footer = $("footer").last();
  const line = $("<p data-replica-disclaimer='footer'></p>").attr("style", FOOTER_STYLE).text(text);
  if (footer.length) footer.append(line);
  else $("body").append($("<footer></footer>").append(line));

  return { html: $.html(), removed };
}

/** The person's name for the disclaimer: the first resume line that looks like a name (2 to 4 words, letters only). */
export function nameFromResume(resumeText: string): string {
  for (const raw of resumeText.split("\n").slice(0, 12)) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (/^\p{L}[\p{L}.'-]*(?: \p{L}[\p{L}.'-]*){1,3}$/u.test(line) && line.length <= 60) return line;
  }
  return "";
}
