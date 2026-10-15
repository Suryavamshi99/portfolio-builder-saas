import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Globe,
  UploadCloud,
  Loader2,
  ExternalLink,
  Sparkles,
  Download,
  AlertCircle,
} from "lucide-react";
import { apiClient, type SiteMeResponse } from "@/lib/api-client";
import { PublishDialog } from "./PublishDialog";
import { ExportMenuDialog } from "./ExportMenuDialog";
import { usePricing } from "@/lib/use-pricing";

interface StudioToolbarProps {
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
  defaultSlug?: string | undefined;
}

export function StudioToolbar({
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
  defaultSlug = "",
}: StudioToolbarProps) {
  const pricing = usePricing();
  const [siteData, setSiteData] = React.useState<SiteMeResponse | null>(null);
  const [loadingSite, setLoadingSite] = React.useState(true);
  const [publishDialogOpen, setPublishDialogOpen] = React.useState(false);
  const [exportDialogOpen, setExportDialogOpen] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [unpublishing, setUnpublishing] = React.useState(false);
  const [confirmUnpublishOpen, setConfirmUnpublishOpen] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const fetchSiteMe = React.useCallback(async () => {
    try {
      setLoadingSite(true);
      const res = await apiClient.getSiteMe();
      setSiteData(res);
      setActionError(null);
    } catch (err: unknown) {
      if ((err as { isNotFound?: boolean })?.isNotFound) {
        // Hosting endpoints not yet deployed
        setSiteData(null);
      } else {
        console.warn("Failed to load site data:", err);
      }
    } finally {
      setLoadingSite(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchSiteMe();
  }, [fetchSiteMe]);

  const isPublished = siteData?.site?.status === "published";
  const liveUrl = isPublished ? siteData?.site?.url : null;
  const draftNewer = siteData?.draftNewer === true;

  // Fewest clicks: coming back from a successful checkout (?upgrade=pending), open the
  // Publish dialog straight away instead of making the buyer find the button again.
  const autoOpenedRef = React.useRef(false);
  React.useEffect(() => {
    if (autoOpenedRef.current || loadingSite || !hasPaidAccess || isPublished) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgrade") !== "pending") return;
    autoOpenedRef.current = true;
    setPublishDialogOpen(true);
  }, [loadingSite, hasPaidAccess, isPublished]);

  const handlePrimaryClick = async () => {
    if (!hasPaidAccess) {
      onUpgradeRequired();
      return;
    }

    if (!isPublished) {
      // First time publish -> Open dialog
      setPublishDialogOpen(true);
      return;
    }

    // Already published -> Update site
    setIsUpdating(true);
    setActionError(null);
    try {
      await apiClient.publishSite();
      await fetchSiteMe();
    } catch (err: unknown) {
      if ((err as { status?: number })?.status === 402) {
        onUpgradeRequired();
        return;
      }
      if ((err as { isNotFound?: boolean })?.isNotFound) {
        setActionError("Update endpoint is coming soon.");
        return;
      }
      setActionError(err instanceof Error ? err.message : "Failed to update live site.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUnpublish = async () => {
    setUnpublishing(true);
    setActionError(null);
    try {
      await apiClient.unpublishSite();
      setConfirmUnpublishOpen(false);
      await fetchSiteMe();
    } catch (err: unknown) {
      if ((err as { isNotFound?: boolean })?.isNotFound) {
        setActionError("Unpublish endpoint is coming soon.");
        return;
      }
      setActionError(err instanceof Error ? err.message : "Failed to unpublish site.");
    } finally {
      setUnpublishing(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-xs">
        {/* Left: Site status & Link */}
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Globe className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold">Hosting & Publishing</span>
              {loadingSite ? (
                <Badge variant="outline" className="text-[10px]">
                  Checking…
                </Badge>
              ) : isPublished ? (
                <Badge variant="success" className="text-[10px] gap-1">
                  Published
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Unpublished
                </Badge>
              )}

              {draftNewer && isPublished && (
                <Badge variant="accent" className="text-[10px] font-medium">
                  Unpublished changes
                </Badge>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[260px] sm:max-w-none">
              {liveUrl ? (
                <span className="inline-flex items-center gap-1.5 text-success truncate max-w-full">
                  Live at{" "}
                  <a
                    href={liveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline font-mono inline-flex items-center gap-0.5 truncate max-w-[190px] sm:max-w-none"
                  >
                    <span className="truncate">{liveUrl}</span> <ExternalLink className="size-2.5 shrink-0" />
                  </a>
                </span>
              ) : !hasPaidAccess ? (
                `Go live in 30 seconds. ${pricing.today} includes 1 year of hosting + your domain, then ${pricing.renewal}/yr, cancel anytime`
              ) : (
                "Publish your site to your own public address"
              )}
            </p>
          </div>
        </div>

        {/* Right actions: Unpublish link, Primary button (Publish/Update site/Upgrade), and Export menu */}
        <div className="flex items-center gap-2">
          {isPublished && (
            <button
              type="button"
              onClick={() => setConfirmUnpublishOpen(true)}
              disabled={unpublishing}
              className="text-[11px] text-muted-foreground hover:text-destructive underline mr-1 transition-colors"
            >
              Unpublish
            </button>
          )}

          {/* Primary Action Button */}
          <Button
            type="button"
            onClick={() => void handlePrimaryClick()}
            disabled={isUpdating}
            className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground text-xs font-semibold h-8"
          >
            {isUpdating ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Updating site…
              </>
            ) : !hasPaidAccess ? (
              <>
                <Sparkles className="size-3.5" />
                Publish now · {pricing.today}
              </>
            ) : isPublished ? (
              <>
                <UploadCloud className="size-3.5" />
                Update site
              </>
            ) : (
              <>
                <Globe className="size-3.5" />
                Publish
              </>
            )}
          </Button>

          {/* Export Menu trigger */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setExportDialogOpen(true)}
            className="h-8 gap-1.5 text-xs"
          >
            <Download className="size-3.5" />
            Export
          </Button>
        </div>
      </div>

      {actionError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="size-3.5 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Publish Dialog */}
      <PublishDialog
        open={publishDialogOpen}
        onOpenChange={setPublishDialogOpen}
        defaultSlug={defaultSlug}
        onPublished={async () => {
          await fetchSiteMe();
        }}
        onUpgradeRequired={onUpgradeRequired}
      />

      {/* Export Grouping Modal */}
      <ExportMenuDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        hasPaidAccess={hasPaidAccess}
        onUpgradeRequired={onUpgradeRequired}
        onDownloadZip={onDownloadZip}
        onDownloadHtml={onDownloadHtml}
        onCopyHtml={onCopyHtml}
        downloadingZip={downloadingZip}
        downloadingHtml={downloadingHtml}
        copiedHtml={copiedHtml}
        onConnectVercel={onConnectVercel}
        vercelConnected={vercelConnected}
        vercelUsername={vercelUsername}
      />

      {/* Unpublish confirmation dialog */}
      <Dialog open={confirmUnpublishOpen} onOpenChange={setConfirmUnpublishOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Unpublish your live website?</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Your site at <span className="font-mono text-foreground break-all">{liveUrl}</span> will no longer be publicly accessible. You can republish anytime.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmUnpublishOpen(false)}
              disabled={unpublishing}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => void handleUnpublish()}
              disabled={unpublishing}
              className="text-xs gap-1.5"
            >
              {unpublishing ? <Loader2 className="size-3 animate-spin" /> : null}
              Yes, unpublish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
