import { afterEach, describe, expect, it, vi } from "vitest";

import { isDemoPaymentUser, usesDummyCheckout } from "@/config/payment-test";

afterEach(() => vi.unstubAllEnvs());

describe("demo payment user", () => {
  it("is off when the variable is unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isDemoPaymentUser("u1")).toBe(false);
    expect(usesDummyCheckout("u1")).toBe(false);
  });

  it("matches only the configured user, even in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO_PAYMENT_USER_ID", "u1");
    expect(usesDummyCheckout("u1")).toBe(true);
    expect(usesDummyCheckout("u2")).toBe(false);
  });
});
