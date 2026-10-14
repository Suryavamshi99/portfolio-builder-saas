import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { removeSiteFiles, SITES_BUCKET } from "./sites-storage";
import { Route as adminUserRoute } from "../routes/api/admin/users.$id";
import { Route as resetRoute } from "../routes/api/reset";
import * as adminModule from "@/lib/supabase/admin";
import * as sitesStorageModule from "./sites-storage";

type RouteHandler = (args: any) => Promise<Response>;

describe("src/server/sites-storage.ts", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lists both prefixes and removes all names", async () => {
    const listCalls: Array<{ folder: string; options: any }> = [];
    let removedPaths: string[] = [];

    const fakeAdmin = {
      storage: {
        from: vi.fn((bucket: string) => {
          expect(bucket).toBe(SITES_BUCKET);
          return {
            list: vi.fn(async (folder: string, options: any) => {
              listCalls.push({ folder, options });
              if (folder === "janedoe") {
                return {
                  data: [
                    { name: "index.html", id: "id-1" },
                    { name: "images", id: null }, // directory representation
                    { name: ".emptyFolderPlaceholder", id: "id-ph" },
                  ],
                  error: null,
                };
              }
              if (folder === "janedoe/images") {
                return {
                  data: [
                    { name: "hero.png", id: "id-2" },
                    { name: "avatar.jpg", id: "id-3" },
                  ],
                  error: null,
                };
              }
              return { data: [], error: null };
            }),
            remove: vi.fn(async (paths: string[]) => {
              removedPaths = [...paths];
              return { error: null };
            }),
          };
        }),
      },
    } as unknown as SupabaseClient;

    await removeSiteFiles(fakeAdmin, "janedoe");

    expect(listCalls.map((c) => c.folder)).toEqual(["janedoe", "janedoe/images"]);
    expect(removedPaths).toEqual([
      "janedoe/index.html",
      "janedoe/images/hero.png",
      "janedoe/images/avatar.jpg",
    ]);
  });

  it("paginates across multiple pages and removes all files", async () => {
    const listCalls: Array<{ folder: string; options: any }> = [];
    let removedPaths: string[] = [];

    // Create 150 image objects in the images subfolder
    const page1Images = Array.from({ length: 100 }, (_, i) => ({
      name: `img-${i}.png`,
      id: `id-${i}`,
    }));
    const page2Images = Array.from({ length: 50 }, (_, i) => ({
      name: `img-${100 + i}.png`,
      id: `id-${100 + i}`,
    }));

    const fakeAdmin = {
      storage: {
        from: vi.fn(() => ({
          list: vi.fn(async (folder: string, options: any) => {
            listCalls.push({ folder, options });
            if (folder === "paginated-site") {
              return {
                data: [{ name: "index.html", id: "root-1" }],
                error: null,
              };
            }
            if (folder === "paginated-site/images") {
              if (options?.offset === 0) {
                return { data: page1Images, error: null };
              }
              if (options?.offset === 100) {
                return { data: page2Images, error: null };
              }
              return { data: [], error: null };
            }
            return { data: [], error: null };
          }),
          remove: vi.fn(async (paths: string[]) => {
            removedPaths = [...paths];
            return { error: null };
          }),
        })),
      },
    } as unknown as SupabaseClient;

    await removeSiteFiles(fakeAdmin, "paginated-site");

    // Root folder called once (1 item < 100 limit, so breaks)
    const rootCalls = listCalls.filter((c) => c.folder === "paginated-site");
    expect(rootCalls).toHaveLength(1);
    expect(rootCalls[0]?.options.offset).toBe(0);

    // Images folder called twice: offset 0 and offset 100
    const imageCalls = listCalls.filter((c) => c.folder === "paginated-site/images");
    expect(imageCalls).toHaveLength(2);
    expect(imageCalls[0]?.options.offset).toBe(0);
    expect(imageCalls[1]?.options.offset).toBe(100);

    // Total 151 items removed (1 root + 150 images)
    expect(removedPaths).toHaveLength(151);
    expect(removedPaths[0]).toBe("paginated-site/index.html");
    expect(removedPaths[1]).toBe("paginated-site/images/img-0.png");
    expect(removedPaths[150]).toBe("paginated-site/images/img-149.png");
  });

  it("supports custom pageSize and caps at maxObjects", async () => {
    let removedPaths: string[] = [];

    const fakeAdmin = {
      storage: {
        from: vi.fn(() => ({
          list: vi.fn(async (folder: string, options: any) => {
            if (folder === "small-page") {
              if (options?.offset === 0) return { data: [{ name: "1.txt", id: "1" }, { name: "2.txt", id: "2" }], error: null };
              if (options?.offset === 2) return { data: [{ name: "3.txt", id: "3" }], error: null };
              return { data: [], error: null };
            }
            return { data: [], error: null };
          }),
          remove: vi.fn(async (paths: string[]) => {
            removedPaths = [...paths];
            return { error: null };
          }),
        })),
      },
    } as unknown as SupabaseClient;

    await removeSiteFiles(fakeAdmin, "small-page", { pageSize: 2 });
    expect(removedPaths).toEqual(["small-page/1.txt", "small-page/2.txt", "small-page/3.txt"]);
  });

  it("rejects an invalid slug before any call", async () => {
    const storageFromSpy = vi.fn();
    const fakeAdmin = {
      storage: {
        from: storageFromSpy,
      },
    } as unknown as SupabaseClient;

    const invalidSlugs = [
      "ab", // too short (min 3)
      "a".repeat(41), // too long (max 40)
      "-starts-with-hyphen",
      "ends-with-hyphen-",
      "double--hyphen",
      "admin", // reserved
      "paypal", // blocked brand
      "../traversal",
      "has/slash",
      "",
      null as unknown as string,
    ];

    for (const slug of invalidSlugs) {
      await expect(removeSiteFiles(fakeAdmin, slug)).rejects.toThrow();
    }

    // Storage client was never touched
    expect(storageFromSpy).not.toHaveBeenCalled();
  });

  it("never leaves the {slug}/ prefix even if storage returns path traversal filenames", async () => {
    let removedPaths: string[] = [];

    const fakeAdmin = {
      storage: {
        from: vi.fn(() => ({
          list: vi.fn(async (folder: string) => {
            if (folder === "secure-site") {
              return {
                data: [
                  { name: "index.html", id: "1" },
                  { name: "../../../etc/passwd", id: "2" },
                  { name: "..\\windows\\system32", id: "3" },
                  { name: "/root/escape", id: "4" },
                ],
                error: null,
              };
            }
            return { data: [], error: null };
          }),
          remove: vi.fn(async (paths: string[]) => {
            removedPaths = [...paths];
            return { error: null };
          }),
        })),
      },
    } as unknown as SupabaseClient;

    await removeSiteFiles(fakeAdmin, "secure-site");

    expect(removedPaths).toEqual(["secure-site/index.html"]);
    for (const p of removedPaths) {
      expect(p.startsWith("secure-site/")).toBe(true);
      expect(p).not.toContain("..");
    }
  });

  it("throws on storage list or remove error", async () => {
    const fakeListErrorAdmin = {
      storage: {
        from: vi.fn(() => ({
          list: vi.fn(async () => ({ data: null, error: new Error("List failed") })),
        })),
      },
    } as unknown as SupabaseClient;

    await expect(removeSiteFiles(fakeListErrorAdmin, "my-site")).rejects.toThrow("List failed");

    const fakeRemoveErrorAdmin = {
      storage: {
        from: vi.fn(() => ({
          list: vi.fn(async (folder: string) => {
            if (folder === "my-site") return { data: [{ name: "index.html", id: "1" }], error: null };
            return { data: [], error: null };
          }),
          remove: vi.fn(async () => ({ error: new Error("Remove failed") })),
        })),
      },
    } as unknown as SupabaseClient;

    await expect(removeSiteFiles(fakeRemoveErrorAdmin, "my-site")).rejects.toThrow("Remove failed");
  });
});

