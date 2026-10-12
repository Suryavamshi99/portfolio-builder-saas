import { describe, expect, it, vi } from "vitest";
import {
  savePortfolioVersion,
  listPortfolioVersions,
  restorePortfolioVersion,
  MAX_VERSIONS_PER_USER,
} from "./portfolio-versions";

type Call = { table: string; op: string; args: unknown[] };
type Result = { data?: unknown; error: { message: string } | null };

/**
 * A chainable fake of the Supabase query builder. Every method call is
 * recorded; `results` decides what each (table, operation) resolves to.
 */
function fakeAdmin(results: Partial<Record<string, Result>>) {
  const calls: Call[] = [];
  const from = (table: string) => {
    let op = "";
    const builder: Record<string, unknown> = {};
    const chain = (name: string) =>
      (...args: unknown[]) => {
        if (["insert", "upsert", "select", "delete"].includes(name) && !op) op = name;
        calls.push({ table, op: name, args });
        return builder;
      };
    for (const name of ["insert", "upsert", "select", "delete", "eq", "lt", "order", "limit", "single", "maybeSingle"]) {
      builder[name] = chain(name);
    }
    builder["then"] = (resolve: (r: Result) => unknown) =>
      resolve(results[`${table}.${op}`] ?? { data: null, error: null });
    return builder;
  };
  return { admin: { from } as never, calls };
}

const VERSION = { html: "<h1>Portfolio</h1>", source: "gemini" as const, model: "gemini-3.5-flash", warnings: ["w1"] };
const newestRows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ created_at: `2026-10-12T00:00:${String(59 - i).padStart(2, "0")}Z` }));

describe("savePortfolioVersion", () => {
  it("exports MAX_VERSIONS_PER_USER as 20", () => {
    expect(MAX_VERSIONS_PER_USER).toBe(20);
  });

  it("inserts, upserts and prunes by created_at cutoff, all scoped to the user", async () => {
    const { admin, calls } = fakeAdmin({
      "portfolio_versions.insert": { data: { id: "ver-new" }, error: null },
      "portfolio_versions.select": { data: newestRows(20), error: null },
    });

    const res = await savePortfolioVersion(admin, "user-abc", VERSION);
    expect(res.versionId).toBe("ver-new");

    expect(calls).toContainEqual({
      table: "portfolio_versions",
      op: "insert",
      args: [{ user_id: "user-abc", html: VERSION.html, source: "gemini", model: "gemini-3.5-flash", warnings: ["w1"] }],
    });
    expect(calls).toContainEqual(
      expect.objectContaining({
        table: "portfolios",
        op: "upsert",
        args: [expect.objectContaining({ user_id: "user-abc", generated_html: VERSION.html }), { onConflict: "user_id" }],
      }),
    );
    expect(calls).toContainEqual({ table: "portfolio_versions", op: "limit", args: [MAX_VERSIONS_PER_USER] });
    expect(calls).toContainEqual({ table: "portfolio_versions", op: "order", args: ["created_at", { ascending: false }] });
    // Delete everything older than the 20th-newest row, for this user only.
    expect(calls).toContainEqual({ table: "portfolio_versions", op: "lt", args: ["created_at", "2026-10-12T00:00:40Z"] });
    const eqUser = calls.filter((c) => c.table === "portfolio_versions" && c.op === "eq");
    expect(eqUser.length).toBeGreaterThanOrEqual(2);
    expect(eqUser.every((c) => c.args[0] === "user_id" && c.args[1] === "user-abc")).toBe(true);
  });

  it("does not delete anything when the user has fewer than 20 versions", async () => {
    const { admin, calls } = fakeAdmin({
      "portfolio_versions.insert": { data: { id: "v" }, error: null },
      "portfolio_versions.select": { data: newestRows(5), error: null },
    });
    await savePortfolioVersion(admin, "u", VERSION);
    expect(calls.some((c) => c.op === "delete")).toBe(false);
  });

  it("throws on an insert error", async () => {
    const { admin } = fakeAdmin({ "portfolio_versions.insert": { data: null, error: { message: "boom" } } });
    await expect(savePortfolioVersion(admin, "u", VERSION)).rejects.toThrow("Failed to insert portfolio version");
  });

  it("removes the just-inserted version when the portfolios upsert fails, then throws", async () => {
    const { admin, calls } = fakeAdmin({
      "portfolio_versions.insert": { data: { id: "ver-orphan" }, error: null },
      "portfolios.upsert": { error: { message: "upsert failed" } },
    });
    await expect(savePortfolioVersion(admin, "u", VERSION)).rejects.toThrow("Failed to update portfolio");
    expect(calls).toContainEqual({ table: "portfolio_versions", op: "delete", args: [] });
    expect(calls).toContainEqual({ table: "portfolio_versions", op: "eq", args: ["id", "ver-orphan"] });
  });

  it("still succeeds when pruning fails (the page is already saved)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { admin } = fakeAdmin({
      "portfolio_versions.insert": { data: { id: "v" }, error: null },
      "portfolio_versions.select": { data: newestRows(20), error: null },
      "portfolio_versions.delete": { error: { message: "prune failed" } },
    });
    await expect(savePortfolioVersion(admin, "u", VERSION)).resolves.toMatchObject({ versionId: "v" });
    expect(warn).toHaveBeenCalled();

    const { admin: admin2 } = fakeAdmin({
      "portfolio_versions.insert": { data: { id: "v2" }, error: null },
      "portfolio_versions.select": { data: null, error: { message: "select failed" } },
    });
    await expect(savePortfolioVersion(admin2, "u", VERSION)).resolves.toMatchObject({ versionId: "v2" });
    warn.mockRestore();
  });
});

