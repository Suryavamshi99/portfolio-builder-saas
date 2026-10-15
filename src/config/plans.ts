export type Plan = "free" | "pro";

export const DEFAULT_PLAN: Plan = "free";

/**
 * Single source of truth for every plan-gated limit. "unlimited portfolios"
 * isn't here — the schema only supports one portfolio per user, for
 * everyone (portfolios.user_id is the primary key), so that's not a lever
 * this phase can pull. What actually gates Free vs. Pro instead: storage
 * quota, generation/upload rate limits, and publishing itself — only Pro
 * (or an admin, see users.is_admin) can publish at all (/api/publish).
 */
export const PLAN_STORAGE_QUOTA_BYTES: Record<Plan, number> = {
  free: 50 * 1024 * 1024,
  pro: 250 * 1024 * 1024,
};

export const PLAN_GENERATIONS_PER_HOUR: Record<Plan, number> = {
  free: 5,
  pro: 20,
};

export const PLAN_UPLOADS_PER_HOUR: Record<Plan, number> = {
  free: 10,
  pro: 30,
};

/** Pro unlock price in USD (includes year-one hosting) — only used by the dev dummy payment page; real display prices live in src/config/pricing.ts. */
export const PRO_PRICE_USD = 9;
