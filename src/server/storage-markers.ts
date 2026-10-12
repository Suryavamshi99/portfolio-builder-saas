import type { SupabaseClient } from "@supabase/supabase-js";
import { ownStoragePath } from "@/server/finalize-html";

/** 7 days, for HTML handed back to the browser */
export const PHOTO_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

/** 1 hour, for the photo URL sent in the prompt to the model */
export const PROMPT_SIGNED_URL_TTL_SECONDS = 60 * 60;

// Terminators: ", ', ), whitespace, < or &quot;
const MARKER_PATTERN = /(?:shipfolio-storage:\/\/uploads\/)((?:(?!&quot;)[^"')\s<])+)/g;

export async function signStorageMarkers(
  html: string,
  supabase: SupabaseClient,
  userId: string,
  ttlSeconds: number,
): Promise<string> {
  const matches = [...html.matchAll(MARKER_PATTERN)];
  if (matches.length === 0) return html;

  const distinctPaths = new Set<string>();
  for (const match of matches) {
    const rawPath = match[1];
    if (rawPath) {
      const own = ownStoragePath(rawPath, userId);
      if (own) {
        distinctPaths.add(own);
      }
    }
  }

  const signedUrlByPath = new Map<string, string>();
  for (const path of distinctPaths) {
    const { data, error } = await supabase.storage.from("uploads").createSignedUrl(path, ttlSeconds);
    if (!error && data?.signedUrl) {
      signedUrlByPath.set(path, data.signedUrl);
    }
  }

  return html.replace(MARKER_PATTERN, (fullMarker, path) => {
    const own = ownStoragePath(path, userId);
    if (own && signedUrlByPath.has(own)) {
      return signedUrlByPath.get(own)!;
    }
    return fullMarker;
  });
}
