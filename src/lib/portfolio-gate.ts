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
 * `plan` is accepted (and currently ignored) on purpose: it's the
 * extension point for future paid-tier rules — e.g. free tier stays
 * wizard-only until a portfolio exists, a paid tier might skip that gate
 * entirely — without touching every call site again once billing exists.
 * Not enforced yet, matching how `users.plan` itself is handled server-side.
 */
export function canAccessStudio(opts: { portfolioReady: boolean | null; plan?: string }): boolean {
  return opts.portfolioReady === true;
}
