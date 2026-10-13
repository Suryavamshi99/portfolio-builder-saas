import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import * as adminModule from "@/lib/supabase/admin";
import * as usersModule from "@/server/users";
import * as vercelDomainsModule from "@/server/vercel/domains";
import { Route as domainsRoute } from "../routes/api/domains/index";
import { Route as verifyRoute, setTxtResolver } from "../routes/api/domains/verify";
import { Route as cronDomainsRoute } from "../routes/api/cron/domains";
import sitesAppHandler, { setSitesSupabaseClientGetter } from "../../sites-app/api/serve";

type RouteHandler = (args: any) => Promise<Response>;

describe("Custom domains routes and serve logic", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = {
      ...originalEnv,
      SITES_DOMAIN: "shipfolio.xyz",
      CRON_SECRET: "cron-secret-123",
      VERCEL_API_TOKEN: "tok_123",
      SITES_PROJECT_ID: "prj_123",
    };
  });

  describe("POST /api/domains", () => {
    it("returns 402 for free users", async () => {
      const user = { id: "user-free" };
      vi.spyOn(usersModule, "getOrCreateAppUser").mockResolvedValueOnce({
        id: user.id,
        plan: "free",
        createdAt: new Date().toISOString(),
        isAdmin: false,
      });

      const handler = (domainsRoute.options.server?.handlers as { POST: RouteHandler }).POST;
      const res = await handler({
        request: new Request("http://localhost/api/domains", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hostname: "jane.com" }),
        }),
        context: { user, supabase: {} },
      });

      expect(res.status).toBe(402);
      const json = await res.json();
      expect(json.error.code).toBe("payment_required");
    });

    it("returns 400 domain_invalid for invalid hostnames", async () => {
      const user = { id: "user-pro" };
      vi.spyOn(usersModule, "getOrCreateAppUser").mockResolvedValueOnce({
        id: user.id,
        plan: "pro",
        createdAt: new Date().toISOString(),
        isAdmin: false,
      });

      const handler = (domainsRoute.options.server?.handlers as { POST: RouteHandler }).POST;
      const res = await handler({
        request: new Request("http://localhost/api/domains", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hostname: "http://invalid-format" }),
        }),
        context: { user, supabase: {} },
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("domain_invalid");
    });

    it("returns 400 no_site if user does not have a published site", async () => {
      const user = { id: "user-pro" };
      vi.spyOn(usersModule, "getOrCreateAppUser").mockResolvedValueOnce({
        id: user.id,
        plan: "pro",
        createdAt: new Date().toISOString(),
        isAdmin: false,
      });

      const fakeAdmin = {
        from: (table: string) => {
          if (table === "sites") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            };
          }
          return {};
        },
      };
      vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(fakeAdmin as never);

      const handler = (domainsRoute.options.server?.handlers as { POST: RouteHandler }).POST;
      const res = await handler({
        request: new Request("http://localhost/api/domains", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hostname: "janedoe.com" }),
        }),
        context: { user, supabase: {} },
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("no_site");
    });

    it("returns 409 domain_taken if another user already owns the hostname", async () => {
      const user = { id: "user-pro" };
      vi.spyOn(usersModule, "getOrCreateAppUser").mockResolvedValueOnce({
        id: user.id,
        plan: "pro",
        createdAt: new Date().toISOString(),
        isAdmin: false,
      });

      const fakeAdmin = {
        from: (table: string) => {
          if (table === "sites") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { status: "published" }, error: null }),
                }),
              }),
            };
          }
          if (table === "custom_domains") {
            return {
              select: (_cols?: string) => ({
                eq: (col: string, _val: string) => {
                  if (col === "user_id") {
                    return { maybeSingle: async () => ({ data: null, error: null }) };
                  }
                  if (col === "hostname") {
                    return { maybeSingle: async () => ({ data: { user_id: "other-user" }, error: null }) };
                  }
                  return { maybeSingle: async () => ({ data: null, error: null }) };
                },
              }),
            };
          }
          return {};
        },
      };
      vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(fakeAdmin as never);

      const handler = (domainsRoute.options.server?.handlers as { POST: RouteHandler }).POST;
      const res = await handler({
        request: new Request("http://localhost/api/domains", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hostname: "taken-domain.com" }),
        }),
        context: { user, supabase: {} },
      });

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error.code).toBe("domain_taken");
    });

    it("creates pending domain, does NOT call Vercel, returns expected GET shape", async () => {
      const user = { id: "user-pro" };
      vi.spyOn(usersModule, "getOrCreateAppUser").mockResolvedValueOnce({
        id: user.id,
        plan: "pro",
        createdAt: new Date().toISOString(),
        isAdmin: false,
      });

      const addDomainSpy = vi.spyOn(vercelDomainsModule, "addDomain");

      let insertedRow: any = null;
      const fakeAdmin = {
        from: (table: string) => {
          if (table === "sites") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { status: "published" }, error: null }),
                }),
              }),
            };
          }
          if (table === "custom_domains") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
              insert: (row: any) => {
                insertedRow = row;
                return {
                  select: () => ({
                    single: async () => ({
                      data: {
                        hostname: row.hostname,
                        status: row.status,
                        verify_token: row.verify_token,
                        last_checked_at: null,
                      },
                      error: null,
                    }),
                  }),
                };
              },
            };
          }
          return {};
        },
      };
      vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(fakeAdmin as never);

      const handler = (domainsRoute.options.server?.handlers as { POST: RouteHandler }).POST;
      const res = await handler({
        request: new Request("http://localhost/api/domains", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hostname: "new-custom.com" }),
        }),
        context: { user, supabase: {} },
      });

      expect(res.status).toBe(200);
      expect(addDomainSpy).not.toHaveBeenCalled(); // DOES NOT call Vercel
      expect(insertedRow.status).toBe("pending");
      expect(insertedRow.verify_token).toMatch(/^shipfolio-verify=/);

      const json = await res.json();
      expect(json).toEqual({
        domain: {
          hostname: "new-custom.com",
          status: "pending",
          verifyRecord: {
            type: "TXT",
            name: "_shipfolio-verify.new-custom.com",
            value: insertedRow.verify_token,
          },
          dns: null,
          lastCheckedAt: null,
        },
      });
    });
  });

  describe("POST /api/domains/verify", () => {
    it("returns 404 no_domain if user has no configured domain", async () => {
      const user = { id: "user-123" };
      const fakeAdmin = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      };
      vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(fakeAdmin as never);

      const handler = (verifyRoute.options.server?.handlers as { POST: RouteHandler }).POST;
      const res = await handler({ context: { user } });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe("no_domain");
    });

    it("returns 429 if checked within last 10 seconds", async () => {
      const user = { id: "user-123" };
      const fakeAdmin = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "dom-1",
                  hostname: "jane.com",
                  status: "pending",
                  verify_token: "shipfolio-verify=123",
                  last_checked_at: new Date(Date.now() - 3000).toISOString(),
                },
                error: null,
              }),
            }),
          }),
        }),
      };
      vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(fakeAdmin as never);

      const handler = (verifyRoute.options.server?.handlers as { POST: RouteHandler }).POST;
      const res = await handler({ context: { user } });

      expect(res.status).toBe(429);
      const json = await res.json();
      expect(json.error.code).toBe("rate_limited");
    });

    it("stays pending and does NOT call Vercel if TXT does not match", async () => {
      const user = { id: "user-123" };
      let updatedLastChecked = false;
      const fakeAdmin = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "dom-1",
                  hostname: "jane.com",
                  status: "pending",
                  verify_token: "shipfolio-verify=expected",
                  last_checked_at: new Date(Date.now() - 20000).toISOString(),
                },
                error: null,
              }),
            }),
          }),
          update: () => {
            updatedLastChecked = true;
            return {
              eq: async () => ({ error: null }),
            };
          },
        }),
      };
      vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(fakeAdmin as never);

      setTxtResolver(async () => [["wrong-token"]]);
      const addDomainSpy = vi.spyOn(vercelDomainsModule, "addDomain");

      const handler = (verifyRoute.options.server?.handlers as { POST: RouteHandler }).POST;
      const res = await handler({ context: { user } });

      expect(res.status).toBe(200);
      expect(addDomainSpy).not.toHaveBeenCalled();
      expect(updatedLastChecked).toBe(true);
      const json = await res.json();
      expect(json.status).toBe("pending");
      expect(json.message).toContain("We can't see the TXT record yet");
    });

    it("calls addDomain once and moves to verified / live when TXT matches", async () => {
      const user = { id: "user-123" };
      const token = "shipfolio-verify=validtoken";
      let updatedStatus: string | null = null;

      const fakeAdmin = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "dom-1",
                  hostname: "jane.com",
                  status: "pending",
                  verify_token: token,
                  last_checked_at: new Date(Date.now() - 20000).toISOString(),
                },
                error: null,
              }),
            }),
          }),
          update: (fields: any) => {
            updatedStatus = fields.status;
            return {
              eq: async () => ({ error: null }),
            };
          },
        }),
      };
      vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(fakeAdmin as never);

      setTxtResolver(async () => [[token]]);
      const addDomainSpy = vi.spyOn(vercelDomainsModule, "addDomain").mockResolvedValueOnce();
      vi.spyOn(vercelDomainsModule, "getDomainConfig").mockResolvedValueOnce({
        misconfigured: false,
        recommendedIPv4: ["76.76.21.21"],
        recommendedCNAME: ["cname.vercel-dns.com"],
      });

      const handler = (verifyRoute.options.server?.handlers as { POST: RouteHandler }).POST;
      const res = await handler({ context: { user } });

      expect(res.status).toBe(200);
      expect(addDomainSpy).toHaveBeenCalledTimes(1);
      expect(addDomainSpy).toHaveBeenCalledWith("jane.com");
      expect(updatedStatus).toBe("live");

      const json = await res.json();
      expect(json.domain.status).toBe("live");
      expect(json.domain.dns).toEqual({
        a: ["76.76.21.21"],
        cname: ["cname.vercel-dns.com"],
      });
    });
  });

  describe("GET /api/domains", () => {
    it("returns null domain when none configured", async () => {
      const user = { id: "user-123" };
      const fakeAdmin = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      };
      vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(fakeAdmin as never);

      const handler = (domainsRoute.options.server?.handlers as { GET: RouteHandler }).GET;
      const res = await handler({ context: { user } });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ domain: null });
    });

    it("promotes verified to live when getDomainConfig returns misconfigured: false", async () => {
      const user = { id: "user-123" };
      let updatedStatus: string | null = null;
      const fakeAdmin = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "dom-1",
                  hostname: "jane.com",
                  status: "verified",
                  verify_token: "token-abc",
                  last_checked_at: null,
                },
                error: null,
              }),
            }),
          }),
          update: (fields: any) => {
            updatedStatus = fields.status;
            return {
              eq: async () => ({ error: null }),
            };
          },
        }),
      };
      vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(fakeAdmin as never);

      vi.spyOn(vercelDomainsModule, "getDomainConfig").mockResolvedValueOnce({
        misconfigured: false,
        recommendedIPv4: ["76.76.21.21"],
        recommendedCNAME: ["cname.vercel-dns.com"],
      });

      const handler = (domainsRoute.options.server?.handlers as { GET: RouteHandler }).GET;
      const res = await handler({ context: { user } });

      expect(res.status).toBe(200);
      expect(updatedStatus).toBe("live");
      const json = await res.json();
      expect(json.domain.status).toBe("live");
      expect(json.domain.dns).toEqual({
        a: ["76.76.21.21"],
        cname: ["cname.vercel-dns.com"],
      });
    });
  });

  describe("DELETE /api/domains", () => {
    it("calls removeDomain then deletes row", async () => {
      const user = { id: "user-123" };
      let deleted = false;
      const fakeAdmin = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: "dom-1", hostname: "jane.com" },
                error: null,
              }),
            }),
          }),
          delete: () => ({
            eq: async () => {
              deleted = true;
              return { error: null };
            },
          }),
        }),
      };
      vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(fakeAdmin as never);
      const removeSpy = vi.spyOn(vercelDomainsModule, "removeDomain").mockResolvedValueOnce();

      const handler = (domainsRoute.options.server?.handlers as { DELETE: RouteHandler }).DELETE;
      const res = await handler({ context: { user } });

      expect(res.status).toBe(200);
      expect(removeSpy).toHaveBeenCalledWith("jane.com");
      expect(deleted).toBe(true);
      const json = await res.json();
      expect(json).toEqual({ ok: true });
    });
  });

  describe("GET /api/cron/domains", () => {
    it("rejects unauthorized calls", async () => {
      const handler = (cronDomainsRoute.options.server?.handlers as { GET: RouteHandler }).GET;
      const res = await handler({
        request: new Request("http://localhost/api/cron/domains"),
      });
      expect(res.status).toBe(401);
    });

    it("deletes pending rows older than 14 days when bearer token matches", async () => {
      let queryStatus = "";
      const fakeAdmin = {
        from: () => ({
          delete: () => ({
            eq: (col: string, val: string) => {
              queryStatus = val;
              return {
                lt: () => ({
                  select: async () => ({ data: [{ id: "1" }, { id: "2" }], error: null }),
                }),
              };
            },
          }),
        }),
      };
      vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(fakeAdmin as never);

      const handler = (cronDomainsRoute.options.server?.handlers as { GET: RouteHandler }).GET;
      const res = await handler({
        request: new Request("http://localhost/api/cron/domains", {
          headers: {
            Authorization: "Bearer cron-secret-123",
          },
        }),
      });

      expect(res.status).toBe(200);
      expect(queryStatus).toBe("pending");
      const json = await res.json();
      expect(json).toEqual({ deleted: 2 });
    });
  });

  describe("sites-app custom domain serve logic", () => {
    function createMockRes() {
      let statusCode = 200;
      const headers: Record<string, string> = {};
      let body: any = null;

      const res = {
        writeHead: vi.fn((code: number, hdrs: Record<string, string>) => {
          statusCode = code;
          Object.assign(headers, hdrs);
        }),
        end: vi.fn((data: any) => {
          body = data;
        }),
      } as unknown as ServerResponse;

      return {
        res,
        getStatusCode: () => statusCode,
        getHeaders: () => headers,
        getBody: () => body,
      };
    }

    it("ignores pending custom domains (returns unpublished page)", async () => {
      process.env["SUPABASE_URL"] = "https://mock.supabase.co";
      process.env["SUPABASE_SERVICE_ROLE_KEY"] = "mock-service-key";
      process.env["SITES_DOMAIN"] = "shipfolio.xyz";

      const fakeClient = {
        from: (table: string) => {
          if (table === "custom_domains") {
            return {
              select: () => ({
                eq: () => ({
                  in: (_statusCol: string, statuses: string[]) => {
                    expect(statuses).toEqual(["verified", "live"]);
                    return {
                      maybeSingle: async () => ({
                        data: null, // pending is not returned!
                        error: null,
                      }),
                    };
                  },
                }),
              }),
            };
          }
          return {};
        },
      };

      setSitesSupabaseClientGetter(() => fakeClient as never);

      const mockRes = createMockRes();
      const req = {
        headers: { host: "mycustomdomain.com" },
        url: "/",
      } as unknown as IncomingMessage;

      await sitesAppHandler(req, mockRes.res);

      expect(mockRes.getStatusCode()).toBe(404);
      expect(mockRes.getBody()).toContain("This site isn't published.");
    });

    it("serves custom domain when status is verified or live and site is published", async () => {
      process.env["SUPABASE_URL"] = "https://mock.supabase.co";
      process.env["SUPABASE_SERVICE_ROLE_KEY"] = "mock-service-key";
      process.env["SITES_DOMAIN"] = "shipfolio.xyz";

      const htmlContent = "<html><body>Hello from custom domain</body></html>";

      const fakeClient = {
        from: (table: string) => {
          if (table === "custom_domains") {
            return {
              select: () => ({
                eq: () => ({
                  in: () => ({
                    maybeSingle: async () => ({
                      data: { user_id: "user-456", status: "live" },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === "sites") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: { slug: "jane", status: "published" },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          return {};
        },
        storage: {
          from: () => ({
            download: async (path: string) => {
              expect(path).toBe("jane/index.html");
              return {
                data: {
                  arrayBuffer: async () => Buffer.from(htmlContent, "utf-8"),
                },
                error: null,
              };
            },
          }),
        },
      };

      setSitesSupabaseClientGetter(() => fakeClient as never);

      const mockRes = createMockRes();
      const req = {
        headers: { host: "janedoe.com" },
        url: "/",
      } as unknown as IncomingMessage;

      await sitesAppHandler(req, mockRes.res);

      expect(mockRes.getStatusCode()).toBe(200);
      expect(mockRes.getBody().toString()).toBe(htmlContent);
      expect(mockRes.getHeaders()["Content-Security-Policy"]).toContain("sandbox");
    });
  });
});