describe("Admin DELETE /api/admin/users/$id site cleanup", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("removes site files first and still deletes when the removal throws", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const deletedUserIds: string[] = [];
    const removedUploads: string[] = [];

    // Make removeSiteFiles throw
    const removeSiteFilesSpy = vi
      .spyOn(sitesStorageModule, "removeSiteFiles")
      .mockRejectedValue(new Error("Storage bucket timeout"));

    const fakeAdmin = {
      from: vi.fn((table: string) => {
        if (table === "sites") {
          return {
            select: () => ({
              eq: (_col: string, _val: string) => ({
                maybeSingle: async () => ({
                  data: { slug: "victim-site" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "uploads") {
          return {
            select: () => ({
              eq: () => ({
                data: [{ storage_path: "user-123/file.pdf" }],
              }),
            }),
          };
        }
        return {};
      }),
      storage: {
        from: vi.fn(() => ({
          remove: vi.fn(async (paths: string[]) => {
            removedUploads.push(...paths);
            return { error: null };
          }),
        })),
      },
      auth: {
        admin: {
          deleteUser: vi.fn(async (id: string) => {
            deletedUserIds.push(id);
            return { error: null };
          }),
        },
      },
    };

    vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(fakeAdmin as never);

    const handler = (adminUserRoute.options.server?.handlers as { DELETE: RouteHandler }).DELETE;
    const response = await handler({ params: { id: "user-123" } });

    expect(response.status).toBe(204);

    // Site removal was attempted first for the user's slug
    expect(removeSiteFilesSpy).toHaveBeenCalledWith(expect.anything(), "victim-site");

    // Console.warn logged the failure with slug only, NO user ID or other user data
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const loggedMessage = warnSpy.mock.calls[0]?.[0];
    expect(loggedMessage).toContain("victim-site");
    expect(loggedMessage).not.toContain("user-123");

    // Uploads were still cleaned up and user was deleted
    expect(removedUploads).toContain("user-123/file.pdf");
    expect(deletedUserIds).toEqual(["user-123"]);
  });

  it("removes site files and proceeds normally on success", async () => {
    const deletedUserIds: string[] = [];
    const removeSiteFilesSpy = vi
      .spyOn(sitesStorageModule, "removeSiteFiles")
      .mockResolvedValue();

    const fakeAdmin = {
      from: vi.fn((table: string) => {
        if (table === "sites") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { slug: "success-site" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "uploads") {
          return {
            select: () => ({
              eq: () => ({ data: [] }),
            }),
          };
        }
        return {};
      }),
      storage: {
        from: vi.fn(() => ({
          remove: vi.fn(async () => ({ error: null })),
        })),
      },
      auth: {
        admin: {
          deleteUser: vi.fn(async (id: string) => {
            deletedUserIds.push(id);
            return { error: null };
          }),
        },
      },
    };

    vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(fakeAdmin as never);

    const handler = (adminUserRoute.options.server?.handlers as { DELETE: RouteHandler }).DELETE;
    const response = await handler({ params: { id: "user-456" } });

    expect(response.status).toBe(204);
    expect(removeSiteFilesSpy).toHaveBeenCalledWith(expect.anything(), "success-site");
    expect(deletedUserIds).toEqual(["user-456"]);
  });
});

describe("POST /api/reset success response", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("includes notes about published site staying live", async () => {
    const user = { id: "reset-user" };
    const fakeSupabase = {
      from: vi.fn((table: string) => {
        if (table === "uploads") {
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: [], error: null }),
            }),
            delete: () => ({
              eq: () => Promise.resolve({ error: null }),
            }),
          };
        }
        if (table === "portfolio_inputs") {
          return {
            delete: () => ({
              eq: () => Promise.resolve({ error: null }),
            }),
          };
        }
        return {};
      }),
      storage: {
        from: vi.fn(() => ({
          remove: vi.fn(() => Promise.resolve({ error: null })),
        })),
      },
    };

    const fakeAdmin = {
      from: vi.fn((table: string) => {
        if (table === "portfolio_versions") {
          return {
            delete: () => ({
              eq: () => Promise.resolve({ error: null }),
            }),
          };
        }
        if (table === "portfolios") {
          return {
            upsert: () => Promise.resolve({ error: null }),
          };
        }
        return {};
      }),
    };

    vi.spyOn(adminModule, "createSupabaseAdminClient").mockReturnValue(fakeAdmin as never);

    const handler = (resetRoute.options.server?.handlers as { POST: RouteHandler }).POST;
    const response = await handler({
      context: { user, supabase: fakeSupabase },
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(typeof json.updatedAt).toBe("string");
    expect(json.notes).toEqual(["Your published site stays live until you unpublish it."]);
  });
});
