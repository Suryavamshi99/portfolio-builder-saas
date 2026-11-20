import { describe, expect, it } from "vitest";
import { canUseTemplates, canUseTemplatesById } from "./audience";

const ok = "2026-01-01T00:00:00Z";

describe("canUseTemplates", () => {
  it("allows a verified @mastersunion.org address, any case", () => {
    expect(canUseTemplates({ email: "a.b2027@mastersunion.org", email_confirmed_at: ok })).toBe(true);
    expect(canUseTemplates({ email: "  A.B@MastersUnion.ORG ", email_confirmed_at: ok })).toBe(true);
  });
  it("refuses an unverified address", () => {
    expect(canUseTemplates({ email: "a@mastersunion.org", email_confirmed_at: null })).toBe(false);
    expect(canUseTemplates({ email: "a@mastersunion.org" })).toBe(false);
  });
  it("refuses other domains, look-alikes and sub-domains", () => {
    for (const email of ["a@gmail.com", "a@mastersunion.org.evil.com", "a@evilmastersunion.org", "a@mail.mastersunion.org", "mastersunion.org", "a@mastersunion.org@x.com", "", null, undefined]) {
      expect(canUseTemplates({ email, email_confirmed_at: ok }), String(email)).toBe(false);
    }
    expect(canUseTemplates(null)).toBe(false);
  });
  it("lets an admin through", () => expect(canUseTemplates({ email: "o@gmail.com", email_confirmed_at: ok }, true)).toBe(true));
});

describe("canUseTemplatesById", () => {
  const admin = (user: unknown, boom = false) => ({ auth: { admin: { getUserById: async () => { if (boom) throw new Error("x"); return { data: { user } }; } } } }) as never;
  it("reads the account's email", async () => {
    expect(await canUseTemplatesById(admin({ email: "a@mastersunion.org", email_confirmed_at: ok }), "u")).toBe(true);
    expect(await canUseTemplatesById(admin({ email: "a@gmail.com", email_confirmed_at: ok }), "u")).toBe(false);
  });
  it("fails closed on an error", async () => expect(await canUseTemplatesById(admin(null, true), "u")).toBe(false));
});
