import { describe, expect, it } from "vitest";
import { isAllowedOrigin } from "./origin";

const env = { APP_ORIGIN: "https://app.vercel.app", APP_EXTRA_ORIGINS: "https://www.shipfolio.xyz, https://shipfolio.xyz" };

describe("isAllowedOrigin", () => {
  it("accepts the main origin and each extra origin", () => {
    for (const o of ["https://app.vercel.app", "https://www.shipfolio.xyz", "https://shipfolio.xyz"]) {
      expect(isAllowedOrigin(o, env)).toBe(true);
    }
  });
  it("works with only APP_ORIGIN set", () => {
    expect(isAllowedOrigin("https://app.vercel.app", { APP_ORIGIN: "https://app.vercel.app" })).toBe(true);
  });
  it("rejects other origins, subdomains, schemes and ports", () => {
    for (const o of ["https://evil.com", "https://x.shipfolio.xyz", "http://www.shipfolio.xyz", "https://www.shipfolio.xyz:8443", "https://shipfolio.xyz.evil.com"]) {
      expect(isAllowedOrigin(o, env)).toBe(false);
    }
  });
  it("rejects a missing, malformed or 'null' origin without throwing", () => {
    for (const o of [null, "", "null", "not a url"]) expect(isAllowedOrigin(o, env)).toBe(false);
  });
  it("rejects everything when APP_ORIGIN is not set", () => {
    expect(isAllowedOrigin("https://www.shipfolio.xyz", { APP_EXTRA_ORIGINS: "https://www.shipfolio.xyz" })).toBe(false);
  });
});
