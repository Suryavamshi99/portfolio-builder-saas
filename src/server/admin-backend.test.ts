import { beforeEach, describe, expect, it, vi } from "vitest";

import * as adminModule from "@/lib/supabase/admin";
import { adminMiddleware } from "@/server/admin-middleware";
import {
  computeActorHash,
  logAdminAction,
  parsePagination,
  sanitizeAuditDetail,
  validateReason,
} from "./admin-audit";

import { Route as overviewRoute } from "../routes/api/admin/overview";
import { Route as usersRoute } from "../routes/api/admin/users";
import { Route as userDetailRoute } from "../routes/api/admin/users.$id";
import { Route as revokeMcpRoute } from "../routes/api/admin/users.$id.revoke-mcp";
import { Route as jobsRoute } from "../routes/api/admin/jobs";
import { Route as cancelJobRoute } from "../routes/api/admin/jobs.$id.cancel";
import { Route as sitesRoute } from "../routes/api/admin/sites";
import { Route as unpublishSiteRoute } from "../routes/api/admin/sites.$slug.unpublish";
import { Route as removeDomainRoute } from "../routes/api/admin/domains.remove";
import { Route as clearCooldownRoute } from "../routes/api/admin/providers.clear-cooldown";
import { Route as systemRoute } from "../routes/api/admin/system";
import { Route as auditRoute } from "../routes/api/admin/audit";

type Handler = (args: any) => Promise<Response>;

beforeEach(() => {
  vi.restoreAllMocks();
  process.env["ADMIN_SESSION_SECRET"] = "test-session-secret-for-admin-panel-32chars";
  process.env["APP_ORIGIN"] = "https://app.shipfolio.xyz";
  process.env["SITES_DOMAIN"] = "shipfolio.xyz";
  process.env["SUPABASE_URL"] = "https://test.supabase.co";
  process.env["SUPABASE_ANON_KEY"] = "anon-key";
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = "service-role-key";
});

describe("Admin middleware wiring", () => {
  const routes = [
    { name: "overview", route: overviewRoute },
    { name: "users", route: usersRoute },
    { name: "users.$id", route: userDetailRoute },
    { name: "users.$id.revoke-mcp", route: revokeMcpRoute },
    { name: "jobs", route: jobsRoute },
    { name: "jobs.$id.cancel", route: cancelJobRoute },
    { name: "sites", route: sitesRoute },
    { name: "sites.$slug.unpublish", route: unpublishSiteRoute },
    { name: "domains.remove", route: removeDomainRoute },
    { name: "providers.clear-cooldown", route: clearCooldownRoute },
    { name: "system", route: systemRoute },
    { name: "audit", route: auditRoute },
  ];

  for (const { name, route } of routes) {
    it(`wires adminMiddleware on ${name}`, () => {
      const middlewareList = route.options.server?.middleware;
      expect(middlewareList).toBeDefined();
      expect(middlewareList).toContain(adminMiddleware);
    });
  }
});

