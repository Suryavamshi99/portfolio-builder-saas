import { describe, expect, it, beforeEach } from "vitest";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
  verifyAndConsumeRecoveryCode,
  bumpSessionEpoch,
  regenerateRecoveryCodes,
  type AdminSecurityRow,
} from "./security-store";

describe("security-store helpers and persistence", () => {
  beforeEach(() => {
    // ENCRYPTION_KEY must be 32 bytes base64 encoded
    process.env["ENCRYPTION_KEY"] = Buffer.alloc(32, 7).toString("base64");
  });

  it("encrypts and decrypts TOTP secret with AES-256-GCM envelope", () => {
    const originalSecret = "JBSWY3DPEHPK3PXP";
    const encrypted = encryptTotpSecret(originalSecret);
    expect(encrypted).not.toBe(originalSecret);

    const decrypted = decryptTotpSecret(encrypted);
    expect(decrypted).toBe(originalSecret);
  });

  it("generates exactly 8 recovery codes formatted as XXXXX-XXXXX", () => {
    const { plaintextCodes, hashes } = generateRecoveryCodes();
    expect(plaintextCodes).toHaveLength(8);
    expect(hashes).toHaveLength(8);

    for (const code of plaintextCodes) {
      expect(code).toMatch(/^[2-9A-Z]{5}-[2-9A-Z]{5}$/);
    }
  });

  it("normalizes recovery codes case-insensitively and ignores hyphens/spaces", () => {
    const raw = "23456-abcde";
    expect(normalizeRecoveryCode(raw)).toBe("23456ABCDE");
    expect(normalizeRecoveryCode("23456 abcde")).toBe("23456ABCDE");
    expect(hashRecoveryCode("23456-ABCDE")).toBe(hashRecoveryCode("23456abcde"));
  });

  it("consumes recovery code once and removes it from store", async () => {
    const { plaintextCodes, hashes } = generateRecoveryCodes();
    const store: AdminSecurityRow = {
      id: true,
      totp_secret_enc: "enc",
      totp_enabled_at: new Date().toISOString(),
      recovery_hashes: [...hashes],
      session_epoch: 1,
      last_totp_step: null,
      updated_at: new Date().toISOString(),
    };

    const mockAdmin: any = {
      from: (_table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: store, error: null }),
          }),
        }),
        update: (updates: Partial<AdminSecurityRow>) => ({
          eq: async () => {
            Object.assign(store, updates);
            return { error: null };
          },
        }),
      }),
    };

    const firstCode = plaintextCodes[0]!;

    // First use succeeds
    const firstTry = await verifyAndConsumeRecoveryCode(mockAdmin, firstCode);
    expect(firstTry).toBe(true);
    expect(store.recovery_hashes).toHaveLength(7);

    // Second use of the same code fails (single-use)
    const secondTry = await verifyAndConsumeRecoveryCode(mockAdmin, firstCode);
    expect(secondTry).toBe(false);
    expect(store.recovery_hashes).toHaveLength(7);

    // Invalid code fails
    const invalidTry = await verifyAndConsumeRecoveryCode(mockAdmin, "INVALID-CODE");
    expect(invalidTry).toBe(false);
  });

  it("bumps session epoch in database", async () => {
    const store: AdminSecurityRow = {
      id: true,
      totp_secret_enc: null,
      totp_enabled_at: null,
      recovery_hashes: [],
      session_epoch: 3,
      last_totp_step: null,
      updated_at: new Date().toISOString(),
    };

    const mockAdmin: any = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: store, error: null }),
          }),
        }),
        update: (updates: Partial<AdminSecurityRow>) => ({
          eq: async () => {
            Object.assign(store, updates);
            return { error: null };
          },
        }),
      }),
    };

    const newEpoch = await bumpSessionEpoch(mockAdmin);
    expect(newEpoch).toBe(4);
    expect(store.session_epoch).toBe(4);
  });

  it("regenerates recovery codes and replaces existing ones", async () => {
    const store: AdminSecurityRow = {
      id: true,
      totp_secret_enc: null,
      totp_enabled_at: null,
      recovery_hashes: ["old-hash-1", "old-hash-2"],
      session_epoch: 1,
      last_totp_step: null,
      updated_at: new Date().toISOString(),
    };

    const mockAdmin: any = {
      from: () => ({
        update: (updates: Partial<AdminSecurityRow>) => ({
          eq: async () => {
            Object.assign(store, updates);
            return { error: null };
          },
        }),
      }),
    };

    const newCodes = await regenerateRecoveryCodes(mockAdmin);
    expect(newCodes).toHaveLength(8);
    expect(store.recovery_hashes).toHaveLength(8);
    expect(store.recovery_hashes).not.toContain("old-hash-1");
  });
});
