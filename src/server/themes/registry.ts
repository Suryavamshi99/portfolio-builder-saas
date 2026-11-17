import { THEMES } from "./themes";
import type { Theme } from "./types";

export interface ThemeRegistry {
  list(): Theme[];
  get(id: string): Theme | undefined;
}

export function createRegistry(themes: Theme[]): ThemeRegistry {
  return { list: () => themes, get: (id) => themes.find((t) => t.id === id) };
}

// One text file per theme in ./reference, made by scripts/theme-brief/extract.mjs from the original sample's code.
const references = import.meta.glob<string>("./reference/*.txt", { eager: true, query: "?raw", import: "default" });
const referenceFor = (id: string) => references[`./reference/${id}.txt`];

export const registry: ThemeRegistry = createRegistry(THEMES.map((t) => ({ ...t, reference: referenceFor(t.id) })));
