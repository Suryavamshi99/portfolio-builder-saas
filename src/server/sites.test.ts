import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  RESERVED_SLUGS,
  BLOCKED_WORDS,
  validateSlug,
  slugFromTitle,
  siteUrl,
  hostToSlug,
} from "./sites";
import { PUBLISHED_SITE_CSP } from "./vercel/deploy";
import sitesAppHandler, { SITES_CSP } from "../../sites-app/api/serve";
import { Route as checkRoute } from "../routes/api/sites/check";
import { Route as meRoute } from "../routes/api/sites/me";
import { Route as publishRoute } from "../routes/api/sites/publish";
import { Route as unpublishRoute } from "../routes/api/sites/unpublish";
import { Route as adminUnpublishRoute } from "../routes/api/admin/sites.$slug.unpublish";
import * as adminModule from "@/lib/supabase/admin";
import * as usersModule from "@/server/users";
import * as imagesModule from "@/server/template/images";
import * as finalizeModule from "@/server/finalize-html";

// Step-up is covered in admin-middleware.test.ts; these tests exercise route behavior behind a valid step-up.
vi.mock("@/server/admin-middleware", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/admin-middleware")>()),
  requireStepUp: () => null,
}));


// Hosting access is covered in billing.test.ts; these tests exercise publish behavior behind active hosting.
vi.mock("@/server/billing", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/billing")>()),
  hasHostingAccess: async () => true,
}));

type RouteHandler = (args: any) => Promise<Response>;

