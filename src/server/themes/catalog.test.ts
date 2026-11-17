import { describe, expect, it } from "vitest";
import { listThemeCatalog } from "./catalog";
import { renderThemeDemo } from "./demo";

describe("theme catalog", () => {
  it("lists only ready themes, each with a demo", () => {
    for (const t of listThemeCatalog()) expect(renderThemeDemo(t.id)).toContain("shipfolio-theme");
  });
  it("has no demo for an unknown theme", () => {
    expect(renderThemeDemo("nope")).toBeUndefined();
  });
});
