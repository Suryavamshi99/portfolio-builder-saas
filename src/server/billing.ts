import type { SupabaseClient } from "@supabase/supabase-js";

import { getDodoApiBase, getDodoApiKey } from "@/config/dodo";
import { paymentsEnabled } from "@/config/payments";
import { removeSiteFiles } from "@/server/sites-storage";
import { removeDomain } from "@/server/vercel/domains";

/**
 * Billing state machine for the "Pro + 1 year hosting" product: a Dodo
 * subscription with a 365-day paid trial. The first payment ($9 / ₹499)
 * unlocks Pro for good; hosting (publishing and custom domains) lasts while
 * now() < hosting_subscriptions.grace_until. Everything here takes the
 * service-role client: the callers are the Dodo webhook and the cron job,
 * neither of which has a user session.
 */

export const HOSTING_GRACE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export type SubscriptionEventType =
  | "subscription.active"
  | "subscription.renewed"
  | "subscription.on_hold"
  | "subscription.failed"
  | "subscription.cancelled"
  | "subscription.expired";

export const SUBSCRIPTION_EVENT_TYPES: readonly string[] = [
  "subscription.active",
  "subscription.renewed",
  "subscription.on_hold",
  "subscription.failed",
  "subscription.cancelled",
  "subscription.expired",
];

export const REVOKING_EVENT_TYPES: readonly string[] = ["refund.succeeded", "dispute.lost", "dispute.accepted"];

/**
 * True unless the event is clearly about some other product in the Dodo
 * account. Payment events carry product_cart[].product_id, subscription events
 * carry product_id. When neither is present (or no product ids are configured,
 * as in tests) there is nothing to compare, so the event is let through.
 */
export function isOurProduct(data: { product_id?: string; product_cart?: Array<{ product_id?: string }> }): boolean {
  const ours = [
    process.env["DODO_PRODUCT_ID_PRO"],
    process.env["DODO_PRODUCT_ID_PRO_IN"],
    process.env["DODO_PRODUCT_ID_HOSTING"],
    process.env["DODO_PRODUCT_ID_HOSTING_IN"],
  ].filter(
    (id): id is string => Boolean(id),
  );
  if (ours.length === 0) return true;
  const seen = [data.product_id, ...(data.product_cart ?? []).map((item) => item.product_id)].filter(
    (id): id is string => Boolean(id),
  );
  if (seen.length === 0) return true;
  return seen.some((id) => ours.includes(id));
}

/** True if this user may publish a site / use a custom domain right now. */
export async function hasHostingAccess(
  admin: SupabaseClient,
  appUser: { id: string; isAdmin: boolean },
): Promise<boolean> {
  if (!paymentsEnabled()) return true;
  if (appUser.isAdmin) return true;
  const { data } = await admin
    .from("hosting_subscriptions")
    .select("grace_until")
    .eq("user_id", appUser.id)
    .maybeSingle();
  return data?.grace_until != null && Date.parse(data.grace_until) > Date.now();
}

/**
 * Records `webhook-id` and returns true the first time it is seen. A
 * duplicate delivery returns false and the handler skips it. If the handler
 * later fails, call forgetWebhook so Dodo's retry is processed again.
 */
export async function claimWebhook(admin: SupabaseClient, webhookId: string, eventType: string | undefined): Promise<boolean> {
  const { error } = await admin.from("webhook_events").insert({ webhook_id: webhookId, event_type: eventType ?? null });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(`Could not record webhook: ${error.message}`);
}

export async function forgetWebhook(admin: SupabaseClient, webhookId: string): Promise<void> {
  await admin.from("webhook_events").delete().eq("webhook_id", webhookId);
}

interface SubscriptionEventData {
  subscription_id?: string;
  next_billing_date?: string;
  metadata?: { userId?: string };
}