describe("src/server/sites.ts pure helpers", () => {
  it("includes required slugs in RESERVED_SLUGS", () => {
    const required = [
      "www", "api", "app", "admin", "mail", "ftp", "ns1", "ns2", "smtp",
      "imap", "pop", "blog", "docs", "help", "support", "status", "static",
      "assets", "cdn", "dev", "staging", "test", "demo", "root", "login",
      "signup", "dashboard", "studio", "shipfolio",
    ];
    for (const r of required) {
      expect(RESERVED_SLUGS).toContain(r);
    }
  });

  it("includes required phishing and brand terms in BLOCKED_WORDS", () => {
    const required = ["paypal", "google", "microsoft", "apple", "amazon", "bank", "login"];
    for (const b of required) {
      expect(BLOCKED_WORDS).toContain(b);
    }
  });

  describe("validateSlug", () => {
    it("accepts valid 3 to 40 char lowercase alphanumeric slugs with single hyphens", () => {
      expect(validateSlug("janedoe")).toEqual({ ok: true, slug: "janedoe" });
      expect(validateSlug("jane-doe")).toEqual({ ok: true, slug: "jane-doe" });
      expect(validateSlug("abc")).toEqual({ ok: true, slug: "abc" });
      expect(validateSlug("a".repeat(40))).toEqual({ ok: true, slug: "a".repeat(40) });
      expect(validateSlug("jane-123-portfolio")).toEqual({ ok: true, slug: "jane-123-portfolio" });
    });

    it("rejects slugs that are too short, too long, or start/end with hyphen", () => {
      expect(validateSlug("ab")).toEqual({ ok: false, status: "invalid" });
      expect(validateSlug("a")).toEqual({ ok: false, status: "invalid" });
      expect(validateSlug("a".repeat(41))).toEqual({ ok: false, status: "invalid" });
      expect(validateSlug("-janedoe")).toEqual({ ok: false, status: "invalid" });
      expect(validateSlug("janedoe-")).toEqual({ ok: false, status: "invalid" });
    });

    it("rejects slugs containing double hyphens", () => {
      expect(validateSlug("jane--doe")).toEqual({ ok: false, status: "invalid" });
      expect(validateSlug("a--b--c")).toEqual({ ok: false, status: "invalid" });
    });

    it("rejects reserved slugs with status: reserved", () => {
      expect(validateSlug("www")).toEqual({ ok: false, status: "reserved" });
      expect(validateSlug("admin")).toEqual({ ok: false, status: "reserved" });
      expect(validateSlug("shipfolio")).toEqual({ ok: false, status: "reserved" });
    });

    it("rejects blocked words with status: reserved", () => {
      expect(validateSlug("paypal")).toEqual({ ok: false, status: "reserved" });
      expect(validateSlug("google")).toEqual({ ok: false, status: "reserved" });
      expect(validateSlug("apple")).toEqual({ ok: false, status: "reserved" });
    });

    it("normalizes uppercase and trimmed spaces before validating", () => {
      expect(validateSlug("  Jane-Doe  ")).toEqual({ ok: true, slug: "jane-doe" });
      expect(validateSlug("  PAYPAL  ")).toEqual({ ok: false, status: "reserved" });
    });

    it("rejects non-strings", () => {
      expect(validateSlug(null)).toEqual({ ok: false, status: "invalid" });
      expect(validateSlug(123)).toEqual({ ok: false, status: "invalid" });
      expect(validateSlug(undefined)).toEqual({ ok: false, status: "invalid" });
    });
  });

  describe("slugFromTitle", () => {
    it("folds ASCII, lowercases, replaces non-alphanumeric with hyphen, trims and caps to 30", () => {
      expect(slugFromTitle("Jane Doe")).toBe("jane-doe");
      expect(slugFromTitle("Renée & François Design")).toBe("renee-francois-design");
      expect(slugFromTitle("---Hello---World---")).toBe("hello-world");
      expect(slugFromTitle("A".repeat(40))).toBe("a".repeat(30));
    });

    it("returns empty string if nothing left", () => {
      expect(slugFromTitle("!@#$%^&*()")).toBe("");
      expect(slugFromTitle("")).toBe("");
    });
  });

  describe("siteUrl", () => {
    it("returns formatted url based on SITES_DOMAIN", () => {
      const orig = process.env["SITES_DOMAIN"];
      process.env["SITES_DOMAIN"] = "shipfolio.xyz";
      expect(siteUrl("janedoe")).toBe("https://janedoe.shipfolio.xyz");
      process.env["SITES_DOMAIN"] = orig;
    });
  });

  describe("hostToSlug", () => {
    const domain = "shipfolio.xyz";

    it("extracts valid single-label subdomain", () => {
      expect(hostToSlug("janedoe.shipfolio.xyz", domain)).toBe("janedoe");
      expect(hostToSlug("jane-doe.shipfolio.xyz", domain)).toBe("jane-doe");
    });

    it("strips port number if present", () => {
      expect(hostToSlug("janedoe.shipfolio.xyz:3000", domain)).toBe("janedoe");
      expect(hostToSlug("janedoe.shipfolio.xyz:80", domain)).toBe("janedoe");
    });

    it("returns null for apex domain", () => {
      expect(hostToSlug("shipfolio.xyz", domain)).toBe(null);
      expect(hostToSlug("shipfolio.xyz:3000", domain)).toBe(null);
    });

    it("returns null for multi-level subdomains", () => {
      expect(hostToSlug("a.b.shipfolio.xyz", domain)).toBe(null);
      expect(hostToSlug("dev.janedoe.shipfolio.xyz", domain)).toBe(null);
    });

    it("returns null for other domains or evil.com", () => {
      expect(hostToSlug("evil.com", domain)).toBe(null);
      expect(hostToSlug("shipfolio.xyz.evil.com", domain)).toBe(null);
      expect(hostToSlug("janedoe.otherdomain.com", domain)).toBe(null);
    });

    it("returns null for reserved or invalid labels", () => {
      expect(hostToSlug("www.shipfolio.xyz", domain)).toBe(null);
      expect(hostToSlug("admin.shipfolio.xyz", domain)).toBe(null);
      expect(hostToSlug("ab.shipfolio.xyz", domain)).toBe(null); // too short
      expect(hostToSlug("jane--doe.shipfolio.xyz", domain)).toBe(null); // double hyphen
    });

    it("returns null for empty or null inputs", () => {
      expect(hostToSlug(null, domain)).toBe(null);
      expect(hostToSlug("janedoe.shipfolio.xyz", null)).toBe(null);
      expect(hostToSlug("", domain)).toBe(null);
    });
  });
});

describe("sites-app CSP configuration", () => {
  it("starts with PUBLISHED_SITE_CSP and ends with sandbox directive without allow-same-origin", () => {
    expect(SITES_CSP.startsWith(PUBLISHED_SITE_CSP)).toBe(true);
    expect(SITES_CSP.endsWith("; sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox")).toBe(true);
    expect(SITES_CSP).not.toContain("allow-same-origin");
  });
});

