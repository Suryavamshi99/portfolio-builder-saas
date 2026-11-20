import { templatesEnabled } from "@/config/templates";
import { registry as defaultRegistry, type ThemeRegistry } from "./registry";

export type ThemeAccess =
  | { ok: true }
  | { ok: false; status: 400 | 402 | 403; code: "invalid_request" | "theme_requires_pro" | "templates_muy_only" | "templates_disabled"; message: string };

/**
 * Server-side gate: nothing is allowed while the TEMPLATES_ENABLED switch is off; ready-made looks are for Masters' Union students (`eligible`, see audience.ts);
 * the theme must exist; a paid theme also needs paid access.
 */
export function checkThemeAccess(id: string, paid: boolean, eligible: boolean, reg: ThemeRegistry = defaultRegistry): ThemeAccess {
  if (!templatesEnabled()) return { ok: false, status: 403, code: "templates_disabled", message: "Ready-made looks aren't available right now. Choose Custom to have a page designed from scratch." };
  if (!eligible) return { ok: false, status: 403, code: "templates_muy_only", message: "Ready-made looks are for Masters' Union students. Choose Custom to have a page designed from scratch." };
  const theme = reg.get(id);
  if (!theme) return { ok: false, status: 400, code: "invalid_request", message: "That theme isn't available" };
  if (theme.tier === "paid" && !paid) return { ok: false, status: 402, code: "theme_requires_pro", message: "This theme is part of the paid plan" };
  return { ok: true };
}
