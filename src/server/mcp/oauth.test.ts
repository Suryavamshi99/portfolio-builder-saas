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

import { IMITATES_KNOWN_APP, cleanClientName, isTrustedClient, isTrustedRedirect } from "./oauth";

describe("who is a known app", () => {
  it("trusts only Claude / ChatGPT return addresses over https", () => {
    expect(isTrustedRedirect("https://claude.ai/api/mcp/auth_callback")).toBe(true);
    expect(isTrustedRedirect("https://chatgpt.com/connector_platform_oauth_redirect")).toBe(true);
    for (const bad of ["http://claude.ai/cb", "https://claude.ai.evil.com/cb", "https://evilclaude.ai/cb", "https://example.com/claude.ai", "http://localhost:1/cb", "nope"]) {
      expect(isTrustedRedirect(bad), bad).toBe(false);
    }
  });
  it("needs every return address to be trusted", () => {
    expect(isTrustedClient(["https://claude.ai/cb", "https://claude.com/cb"])).toBe(true);
    expect(isTrustedClient(["https://claude.ai/cb", "https://evil.com/cb"])).toBe(false);
    expect(isTrustedClient([])).toBe(false);
  });
  it("flags names that imitate a known app", () => {
    for (const n of ["Claude", "Claude Desktop", "ChatGPT Plus", "Anthropic Official", "OpenAI Connector", "Shipfolio Support"]) {
      expect(IMITATES_KNOWN_APP.test(n), n).toBe(true);
    }
    expect(IMITATES_KNOWN_APP.test("My Notes Helper")).toBe(false);
  });
  it("removes invisible and direction-changing characters from names", () => {
    expect(cleanClientName("Cla​ude")).toBe("Claude");
    expect(cleanClientName("‮evil‬ app")).toBe("evil app");
    expect(cleanClientName("a<b>c\n\td")).toBe("abc d");
    expect(cleanClientName("x".repeat(300))).toHaveLength(100);
  });
});
