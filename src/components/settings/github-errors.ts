export const GITHUB_ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "That GitHub connection link expired or was invalid — please try connecting again.",
  invalid_installation: "Invalid GitHub App installation details.",
  not_your_installation: "That GitHub installation isn't yours",
  installation_failed: "GitHub installation could not be verified. Please try again.",
  save_failed: "Connected to GitHub, but we couldn't save it — please try again.",
};

export function getGitHubErrorMessage(code: string): string {
  return GITHUB_ERROR_MESSAGES[code] ?? "Could not connect your GitHub account. Please try again.";
}
