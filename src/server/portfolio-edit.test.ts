import { describe, expect, it } from "vitest";
import { MAX_EDIT_HTML_CHARS } from "@/lib/inline-edit-protocol";
import { savePortfolioEdit, stripEditorArtifacts } from "./portfolio-edit";

const SUPA = "https://proj.supabase.co";
const USER = "user-1";
const T0 = "2026-11-18T10:00:00.000Z";

const PAGE = (body: string, extraHead = "") =>
  `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width"><title>Asha</title><style>body{margin:0}</style>${extraHead}</head><body><nav><a href="#about">About</a></nav><section id="about">${body}</section></body></html>`;
const signed = (path: string) => `${SUPA}/storage/v1/object/sign/uploads/${path}?token=abc`;

type Call = { table: string; op: string; args: unknown[] };
function fakeAdmin(opts: { stored?: { generated_html: string; updated_at: string } | null; latest?: { source: string; model: string | null } | null } = {}) {
  const stored = opts.stored === undefined ? { generated_html: PAGE("<p>Hi</p>"), updated_at: T0 } : opts.stored;
  const calls: Call[] = [];
  const from = (table: string) => {
    let op = "";
    const b: Record<string, unknown> = {};
    for (const name of ["insert", "upsert", "select", "delete", "eq", "lt", "order", "limit", "single", "maybeSingle"]) {
      b[name] = (...args: unknown[]) => {
        if (["insert", "upsert", "select", "delete"].includes(name) && !op) op = name;
        calls.push({ table, op: name, args });
        if (name === "maybeSingle" || name === "single") {
          const data =
            table === "portfolios" ? stored : table === "portfolio_versions" && op === "select" ? (opts.latest ?? null) : table === "portfolio_versions" ? { id: "v1" } : null;
          return Promise.resolve({ data, error: null });
        }
        return b;
      };
    }
    b["then"] = (resolve: (r: unknown) => unknown) => resolve({ data: [], error: null });
    return b;
  };
  return { admin: { from } as never, calls };
}
const run = (html: unknown, admin: never, base: unknown = T0) => savePortfolioEdit(admin, USER, { html, baseUpdatedAt: base, supabaseUrl: SUPA });

