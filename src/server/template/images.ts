import type { SupabaseClient } from "@supabase/supabase-js";
import type { Content } from "@/data/content";

/**
 * Studio's image fields (profile.portrait, project images) are still
 * plain URL text inputs — there's no "attach an uploaded photo" picker
 * yet (that's UI work, not built). In practice a user who does use our
 * own Storage for an image will have pasted one of the signed URLs
 * `GET /api/uploads` returns, which expire after an hour. This detects
 * that specific case — our own `uploads` bucket's signed-URL shape — and
 * copies the underlying bytes into the deploy bundle so the live site
 * doesn't depend on a token that's about to expire, or on our Storage
 * staying populated at all. Anything else (an external URL) is left
 * untouched by design; it isn't ours to copy.
 */

const SIGNED_URL_PATTERN = /\/storage\/v1\/object\/sign\/uploads\/([^?]+)\?/;

function extractStoragePath(url: string): string | null {
  const match = SIGNED_URL_PATTERN.exec(url);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export async function embedStorageImages(
  content: Content,
  supabase: SupabaseClient,
): Promise<{ content: Content; files: Record<string, Buffer>; embeddedStoragePaths: string[] }> {
  const files: Record<string, Buffer> = {};
  const resolvedPaths = new Map<string, string>();

  async function resolve(url: string): Promise<string> {
    if (!url) return url;
    const storagePath = extractStoragePath(url);
    if (!storagePath) return url;

    const cached = resolvedPaths.get(storagePath);
    if (cached) return cached;

    const download = await supabase.storage.from("uploads").download(storagePath);
    // A stale/deleted reference shouldn't fail the whole publish — leave the
    // (broken) URL as-is rather than blocking on one bad image.
    if (download.error || !download.data) return url;

    const buffer = Buffer.from(await download.data.arrayBuffer());
    const basename = storagePath.split("/").pop() ?? "image";
    const bundlePath = `images/${basename}`;
    files[bundlePath] = buffer;
    resolvedPaths.set(storagePath, bundlePath);
    return bundlePath;
  }

  const next = structuredClone(content);
  next.profile.portrait = await resolve(next.profile.portrait);

  for (const project of next.projects) {
    if (!project.images) continue;
    for (const image of project.images) {
      image.src = await resolve(image.src);
    }
  }

  return { content: next, files, embeddedStoragePaths: [...resolvedPaths.keys()] };
}
