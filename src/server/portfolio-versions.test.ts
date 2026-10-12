import { describe, expect, it, vi } from "vitest";
import { savePortfolioVersion, MAX_VERSIONS_PER_USER } from "./portfolio-versions";

describe("savePortfolioVersion", () => {
  it("exports MAX_VERSIONS_PER_USER as 20", () => {
    expect(MAX_VERSIONS_PER_USER).toBe(20);
  });

  it("inserts version, upserts portfolio, and prunes old versions beyond limit", async () => {
    const insertedId = "ver-new-123";
    const userId = "user-abc";

    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: insertedId },
          error: null,
        }),
      }),
    });

    const upsertMock = vi.fn().mockResolvedValue({ error: null });

    // Mock 20 versions returned to trigger pruning
    const keepRows = Array.from({ length: 20 }, (_, i) => ({ id: `ver-${i}` }));
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: keepRows,
            error: null,
          }),
        }),
      }),
    });

    const deleteMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        not: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const mockAdmin = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "portfolio_versions") {
          return {
            insert: insertMock,
            select: selectMock,
            delete: deleteMock,
          };
        }
        if (table === "portfolios") {
          return {
            upsert: upsertMock,
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as any;

    const res = await savePortfolioVersion(mockAdmin, userId, {
      html: "<h1>Portfolio</h1>",
      source: "gemini",
      model: "gemini-3.5-flash",
      warnings: ["warning 1"],
    });

    expect(res.versionId).toBe(insertedId);
    expect(res.updatedAt).toBeDefined();

    expect(insertMock).toHaveBeenCalledWith({
      user_id: userId,
      html: "<h1>Portfolio</h1>",
      source: "gemini",
      model: "gemini-3.5-flash",
      warnings: ["warning 1"],
    });

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: userId,
        generated_html: "<h1>Portfolio</h1>",
      }),
      { onConflict: "user_id" },
    );

    expect(deleteMock).toHaveBeenCalled();
  });

  it("throws on database error during insert", async () => {
    const mockAdmin = {
      from: () => ({
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: new Error("DB insert error") }),
          }),
        }),
      }),
    } as any;

    await expect(
      savePortfolioVersion(mockAdmin, "user-1", {
        html: "<p>test</p>",
        source: "free",
        model: null,
        warnings: [],
      }),
    ).rejects.toThrow("Failed to insert portfolio version");
  });
});
