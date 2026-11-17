import { registry as defaultRegistry, type ThemeRegistry } from "./registry";

export type ThemeAccess = { ok: true } | { ok: false; status: 400 | 402; code: "invalid_request" | "theme_requires_pro"; message: string };

/** Server-side tier gate: a theme must exist and be ready; a paid theme needs paid access. */
export function checkThemeAccess(id: string, paid: boolean, reg: ThemeRegistry = defaultRegistry): ThemeAccess {
  const manifest = reg.getReady(id);
  if (!manifest) return { ok: false, status: 400, code: "invalid_request", message: "That theme isn't available" };
  if (manifest.tier === "paid" && !paid) return { ok: false, status: 402, code: "theme_requires_pro", message: "This theme is part of the paid plan" };
  return { ok: true };
}
