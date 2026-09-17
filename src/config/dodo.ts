/**
 * Dodo Payments — verified against their official docs on 2026-09-17.
 * Checkout Sessions API: POST {base}/checkouts with product_cart/customer/
 * return_url/metadata, returns { session_id, checkout_url }. Webhooks
 * follow the open Standard Webhooks spec (see src/lib/standard-webhooks.ts) —
 * not Dodo-specific, so no SDK needed for verification either.
 */
export function getDodoApiBase(): string {
  const env = process.env["DODO_ENVIRONMENT"] ?? "test_mode";
  return env === "live_mode" ? "https://dodopayments.com" : "https://test.dodopayments.com";
}

export function getDodoApiKey(): string {
  const key = process.env["DODO_PAYMENTS_API_KEY"];
  if (!key) throw new Error("DODO_PAYMENTS_API_KEY must be set");
  return key;
}

/** The one product this app sells: the Pro lifetime unlock. */
export function getDodoProProductId(): string {
  const id = process.env["DODO_PRODUCT_ID_PRO"];
  if (!id) throw new Error("DODO_PRODUCT_ID_PRO must be set");
  return id;
}

export function getDodoWebhookSecret(): string {
  const secret = process.env["DODO_WEBHOOK_SECRET"];
  if (!secret) throw new Error("DODO_WEBHOOK_SECRET must be set");
  return secret;
}
