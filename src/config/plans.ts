export type Plan = "free" | "pro";

export const DEFAULT_PLAN: Plan = "free";

/**
 * Single source of truth for every plan-gated limit. "unlimited portfolios"
 * isn't here — the schema only supports one portfolio per user, for
 * everyone (portfolios.user_id is the primary key), so that's not a lever
 * this phase can pull. What actually gates Free vs. Pro instead: storage
 * quota, generation/upload rate limits, and the "Published with Shipfolio"
 * badge in the template (see src/server/template/render.ts).
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

/** One-time lifetime unlock price, in whole currency units — for display only; Dodo's product itself is the source of truth for what's actually charged. */
export const PRO_PRICE_USD = 19;
