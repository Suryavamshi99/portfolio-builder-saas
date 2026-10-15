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
import { Link } from "@tanstack/react-router";
import { Globe, Loader2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { apiClient, type SiteCheckStatus } from "@/lib/api-client";
import { sanitizeSlug, getSlugFeedback } from "@/lib/studio-helpers";

interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSlug?: string;
  onPublished: (url: string) => void;
  onUpgradeRequired: () => void;
}

export function PublishDialog({
  open,
  onOpenChange,
  defaultSlug = "",
  onPublished,
  onUpgradeRequired,
}: PublishDialogProps) {
  const [slug, setSlug] = React.useState("");
  const [status, setStatus] = React.useState<SiteCheckStatus | "idle" | "checking" | "too_short">("idle");
  const [previewUrl, setPreviewUrl] = React.useState("");
  const [isPublishing, setIsPublishing] = React.useState(false);
  const [publishError, setPublishError] = React.useState<string | null>(null);

  // Initialize slug when dialog opens
  React.useEffect(() => {
    if (open) {
      const initial = sanitizeSlug(defaultSlug || "");
      setSlug(initial);
      setPublishError(null);
    }
  }, [open, defaultSlug]);

  // Debounced check (400ms)
  React.useEffect(() => {
    if (!open) return;

    const trimmed = slug.trim();
    if (!trimmed) {
      setStatus("idle");
      setPreviewUrl("");
      return;
    }

    if (trimmed.length < 3) {
      setStatus("too_short");
      setPreviewUrl("");
      return;
    }

    setStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const res = await apiClient.checkSiteSlug(trimmed);
        setStatus(res.status);
        setPreviewUrl(res.url);
      } catch (err: unknown) {
        if ((err as { isNotFound?: boolean })?.isNotFound) {
          // Fallback if endpoint 404
          setStatus("available");
          setPreviewUrl(`https://www.shipfolio.xyz/s/${trimmed}`);
        } else {
          setStatus("invalid");
        }
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [slug, open]);

  const feedback = getSlugFeedback(status);

  const handlePublish = async () => {
    if (!feedback.canPublish) return;
    setIsPublishing(true);
    setPublishError(null);

    try {
      const res = await apiClient.publishSite({ slug: slug.trim() });
      setIsPublishing(false);
      onOpenChange(false);
      onPublished(res.url);
    } catch (err: unknown) {
      setIsPublishing(false);
      if ((err as { status?: number })?.status === 402) {
        onOpenChange(false);
        onUpgradeRequired();
        return;
      }
      if ((err as { isNotFound?: boolean })?.isNotFound) {
        setPublishError("Publishing endpoint is coming soon.");
        return;
      }
      setPublishError(err instanceof Error ? err.message : "Failed to publish site");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="size-5 text-accent" />
            Publish your portfolio
          </DialogTitle>
          <DialogDescription className="text-xs">
            Choose a unique address for your portfolio. Your site will be hosted and available worldwide. Once published, your address is locked.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label htmlFor="publish-slug" className="text-xs font-semibold text-foreground">
              Portfolio address name
            </label>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-xs font-mono text-muted-foreground shrink-0 select-none">
                shipfolio.xyz/s/
              </span>
              <Input
                id="publish-slug"
                value={slug}
                onChange={(e) => setSlug(sanitizeSlug(e.target.value))}
                placeholder="your-name"
                disabled={isPublishing}
                maxLength={40}
                className="font-mono text-xs h-9 bg-background/60 flex-1"
              />
            </div>

            {/* Address preview */}
            {previewUrl && (
              <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-1.5 text-[11px] font-mono text-accent truncate">
                Address: {previewUrl}
              </div>
            )}

            {/* Inline validation feedback */}
            <div className="flex items-center gap-1.5 text-xs pt-1">
              {status === "checking" && (
                <>
                  <Loader2 className="size-3 animate-spin text-muted-foreground" />
                  <span className="text-muted-foreground text-[11px]">{feedback.message}</span>
                </>
              )}
              {feedback.variant === "available" && (
                <>
                  <CheckCircle2 className="size-3.5 text-success" />
                  <span className="text-success text-[11px] font-medium">{feedback.message}</span>
                </>
              )}
              {feedback.variant === "unavailable" && (
                <>
                  <AlertCircle className="size-3.5 text-warning" />
                  <span className="text-warning text-[11px]">{feedback.message}</span>
                </>
              )}
              {feedback.variant === "error" && (
                <>
                  <AlertCircle className="size-3.5 text-destructive" />
                  <span className="text-destructive text-[11px]">{feedback.message}</span>
                </>
              )}
              {feedback.variant === "idle" && (
                <span className="text-muted-foreground text-[11px]">{feedback.message}</span>
              )}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Want your own address, like <span className="font-mono">yourname.com</span>?{" "}
            <Link to="/settings" search={{ tab: "domains" }} className="text-accent underline underline-offset-2">
              Connect your own domain
            </Link>{" "}
            after publishing.
          </p>

          {publishError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
              {publishError}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPublishing}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handlePublish()}
            disabled={!feedback.canPublish || isPublishing}
            className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90 text-xs font-semibold"
          >
            {isPublishing ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Publishing…
              </>
            ) : (
              <>
                <Sparkles className="size-3.5" />
                Publish Site
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
