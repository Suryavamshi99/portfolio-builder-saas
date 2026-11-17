import { describe, expect, it } from "vitest";
import { checkThemeAccess } from "./gate";
import { createRegistry } from "./registry";
import type { Theme } from "./types";

const t = (id: string, tier: "free" | "paid"): Theme => ({ id, name: id, tagline: "", profession: "Product", feel: "Editorial", tier, palette: [], fonts: [], brief: "" });
const reg = createRegistry([t("a", "free"), t("b", "paid")]);

describe("checkThemeAccess", () => {
  it("allows a free theme for anyone", () => expect(checkThemeAccess("a", false, reg).ok).toBe(true));
  it("blocks a paid theme without paid access", () => expect(checkThemeAccess("b", false, reg)).toMatchObject({ ok: false, status: 402, code: "theme_requires_pro" }));
  it("allows a paid theme with paid access", () => expect(checkThemeAccess("b", true, reg).ok).toBe(true));
  it("rejects an unknown theme", () => expect(checkThemeAccess("zzz", true, reg)).toMatchObject({ ok: false, status: 400 }));
});
