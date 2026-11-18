import { describe, expect, it } from "vitest";
import { listThemeCatalog } from "./catalog";
import { SECTION_KEYS } from "./facts";
import { getTemplate } from "./templates";

describe("theme catalog", () => {
  it("carries sections and a default accent, never the brief", () => {
    for (const t of listThemeCatalog()) {
      expect(t.defaultAccent, t.id).toMatch(/^#[0-9a-fA-F]{6}$/);
      for (const k of t.sections) expect(SECTION_KEYS).toContain(k);
      expect("brief" in t || "reference" in t).toBe(false);
      const tpl = getTemplate(t.id);
      if (tpl) {
        expect(t.sections).toEqual(tpl.sections);
        expect(t.defaultAccent).toBe(tpl.defaultAccent);
      } else expect(t.sections).toEqual([]);
    }
  });
});
