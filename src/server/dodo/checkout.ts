import { getDodoApiBase, getDodoApiKey, getDodoHostingProductId, getDodoProProductId } from "@/config/dodo";
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
  /** "hosting": a Pro user renewing lapsed hosting (no trial, no second Pro charge). */
  product?: "pro" | "hosting";
}): Promise<{ checkoutUrl: string }> {
  const region = regionForCountry(opts.country);
  const renewing = opts.product === "hosting";
  const productId = renewing ? getDodoHostingProductId(region) : getDodoProProductId(region);
  const buttonText = renewing ? `Renew hosting ${pricingFor(region).renewal}/year` : `Pay ${pricingFor(region).today} and go live`;
  const res = await fetch(`${getDodoApiBase()}/checkouts`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${getDodoApiKey()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: { email: opts.email },
      ...(opts.country ? { billing_address: { country: opts.country } } : {}),
      return_url: opts.returnUrl,
      // The hosted page's layout is fixed; the pay button is one place we can state the price.
      customization: { theme_config: { pay_button_text: buttonText } },
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
