import { describe, expect, it } from "vitest";
import { buildContent, extractWithoutModel, parseContentReply, pruneEmpty } from "./content";
import type { ThemeManifest } from "./types";

const manifest: ThemeManifest = {
  id: "t",
  name: "T",
  tagline: "",
  profession: "Product",
  feel: "Editorial",
  tier: "free",
  ready: true,
  sections: [],
  questions: [{ key: "backlog", label: "Backlog items" }],
  cssVars: [],
  fonts: [],
};

const RESUME = `Jane Doe
Product Manager
jane@example.com  +91 98765 43210
linkedin.com/in/janedoe
Acme Corp, 2019 - 2023`;

describe("parseContentReply", () => {
  it("reads JSON out of a chatty reply and drops unknown keys", () => {
    const c = parseContentReply('Sure!\n{"person":{"first_name":"Jane","headline":"PM"},"hack":{"x":1}}\nDone');
    expect(c).toEqual({ person: { first_name: "Jane", headline: "PM" } });
  });

  it("returns null for malformed JSON", () => {
    expect(parseContentReply('{"person":{"first_name":')).toBeNull();
    expect(parseContentReply("no json here")).toBeNull();
  });

  it("returns null when a field has the wrong type", () => {
    expect(parseContentReply('{"experience":"lots"}')).toBeNull();
  });
});

describe("pruneEmpty", () => {
  it("removes empty strings, lists and objects so empty sections hide", () => {
    expect(pruneEmpty({ a: "", b: [], c: { d: "  " }, e: "x" })).toEqual({ e: "x" });
  });
});

describe("extractWithoutModel", () => {
  it("reads name, headline and contact details from the text", () => {
    const c = extractWithoutModel(RESUME);
    expect(c.person).toMatchObject({ first_name: "Jane", last_name: "Doe", headline: "Product Manager" });
    expect(c.contact).toMatchObject({ email: "jane@example.com", linkedin: "linkedin.com/in/janedoe" });
  });

  it("returns an empty object for empty text", () => {
    expect(extractWithoutModel("")).toEqual({});
  });
});

describe("buildContent", () => {
  it("falls back to code extraction when the model returns garbage", async () => {
    const res = await buildContent({ resumeText: RESUME, manifest, model: async () => "not json" });
    expect(res.usedModel).toBe(false);
    expect(res.content.person?.first_name).toBe("Jane");
  });

  it("falls back when the model call throws", async () => {
    const res = await buildContent({
      resumeText: RESUME,
      manifest,
      model: async () => {
        throw new Error("busy");
      },
    });
    expect(res.usedModel).toBe(false);
  });

  it("leaves no signature data when every question is skipped (AE1)", async () => {
    const res = await buildContent({ resumeText: RESUME, manifest, answers: {}, model: async () => '{"person":{"first_name":"Jane"}}' });
    expect(res.content.signature).toBeUndefined();
    expect(JSON.stringify(res.content)).not.toMatch(/sample|placeholder|lorem/i);
  });

  it("stores typed answers as lines and ignores keys the theme does not ask for", async () => {
    const res = await buildContent({
      resumeText: RESUME,
      manifest,
      answers: { backlog: "Fix onboarding\n\nAdd search", unknown: "x" },
    });
    expect(res.content.signature).toEqual({ backlog: ["Fix onboarding", "Add search"] });
  });
});
