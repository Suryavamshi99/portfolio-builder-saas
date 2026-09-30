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