describe("Admin audit helpers", () => {
  it("computeActorHash computes 16 hex characters from IP and secret", () => {
    const hash = computeActorHash("1.2.3.4", "secret");
    expect(hash).toHaveLength(16);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("sanitizeAuditDetail strips sensitive keys like password, secret, token, key, html", () => {
    const dirty = {
      user_id: "123",
      password: "plaintext-password",
      api_token: "secret-token",
      byok_key: "ai-key",
      user_html: "<script>alert(1)</script>",
      nested: {
        safeField: 42,
        secretValue: "nested-secret",
      },
    };
    const clean = sanitizeAuditDetail(dirty);
    expect(clean).toEqual({
      user_id: "123",
      nested: {
        safeField: 42,
      },
    });
  });

  it("logAdminAction writes sanitized row to admin_audit_log and handles errors gracefully", async () => {
    const insertedRows: Record<string, unknown>[] = [];
    const mockAdmin = {
      from: (table: string) => ({
        insert: (row: Record<string, unknown>) => {
          if (table === "admin_audit_log") insertedRows.push(row);
          return { error: null };
        },
      }),
    };

    const req = new Request("http://localhost/api/admin/users", {
      headers: { "x-forwarded-for": "9.9.9.9, 1.1.1.1" },
    });

    await logAdminAction(mockAdmin as never, {
      action: "user.plan_change",
      targetType: "user",
      targetId: "u123",
      reason: "User requested upgrade",
      detail: { from: "free", to: "pro", secretToken: "do-not-save" },
      request: req,
    });

    expect(insertedRows).toHaveLength(1);
    const row = insertedRows[0]!;
    expect(row["action"]).toBe("user.plan_change");
    expect(row["target_type"]).toBe("user");
    expect(row["target_id"]).toBe("u123");
    expect(row["reason"]).toBe("User requested upgrade");
    expect(row["actor_hash"]).toHaveLength(16);
    expect(row["detail"]).toEqual({ from: "free", to: "pro" });
  });

  it("validateReason requires string between 3 and 300 characters", () => {
    expect(validateReason(undefined).ok).toBe(false);
    expect(validateReason("").ok).toBe(false);
    expect(validateReason("ab").ok).toBe(false);
    expect(validateReason("a".repeat(301)).ok).toBe(false);

    const valid = validateReason("  valid reason  ");
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.reason).toBe("valid reason");
    }
  });

  it("parsePagination enforces 1-based page and caps pageSize at 100", () => {
    const url1 = new URL("http://localhost/api?page=0&pageSize=500");
    const p1 = parsePagination(url1);
    expect(p1.page).toBe(1);
    expect(p1.pageSize).toBe(100);
    expect(p1.offset).toBe(0);

    const url2 = new URL("http://localhost/api?page=3&pageSize=10");
    const p2 = parsePagination(url2);
    expect(p2.page).toBe(3);
    expect(p2.pageSize).toBe(10);
    expect(p2.offset).toBe(20);
  });
});

