export type Plan = "free";

/**
 * Storage quota per plan. Free-tier value per the project brief; paid
 * tiers get added here (not hardcoded elsewhere) once billing exists —
 * `users.plan` is already the extension point, this is its config.
 */
export const PLAN_STORAGE_QUOTA_BYTES: Record<Plan, number> = {
  free: 50 * 1024 * 1024,
};

export const DEFAULT_PLAN: Plan = "free";
