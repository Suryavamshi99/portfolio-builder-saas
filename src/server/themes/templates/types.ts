import type { Customisations, PortfolioFacts, SectionKey } from "../facts";

export interface RenderInput {
  facts: PortfolioFacts;
  custom: Customisations;
}

/**
 * One theme as a real template: the sample site's layout and motion with slots filled from the user's facts.
 * Rules (checked by templates.test.ts):
 *  - Output is ONE self-contained HTML document: inline CSS and JS, no external script/link/img (Google Fonts stylesheet is the only outside link),
 *    no fetch/XHR, no forms; it must pass finalizeHtml and the published-page CSP (src/server/site-csp.ts).
 *  - Only the user's facts appear as text. No placeholder, sample or invented text; a section with no data is not rendered (use visibleSections).
 *  - All user text goes through esc()/attr() from ./helpers. Facts embedded for scripts go through safeJson().
 */
export interface ThemeTemplate {
  id: string;
  /** The sections this layout can show, in its default order. Anything else the facts hold is simply not shown. */
  sections: SectionKey[];
  /** The theme's main accent colour, used when the user picks none. */
  defaultAccent: string;
  render(input: RenderInput): string;
}
