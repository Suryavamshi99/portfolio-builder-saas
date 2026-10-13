import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PUBLISHED_SITE_CSP } from "../lib/site-csp";
import { hostToSlug } from "../lib/sites";
import { validateHostname } from "../lib/domains";

export const SITES_CSP = `${PUBLISHED_SITE_CSP}; sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox`;

const SITES_BUCKET = "sites";

const MIME_BY_EXT: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  json: "application/json",
  txt: "text/plain; charset=utf-8",
};

export function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

function sendResponse(
  res: ServerResponse,
  statusCode: number,
  body: string | Buffer | Uint8Array,
  contentType: string,
) {
  // The CSP (with its sandbox) goes on EVERY response, not only HTML: a file opened
  // directly must not run scripts with this host's origin either.
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cache-Control": "public, max-age=0, s-maxage=20",
    "Content-Security-Policy": SITES_CSP,
  };

  res.writeHead(statusCode, headers);
  res.end(body);
}

const NOT_FOUND_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="robots" content="noindex" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Not Found</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #09090b; color: #f4f4f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; }
    .card { max-width: 420px; padding: 2rem; border-radius: 12px; background: #18181b; border: 1px solid #27272a; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; font-weight: 600; }
    p { font-size: 0.95rem; color: #a1a1aa; line-height: 1.5; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Page Not Found</h1>
    <p>The page you are looking for does not exist.</p>
  </div>
</body>
</html>`;

const UNPUBLISHED_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="robots" content="noindex" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Site Not Published</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #09090b; color: #f4f4f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; }
    .card { max-width: 420px; padding: 2rem; border-radius: 12px; background: #18181b; border: 1px solid #27272a; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; font-weight: 600; }
    p { font-size: 0.95rem; color: #a1a1aa; line-height: 1.5; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>This site isn't published.</h1>
    <p>This portfolio is either unpublished or does not exist.</p>
  </div>
</body>
</html>`;

/**
 * Maps a request URL to the storage path inside the sites bucket:
 * - / -> {slug}/index.html
 * - any other path must match ^/[A-Za-z0-9._/-]+$, contain no .. and no empty segment,
 *   and must start with images/ (else null).
 */
export function mapRequestPathToStoragePath(rawUrl: string, slug: string): string | null {
  const querySplit = rawUrl.split("?")[0] ?? "";
  const pathOnly = querySplit.split("#")[0] ?? "";

  if (pathOnly === "/" || pathOnly === "") {
    return `${slug}/index.html`;
  }

  // Must match ^/[A-Za-z0-9._/-]+$
  if (!/^\/[A-Za-z0-9._/-]+$/.test(pathOnly)) {
    return null;
  }

  // Must contain no ..
  if (pathOnly.includes("..")) {
    return null;
  }

  const relativePath = pathOnly.slice(1);
  const segments = relativePath.split("/");
  // No empty segment
  if (segments.some((seg) => seg.length === 0)) {
    return null;
  }

  // Must start with images/
  if (!relativePath.startsWith("images/")) {
    return null;
  }

  return `${slug}/${relativePath}`;
}

export let getSitesSupabaseClient = (url: string, key: string): SupabaseClient =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

export function setSitesSupabaseClientGetter(fn: (url: string, key: string) => SupabaseClient) {
  getSitesSupabaseClient = fn;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const supabaseUrl = process.env["SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  const sitesDomain = process.env["SITES_DOMAIN"];

  if (!supabaseUrl || !serviceRoleKey || !sitesDomain) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Server configuration error: missing required environment variables");
    return;
  }

  const hostHeader = req.headers.host;
  const rawHost = hostHeader ? hostHeader.trim().toLowerCase().split(":")[0] ?? "" : "";
  const normalizedSitesDomain = sitesDomain.trim().toLowerCase();

  const supabase = getSitesSupabaseClient(supabaseUrl, serviceRoleKey);
  let slug: string | null = null;

  // Check if Host is *.<sitesDomain>
  if (rawHost.endsWith(`.${normalizedSitesDomain}`)) {
    slug = hostToSlug(rawHost, sitesDomain);
    if (!slug) {
      sendResponse(res, 404, NOT_FOUND_HTML, "text/html; charset=utf-8");
      return;
    }

    const { data: site, error: siteError } = await supabase
      .from("sites")
      .select("slug, status")
      .eq("slug", slug)
      .maybeSingle();

    if (siteError || !site || site.status !== "published") {
      sendResponse(res, 404, UNPUBLISHED_HTML, "text/html; charset=utf-8");
      return;
    }
  } else {
    // Custom domain flow: Host is NOT *.<sitesDomain>
    // Hosts that are not valid hostnames -> 404 without a query
    const hostValidation = validateHostname(rawHost, sitesDomain);
    if (!hostValidation.ok) {
      sendResponse(res, 404, NOT_FOUND_HTML, "text/html; charset=utf-8");
      return;
    }

    const hostname = hostValidation.hostname;

    // Look up custom_domains by exact hostname with status verified or live
    const { data: domainRow, error: domainError } = await supabase
      .from("custom_domains")
      .select("user_id, status")
      .eq("hostname", hostname)
      .in("status", ["verified", "live"])
      .maybeSingle();

    if (domainError || !domainRow) {
      sendResponse(res, 404, UNPUBLISHED_HTML, "text/html; charset=utf-8");
      return;
    }

    // Then look up owner's sites row (status = 'published') -> slug
    const { data: site, error: siteError } = await supabase
      .from("sites")
      .select("slug, status")
      .eq("user_id", domainRow.user_id)
      .eq("status", "published")
      .maybeSingle();

    if (siteError || !site) {
      sendResponse(res, 404, UNPUBLISHED_HTML, "text/html; charset=utf-8");
      return;
    }

    slug = site.slug;
  }

  if (!slug) {
    sendResponse(res, 404, NOT_FOUND_HTML, "text/html; charset=utf-8");
    return;
  }

  // 3. Map path
  const rawUrl = req.url ?? "/";
  const storagePath = mapRequestPathToStoragePath(rawUrl, slug);
  if (!storagePath) {
    sendResponse(res, 404, NOT_FOUND_HTML, "text/html; charset=utf-8");
    return;
  }

  // Download with service role
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(SITES_BUCKET)
    .download(storagePath);

  if (downloadError || !fileData) {
    sendResponse(res, 404, NOT_FOUND_HTML, "text/html; charset=utf-8");
    return;
  }

  const arrayBuffer = await fileData.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = getMimeType(storagePath);

  sendResponse(res, 200, buffer, contentType);
}
