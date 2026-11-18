import { registry } from "./registry";
import type { SectionKey } from "./facts";
import { getTemplate } from "./templates";
import type { Theme } from "./types";

/**
 * What the gallery needs. The brief stays on the server.
 * `sections` and `defaultAccent` come from the theme's template, so the "Make it yours" panel only offers what the layout can do;
 * a theme without a template has no sections and no customising.
 */
export type CatalogTheme = Omit<Theme, "brief" | "reference"> & { sections: SectionKey[]; defaultAccent: string };

export function listThemeCatalog(): CatalogTheme[] {
  return registry.list().map(({ brief: _brief, reference: _reference, ...rest }) => {
    const template = getTemplate(rest.id);
    return { ...rest, sections: template ? [...template.sections] : [], defaultAccent: template?.defaultAccent ?? rest.palette[rest.palette.length - 1] ?? "#000000" };
  });
}
