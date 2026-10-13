import { describe, expect, it } from "vitest";
import {
  validateHostname,
  verifyRecordName,
  newVerifyToken,
  txtMatches,
} from "./domains";

describe("src/server/domains.ts helpers", () => {
  const SITES_DOMAIN = "shipfolio.xyz";

  describe("validateHostname", () => {
    it("accepts valid domain names", () => {
      expect(validateHostname("example.com", SITES_DOMAIN)).toEqual({
        ok: true,
        hostname: "example.com",
      });
      expect(validateHostname("my-site.co.uk", SITES_DOMAIN)).toEqual({
        ok: true,
        hostname: "my-site.co.uk",
      });
      expect(validateHostname("portfolio.sub.domain.org", SITES_DOMAIN)).toEqual({
        ok: true,
        hostname: "portfolio.sub.domain.org",
      });
      expect(validateHostname("xn--abc.com", SITES_DOMAIN)).toEqual({
        ok: true,
        hostname: "xn--abc.com",
      });
      expect(validateHostname("EXAMPLE.COM.", SITES_DOMAIN)).toEqual({
        ok: true,
        hostname: "example.com",
      });
    });

    it("rejects non-string or empty inputs", () => {
      expect(validateHostname(null, SITES_DOMAIN).ok).toBe(false);
      expect(validateHostname(undefined, SITES_DOMAIN).ok).toBe(false);
      expect(validateHostname("", SITES_DOMAIN).ok).toBe(false);
      expect(validateHostname("   ", SITES_DOMAIN).ok).toBe(false);
    });

    it("rejects IP addresses", () => {
      expect(validateHostname("1.2.3.4", SITES_DOMAIN).ok).toBe(false);
      expect(validateHostname("127.0.0.1", SITES_DOMAIN).ok).toBe(false);
      expect(validateHostname("::1", SITES_DOMAIN).ok).toBe(false);
      expect(validateHostname("2001:db8::1", SITES_DOMAIN).ok).toBe(false);
    });

    it("rejects localhost and suffixes", () => {
      expect(validateHostname("localhost", SITES_DOMAIN).ok).toBe(false);
      expect(validateHostname("foo.localhost", SITES_DOMAIN).ok).toBe(false);
    });

    it("rejects Vercel platform domains", () => {
      expect(validateHostname("a.vercel.app", SITES_DOMAIN).ok).toBe(false);
      expect(validateHostname("foo.vercel.com", SITES_DOMAIN).ok).toBe(false);
      expect(validateHostname("project.now.sh", SITES_DOMAIN).ok).toBe(false);
    });

    it("rejects sitesDomain itself and any subdomains", () => {
      expect(validateHostname("shipfolio.xyz", SITES_DOMAIN).ok).toBe(false);
      expect(validateHostname("x.shipfolio.xyz", SITES_DOMAIN).ok).toBe(false);
      expect(validateHostname("sub.deep.shipfolio.xyz", SITES_DOMAIN).ok).toBe(false);
    });

    it("rejects scheme, port, path, spaces, invalid chars", () => {
      expect(validateHostname("http://a.com", SITES_DOMAIN).ok).toBe(false);
      expect(validateHostname("https://a.com", SITES_DOMAIN).ok).toBe(false);
      expect(validateHostname("a.com:8080", SITES_DOMAIN).ok).toBe(false);
      expect(validateHostname("a.com/path", SITES_DOMAIN).ok).toBe(false);
      expect(validateHostname("a b.com", SITES_DOMAIN).ok).toBe(false);
      expect(validateHostname("a_b.com", SITES_DOMAIN).ok).toBe(false);
      expect(validateHostname("user@a.com", SITES_DOMAIN).ok).toBe(false);
    });

    it("rejects invalid label formatting", () => {
      expect(validateHostname("-a.com", SITES_DOMAIN).ok).toBe(false);
      expect(validateHostname("a-.com", SITES_DOMAIN).ok).toBe(false);
      expect(validateHostname("a..com", SITES_DOMAIN).ok).toBe(false);
      expect(validateHostname(".a.com", SITES_DOMAIN).ok).toBe(false);
      expect(validateHostname("a", SITES_DOMAIN).ok).toBe(false);
      expect(validateHostname("a.c", SITES_DOMAIN).ok).toBe(false); // TLD < 2 letters
    });

    it("enforces length bounds (4 to 253 chars)", () => {
      expect(validateHostname("a.b", SITES_DOMAIN).ok).toBe(false); // 3 chars & 1 letter tld
      const really254 = "a".repeat(50) + "." + "b".repeat(50) + "." + "c".repeat(50) + "." + "d".repeat(50) + "." + "e".repeat(46) + ".com";
      expect(really254.length).toBe(254);
      expect(validateHostname(really254, SITES_DOMAIN).ok).toBe(false);
    });
  });

  describe("verifyRecordName", () => {
    it("prepends _shipfolio-verify.", () => {
      expect(verifyRecordName("example.com")).toBe("_shipfolio-verify.example.com");
      expect(verifyRecordName("sub.domain.org")).toBe("_shipfolio-verify.sub.domain.org");
    });
  });

  describe("newVerifyToken", () => {
    it("generates a token prefixed with shipfolio-verify=", () => {
      const token1 = newVerifyToken();
      const token2 = newVerifyToken();
      expect(token1.startsWith("shipfolio-verify=")).toBe(true);
      expect(token2.startsWith("shipfolio-verify=")).toBe(true);
      expect(token1).not.toBe(token2);
      // 24 bytes base64url is 32 chars + prefix length (17) = 49 chars
      expect(token1.length).toBe(49);
    });
  });

  describe("txtMatches", () => {
    const token = "shipfolio-verify=abc123xyz";

    it("matches exact token in single chunk record", () => {
      expect(txtMatches([[token]], token)).toBe(true);
      expect(txtMatches([["  " + token + "  "]], token)).toBe(true);
    });

    it("matches chunked records joined together", () => {
      expect(txtMatches([["shipfolio-", "verify=abc123xyz"]], token)).toBe(true);
      expect(txtMatches([["ship", "folio-verify=", "abc123xyz"]], token)).toBe(true);
    });

    it("finds match among multiple TXT records", () => {
      const records = [
        ["v=spf1 include:_spf.google.com ~all"],
        [token],
        ["google-site-verification=somecode"],
      ];
      expect(txtMatches(records, token)).toBe(true);
    });

    it("returns false for non-matching or empty records", () => {
      expect(txtMatches([], token)).toBe(false);
      expect(txtMatches([["wrong-token"]], token)).toBe(false);
      expect(txtMatches([["shipfolio-verify=wrong"]], token)).toBe(false);
      expect(txtMatches([["", ""]], token)).toBe(false);
    });
  });
});
