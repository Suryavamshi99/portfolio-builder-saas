import { getDodoApiBase, getDodoApiKey, getDodoProProductId } from "@/config/dodo";

export class DodoCheckoutError extends Error {}

/**
 * One checkout buys everything: the product is a Dodo subscription with a
 * 365-day paid trial, so the buyer pays the Pro price now (which also covers
 * year-one hosting) and hosting renews yearly from year 2.
 *
 * `country` pins the billing country (from IP geo-location), which selects the
 * fixed INR price for India — UPI only works in INR — and USD elsewhere.
 */
export async function createProCheckoutSession(opts: {
  userId: string;
  email: string;
  returnUrl: string;
  country?: string | undefined;
}): Promise<{ checkoutUrl: string }> {
  const res = await fetch(`${getDodoApiBase()}/checkouts`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${getDodoApiKey()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      product_cart: [{ product_id: getDodoProProductId(), quantity: 1 }],
      customer: { email: opts.email },
      ...(opts.country ? { billing_address: { country: opts.country } } : {}),
      return_url: opts.returnUrl,
      metadata: { userId: opts.userId },
    }),
  });

  if (!res.ok) {
    throw new DodoCheckoutError(`Dodo checkout session creation failed (${res.status}): ${(await res.text()).slice(0, 500)}`);
  }

  const json = (await res.json()) as { checkout_url?: string };
  if (!json.checkout_url) throw new DodoCheckoutError("Dodo checkout response had no checkout_url");
  return { checkoutUrl: json.checkout_url };
}