describe("Destructive route safety checks", () => {
  it("DELETE /api/admin/users/:id requires reason (400 reason_required)", async () => {
    const handlers = userDetailRoute.options.server?.handlers as { DELETE: Handler };
    const res = await handlers.DELETE({
      params: { id: "user-1" },
      request: new Request("http://localhost/api/admin/users/user-1", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmEmail: "test@example.com" }),
      }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("reason_required");
  });

  it("DELETE /api/admin/users/:id rejects confirmEmail mismatch (400 confirm_mismatch)", async () => {
    const mockAdmin = {
      auth: {
        admin: {
          getUserById: async () => ({
            data: { user: { id: "user-1", email: "correct@example.com" } },
            error: null,
          }),
        },
      },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
    };
    vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(mockAdmin as never);

    const handlers = userDetailRoute.options.server?.handlers as { DELETE: Handler };
    const res = await handlers.DELETE({
      params: { id: "user-1" },
      request: new Request("http://localhost/api/admin/users/user-1", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmEmail: "wrong@example.com", reason: "Spam account" }),
      }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("confirm_mismatch");
  });

  it("DELETE /api/admin/users/:id protects last remaining admin (409 last_admin)", async () => {
    const mockAdmin = {
      auth: {
        admin: {
          getUserById: async () => ({
            data: { user: { id: "admin-1", email: "admin@example.com" } },
            error: null,
          }),
        },
      },
      from: (_table: string) => ({
        select: (_cols?: string, opts?: { count?: string; head?: boolean }) => ({
          eq: (col: string, val: unknown) => {
            if (col === "id" && val === "admin-1") {
              return { maybeSingle: async () => ({ data: { is_admin: true }, error: null }) };
            }
            if (col === "is_admin" && val === true && opts?.count === "exact") {
              return Promise.resolve({ count: 1, error: null });
            }
            return { maybeSingle: async () => ({ data: null, error: null }) };
          },
        }),
      }),
    };
    vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(mockAdmin as never);

    const handlers = userDetailRoute.options.server?.handlers as { DELETE: Handler };
    const res = await handlers.DELETE({
      params: { id: "admin-1" },
      request: new Request("http://localhost/api/admin/users/admin-1", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmEmail: "admin@example.com", reason: "Attempted admin deletion" }),
      }),
    });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe("last_admin");
  });

  it("PATCH /api/admin/users/:id protects last remaining admin from demotion (409 last_admin)", async () => {
    const mockAdmin = {
      from: (_table: string) => ({
        select: (_cols?: string, opts?: { count?: string; head?: boolean }) => ({
          eq: (col: string, val: unknown) => {
            if (col === "id" && val === "admin-1") {
              return { maybeSingle: async () => ({ data: { plan: "pro", is_admin: true }, error: null }) };
            }
            if (col === "is_admin" && val === true && opts?.count === "exact") {
              return Promise.resolve({ count: 1, error: null });
            }
            return { maybeSingle: async () => ({ data: null, error: null }) };
          },
        }),
      }),
    };
    vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(mockAdmin as never);

    const handlers = userDetailRoute.options.server?.handlers as { PATCH: Handler };
    const res = await handlers.PATCH({
      params: { id: "admin-1" },
      request: new Request("http://localhost/api/admin/users/admin-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isAdmin: false, reason: "Demoting admin" }),
      }),
    });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe("last_admin");
  });

  it("POST /api/admin/users/:id/revoke-mcp requires reason (400 reason_required)", async () => {
    const handlers = revokeMcpRoute.options.server?.handlers as { POST: Handler };
    const res = await handlers.POST({
      params: { id: "user-1" },
      request: new Request("http://localhost/api/admin/users/user-1/revoke-mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("reason_required");
  });

  it("POST /api/admin/sites/:slug/unpublish requires reason (400 reason_required)", async () => {
    const handlers = unpublishSiteRoute.options.server?.handlers as { POST: Handler };
    const res = await handlers.POST({
      params: { slug: "test-site" },
      request: new Request("http://localhost/api/admin/sites/test-site/unpublish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("reason_required");
  });

  it("POST /api/admin/domains/remove requires reason (400 reason_required)", async () => {
    const handlers = removeDomainRoute.options.server?.handlers as { POST: Handler };
    const res = await handlers.POST({
      request: new Request("http://localhost/api/admin/domains/remove", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hostname: "mysite.com" }),
      }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("reason_required");
  });

  it("POST /api/admin/jobs/:id/cancel requires reason (400 reason_required)", async () => {
    const handlers = cancelJobRoute.options.server?.handlers as { POST: Handler };
    const res = await handlers.POST({
      params: { id: "job-1" },
      request: new Request("http://localhost/api/admin/jobs/job-1/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("reason_required");
  });

  it("POST /api/admin/jobs/:id/cancel returns 409 job_finished on done job", async () => {
    const mockAdmin = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: "job-done",
                user_id: "u1",
                source: "free",
                status: "done",
                message: "Ready",
                error: null,
                retry_at: null,
                resume_upload_id: null,
                params: {},
                provider: "groq",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              error: null,
            }),
          }),
        }),
      }),
    };
    vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(mockAdmin as never);

    const handlers = cancelJobRoute.options.server?.handlers as { POST: Handler };
    const res = await handlers.POST({
      params: { id: "job-done" },
      request: new Request("http://localhost/api/admin/jobs/job-done/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "User requested abort" }),
      }),
    });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe("job_finished");
  });

  it("POST /api/admin/providers/clear-cooldown rejects unknown provider with 400 invalid_provider", async () => {
    const handlers = clearCooldownRoute.options.server?.handlers as { POST: Handler };
    const res = await handlers.POST({
      request: new Request("http://localhost/api/admin/providers/clear-cooldown", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: "non-existent-provider", reason: "Reset cooldown" }),
      }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("invalid_provider");
  });
});

describe("GET /api/admin/overview", () => {
  it("returns full shape with zero counts on empty tables", async () => {
    const mockAdmin = {
      from: () => ({
        select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.count === "exact") {
            const chain = {
              gte: () => chain,
              eq: () => chain,
              not: () => chain,
              order: () => chain,
              limit: () => chain,
              maybeSingle: async () => ({ data: null, error: null }),
              gt: () => chain,
              is: () => chain,
              then: (resolve: (val: any) => void) => resolve({ count: 0, error: null }),
            };
            return chain;
          }
          const normalChain = {
            gte: () => normalChain,
            eq: () => normalChain,
            not: () => normalChain,
            order: () => normalChain,
            limit: () => normalChain,
            maybeSingle: async () => ({ data: null, error: null }),
            then: (resolve: (val: any) => void) => resolve({ data: [], error: null }),
          };
          return normalChain;
        },
      }),
    };
    vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(mockAdmin as never);

    const handlers = overviewRoute.options.server?.handlers as { GET: Handler };
    const res = await handlers.GET({});
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data).toHaveProperty("users");
    expect(data.users).toEqual({ total: 0, new7d: 0, pro: 0, admins: 0 });
    expect(data.content).toEqual({ portfolios: 0, versions: 0, uploadsBytes: 0 });
    expect(data.sites).toEqual({ published: 0, unpublished: 0 });
    expect(data.domains).toEqual({ pending: 0, verified: 0, live: 0 });
    expect(data.jobs.last24h).toEqual({
      total: 0,
      done: 0,
      failed: 0,
      queued: 0,
      running: 0,
      bySource: { free: 0, gemini: 0, mcp: 0 },
    });
    expect(data.jobs.topErrors).toEqual([]);
    expect(data.jobs.oldestQueuedRetryAt).toBeNull();
    expect(data.mcp).toEqual({ activeConnections: 0 });
    expect(Array.isArray(data.freeProviders)).toBe(true);
    expect(data.payments).toHaveProperty("enabled");
  });
});

