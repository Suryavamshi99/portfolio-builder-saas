import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
  XCircle,
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
  // null while unknown — never treat "unknown" as "paid" for a moment while
  // /api/me is still loading, since that would briefly flash the Connect/
  // Publish buttons for a free user.
  const [hasPaidAccess, setHasPaidAccess] = React.useState<boolean | null>(null);
  const [loadingStatus, setLoadingStatus] = React.useState(true);

  // Deployment polling state
  const [deployStatus, setDeployStatus] = React.useState<DeployStatus>("idle");
  const [liveUrl, setLiveUrl] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isPublishing, setIsPublishing] = React.useState(false);
  const [paymentRequired, setPaymentRequired] = React.useState(false);
  const [checkingOut, setCheckingOut] = React.useState(false);
  // Payment confirmation, shown as a dialog on this same page instead of a
  // redirect elsewhere — see the `upgrade` query-param handling below.
  const [confirmingPayment, setConfirmingPayment] = React.useState(false);
  const [paymentSuccessOpen, setPaymentSuccessOpen] = React.useState(false);
  const [paymentFailedOpen, setPaymentFailedOpen] = React.useState(false);

  // Check plan, vercel connection, and initial publish status
  const checkStatus = React.useCallback(async () => {
    try {
      setLoadingStatus(true);
      const [meRes, vercelRes] = await Promise.all([fetch("/api/me"), fetch("/api/vercel/status")]);

      if (meRes.ok) {
        const meJson = (await meRes.json()) as { hasPaidAccess?: boolean };
        setHasPaidAccess(meJson.hasPaidAccess === true);
      }
      if (vercelRes.ok) {
        const json = (await vercelRes.json()) as VercelStatus;
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

  // The Vercel OAuth flow is a full-page redirect (start.ts / callback.ts),
  // so failures come back as a query param on this page rather than a fetch
  // response — surface them here instead of leaving the user on a blank or
  // crashed page, then strip the param so a refresh doesn't re-show it.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vercelError = params.get("vercel_error");
    const connected = params.get("vercel") === "connected";
    const upgrade = params.get("upgrade");
    if (!vercelError && !connected && !upgrade) return;

    if (vercelError === "payment_required") {
      // Reachable by direct navigation to /api/vercel/oauth/start even
      // though the button is hidden pre-payment — same Upgrade prompt as a
      // blocked /api/publish call, not a generic error.
      setPaymentRequired(true);
    } else if (vercelError) {
      const messages: Record<string, string> = {
        not_configured: "Vercel deployment isn't configured on this server yet. Contact support.",
        invalid_state: "That Vercel connection link expired or was invalid — please try connecting again.",
        oauth_failed: "Vercel couldn't complete the connection. Please try again.",
        save_failed: "Connected to Vercel, but we couldn't save it — please try again.",
      };
      setErrorMessage(messages[vercelError] ?? "Could not connect your Vercel account. Please try again.");
    }

    if (upgrade === "failed") {
      setPaymentFailedOpen(true);
    } else if (upgrade === "pending") {
      // Checkout's return_url lands back here — stay on Studio and show a
      // dialog instead of bouncing to Settings. The dummy test page flips
      // the plan synchronously before redirecting, so this usually resolves
      // on the very first check; a real Dodo webhook can land a moment
      // later, hence the short poll rather than a single check.
      setConfirmingPayment(true);
      let attempts = 0;
      const poll = async () => {
        attempts += 1;
        const res = await fetch("/api/me").catch(() => null);
        const json = res?.ok ? ((await res.json()) as { hasPaidAccess?: boolean }) : null;
        const paid = json?.hasPaidAccess === true;
        if (paid) {
          setConfirmingPayment(false);
          setHasPaidAccess(true);
          setPaymentSuccessOpen(true);
          void checkStatus();
        } else if (attempts < 12) {
          setTimeout(() => void poll(), 2000);
        } else {
          setConfirmingPayment(false);
        }
      };
      void poll();
    }

    params.delete("vercel_error");
    params.delete("vercel");
    params.delete("upgrade");
    const query = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (query ? `?${query}` : ""));

    if (connected) void checkStatus();
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
    setPaymentRequired(false);
    onPublishStarted?.();

    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 402) {
          setPaymentRequired(true);
          throw new Error(json?.error?.message ?? "Upgrade to Pro to publish your portfolio.");
        } else if (res.status === 409) {
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

  const handleUpgrade = async () => {
    setCheckingOut(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ returnTo: "studio" }),
      });
      const json = (await res.json().catch(() => ({}))) as { checkoutUrl?: string };
      if (!res.ok || !json.checkoutUrl) {
        setErrorMessage("Could not start checkout. Try again from Settings.");
        return;
      }
      window.location.href = json.checkoutUrl;
    } finally {
      setCheckingOut(false);
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
              {!hasPaidAccess ? (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Locked
                </Badge>
              ) : vercelStatus?.connected ? (
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
              ) : !hasPaidAccess ? (
                "Unlock Pro to connect Vercel and deploy your portfolio"
              ) : (
                "Deploy your portfolio to your own Vercel account"
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Strict linear order — only the current actionable step is ever
              shown as the primary action: Pay, then Connect, then Publish.
              Connect/Publish never render before hasPaidAccess is true (both
              the /api/vercel/oauth/start and /api/publish endpoints enforce
              this server-side too — this is UX sequencing, not the gate). */}
          {hasPaidAccess === null ? null : !hasPaidAccess ? (
            <Button
              type="button"
              size="sm"
              onClick={() => void handleUpgrade()}
              disabled={checkingOut}
              className="gap-1.5 bg-accent hover:bg-accent/90 text-accent-foreground text-xs font-semibold h-8"
            >
              {checkingOut ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              Upgrade to unlock deploy
            </Button>
          ) : vercelStatus?.connected ? (
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

      {/* Payment-required: deploying is a Pro-only action — see /api/publish.
          Only shown when hasPaidAccess itself is still true on the client
          (a stale-cache edge case, e.g. plan flipped in another tab) — when
          hasPaidAccess is already false, the primary "Upgrade to unlock
          deploy" button above covers this and a second copy would just be
          a duplicate CTA. */}
      {paymentRequired && hasPaidAccess ? (
        <Alert className="border-accent/40 bg-accent/5 py-2.5">
          <Sparkles className="size-4 text-accent" />
          <AlertTitle className="text-xs font-semibold">Pay now to deploy and download</AlertTitle>
          <AlertDescription className="text-xs flex items-center justify-between gap-2">
            <span>Your portfolio is ready — deploying it live and downloading the HTML both need the one-time Pro unlock.</span>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleUpgrade()}
              disabled={checkingOut}
              className="h-7 shrink-0 gap-1.5 bg-accent text-xs font-semibold text-accent-foreground hover:bg-accent/90"
            >
              {checkingOut ? <Loader2 className="size-3 animate-spin" /> : "Upgrade"}
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        errorMessage && (
          <Alert variant="destructive" className="py-2.5">
            <AlertCircle className="size-4" />
            <AlertTitle className="text-xs font-semibold">Publish Error</AlertTitle>
            <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
          </Alert>
        )
      )}

      {confirmingPayment && (
        <div className="flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/5 p-3 text-xs">
          <Loader2 className="size-4 animate-spin text-accent" />
          <span>Confirming your payment…</span>
        </div>
      )}

      {/* Success/fail land back on Studio itself (see the `upgrade`
          query-param handling above) instead of bouncing to Settings — the
          natural next step after paying is right here: connect Vercel. */}
      <Dialog open={paymentSuccessOpen} onOpenChange={setPaymentSuccessOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-success">
              <CheckCircle2 className="size-5" />
              Payment successful
            </DialogTitle>
            <DialogDescription>
              Pro is unlocked. You can now connect your Vercel account and publish your portfolio.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPaymentSuccessOpen(false)} className="bg-accent text-accent-foreground hover:bg-accent/90">
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentFailedOpen} onOpenChange={setPaymentFailedOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="size-5" />
              Payment didn't go through
            </DialogTitle>
            <DialogDescription>
              Your card wasn't charged and your plan hasn't changed. You can try again whenever you're ready.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentFailedOpen(false)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
