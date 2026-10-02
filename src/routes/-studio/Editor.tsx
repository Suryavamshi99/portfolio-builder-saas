import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { LivePreview } from "@/components/preview/LivePreview";
import { PublishToolbar } from "@/components/publish/PublishToolbar";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Download, Lock, Loader2, Sparkles, AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";

interface EditorProps {
  initialHtml: string;
  onRegenerated: (html: string) => void;
}

/**
 * Temporary: Download HTML is free for everyone for now, by explicit
 * request — flip back to false to re-gate it behind hasPaidAccess (publish
 * itself is untouched and stays payment-gated either way).
 */
const DOWNLOAD_FREE_FOR_NOW = true;

export function Editor({ initialHtml, onRegenerated }: EditorProps) {
  const { hasPaidAccess } = useAuth();
  const downloadUnlocked = hasPaidAccess || DOWNLOAD_FREE_FOR_NOW;
  const [html, setHtml] = useState(initialHtml);
  const [instructions, setInstructions] = useState("");
  const [resumeUploadId, setResumeUploadId] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  useEffect(() => {
    void fetch("/api/uploads?kind=resume")
      .then((r) => r.json())
      .then((data: { uploads?: { id: string }[] }) => {
        if (data.uploads && data.uploads[0]) setResumeUploadId(data.uploads[0].id);
      })
      .catch(() => {});
  }, []);

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
          otherSpecifics: instructions.trim() || undefined,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as { html?: string; error?: { message?: string } };

      if (!res.ok || !json.html) {
        throw new Error(json.error?.message ?? `Regeneration failed (${res.status})`);
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

  function download() {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "portfolio.html";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Downloading the source HTML is normally as much "taking the deliverable"
  // as deploying it is — gated the same way /api/publish gates deploys, so a
  // free user can't sidestep payment by downloading instead of publishing.
  // DOWNLOAD_FREE_FOR_NOW currently overrides that (see its own comment).
  async function handleDownloadClick() {
    if (downloadUnlocked) {
      download();
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
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleDownloadClick()}
            disabled={checkingOut}
            className="gap-1.5 text-xs"
            title={downloadUnlocked ? undefined : "Pay now to deploy and download your HTML"}
          >
            {checkingOut ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : downloadUnlocked ? (
              <Download className="size-3.5" />
            ) : (
              <Lock className="size-3.5" />
            )}
            {downloadUnlocked ? "Download HTML" : "Unlock Download"}
          </Button>
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
    </div>
  );
}