describe("GET /api/admin/system", () => {
  it("never returns secret values, only set booleans", async () => {
    process.env["OPENROUTER_API_KEY"] = "sk-super-secret-openrouter-key-99999";
    process.env["ADMIN_SESSION_SECRET"] = "my-admin-session-secret-which-must-not-leak";

    const handlers = systemRoute.options.server?.handlers as { GET: Handler };
    const res = await handlers.GET({});
    expect(res.status).toBe(200);

    const data = await res.json();
    const rawString = JSON.stringify(data);

    // Absolute assurance: values never appear in response
    expect(rawString).not.toContain("sk-super-secret-openrouter-key-99999");
    expect(rawString).not.toContain("my-admin-session-secret-which-must-not-leak");

    const openrouterSetting = data.settings.find((s: { name: string }) => s.name === "OPENROUTER_API_KEY");
    expect(openrouterSetting).toEqual({ name: "OPENROUTER_API_KEY", set: true });
  });
});

describe("GET /api/admin/users detail drawer fields", () => {
  it("returns extended fields without storage paths", async () => {
    const mockAdmin = {
      auth: {
        admin: {
          getUserById: async () => ({
            data: { user: { id: "u123", email: "user@example.com", created_at: "2026-10-01T00:00:00Z" } },
            error: null,
          }),
        },
      },
      from: (table: string) => ({
        select: (_cols?: string) => {
          const chain = {
            eq: () => chain,
            order: () => chain,
            limit: () => chain,
            maybeSingle: async () => {
              if (table === "users") return { data: { plan: "pro", is_admin: false, created_at: "2026-10-01T00:00:00Z" } };
              if (table === "portfolios") return { data: { generated_html: "<h1>Hi</h1>", updated_at: "2026-10-02T00:00:00Z" } };
              if (table === "sites") return { data: { slug: "mysite", status: "published", updated_at: "2026-10-02T00:00:00Z" } };
              if (table === "custom_domains") return { data: { hostname: "mysite.com", status: "verified" } };
              if (table === "github_connections") return { data: { account_login: "octocat" } };
              return { data: null, error: null };
            },
            then: (resolve: (val: any) => void) => {
              if (table === "uploads") {
                return resolve({
                  data: [{ id: "up1", kind: "resume", filename: "cv.pdf", size_bytes: 1024, created_at: "2026-10-01" }],
                  error: null,
                });
              }
              if (table === "portfolio_versions") {
                return resolve({
                  data: [{ id: "v1", source: "gemini", model: "gemini-2.0", warnings: ["check"], html: "<h1>Hi</h1>", created_at: "2026-10-01" }],
                  error: null,
                });
              }
              if (table === "generation_jobs") {
                return resolve({
                  data: [{ id: "j1", source: "gemini", status: "done", provider: "gemini", error: null, created_at: "2026-10-01", updated_at: "2026-10-01" }],
                  error: null,
                });
              }
              return resolve({ data: [], error: null });
            },
          };
          return chain;
        },
      }),
    };
    vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(mockAdmin as never);

    const handlers = userDetailRoute.options.server?.handlers as { GET: Handler };
    const res = await handlers.GET({ params: { id: "u123" } });
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.id).toBe("u123");
    expect(data.email).toBe("user@example.com");
    expect(data.uploads[0]).toHaveProperty("sizeBytes", 1024);
    expect(data.uploads[0]).not.toHaveProperty("storage_path");
    expect(data.versions[0]).toEqual({
      id: "v1",
      source: "gemini",
      model: "gemini-2.0",
      warningsCount: 1,
      htmlBytes: 11,
      createdAt: "2026-10-01",
    });
    expect(data.site).toEqual({
      slug: "mysite",
      status: "published",
      url: "https://mysite.shipfolio.xyz",
      updatedAt: "2026-10-02T00:00:00Z",
    });
    expect(data.domain).toEqual({
      hostname: "mysite.com",
      status: "verified",
    });
    expect(data.connections.github).toEqual({ account: "octocat" });
  });
});

