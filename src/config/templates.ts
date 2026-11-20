/**
 * Master switch for the ready-made looks (templates). OFF unless TEMPLATES_ENABLED=true.
 * Off means: no template can be built (website or connector), no look is listed, and the
 * picker is gone. Custom pages and the company look are unaffected.
 * Read inside handlers, never at module scope.
 */
export function templatesEnabled(): boolean {
  return process.env["TEMPLATES_ENABLED"] === "true";
}
