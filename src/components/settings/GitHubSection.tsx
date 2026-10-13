import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { apiClient, type GitHubStatusResponse } from "@/lib/api-client";
import { getGitHubErrorMessage } from "./github-errors";
import { Github, CheckCircle2, Loader2, ExternalLink, RefreshCw, AlertCircle } from "lucide-react";

export function GitHubSection() {
  const [loading, setLoading] = React.useState(true);
  const [comingSoon, setComingSoon] = React.useState(false);
  const [githubStatus, setGithubStatus] = React.useState<GitHubStatusResponse | null>(null);
  const [banner, setBanner] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  // Read search params for ?github=connected or ?github_error=<code>
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const githubParam = params.get("github");
    const githubErrorParam = params.get("github_error");

    if (githubParam === "connected") {
      setBanner({
        type: "success",
        message: "Successfully connected to GitHub!",
      });
      params.delete("github");
      const query = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (query ? `?${query}` : ""));
    } else if (githubErrorParam) {
      setBanner({
        type: "error",
        message: getGitHubErrorMessage(githubErrorParam),
      });
      params.delete("github_error");
      const query = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (query ? `?${query}` : ""));
    }
  }, []);

  const fetchStatus = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.getGitHubStatus();
      setGithubStatus(data);
      setComingSoon(false);
    } catch (err: unknown) {
      if ((err as { isNotFound?: boolean })?.isNotFound) {
        setComingSoon(true);
      } else {
        // Only set banner if not already set by URL params
        setBanner((prev) =>
          prev ?? {
            type: "error",
            message: err instanceof Error ? err.message : "Failed to load GitHub status.",
          }
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const isConnected = githubStatus?.connected === true && !!githubStatus.account;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Github className="size-4 text-foreground" />
            GitHub Integration
          </CardTitle>
          {loading ? (
            <Badge variant="outline" className="text-[10px]">
              Checking…
            </Badge>
          ) : comingSoon ? (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              Coming soon
            </Badge>
          ) : isConnected ? (
            <Badge variant="success" className="gap-1 text-[10px]">
              <CheckCircle2 className="size-3" />
              Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              Not connected
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          Connect your GitHub account to push portfolio source code directly to your repositories.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {banner && (
          <Alert variant={banner.type === "success" ? "success" : "destructive"}>
            {banner.type === "success" ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <AlertCircle className="size-4" />
            )}
            <AlertTitle>{banner.type === "success" ? "Connected" : "GitHub Error"}</AlertTitle>
            <AlertDescription>{banner.message}</AlertDescription>
          </Alert>
        )}

        {comingSoon ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Coming soon</p>
            <p>The GitHub integration endpoint is rolling out soon.</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
            <Loader2 className="size-4 animate-spin text-accent" />
            <span>Checking GitHub connection…</span>
          </div>
        ) : isConnected ? (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-muted-foreground">Connected as </span>
                <span className="font-semibold text-foreground">@{githubStatus?.account}</span>
              </div>
              {githubStatus?.installUrl && (
                <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs self-start sm:self-auto">
                  <a href={githubStatus.installUrl} target="_blank" rel="noreferrer">
                    Configure App
                    <ExternalLink className="size-3" />
                  </a>
                </Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground border-t border-border pt-2.5">
              Shipfolio can commit and push directly to your selected repositories when you export.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted text-foreground">
              <Github className="size-5" />
            </div>
            <div className="space-y-1 max-w-sm">
              <p className="text-xs font-semibold text-foreground">No GitHub Account Connected</p>
              <p className="text-xs text-muted-foreground">
                Install the Shipfolio GitHub App to export your portfolio code and version history directly to your repos.
              </p>
            </div>
            {githubStatus?.installUrl ? (
              <Button asChild className="gap-2 text-xs">
                <a href={githubStatus.installUrl} target="_blank" rel="noreferrer">
                  <Github className="size-4" />
                  Connect GitHub
                  <ExternalLink className="size-3" />
                </a>
              </Button>
            ) : (
              <Button disabled variant="outline" size="sm" className="text-xs">
                Install URL unavailable
              </Button>
            )}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void fetchStatus()}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
