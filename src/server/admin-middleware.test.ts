import { describe, expect, it } from "vitest";
import { isStepUpValid, requireStepUp } from "./admin-middleware";
import type { AdminSessionPayload } from "@/lib/admin/session";

describe("admin-middleware requireStepUp and session checks", () => {
  it("requireStepUp returns 403 step_up_required when stepUpUntil is missing", async () => {
    const session: AdminSessionPayload = {
      iat: Date.now(),
      exp: Date.now() + 8 * 3600 * 1000,
      seen: Date.now(),
      epoch: 1,
      stepUpUntil: null,
    };

    const res = requireStepUp(session);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(403);

    const body = await res?.json();
    expect(body).toEqual({
      error: { code: "step_up_required", message: "Step-up authentication required" },
    });
  });

  it("requireStepUp returns 403 when stepUpUntil is in the past", async () => {
    const now = Date.now();
    const session: AdminSessionPayload = {
      iat: now - 3600 * 1000,
      exp: now + 7 * 3600 * 1000,
      seen: now,
      epoch: 1,
      stepUpUntil: now - 1000, // expired 1s ago
    };

    const res = requireStepUp(session, now);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(403);
  });

  it("requireStepUp returns null (passes) when stepUpUntil is in the future", () => {
    const now = Date.now();
    const session: AdminSessionPayload = {
      iat: now,
      exp: now + 8 * 3600 * 1000,
      seen: now,
      epoch: 1,
      stepUpUntil: now + 300 * 1000, // 5 min future
    };

    const res = requireStepUp(session, now);
    expect(res).toBeNull();
  });

  it("requireStepUp handles context objects with adminSession property", () => {
    const now = Date.now();
    const validContext = {
      adminSession: {
        iat: now,
        exp: now + 8 * 3600 * 1000,
        seen: now,
        epoch: 1,
        stepUpUntil: now + 60 * 1000,
      },
    };
    expect(requireStepUp(validContext, now)).toBeNull();

    const invalidContext = {
      adminSession: {
        iat: now,
        exp: now + 8 * 3600 * 1000,
        seen: now,
        epoch: 1,
        stepUpUntil: null,
      },
    };
    expect(requireStepUp(invalidContext, now)?.status).toBe(403);
  });

  it("isStepUpValid accurately reflects current time window", () => {
    const now = Date.now();
    expect(isStepUpValid(null, now)).toBe(false);
    expect(isStepUpValid(undefined, now)).toBe(false);

    const validSession: AdminSessionPayload = {
      iat: now,
      exp: now + 3600 * 1000,
      seen: now,
      epoch: 1,
      stepUpUntil: now + 5000,
    };
    expect(isStepUpValid(validSession, now)).toBe(true);
    expect(isStepUpValid(validSession, now + 5001)).toBe(false);
  });
});
