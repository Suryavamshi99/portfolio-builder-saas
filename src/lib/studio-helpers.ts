import type { JobStatus, SiteCheckStatus } from "./api-client";

/**
 * Clean and format a slug candidates for portfolio subdomains.
 * Lowercase, alphanumeric and hyphens only, collapsed dashes, trimmed.
 */
export function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Human-friendly feedback and state interpretation for slug validation.
 */
export function getSlugFeedback(status: SiteCheckStatus | "checking" | "idle" | "empty" | "too_short"): {
  message: string;
  variant: "idle" | "checking" | "available" | "unavailable" | "error";
  canPublish: boolean;
} {
  switch (status) {
    case "idle":
    case "empty":
      return {
        message: "Enter a subdomain for your portfolio (3–40 characters)",
        variant: "idle",
        canPublish: false,
      };
    case "too_short":
      return {
        message: "Subdomain must be at least 3 characters",
        variant: "unavailable",
        canPublish: false,
      };
    case "checking":
      return {
        message: "Checking availability…",
        variant: "checking",
        canPublish: false,
      };
    case "available":
      return {
        message: "Available! Your address will be locked on publish.",
        variant: "available",
        canPublish: true,
      };
    case "yours":
      return {
        message: "This is already your site address.",
        variant: "available",
        canPublish: true,
      };
    case "taken":
      return {
        message: "That name is already taken. Please choose another.",
        variant: "unavailable",
        canPublish: false,
      };
    case "reserved":
      return {
        message: "That name is reserved. Please choose another.",
        variant: "unavailable",
        canPublish: false,
      };
    case "invalid":
      return {
        message: "Not allowed. Use 3–40 lowercase letters, numbers, or hyphens.",
        variant: "error",
        canPublish: false,
      };
  }
}

/**
 * Checks whether a job status is terminal.
 */
export function isJobTerminal(status: JobStatus): boolean {
  return status === "done" || status === "failed";
}

/**
 * Polling stop condition evaluation.
 * Returns true if polling should continue, false if it should stop.
 */
export function shouldContinuePollingJob(opts: {
  status: JobStatus;
  elapsedMs: number;
  maxTimeoutMs?: number;
}): {
  shouldContinue: boolean;
  isTimedOut: boolean;
} {
  const maxTimeout = opts.maxTimeoutMs ?? 10 * 60 * 1000; // 10 minutes default
  if (isJobTerminal(opts.status)) {
    return { shouldContinue: false, isTimedOut: false };
  }
  if (opts.elapsedMs >= maxTimeout) {
    return { shouldContinue: false, isTimedOut: true };
  }
  return { shouldContinue: true, isTimedOut: false };
}
