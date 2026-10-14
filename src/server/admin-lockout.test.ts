import { describe, expect, it, beforeEach } from "vitest";
import {
  checkAdminLockout,
  checkAdminLoginRateLimit,
  computeAdminKeyHash,
  recordAdminAttempt,
  resetAdminLoginRateLimit,
} from "./admin-rate-limit";

describe("Admin lockout and rate limiting", () => {
  const sessionSecret = "test-session-secret-key-12345";
  const clientIp = "192.168.1.100";
  const username = "admin";
  const keyHash = computeAdminKeyHash(clientIp, username, sessionSecret);

  beforeEach(() => {
    resetAdminLoginRateLimit();
  });

  it("computes key hash via sha256 without raw IP or username", () => {
    const hash = computeAdminKeyHash("1.2.3.4", "myUser", "secret");
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain("1.2.3.4");
    expect(hash).not.toContain("myUser");
    expect(hash).not.toContain("secret");
  });

  it("does not lock when failures < 5", async () => {
    const now = Date.now();
    const attempts = [
      { created_at: new Date(now - 1000).toISOString() },
      { created_at: new Date(now - 2000).toISOString() },
      { created_at: new Date(now - 3000).toISOString() },
      { created_at: new Date(now - 4000).toISOString() },
    ];

    const mockAdmin: any = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                gte: () => ({
                  order: async () => ({ data: attempts, error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
    };

    const res = await checkAdminLockout(mockAdmin, keyHash, "password", now);
    expect(res.locked).toBe(false);
    expect(res.failureCount).toBe(4);
  });

  it("locks with 1 min backoff when failures reach 5 to 7", async () => {
    const now = Date.now();
    const attempts = Array.from({ length: 5 }, (_, i) => ({
      created_at: new Date(now - i * 1000).toISOString(),
    }));

    const mockAdmin: any = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                gte: () => ({
                  order: async () => ({ data: attempts, error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
    };

    const res = await checkAdminLockout(mockAdmin, keyHash, "password", now);
    expect(res.locked).toBe(true);
    expect(res.failureCount).toBe(5);
    // 60 seconds backoff minus ~0 seconds elapsed
    expect(res.retryAfterSeconds).toBe(60);
  });

  it("locks with 5 min backoff when failures reach 8 to 10", async () => {
    const now = Date.now();
    const attempts = Array.from({ length: 8 }, (_, i) => ({
      created_at: new Date(now - i * 1000).toISOString(),
    }));

    const mockAdmin: any = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                gte: () => ({
                  order: async () => ({ data: attempts, error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
    };

    const res = await checkAdminLockout(mockAdmin, keyHash, "password", now);
    expect(res.locked).toBe(true);
    expect(res.failureCount).toBe(8);
    // 300 seconds backoff
    expect(res.retryAfterSeconds).toBe(300);
  });

  it("locks with 15 min backoff when failures reach 11+", async () => {
    const now = Date.now();
    const attempts = Array.from({ length: 11 }, (_, i) => ({
      created_at: new Date(now - i * 1000).toISOString(),
    }));

    const mockAdmin: any = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                gte: () => ({
                  order: async () => ({ data: attempts, error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
    };

    const res = await checkAdminLockout(mockAdmin, keyHash, "password", now);
    expect(res.locked).toBe(true);
    expect(res.failureCount).toBe(11);
    // 900 seconds backoff
    expect(res.retryAfterSeconds).toBe(900);
  });

  it("unlocks once the backoff duration has elapsed", async () => {
    const now = Date.now();
    // 5 failures, but last failure was 65 seconds ago (backoff for 5 fails is 60s)
    const attempts = Array.from({ length: 5 }, (_, i) => ({
      created_at: new Date(now - (65 + i) * 1000).toISOString(),
    }));

    const mockAdmin: any = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                gte: () => ({
                  order: async () => ({ data: attempts, error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
    };

    const res = await checkAdminLockout(mockAdmin, keyHash, "password", now);
    expect(res.locked).toBe(false);
  });

  it("counts password and totp stage failures separately", async () => {
    const attempts: Record<string, any[]> = {
      password: Array.from({ length: 5 }, () => ({ created_at: new Date().toISOString() })),
      totp: [{ created_at: new Date().toISOString() }],
    };

    const mockAdmin: any = {
      from: () => ({
        select: () => ({
          eq: (_col1: string, _val1: string) => ({
            eq: (_col2: string, stage: "password" | "totp") => ({
              eq: () => ({
                gte: () => ({
                  order: async () => ({ data: attempts[stage], error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
    };

    // Password stage is locked
    const passwordRes = await checkAdminLockout(mockAdmin, keyHash, "password");
    expect(passwordRes.locked).toBe(true);

    // TOTP stage is not locked
    const totpRes = await checkAdminLockout(mockAdmin, keyHash, "totp");
    expect(totpRes.locked).toBe(false);
  });

  it("in-memory IP rate limiter limits after MAX_ATTEMPTS", () => {
    for (let i = 0; i < 8; i++) {
      expect(checkAdminLoginRateLimit("ip-1").limited).toBe(false);
    }
    // 9th attempt
    const limitedRes = checkAdminLoginRateLimit("ip-1");
    expect(limitedRes.limited).toBe(true);
    expect(limitedRes.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("recordAdminAttempt inserts attempt record without throwing", async () => {
    const inserted: any[] = [];
    const mockAdmin: any = {
      from: () => ({
        insert: async (row: any) => {
          inserted.push(row);
          return { error: null };
        },
      }),
    };

    await recordAdminAttempt(mockAdmin, keyHash, "password", false);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toEqual({
      key_hash: keyHash,
      stage: "password",
      ok: false,
    });
  });
});
