import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashSecret, isValidRedirectUri, newSecret, redirectUriMatches, verifyPkce } from "./oauth";

const verifier = "a".repeat(43) + "-._~";
const challenge = createHash("sha256").update(verifier).digest("base64url");

describe("oauth helpers", () => {
  it("verifies PKCE S256 and rejects a wrong or malformed verifier", () => {
    expect(verifyPkce(verifier, challenge)).toBe(true);
    expect(verifyPkce(verifier + "x", challenge)).toBe(false);
    expect(verifyPkce("short", challenge)).toBe(false);
    expect(verifyPkce("é".repeat(50), challenge)).toBe(false);
  });
  it("generates unique secrets and hashes them deterministically", () => {
    expect(newSecret()).not.toBe(newSecret());
    expect(hashSecret("x")).toBe(hashSecret("x"));
    expect(hashSecret("x")).toMatch(/^[0-9a-f]{64}$/);
  });
  it("accepts https and loopback http redirect URIs only", () => {
    for (const ok of ["https://claude.ai/api/mcp/auth_callback", "http://localhost:6274/cb", "http://127.0.0.1/cb"]) {
      expect(isValidRedirectUri(ok)).toBe(true);
    }
    for (const bad of ["http://evil.com/cb", "javascript:alert(1)", "https://a.com/cb#frag", "https://u:p@a.com/cb", "not a url", "ftp://a.com"]) {
      expect(isValidRedirectUri(bad)).toBe(false);
    }
  });
  it("matches redirect URIs exactly, letting only loopback ports vary", () => {
    const reg = ["https://claude.ai/cb", "http://localhost:1111/cb"];
    expect(redirectUriMatches(reg, "https://claude.ai/cb")).toBe(true);
    expect(redirectUriMatches(reg, "https://claude.ai/cb2")).toBe(false);
    expect(redirectUriMatches(reg, "https://claude.ai.evil.com/cb")).toBe(false);
    expect(redirectUriMatches(reg, "http://localhost:9999/cb")).toBe(true);
    expect(redirectUriMatches(reg, "http://localhost:9999/other")).toBe(false);
    expect(redirectUriMatches(reg, "http://evil.com:1111/cb")).toBe(false);
  });
});
