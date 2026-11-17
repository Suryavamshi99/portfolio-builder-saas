import { z } from "zod";
import type { ModelCall } from "./content";
import type { ThemeManifest, ThemeOptions } from "./types";

export interface PreferenceResult {
  options: ThemeOptions;
  /** Parts of the request this theme cannot do. The UI offers the custom path for these (R14). */
  declined: string[];
}

const HEX = /^#[0-9a-fA-F]{6}$/;

const ReplySchema = z.object({
  colors: z.record(z.string(), z.string()).optional(),
  fontDisplay: z.string().optional(),
  fontBody: z.string().optional(),
  radius: z.enum(["sharp", "soft", "round"]).optional(),
  order: z.array(z.string()).optional(),
  hidden: z.array(z.string()).optional(),
  declined: z.array(z.string().max(200)).optional(),
});

export const OPTIONS_SYSTEM = `You turn a user's typed wish for how their portfolio should look into settings. Reply with one JSON object and nothing else.
You may only use the settings offered. Anything the user asks that the settings cannot do (changing the layout, adding features, rewriting content, new sections) goes in "declined" as a short phrase. Never put text for the page in any setting.`;

export function buildOptionsMessage(manifest: ThemeManifest, preferences: string): string {
  const lines = [
    `Theme: ${manifest.name} (${manifest.feel}).`,
    `Colour settings (hex like #1a2b3c): ${manifest.cssVars.map((v) => `${v.name} = ${v.label}`).join("; ") || "none"}`,
    `Fonts allowed (display/body): ${manifest.fontVars ? manifest.fonts.join(", ") : "none"}`,
    `Corner style: ${manifest.radiusVar ? "sharp | soft | round" : "not available"}`,
    `Sections (ids) that can be hidden or reordered: ${manifest.sections.map((s) => `${s.id} (${s.label})`).join(", ") || "none"}`,
  ];
  return `${lines.join("\n")}\n\nUser's wish:\n"""\n${preferences}\n"""\n\nReturn JSON: {"colors":{"--var":"#hex"},"fontDisplay":"","fontBody":"","radius":"","order":["section id"],"hidden":["section id"],"declined":["what could not be done"]}. Omit what the user did not ask for.`;
}

/** Keeps only settings this theme declares, then reports what was left out. Pure; no model needed. */
export function validateOptions(manifest: ThemeManifest, raw: z.infer<typeof ReplySchema>): PreferenceResult {
  const options: ThemeOptions = {};
  const declined = [...(raw.declined ?? [])];

  const allowedVars = new Set(manifest.cssVars.map((v) => v.name));
  const colors: Record<string, string> = {};
  for (const [name, value] of Object.entries(raw.colors ?? {})) {
    if (allowedVars.has(name) && HEX.test(value)) colors[name] = value;
    else declined.push(`colour ${name}`);
  }
  if (Object.keys(colors).length) options.colors = colors;

  const font = (family: string | undefined, cssVar: string | undefined, label: string) => {
    if (!family) return undefined;
    if (cssVar && manifest.fonts.includes(family)) return family;
    declined.push(`${label} font ${family}`);
    return undefined;
  };
  const fd = font(raw.fontDisplay, manifest.fontVars?.display, "heading");
  const fb = font(raw.fontBody, manifest.fontVars?.body, "body");
  if (fd) options.fontDisplay = fd;
  if (fb) options.fontBody = fb;

  if (raw.radius) {
    if (manifest.radiusVar) options.radius = raw.radius;
    else declined.push("corner style");
  }

  const ids = new Set(manifest.sections.map((s) => s.id));
  const hidden = (raw.hidden ?? []).filter((id) => ids.has(id));
  const order = (raw.order ?? []).filter((id) => ids.has(id));
  if ((raw.hidden ?? []).length > hidden.length || (raw.order ?? []).length > order.length) declined.push("sections this theme does not have");
  if (hidden.length) options.hidden = hidden;
  if (order.length) options.order = order;

  return { options, declined: [...new Set(declined)] };
}

export async function interpretPreferences(
  manifest: ThemeManifest,
  preferences: string | undefined,
  model: ModelCall | undefined,
): Promise<PreferenceResult> {
  const text = preferences?.trim();
  if (!text) return { options: {}, declined: [] };
  if (!model) return { options: {}, declined: [text.slice(0, 200)] };
  try {
    const reply = await model(OPTIONS_SYSTEM, buildOptionsMessage(manifest, text), 800);
    const start = reply.indexOf("{");
    const end = reply.lastIndexOf("}");
    if (start < 0 || end <= start) return { options: {}, declined: [text.slice(0, 200)] };
    const parsed = ReplySchema.safeParse(JSON.parse(reply.slice(start, end + 1)));
    if (!parsed.success) return { options: {}, declined: [text.slice(0, 200)] };
    return validateOptions(manifest, parsed.data);
  } catch {
    return { options: {}, declined: [text.slice(0, 200)] };
  }
}
