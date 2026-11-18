import { describe, expect, it } from "vitest";
import { HIDDEN_FN_SOURCE, inlineEditorScript } from "./inline-editor";

describe("inlineEditorScript", () => {
  const html = inlineEditorScript({ token: "tok123", parentOrigin: "http://localhost:3000", scrollY: 120 });
  const js = html.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "");

  it("is one inline script that cannot close itself early", () => {
    expect(html.startsWith("<script data-sf-edit>")).toBe(true);
    expect(js).not.toMatch(/<\/script/i);
  });
  it("parses as JavaScript, with the token and origin filled in and no eval", () => {
    expect(() => new Function(js)).not.toThrow();
    expect(js).toContain('"tok123"');
    expect(js).toContain('"http://localhost:3000"');
    expect(js).not.toMatch(/__[A-Z]+__/);
    expect(js).not.toMatch(/\beval\b|new Function|fetch\(|XMLHttpRequest/);
  });
  it("escapes hostile values", () => {
    const evil = inlineEditorScript({ token: '"</script><script>alert(1)', parentOrigin: "x" });
    expect(evil.match(/<\/script>/gi)?.length).toBe(1);
  });
});

describe("hidden element check", () => {
  const hidden = new Function(`return ${HIDDEN_FN_SOURCE}`)() as (cs: Record<string, string>, r: Record<string, number>, sx: number, sy: number, full: boolean) => boolean;
  const shown = { display: "block", visibility: "visible", position: "static", clip: "auto", clipPath: "none" };
  const box = { width: 200, height: 20, right: 300, bottom: 120 };
  it("keeps visible text", () => expect(hidden(shown, box, 0, 0, true)).toBe(false));
  it("skips display:none and visibility:hidden", () => {
    expect(hidden({ ...shown, display: "none" }, box, 0, 0, false)).toBe(true);
    expect(hidden({ ...shown, visibility: "hidden" }, box, 0, 0, true)).toBe(true);
  });
  it("skips zero-size, clipped and off-screen skip links", () => {
    expect(hidden(shown, { ...box, width: 0 }, 0, 0, true)).toBe(true);
    expect(hidden({ ...shown, clip: "rect(0px, 0px, 0px, 0px)" }, box, 0, 0, true)).toBe(true);
    expect(hidden({ ...shown, position: "absolute" }, { ...box, right: -9000 }, 0, 0, true)).toBe(true);
  });
  it("does not treat a scrolled-away element, or a zero-size container, as hidden", () => {
    expect(hidden({ ...shown, position: "absolute" }, { ...box, bottom: -400 }, 0, 800, true)).toBe(false);
    expect(hidden(shown, { ...box, height: 0 }, 0, 0, false)).toBe(false);
  });
});
