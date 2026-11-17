import { THEMES } from "./themes";
import type { Theme } from "./types";

export interface ThemeRegistry {
  list(): Theme[];
  get(id: string): Theme | undefined;
}

export function createRegistry(themes: Theme[]): ThemeRegistry {
  return { list: () => themes, get: (id) => themes.find((t) => t.id === id) };
}

export const registry: ThemeRegistry = createRegistry(THEMES);