/** Maps one Dodo subscription lifecycle event onto hosting_subscriptions. */
export async function applySubscriptionEvent(
  admin: SupabaseClient,
  type: SubscriptionEventType,
  data: SubscriptionEventData,
): Promise<void> {
  const subscriptionId = data.subscription_id;
  if (!subscriptionId) throw new Error("subscription event without subscription_id");

  const { data: existing } = await admin
    .from("hosting_subscriptions")
    .select("user_id, current_period_end")
    .eq("dodo_subscription_id", subscriptionId)
    .maybeSingle();

  const userId = existing?.user_id ?? data.metadata?.userId;
  if (!userId) throw new Error("subscription event for an unknown user");

  // A user renewing after a lapse starts a new subscription. Stop the older one, so a subscription
  // that was only on hold cannot charge them again on top of the renewal.
  if (type === "subscription.active") {
    const { data: older } = await admin
      .from("hosting_subscriptions")
      .select("dodo_subscription_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (older && older.dodo_subscription_id !== subscriptionId) {
      await cancelDodoSubscription(older.dodo_subscription_id as string);
    }
  }

  const now = Date.now();
  const nextBilling = data.next_billing_date ? Date.parse(data.next_billing_date) : NaN;
  const hasNextBilling = Number.isFinite(nextBilling);
  const previousEnd = existing?.current_period_end ? Date.parse(existing.current_period_end) : null;

  let status: "active" | "on_hold" | "cancelled" | "expired" | "failed";
  let periodEnd: number | null = hasNextBilling ? nextBilling : previousEnd;
  let graceUntil: number | null;

  switch (type) {
    case "subscription.active":
    case "subscription.renewed":
      status = "active";
      // paid through the period end, plus a cushion: Indian UPI/card renewals settle ~48h late
      graceUntil = periodEnd != null ? periodEnd + HOSTING_GRACE_DAYS * DAY_MS : null;
      break;
    case "subscription.on_hold":
      // renewal failed: keep what was already granted (period end + grace), do not extend it
      status = "on_hold";
      graceUntil = periodEnd != null ? periodEnd + HOSTING_GRACE_DAYS * DAY_MS : now;
      break;
    case "subscription.cancelled":
    case "subscription.expired":
      // the user cancelled: hosting runs to the end of what they paid for, with no cushion
      status = type === "subscription.cancelled" ? "cancelled" : "expired";
      periodEnd = previousEnd ?? periodEnd;
      graceUntil = periodEnd != null ? Math.max(periodEnd, now) : now;
      if (type === "subscription.expired") graceUntil = now;
      break;
    case "subscription.failed":
      status = "failed";
      graceUntil = now;
      break;
  }

  const { error } = await admin.from("hosting_subscriptions").upsert(
    {
      user_id: userId,
      dodo_subscription_id: subscriptionId,
      status,
      current_period_end: periodEnd != null ? new Date(periodEnd).toISOString() : null,
      grace_until: graceUntil != null ? new Date(graceUntil).toISOString() : null,
      updated_at: new Date(now).toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`Could not save hosting subscription: ${error.message}`);
}

/**
 * A one-time payment (India: no Dodo subscription, so no UPI mandate) buys one
 * year of hosting. The term is tracked here: it starts now, or at the end of
 * the current term for an early renewal, and gets the usual grace cushion.
 * The payment id stands in for the subscription id in hosting_subscriptions.
 */
export async function applyOneTimeHosting(admin: SupabaseClient, userId: string, paymentId: string): Promise<void> {
  const now = Date.now();
  const { data: existing } = await admin
    .from("hosting_subscriptions")
    .select("current_period_end, dodo_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();
  // Already applied for this very payment (a webhook retry): do not add a second year.
  if (existing?.dodo_subscription_id === paymentId) return;
  const previousEnd = existing?.current_period_end ? Date.parse(existing.current_period_end as string) : NaN;
  const start = Number.isFinite(previousEnd) && previousEnd > now ? previousEnd : now;
  const periodEnd = start + 365 * DAY_MS;

  const { error } = await admin.from("hosting_subscriptions").upsert(
    {
      user_id: userId,
      dodo_subscription_id: paymentId,
      status: "active",
      current_period_end: new Date(periodEnd).toISOString(),
      grace_until: new Date(periodEnd + HOSTING_GRACE_DAYS * DAY_MS).toISOString(),
      updated_at: new Date(now).toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`Could not save hosting term: ${error.message}`);
}

/** Unpublishes the user's site and detaches their custom domain. Both are best-effort. */
export async function unpublishUserSite(admin: SupabaseClient, userId: string): Promise<void> {
  const { data: site } = await admin.from("sites").select("slug, status").eq("user_id", userId).maybeSingle();
  if (site && site.status !== "unpublished") {
    await admin
      .from("sites")
      .update({ status: "unpublished", updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    try {
      await removeSiteFiles(admin, site.slug);
    } catch (e) {
      console.warn("Could not remove site files for", site.slug, e instanceof Error ? e.message : "");
    }
  }

  const { data: domain } = await admin.from("custom_domains").select("id, hostname").eq("user_id", userId).maybeSingle();
  if (domain) {
    await admin.from("custom_domains").delete().eq("id", domain.id);
    try {
      await removeDomain(domain.hostname);
    } catch (e) {
      console.warn("Could not remove domain", domain.hostname, e instanceof Error ? e.message : "");
    }
  }
}

/** Stops future renewal charges. Best-effort: a failure must not undo the downgrade. */
async function cancelDodoSubscription(subscriptionId: string): Promise<void> {
  // One-time (India) purchases store their payment id here: there is no subscription to stop.
  if (!subscriptionId.startsWith("sub_")) return;
  try {
    const res = await fetch(`${getDodoApiBase()}/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${getDodoApiKey()}`, "content-type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    if (!res.ok) console.warn("Dodo subscription cancel failed", res.status);
  } catch (e) {
    console.warn("Dodo subscription cancel failed", e instanceof Error ? e.message : "");
  }
}

/**
 * A refund or a lost/accepted dispute on a payment: mark it, and take back
 * what it bought. A Pro payment drops the user to free, ends hosting and
 * unpublishes; a hosting-renewal payment only ends hosting. Unknown payment
 * ids are acknowledged and ignored (they are not ours).
 */
export async function revokeForPayment(admin: SupabaseClient, paymentId: string): Promise<{ revoked: boolean }> {
  const { data: purchase } = await admin
    .from("purchases")
    .select("user_id, kind, refunded_at")
    .eq("dodo_payment_id", paymentId)
    .maybeSingle();
  if (!purchase) return { revoked: false };
  if (purchase.refunded_at) return { revoked: false };

  const userId = purchase.user_id as string;
  const nowIso = new Date().toISOString();

  await admin.from("purchases").update({ refunded_at: nowIso, status: "refunded" }).eq("dodo_payment_id", paymentId);

  if (purchase.kind === "pro") {
    await admin.from("users").update({ plan: "free" }).eq("id", userId);
  }

  const { data: hosting } = await admin
    .from("hosting_subscriptions")
    .select("dodo_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (hosting) {
    await admin
      .from("hosting_subscriptions")
      // current_period_end too: cancelling the Dodo subscription below sends a
      // subscription.cancelled event, which must not read the old paid-through date back.
      .update({ status: "cancelled", current_period_end: nowIso, grace_until: nowIso, updated_at: nowIso })
      .eq("user_id", userId);
    await cancelDodoSubscription(hosting.dodo_subscription_id as string);
  }

  await unpublishUserSite(admin, userId);
  return { revoked: true };
}

/**
 * Daily job: unpublish sites of users whose hosting lapsed (grace_until in
 * the past), and drop webhook ids older than 30 days. Users with no
 * hosting_subscriptions row (admins, anyone predating this billing model)
 * are never touched.
 */
export async function enforceHostingLapse(admin: SupabaseClient): Promise<{ unpublished: number; webhooksPruned: number }> {
  const nowIso = new Date().toISOString();
  const { data: lapsed } = await admin
    .from("hosting_subscriptions")
    .select("user_id")
    .lt("grace_until", nowIso);

  let unpublished = 0;
  for (const row of lapsed ?? []) {
    const userId = row.user_id as string;
    const { data: site } = await admin.from("sites").select("status").eq("user_id", userId).maybeSingle();
    const { data: domain } = await admin.from("custom_domains").select("id").eq("user_id", userId).maybeSingle();
    if ((site && site.status !== "unpublished") || domain) {
      await unpublishUserSite(admin, userId);
      unpublished += 1;
    }
  }

  const cutoff = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const { data: pruned } = await admin.from("webhook_events").delete().lt("received_at", cutoff).select("webhook_id");

  return { unpublished, webhooksPruned: pruned?.length ?? 0 };
}
