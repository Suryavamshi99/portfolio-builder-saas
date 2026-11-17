import type { ThemeContent, ThemeManifest, ThemeOptions } from "./types";

export const DATA_PLACEHOLDER = "__FOLIO_DATA__";
export const OPTIONS_PLACEHOLDER = "<!--FOLIO_OPTIONS-->";

const HEX = /^#[0-9a-fA-F]{6}$/;
const RADIUS_PX = { sharp: "0px", soft: "10px", round: "24px" } as const;

/** JSON that is safe to place inside a script element: nothing in it can close the tag or open a comment. */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function googleFontsHref(families: string[]): string {
  const q = families.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700`).join("&");
  return `https://fonts.googleapis.com/css2?${q}&display=swap`;
}

/** Style and script for the user's validated look options. Only names the manifest declares are ever written. */
export function optionsHead(manifest: ThemeManifest, options: ThemeOptions): string {
  const rules: string[] = [];
  const links: string[] = [];

  const allowedVars = new Set(manifest.cssVars.map((v) => v.name));
  for (const [name, value] of Object.entries(options.colors ?? {})) {
    if (allowedVars.has(name) && HEX.test(value)) rules.push(`${name}:${value}`);
  }

  const fonts: string[] = [];
  const font = (family: string | undefined, cssVar: string | undefined) => {
    if (!family || !cssVar || !manifest.fonts.includes(family)) return;
    fonts.push(family);
    rules.push(`${cssVar}:"${family}",system-ui,sans-serif`);
  };
  font(options.fontDisplay, manifest.fontVars?.display);
  font(options.fontBody, manifest.fontVars?.body);
  if (fonts.length) links.push(`<link rel="stylesheet" href="${escapeAttr(googleFontsHref([...new Set(fonts)]))}">`);

  if (options.radius && manifest.radiusVar) rules.push(`${manifest.radiusVar}:${RADIUS_PX[options.radius]}`);

  const sectionIds = new Set(manifest.sections.map((s) => s.id));
  const hidden = (options.hidden ?? []).filter((id) => sectionIds.has(id));
  const order = (options.order ?? []).filter((id) => sectionIds.has(id));

  const css: string[] = [];
  if (rules.length) css.push(`:root{${rules.join(";")}}`);
  for (const id of hidden) css.push(`#${id}{display:none !important}`);

  const parts: string[] = [...links];
  if (css.length) parts.push(`<style id="folio-options">${css.join("\n")}</style>`);
  if (order.length) {
    // Reorders existing sections inside their shared parent after the theme has drawn them. Moves nodes only; adds no text.
    parts.push(
      `<script id="folio-order">addEventListener("load",function(){var ids=${jsonForScript(order)};ids.forEach(function(id){var e=document.getElementById(id);if(e&&e.parentNode)e.parentNode.appendChild(e)})})</script>`,
    );
  }
  return parts.join("\n");
}

export interface RenderInput {
  manifest: ThemeManifest;
  template: string;
  content: ThemeContent;
  options?: ThemeOptions;
}

/** Fills a theme template: the data island, the look options, the page title and a marker naming the theme. */
export function renderTheme({ manifest, template, content, options = {} }: RenderInput): string {
  if (!template.includes(DATA_PLACEHOLDER)) throw new Error(`Theme ${manifest.id} has no data placeholder`);
  if (!template.includes(OPTIONS_PLACEHOLDER)) throw new Error(`Theme ${manifest.id} has no options placeholder`);

  const data = { ...content, demo: false };
  const fullName = [content.person?.first_name, content.person?.last_name].filter(Boolean).join(" ");
  const title = content.meta?.site_title || [fullName, content.person?.headline].filter(Boolean).join(" · ");
  const head = `<meta name="shipfolio-theme" content="${escapeAttr(manifest.id)}">\n${optionsHead(manifest, options)}`;

  let html = template.split(DATA_PLACEHOLDER).join(jsonForScript(data)).split(OPTIONS_PLACEHOLDER).join(head);
  if (title) html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeAttr(title).replace(/&quot;/g, '"')}</title>`);
  return html;
}
