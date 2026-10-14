import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  adminApi,
  AdminApiError,
  validateReason,
  validateConfirmEmail,
  formatRelativeTime,
  formatExactTime,
  formatBytes,
  calculatePagination,
  formatErrorMessage,
} from "./admin-api";
import * as stepUpModule from "./admin-stepup";

describe("admin-api pure helpers", () => {
  describe("validateReason", () => {
    it("rejects empty or whitespace-only reason", () => {
      expect(validateReason("").valid).toBe(false);
      expect(validateReason("   ").valid).toBe(false);
      expect(validateReason("").error).toContain("Reason is required");
    });

    it("rejects reason with less than 3 characters", () => {
      expect(validateReason("ab").valid).toBe(false);
      expect(validateReason(" a ").valid).toBe(false);
    });

    it("rejects reason exceeding 300 characters", () => {
      const longReason = "a".repeat(301);
      expect(validateReason(longReason).valid).toBe(false);
      expect(validateReason(longReason).error).toContain("cannot exceed 300");
    });

    it("accepts valid reason between 3 and 300 characters", () => {
      expect(validateReason("Fix typo in headline").valid).toBe(true);
      expect(validateReason("a".repeat(300)).valid).toBe(true);
    });
  });

  describe("validateConfirmEmail", () => {
    it("returns true for matching emails ignoring case and whitespace", () => {
      expect(validateConfirmEmail("user@example.com", "user@example.com")).toBe(true);
      expect(validateConfirmEmail("User@Example.com", "user@example.com")).toBe(true);
      expect(validateConfirmEmail(" user@example.com ", "USER@EXAMPLE.COM")).toBe(true);
    });

    it("returns false for mismatching emails", () => {
      expect(validateConfirmEmail("user@example.com", "other@example.com")).toBe(false);
      expect(validateConfirmEmail("user@example.com", "")).toBe(false);
    });
  });

  describe("formatRelativeTime", () => {
    const fixedNow = new Date("2026-10-14T12:00:00Z");

    it("handles just now", () => {
      expect(formatRelativeTime("2026-10-14T11:59:45Z", fixedNow)).toBe("just now");
    });

    it("handles seconds ago", () => {
      expect(formatRelativeTime("2026-10-14T11:59:15Z", fixedNow)).toBe("45 seconds ago");
      expect(formatRelativeTime("2026-10-14T11:59:59Z", fixedNow)).toBe("just now");
    });

    it("handles minutes ago", () => {
      expect(formatRelativeTime("2026-10-14T11:55:00Z", fixedNow)).toBe("5 minutes ago");
      expect(formatRelativeTime("2026-10-14T11:59:00Z", fixedNow)).toBe("1 minute ago");
    });

    it("handles hours ago", () => {
      expect(formatRelativeTime("2026-10-14T09:00:00Z", fixedNow)).toBe("3 hours ago");
      expect(formatRelativeTime("2026-10-14T11:00:00Z", fixedNow)).toBe("1 hour ago");
    });

    it("handles days ago", () => {
      expect(formatRelativeTime("2026-10-10T12:00:00Z", fixedNow)).toBe("4 days ago");
      expect(formatRelativeTime("2026-10-13T12:00:00Z", fixedNow)).toBe("1 day ago");
    });

    it("handles months ago", () => {
      expect(formatRelativeTime("2026-08-14T12:00:00Z", fixedNow)).toBe("2 months ago");
    });

    it("handles years ago", () => {
      expect(formatRelativeTime("2024-10-14T12:00:00Z", fixedNow)).toBe("2 years ago");
    });

    it("handles invalid dates gracefully", () => {
      expect(formatRelativeTime("invalid-date-string", fixedNow)).toBe("recently");
    });
  });

  describe("formatExactTime", () => {
    it("formats valid date string", () => {
      const res = formatExactTime("2026-10-14T12:00:00Z");
      expect(res).toBeTruthy();
      expect(typeof res).toBe("string");
    });

    it("returns empty string for invalid date", () => {
      expect(formatExactTime("not-a-date")).toBe("");
    });
  });

  describe("formatBytes", () => {
    it("formats small byte counts", () => {
      expect(formatBytes(500)).toBe("500 B");
    });

    it("formats kilobytes", () => {
      expect(formatBytes(1024)).toBe("1.0 KB");
      expect(formatBytes(2048)).toBe("2.0 KB");
    });

    it("formats megabytes", () => {
      expect(formatBytes(1024 * 1024 * 4.5)).toBe("4.5 MB");
    });

    it("formats gigabytes", () => {
      expect(formatBytes(1024 * 1024 * 1024 * 2)).toBe("2.0 GB");
    });
  });

  describe("calculatePagination", () => {
    it("calculates first page accurately", () => {
      const p = calculatePagination(100, 1, 25);
      expect(p.page).toBe(1);
      expect(p.totalPages).toBe(4);
      expect(p.hasPrev).toBe(false);
      expect(p.hasNext).toBe(true);
      expect(p.startIndex).toBe(1);
      expect(p.endIndex).toBe(25);
    });

    it("calculates middle page", () => {
      const p = calculatePagination(100, 2, 25);
      expect(p.page).toBe(2);
      expect(p.hasPrev).toBe(true);
      expect(p.hasNext).toBe(true);
      expect(p.startIndex).toBe(26);
      expect(p.endIndex).toBe(50);
    });

    it("calculates last page with remainder", () => {
      const p = calculatePagination(32, 2, 25);
      expect(p.page).toBe(2);
      expect(p.totalPages).toBe(2);
      expect(p.hasPrev).toBe(true);
      expect(p.hasNext).toBe(false);
      expect(p.startIndex).toBe(26);
      expect(p.endIndex).toBe(32);
    });

    it("handles empty total", () => {
      const p = calculatePagination(0, 1, 25);
      expect(p.page).toBe(1);
      expect(p.totalPages).toBe(1);
      expect(p.hasPrev).toBe(false);
      expect(p.hasNext).toBe(false);
      expect(p.startIndex).toBe(0);
      expect(p.endIndex).toBe(0);
    });
  });

  describe("formatErrorMessage", () => {
    it("translates known backend codes to plain words", () => {
      expect(formatErrorMessage(new AdminApiError("Raw", 409, "last_admin"))).toContain(
        "Cannot delete or remove admin status from the last remaining administrator account"
      );
      expect(formatErrorMessage(new AdminApiError("Raw", 400, "confirm_mismatch"))).toContain(
        "confirmation email does not match"
      );
      expect(formatErrorMessage(new AdminApiError("Raw", 400, "reason_required"))).toContain(
        "A reason (3–300 characters) is required"
      );
      expect(formatErrorMessage(new AdminApiError("Raw", 403, "step_up_required"))).toContain(
        "Step-up verification required"
      );
      expect(formatErrorMessage(new AdminApiError("Raw", 409, "job_finished"))).toContain(
        "already finished and cannot be cancelled"
      );
      expect(formatErrorMessage(new AdminApiError("Raw", 404, "domain_not_found"))).toContain(
        "specified domain was not found"
      );
    });

    it("falls back to message on other errors", () => {
      expect(formatErrorMessage(new Error("Custom error"))).toBe("Custom error");
      expect(formatErrorMessage("string error")).toBe("An unexpected error occurred.");
    });
  });
});

