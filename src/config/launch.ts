export type LaunchMode = "waitlist" | "live";

/**
 * Values that mean "not launched yet" -> waitlist. "waitlist" is the
 * canonical one; the boolean-ish spellings are accepted because
 * VITE_LAUNCH_MODE=false is the natural thing to type when you mean
 * "launch is off", and silently treating that as "live" (the old strict
 * behavior) showed the real sign-in page when the waitlist was intended.
 * Anything else (unset, "live", "true", ...) is live.
 */
const WAITLIST_VALUES = new Set(["waitlist", "false", "0", "off", "no"]);

/**
 * Single toggle for the whole marketing site: "waitlist" swaps every
 * sign-up CTA for an email-capture form instead of a real /login link.
 * Client-safe (VITE_-prefixed) since it only gates which UI renders, not
 * anything sensitive. It's inlined at BUILD time, so changing it in Vercel
 * env vars only takes effect on the next deployment.
 */
export function getLaunchMode(): LaunchMode {
  const raw = String(import.meta.env["VITE_LAUNCH_MODE"] ?? "")
    .trim()
    .toLowerCase();
  return WAITLIST_VALUES.has(raw) ? "waitlist" : "live";
}
