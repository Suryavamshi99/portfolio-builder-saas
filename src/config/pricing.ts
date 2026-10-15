/**
 * What the buyer sees. Display only: Dodo's product is the source of truth for
 * what is actually charged. Keep these in step with the Dodo product
 * (USD $9 today then $7.99/yr; India fixed INR price, so UPI works).
 *
 * The region is decided on the server from the request's IP country
 * (Vercel's x-vercel-ip-country header) and passed to Dodo as the billing
 * country, so the page and the charge agree. Everyone outside India is
 * priced in USD; Dodo's Adaptive Currency may show them a local-currency
 * equivalent at checkout.
 */
export type PricingRegion = "IN" | "ROW";

export interface Pricing {
  region: PricingRegion;
  /** First payment: Pro unlock plus the first year of hosting. */
  today: string;
  /** Yearly hosting renewal, from year 2. */
  renewal: string;
  /** Short line that sits under every buy button. */
  fineprint: string;
}

const PRICES: Record<PricingRegion, { today: string; renewal: string; paymentHint: string }> = {
  IN: { today: "₹499", renewal: "₹449", paymentHint: "Pay with UPI or card." },
  ROW: { today: "$9", renewal: "$7.99", paymentHint: "Pay by card or wallet." },
};

export function regionForCountry(country: string | null | undefined): PricingRegion {
  return country?.toUpperCase() === "IN" ? "IN" : "ROW";
}

export function pricingFor(region: PricingRegion): Pricing {
  const p = PRICES[region];
  return {
    region,
    today: p.today,
    renewal: p.renewal,
    fineprint: `Includes 1 year of hosting and your own domain. Then ${p.renewal}/year, cancel anytime. ${p.paymentHint}`,
  };
}

/** Selling points shown wherever the upgrade is offered. Order = strongest first. */
export const SELLING_POINTS: readonly string[] = [
  "Live in 30 seconds. No servers, no setup, no Git",
  "Your own domain with free HTTPS, 1 year of hosting included",
  "Download clean HTML + zip. It's yours to keep, no lock-in",
  "Push to GitHub or deploy to your own Vercel in one click",
  "No \"Made with Shipfolio\" watermark",
  "Refine with AI and republish in seconds, 4x the free generation limit",
];
