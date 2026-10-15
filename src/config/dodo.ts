/**
 * Dodo Payments — verified against their official docs on 2026-09-17.
 * Checkout Sessions API: POST {base}/checkouts with product_cart/customer/
 * return_url/metadata, returns { session_id, checkout_url }. Webhooks
 * follow the open Standard Webhooks spec (see src/lib/standard-webhooks.ts) —
 * not Dodo-specific, so no SDK needed for verification either.
 */
export function getDodoApiBase(): string {
  const env = process.env["DODO_ENVIRONMENT"] ?? "test_mode";
  return env === "live_mode" ? "https://live.dodopayments.com" : "https://test.dodopayments.com";
}

export function getDodoApiKey(): string {
  const key = process.env["DODO_PAYMENTS_API_KEY"];
  if (!key) throw new Error("DODO_PAYMENTS_API_KEY must be set");
  return key;
}

/** The one product this app sells: Pro unlock + 1 year hosting (a subscription with a 365-day paid trial). */
export function getDodoProProductId(region: "IN" | "ROW" = "ROW"): string {
  // Two products, because a trial amount is not localised by Dodo: the INR product
  // (UPI works only in INR) is priced in rupees, the USD one in dollars.
  const name = region === "IN" ? "DODO_PRODUCT_ID_PRO_IN" : "DODO_PRODUCT_ID_PRO";
  const id = process.env[name];
  if (!id) throw new Error(`${name} must be set`);
  return id;
}

export function getDodoWebhookSecret(): string {
  const secret = process.env["DODO_WEBHOOK_SECRET"];
  if (!secret) throw new Error("DODO_WEBHOOK_SECRET must be set");
  return secret;
}
