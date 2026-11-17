import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { registry } from "./registry";

const ROOT = join(process.cwd(), "public/theme-previews");
const BANNED = /\b(Kavya|Riya|Aditya|Kabir|Ishita|Vihaan|Simran|Nandini|Siddharth|Menon|Malhotra|Kulkarni|Sethi|Banerjee|Bhatt|elevenlabs|Dunder|Scranton|Gurugram)\b/i;

function textFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === "vendor" ? [] : textFiles(p);
    return /\.(html|js|css|json|svg|txt)$/.test(name) && !name.includes(".min.") ? [p] : [];
  });
}

describe("sample site previews", () => {
  it("has a sample site for every theme", () => {
    for (const t of registry.list()) expect(existsSync(join(ROOT, t.id, "index.html")), t.id).toBe(true);
  });

  it("carries no original persona, voice widget or show reference", () => {
    for (const t of registry.list()) {
      for (const f of textFiles(join(ROOT, t.id))) expect(BANNED.test(readFileSync(f, "utf8")), f).toBe(false);
    }
  });
});
