import { registry } from "./registry";

/** The text added to the generation prompt for a chosen theme, or undefined for a custom build or unknown id. */
export function designBriefFor(themeId: string | undefined): string | undefined {
  const theme = themeId ? registry.get(themeId) : undefined;
  if (!theme) return undefined;
  const reference = theme.reference ? `\nDesign fingerprint of the reference implementation (techniques it uses, not content):\n${theme.reference}` : "";
  return `Follow this design language ("${theme.name}"). Use it for look, layout and interaction only; every fact still comes from the resume. If the resume has no figure or detail for an element of this design, leave that element out; never invent numbers, names or claims to fill it.\n${theme.brief}${reference}`;
}
