import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import * as adminModule from "@/lib/supabase/admin";
import { Route as webhookRoute } from "../routes/api/webhooks/dodo";
import { countryFromRequest } from "./geo";
import { pricingFor, regionForCountry } from "@/config/pricing";
import {
  applySubscriptionEvent,
  claimWebhook,
  enforceHostingLapse,
  hasHostingAccess,
  revokeForPayment,
} from "./billing";

type Row = Record<string, unknown>;

/** Tiny in-memory stand-in for the slice of the Supabase query builder billing.ts uses. */
function fakeAdmin(seed: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {
    users: [],
    purchases: [],
    hosting_subscriptions: [],
    webhook_events: [],
    sites: [],
    custom_domains: [],
    ...seed,
  };
  const uniques: Record<string, string[]> = {
    purchases: ["dodo_payment_id"],
    webhook_events: ["webhook_id"],
    hosting_subscriptions: ["user_id", "dodo_subscription_id"],
  };

  function query(table: string) {
    const filters: Array<(r: Row) => boolean> = [];
    let op: "select" | "update" | "delete" = "select";
    let patch: Row = {};
    const matches = () => tables[table]!.filter((r) => filters.every((f) => f(r)));
    const result = (): { data: Row[]; error: null } => {
      const rows = matches();
      if (op === "update") rows.forEach((r) => Object.assign(r, patch));
      if (op === "delete") tables[table] = tables[table]!.filter((r) => !rows.includes(r));
      return { data: rows, error: null };
    };
    const api: any = {
      select: () => api,
      eq: (col: string, v: unknown) => (filters.push((r) => r[col] === v), api),
      lt: (col: string, v: string) => (filters.push((r) => typeof r[col] === "string" && (r[col] as string) < v), api),
      is: (col: string, v: unknown) => (filters.push((r) => (r[col] ?? null) === v), api),
      limit: () => api,
      update: (p: Row) => ((op = "update"), (patch = p), api),
      delete: () => ((op = "delete"), api),
      maybeSingle: async () => ({ data: result().data[0] ?? null, error: null }),
      then: (resolve: (v: unknown) => void) => resolve(result()),
      insert: async (row: Row) => {
        for (const col of uniques[table] ?? []) {
          if (tables[table]!.some((r) => r[col] === row[col])) return { error: { code: "23505", message: "dup" } };
        }
        tables[table]!.push({ ...row });
        return { error: null };
      },
      upsert: async (row: Row, opts?: { onConflict?: string }) => {
        const key = opts?.onConflict ?? "id";
        const existing = tables[table]!.find((r) => r[key] === row[key]);
        if (existing) Object.assign(existing, row);
        else tables[table]!.push({ ...row });
        return { error: null };
      },
    };
    return api;
  }

  return { client: { from: (t: string) => query(t) } as unknown as SupabaseClient, tables };
}

const DAY = 24 * 60 * 60 * 1000;
const inDays = (n: number) => new Date(Date.now() + n * DAY).toISOString();

beforeEach(() => {
  vi.restoreAllMocks();
  process.env["PAYMENTS_ENABLED"] = "true";
});

describe("applySubscriptionEvent", () => {
  it("activates hosting through the first year plus 14 days of cushion", async () => {
    const { client, tables } = fakeAdmin();
    await applySubscriptionEvent(client, "subscription.active", {
      subscription_id: "sub_1",
      next_billing_date: inDays(365),
      metadata: { userId: "u1" },
    });
    const row = tables["hosting_subscriptions"]![0]!;
    expect(row["status"]).toBe("active");
    const graceDays = (Date.parse(row["grace_until"] as string) - Date.now()) / DAY;
    expect(Math.round(graceDays)).toBe(365 + 14);
  });

  it("keeps access for the paid period after the user cancels, with no extra cushion", async () => {
    const { client, tables } = fakeAdmin();
    const end = inDays(200);
    await applySubscriptionEvent(client, "subscription.active", { subscription_id: "sub_1", next_billing_date: end, metadata: { userId: "u1" } });
    await applySubscriptionEvent(client, "subscription.cancelled", { subscription_id: "sub_1" });
    const row = tables["hosting_subscriptions"]![0]!;
    expect(row["status"]).toBe("cancelled");
    expect(Date.parse(row["grace_until"] as string)).toBe(Date.parse(end));
  });

  it("does not extend access when a renewal fails (on_hold)", async () => {
    const { client, tables } = fakeAdmin();
    const end = inDays(1);
    await applySubscriptionEvent(client, "subscription.active", { subscription_id: "sub_1", next_billing_date: end, metadata: { userId: "u1" } });
    const before = tables["hosting_subscriptions"]![0]!["grace_until"];
    await applySubscriptionEvent(client, "subscription.on_hold", { subscription_id: "sub_1" });
    expect(tables["hosting_subscriptions"]![0]!["status"]).toBe("on_hold");
    expect(tables["hosting_subscriptions"]![0]!["grace_until"]).toBe(before);
  });

  it("rejects an event for a subscription it cannot attribute to a user", async () => {
    const { client } = fakeAdmin();
    await expect(applySubscriptionEvent(client, "subscription.active", { subscription_id: "sub_x" })).rejects.toThrow();
  });
});

