import { registry } from "./registry";
import type { Theme } from "./types";

/** What the gallery needs. The brief stays on the server. */
export type CatalogTheme = Omit<Theme, "brief" | "reference">;

export function listThemeCatalog(): CatalogTheme[] {
  return registry.list().map(({ brief: _brief, reference: _reference, ...rest }) => rest);
}
