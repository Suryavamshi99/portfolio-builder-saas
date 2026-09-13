import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";

import { IMAGE_KINDS, UPLOAD_LIMITS, type UploadKind } from "@/config/uploads";

/**
 * One reusable module for every upload type, per the brief — the per-kind
 * limits are config (see src/config/uploads.ts), not separate checks
 * scattered per field. Call `validateUpload` before anything touches
 * storage; call `stripImageMetadataIfNeeded` only after validation passes.
 */

export function isUploadKind(value: unknown): value is UploadKind {
  return typeof value === "string" && value in UPLOAD_LIMITS;
}

/** Strip anything but a safe basename — never trust a client-supplied filename in a storage path. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  return cleaned.length > 0 ? cleaned : "file";
}

export type UploadValidationError = {
  code: "upload_invalid_type" | "upload_too_large";
  message: string;
};

/**
 * Validates real size and REAL content (magic-byte sniffed), never the
 * client-reported Content-Type or filename extension. This must run
 * before any quota check or storage write.
 */
export async function validateUpload(
  kind: UploadKind,
  buffer: Buffer,
): Promise<{ ok: true; mime: string } | { ok: false; error: UploadValidationError }> {
  const limits = UPLOAD_LIMITS[kind];

  if (buffer.byteLength > limits.maxSizeBytes) {
    return {
      ok: false,
      error: {
        code: "upload_too_large",
        message: `File exceeds the ${Math.floor(limits.maxSizeBytes / (1024 * 1024))}MB limit for ${kind}`,
      },
    };
  }

  const sniffed = await fileTypeFromBuffer(buffer);
  if (!sniffed || !limits.allowedMimeTypes.includes(sniffed.mime)) {
    return {
      ok: false,
      error: {
        code: "upload_invalid_type",
        message: `Expected one of: ${limits.allowedMimeTypes.join(", ")}`,
      },
    };
  }

  return { ok: true, mime: sniffed.mime };
}

/**
 * Re-encodes an image through sharp, which strips EXIF (including GPS)
 * and other metadata by default unless `.withMetadata()` is called — we
 * never call it. No-op for non-image kinds (resume).
 */
export async function stripImageMetadataIfNeeded(
  kind: UploadKind,
  buffer: Buffer,
  mime: string,
): Promise<Buffer> {
  if (!IMAGE_KINDS.includes(kind)) return buffer;

  const image = sharp(buffer);
  switch (mime) {
    case "image/png":
      return image.png().toBuffer();
    case "image/webp":
      return image.webp().toBuffer();
    case "image/jpeg":
    default:
      return image.jpeg().toBuffer();
  }
}
