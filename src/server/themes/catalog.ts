import { registry } from "./registry";
import type { ThemeManifest } from "./types";

export interface CatalogTheme {
  id: string;
  name: string;
  tagline: string;
  profession: ThemeManifest["profession"];
  feel: ThemeManifest["feel"];
  tier: ThemeManifest["tier"];
  sections: ThemeManifest["sections"];
  questions: ThemeManifest["questions"];
  cssVars: ThemeManifest["cssVars"];
  fonts: string[];
}

export function listThemeCatalog(): CatalogTheme[] {
  return registry.listReady().map((t) => ({
    id: t.id, name: t.name, tagline: t.tagline, profession: t.profession, feel: t.feel, tier: t.tier,
    sections: t.sections, questions: t.questions, cssVars: t.cssVars, fonts: t.fonts,
  }));
}