describe("adminApi client with fetch mocking", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("getSession returns authenticated status", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ authenticated: true }),
    });

    const res = await adminApi.getSession();
    expect(res.authenticated).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/admin/session");
  });

  it("getSession returns authenticated: false on 401 without crashing", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: "unauthorized" } }),
    });

    const res = await adminApi.getSession();
    expect(res.authenticated).toBe(false);
  });

  it("getOverview returns data on 200", async () => {
    const mockOverview = {
      users: { total: 10, new7d: 2, pro: 3, admins: 1 },
      content: { portfolios: 8, versions: 15, uploadsBytes: 50000 },
      sites: { published: 5, unpublished: 3 },
      domains: { pending: 1, verified: 1, live: 2 },
      jobs: {
        last24h: { total: 20, done: 18, failed: 2, queued: 0, running: 0, bySource: { free: 15, gemini: 5, mcp: 0 } },
        topErrors: [],
        oldestQueuedRetryAt: null,
      },
      mcp: { activeConnections: 1 },
      freeProviders: [],
      payments: { enabled: true },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockOverview,
    });

    const data = await adminApi.getOverview();
    expect(data).toEqual(mockOverview);
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/admin/overview");
  });

  it("getOverview returns null on 404 (not deployed yet)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    });

    const data = await adminApi.getOverview();
    expect(data).toBeNull();
  });

  it("throws AdminApiError with isUnauthorized on 401", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: "session_expired" } }),
    });

    await expect(adminApi.getOverview()).rejects.toMatchObject({
      isUnauthorized: true,
      status: 401,
    });
  });

  it("getUsers builds query string and returns paginated result", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        users: [{ id: "u-1", email: "test@example.com", plan: "pro", isAdmin: false }],
        page: 2,
        pageSize: 25,
        total: 50,
      }),
    });

    const result = await adminApi.getUsers({
      query: "test",
      plan: "pro",
      admin: true,
      site: "published",
      page: 2,
      pageSize: 25,
    });

    expect(result).not.toBeNull();
    expect(result?.page).toBe(2);
    expect(result?.total).toBe(50);
    expect(result?.data).toHaveLength(1);

    const mockCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(mockCalls.length).toBeGreaterThan(0);
    const callArg = mockCalls[0]?.[0] as string;
    expect(callArg).toContain("query=test");
    expect(callArg).toContain("plan=pro");
    expect(callArg).toContain("admin=true");
    expect(callArg).toContain("site=published");
    expect(callArg).toContain("page=2");
    expect(callArg).toContain("pageSize=25");
  });

  it("getUserDetail calls user endpoint", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "user-123",
        email: "alice@example.com",
        plan: "free",
        isAdmin: false,
        uploads: [],
      }),
    });

    const detail = await adminApi.getUserDetail("user-123");
    expect(detail?.id).toBe("user-123");
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/admin/users/user-123");
  });

  it("destructive updateUser executes and passes JSON body with reason", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "user-1", plan: "pro" }),
    });

    const res = await adminApi.updateUser("user-1", {
      plan: "pro",
      reason: "Manual upgrade requested by user",
    });

    expect(res.id).toBe("user-1");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/admin/users/user-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ plan: "pro", reason: "Manual upgrade requested by user" }),
      })
    );
  });

  it("updateUser retries once after step-up if 403 step_up_required is returned", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 403,
          json: async () => ({ error: { code: "step_up_required", message: "Step up required" } }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: "user-1", plan: "pro" }),
      };
    });

    // Mock requestStepUp to succeed
    const spy = vi.spyOn(stepUpModule, "requestStepUp").mockResolvedValue(true);

    const res = await adminApi.updateUser("user-1", {
      plan: "pro",
      reason: "Needs pro plan",
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(callCount).toBe(2);
    expect(res.id).toBe("user-1");
  });

  it("updateUser throws step_up_required if step-up is cancelled", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { code: "step_up_required", message: "Step up required" } }),
    });

    vi.spyOn(stepUpModule, "requestStepUp").mockResolvedValue(false);

    await expect(
      adminApi.updateUser("user-1", {
        plan: "pro",
        reason: "Needs pro plan",
      })
    ).rejects.toMatchObject({
      isStepUpRequired: true,
      status: 403,
    });
  });

  it("deleteUser sends DELETE with reason and confirmEmail", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    const res = await adminApi.deleteUser("user-999", {
      reason: "User requested GDPR erasure",
      confirmEmail: "user@example.com",
    });

    expect(res.ok).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/admin/users/user-999",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({
          reason: "User requested GDPR erasure",
          confirmEmail: "user@example.com",
        }),
      })
    );
  });

  it("revokeUserMcp sends POST with reason", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, revokedClients: 3 }),
    });

    const res = await adminApi.revokeUserMcp("user-1", { reason: "Security incident" });
    expect(res.revokedClients).toBe(3);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/admin/users/user-1/revoke-mcp",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reason: "Security incident" }),
      })
    );
  });

  it("unpublishSite sends POST with reason", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    const res = await adminApi.unpublishSite("portfolio-alice", { reason: "Terms violation" });
    expect(res.ok).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/admin/sites/portfolio-alice/unpublish",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reason: "Terms violation" }),
      })
    );
  });

  it("removeDomain sends POST with hostname and reason", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    const res = await adminApi.removeDomain({ hostname: "alice.com", reason: "Expired domain" });
    expect(res.ok).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/admin/domains/remove",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ hostname: "alice.com", reason: "Expired domain" }),
      })
    );
  });

  it("cancelJob sends POST with reason", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    const res = await adminApi.cancelJob("job-101", { reason: "Stuck in queue" });
    expect(res.ok).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/admin/jobs/job-101/cancel",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reason: "Stuck in queue" }),
      })
    );
  });

  it("clearProviderCooldown sends POST with provider and reason", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    const res = await adminApi.clearProviderCooldown({
      provider: "openrouter-free",
      reason: "Manual budget reset",
    });

    expect(res.ok).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/admin/providers/clear-cooldown",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          provider: "openrouter-free",
          reason: "Manual budget reset",
        }),
      })
    );
  });

  it("getSystem returns system information and returns null on 404", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        commit: "abc1234567",
        appOrigin: "https://shipfolio.design",
        sitesBaseUrl: "https://*.shipfolio.design",
        payments: { enabled: true },
        settings: [{ name: "SUPABASE_URL", set: true }],
      }),
    });

    const sys = await adminApi.getSystem();
    expect(sys?.commit).toBe("abc1234567");

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    });
    const nullSys = await adminApi.getSystem();
    expect(nullSys).toBeNull();
  });
});
