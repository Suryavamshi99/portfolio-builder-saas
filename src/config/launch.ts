export type LaunchMode = "waitlist" | "live";

/**
 * Single toggle for the whole marketing site: "waitlist" swaps every
 * sign-up CTA for an email-capture form instead of a real /login link.
 * Client-safe (VITE_-prefixed) since it only gates which UI renders, not
 * anything sensitive — flip it in Vercel env vars and redeploy.
 */
export function getLaunchMode(): LaunchMode {
  return import.meta.env["VITE_LAUNCH_MODE"] === "waitlist" ? "waitlist" : "live";
}
