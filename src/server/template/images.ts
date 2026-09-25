import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The LLM is told to embed the profile photo (and, indirectly, any other
 * Storage-backed image it references) using a signed URL from our own
 * `uploads` bucket, valid for 7 days (see PHOTO_SIGNED_URL_TTL_SECONDS in
 * api/generate.ts) — plenty of time between generating and publishing, but
 * still a token that expires. This scans the generated HTML for that
 * specific signed-URL shape, downloads the underlying bytes once per
 * distinct path, and rewrites every occurrence to a relative path bundled
 * into the deploy — so the live site never depends on a token expiring or
 * on our Storage staying populated at all.
 */
const SIGNED_URL_PATTERN = /https?:\/\/[^"'\s)]+\/storage\/v1\/object\/sign\/uploads\/([^?"'\s]+)\?[^"'\s)]*/g;

export async function embedStorageImagesInHtml(
  html: string,
  supabase: SupabaseClient,
): Promise<{ html: string; files: Record<string, Buffer>; embeddedStoragePaths: string[] }> {
  const files: Record<string, Buffer> = {};
  const bundlePathByFullUrl = new Map<string, string>();
  const storagePaths = new Set<string>();

  const matches = [...html.matchAll(SIGNED_URL_PATTERN)];
  for (const match of matches) {
    const fullUrl = match[0];
    const storagePath = decodeURIComponent(match[1]!);
    if (bundlePathByFullUrl.has(fullUrl)) continue;

    const download = await supabase.storage.from("uploads").download(storagePath);
    // A stale/deleted reference shouldn't fail the whole publish — leave the
    // (broken, soon-to-expire) URL as-is rather than blocking on one image.
    if (download.error || !download.data) continue;

    const buffer = Buffer.from(await download.data.arrayBuffer());
    const basename = storagePath.split("/").pop() ?? "image";
    const bundlePath = `images/${basename}`;
    files[bundlePath] = buffer;
    bundlePathByFullUrl.set(fullUrl, bundlePath);
    storagePaths.add(storagePath);
  }

  let nextHtml = html;
  for (const [fullUrl, bundlePath] of bundlePathByFullUrl) {
    nextHtml = nextHtml.split(fullUrl).join(bundlePath);
  }

  return { html: nextHtml, files, embeddedStoragePaths: [...storagePaths] };
}
