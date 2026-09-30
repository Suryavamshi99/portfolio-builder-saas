import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Records a purchase and flips the user's plan to Pro. Shared by the real
 * Dodo webhook (src/routes/api/webhooks/dodo.ts) and the dev-only dummy
 * payment page (src/routes/api/dev/payment-test.ts) so both paths grant
 * access identically — the dummy page exists to test this exact effect,
 * not a lookalike of it.
 *
 * Must be called with the service-role admin client: there is no
 * authenticated request making this call for RLS to scope against (the
 * webhook case), and even where there is (the dummy page), `purchases` has
 * no insert policy for regular users by design — only this trusted path
 * ever writes to it.
 *
 * Idempotent: `dodo_payment_id` is unique, so a replayed call for the same
 * payment id hits the conflict and does nothing further.
 */
export async function grantProAccess(
  admin: SupabaseClient,
  opts: { userId: string; paymentId: string; amountCents?: number | null | undefined; currency?: string | null | undefined },
): Promise<{ granted: boolean }> {
  const { error: insertError } = await admin.from("purchases").insert({
    user_id: opts.userId,
    dodo_payment_id: opts.paymentId,
    status: "succeeded",
    amount_cents: opts.amountCents ?? null,
    currency: opts.currency ?? null,
  });

  const isDuplicate = insertError?.code === "23505";
  if (insertError && !isDuplicate) {
    throw new Error(`Could not record purchase: ${insertError.message}`);
  }

  if (!isDuplicate) {
    await admin.from("users").upsert({ id: opts.userId, plan: "pro" }, { onConflict: "id" });
  }

  return { granted: !isDuplicate };
}
