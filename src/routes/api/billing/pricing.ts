import { createFileRoute } from "@tanstack/react-router";

import { pricingFor, regionForCountry } from "@/config/pricing";
import { countryFromRequest } from "@/server/geo";

/**
 * The price to show this visitor (₹ in India, $ elsewhere), from their IP
 * country. Public and cheap: it carries no account data, so no auth.
 */
export const Route = createFileRoute("/api/billing/pricing")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const pricing = pricingFor(regionForCountry(countryFromRequest(request)));
        return Response.json(pricing, { headers: { "cache-control": "private, max-age=300" } });
      },
    },
  },
});