describe("hasHostingAccess", () => {
  it("is true only while grace_until is in the future", async () => {
    const live = fakeAdmin({ hosting_subscriptions: [{ user_id: "u1", grace_until: inDays(5) }] });
    const lapsed = fakeAdmin({ hosting_subscriptions: [{ user_id: "u1", grace_until: inDays(-1) }] });
    const none = fakeAdmin();
    expect(await hasHostingAccess(live.client, { id: "u1", isAdmin: false })).toBe(true);
    expect(await hasHostingAccess(lapsed.client, { id: "u1", isAdmin: false })).toBe(false);
    expect(await hasHostingAccess(none.client, { id: "u1", isAdmin: false })).toBe(false);
  });

  it("lets admins and a payments-off environment through", async () => {
    const none = fakeAdmin();
    expect(await hasHostingAccess(none.client, { id: "u1", isAdmin: true })).toBe(true);
    process.env["PAYMENTS_ENABLED"] = "false";
    expect(await hasHostingAccess(none.client, { id: "u1", isAdmin: false })).toBe(true);
  });
});

describe("claimWebhook", () => {
  it("accepts a webhook id once and rejects the replay", async () => {
    const { client } = fakeAdmin();
    expect(await claimWebhook(client, "wh_1", "payment.succeeded")).toBe(true);
    expect(await claimWebhook(client, "wh_1", "payment.succeeded")).toBe(false);
  });
});

describe("revokeForPayment", () => {
  it("drops a refunded Pro buyer to free, ends hosting and unpublishes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    process.env["DODO_PAYMENTS_API_KEY"] = "k";
    const { client, tables } = fakeAdmin({
      users: [{ id: "u1", plan: "pro" }],
      purchases: [{ dodo_payment_id: "pay_1", user_id: "u1", kind: "pro", refunded_at: null }],
      hosting_subscriptions: [{ user_id: "u1", dodo_subscription_id: "sub_1", status: "active", grace_until: inDays(300) }],
      sites: [{ user_id: "u1", slug: "jane", status: "published" }],
    });
    // site files live in storage, not a table: stub the storage call used by unpublish
    (client as any).storage = { from: () => ({ list: async () => ({ data: [], error: null }), remove: async () => ({ error: null }) }) };

    expect((await revokeForPayment(client, "pay_1")).revoked).toBe(true);
    expect(tables["users"]![0]!["plan"]).toBe("free");
    expect(tables["purchases"]![0]!["refunded_at"]).toBeTruthy();
    expect(Date.parse(tables["hosting_subscriptions"]![0]!["grace_until"] as string)).toBeLessThanOrEqual(Date.now());
    expect(tables["sites"]![0]!["status"]).toBe("unpublished");
    vi.unstubAllGlobals();
  });

  it("ignores payments that are not ours and repeats of an already-refunded one", async () => {
    const { client } = fakeAdmin({
      purchases: [{ dodo_payment_id: "pay_1", user_id: "u1", kind: "pro", refunded_at: new Date().toISOString() }],
    });
    expect((await revokeForPayment(client, "pay_unknown")).revoked).toBe(false);
    expect((await revokeForPayment(client, "pay_1")).revoked).toBe(false);
  });
});

