/**
 * Dev-only escape hatch for testing the paywall without a real Dodo
 * checkout: swaps /api/billing/checkout to hand back a same-origin dummy
 * page (Success/Fail buttons) instead of calling Dodo, and lets that page's
 * POST simulate the plan-flip a real webhook would otherwise perform.
 *
 * Gated on NODE_ENV, not just the presence of the flag, so a leaked/stale
 * env var can never turn this on in a production deployment — see the
 * matching note in src/routes/api/dev/payment-test.ts.
 */
export function isDummyPaymentModeEnabled(): boolean {
  return process.env["PAYMENT_TEST_MODE"] === "dummy" && process.env["NODE_ENV"] !== "production";
}

/**
 * Demo-day exception to the rule above: one named account may use the dummy
 * checkout in production. Gated server-side on the signed-in user's id
 * matching DEMO_PAYMENT_USER_ID, so every other user (and every request when
 * the variable is unset) gets the real Dodo checkout and a 404 from the dummy
 * page. Unset the variable to switch it off.
 */
export function isDemoPaymentUser(userId: string): boolean {
  const demoId = process.env["DEMO_PAYMENT_USER_ID"]?.trim();
  return Boolean(demoId) && demoId === userId;
}

/** True when this user should be sent to the dummy checkout instead of Dodo. */
export function usesDummyCheckout(userId: string): boolean {
  return isDummyPaymentModeEnabled() || isDemoPaymentUser(userId);
}
