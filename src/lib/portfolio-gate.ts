import type { Content } from "@/data/content";

/**
 * A portfolio counts as "ready" once it has real profile content — the
 * same heuristic LivePreview already uses to decide whether to show the
 * empty state. Works whichever way the content got there (AI generation
 * or direct edits), since it just looks at the data, not how it arrived.
 */
export function isPortfolioReady(content: Pick<Content, "profile"> | null | undefined): boolean {
  if (!content) return false;
  const p = content.profile;
  return Boolean(p.name?.trim() || p.role?.trim() || p.thesis?.trim());
}

/**
 * Single source of truth for "can this user open Studio right now" —
 * every place that shows or guards the Studio link calls this, not its
 * own copy of the check.
 *
 * `isAdmin` (see users.is_admin, granted only via the /admin panel) skips
 * the "generate a portfolio first" gate entirely — the admin exemption
 * requested for that flag. Everyone else keeps the existing rule.
 */
export function canAccessStudio(opts: { portfolioReady: boolean | null; isAdmin?: boolean }): boolean {
  return opts.isAdmin === true || opts.portfolioReady === true;
}
