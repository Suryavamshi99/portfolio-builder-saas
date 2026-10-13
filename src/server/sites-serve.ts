import type { SupabaseClient } from "@supabase/supabase-js";
import { PUBLISHED_SITE_CSP } from "@/server/site-csp";
import { validateSlug } from "@/server/sites";

/**
 * Serves published portfolios from the app itself at /s/<slug>/... (used when the sites domain
 * can't have wildcard DNS). The page runs inside a CSP `sandbox` WITHOUT allow-same-origin, so it
 * gets an opaque origin: its scripts can't read or write the app's cookies or storage, and
 * connect-src/form-action are 'none'. The CSP goes on every response, not only HTML.
 */
export const SITES_CSP = `${PUBLISHED_SITE_CSP}; sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox`;

const SITES_BUCKET = "sites";
const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export interface SiteResponse {
  status: number;
  body: string | Uint8Array;
  contentType: string;
}

const page = (title: string, message: string, status: number): SiteResponse => ({
  status,
  contentType: "text/html; charset=utf-8",
  body:
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>` +
    `<style>body{font-family:system-ui,sans-serif;background:#09090b;color:#f4f4f5;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center}.c{max-width:420px;padding:2rem;border-radius:12px;background:#18181b;border:1px solid #27272a}h1{font-size:1.4rem;margin:0 0 .5rem}p{color:#a1a1aa;margin:0}</style></head>` +
    `<body><div class="c"><h1>${title}</h1><p>${message}</p></div></body></html>`,
});

/** "janedoe", "janedoe/", "janedoe/images/me.png" -> where to look, or null for anything else. */
export function parseSitePath(splat: string): { slug: string; file: "index.html" | `images/${string}` } | null {
  const [slug = "", ...rest] = splat.split("/");
  const v = validateSlug(slug);
  if (!v.ok || v.slug !== slug) return null;
  const tail = rest.join("/");
  if (tail === "" ) return { slug, file: "index.html" };
  if (/^images\/[A-Za-z0-9._-]+$/.test(tail) && !tail.includes("..")) return { slug, file: tail as `images/${string}` };
  return null;
}

export function responseHeaders(contentType: string): Record<string, string> {
  return {
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cache-Control": "public, max-age=0, s-maxage=20",
    "Content-Security-Policy": SITES_CSP,
  };
}

export async function serveSite(admin: SupabaseClient, splat: string): Promise<SiteResponse> {
  const target = parseSitePath(splat);
  if (!target) return page("Page not found", "The page you are looking for does not exist.", 404);

  const { data: site } = await admin.from("sites").select("slug, status").eq("slug", target.slug).maybeSingle();
  if (!site || site.status !== "published") return page("This site isn't published.", "This portfolio is either unpublished or does not exist.", 404);

  const download = await admin.storage.from(SITES_BUCKET).download(`${target.slug}/${target.file}`);
  if (download.error || !download.data) return page("Page not found", "The page you are looking for does not exist.", 404);
  const bytes = new Uint8Array(await download.data.arrayBuffer());

  if (target.file === "index.html") {
    // The page was written with relative "images/..." paths; under /s/<slug> they must be absolute.
    const html = new TextDecoder().decode(bytes).replace(/(["'(])images\//g, `$1/s/${target.slug}/images/`);
    return { status: 200, contentType: "text/html; charset=utf-8", body: html };
  }
  const ext = target.file.split(".").pop()?.toLowerCase() ?? "";
  const contentType = IMAGE_TYPES[ext];
  if (!contentType) return page("Page not found", "The page you are looking for does not exist.", 404);
  return { status: 200, contentType, body: bytes };
}
