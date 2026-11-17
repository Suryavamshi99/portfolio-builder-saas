import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { finalizeHtml } from "@/server/finalize-html";
import { renderTheme, jsonForScript, DATA_PLACEHOLDER, OPTIONS_PLACEHOLDER } from "./render";
import type { ThemeManifest } from "./types";

const manifest: ThemeManifest = {
  id: "test-theme",
  name: "Test",
  tagline: "t",
  profession: "Product",
  feel: "Editorial",
  tier: "free",
  ready: true,
  sections: [
    { id: "about", label: "About" },
    { id: "work", label: "Work" },
  ],
  questions: [],
  cssVars: [{ name: "--accent", label: "Accent" }],
  fonts: ["Inter Tight"],
  fontVars: { display: "--font-display" },
  radiusVar: "--radius",
};

// A large inline vendor-like script, to prove finalizeHtml keeps big script bodies intact.
const VENDOR = `/* lib */var X=${JSON.stringify("a</b>".repeat(20000))};function f(){return 1<2&&3>2}`;

const template = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>x</title>${OPTIONS_PLACEHOLDER}<style>body{margin:0}</style></head><body><main id="about"></main><section id="work"></section><script type="application/json" id="folio-data">${DATA_PLACEHOLDER}</script><script>${VENDOR}</script></body></html>`;

describe("renderTheme", () => {
  it("puts the content in one data island and names the theme", () => {
    const html = renderTheme({ manifest, template, content: { person: { first_name: "Jane" } } });
    const $ = cheerio.load(html);
    expect(JSON.parse($("#folio-data").text())).toMatchObject({ person: { first_name: "Jane" }, demo: false });
    expect($('meta[name="shipfolio-theme"]').attr("content")).toBe("test-theme");
  });

  it("cannot be broken out of by content containing script or comment markers", () => {
    const evil = "</script><img src=x onerror=alert(1)><!-- \u2028";
    const html = renderTheme({ manifest, template, content: { about: { intro: evil } } });
    const $ = cheerio.load(html);
    expect($("img").length).toBe(0);
    expect(JSON.parse($("#folio-data").text()).about.intro).toBe(evil);
    expect(jsonForScript({ a: "<" })).not.toContain("<");
  });

  it("sets the title from the person", () => {
    const html = renderTheme({
      manifest,
      template,
      content: { person: { first_name: "Jane", last_name: "Doe", headline: "PM" } },
    });
    expect(cheerio.load(html)("title").text()).toBe("Jane Doe · PM");
  });

  it("applies only options the theme declares", () => {
    const html = renderTheme({
      manifest,
      template,
      content: {},
      options: {
        colors: { "--accent": "#ff6600", "--evil": "#000000", "--accent2": "red" },
        fontDisplay: "Inter Tight",
        radius: "round",
        hidden: ["work", "nope"],
      },
    });
    const css = cheerio.load(html)("#folio-options").text();
    expect(css).toContain("--accent:#ff6600");
    expect(css).not.toContain("--evil");
    expect(css).toContain('--font-display:"Inter Tight"');
    expect(css).toContain("--radius:24px");
    expect(css).toContain("#work{display:none !important}");
    expect(css).not.toContain("#nope");
    expect(html).toContain("https://fonts.googleapis.com/css2?family=Inter+Tight");
  });

  it("rejects a colour that is not a hex value", () => {
    const html = renderTheme({ manifest, template, content: {}, options: { colors: { "--accent": "red;}body{display:none" } } });
    expect(html).not.toContain("display:none");
  });

  it("refuses a template without placeholders", () => {
    expect(() => renderTheme({ manifest, template: "<html></html>", content: {} })).toThrow();
  });

  it("survives finalizeHtml with the inline script byte-identical and no external resources", () => {
    const html = renderTheme({ manifest, template, content: { person: { first_name: "Jane" } }, options: { fontDisplay: "Inter Tight" } });
    const res = finalizeHtml({
      rawText: html,
      userId: "u1",
      supabaseUrl: "https://p.supabase.co",
      links: {},
      referenceText: "Jane",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const $ = cheerio.load(res.html);
    const scripts = $("script").toArray().map((s) => $(s).text());
    expect(scripts).toContain(VENDOR);
    expect($("script[src]").length).toBe(0);
    expect(JSON.parse($("#folio-data").text()).person.first_name).toBe("Jane");
    expect($('link[href^="https://fonts.googleapis.com/"]').length).toBe(1);
  });
});
