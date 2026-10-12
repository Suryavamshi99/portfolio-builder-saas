import { describe, expect, it } from "vitest";
import { findUnsupportedClaims, visibleText } from "./fact-check";

const RESUME = `Jane Doe — Senior Engineer
jane@example.com | +1 (555) 123-4567 | github.com/jane42
Acme Corp, Jan 2019 – Mar 2023
- Cut API latency by 40% for 2.5M monthly users
- Led a team of 6 engineers; saved $120k per year
- Shipped 3 products, 10x faster deploys
B.Sc. Computer Science, 2014, GPA 3.8/4.0`;

const page = (body: string) =>
  `<!DOCTYPE html><html><head><title>Jane Doe</title><style>.x{width:1200px}</style></head><body>${body}<script>const n = 999;</script></body></html>`;

const claims = (body: string, reference = RESUME, currentYear = 2026) =>
  findUnsupportedClaims(page(body), reference, { currentYear }).map((c) => c.claim);

describe("visibleText", () => {
  it("keeps body text, alt text and the title, and drops script/style/noscript/watermark", () => {
    const text = visibleText(
      `<html><head><title>T 77</title><meta name="description" content="D 88"><style>a{width:11px}</style></head>` +
        `<body><p>Hi</p><p>there</p><img alt="photo 2021"><script>var x=12</script><noscript>13</noscript>` +
        `<shipfolio-watermark data-shipfolio-watermark>14</shipfolio-watermark></body></html>`,
    );
    expect(text).toContain("Hi there");
    expect(text).toContain("photo 2021");
    expect(text).toContain("T 77");
    expect(text).toContain("D 88");
    expect(text).not.toMatch(/11|12|13|14/);
  });
});

describe("findUnsupportedClaims", () => {
  it("accepts numbers, percentages, money, years and dates that are in the resume", () => {
    expect(
      claims(
        `<p>Cut API latency by 40% for 2.5M monthly users.</p><p>Team of 6, saved $120k/yr.</p>` +
          `<p>3 products, 10x faster.</p><p>Acme Corp · Jan 2019 – Mar 2023</p><p>B.Sc. 2014 · GPA 3.8/4.0</p>`,
      ),
    ).toEqual([]);
  });

  it("flags numbers that are not in the resume, with a plain-language message", () => {
    const res = findUnsupportedClaims(page(`<p>Boosted revenue by 35% and led a team of 12.</p>`), RESUME, { currentYear: 2026 });
    expect(res.map((c) => c.claim)).toEqual(["35%", "12"]);
    expect(res[0]!.message).toBe(`"35%" isn't in your resume or your details.`);
  });

  it("matches the same value written differently (k/M/B, commas, decimals)", () => {
    expect(claims(`<p>2,500,000 users and $120,000 saved</p>`)).toEqual([]);
    expect(claims(`<p>2.5 million users</p>`)).toEqual([]);
    expect(claims(`<p>$1.2M raised</p>`)).toEqual(["$1.2M"]);
  });

  it("flags an invented year or date", () => {
    expect(claims(`<p>Acme Corp, 2017 – 2023</p>`)).toEqual(["2017"]);
  });

  it("ignores numbers that are part of names or versions (S3, Python3, OAuth2, v2.1, 3D, 5G)", () => {
    expect(claims(`<p>AWS S3, Python3, OAuth2, ES2020, v2.1, 3D, 5G, H264</p>`)).toEqual([]);
  });

  it("ignores section labels 01–09 and the numbers 0 and 1", () => {
    expect(claims(`<span>01</span><h2>About</h2><span>02</span><h2>Work</h2><p>1 portfolio, 0 fluff</p>`)).toEqual([]);
  });

  it("ignores the current year in a copyright line, but not other years there", () => {
    expect(claims(`<footer>© 2026 Jane Doe</footer>`)).toEqual([]);
    expect(claims(`<footer>Copyright 2026</footer>`)).toEqual([]);
    expect(claims(`<footer>© 2011 Jane Doe</footer>`)).toEqual(["2011"]);
    expect(claims(`<p>Since 2026 I have…</p>`)).toEqual(["2026"]);
  });

  it("accepts a phone number from the resume in any formatting, and flags a different one", () => {
    expect(claims(`<p>Call +1 555 123 4567</p>`)).toEqual([]);
    expect(claims(`<p>Call 555-987-6543</p>`)).toEqual(["555-987-6543"]);
  });

  it("accepts numbers inside emails and links shown as text when they are in the reference", () => {
    expect(claims(`<p>jane@example.com · github.com/jane42</p>`)).toEqual([]);
  });

  it("does not look inside script, style or attributes other than alt", () => {
    expect(claims(`<div style="width:777px" data-n="888"><p>Hello</p></div>`)).toEqual([]);
    expect(claims(`<img src="x.png" alt="Award 2099">`)).toEqual(["2099"]);
  });

  it("uses the user's specifics as reference too", () => {
    expect(claims(`<p>Speaker at 4 conferences</p>`, RESUME + "\nI spoke at 4 conferences")).toEqual([]);
  });

  it("lists each unsupported claim once", () => {
    expect(claims(`<p>35% here</p><p>and 35% again</p>`)).toEqual(["35%"]);
  });
});
