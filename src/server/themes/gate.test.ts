import { describe, expect, it } from "vitest";
import { checkThemeAccess } from "./gate";
import { createRegistry } from "./registry";
import type { ThemeManifest } from "./types";

const m = (id: string, tier: "free" | "paid", ready = true): ThemeManifest => ({
  id, name: id, tagline: "", profession: "Product", feel: "Editorial", tier, ready, sections: [], questions: [], cssVars: [], fonts: [],
});
const reg = createRegistry([m("a", "free"), m("b", "paid"), m("c", "free", false)], { a: "x", b: "x", c: "x" });

describe("checkThemeAccess", () => {
  it("allows a free theme for anyone", () => expect(checkThemeAccess("a", false, reg).ok).toBe(true));
  it("blocks a paid theme without paid access", () => {
    const r = checkThemeAccess("b", false, reg);
    expect(r).toMatchObject({ ok: false, status: 402, code: "theme_requires_pro" });
  });
  it("allows a paid theme with paid access", () => expect(checkThemeAccess("b", true, reg).ok).toBe(true));
  it("rejects unknown and not-ready themes", () => {
    expect(checkThemeAccess("zzz", true, reg)).toMatchObject({ ok: false, status: 400 });
    expect(checkThemeAccess("c", true, reg)).toMatchObject({ ok: false, status: 400 });
  });
});
