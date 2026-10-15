import * as React from "react";

import { pricingFor, type Pricing } from "@/config/pricing";

// Shown until the server answers (and if it never does): the USD price, which is
// also what everyone outside India pays.
const FALLBACK: Pricing = pricingFor("ROW");

let cached: Pricing | null = null;
let inflight: Promise<Pricing> | null = null;

function load(): Promise<Pricing> {
  if (cached) return Promise.resolve(cached);
  inflight ??= fetch("/api/billing/pricing")
    .then((res) => (res.ok ? (res.json() as Promise<Pricing>) : FALLBACK))
    .catch(() => FALLBACK)
    .then((p) => {
      cached = p;
      return p;
    });
  return inflight;
}

/** The price to show this visitor (₹ in India, $ elsewhere), decided on the server from their IP country. */
export function usePricing(): Pricing {
  const [pricing, setPricing] = React.useState<Pricing>(cached ?? FALLBACK);
  React.useEffect(() => {
    let live = true;
    void load().then((p) => {
      if (live) setPricing(p);
    });
    return () => {
      live = false;
    };
  }, []);
  return pricing;
}
