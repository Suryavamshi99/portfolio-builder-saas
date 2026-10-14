import { describe, expect, it, beforeEach, vi } from "vitest";
import { hashPassword } from "@/lib/admin/password";
import {
  createAdminPendingToken,
  SESSION_TTL_MS,
  STEP_UP_TTL_MS,
} from "@/lib/admin/session";
import { generateTotpCodeForStep, getTotpStep } from "@/lib/admin/totp";
import {
  encryptTotpSecret,
  generateRecoveryCodes,
  type AdminSecurityRow,
} from "@/lib/admin/security-store";

// Mock Supabase admin client and react-start server helpers
const testUsername = "owner";
const testPassword = "correct-admin-password";
const testPasswordHash = hashPassword(testPassword);
const testSessionSecret = "route-test-session-secret-32chars!!";

let mockSecurityRow: AdminSecurityRow = {
  id: true,
  totp_secret_enc: null,
  totp_enabled_at: null,
  recovery_hashes: [],
  session_epoch: 1,
  last_totp_step: null,
  updated_at: new Date().toISOString(),
};

let mockAttempts: Array<{
  id: string;
  created_at: string;
  key_hash: string;
  stage: string;
  ok: boolean;
}> = [];

let mockAuditLog: Array<Record<string, unknown>> = [];
let mockRequestHeaders: Record<string, string> = {};
let mockResponseHeaders: Record<string, any> = {};

vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: (name: string) => mockRequestHeaders[name.toLowerCase()],
  setResponseHeader: (name: string, value: any) => {
    mockResponseHeaders[name.toLowerCase()] = value;
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: (table: string) => {
      if (table === "admin_security") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { ...mockSecurityRow }, error: null }),
            }),
          }),
          insert: (row: any) => ({
            select: () => ({
              single: async () => {
                Object.assign(mockSecurityRow, row);
                return { data: { ...mockSecurityRow }, error: null };
              },
            }),
          }),
          update: (updates: Partial<AdminSecurityRow>) => ({
            eq: async () => {
              Object.assign(mockSecurityRow, updates);
              return { error: null };
            },
          }),
          upsert: async (row: any) => {
            Object.assign(mockSecurityRow, row);
            return { error: null };
          },
        };
      }
      if (table === "admin_login_attempts") {
        return {
          select: () => ({
            eq: (_col1: string, keyHash: string) => ({
              eq: (_col2: string, stage: string) => ({
                eq: (_col3: string, ok: boolean) => ({
                  gte: () => ({
                    order: async () => {
                      const filtered = mockAttempts.filter(
                        (a) => a.key_hash === keyHash && a.stage === stage && a.ok === ok,
                      );
                      return { data: filtered, error: null };
                    },
                  }),
                }),
              }),
            }),
            order: () => ({
              limit: async (limit: number) => {
                const recent = [...mockAttempts].reverse().slice(0, limit);
                return { data: recent, error: null };
              },
            }),
          }),
          insert: async (row: any) => {
            mockAttempts.unshift({
              id: `attempt-${mockAttempts.length + 1}`,
              created_at: new Date().toISOString(),
              ...row,
            });
            return { error: null };
          },
        };
      }
      if (table === "admin_audit_log") {
        return {
          insert: async (row: any) => {
            mockAuditLog.push(row);
            return { error: null };
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

import { Route as LoginRoute } from "@/routes/api/admin/login";
import { Route as TotpLoginRoute } from "@/routes/api/admin/login.totp";
import { Route as EnrollStartRoute } from "@/routes/api/admin/2fa.enroll.start";
import { Route as EnrollConfirmRoute } from "@/routes/api/admin/2fa.enroll.confirm";
import { Route as SessionRoute } from "@/routes/api/admin/session";
import { Route as StepUpRoute } from "@/routes/api/admin/step-up";
import { Route as RecoveryRegenerateRoute } from "@/routes/api/admin/2fa.recovery.regenerate";
import { Route as LogoutRoute } from "@/routes/api/admin/logout";
import { Route as LogoutAllRoute } from "@/routes/api/admin/logout-all";
import { Route as SecurityRoute } from "@/routes/api/admin/security";

describe("Admin authentication API route contracts", () => {
  beforeEach(() => {
    process.env["ADMIN_USERNAME"] = testUsername;
    process.env["ADMIN_PASSWORD_HASH"] = testPasswordHash;
    process.env["ADMIN_SESSION_SECRET"] = testSessionSecret;
    process.env["ENCRYPTION_KEY"] = Buffer.alloc(32, 9).toString("base64");

    mockSecurityRow = {
      id: true,
      totp_secret_enc: null,
      totp_enabled_at: null,
      recovery_hashes: [],
      session_epoch: 1,
      last_totp_step: null,
      updated_at: new Date().toISOString(),
    };
    mockAttempts = [];
    mockAuditLog = [];
    mockRequestHeaders = {};
    mockResponseHeaders = {};
  });

  it("POST /login returns identical 401 invalid_credentials for wrong username or wrong password", async () => {
    const postLogin = (LoginRoute.options.server as any).handlers.POST;

    // Wrong username
    const resBadUser = await postLogin({
      request: new Request("http://localhost/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "wrong-user", password: testPassword }),
      }),
    });
    expect(resBadUser.status).toBe(401);
    const bodyBadUser = await resBadUser.json();
    expect(bodyBadUser).toEqual({ error: { code: "invalid_credentials", message: "Invalid credentials" } });

    // Wrong password
    const resBadPass = await postLogin({
      request: new Request("http://localhost/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: testUsername, password: "wrong-password" }),
      }),
    });
    expect(resBadPass.status).toBe(401);
    const bodyBadPass = await resBadPass.json();
    expect(bodyBadPass).toEqual({ error: { code: "invalid_credentials", message: "Invalid credentials" } });
  });

  it("POST /login returns step: 'enroll' when 2FA is not yet enrolled", async () => {
    const postLogin = (LoginRoute.options.server as any).handlers.POST;

    const res = await postLogin({
      request: new Request("http://localhost/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: testUsername, password: testPassword }),
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ step: "enroll" });
    // Pending cookie was set
    expect(mockResponseHeaders["set-cookie"]).toBeDefined();
    expect(mockResponseHeaders["set-cookie"]).toContain("admin_pending");
  });

  it("POST /login returns step: 'totp' when 2FA is enrolled", async () => {
    mockSecurityRow.totp_enabled_at = new Date().toISOString();
    mockSecurityRow.totp_secret_enc = encryptTotpSecret("JBSWY3DPEHPK3PXP");

    const postLogin = (LoginRoute.options.server as any).handlers.POST;

    const res = await postLogin({
      request: new Request("http://localhost/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: testUsername, password: testPassword }),
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ step: "totp" });
  });

  it("POST /2fa/enroll/start and confirm flow works end-to-end", async () => {
    const pendingToken = createAdminPendingToken(testUsername, testSessionSecret);
    mockRequestHeaders["cookie"] = `admin_pending=${pendingToken}`;

    const postStart = (EnrollStartRoute.options.server as any).handlers.POST;
    const startRes = await postStart({
      request: new Request("http://localhost/api/admin/2fa/enroll/start", { method: "POST" }),
    });
    expect(startRes.status).toBe(200);
    const startBody = await startRes.json();
    expect(startBody.secret).toBeDefined();
    expect(startBody.otpauthUri).toContain("otpauth://totp/Shipfolio%20Admin");

    // Generate valid TOTP code from generated secret
    const step = getTotpStep();
    const validCode = generateTotpCodeForStep(startBody.secret, step);

    const postConfirm = (EnrollConfirmRoute.options.server as any).handlers.POST;
    const confirmRes = await postConfirm({
      request: new Request("http://localhost/api/admin/2fa/enroll/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: validCode }),
      }),
    });
    expect(confirmRes.status).toBe(200);
    const confirmBody = await confirmRes.json();
    expect(confirmBody.recoveryCodes).toHaveLength(8);

    // Verify 2FA is now enabled in store
    expect(mockSecurityRow.totp_enabled_at).not.toBeNull();
    expect(mockSecurityRow.recovery_hashes).toHaveLength(8);
  });

  it("POST /2fa/enroll/confirm is refused once 2FA is enabled (it must not be a second login door)", async () => {
    const rawSecret = "JBSWY3DPEHPK3PXP";
    mockSecurityRow.totp_enabled_at = new Date().toISOString();
    mockSecurityRow.totp_secret_enc = encryptTotpSecret(rawSecret);
    mockRequestHeaders["cookie"] = `admin_pending=${createAdminPendingToken(testUsername, testSessionSecret)}`;

    const postConfirm = (EnrollConfirmRoute.options.server as any).handlers.POST;
    const res = await postConfirm({
      request: new Request("http://localhost/api/admin/2fa/enroll/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: generateTotpCodeForStep(rawSecret, getTotpStep()) }),
      }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("already_enrolled");
  });

  it("POST /login/totp accepts valid 6-digit TOTP code and prevents replay", async () => {
    const rawSecret = "JBSWY3DPEHPK3PXP";
    mockSecurityRow.totp_enabled_at = new Date().toISOString();
    mockSecurityRow.totp_secret_enc = encryptTotpSecret(rawSecret);

    const pendingToken = createAdminPendingToken(testUsername, testSessionSecret);
    mockRequestHeaders["cookie"] = `admin_pending=${pendingToken}`;

    const step = getTotpStep();
    const validCode = generateTotpCodeForStep(rawSecret, step);

    const postTotp = (TotpLoginRoute.options.server as any).handlers.POST;

    // First use: succeeds
    const res1 = await postTotp({
      request: new Request("http://localhost/api/admin/login/totp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: validCode }),
      }),
    });
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1).toEqual({ ok: true, usedRecovery: false });

    // Second use of the exact same code: fails (anti-replay check against last_totp_step)
    const res2 = await postTotp({
      request: new Request("http://localhost/api/admin/login/totp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: validCode }),
      }),
    });
    expect(res2.status).toBe(401);
    const body2 = await res2.json();
    expect(body2.error.code).toBe("invalid_code");
  });

  it("POST /login/totp accepts recovery code and marks single use", async () => {
    const { plaintextCodes, hashes } = generateRecoveryCodes();
    mockSecurityRow.totp_enabled_at = new Date().toISOString();
    mockSecurityRow.totp_secret_enc = encryptTotpSecret("JBSWY3DPEHPK3PXP");
    mockSecurityRow.recovery_hashes = [...hashes];

    const pendingToken = createAdminPendingToken(testUsername, testSessionSecret);
    mockRequestHeaders["cookie"] = `admin_pending=${pendingToken}`;

    const recoveryCode = plaintextCodes[0]!;
    const postTotp = (TotpLoginRoute.options.server as any).handlers.POST;

    // First use succeeds
    const res = await postTotp({
      request: new Request("http://localhost/api/admin/login/totp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: recoveryCode }),
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, usedRecovery: true });
    expect(mockSecurityRow.recovery_hashes).toHaveLength(7);

    // Reusing the same recovery code fails
    const resReuse = await postTotp({
      request: new Request("http://localhost/api/admin/login/totp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: recoveryCode }),
      }),
    });
    expect(resReuse.status).toBe(401);
  });

  it("GET /session returns session status and stepUp window", async () => {
    mockSecurityRow.totp_enabled_at = new Date().toISOString();
    const now = Date.now();
    const session = {
      iat: now,
      exp: now + SESSION_TTL_MS,
      seen: now,
      epoch: 1,
      stepUpUntil: now + STEP_UP_TTL_MS,
    };

    const getSession = (SessionRoute.options.server as any).handlers.GET;
    const res = await getSession({
      context: { adminSession: session },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(true);
    expect(body.twoFactor).toBe(true);
    expect(body.stepUpUntil).toBe(new Date(session.stepUpUntil).toISOString());
  });

  it("POST /step-up verifies password and TOTP, granting 5-minute step-up", async () => {
    const rawSecret = "JBSWY3DPEHPK3PXP";
    mockSecurityRow.totp_enabled_at = new Date().toISOString();
    mockSecurityRow.totp_secret_enc = encryptTotpSecret(rawSecret);

    const now = Date.now();
    const session = {
      iat: now,
      exp: now + SESSION_TTL_MS,
      seen: now,
      epoch: 1,
      stepUpUntil: null,
    };

    const step = getTotpStep();
    const validCode = generateTotpCodeForStep(rawSecret, step);

    const postStepUp = (StepUpRoute.options.server as any).handlers.POST;

    // Bad password
    const resBadPass = await postStepUp({
      request: new Request("http://localhost/api/admin/step-up", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "wrong", code: validCode }),
      }),
      context: { adminSession: session },
    });
    expect(resBadPass.status).toBe(401);

    // Bad code
    const resBadCode = await postStepUp({
      request: new Request("http://localhost/api/admin/step-up", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: testPassword, code: "000000" }),
      }),
      context: { adminSession: session },
    });
    expect(resBadCode.status).toBe(401);

    // Valid credentials + code
    const resOk = await postStepUp({
      request: new Request("http://localhost/api/admin/step-up", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: testPassword, code: validCode }),
      }),
      context: { adminSession: session },
    });
    expect(resOk.status).toBe(200);
    const bodyOk = await resOk.json();
    expect(bodyOk.ok).toBe(true);
    expect(bodyOk.stepUpUntil).toBeDefined();
  });

  it("POST /2fa/recovery/regenerate and POST /logout-all require step-up", async () => {
    const now = Date.now();
    const unsteppedSession = {
      iat: now,
      exp: now + SESSION_TTL_MS,
      seen: now,
      epoch: 1,
      stepUpUntil: null, // not stepped up
    };

    const postRegen = (RecoveryRegenerateRoute.options.server as any).handlers.POST;
    const resRegen = await postRegen({
      request: new Request("http://localhost/api/admin/2fa/recovery/regenerate", { method: "POST" }),
      context: { adminSession: unsteppedSession },
    });
    expect(resRegen.status).toBe(403);
    expect((await resRegen.json()).error.code).toBe("step_up_required");

    const postLogoutAll = (LogoutAllRoute.options.server as any).handlers.POST;
    const resLogoutAll = await postLogoutAll({
      request: new Request("http://localhost/api/admin/logout-all", { method: "POST" }),
      context: { adminSession: unsteppedSession },
    });
    expect(resLogoutAll.status).toBe(403);
    expect((await resLogoutAll.json()).error.code).toBe("step_up_required");
  });

  it("POST /logout-all with step-up bumps epoch and clears cookies", async () => {
    const now = Date.now();
    const steppedSession = {
      iat: now,
      exp: now + SESSION_TTL_MS,
      seen: now,
      epoch: 1,
      stepUpUntil: now + 5 * 60 * 1000,
    };

    const postLogoutAll = (LogoutAllRoute.options.server as any).handlers.POST;
    const res = await postLogoutAll({
      request: new Request("http://localhost/api/admin/logout-all", { method: "POST" }),
      context: { adminSession: steppedSession },
    });
    expect(res.status).toBe(200);
    expect(mockSecurityRow.session_epoch).toBe(2);
    expect(mockResponseHeaders["set-cookie"]).toBeDefined();
  });

  it("POST /logout clears cookies", async () => {
    const postLogout = (LogoutRoute.options.server as any).handlers.POST;
    const res = await postLogout({
      request: new Request("http://localhost/api/admin/logout", { method: "POST" }),
    });
    expect(res.status).toBe(200);
    expect(mockResponseHeaders["set-cookie"]).toBeDefined();
  });

  it("GET /security returns status and recent attempts without exposing IP or secrets", async () => {
    mockSecurityRow.totp_enabled_at = new Date().toISOString();
    mockSecurityRow.recovery_hashes = ["h1", "h2"];
    mockAttempts = [
      {
        id: "1",
        created_at: new Date().toISOString(),
        key_hash: "secret-hash",
        stage: "password",
        ok: true,
      },
    ];

    const getSecurity = (SecurityRoute.options.server as any).handlers.GET;
    const res = await getSecurity();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.twoFactorEnabledAt).toBe(mockSecurityRow.totp_enabled_at);
    expect(body.recoveryCodesLeft).toBe(2);
    expect(body.recentAttempts).toHaveLength(1);
    expect(body.recentAttempts[0]).toEqual({
      createdAt: mockAttempts[0]!.created_at,
      stage: "password",
      ok: true,
    });
    // Ensure no IP or raw key hash leaked
    expect(body.recentAttempts[0]).not.toHaveProperty("ip");
    expect(body.recentAttempts[0]).not.toHaveProperty("key_hash");
  });

  it("audits all events without passwords, codes, or secrets in audit detail", async () => {
    for (const entry of mockAuditLog) {
      const detail = entry["detail"];
      if (detail && typeof detail === "object") {
        for (const k of Object.keys(detail as Record<string, unknown>)) {
          expect(k).not.toMatch(/password|secret|token|key|html/i);
        }
      }
    }
  });
});
