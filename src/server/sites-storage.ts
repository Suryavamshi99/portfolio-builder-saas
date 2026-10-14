import type { SupabaseClient } from "@supabase/supabase-js";
import { validateSlug } from "@/server/sites";

export const SITES_BUCKET = "sites";

export interface RemoveSiteFilesOptions {
  pageSize?: number;
  maxObjects?: number;
}

/**
 * Removes all hosted files for a site subdomain:
 * - Validates slug first (throws immediately if invalid)
 * - Lists {slug} and {slug}/images prefixes (paginating up to maxObjects)
 * - Ensures no listed or removed path escapes {slug}/
 * - Removes all discovered files
 * - Throws on storage errors
 */
export async function removeSiteFiles(
  admin: SupabaseClient,
  slug: string,
  options?: RemoveSiteFilesOptions,
): Promise<void> {
  const validation = validateSlug(slug);
  if (!validation.ok) {
    throw new Error(`Invalid site slug: ${slug}`);
  }

  const validSlug = validation.slug;
  const pageSize = options?.pageSize ?? 100;
  const maxObjects = options?.maxObjects ?? 1000;

  const filesToRemove: string[] = [];

  for (const folder of [validSlug, `${validSlug}/images`]) {
    let offset = 0;

    while (filesToRemove.length < maxObjects) {
      const limit = Math.min(pageSize, maxObjects - filesToRemove.length);
      const { data, error } = await admin.storage.from(SITES_BUCKET).list(folder, {
        limit,
        offset,
      });

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        break;
      }

      for (const item of data) {
        if (!item.name || item.name === ".emptyFolderPlaceholder") {
          continue;
        }

        // Supabase folders have null id; skip them so we only remove file objects
        if (item.id === null) {
          continue;
        }

        // Subfolder representation in root slug
        if (folder === validSlug && item.name === "images") {
          continue;
        }

        // Safety: reject path traversal
        if (
          item.name.includes("..") ||
          item.name.includes("/") ||
          item.name.includes("\\")
        ) {
          continue;
        }

        const fullPath = `${folder}/${item.name}`;

        // Ensure the path never leaves the {slug}/ prefix
        if (!fullPath.startsWith(`${validSlug}/`)) {
          continue;
        }

        filesToRemove.push(fullPath);
        if (filesToRemove.length >= maxObjects) {
          break;
        }
      }

      offset += data.length;
      if (data.length < limit) {
        break;
      }
    }

    if (filesToRemove.length >= maxObjects) {
      break;
    }
  }

  if (filesToRemove.length > 0) {
    // Strictly verify every target path starts with the validated prefix
    const safePaths = filesToRemove.filter((p) => p.startsWith(`${validSlug}/`));
    if (safePaths.length > 0) {
      const { error: removeError } = await admin.storage
        .from(SITES_BUCKET)
        .remove(safePaths);

      if (removeError) {
        throw removeError;
      }
    }
  }
}
