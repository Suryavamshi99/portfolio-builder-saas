import { describe, expect, it } from "vitest";
import { saveResumeText, loadResumeText, MAX_RESUME_TEXT_CHARS } from "./resume-texts";

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

describe("resume-texts", () => {
  it("exports MAX_RESUME_TEXT_CHARS as 100,000", () => {
    expect(MAX_RESUME_TEXT_CHARS).toBe(100_000);
  });

  // 1. saveResumeText upserts { upload_id, user_id, text } with { onConflict: "upload_id" }, and the text is trimmed.
  it("saveResumeText upserts { upload_id, user_id, text } with { onConflict: 'upload_id' } and trims the text", async () => {
    const { admin, calls } = fakeAdmin({
      "resume_texts.upsert": { data: null, error: null },
    });

    await saveResumeText(admin, "user-123", "upload-456", "  Jane Doe\nSoftware Engineer  \n\t");

    expect(calls).toContainEqual({
      table: "resume_texts",
      op: "upsert",
      args: [
        { upload_id: "upload-456", user_id: "user-123", text: "Jane Doe\nSoftware Engineer" },
        { onConflict: "upload_id" },
      ],
    });
  });

  // 2. Text longer than MAX_RESUME_TEXT_CHARS is cut to exactly that length.
  it("cuts text longer than MAX_RESUME_TEXT_CHARS to exactly that length", async () => {
    const { admin, calls } = fakeAdmin({
      "resume_texts.upsert": { data: null, error: null },
    });

    const longText = "a".repeat(MAX_RESUME_TEXT_CHARS + 500);
    await saveResumeText(admin, "user-123", "upload-456", longText);

    const upsertCall = calls.find((c) => c.table === "resume_texts" && c.op === "upsert");
    expect(upsertCall).toBeDefined();
    const payload = (upsertCall?.args[0] as { text: string });
    expect(payload.text.length).toBe(MAX_RESUME_TEXT_CHARS);
  });

  // 3. Whitespace-only text writes nothing.
  it("writes nothing when text is empty or whitespace-only", async () => {
    const { admin, calls } = fakeAdmin({});

    await saveResumeText(admin, "user-123", "upload-456", "   \n\t  ");
    expect(calls.length).toBe(0);

    await saveResumeText(admin, "user-123", "upload-456", "");
    expect(calls.length).toBe(0);
  });

  // 4. A database error from the upsert makes saveResumeText throw.
  it("throws when database error occurs during upsert", async () => {
    const { admin } = fakeAdmin({
      "resume_texts.upsert": { data: null, error: { message: "connection timeout" } },
    });

    await expect(saveResumeText(admin, "user-123", "upload-456", "Resume text")).rejects.toThrow(
      "Failed to save resume text: connection timeout",
    );
  });

  // 5. loadResumeText filters by both upload_id and user_id, and returns the text, or null when there's no row.
  it("loadResumeText filters by both upload_id and user_id, and returns the text or null", async () => {
    const { admin, calls } = fakeAdmin({
      "resume_texts.select": { data: { text: "Stored resume text" }, error: null },
    });

    const text = await loadResumeText(admin, "user-123", "upload-456");
    expect(text).toBe("Stored resume text");

    expect(calls).toContainEqual({ table: "resume_texts", op: "select", args: ["text"] });
    expect(calls).toContainEqual({ table: "resume_texts", op: "eq", args: ["upload_id", "upload-456"] });
    expect(calls).toContainEqual({ table: "resume_texts", op: "eq", args: ["user_id", "user-123"] });
    expect(calls).toContainEqual({ table: "resume_texts", op: "maybeSingle", args: [] });

    // Returns null when no row is found
    const { admin: emptyAdmin } = fakeAdmin({
      "resume_texts.select": { data: null, error: null },
    });

    const emptyText = await loadResumeText(emptyAdmin, "user-123", "upload-456");
    expect(emptyText).toBeNull();
  });

  // 6. A database error from the select makes loadResumeText throw.
  it("throws when database error occurs during select", async () => {
    const { admin } = fakeAdmin({
      "resume_texts.select": { data: null, error: { message: "database offline" } },
    });

    await expect(loadResumeText(admin, "user-123", "upload-456")).rejects.toThrow(
      "Failed to load resume text: database offline",
    );
  });
});
