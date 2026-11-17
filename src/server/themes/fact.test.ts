import { describe, expect, it } from "vitest";
import { checkContent, contentStrings } from "./fact";
import type { ThemeContent } from "./types";

const REFERENCE = "Jane Doe\nProduct Manager\nCut onboarding time by 40% at Acme, 2019 to 2023";

const base = (): ThemeContent => ({
  person: { first_name: "Jane", last_name: "Doe", headline: "Product Manager" },
  contact: { email: "jane@example.com" },
  experience: [{ role: "PM", company: "Acme", bullets: ["Cut onboarding time by 40%"] }],
});

describe("checkContent", () => {
  it("keeps supported numbers", () => {
    const res = checkContent(base(), REFERENCE);
    expect(res).toMatchObject({ ok: true, dropped: [] });
  });

  it("drops a string whose number is not in the inputs (AE4)", () => {
    const content = base();
    (content.experience![0]!["bullets"] as string[]).push("Grew revenue by 73%");
    const res = checkContent(content, REFERENCE);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.dropped).toEqual(["Grew revenue by 73%"]);
      expect(JSON.stringify(res.content)).not.toContain("73%");
      expect(JSON.stringify(res.content)).toContain("40%");
    }
  });

  it("drops an unsupported string held in an object field", () => {
    const content = base();
    content.about = { intro: "Led a team of 14 engineers" };
    const res = checkContent(content, REFERENCE);
    expect(res.ok && res.content.about).toEqual({});
  });

  it("fails the build when a required field is flagged", () => {
    const content = base();
    content.person!.headline = "Product Manager with 12 years of experience";
    const res = checkContent(content, REFERENCE);
    expect(res.ok).toBe(false);
  });

  it("counts a number the user typed as supported", () => {
    const content = base();
    content.signature = { backlog: ["Shipped 9 launches"] };
    const res = checkContent(content, `${REFERENCE}\nShipped 9 launches`);
    expect(res.ok).toBe(true);
  });

  it("does not mutate the input content", () => {
    const content = base();
    (content.experience![0]!["bullets"] as string[]).push("Grew revenue by 73%");
    checkContent(content, REFERENCE);
    expect(JSON.stringify(content)).toContain("73%");
  });
});

describe("contentStrings", () => {
  it("skips links and emails but keeps prose", () => {
    expect(contentStrings({ a: "https://x.io/1", b: "me@x.io", c: "Hello 2024" })).toEqual(["Hello 2024"]);
  });
});
