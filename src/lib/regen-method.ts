/**
 * Which method the Studio's "Regenerate" uses. It follows the method that built the page (a page built with the
 * free models is regenerated with the free models, not with a Gemini key the user may not have), unless the
 * user picked another one.
 */
export type RegenMethod = "free" | "gemini" | "mcp";

export const REGEN_METHOD_KEY = "shipfolio:regen-method";

export const REGEN_METHODS: Array<{ id: RegenMethod; label: string }> = [
  { id: "free", label: "Free models" },
  { id: "gemini", label: "My Gemini key" },
  { id: "mcp", label: "Claude / ChatGPT" },
];

const isMethod = (v: unknown): v is RegenMethod => v === "free" || v === "gemini" || v === "mcp";

/** The user's saved choice wins, then the method of the latest build, then the free models. */
export function pickRegenMethod(saved: string | null | undefined, latestSource: string | null | undefined): RegenMethod {
  if (isMethod(saved)) return saved;
  if (isMethod(latestSource)) return latestSource;
  return "free";
}

/** After a failure (no Gemini key, models busy), the method to suggest instead. */
export function otherMethod(current: RegenMethod): RegenMethod {
  return current === "free" ? "gemini" : "free";
}

/** What to paste into Claude or ChatGPT: they already have the Shipfolio tools, which can read and save the page. */
export function mcpEditPrompt(instructions: string): string {
  const changes = instructions.trim() || "(describe what you want changed)";
  return `Update my Shipfolio portfolio. First call get_portfolio_html to read the current page, then apply the changes below and save the complete page with save_portfolio_html. Do not paste the HTML in the chat; just tell me when it is saved.

Changes: ${changes}`;
}

export const claudeUrl = (prompt: string) => `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
export const chatgptUrl = (prompt: string) => `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
