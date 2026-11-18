import { describe, expect, it } from "vitest";
import { parseThemeRequest } from "./types";

describe("parseThemeRequest", () => {
  it("accepts an id alone", () => {
    expect(parseThemeRequest({ id: "paper-sprint" })).toEqual({ id: "paper-sprint" });
  });
  it("accepts customisations and fills the defaults", () => {
    const r = parseThemeRequest({ id: "a", custom: { accent: "#12abEF", hidden: ["skills"] } });
    expect(r?.custom).toEqual({ accent: "#12abEF", fonts: "theme", hidden: ["skills"], order: [] });
  });
  it("rejects bad ids, non-objects and unknown keys", () => {
    for (const bad of [null, "x", [], 5, { id: "Bad Id" }, { id: "" }, { id: "a", extra: 1 }, { id: "a", custom: { accent: "red" } }, { id: "a", custom: { unknown: 1 } }, { id: "a", custom: { fonts: "comic" } }, { id: "a", custom: { hidden: ["nope"] } }, { id: "a", custom: "x" }]) {
      expect(parseThemeRequest(bad), JSON.stringify(bad)).toBeNull();
    }
  });
  it("caps the size", () => {
    const many = Array(11).fill("skills");
    expect(parseThemeRequest({ id: "a", custom: { hidden: many } })).toBeNull();
    expect(parseThemeRequest({ id: "a", custom: { order: many } })).toBeNull();
  });
});