describe("enforceHostingLapse", () => {
  it("unpublishes only users whose hosting lapsed", async () => {
    const { client, tables } = fakeAdmin({
      hosting_subscriptions: [
        { user_id: "gone", grace_until: inDays(-2) },
        { user_id: "paid", grace_until: inDays(30) },
      ],
      sites: [
        { user_id: "gone", slug: "gone", status: "published" },
        { user_id: "paid", slug: "paid", status: "published" },
        { user_id: "legacy", slug: "legacy", status: "published" },
      ],
    });
    (client as any).storage = { from: () => ({ list: async () => ({ data: [], error: null }), remove: async () => ({ error: null }) }) };
    const out = await enforceHostingLapse(client);
    expect(out.unpublished).toBe(1);
    const status = (u: string) => tables["sites"]!.find((s) => s["user_id"] === u)!["status"];
    expect(status("gone")).toBe("unpublished");
    expect(status("paid")).toBe("published");
    expect(status("legacy")).toBe("published");
  });
});

describe("geo pricing", () => {
  it("prices India in INR and everyone else in USD", () => {
    const req = (c?: string) => new Request("http://x", { headers: c ? { "x-vercel-ip-country": c } : {} });
    expect(regionForCountry(countryFromRequest(req("IN")))).toBe("IN");
    expect(regionForCountry(countryFromRequest(req("in")))).toBe("IN");
    expect(regionForCountry(countryFromRequest(req("US")))).toBe("ROW");
    expect(regionForCountry(countryFromRequest(req()))).toBe("ROW");
    expect(countryFromRequest(req("<script>"))).toBeUndefined();
    expect(pricingFor("IN").today).toBe("₹499");
    expect(pricingFor("ROW").today).toBe("$9");
    expect(pricingFor("ROW").fineprint).toContain("$7.99/year");
  });
});

describe("POST /api/webhooks/dodo", () => {
  const secret = "whsec_" + Buffer.from("test-secret").toString("base64");

  function signed(body: object, id = "wh_1") {
    const raw = JSON.stringify(body);
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = createHmac("sha256", Buffer.from("test-secret")).update(`${id}.${ts}.${raw}`).digest("base64");
    return new Request("http://localhost/api/webhooks/dodo", {
      method: "POST",
      headers: { "webhook-id": id, "webhook-timestamp": ts, "webhook-signature": `v1,${sig}` },
      body: raw,
    });
  }
  const post = (req: Request) =>
    (webhookRoute.options.server?.handlers as { POST: (a: any) => Promise<Response> }).POST({ request: req });

  beforeEach(() => {
    process.env["DODO_WEBHOOK_SECRET"] = secret;
  });

  it("rejects a bad signature", async () => {
    const req = signed({ type: "payment.succeeded", data: {} });
    const bad = new Request(req.url, { method: "POST", headers: { ...Object.fromEntries(req.headers), "webhook-signature": "v1,AAAA" }, body: await req.text() });
    expect((await post(bad)).status).toBe(401);
  });

  it("unlocks Pro on the first payment and records later payments as hosting renewals", async () => {
    const { client, tables } = fakeAdmin({ users: [{ id: "u1", plan: "free" }] });
    vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(client as never);

    const first = await post(signed({ type: "payment.succeeded", data: { payment_id: "pay_1", metadata: { userId: "u1" }, total_amount: 900, currency: "USD" } }, "wh_a"));
    expect(first.status).toBe(200);
    expect(tables["users"]![0]!["plan"]).toBe("pro");
    expect(tables["purchases"]![0]!["kind"]).toBe("pro");

    await post(signed({ type: "payment.succeeded", data: { payment_id: "pay_2", metadata: { userId: "u1" } } }, "wh_b"));
    expect(tables["purchases"]!.map((p) => p["kind"])).toEqual(["pro", "hosting_renewal"]);
  });

  it("processes a redelivered webhook only once", async () => {
    const { client, tables } = fakeAdmin({ users: [{ id: "u1", plan: "free" }] });
    vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(client as never);
    const body = { type: "payment.succeeded", data: { payment_id: "pay_1", metadata: { userId: "u1" } } };
    await post(signed(body, "wh_same"));
    const again = await post(signed(body, "wh_same"));
    expect((await again.json()) as { duplicate?: boolean }).toMatchObject({ duplicate: true });
    expect(tables["purchases"]).toHaveLength(1);
  });

  it("acknowledges and ignores events it does not handle", async () => {
    const { client } = fakeAdmin();
    vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(client as never);
    const res = await post(signed({ type: "payment.failed", data: {} }));
    expect(res.status).toBe(200);
  });
});
