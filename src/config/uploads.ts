export type UploadKind = "resume" | "visual_reference" | "photo" | "project_image";

export const UPLOAD_KINDS: readonly UploadKind[] = [
  "resume",
  "visual_reference",
  "photo",
  "project_image",
];

const FIVE_MB = 5 * 1024 * 1024;

const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];

/**
 * Per-kind upload rules — the single place these limits are defined.
 * `slot` distinguishes the two shapes the brief calls for: a "singleton"
 * kind (resume, photo) where a new upload replaces the existing one, vs.
 * a "capped" kind (visual_reference, project_image) where the count is
 * bounded and a new upload past the cap is rejected rather than replacing
 * anything — the user chooses what to remove via DELETE.
 */
export const UPLOAD_LIMITS: Record<
  UploadKind,
  { maxSizeBytes: number; allowedMimeTypes: string[] } & (
    | { slot: "singleton" }
    | { slot: "capped"; maxCount: number }
  )
> = {
  resume: {
    slot: "singleton",
    maxSizeBytes: FIVE_MB,
    allowedMimeTypes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  },
  visual_reference: {
    slot: "capped",
    maxCount: 3,
    maxSizeBytes: FIVE_MB,
    allowedMimeTypes: IMAGE_MIME_TYPES,
  },
  photo: {
    slot: "singleton",
    maxSizeBytes: FIVE_MB,
    allowedMimeTypes: IMAGE_MIME_TYPES,
  },
  project_image: {
    slot: "capped",
    maxCount: 10,
    maxSizeBytes: FIVE_MB,
    allowedMimeTypes: IMAGE_MIME_TYPES,
  },
};

export const IMAGE_KINDS: readonly UploadKind[] = ["visual_reference", "photo", "project_image"];
