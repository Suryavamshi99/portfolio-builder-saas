import { describe, expect, it } from "vitest";
import { listThemeCatalog } from "./catalog";
import { createRegistry, registry } from "./registry";
import { FEELS, PROFESSIONS } from "./types";

const BANNED = ["Kavya", "Riya", "Aditya", "Kabir", "Ishita", "Vihaan", "Simran", "Nandini", "Siddharth", "Menon", "Malhotra", "Kulkarni", "Sethi", "Banerjee", "Bhatt", "Reddy", "elevenlabs"];

describe("theme roster", () => {
  it("has 13 themes with unique ids and valid tags", () => {
    const all = registry.list();
    expect(all).toHaveLength(13);
    expect(new Set(all.map((t) => t.id)).size).toBe(13);
    for (const t of all) {
      expect(PROFESSIONS).toContain(t.profession);
      expect(FEELS).toContain(t.feel);
      expect(t.id).toMatch(/^[a-z0-9-]{1,40}$/);
      expect(t.palette.length).toBeGreaterThanOrEqual(3);
      for (const c of t.palette) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
      expect(t.brief.length).toBeGreaterThan(300);
    }
  });

  it("mixes free and paid themes", () => {
    const tiers = new Set(registry.list().map((t) => t.tier));
    expect(tiers).toEqual(new Set(["free", "paid"]));
  });

  it("carries no original sample person or voice-widget text", () => {
    for (const t of registry.list()) {
      const text = JSON.stringify(t);
      for (const w of BANNED) expect(new RegExp(`\\b${w}\\b`, "i").test(text), `${t.id} contains ${w}`).toBe(false);
    }
  });

  it("has a code-derived reference for every theme", () => {
    for (const t of registry.list()) expect(t.reference?.length ?? 0, t.id).toBeGreaterThan(200);
  });

  it("keeps the brief out of the public catalog", () => {
    for (const t of listThemeCatalog()) expect("brief" in t || "reference" in t).toBe(false);
  });

  it("looks a theme up by id", () => {
    expect(createRegistry(registry.list()).get("paper-sprint")?.name).toBe("Sprint Wall");
    expect(registry.get("nope")).toBeUndefined();
  });
});
