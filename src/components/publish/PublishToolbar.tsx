import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Globe,
  UploadCloud,
  CheckCircle2,
  ExternalLink,
  Loader2,
  AlertCircle,
  Clock,
  Sparkles,
  Link2,
} from "lucide-react";

interface PublishToolbarProps {
  onPublishStarted?: () => void;
  className?: string;
}

interface VercelStatus {
  connected: boolean;
  vercelUsername?: string;
  connectedAt?: string;
}

type DeployStatus = "idle" | "queued" | "building" | "ready" | "error";

interface PublishStatusResponse {
  deploymentId: string;
  status: "queued" | "building" | "ready" | "error";
  url?: string;
  finishedAt?: string;
}

export function PublishToolbar({ onPublishStarted, className }: PublishToolbarProps) {
  const [vercelStatus, setVercelStatus] = React.useState<VercelStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = React.useState(true);

  // Deployment polling state
  const [deployStatus, setDeployStatus] = React.useState<DeployStatus>("idle");
  const [liveUrl, setLiveUrl] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isPublishing, setIsPublishing] = React.useState(false);

  // Check vercel connection and initial publish status
  const checkStatus = React.useCallback(async () => {
    try {
      setLoadingStatus(true);
      const res = await fetch("/api/vercel/status");
      if (res.ok) {
        const json = (await res.json()) as VercelStatus;
        setVercelStatus(json);
      }

      // Check last publication state
      const pubRes = await fetch("/api/publish/status");
      if (pubRes.ok) {
        const pubJson = (await pubRes.json()) as PublishStatusResponse;
        if (pubJson.status === "ready" && pubJson.url) {
          setLiveUrl(pubJson.url);
          setDeployStatus("ready");
        } else if (pubJson.status === "queued" || pubJson.status === "building") {
          setDeployStatus(pubJson.status);
          setIsPublishing(true);
        }
      }
    } catch (e) {
      console.warn("Status check error:", e);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  React.useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  // Polling loop when publishing
  React.useEffect(() => {
    if (!isPublishing) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/publish/status");
        if (!res.ok) {
          if (res.status === 404) return;
          const json = await res.json().catch(() => ({}));
          throw new Error(json?.error?.message ?? "Failed to check publication status");
        }

        const data = (await res.json()) as PublishStatusResponse;
        setDeployStatus(data.status);

        if (data.status === "ready") {
          setIsPublishing(false);
          if (data.url) setLiveUrl(data.url);
        } else if (data.status === "error") {
          setIsPublishing(false);
          setErrorMessage("Vercel deployment encountered an error during build.");
        }
      } catch (err: unknown) {
        setIsPublishing(false);
        setDeployStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Deployment tracking failed");
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [isPublishing]);

  const handleConnectVercel = () => {
    // Top-level browser navigation as mandated in API.md milestone 5
    window.location.href = "/api/vercel/oauth/start";
  };

  const handlePublish = async () => {
    if (!vercelStatus?.connected) {
      setErrorMessage("Please connect your Vercel account before publishing.");
      return;
    }

    setIsPublishing(true);
    setDeployStatus("queued");
    setErrorMessage(null);
    onPublishStarted?.();

    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) {
          throw new Error("Vercel account is not connected. Connect Vercel first.");
        } else if (res.status === 502) {
          throw new Error(json?.error?.message ?? "Vercel deployment API rejected the request.");
        } else {
          throw new Error(json?.error?.message ?? `Publish failed (${res.status})`);
        }
      }

      setDeployStatus("queued");
    } catch (e: unknown) {
      setIsPublishing(false);
      setDeployStatus("error");
      setErrorMessage(e instanceof Error ? e.message : "Publication failed.");
    }
  };

  return (
    <div className={`flex flex-col gap-3 ${className ?? ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Globe className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold">Vercel Deployment</span>
              {vercelStatus?.connected ? (
                <Badge variant="success" className="text-[10px] gap-1">
                  <CheckCircle2 className="size-2.5" />
                  @{vercelStatus.vercelUsername || "connected"}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Not connected
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {liveUrl ? (
                <span className="inline-flex items-center gap-1 text-success">
                  Live at <a href={liveUrl} target="_blank" rel="noreferrer" className="underline">{liveUrl}</a>
                </span>
              ) : (
                "Deploy your portfolio to your own Vercel account"
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {vercelStatus?.connected ? (
            <Button
              type="button"
              onClick={handlePublish}
              disabled={isPublishing}
              className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground text-xs font-semibold h-8"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Publishing…
                </>
              ) : (
                <>
                  <UploadCloud className="size-3.5" />
                  Publish to Vercel
                </>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleConnectVercel}
              className="gap-1.5 text-xs h-8"
            >
              <Link2 className="size-3.5" />
              Connect Vercel
            </Button>
          )}

          {liveUrl && (
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <a href={liveUrl} target="_blank" rel="noreferrer">
                View Site <ExternalLink className="size-3" />
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Deployment progress status notification */}
      {isPublishing && (
        <div className="flex items-center justify-between rounded-lg border border-accent/40 bg-accent/5 p-3 text-xs">
          <div className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin text-accent" />
            <span>
              {deployStatus === "queued" && "Deployment queued with Vercel…"}
              {deployStatus === "building" && "Compiling static bundle & uploading assets…"}
            </span>
          </div>
          <Badge variant="accent" className="text-[10px] animate-pulse">
            In progress
          </Badge>
        </div>
      )}

      {/* Deployment complete alert */}
      {!isPublishing && deployStatus === "ready" && liveUrl && (
        <Alert variant="success" className="py-2.5">
          <CheckCircle2 className="size-4" />
          <AlertTitle className="text-xs font-semibold">Site is Live on Vercel!</AlertTitle>
          <AlertDescription className="text-xs flex items-center justify-between gap-2">
            <span>Your updates have been compiled and published to the edge.</span>
            <a
              href={liveUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium underline hover:text-foreground inline-flex items-center gap-1"
            >
              Open site <ExternalLink className="size-3" />
            </a>
          </AlertDescription>
        </Alert>
      )}

      {/* Deployment error alert */}
      {errorMessage && (
        <Alert variant="destructive" className="py-2.5">
          <AlertCircle className="size-4" />
          <AlertTitle className="text-xs font-semibold">Publish Error</AlertTitle>
          <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
