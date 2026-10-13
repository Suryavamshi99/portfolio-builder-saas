import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { createAppJwt, getInstallationToken, getInstallation, installUrl, GithubError } from "./app";

describe("GitHub App", () => {
  const originalEnv = process.env;
  let testPrivateKey: string;
  let testPublicKey: string;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };

    const keyPair = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    testPrivateKey = keyPair.privateKey;
    testPublicKey = keyPair.publicKey;

    process.env["GITHUB_APP_ID"] = "123456";
    process.env["GITHUB_APP_SLUG"] = "shipfolio-app";
    // Test with escaped newlines as specified in the handoff
    process.env["GITHUB_APP_PRIVATE_KEY"] = testPrivateKey.replace(/\n/g, "\\n");
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("createAppJwt", () => {
    it("generates a valid RS256 JWT verifiable with the public key", () => {
      const fixedNow = 1700000000;
      const jwt = createAppJwt(fixedNow);

      const parts = jwt.split(".");
      expect(parts).toHaveLength(3);

      const [headerB64, payloadB64, sigB64] = parts;
      const header = JSON.parse(Buffer.from(headerB64!, "base64url").toString("utf8"));
      const payload = JSON.parse(Buffer.from(payloadB64!, "base64url").toString("utf8"));

      expect(header).toEqual({ alg: "RS256", typ: "JWT" });
      expect(payload).toEqual({
        iss: "123456",
        iat: fixedNow - 60,
        exp: fixedNow + 540,
      });

      const verifier = createVerify("RSA-SHA256");
      verifier.update(`${headerB64}.${payloadB64}`);
      verifier.end();
      const isValid = verifier.verify(testPublicKey, Buffer.from(sigB64!, "base64url"));
      expect(isValid).toBe(true);
    });

    it("throws if env vars are missing", () => {
      delete process.env["GITHUB_APP_ID"];
      expect(() => createAppJwt()).toThrow(GithubError);
    });
  });

  describe("installUrl", () => {
    it("builds the correct installation URL with state", () => {
      const url = installUrl("test-state-123");
      expect(url).toBe("https://github.com/apps/shipfolio-app/installations/new?state=test-state-123");
    });
  });

  describe("getInstallationToken", () => {
    it("returns token on 201/200 success", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ token: "ghs_test123" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", mockFetch);

      const token = await getInstallationToken(9876);
      expect(token).toBe("ghs_test123");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, init] = mockFetch.mock.calls[0]!;
      expect(url).toBe("https://api.github.com/app/installations/9876/access_tokens");
      expect(init.method).toBe("POST");
      expect(init.headers.Authorization).toMatch(/^Bearer ey/);
      expect(init.headers.Accept).toBe("application/vnd.github+json");
    });

    it("throws GithubError with status on failure", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Not Found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", mockFetch);

      await expect(getInstallationToken(9876)).rejects.toThrow(GithubError);
    });
  });

  describe("getInstallation", () => {
    it("returns account_login on success", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ account: { login: "octocat" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", mockFetch);

      const result = await getInstallation(9876);
      expect(result).toEqual({ account_login: "octocat" });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, init] = mockFetch.mock.calls[0]!;
      expect(url).toBe("https://api.github.com/app/installations/9876");
      expect(init.method).toBe("GET");
      expect(init.headers.Authorization).toMatch(/^Bearer ey/);
    });

    it("throws GithubError on 404 or missing login", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", mockFetch);

      await expect(getInstallation(9876)).rejects.toThrow(GithubError);
    });
  });
});
