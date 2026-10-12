import type { SupabaseClient } from "@supabase/supabase-js";
import { ownStoragePath, storageMarkerPattern } from "@/server/finalize-html";

const SIGNED_URL_PATTERN = /https?:\/\/[^"'\s)]+\/storage\/v1\/object\/sign\/uploads\/([^?"'\s]+)\?[^"'\s)]*/g;

export async function embedStorageImagesInHtml(
  html: string,
  supabase: SupabaseClient,
  userId: string,
): Promise<{ html: string; files: Record<string, Buffer>; embeddedStoragePaths: string[] }> {
  const files: Record<string, Buffer> = {};
  const bundlePathByTarget = new Map<string, string>();
  const storagePaths = new Set<string>();

  const processMatch = async (target: string, rawStoragePath: string) => {
    if (bundlePathByTarget.has(target)) return;

    const storagePath = ownStoragePath(rawStoragePath, userId);
    if (!storagePath) return;

    const basename = storagePath.split("/").pop() ?? "image";
    const bundlePath = `images/${basename}`;

    if (!storagePaths.has(storagePath)) {
      const download = await supabase.storage.from("uploads").download(storagePath);
      if (download.error || !download.data) return;

      const buffer = Buffer.from(await download.data.arrayBuffer());
      files[bundlePath] = buffer;
      storagePaths.add(storagePath);
    }

    bundlePathByTarget.set(target, bundlePath);
  };

  const signedMatches = [...html.matchAll(SIGNED_URL_PATTERN)];
  for (const match of signedMatches) {
    if (match[0] && match[1]) {
      await processMatch(match[0], match[1]);
    }
  }

  const markerMatches = [...html.matchAll(storageMarkerPattern())];
  for (const match of markerMatches) {
    if (match[0] && match[1]) {
      await processMatch(match[0], match[1]);
    }
  }

  let nextHtml = html;
  for (const [target, bundlePath] of bundlePathByTarget) {
    nextHtml = nextHtml.split(target).join(bundlePath);
  }

  return { html: nextHtml, files, embeddedStoragePaths: [...storagePaths] };
}
