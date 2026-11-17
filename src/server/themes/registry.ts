import type { ThemeManifest } from "./types";

export interface ThemeRegistry {
  /** Every theme, ready or not. Used by tests and the porting checks. */
  all(): ThemeManifest[];
  /** Themes users can see and build: only those marked ready after a browser comparison with their original. */
  listReady(): ThemeManifest[];
  /** A theme users may use, or undefined when it is unknown, not ready, or has no template. */
  getReady(id: string): ThemeManifest | undefined;
  get(id: string): ThemeManifest | undefined;
  template(id: string): string | undefined;
}

export function createRegistry(manifests: ThemeManifest[], templates: Record<string, string>): ThemeRegistry {
  const usable = (t: ThemeManifest) => t.ready && typeof templates[t.id] === "string";
  return {
    all: () => manifests,
    listReady: () => manifests.filter(usable),
    getReady: (id) => manifests.find((t) => t.id === id && usable(t)),
    get: (id) => manifests.find((t) => t.id === id),
    template: (id) => templates[id],
  };
}

// Each theme lives in its own folder: manifest.ts (default export) and template.html (the page skeleton).
const manifestModules = import.meta.glob<{ default: ThemeManifest }>("./*/manifest.ts", { eager: true });
const templateModules = import.meta.glob<string>("./*/template.html", { eager: true, query: "?raw", import: "default" });

const templatesById: Record<string, string> = {};
for (const [path, html] of Object.entries(templateModules)) {
  const id = path.split("/")[1];
  if (id) templatesById[id] = html;
}

export const registry: ThemeRegistry = createRegistry(
  Object.values(manifestModules).map((m) => m.default),
  templatesById,
);

export function isPaidTheme(manifest: ThemeManifest): boolean {
  return manifest.tier === "paid";
}
