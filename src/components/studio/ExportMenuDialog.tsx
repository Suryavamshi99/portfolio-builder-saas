import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Download,
  FileCode,
  Copy,
  Check,
  Github,
  Globe,
  Loader2,
  ExternalLink,
  Lock,
  Sparkles,
} from "lucide-react";
import { apiClient, type GitHubStatusResponse } from "@/lib/api-client";
import { usePricing } from "@/lib/use-pricing";
import { OfferSummary } from "@/components/billing/OfferSummary";

interface ExportMenuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasPaidAccess: boolean;
  onUpgradeRequired: () => void;
  onDownloadZip: () => Promise<void>;
  onDownloadHtml: () => Promise<void>;
  onCopyHtml: () => Promise<void>;
  downloadingZip: boolean;
  downloadingHtml: boolean;
  copiedHtml: boolean;
  onConnectVercel: () => void;
  vercelConnected: boolean;
  vercelUsername?: string | undefined;
}

export function ExportMenuDialog({
  open,
  onOpenChange,
  hasPaidAccess,
  onUpgradeRequired,
  onDownloadZip,
  onDownloadHtml,
  onCopyHtml,
  downloadingZip,
  downloadingHtml,
  copiedHtml,
  onConnectVercel,
  vercelConnected,
  vercelUsername,
}: ExportMenuDialogProps) {
  const pricing = usePricing();
  // GitHub push state
  const [githubStatus, setGithubStatus] = React.useState<GitHubStatusResponse | null>(null);
  const [loadingGithub, setLoadingGithub] = React.useState(false);
  const [githubRepo, setGithubRepo] = React.useState("");
  const [pushingGithub, setPushingGithub] = React.useState(false);
  const [githubCommitUrl, setGithubCommitUrl] = React.useState<string | null>(null);
  const [githubError, setGithubError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setLoadingGithub(true);
      setGithubError(null);
      void apiClient
        .getGitHubStatus()
        .then((status) => setGithubStatus(status))
        .catch((err: unknown) => {
          if ((err as { isNotFound?: boolean })?.isNotFound) {
            setGithubStatus({ connected: false });
          }
        })
        .finally(() => setLoadingGithub(false));
    }
  }, [open]);

  const handlePushGitHub = async () => {
    if (!hasPaidAccess) {
      onOpenChange(false);
      onUpgradeRequired();
      return;
    }

    const trimmed = githubRepo.trim();
    if (!trimmed) {
      setGithubError("Please enter a repository in owner/repo format.");
      return;
    }

    setPushingGithub(true);
    setGithubError(null);
    setGithubCommitUrl(null);

    try {
      const res = await apiClient.exportToGitHub({ repo: trimmed });
      setGithubCommitUrl(res.commitUrl);
    } catch (err: unknown) {
      if ((err as { status?: number })?.status === 402) {
        onOpenChange(false);
        onUpgradeRequired();
        return;
      }
      if ((err as { isNotFound?: boolean })?.isNotFound) {
        setGithubError("GitHub export endpoint is coming soon.");
        return;
      }
      setGithubError(err instanceof Error ? err.message : "Failed to push to GitHub.");
    } finally {
      setPushingGithub(false);
    }
  };

  const handleAction = async (fn: () => Promise<void>) => {
    if (!hasPaidAccess) {
      onOpenChange(false);
      onUpgradeRequired();
      return;
    }
    await fn();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="size-5 text-accent" />
            Export & Deploy Your Portfolio
          </DialogTitle>
          <DialogDescription className="text-xs">
            Download your portfolio code, copy raw HTML, push to GitHub, or deploy directly to your Vercel account.
          </DialogDescription>
        </DialogHeader>

        {!hasPaidAccess && <OfferSummary compact />}
        {!hasPaidAccess && (
          <Alert className="border-accent/40 bg-accent/5 py-2.5">
            <Sparkles className="size-4 text-accent" />
            <AlertTitle className="text-xs font-semibold">Pro Feature</AlertTitle>
            <AlertDescription className="text-xs flex items-center justify-between gap-2">
              <span>Download clean HTML, push to GitHub or deploy anywhere.</span>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onUpgradeRequired();
                }}
                className="h-7 shrink-0 gap-1.5 bg-accent text-xs font-semibold text-accent-foreground hover:bg-accent/90"
              >
                Unlock · {pricing.today}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 py-2">
          {/* Quick downloads & copy */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleAction(onDownloadZip)}
              disabled={downloadingZip}
              className="flex sm:flex-col items-center justify-start sm:justify-center h-12 sm:h-20 gap-2 sm:gap-1.5 p-3 sm:p-2 text-left sm:text-center"
            >
              {downloadingZip ? (
                <Loader2 className="size-4 animate-spin text-accent shrink-0" />
              ) : !hasPaidAccess ? (
                <Lock className="size-4 text-muted-foreground shrink-0" />
              ) : (
                <Download className="size-4 text-accent shrink-0" />
              )}
              <div className="flex flex-col sm:items-center">
                <span className="text-xs font-semibold">Download Zip</span>
                <span className="text-[10px] text-muted-foreground">Bundled assets</span>
              </div>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => void handleAction(onDownloadHtml)}
              disabled={downloadingHtml}
              className="flex sm:flex-col items-center justify-start sm:justify-center h-12 sm:h-20 gap-2 sm:gap-1.5 p-3 sm:p-2 text-left sm:text-center"
            >
              {downloadingHtml ? (
                <Loader2 className="size-4 animate-spin text-accent shrink-0" />
              ) : !hasPaidAccess ? (
                <Lock className="size-4 text-muted-foreground shrink-0" />
              ) : (
                <FileCode className="size-4 text-accent shrink-0" />
              )}
              <div className="flex flex-col sm:items-center">
                <span className="text-xs font-semibold">Download HTML</span>
                <span className="text-[10px] text-muted-foreground">Single file</span>
              </div>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => void onCopyHtml()}
              className="flex sm:flex-col items-center justify-start sm:justify-center h-12 sm:h-20 gap-2 sm:gap-1.5 p-3 sm:p-2 text-left sm:text-center"
            >
              {copiedHtml ? (
                <Check className="size-4 text-success shrink-0" />
              ) : (
                <Copy className="size-4 text-accent shrink-0" />
              )}
              <div className="flex flex-col sm:items-center">
                <span className="text-xs font-semibold">{copiedHtml ? "Copied!" : "Copy HTML"}</span>
                <span className="text-[10px] text-muted-foreground">To clipboard</span>
              </div>
            </Button>
          </div>

          {/* GitHub Push section */}
          <div className="rounded-xl border border-border p-3.5 space-y-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Github className="size-4" />
                <span className="text-xs font-semibold">Push to GitHub</span>
              </div>
              {loadingGithub ? (
                <span className="text-[10px] text-muted-foreground">Checking…</span>
              ) : githubStatus?.connected ? (
                <span className="text-[10px] text-success font-medium">
                  @{githubStatus.account || "connected"}
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground">Not connected</span>
              )}
            </div>

            {!githubStatus?.connected ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Connect Shipfolio's GitHub App to export commits directly to your repos.
                </p>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs shrink-0"
                >
                  <a
                    href={githubStatus?.installUrl || "https://github.com/apps"}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Connect <ExternalLink className="size-3" />
                  </a>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="owner/repo-name"
                    value={githubRepo}
                    onChange={(e) => setGithubRepo(e.target.value)}
                    disabled={pushingGithub}
                    className="h-8 text-xs font-mono bg-background/60"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handlePushGitHub()}
                    disabled={pushingGithub}
                    className="h-8 gap-1.5 bg-accent text-accent-foreground text-xs shrink-0"
                  >
                    {pushingGithub ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Github className="size-3" />
                    )}
                    Push
                  </Button>
                </div>
                {githubCommitUrl && (
                  <div className="flex items-center gap-1.5 text-xs text-success">
                    <Check className="size-3.5" />
                    <span>Pushed! </span>
                    <a
                      href={githubCommitUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline font-mono inline-flex items-center gap-1"
                    >
                      View commit <ExternalLink className="size-3" />
                    </a>
                  </div>
                )}
                {githubError && (
                  <p className="text-[11px] text-destructive">{githubError}</p>
                )}
              </div>
            )}
          </div>

          {/* Vercel Deploy section */}
          <div className="rounded-xl border border-border p-3.5 space-y-2 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="size-4" />
                <span className="text-xs font-semibold">Deploy to my own Vercel</span>
              </div>
              {vercelConnected ? (
                <span className="text-[10px] text-success font-medium">
                  @{vercelUsername || "connected"}
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground">Not connected</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Publish directly to your own personal or team Vercel project via OAuth.
            </p>
            {!vercelConnected && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onConnectVercel}
                className="h-8 gap-1.5 text-xs"
              >
                Connect Vercel
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