describe("savePortfolioEdit", () => {
  it("saves an edited page as a new version and returns the new updatedAt", async () => {
    const { admin, calls } = fakeAdmin({ latest: { source: "mcp", model: null } });
    const res = await run(PAGE("<p>Hello there</p>"), admin);
    expect(res.ok).toBe(true);
    const ins = calls.find((c) => c.table === "portfolio_versions" && c.op === "insert");
    expect((ins?.args[0] as { html: string; source: string }).html).toContain("Hello there");
    expect((ins?.args[0] as { source: string }).source).toBe("mcp");
    expect(calls.some((c) => c.table === "portfolios" && c.op === "upsert")).toBe(true);
    if (res.ok) expect(new Date(res.updatedAt).getTime()).toBeGreaterThan(Date.parse(T0));
  });

  it("strips the watermark and every editor artifact", async () => {
    const { admin, calls } = fakeAdmin();
    const dirty = PAGE(
      '<p contenteditable="plaintext-only" data-sf-text="1">New text</p><img data-sf-img="2" tabindex="0" data-sf-ti="1" role="button" data-sf-ro="1" src="data:image/png;base64,AAAA" alt="me"><div data-sf-edit-ui>x</div>',
      '<style data-sf-edit>.x{}</style>',
    ).replace("</body>", '<script data-sf-preview-guard>1</script><script data-sf-edit>2</script><shipfolio-watermark data-shipfolio-watermark style="x">Preview</shipfolio-watermark></body>');
    expect((await run(dirty, admin)).ok).toBe(true);
    const saved = (calls.find((c) => c.op === "insert")!.args[0] as { html: string }).html;
    for (const bad of ["contenteditable", "data-sf-", "watermark", "Preview<", "tabindex", 'role="button"']) expect(saved).not.toContain(bad);
    expect(saved).toContain("New text");
  });

  it("turns this user's signed URLs back into storage markers", async () => {
    const { admin, calls } = fakeAdmin();
    await run(PAGE(`<img src="${signed(`${USER}/photo/a-me.png`)}" alt="me">`), admin);
    const saved = (calls.find((c) => c.op === "insert")!.args[0] as { html: string }).html;
    expect(saved).toContain(`shipfolio-storage://uploads/${USER}/photo/a-me.png`);
    expect(saved).not.toContain("token=abc");
  });

  it("rejects another user's storage files", async () => {
    const { admin, calls } = fakeAdmin();
    const res = await run(PAGE(`<img src="${signed("other-user/photo/a.png")}" alt="x">`), admin);
    expect(res).toMatchObject({ ok: false, status: 422, code: "foreign_storage" });
    const res2 = await run(PAGE(`<img src="shipfolio-storage://uploads/other-user/photo/a.png" alt="x">`), admin);
    expect(res2).toMatchObject({ ok: false, code: "foreign_storage" });
    expect(calls.some((c) => c.op === "insert")).toBe(false);
  });

  it("removes outside scripts and images (finalizeHtml) instead of keeping them", async () => {
    const { admin, calls } = fakeAdmin();
    const res = await run(PAGE('<p>Hi</p><img src="https://evil.example/x.png" alt="x"><script src="https://evil.example/a.js"></script>'), admin);
    expect(res.ok).toBe(true);
    const saved = (calls.find((c) => c.op === "insert")!.args[0] as { html: string }).html;
    expect(saved).not.toContain("evil.example");
  });

  it("rejects a page that is cut off", async () => {
    const { admin } = fakeAdmin();
    const res = await run("<!DOCTYPE html><html><body><p>cut", admin);
    expect(res).toMatchObject({ ok: false, status: 422, code: "html_invalid" });
    if (!res.ok) expect(res.details?.length).toBeGreaterThan(0);
  });

  it("refuses when the stored page is newer than baseUpdatedAt", async () => {
    const { admin, calls } = fakeAdmin({ stored: { generated_html: PAGE("<p>Hi</p>"), updated_at: "2026-11-18T11:00:00.000Z" } });
    expect(await run(PAGE("<p>mine</p>"), admin)).toMatchObject({ ok: false, status: 409, code: "portfolio_stale" });
    expect(calls.some((c) => c.op === "insert")).toBe(false);
  });

  it("caps the size and validates the body", async () => {
    const { admin } = fakeAdmin();
    expect(await run("x".repeat(MAX_EDIT_HTML_CHARS + 1), admin)).toMatchObject({ ok: false, status: 413 });
    expect(await run(42, admin)).toMatchObject({ ok: false, status: 400 });
    expect(await run(PAGE("<p>a</p>"), admin, "not a date")).toMatchObject({ ok: false, status: 400 });
  });

  it("returns 404 when there is no page yet", async () => {
    const { admin } = fakeAdmin({ stored: null });
    expect(await run(PAGE("<p>a</p>"), admin)).toMatchObject({ ok: false, status: 404 });
  });

  it("keeps the user's own numbers (no fact-check) and survives code-fence text", async () => {
    const { admin, calls } = fakeAdmin();
    const res = await run(PAGE("<p>Grew revenue 400% in 2031 ```wow```</p>"), admin);
    expect(res.ok).toBe(true);
    const saved = (calls.find((c) => c.op === "insert")!.args[0] as { html: string }).html;
    expect(saved).toContain("400%");
    expect(saved).toContain("Grew revenue");
    expect(saved).toContain("</section>");
  });

  it("keeps links that were already on the stored page, drops new ones", async () => {
    const stored = { generated_html: PAGE('<a href="https://github.com/asha">GitHub</a>'), updated_at: T0 };
    const { admin, calls } = fakeAdmin({ stored });
    await run(PAGE('<a href="https://github.com/asha">GitHub</a><a href="https://spam.example/x">Spam</a>'), admin);
    const saved = (calls.find((c) => c.op === "insert")!.args[0] as { html: string }).html;
    expect(saved).toContain('href="https://github.com/asha"');
    expect(saved).not.toContain("spam.example");
  });

  it("does not create a version when nothing changed", async () => {
    const same = PAGE("<p>Hi</p>");
    const { admin, calls } = fakeAdmin({ stored: { generated_html: same, updated_at: T0 } });
    const first = await run(same, fakeAdmin().admin);
    expect(first.ok).toBe(true);
    // finalize may add its guard bits, so compare through a second pass of the saved output
    const { admin: a2, calls: c2 } = fakeAdmin();
    await run(same, a2);
    const normalised = (c2.find((c) => c.op === "insert")!.args[0] as { html: string }).html;
    const { admin: a3, calls: c3 } = fakeAdmin({ stored: { generated_html: normalised, updated_at: T0 } });
    const res = await run(normalised, a3);
    expect(res).toMatchObject({ ok: true, unchanged: true });
    expect(c3.some((c) => c.op === "insert")).toBe(false);
    void admin; void calls;
  });
});

describe("stripEditorArtifacts", () => {
  it("leaves ordinary attributes alone", () => {
    const out = stripEditorArtifacts('<html><body><img src="a.png" tabindex="3" role="img" data-sf-img="1"><p contenteditable="false">x</p></body></html>');
    expect(out).toContain('tabindex="3"');
    expect(out).toContain('role="img"');
    expect(out).toContain('contenteditable="false"');
    expect(out).not.toContain("data-sf-img");
  });
});
