import { customisationsSchema, NO_CUSTOMISATIONS, portfolioFactsSchema, type Customisations, type PortfolioFacts } from "../facts";
import { withNotice } from "@/config/notice";
import type { ThemeTemplate } from "./types";

// One file per theme in ./themes/<id>.ts, each with `export default` a ThemeTemplate. A theme without a file falls back to the brief path.
const modules = import.meta.glob<{ default: ThemeTemplate }>("./themes/*.ts", { eager: true });
const byId = new Map<string, ThemeTemplate>(Object.values(modules).map((m) => [m.default.id, m.default]));

export function getTemplate(id: string | undefined): ThemeTemplate | undefined {
  return id ? byId.get(id) : undefined;
}
export function templateIds(): string[] {
  return [...byId.keys()];
}

/** The finished HTML document for a theme, filled from the user's facts and customisations. Throws on an unknown theme or invalid input. */
export function renderTheme(id: string, factsIn: unknown, customIn: unknown = NO_CUSTOMISATIONS): string {
  const t = getTemplate(id);
  if (!t) throw new Error(`No template for theme "${id}"`);
  const facts: PortfolioFacts = portfolioFactsSchema.parse(factsIn);
  const custom: Customisations = customisationsSchema.parse(customIn ?? {});
  // Every look carries the same small design-credit and copyright notice (see src/config/notice.ts).
  return withNotice(t.render({ facts, custom }));
}
