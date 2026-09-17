import { getDodoApiBase, getDodoApiKey, getDodoProProductId } from "@/config/dodo";

export class DodoCheckoutError extends Error {}

export async function createProCheckoutSession(opts: {
  userId: string;
  email: string;
  returnUrl: string;
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
