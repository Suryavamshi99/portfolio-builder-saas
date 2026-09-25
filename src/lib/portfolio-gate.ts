/**
 * A portfolio counts as "ready" once generation has produced real HTML —
 * works whichever way it got there (AI generation is currently the only
 * way, but this doesn't care how).
 */
export function isPortfolioReady(html: string | null | undefined): boolean {
  return Boolean(html?.trim());
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
