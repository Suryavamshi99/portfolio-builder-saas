import { beforeEach, describe, expect, it, vi } from "vitest";
import * as adminModule from "@/lib/supabase/admin";
import * as usersModule from "@/server/users";
import * as vercelDomainsModule from "@/server/vercel/domains";
import { Route as domainsRoute } from "../routes/api/domains/index";
import { Route as verifyRoute, setTxtResolver } from "../routes/api/domains/verify";

type Handler = (args: any) => Promise<Response>;

beforeEach(() => {
  vi.restoreAllMocks();
  process.env["SITES_DOMAIN"] = "shipfolio.xyz";
});

const payingUser = () =>
  vi.spyOn(usersModule, "getOrCreateAppUser").mockResolvedValue({ id: "me", plan: "pro", createdAt: "", isAdmin: false });

describe("claiming a hostname", () => {
  function setup(existingStatus: "pending" | "verified") {
    const deleted: unknown[][] = [];
    const inserted: Record<string, unknown>[] = [];
    const admin = {
      from: (table: string) =>
        table === "sites"
          ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { status: "published" }, error: null }) }) }) }
          : {
              select: () => ({
                eq: (col: string) => ({
                  maybeSingle: async () => ({ data: col === "user_id" ? null : { user_id: "someone-else", status: existingStatus }, error: null }),
                }),
              }),
              delete: () => ({ eq: (c1: string, v1: string) => ({ eq: async (c2: string, v2: string) => (deleted.push([c1, v1, c2, v2]), { error: null }) }) }),
              insert: (row: Record<string, unknown>) => {
                inserted.push(row);
                return { select: () => ({ single: async () => ({ data: { hostname: row["hostname"], status: "pending", verify_token: row["verify_token"], last_checked_at: null }, error: null }) }) };
              },
            },
    };
    vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(admin as never);
    return { deleted, inserted };
  }
  const post = () =>
    (domainsRoute.options.server?.handlers as { POST: Handler }).POST({
      request: new Request("http://localhost/api/domains", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ hostname: "janedoe.com" }) }),
      context: { user: { id: "me" }, supabase: {} },
    });

  it("lets the real owner replace someone else's UNPROVEN (pending) claim on the same hostname", async () => {
    payingUser();
    const { deleted, inserted } = setup("pending");
    const res = await post();
    expect(res.status).toBe(200);
    expect(deleted).toEqual([["hostname", "janedoe.com", "status", "pending"]]);
    expect(inserted).toHaveLength(1);
  });

  it("never takes a hostname whose owner has proven control", async () => {
    payingUser();
    const { deleted, inserted } = setup("verified");
    const res = await post();
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("domain_taken");
    expect(deleted).toEqual([]);
    expect(inserted).toEqual([]);
  });
});

describe("verifying when Vercel refuses the domain", () => {
  it("answers 409 with the reason instead of crashing", async () => {
    const admin = {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: { id: "1", hostname: "janedoe.com", status: "pending", verify_token: "shipfolio-verify=abc", last_checked_at: null }, error: null }) }),
        }),
      }),
    };
    vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(admin as never);
    setTxtResolver((async () => [["shipfolio-verify=abc"]]) as never);
    vi.spyOn(vercelDomainsModule, "addDomain").mockRejectedValue(new vercelDomainsModule.VercelDomainError(409, "This domain is already used by another Vercel project"));

    const res = await (verifyRoute.options.server?.handlers as { POST: Handler }).POST({ context: { user: { id: "me" } } });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toEqual({ code: "domain_unavailable", message: "This domain is already used by another Vercel project" });
  });
});
