import { getDodoApiBase, getDodoApiKey, getDodoProProductId } from "@/config/dodo";
import { pricingFor, regionForCountry } from "@/config/pricing";

export class DodoCheckoutError extends Error {}

/**
 * One checkout buys everything: the product is a Dodo subscription with a
 * 365-day paid trial, so the buyer pays the Pro price now (which also covers
 * year-one hosting) and hosting renews yearly from year 2.
 *
 * `country` comes from IP geo-location. India gets the INR product (UPI only
 * works in INR); everyone else gets the USD product. It is also pinned as the
 * billing country so the checkout matches the price shown on our pages.
 */
export async function createProCheckoutSession(opts: {
  userId: string;
  email: string;
  returnUrl: string;
  country?: string | undefined;
}): Promise<{ checkoutUrl: string }> {
  const region = regionForCountry(opts.country);
  const res = await fetch(`${getDodoApiBase()}/checkouts`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${getDodoApiKey()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      product_cart: [{ product_id: getDodoProProductId(region), quantity: 1 }],
      customer: { email: opts.email },
      ...(opts.country ? { billing_address: { country: opts.country } } : {}),
      return_url: opts.returnUrl,
      // The hosted page's layout is fixed; the pay button is one place we can state the price.
      customization: { theme_config: { pay_button_text: `Pay ${pricingFor(region).today} and go live` } },
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
