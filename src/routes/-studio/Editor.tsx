import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { LivePreview } from "@/components/preview/LivePreview";
import { PublishToolbar } from "@/components/publish/PublishToolbar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Download,
  Lock,
  Loader2,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  History,
  RotateCcw,
} from "lucide-react";

interface EditorProps {
  initialHtml: string;
  onRegenerated: (html: string) => void;
}

interface VersionItem {
  id: string;
  source: string;
  model: string | null;
  warnings: string[];
  createdAt: string;
}

export function Editor({ initialHtml, onRegenerated }: EditorProps) {
  // hasPaidAccess already honors PAYMENTS_ENABLED (see src/config/payments.ts)
  // server-side, via /api/me — so setting PAYMENTS_ENABLED=false makes
  // download (and publish) free for everyone with no separate flag here.
  const { hasPaidAccess: downloadUnlocked } = useAuth();
  const [html, setHtml] = useState(initialHtml);
  const [instructions, setInstructions] = useState("");
  const [resumeUploadId, setResumeUploadId] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  // Version history state
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/uploads?kind=resume")
      .then((r) => r.json())
      .then((data: { uploads?: { id: string }[] }) => {
        if (data.uploads && data.uploads[0]) setResumeUploadId(data.uploads[0].id);
      })
      .catch(() => {});
  }, []);

  async function loadVersions() {
    setLoadingVersions(true);
    try {
      const res = await fetch("/api/portfolio/versions");
      if (res.ok) {
        const data = (await res.json()) as { versions?: VersionItem[] };
        setVersions(data.versions ?? []);
      }
    } catch {
      // Non-critical background failure
    } finally {
      setLoadingVersions(false);
    }
  }

  function handleOpenVersions() {
    setVersionsOpen(true);
    void loadVersions();
  }

  async function restoreVersion(versionId: string) {
    setRestoringId(versionId);
    setStatus(null);
    try {
      const res = await fetch(`/api/portfolio/versions/${encodeURIComponent(versionId)}/restore`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as { html?: string; error?: { message?: string } };
      if (!res.ok || !data.html) {
        throw new Error(data.error?.message ?? "Failed to restore version");
      }
      setHtml(data.html);
      onRegenerated(data.html);
      setVersionsOpen(false);
      setStatus({ kind: "ok", msg: "Restored selected version as current draft." });
    } catch (e: unknown) {
      setStatus({ kind: "err", msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setRestoringId(null);
    }
  }

  async function regenerate() {
    if (!resumeUploadId) {
      setStatus({ kind: "err", msg: "No resume on file — upload one from the wizard first." });
      return;
    }
    setRegenerating(true);
    setStatus(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "google",
          resumeUploadId,
          instructions: instructions.trim() || undefined,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as {
        html?: string;
        error?: { message?: string; details?: string[] };
      };

      if (!res.ok || !json.html) {
        const details = json.error?.details?.length ? ` ${json.error.details.join(" ")}` : "";
        throw new Error(`${json.error?.message ?? `Regeneration failed (${res.status})`}${details}`);
      }

      setHtml(json.html);
      onRegenerated(json.html);
      setStatus({ kind: "ok", msg: "Portfolio regenerated from your latest instructions." });
    } catch (e: unknown) {
      setStatus({ kind: "err", msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setRegenerating(false);
    }
  }

  async function downloadZip() {
    setDownloadingZip(true);
    try {
      const res = await fetch("/api/export/zip");
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(data.error?.message ?? `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "portfolio.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setStatus({ kind: "err", msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setDownloadingZip(false);
    }
  }

  async function handleDownloadClick() {
    if (downloadUnlocked) {
      await downloadZip();
      return;
    }
    setCheckingOut(true);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { checkoutUrl?: string };
      if (!res.ok || !json.checkoutUrl) {
        setStatus({ kind: "err", msg: "Could not start checkout. Try again from Settings." });
        return;
      }
      window.location.href = json.checkoutUrl;
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Top Header */}
      <div className="flex flex-col gap-4 border-b border-border/80 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Portfolio Studio</h1>
            <p className="text-xs text-muted-foreground">
              A fully custom, AI-generated site — regenerate with new instructions, or publish as-is.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenVersions}
              className="gap-1.5 text-xs"
              title="View and restore saved portfolio versions"
            >
              <History className="size-3.5" />
              Version History
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleDownloadClick()}
              disabled={checkingOut || downloadingZip}
              className="gap-1.5 text-xs"
              title={downloadUnlocked ? "Download standalone website zip with bundled assets" : "Pay now to deploy and download your HTML"}
            >
              {checkingOut || downloadingZip ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : downloadUnlocked ? (
                <Download className="size-3.5" />
              ) : (
                <Lock className="size-3.5" />
              )}
              {downloadUnlocked ? (downloadingZip ? "Packaging…" : "Download Zip") : "Unlock Download"}
            </Button>
          </div>
        </div>

        <PublishToolbar onPublishStarted={() => {}} />
      </div>

      {status && (
        <Alert variant={status.kind === "ok" ? "success" : "destructive"}>
          {status.kind === "ok" ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
          <AlertTitle className="text-xs font-semibold">
            {status.kind === "ok" ? "Regenerated" : "Regeneration Error"}
          </AlertTitle>
          <AlertDescription className="text-xs">{status.msg}</AlertDescription>
        </Alert>
      )}

      {/* Main Studio Viewport */}
      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="h-fit space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="size-4 text-accent" />
            Regenerate with new instructions
          </p>
          <p className="text-xs text-muted-foreground">
            Describe what to change — design direction, sections to emphasize, tone. This calls your
            connected Gemini key again and overwrites the draft on the right.
          </p>
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={5}
            placeholder="e.g. Make it more minimal and light-themed. Emphasize the machine learning projects."
            disabled={regenerating}
            className="bg-background/60"
          />
          <Button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={regenerating}
            className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90 active:scale-[0.98]"
          >
            {regenerating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Regenerating…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Regenerate Portfolio
              </>
            )}
          </Button>
        </div>

        <div className="h-[80vh] min-h-[500px]">
          <LivePreview html={html} />
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="size-5" />
              Regenerate and overwrite your current draft?
            </DialogTitle>
            <DialogDescription>
              This calls your connected Gemini API key again and uses more of your available quota. Your
              current draft will be replaced by the new result — this can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={() => {
                setConfirmOpen(false);
                void regenerate();
              }}
            >
              <Sparkles className="size-4" />
              Yes, regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version History Modal */}
      <Dialog open={versionsOpen} onOpenChange={setVersionsOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="size-5 text-accent" />
              Version History
            </DialogTitle>
            <DialogDescription>
              Shipfolio preserves up to 20 past versions of your portfolio. You can restore any past version to replace your current draft.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[380px] overflow-y-auto space-y-2.5 pr-1 py-1">
            {loadingVersions ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
                <Loader2 className="size-4 animate-spin" />
                Loading versions…
              </div>
            ) : versions.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No saved versions found.
              </div>
            ) : (
              versions.map((ver, idx) => {
                const date = new Date(ver.createdAt);
                const formattedDate = date.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const isRestoring = restoringId === ver.id;

                return (
                  <div
                    key={ver.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/60 hover:bg-card transition-colors text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {idx === 0 ? "Latest Version" : `Version ${versions.length - idx}`}
                        </span>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 uppercase font-medium">
                          {ver.source}
                        </Badge>
                        {ver.model && (
                          <span className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                            {ver.model}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{formattedDate}</p>
                      {ver.warnings && ver.warnings.length > 0 && (
                        <p className="text-[10px] text-warning truncate max-w-[280px]">
                          {ver.warnings.length} warning{ver.warnings.length > 1 ? "s" : ""}
                        </p>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={isRestoring || restoringId !== null}
                      onClick={() => void restoreVersion(ver.id)}
                      className="gap-1 text-xs shrink-0"
                    >
                      {isRestoring ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <RotateCcw className="size-3" />
                      )}
                      Restore
                    </Button>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setVersionsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
