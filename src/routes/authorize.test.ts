import { describe, expect, it } from "vitest";
import { consentCsp } from "./authorize";

describe("consent page CSP", () => {
  it("cannot be framed and only posts to us", () => {
    const csp = consentCsp();
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self';");
    expect(csp).toContain("default-src 'none'");
  });
  it("also allows the app's return origin, because form-action covers the redirect", () => {
    expect(consentCsp("https://claude.ai")).toContain("form-action 'self' https://claude.ai;");
  });
});