describe("sites-app serve handler", () => {
  function makeReqRes(options: { host?: string; url?: string; headers?: Record<string, string> }) {
    const req = {
      headers: {
        host: options.host ?? "janedoe.shipfolio.xyz",
        ...options.headers,
      },
      url: options.url ?? "/",
    } as unknown as IncomingMessage;

    let statusCode = 200;
    const responseHeaders: Record<string, string> = {};
    let responseBody = "";

    const res = {
      writeHead: vi.fn((code: number, headers?: Record<string, string>) => {
        statusCode = code;
        if (headers) {
          Object.assign(responseHeaders, headers);
        }
      }),
      end: vi.fn((body?: string | Buffer) => {
        if (body) {
          responseBody = Buffer.isBuffer(body) ? body.toString("utf-8") : String(body);
        }
      }),
    } as unknown as ServerResponse;

    return {
      req,
      res,
      getResult: () => ({ statusCode, responseHeaders, responseBody }),
    };
  }

  it("returns 500 when required env vars are missing", async () => {
    const origEnv = { ...process.env };
    delete process.env["SUPABASE_URL"];
    delete process.env["SUPABASE_SERVICE_ROLE_KEY"];
    delete process.env["SITES_DOMAIN"];

    const { req, res, getResult } = makeReqRes({});
    await sitesAppHandler(req, res);

    expect(getResult().statusCode).toBe(500);
    expect(getResult().responseBody).toContain("missing required environment variables");

    process.env = origEnv;
  });

  it("returns 404 for missing or invalid host slug", async () => {
    process.env["SUPABASE_URL"] = "https://example.supabase.co";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "dummy-key";
    process.env["SITES_DOMAIN"] = "shipfolio.xyz";

    const { setSitesSupabaseClientGetter } = await import("../../sites-app/api/serve");
    setSitesSupabaseClientGetter(() => ({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
      storage: {
        from: vi.fn().mockReturnValue({
          download: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
        }),
      },
    } as never));

    const { req, res, getResult } = makeReqRes({ host: "invalid.com" });
    await sitesAppHandler(req, res);

    expect(getResult().statusCode).toBe(404);
    expect(getResult().responseHeaders["Content-Security-Policy"]).toBe(SITES_CSP);
    expect(getResult().responseHeaders["X-Content-Type-Options"]).toBe("nosniff");
    expect(getResult().responseBody).toContain("This site isn't published.");
  });

  it("blocks directory traversal attempts (/..%2f, //, etc.) and non-images/ paths", async () => {
    process.env["SUPABASE_URL"] = "https://example.supabase.co";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "dummy-key";
    process.env["SITES_DOMAIN"] = "shipfolio.xyz";

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { slug: "janedoe", status: "published" },
            error: null,
          }),
        }),
      }),
    });
    const mockStorage = {
      from: vi.fn().mockReturnValue({
        download: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
      }),
    };

    const { setSitesSupabaseClientGetter, mapRequestPathToStoragePath } = await import("../../sites-app/api/serve");
    setSitesSupabaseClientGetter(() => ({
      from: mockFrom,
      storage: mockStorage,
    } as never));

    const maliciousUrls = [
      "/../etc/passwd",
      "/..%2findex.html",
      "//index.html",
      "/index.html", // directly requesting index.html instead of /
      "/admin/secret.txt",
      "/static/file.png",
      "/images/../../secret.png",
      "/images//pic.png",
    ];

    for (const url of maliciousUrls) {
      expect(mapRequestPathToStoragePath(url, "janedoe")).toBe(null);

      const { req, res, getResult } = makeReqRes({ host: "janedoe.shipfolio.xyz", url });
      await sitesAppHandler(req, res);
      expect(getResult().statusCode).toBe(404);
      expect(getResult().responseHeaders["Content-Security-Policy"]).toBe(SITES_CSP);
    }

    // Valid paths map correctly
    expect(mapRequestPathToStoragePath("/", "janedoe")).toBe("janedoe/index.html");
    expect(mapRequestPathToStoragePath("/images/photo.png", "janedoe")).toBe("janedoe/images/photo.png");
  });
});

