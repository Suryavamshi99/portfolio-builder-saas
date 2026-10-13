import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatRelativeDate } from "./date";

describe("formatRelativeDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns just now for very recent dates", () => {
    expect(formatRelativeDate("2026-10-13T11:59:45Z")).toBe("just now");
    expect(formatRelativeDate(new Date("2026-10-13T12:00:10Z"))).toBe("just now");
  });

  it("returns seconds ago", () => {
    expect(formatRelativeDate("2026-10-13T11:59:15Z")).toBe("45 seconds ago");
  });

  it("returns minutes ago", () => {
    expect(formatRelativeDate("2026-10-13T11:55:00Z")).toBe("5 minutes ago");
    expect(formatRelativeDate("2026-10-13T11:59:00Z")).toBe("1 minute ago");
  });

  it("returns hours ago", () => {
    expect(formatRelativeDate("2026-10-13T10:00:00Z")).toBe("2 hours ago");
    expect(formatRelativeDate("2026-10-13T11:00:00Z")).toBe("1 hour ago");
  });

  it("returns days ago", () => {
    expect(formatRelativeDate("2026-10-10T12:00:00Z")).toBe("3 days ago");
    expect(formatRelativeDate("2026-10-12T12:00:00Z")).toBe("1 day ago");
  });

  it("returns months ago", () => {
    expect(formatRelativeDate("2026-08-13T12:00:00Z")).toBe("2 months ago");
  });

  it("returns years ago", () => {
    expect(formatRelativeDate("2024-10-13T12:00:00Z")).toBe("2 years ago");
  });

  it("handles invalid dates gracefully", () => {
    expect(formatRelativeDate("invalid-date")).toBe("recently");
  });
});
