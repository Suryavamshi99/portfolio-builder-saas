import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";

import { factsText, NO_CUSTOMISATIONS, SECTION_KEYS, type Customisations } from "../facts";
import { findUnsupportedClaims, visibleText } from "@/server/fact-check";
import { finalizeHtml } from "@/server/finalize-html";
import { registry } from "../registry";
import { PUBLISHED_SITE_CSP } from "@/server/site-csp";
import { renderTheme, templateIds } from "./index";
import { RICH_FACTS, SPARSE_FACTS } from "./fixtures";

const BANNED = /\b(?:Kavya|Riya|Aditya|Kabir|Ishita|Vihaan|Simran|Nandini|Siddharth|Menon|Malhotra|Kulkarni|Sethi|Banerjee|Bhatt|elevenlabs|Dunder|Scranton|Anika|Nisha|Bhandari|Yash Trivedi|Pinewick)\b/i;
const MAX_BYTES = 2_500_000;
const fin = (html: string, facts = RICH_FACTS) => finalizeHtml({ rawText: html, userId: "u1", supabaseUrl: "https://x.supabase.co", links: {}, referenceText: factsText(facts) });

describe("theme templates", () => {
  const ids = templateIds();
  it("registers only known themes", () => {
    const known = new Set(registry.list().map((t) => t.id));
    for (const id of ids) expect(known.has(id), id).toBe(true);
  });

  describe.each(ids.length ? ids : ["(none yet)"])("%s", (id) => {
    if (!ids.includes(id)) return it.skip("no templates yet", () => {});
    const render = (facts = RICH_FACTS, custom: Partial<Customisations> = {}) => renderTheme(id, facts, { ...NO_CUSTOMISATIONS, ...custom });

    it("is one self-contained page that passes finalizeHtml and the CSP", () => {
      const html = render();
      expect(Buffer.byteLength(html)).toBeLessThan(MAX_BYTES);
      const $ = cheerio.load(html);
      expect($("script[src], iframe, form, object, embed, base").length).toBe(0);
      $("link").each((_, el) => expect($(el).attr("href") ?? "", "only Google Fonts may be linked").toMatch(/^https:\/\/fonts\.googleapis\.com\//));
      expect(/\bfetch\s*\(|XMLHttpRequest|WebSocket|importScripts|eval\s*\(|new Function/.test($("script").text())).toBe(false);
      expect(/(src|href)=["']https?:\/\/(?!fonts\.g)/i.test(html.replace(/<a [^>]*href=["']https?:[^"']*["']/gi, "")), "no outside resources").toBe(false);
      const r = fin(html);
      expect(r.ok, r.ok ? "" : r.errors.join("; ")).toBe(true);
      expect(PUBLISHED_SITE_CSP).toContain("connect-src 'none'");
    });

    it("carries one design-credit and copyright notice that survives finalizeHtml with its contact link", () => {
      const html = render();
      expect(html.split("data-shipfolio-notice").length - 1).toBe(1);
      const r = fin(html);
      expect(r.ok).toBe(true);
      if (r.ok) {
        const $ = cheerio.load(r.html);
        expect($("[data-shipfolio-notice]").length).toBe(1);
        expect($("[data-shipfolio-notice] a").attr("href")).toBe("mailto:contact@shipfolio.xyz");
        expect($("[data-shipfolio-notice]").text()).toContain("contact@shipfolio.xyz");
      }
      // Sparse pages get it too, and a second pass never adds another.
      expect(render(SPARSE_FACTS).split("data-shipfolio-notice").length - 1).toBe(1);
    });

    it("shows every fact and nothing invented", () => {
      const html = render();
      const text = visibleText(html);
      for (const needle of [RICH_FACTS.name, "Harbourline Freight", "Returns Portal", "University of Leeds", "Roadmapping", "Product Team of the Year"]) {
        expect(text, `missing "${needle}"`).toContain(needle);
      }
      expect(findUnsupportedClaims(html, factsText(RICH_FACTS)).map((c) => c.claim)).toEqual([]);
      expect(BANNED.test(html), "banned sample-site text").toBe(false);
    });

    it("escapes user text", () => {
      const evil = { ...RICH_FACTS, name: 'Eve <img src=x onerror=alert(1)> & "Co"', summary: "</script><script>alert(1)</script>" };
      const html = render(evil);
      expect(html).not.toMatch(/<img src=x onerror/i);
      expect(cheerio.load(html)("script").text()).not.toContain("alert(1)");
    });

    it("hides sections with no data and invents nothing", () => {
      const html = render(SPARSE_FACTS);
      const text = visibleText(html);
      expect(text).toContain("Sam Rivera");
      expect(text).toContain("Northgate Studio");
      for (const gone of ["Harbourline", "Returns Portal", "University", "Certified", "Testimonial", "Languages", "Product Team"]) expect(text).not.toContain(gone);
      // No empty headings: every heading in the body is followed by some text.
      const $ = cheerio.load(html);
      $("section").each((_, el) => expect($(el).text().replace(/\s+/g, "").length, "empty <section>").toBeGreaterThan(0));
      expect(/lorem|placeholder|your name|sample|coming soon|n\/a/i.test(text)).toBe(false);
      expect(findUnsupportedClaims(html, factsText(SPARSE_FACTS))).toEqual([]);
    });

    it("applies the user's customisations", () => {
      const hidden = visibleText(render(RICH_FACTS, { hidden: ["education", "certifications"] }));
      expect(hidden).not.toContain("University of Leeds");
      expect(hidden).not.toContain("Certified Scrum");
      const accent = render(RICH_FACTS, { accent: "#c2185b" });
      expect(accent.toLowerCase()).toContain("#c2185b");
      expect(render(RICH_FACTS, { fonts: "mono" })).toContain("IBM Plex Mono");
      expect(SECTION_KEYS.length).toBeGreaterThan(0);
    });
  });
});