describe("Routes unit tests with fake Supabase client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env["SITES_DOMAIN"] = "shipfolio.xyz";
  });

  it("POST /api/sites/publish returns 409 slug_taken before upload when slug is already taken", async () => {
    const user = { id: "user-123" };
    const fakeSupabase = {
      from: vi.fn(),
      storage: { from: vi.fn() },
    };

    // User is paid
    vi.spyOn(usersModule, "getOrCreateAppUser").mockResolvedValue({ id: "user-123", plan: "pro" } as never);
    vi.spyOn(usersModule, "hasPaidAccess").mockReturnValue(true);

    const uploadFn = vi.fn();

    // Fake admin client
    const fakeAdmin = {
      from: (table: string) => {
        if (table === "portfolios") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { generated_html: "<h1>Hello World</h1>" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "sites") {
          return {
            select: () => ({
              eq: (_col: string, val: string) => ({
                maybeSingle: async () => {
                  if (_col === "user_id") {
                    return { data: null, error: null }; // user has no site yet
                  }
                  if (_col === "slug" && val === "taken-slug") {
                    return { data: { user_id: "other-user" }, error: null }; // slug taken!
                  }
                  return { data: null, error: null };
                },
              }),
            }),
          };
        }
        return {};
      },
      storage: {
        from: () => ({
          upload: uploadFn,
        }),
      },
    };

    vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(fakeAdmin as never);

    const req = new Request("http://localhost/api/sites/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "taken-slug" }),
    });

    // Invoke handler
    const handler = (publishRoute.options.server?.handlers as { POST: RouteHandler }).POST;
    const response: Response = await handler({
      request: req,
      context: { user, supabase: fakeSupabase },
    });

    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json.error.code).toBe("slug_taken");
    // Upload was never called because it failed before upload
    expect(uploadFn).not.toHaveBeenCalled();
  });

  it("POST /api/sites/publish preserves fixed slug after first publish (ignores body.slug)", async () => {
    const user = { id: "user-123" };
    const fakeSupabase = {
      from: vi.fn(),
      storage: { from: vi.fn() },
    };

    vi.spyOn(usersModule, "getOrCreateAppUser").mockResolvedValue({ id: "user-123", plan: "pro" } as never);
    vi.spyOn(usersModule, "hasPaidAccess").mockReturnValue(true);

    let upsertedSlug = "";
    const uploadedPaths: string[] = [];

    const fakeAdmin = {
      from: (table: string) => {
        if (table === "portfolios") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { generated_html: "<h1>Portfolio Content</h1>" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "sites") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { slug: "original-slug", status: "published" },
                  error: null,
                }),
              }),
            }),
            upsert: async (record: { slug: string }) => {
              upsertedSlug = record.slug;
              return { error: null };
            },
          };
        }
        if (table === "portfolio_versions") {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: { id: "ver-1" }, error: null }),
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
          upload: async (path: string) => {
            uploadedPaths.push(path);
            return { error: null };
          },
          list: async () => ({ data: [], error: null }),
          remove: async () => ({ error: null }),
        }),
      },
    };

    vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(fakeAdmin as never);
    vi.spyOn(imagesModule, "embedStorageImagesInHtml").mockResolvedValue({
      html: "<h1>Portfolio Content</h1>",
      files: {},
      embeddedStoragePaths: [],
    });
    const sanitizeSpy = vi.spyOn(finalizeModule, "sanitizeHtmlForServing").mockReturnValue("<h1>Sanitized</h1>");

    const req = new Request("http://localhost/api/sites/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "attempted-new-slug" }),
    });

    const handler = (publishRoute.options.server?.handlers as { POST: RouteHandler }).POST;
    const response: Response = await handler({
      request: req,
      context: { user, supabase: fakeSupabase },
    });

    expect(response.status).toBe(200);
    expect(sanitizeSpy).toHaveBeenCalled();
    expect(upsertedSlug).toBe("original-slug");
    expect(uploadedPaths).toContain("original-slug/index.html");
  });

  it("POST /api/sites/publish only uploads allowed image types and deletes stale images", async () => {
    const user = { id: "user-123" };
    const fakeSupabase = {
      from: vi.fn(),
      storage: { from: vi.fn() },
    };

    vi.spyOn(usersModule, "getOrCreateAppUser").mockResolvedValue({ id: "user-123", plan: "pro" } as never);
    vi.spyOn(usersModule, "hasPaidAccess").mockReturnValue(true);

    const uploadedFiles: Record<string, string> = {};
    const removedFiles: string[] = [];

    const fakeAdmin = {
      from: (table: string) => {
        if (table === "portfolios") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { generated_html: "<h1>With Images</h1>" }, error: null }),
              }),
            }),
          };
        }
        if (table === "sites") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
            upsert: async () => ({ error: null }),
          };
        }
        if (table === "portfolio_versions") {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: null, error: null }),
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
          upload: async (path: string, _buf: Buffer, opts: { contentType: string }) => {
            uploadedFiles[path] = opts.contentType;
            return { error: null };
          },
          list: async () => ({
            data: [
              { name: "photo.jpg" },
              { name: "stale-old-pic.png" },
            ],
            error: null,
          }),
          remove: async (paths: string[]) => {
            removedFiles.push(...paths);
            return { error: null };
          },
        }),
      },
    };

    vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(fakeAdmin as never);
    vi.spyOn(imagesModule, "embedStorageImagesInHtml").mockResolvedValue({
      html: "<h1>With Images</h1>",
      files: {
        "images/photo.jpg": Buffer.from("jpg-data"),
        "images/badge.svg": Buffer.from("svg-data"),
        "images/script.exe": Buffer.from("dangerous-data"),
        "images/document.pdf": Buffer.from("pdf-data"),
      },
      embeddedStoragePaths: [],
    });

    const req = new Request("http://localhost/api/sites/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "janedoe" }),
    });

    const handler = (publishRoute.options.server?.handlers as { POST: RouteHandler }).POST;
    const response: Response = await handler({
      request: req,
      context: { user, supabase: fakeSupabase },
    });

    expect(response.status).toBe(200);
    // Allowed image types are uploaded
    expect(uploadedFiles["janedoe/images/photo.jpg"]).toBe("image/jpeg");
    expect(uploadedFiles["janedoe/images/badge.svg"]).toBe("image/svg+xml");
    // Disallowed types skipped
    expect(uploadedFiles["janedoe/images/script.exe"]).toBeUndefined();
    expect(uploadedFiles["janedoe/images/document.pdf"]).toBeUndefined();
    // Stale image deleted
    expect(removedFiles).toContain("janedoe/images/stale-old-pic.png");
  });

  it("GET /api/sites/check returns available, yours, taken, reserved, invalid correctly", async () => {
    const user = { id: "user-1" };
    const fakeSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => Promise.resolve({ count: 5 }),
          }),
        }),
      }),
    };

    const fakeAdmin = {
      from: () => ({
        select: () => ({
          eq: (_col: string, val: string) => ({
            maybeSingle: async () => {
              if (val === "taken-slug") return { data: { user_id: "user-2" }, error: null };
              if (val === "my-slug") return { data: { user_id: "user-1" }, error: null };
              return { data: null, error: null };
            },
          }),
        }),
      }),
    };

    vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(fakeAdmin as never);
    const handler = (checkRoute.options.server?.handlers as { GET: RouteHandler }).GET;

    // 1. Invalid slug
    const res1 = await handler({
      request: new Request("http://localhost/api/sites/check?slug=ab"),
      context: { user, supabase: fakeSupabase },
    });
    expect((await res1.json()).status).toBe("invalid");

    // 2. Reserved slug
    const res2 = await handler({
      request: new Request("http://localhost/api/sites/check?slug=admin"),
      context: { user, supabase: fakeSupabase },
    });
    expect((await res2.json()).status).toBe("reserved");

    // 3. Available slug
    const res3 = await handler({
      request: new Request("http://localhost/api/sites/check?slug=free-slug"),
      context: { user, supabase: fakeSupabase },
    });
    expect((await res3.json()).status).toBe("available");

    // 4. Yours
    const res4 = await handler({
      request: new Request("http://localhost/api/sites/check?slug=my-slug"),
      context: { user, supabase: fakeSupabase },
    });
    expect((await res4.json()).status).toBe("yours");

    // 5. Taken
    const res5 = await handler({
      request: new Request("http://localhost/api/sites/check?slug=taken-slug"),
      context: { user, supabase: fakeSupabase },
    });
    expect((await res5.json()).status).toBe("taken");
  });

  it("GET /api/sites/me returns site info and calculates draftNewer", async () => {
    const user = { id: "user-1" };
    const handler = (meRoute.options.server?.handlers as { GET: RouteHandler }).GET;

    // Site newer than portfolio
    const fakeAdmin1 = {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              if (table === "sites") {
                return {
                  data: {
                    slug: "mysite",
                    status: "published",
                    published_version_id: "ver-1",
                    updated_at: "2026-10-13T12:00:00Z",
                  },
                  error: null,
                };
              }
              if (table === "portfolios") {
                return {
                  data: { updated_at: "2026-10-13T11:00:00Z" },
                  error: null,
                };
              }
              return { data: null, error: null };
            },
          }),
        }),
      }),
    };

    vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(fakeAdmin1 as never);
    const res1 = await handler({ context: { user } });
    const json1 = await res1.json();
    expect(json1.site.slug).toBe("mysite");
    expect(json1.draftNewer).toBe(false);

    // Portfolio newer than site
    const fakeAdmin2 = {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              if (table === "sites") {
                return {
                  data: {
                    slug: "mysite",
                    status: "published",
                    published_version_id: "ver-1",
                    updated_at: "2026-10-13T12:00:00Z",
                  },
                  error: null,
                };
              }
              if (table === "portfolios") {
                return {
                  data: { updated_at: "2026-10-13T13:00:00Z" },
                  error: null,
                };
              }
              return { data: null, error: null };
            },
          }),
        }),
      }),
    };

    vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(fakeAdmin2 as never);
    const res2 = await handler({ context: { user } });
    const json2 = await res2.json();
    expect(json2.draftNewer).toBe(true);
  });

  it("POST /api/sites/unpublish sets status unpublished and removes files", async () => {
    const user = { id: "user-1" };
    let statusUpdate = "";
    const removedFiles: string[] = [];

    const fakeAdmin = {
      from: (table: string) => {
        if (table === "sites") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { slug: "my-site", status: "published" }, error: null }),
              }),
            }),
            update: (record: { status: string }) => {
              statusUpdate = record.status;
              return {
                eq: async () => ({ error: null }),
              };
            },
          };
        }
        return {};
      },
      storage: {
        from: () => ({
          list: async (folder: string) => {
            if (folder === "my-site") {
              return { data: [{ name: "index.html", id: "file-id" }], error: null };
            }
            if (folder === "my-site/images") {
              return { data: [{ name: "pic.jpg" }], error: null };
            }
            return { data: [], error: null };
          },
          remove: async (paths: string[]) => {
            removedFiles.push(...paths);
            return { error: null };
          },
        }),
      },
    };

    vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(fakeAdmin as never);
    const handler = (unpublishRoute.options.server?.handlers as { POST: RouteHandler }).POST;
    const res = await handler({ context: { user } });
    expect(res.status).toBe(200);
    expect(statusUpdate).toBe("unpublished");
    expect(removedFiles).toContain("my-site/index.html");
    expect(removedFiles).toContain("my-site/images/pic.jpg");
  });

  it("POST /api/admin/sites/$slug/unpublish unpublishes site and removes files", async () => {
    let statusUpdate = "";
    const removedFiles: string[] = [];

    const fakeAdmin = {
      from: (table: string) => {
        if (table === "sites") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { slug: "takedown-site", status: "published" }, error: null }),
              }),
            }),
            update: (record: { status: string }) => {
              statusUpdate = record.status;
              return {
                eq: async () => ({ error: null }),
              };
            },
          };
        }
        if (table === "admin_audit_log") {
          return {
            insert: async () => ({ error: null }),
          };
        }
        return {};
      },
      storage: {
        from: () => ({
          list: async (folder: string) => {
            if (folder === "takedown-site") {
              return { data: [{ name: "index.html", id: "1" }], error: null };
            }
            return { data: [], error: null };
          },
          remove: async (paths: string[]) => {
            removedFiles.push(...paths);
            return { error: null };
          },
        }),
      },
    };

    vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(fakeAdmin as never);
    const handler = (adminUnpublishRoute.options.server?.handlers as { POST: RouteHandler }).POST;
    const res = await handler({
      params: { slug: "takedown-site" },
      request: new Request("http://localhost/api/admin/sites/takedown-site/unpublish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "Terms violation takedown" }),
      }),
    });
    expect(res.status).toBe(200);
    expect(statusUpdate).toBe("unpublished");
    expect(removedFiles).toContain("takedown-site/index.html");
  });
});
