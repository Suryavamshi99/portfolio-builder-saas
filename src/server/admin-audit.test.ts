import { describe, expect, it, beforeEach } from "vitest";
import { computeActorHash, logAdminAction, sanitizeAuditDetail } from "./admin-audit";

describe("admin-audit helper and secret redaction", () => {
  beforeEach(() => {
    process.env["ADMIN_USERNAME"] = "test-admin";
    process.env["ADMIN_PASSWORD_HASH"] = "scrypt:dummy:dummy";
    process.env["ADMIN_SESSION_SECRET"] = "audit-session-secret-1234567890";
  });

  it("computes 16-character actor_hash from clientIp and ADMIN_SESSION_SECRET", () => {
    const hash = computeActorHash("1.2.3.4", "audit-session-secret-1234567890");
    expect(hash).toHaveLength(16);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);

    const emptyIpHash = computeActorHash("", "audit-session-secret-1234567890");
    expect(emptyIpHash).toHaveLength(16);
  });

  it("strips keys matching password|secret|token|key|html case-insensitively", () => {
    const rawDetail = {
      user: "alice",
      from: "free",
      to: "pro",
      password: "plaintext-password",
      totpSecret: "secret-data",
      api_key: "api-key-123",
      mcpToken: "oauth-token",
      generated_html: "<p>unsafe</p>",
      nestedSafe: 123,
    };

    const sanitized = sanitizeAuditDetail(rawDetail);

    expect(sanitized).toEqual({
      user: "alice",
      from: "free",
      to: "pro",
      nestedSafe: 123,
    });
    expect(sanitized).not.toHaveProperty("password");
    expect(sanitized).not.toHaveProperty("totpSecret");
    expect(sanitized).not.toHaveProperty("api_key");
    expect(sanitized).not.toHaveProperty("mcpToken");
    expect(sanitized).not.toHaveProperty("generated_html");
  });

  it("never throws if audit insert fails", async () => {
    const mockAdmin: any = {
      from: () => ({
        insert: async () => {
          throw new Error("Database connection dropped");
        },
      }),
    };

    await expect(
      logAdminAction(mockAdmin, {
        action: "admin.login_fail",
        targetType: "system",
      }),
    ).resolves.not.toThrow();
  });
});
