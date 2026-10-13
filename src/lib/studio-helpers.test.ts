import { describe, it, expect } from "vitest";
import {
  sanitizeSlug,
  getSlugFeedback,
  isJobTerminal,
  shouldContinuePollingJob,
} from "./studio-helpers";

describe("studio-helpers", () => {
  describe("sanitizeSlug", () => {
    it("converts spaces, special characters and trims dashes", () => {
      expect(sanitizeSlug("Jane Doe! 2026")).toBe("jane-doe-2026");
      expect(sanitizeSlug("---hello---world---")).toBe("hello-world");
      expect(sanitizeSlug("John_Doe_Dev")).toBe("john-doe-dev");
      expect(sanitizeSlug("my.site.portfolio")).toBe("my-site-portfolio");
    });
  });

  describe("getSlugFeedback", () => {
    it("returns correct variant and canPublish for each state", () => {
      expect(getSlugFeedback("available")).toEqual({
        message: "Available! Your address will be locked on publish.",
        variant: "available",
        canPublish: true,
      });

      expect(getSlugFeedback("yours")).toEqual({
        message: "This is already your site address.",
        variant: "available",
        canPublish: true,
      });

      expect(getSlugFeedback("taken")).toEqual({
        message: "That name is already taken. Please choose another.",
        variant: "unavailable",
        canPublish: false,
      });

      expect(getSlugFeedback("reserved")).toEqual({
        message: "That name is reserved. Please choose another.",
        variant: "unavailable",
        canPublish: false,
      });

      expect(getSlugFeedback("invalid")).toEqual({
        message: "Not allowed. Use 3–40 lowercase letters, numbers, or hyphens.",
        variant: "error",
        canPublish: false,
      });

      expect(getSlugFeedback("checking")).toEqual({
        message: "Checking availability…",
        variant: "checking",
        canPublish: false,
      });

      expect(getSlugFeedback("too_short")).toEqual({
        message: "Subdomain must be at least 3 characters",
        variant: "unavailable",
        canPublish: false,
      });
    });
  });

  describe("isJobTerminal", () => {
    it("identifies done and failed as terminal", () => {
      expect(isJobTerminal("done")).toBe(true);
      expect(isJobTerminal("failed")).toBe(true);
      expect(isJobTerminal("queued")).toBe(false);
      expect(isJobTerminal("reading")).toBe(false);
      expect(isJobTerminal("writing")).toBe(false);
      expect(isJobTerminal("checking")).toBe(false);
      expect(isJobTerminal("saving")).toBe(false);
    });
  });

  describe("shouldContinuePollingJob", () => {
    it("continues while active and within timeout", () => {
      const res = shouldContinuePollingJob({
        status: "writing",
        elapsedMs: 5000,
        maxTimeoutMs: 60000,
      });
      expect(res).toEqual({ shouldContinue: true, isTimedOut: false });
    });

    it("stops on terminal state without timeout", () => {
      expect(
        shouldContinuePollingJob({
          status: "done",
          elapsedMs: 5000,
          maxTimeoutMs: 60000,
        })
      ).toEqual({ shouldContinue: false, isTimedOut: false });

      expect(
        shouldContinuePollingJob({
          status: "failed",
          elapsedMs: 5000,
          maxTimeoutMs: 60000,
        })
      ).toEqual({ shouldContinue: false, isTimedOut: false });
    });

    it("stops on timeout with isTimedOut true", () => {
      expect(
        shouldContinuePollingJob({
          status: "reading",
          elapsedMs: 600000, // 10 mins
          maxTimeoutMs: 600000,
        })
      ).toEqual({ shouldContinue: false, isTimedOut: true });
    });
  });
});
