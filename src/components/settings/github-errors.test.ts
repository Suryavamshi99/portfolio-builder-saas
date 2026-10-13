import { describe, it, expect } from "vitest";
import { getGitHubErrorMessage, GITHUB_ERROR_MESSAGES } from "./github-errors";

describe("github-errors", () => {
  it("maps known error codes correctly", () => {
    expect(getGitHubErrorMessage("not_your_installation")).toBe("That GitHub installation isn't yours");
    expect(getGitHubErrorMessage("invalid_state")).toBe(GITHUB_ERROR_MESSAGES["invalid_state"]);
    expect(getGitHubErrorMessage("invalid_installation")).toBe(GITHUB_ERROR_MESSAGES["invalid_installation"]);
    expect(getGitHubErrorMessage("installation_failed")).toBe(GITHUB_ERROR_MESSAGES["installation_failed"]);
    expect(getGitHubErrorMessage("save_failed")).toBe(GITHUB_ERROR_MESSAGES["save_failed"]);
  });

  it("handles unknown error codes with fallback", () => {
    expect(getGitHubErrorMessage("unknown_code")).toBe("Could not connect your GitHub account. Please try again.");
  });
});
