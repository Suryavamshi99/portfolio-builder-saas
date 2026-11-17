import { describe, expect, it } from "vitest";
import { runThemedBuild } from "./run";
import type { ThemeManifest } from "./types";

const manifest: ThemeManifest = {
  id: "t", name: "T", tagline: "", profession: "Product", feel: "Editorial", tier: "free", ready: true,
  sections: [], questions: [], cssVars: [], fonts: [],
};
const template = `<!doctype html><html><head><title>x</title><!--FOLIO_OPTIONS--></head><body><p>hi</p><script type="application/json" id="folio-data">__FOLIO_DATA__</script></body></html>`;
const resume = "Zed Quill\nProduct Manager\nzed@example.com\nLed a team of 5 engineers.";
const finalize = { userId: "u", supabaseUrl: "https://x.supabase.co", links: {}, referenceText: resume } as never;

describe("runThemedBuild", () => {
  it("fills the template from the resume without a model", async () => {
    const r = await runThemedBuild({ manifest, template, request: { id: "t" }, resumeText: resume, referenceText: resume, finalize });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.html).toContain("Zed");
      expect(r.html).toContain('name="shipfolio-theme"');
      expect(r.usedModel).toBe(false);
    }
  });

  it("drops a model-written claim the resume does not support", async () => {
    const model = async () => JSON.stringify({ person: { first_name: "Zed", last_name: "Quill", headline: "Product Manager" }, pitch: { short: "Grew revenue by 340%." } });
    const r = await runThemedBuild({ manifest, template, request: { id: "t" }, resumeText: resume, referenceText: resume, finalize, model });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.html).not.toContain("340%");
      expect(r.dropped.length).toBeGreaterThan(0);
    }
  });

  it("reports declined preferences when no model can read them", async () => {
    const r = await runThemedBuild({ manifest, template, request: { id: "t", preferences: "make it purple" }, resumeText: resume, referenceText: resume, finalize });
    expect(r.ok && r.declined.length).toBe(1);
  });
});
