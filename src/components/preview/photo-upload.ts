import { UPLOAD_LIMITS } from "@/config/uploads";
import { isAllowedNewImageUrl } from "@/lib/inline-edit-protocol";

/** Uploads through the same endpoint and limits as the wizard. Resolves with a signed URL, or throws an Error with plain text. */
export async function uploadPhotoFile(file: File, kind: "photo" | "project_image"): Promise<string> {
  const limits = UPLOAD_LIMITS[kind];
  if (file.size > limits.maxSizeBytes) {
    throw new Error(`That file is too big. The limit is ${Math.floor(limits.maxSizeBytes / (1024 * 1024))} MB.`);
  }
  if (file.type && !limits.allowedMimeTypes.includes(file.type)) {
    throw new Error("Please choose a PNG, JPG or WEBP picture.");
  }
  const form = new FormData();
  form.append("kind", kind);
  form.append("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body: form });
  const json = (await res.json().catch(() => ({}))) as { url?: string | null; error?: { message?: string; retryAfterSeconds?: number } };
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error(`Upload limit reached. Try again in ${Math.ceil((json.error?.retryAfterSeconds ?? 300) / 60)} minute(s).`);
    }
    throw new Error(json.error?.message ?? `The upload failed (${res.status}).`);
  }
  if (!isAllowedNewImageUrl(json.url)) throw new Error("The upload worked but the picture could not be shown. Try again.");
  return json.url;
}

export const PHOTO_ACCEPT = "image/png,image/jpeg,image/webp";
