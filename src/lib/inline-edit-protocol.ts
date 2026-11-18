// Shared by the Studio preview (parent page), the script that runs inside the preview frame, and the save endpoint.

/** Same cap as the MCP save tool. */
export const MAX_EDIT_HTML_CHARS = 600_000;

/** Attributes the in-frame editor adds. All of them are removed before saving (in the frame, and again on the server). */
export const EDIT_ATTR = {
  text: "data-sf-text",
  image: "data-sf-img",
  ui: "data-sf-edit-ui",
  style: "data-sf-edit",
  guard: "data-sf-preview-guard",
  addedTabindex: "data-sf-ti",
  addedRole: "data-sf-ro",
  addedLabel: "data-sf-al",
} as const;

/** Every message carries the per-session token under this key; the receiver ignores messages without it. */
export const EDIT_TOKEN_KEY = "sfEdit";

export type FrameToParent =
  | { type: "ready"; editable: number; photos: number; canvas: boolean }
  | { type: "dirty"; dirty: boolean }
  | { type: "save-request" }
  | { type: "exit-request" }
  | { type: "pick-image"; id: string; kind: "photo" | "project_image" }
  | { type: "html"; reqId: string; html: string; scrollY: number }
  | { type: "scroll"; y: number };

export type ParentToFrame =
  | { type: "serialize"; reqId: string }
  | { type: "set-image"; id: string; url: string }
  | { type: "saved" }
  | { type: "announce"; text: string };

/** A signed Storage URL handed back by the upload API (or a data: image) is the only thing allowed to become an image src. */
export function isAllowedNewImageUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(url)) return true;
  try {
    const u = new URL(url);
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    return (u.protocol === "https:" || (local && u.protocol === "http:")) && u.pathname.startsWith("/storage/v1/object/sign/uploads/");
  } catch {
    return false;
  }
}
