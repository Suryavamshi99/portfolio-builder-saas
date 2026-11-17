import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createRegistry, registry } from "./registry";
import { FEELS, PROFESSIONS, type ThemeManifest } from "./types";

const base: ThemeManifest = {
  id: "alpha",
  name: "Alpha",
  tagline: "",
  profession: "Product",
  feel: "Editorial",
  tier: "free",
  ready: true,
  sections: [],
  questions: [],
  cssVars: [],
  fonts: [],
};

describe("createRegistry", () => {
  it("lists only ready themes that have a template", () => {
    const reg = createRegistry(
      [base, { ...base, id: "beta", ready: false }, { ...base, id: "gamma" }],
      { alpha: "<html></html>", beta: "<html></html>" },
    );
    expect(reg.listReady().map((t) => t.id)).toEqual(["alpha"]);
    expect(reg.getReady("beta")).toBeUndefined();
    expect(reg.getReady("gamma")).toBeUndefined();
    expect(reg.get("beta")?.id).toBe("beta");
  });

  it("returns undefined for an unknown id", () => {
    expect(createRegistry([base], { alpha: "x" }).getReady("nope")).toBeUndefined();
  });
});

// Checks on the real theme folders. With no theme ported yet these loops are empty and pass.
const DIR = join(__dirname);
const folders = readdirSync(DIR).filter((f) => statSync(join(DIR, f)).isDirectory());

describe("theme folders", () => {
  it("every registered manifest has a valid profession, feel and unique id", () => {
    const ids = registry.all().map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of registry.all()) {
      expect(PROFESSIONS).toContain(t.profession);
      expect(FEELS).toContain(t.feel);
      expect(t.id).toMatch(/^[a-z0-9-]{1,40}$/);
    }
  });

  it("every ready theme has a template with the data and options placeholders", () => {
    for (const t of registry.listReady()) {
      const html = registry.template(t.id)!;
      expect(html).toContain("__FOLIO_DATA__");
      expect(html).toContain("<!--FOLIO_OPTIONS-->");
    }
  });

  it("no shipped theme file contains an original sample person's name", () => {
    const banned = [
      "Kavya", "Riya", "Aditya", "Kabir", "Ishita", "Vihaan", "Simran", "Nandini", "Siddharth",
      "Menon", "Malhotra", "Kulkarni", "Sethi", "Banerjee", "Bhatt", "Gill", "Reddy",
      "elevenlabs",
    ];
    for (const folder of folders) {
      for (const file of readdirSync(join(DIR, folder))) {
        const text = readFileSync(join(DIR, folder, file), "utf8");
        for (const word of banned) {
          const found = new RegExp(`\\b${word}\\b`, "i").test(text);
          expect(found, `${folder}/${file} contains "${word}"`).toBe(false);
        }
      }
    }
  });
});
