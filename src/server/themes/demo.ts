import { registry } from "./registry";
import { renderTheme } from "./render";
import { sampleContent } from "./samples";

/** The demo page for a ready theme, or undefined for an unknown or not-ready one. Uses a made-up person, never a real user. */
export function renderThemeDemo(id: string): string | undefined {
  const manifest = registry.getReady(id);
  const template = manifest ? registry.template(manifest.id) : undefined;
  if (!manifest || !template) return undefined;
  return renderTheme({ manifest, template, content: sampleContent(manifest.profession) });
}