describe("listPortfolioVersions", () => {
  it("lists versions for the user ordered by created_at desc", async () => {
    const mockRows = [
      { id: "v1", source: "gemini", model: "gemini-3.5-flash", warnings: [], created_at: "2026-10-12T10:00:00Z" },
      { id: "v2", source: "gemini", model: "gemini-3.5-flash", warnings: ["w1"], created_at: "2026-10-12T09:00:00Z" },
    ];
    const { admin, calls } = fakeAdmin({
      "portfolio_versions.select": { data: mockRows, error: null },
    });

    const res = await listPortfolioVersions(admin, "user-abc");
    expect(res).toEqual([
      { id: "v1", source: "gemini", model: "gemini-3.5-flash", warnings: [], createdAt: "2026-10-12T10:00:00Z" },
      { id: "v2", source: "gemini", model: "gemini-3.5-flash", warnings: ["w1"], createdAt: "2026-10-12T09:00:00Z" },
    ]);
    expect(calls).toContainEqual({ table: "portfolio_versions", op: "eq", args: ["user_id", "user-abc"] });
    expect(calls).toContainEqual({ table: "portfolio_versions", op: "order", args: ["created_at", { ascending: false }] });
  });

  it("throws when select fails", async () => {
    const { admin } = fakeAdmin({
      "portfolio_versions.select": { data: null, error: { message: "db error" } },
    });
    await expect(listPortfolioVersions(admin, "user-abc")).rejects.toThrow("Failed to list portfolio versions: db error");
  });
});

describe("restorePortfolioVersion", () => {
  it("fetches the requested version and upserts into portfolios", async () => {
    const { admin, calls } = fakeAdmin({
      "portfolio_versions.select": { data: { html: "<h1>Restored</h1>" }, error: null },
      "portfolios.upsert": { data: null, error: null },
    });

    const res = await restorePortfolioVersion(admin, "user-abc", "ver-123");
    expect(res.html).toBe("<h1>Restored</h1>");
    expect(calls).toContainEqual({ table: "portfolio_versions", op: "eq", args: ["user_id", "user-abc"] });
    expect(calls).toContainEqual({ table: "portfolio_versions", op: "eq", args: ["id", "ver-123"] });
    expect(calls).toContainEqual(
      expect.objectContaining({
        table: "portfolios",
        op: "upsert",
        args: [expect.objectContaining({ user_id: "user-abc", generated_html: "<h1>Restored</h1>" }), { onConflict: "user_id" }],
      }),
    );
  });

  it("throws when version is not found", async () => {
    const { admin } = fakeAdmin({
      "portfolio_versions.select": { data: null, error: null },
    });
    await expect(restorePortfolioVersion(admin, "user-abc", "nonexistent")).rejects.toThrow(
      "Portfolio version not found",
    );
  });
});

