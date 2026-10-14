import { describe, expect, it } from "vitest";
import {
  decodeBase32,
  encodeBase32,
  generateTotpCodeForStep,
  generateTotpSecret,
  getTotpStep,
  getTotpUri,
  verifyTotpCode,
} from "./totp";

describe("RFC 6238 TOTP implementation", () => {
  // RFC 6238 Appendix B test vectors for SHA-1
  // Secret: ASCII string "12345678901234567890" (20 bytes)
  const rfcSecretAscii = "12345678901234567890";
  const rfcSecretBuffer = Buffer.from(rfcSecretAscii, "ascii");
  const rfcSecretBase32 = encodeBase32(rfcSecretBuffer);

  it("encodes and decodes Base32 without padding loss", () => {
    const raw = Buffer.from("Hello, World! 12345", "utf8");
    const encoded = encodeBase32(raw);
    const decoded = decodeBase32(encoded);
    expect(decoded.toString("utf8")).toBe("Hello, World! 12345");
  });

  it("handles base32 case-insensitivity, spaces and dashes", () => {
    const raw = Buffer.from("test payload", "utf8");
    const encoded = encodeBase32(raw);
    const messy = ` ${encoded.slice(0, 4)}-${encoded.slice(4).toLowerCase()} `;
    expect(decodeBase32(messy).toString("utf8")).toBe("test payload");
  });

  it("generates a 32-character base32 secret (20 random bytes)", () => {
    const secret = generateTotpSecret();
    expect(secret).toHaveLength(32);
    const decoded = decodeBase32(secret);
    expect(decoded.length).toBe(20);
  });

  it("formats standard otpauth URI", () => {
    const uri = getTotpUri("owner", "JBSWY3DPEHPK3PXP");
    expect(uri).toBe("otpauth://totp/Shipfolio%20Admin:owner?secret=JBSWY3DPEHPK3PXP&issuer=Shipfolio%20Admin");
  });

  it("matches exact RFC 6238 SHA-1 test vectors", () => {
    // RFC 6238 Appendix B test vector timestamps & expected 6-digit codes
    const testVectors = [
      { timeSec: 59, step: 1, expected: "287082" },
      { timeSec: 1111111109, step: 37037036, expected: "081804" },
      { timeSec: 1111111111, step: 37037037, expected: "050471" },
      { timeSec: 1234567890, step: 41152263, expected: "005924" },
      { timeSec: 2000000000, step: 66666666, expected: "279037" },
    ];

    for (const v of testVectors) {
      const codeFromStep = generateTotpCodeForStep(rfcSecretBuffer, v.step);
      expect(codeFromStep).toBe(v.expected);

      const codeFromBase32 = generateTotpCodeForStep(rfcSecretBase32, v.step);
      expect(codeFromBase32).toBe(v.expected);
    }
  });

  it("accepts codes within the ±1 step window", () => {
    const timeMs = 1234567890 * 1000;
    const currentStep = getTotpStep(timeMs);

    const prevCode = generateTotpCodeForStep(rfcSecretBase32, currentStep - 1n);
    const currCode = generateTotpCodeForStep(rfcSecretBase32, currentStep);
    const nextCode = generateTotpCodeForStep(rfcSecretBase32, currentStep + 1n);

    expect(verifyTotpCode(rfcSecretBase32, prevCode, { timeMs }).ok).toBe(true);
    expect(verifyTotpCode(rfcSecretBase32, currCode, { timeMs }).ok).toBe(true);
    expect(verifyTotpCode(rfcSecretBase32, nextCode, { timeMs }).ok).toBe(true);
  });

  it("rejects codes outside the ±1 step window", () => {
    const timeMs = 1234567890 * 1000;
    const currentStep = getTotpStep(timeMs);

    const tooEarly = generateTotpCodeForStep(rfcSecretBase32, currentStep - 2n);
    const tooLate = generateTotpCodeForStep(rfcSecretBase32, currentStep + 2n);

    expect(verifyTotpCode(rfcSecretBase32, tooEarly, { timeMs }).ok).toBe(false);
    expect(verifyTotpCode(rfcSecretBase32, tooLate, { timeMs }).ok).toBe(false);
  });

  it("rejects replayed codes where step <= lastStep", () => {
    const timeMs = 1234567890 * 1000;
    const currentStep = getTotpStep(timeMs);
    const code = generateTotpCodeForStep(rfcSecretBase32, currentStep);

    // First use at currentStep succeeds
    const firstTry = verifyTotpCode(rfcSecretBase32, code, { timeMs, lastStep: currentStep - 1n });
    expect(firstTry.ok).toBe(true);
    expect(firstTry.step).toBe(currentStep);

    // Second use with lastStep = currentStep is rejected (no replay)
    const replayTry = verifyTotpCode(rfcSecretBase32, code, { timeMs, lastStep: currentStep });
    expect(replayTry.ok).toBe(false);

    // Using an older code from currentStep - 1 with lastStep = currentStep is also rejected
    const prevCode = generateTotpCodeForStep(rfcSecretBase32, currentStep - 1n);
    const prevTry = verifyTotpCode(rfcSecretBase32, prevCode, { timeMs, lastStep: currentStep });
    expect(prevTry.ok).toBe(false);
  });

  it("rejects non-6-digit or malformed codes", () => {
    expect(verifyTotpCode(rfcSecretBase32, "12345").ok).toBe(false);
    expect(verifyTotpCode(rfcSecretBase32, "1234567").ok).toBe(false);
    expect(verifyTotpCode(rfcSecretBase32, "abcdef").ok).toBe(false);
    expect(verifyTotpCode(rfcSecretBase32, "").ok).toBe(false);
  });
});