describe("GET /api/admin/users query and pagination", () => {
  it("filters by query, plan, and admin", async () => {
    const mockAuthUsers = [
      { id: "u1", email: "alice@example.com", created_at: "2026-10-01T00:00:00Z" },
      { id: "u2", email: "bob@example.com", created_at: "2026-10-02T00:00:00Z" },
      { id: "u3", email: "charlie@example.com", created_at: "2026-10-03T00:00:00Z" },
    ];
    const mockAdmin = {
      auth: {
        admin: {
          listUsers: async () => ({
            data: { users: mockAuthUsers },
            error: null,
          }),
        },
      },
      from: (table: string) => ({
        select: () => {
          const chain = {
            in: () => chain,
            then: (resolve: (val: any) => void) => {
              if (table === "users") {
                return resolve({
                  data: [
                    { id: "u1", plan: "pro", is_admin: true },
                    { id: "u2", plan: "free", is_admin: false },
                    { id: "u3", plan: "pro", is_admin: false },
                  ],
                  error: null,
                });
              }
              if (table === "sites") {
                return resolve({
                  data: [{ user_id: "u1", slug: "alice-site", status: "published" }],
                  error: null,
                });
              }
              return resolve({ data: [], error: null });
            },
          };
          return chain;
        },
      }),
    };
    vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(mockAdmin as never);

    const handlers = usersRoute.options.server?.handlers as { GET: Handler };

    // Query for alice
    const res1 = await handlers.GET({
      request: new Request("http://localhost/api/admin/users?query=alice"),
    });
    const data1 = await res1.json();
    expect(data1.total).toBe(1);
    expect(data1.users[0].email).toBe("alice@example.com");
    expect(data1.users[0].siteSlug).toBe("alice-site");

    // Filter by pro plan
    const res2 = await handlers.GET({
      request: new Request("http://localhost/api/admin/users?plan=pro"),
    });
    const data2 = await res2.json();
    expect(data2.total).toBe(2);

    // Filter by admin
    const res3 = await handlers.GET({
      request: new Request("http://localhost/api/admin/users?admin=true"),
    });
    const data3 = await res3.json();
    expect(data3.total).toBe(1);
    expect(data3.users[0].email).toBe("alice@example.com");
  });
});

describe("POST /api/admin/domains/remove", () => {
  it("returns 404 when domain does not exist", async () => {
    const mockAdmin = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    };
    vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(mockAdmin as never);

    const handlers = removeDomainRoute.options.server?.handlers as { POST: Handler };
    const res = await handlers.POST({
      request: new Request("http://localhost/api/admin/domains/remove", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hostname: "notfound.com", reason: "Removing unused domain" }),
      }),
    });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("domain_not_found");
  });
});

describe("GET /api/admin/audit", () => {
  it("paginates and filters by action", async () => {
    const mockRows = [
      {
        id: "a1",
        created_at: "2026-10-14T00:00:00Z",
        action: "user.plan_change",
        target_type: "user",
        target_id: "u1",
        reason: "Upgrade",
        detail: { from: "free", to: "pro" },
      },
    ];

    const mockAdmin = {
      from: () => ({
        select: () => {
          const chain = {
            eq: () => chain,
            order: () => chain,
            range: async () => ({ data: mockRows, count: 1, error: null }),
          };
          return chain;
        },
      }),
    };
    vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(mockAdmin as never);

    const handlers = auditRoute.options.server?.handlers as { GET: Handler };
    const res = await handlers.GET({
      request: new Request("http://localhost/api/admin/audit?action=user.plan_change&page=1&pageSize=25"),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.total).toBe(1);
    expect(json.entries[0].action).toBe("user.plan_change");
    expect(json.entries[0].targetType).toBe("user");
  });
});

