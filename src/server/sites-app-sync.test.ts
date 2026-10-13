import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// sites-app is a separate Vercel project and can't import from src/, so it carries copies.
// If one of these fails, copy the src/ file over the sites-app/lib/ one.
describe("sites-app copies", () => {
  it.each([
    ["src/server/sites.ts", "sites-app/lib/sites.ts"],
    ["src/server/site-csp.ts", "sites-app/lib/site-csp.ts"],
    ["src/server/domains.ts", "sites-app/lib/domains.ts"],
  ])("%s matches %s", (src, copy) => {
    expect(readFileSync(copy, "utf8")).toBe(readFileSync(src, "utf8"));
  });
  it("sites-app does not import from outside its folder", () => {
    expect(readFileSync("sites-app/api/serve.ts", "utf8")).not.toMatch(/from "\.\.\/\.\.\//);
  });
});
