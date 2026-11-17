import { describe, expect, it } from "vitest";
import { designBriefFor } from "./brief";

describe("designBriefFor", () => {
  it("includes the name, the brief and the fingerprint", () => {
    const b = designBriefFor("two-ink")!;
    expect(b).toContain("Poster Pop");
    expect(b).toContain("risograph");
    expect(b).toContain("Design fingerprint");
    expect(b).toContain("every fact still comes from the resume");
  });
  it("is undefined for a custom build or unknown theme", () => {
    expect(designBriefFor(undefined)).toBeUndefined();
    expect(designBriefFor("nope")).toBeUndefined();
  });
});
