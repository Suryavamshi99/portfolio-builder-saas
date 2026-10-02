/**
 * Kill switch for the whole payment system — publish, Vercel connect, and
 * (while this is the only consumer that cares) Studio's HTML download all
 * key off hasPaidAccess() in src/server/users.ts, which checks this first.
 * Server-only (not VITE_-prefixed): flipping it never needs a client
 * rebuild, only a redeploy/restart, and it can't be inspected or spoofed
 * from the browser the way a client-bundled flag could.
 *
 * Defaults to enabled (real payment enforcement) when unset, so a project
 * that forgets to set this in a new environment fails closed, not open.
 * Set PAYMENTS_ENABLED=false to make every paid-gated action free for
 * everyone — useful for a demo, a free launch window, or local testing.
 */
export function paymentsEnabled(): boolean {
  return process.env["PAYMENTS_ENABLED"] !== "false";
}
