import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  HardDrive,
  Globe,
  Bot,
  Github,
  KeyRound,
  Trash2,
  Shield,
  Layers,
  Sparkles,
  ExternalLink,
  Code,
  Briefcase,
} from "lucide-react";
import {
  adminApi,
  AdminUserDetail,
  formatBytes,
  formatRelativeTime,
  formatExactTime,
} from "@/lib/admin-api";
import { StatusBadge } from "./StatusBadge";
import { DestructiveConfirmDialog } from "./DestructiveConfirmDialog";
import { Tooltip } from "@/components/ui/tooltip";

export interface UserDetailDrawerProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserMutated: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}

export function UserDetailDrawer({
  userId,
  open,
  onOpenChange,
  onUserMutated,
  showToast,
}: UserDetailDrawerProps) {
  const [detail, setDetail] = React.useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // HTML content editing
  const [htmlDraft, setHtmlDraft] = React.useState("");
  const [htmlReason, setHtmlReason] = React.useState("");
  const [savingHtml, setSavingHtml] = React.useState(false);
  const [htmlError, setHtmlError] = React.useState<string | null>(null);

  // Dialog triggers
  const [planDialog, setPlanDialog] = React.useState<"free" | "pro" | null>(null);
  const [adminDialog, setAdminDialog] = React.useState<boolean | null>(null);
  const [revokeMcpDialog, setRevokeMcpDialog] = React.useState(false);
  const [unpublishDialog, setUnpublishDialog] = React.useState(false);
  const [deleteDialog, setDeleteDialog] = React.useState(false);

  const fetchDetail = React.useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getUserDetail(id);
      if (!data) {
        setError("User details endpoint not available.");
      } else {
        setDetail(data);
        setHtmlDraft(data.portfolio?.html ?? "");
        setHtmlReason("");
        setHtmlError(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load user details");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open && userId) {
      void fetchDetail(userId);
    } else {
      setDetail(null);
    }
  }, [open, userId, fetchDetail]);

  // Save raw HTML
  async function handleSaveHtml() {
    if (!detail) return;
    setSavingHtml(true);
    setHtmlError(null);
    try {
      const updated = await adminApi.updateUser(detail.id, {
        html: htmlDraft,
        reason: htmlReason.trim() || "Admin direct portfolio HTML edit",
      });
      setDetail(updated);
      showToast("Portfolio HTML updated successfully.");
      onUserMutated();
    } catch (err: unknown) {
      setHtmlError(err instanceof Error ? err.message : "Failed to save portfolio HTML.");
    } finally {
      setSavingHtml(false);
    }
  }

  // Change Plan
  async function handleChangePlan(targetPlan: "free" | "pro", reason: string) {
    if (!detail) return;
    const updated = await adminApi.updateUser(detail.id, { plan: targetPlan, reason });
    setDetail(updated);
    showToast(`User plan changed to ${targetPlan}.`);
    onUserMutated();
  }

  // Toggle Admin
  async function handleToggleAdmin(targetAdmin: boolean, reason: string) {
    if (!detail) return;
    const updated = await adminApi.updateUser(detail.id, { isAdmin: targetAdmin, reason });
    setDetail(updated);
    showToast(targetAdmin ? "Admin rights granted." : "Admin rights removed.");
    onUserMutated();
  }

  // Revoke MCP
  async function handleRevokeMcp(reason: string) {
    if (!detail) return;
    const res = await adminApi.revokeUserMcp(detail.id, { reason });
    showToast(`Revoked ${res.revokedClients} MCP connection(s).`);
    if (userId) void fetchDetail(userId);
    onUserMutated();
  }

  // Unpublish Site
  async function handleUnpublishSite(reason: string) {
    if (!detail?.site?.slug) return;
    await adminApi.unpublishSite(detail.site.slug, { reason });
    showToast("Site unpublished successfully.");
    if (userId) void fetchDetail(userId);
    onUserMutated();
  }

  // Delete User
  async function handleDeleteUser(reason: string, confirmEmail?: string) {
    if (!detail) return;
    await adminApi.deleteUser(detail.id, {
      reason,
      confirmEmail: confirmEmail ?? "",
    });
    showToast("Account deleted successfully.");
    onOpenChange(false);
    onUserMutated();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          {loading && (
            <div className="flex justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && !loading && (
            <Alert variant="destructive" className="my-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {detail && !loading && (
            <div className="space-y-6">
              {/* Header */}
              <DialogHeader className="border-b border-border/80 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <DialogTitle className="text-lg font-bold text-foreground">
                      {detail.email ?? "No email"}
                    </DialogTitle>
                    <DialogDescription className="font-mono text-xs text-muted-foreground mt-0.5">
                      ID: {detail.id}
                    </DialogDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={detail.plan} />
                    {detail.isAdmin && (
                      <Badge variant="accent" className="uppercase text-[10px]">
                        Admin
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground pt-1">
                  Joined{" "}
                  <Tooltip content={formatExactTime(detail.createdAt)}>
                    <span className="underline decoration-dotted">
                      {formatRelativeTime(detail.createdAt)}
                    </span>
                  </Tooltip>
                  {detail.portfolio?.updatedAt && (
                    <>
                      {" "}· Portfolio updated{" "}
                      <Tooltip content={formatExactTime(detail.portfolio.updatedAt)}>
                        <span className="underline decoration-dotted">
                          {formatRelativeTime(detail.portfolio.updatedAt)}
                        </span>
                      </Tooltip>
                    </>
                  )}
                </div>
              </DialogHeader>

              {/* Action Toolbar */}
              <div className="rounded-xl border border-border/80 bg-muted/20 p-3 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase">
                  Admin Actions
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Plan Button */}
                  {detail.plan === "free" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPlanDialog("pro")}
                      className="h-8 gap-1.5 text-xs text-accent"
                    >
                      <Sparkles className="size-3.5" /> Upgrade to Pro
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPlanDialog("free")}
                      className="h-8 gap-1.5 text-xs"
                    >
                      Downgrade to Free
                    </Button>
                  )}

                  {/* Admin Toggle */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAdminDialog(!detail.isAdmin)}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Shield className="size-3.5" />
                    {detail.isAdmin ? "Remove Admin" : "Grant Admin"}
                  </Button>

                  {/* Revoke MCP */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRevokeMcpDialog(true)}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Bot className="size-3.5" />
                    Revoke MCP Tokens
                  </Button>

                  {/* Unpublish Site */}
                  {detail.site && detail.site.status === "published" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setUnpublishDialog(true)}
                      className="h-8 gap-1.5 text-xs text-warning"
                    >
                      <Globe className="size-3.5" />
                      Unpublish Site
                    </Button>
                  )}

                  {/* Delete Account */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDeleteDialog(true)}
                    className="h-8 gap-1.5 text-xs text-destructive hover:bg-destructive/10 border-destructive/40"
                  >
                    <Trash2 className="size-3.5" />
                    Delete Account
                  </Button>
                </div>
              </div>

              {/* Site & Domain */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                  <Globe className="size-3.5 text-accent" />
                  Site & Custom Domain
                </h4>
                {detail.site ? (
                  <div className="rounded-xl border border-border/70 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">/{detail.site.slug}</span>
                        <StatusBadge status={detail.site.status} />
                      </div>
                      <a
                        href={detail.site.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent hover:underline flex items-center gap-1 font-mono text-[11px]"
                      >
                        {detail.site.url}
                        <ExternalLink className="size-3" />
                      </a>
                    </div>
                    {detail.domain && (
                      <div className="text-right">
                        <div className="font-medium text-foreground">{detail.domain.hostname}</div>
                        <StatusBadge status={detail.domain.status} />
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground p-3 border border-dashed rounded-lg">
                    No published site yet.
                  </p>
                )}
              </div>

              {/* Connections */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                  <Bot className="size-3.5 text-accent" />
                  Connected Services & Integrations
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {/* GitHub */}
                  <div className="rounded-lg border border-border/70 p-3 space-y-1">
                    <div className="text-muted-foreground flex items-center gap-1">
                      <Github className="size-3.5" /> GitHub
                    </div>
                    <div className="font-medium text-foreground">
                      {detail.connections?.github?.account ? (
                        `@${detail.connections.github.account}`
                      ) : (
                        <span className="text-muted-foreground">Not connected</span>
                      )}
                    </div>
                  </div>

                  {/* Vercel */}
                  <div className="rounded-lg border border-border/70 p-3 space-y-1">
                    <div className="text-muted-foreground flex items-center gap-1">
                      <Globe className="size-3.5" /> Vercel
                    </div>
                    <div className="font-medium text-foreground">
                      {detail.connections?.vercel || detail.vercelConnection ? (
                        <Badge variant="success" className="text-[10px]">Connected</Badge>
                      ) : (
                        <span className="text-muted-foreground">Not connected</span>
                      )}
                    </div>
                  </div>

                  {/* MCP Apps */}
                  <div className="rounded-lg border border-border/70 p-3 space-y-1">
                    <div className="text-muted-foreground flex items-center gap-1">
                      <Bot className="size-3.5" /> MCP Applications
                    </div>
                    <div className="font-medium text-foreground">
                      {detail.connections?.mcp?.length ? (
                        <span className="text-accent">{detail.connections.mcp.length} app(s)</span>
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* BYOK Providers */}
                {detail.byokProviders && detail.byokProviders.length > 0 && (
                  <div className="rounded-lg border border-border/70 p-3 text-xs space-y-1">
                    <div className="text-muted-foreground flex items-center gap-1">
                      <KeyRound className="size-3.5" /> BYOK Keys Registered
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {detail.byokProviders.map((b, i) => (
                        <Badge key={i} variant="outline" className="font-mono text-[10px]">
                          {b.provider}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Uploads Section */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                  <HardDrive className="size-3.5 text-accent" />
                  Uploads ({detail.uploads.length})
                </h4>
                {detail.uploads.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3 border border-dashed rounded-lg">
                    No uploaded files.
                  </p>
                ) : (
                  <div className="max-h-40 overflow-y-auto divide-y divide-border/60 rounded-lg border border-border/70 text-xs">
                    {detail.uploads.map((upload, idx) => {
                      const bytes = upload.sizeBytes ?? upload.size_bytes ?? 0;
                      const date = upload.createdAt ?? upload.created_at;
                      return (
                        <div key={idx} className="flex items-center justify-between p-2">
                          <div className="min-w-0 pr-2">
                            <span className="font-medium text-foreground truncate block">{upload.filename}</span>
                            <span className="text-[11px] text-muted-foreground uppercase">{upload.kind}</span>
                          </div>
                          <div className="text-right shrink-0 text-muted-foreground text-[11px]">
                            <div>{formatBytes(bytes)}</div>
                            {date && <div>{formatRelativeTime(date)}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Versions Section */}
              {detail.versions && detail.versions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                    <Layers className="size-3.5 text-accent" />
                    Recent Versions ({detail.versions.length})
                  </h4>
                  <div className="max-h-40 overflow-y-auto divide-y divide-border/60 rounded-lg border border-border/70 text-xs">
                    {detail.versions.map((ver) => (
                      <div key={ver.id} className="flex items-center justify-between p-2">
                        <div className="min-w-0 pr-2">
                          <span className="font-mono text-muted-foreground text-[10px] truncate block">{ver.id}</span>
                          <span className="text-[11px] text-foreground">Model: {ver.model} ({ver.source})</span>
                        </div>
                        <div className="text-right shrink-0 text-muted-foreground text-[11px]">
                          <div>{formatBytes(ver.htmlBytes)} · {ver.warningsCount} warnings</div>
                          <div>{formatRelativeTime(ver.createdAt)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Jobs Section */}
              {detail.jobs && detail.jobs.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                    <Briefcase className="size-3.5 text-accent" />
                    Recent Jobs ({detail.jobs.length})
                  </h4>
                  <div className="max-h-44 overflow-y-auto divide-y divide-border/60 rounded-lg border border-border/70 text-xs">
                    {detail.jobs.map((job) => (
                      <div key={job.id} className="flex items-center justify-between p-2">
                        <div className="min-w-0 pr-2 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={job.status} />
                            <span className="font-semibold text-foreground">{job.provider}</span>
                            <span className="text-[11px] text-muted-foreground">via {job.source}</span>
                          </div>
                          {job.errorCode && (
                            <div className="text-[11px] text-destructive font-mono">
                              {job.errorCode}: {job.errorMessage}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0 text-muted-foreground text-[11px]">
                          {formatRelativeTime(job.createdAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Portfolio Preview */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                  <Code className="size-3.5 text-accent" />
                  Portfolio HTML Preview (Empty Sandbox)
                </h4>
                {detail.portfolio?.html ? (
                  <div className="rounded-xl border border-border/80 overflow-hidden bg-background">
                    <iframe
                      title="Portfolio Preview"
                      sandbox=""
                      srcDoc={detail.portfolio.html}
                      className="w-full h-72 border-0 bg-background"
                    />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground p-4 border border-dashed rounded-lg">
                    No portfolio HTML draft on record.
                  </p>
                )}
              </div>

              {/* Edit Raw HTML Textarea */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                  Edit Portfolio HTML (Raw)
                </h4>
                <Textarea
                  value={htmlDraft}
                  onChange={(e) => setHtmlDraft(e.target.value)}
                  className="h-48 font-mono text-xs"
                  spellCheck={false}
                  placeholder="<!DOCTYPE html>..."
                />
                <div className="space-y-1.5">
                  <label htmlFor="html-reason" className="text-xs font-medium text-muted-foreground">
                    Reason for direct HTML edit (required for audit):
                  </label>
                  <input
                    id="html-reason"
                    type="text"
                    value={htmlReason}
                    onChange={(e) => setHtmlReason(e.target.value)}
                    placeholder="e.g. Fixed typo in user header as requested"
                    className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                {htmlError && <p className="text-xs text-destructive">{htmlError}</p>}
                <div className="flex justify-end pt-1">
                  <Button
                    size="sm"
                    onClick={() => void handleSaveHtml()}
                    disabled={savingHtml || !htmlReason.trim()}
                    className="gap-1.5 text-xs"
                  >
                    {savingHtml ? <Loader2 className="size-3.5 animate-spin" /> : null}
                    Save Portfolio HTML
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Plan Dialog */}
      <DestructiveConfirmDialog
        open={planDialog !== null}
        onOpenChange={(op) => !op && setPlanDialog(null)}
        title={planDialog === "pro" ? "Upgrade user to Pro plan?" : "Downgrade user to Free plan?"}
        description={
          planDialog === "pro"
            ? "This will grant the user Pro access with expanded storage quota and priority generations."
            : "This will revoke Pro access and return storage and generation limits to Free tier defaults."
        }
        confirmLabel={`Set plan to ${planDialog ?? ""}`}
        confirmVariant={planDialog === "free" ? "destructive" : "default"}
        onConfirm={async (reason) => {
          if (planDialog) await handleChangePlan(planDialog, reason);
        }}
      />

      {/* Admin Toggle Dialog */}
      <DestructiveConfirmDialog
        open={adminDialog !== null}
        onOpenChange={(op) => !op && setAdminDialog(null)}
        title={adminDialog ? "Grant Admin privileges?" : "Revoke Admin privileges?"}
        description={
          adminDialog
            ? "This will allow the user to access the Admin Console and run administrative commands."
            : "This will remove administrative privileges from this account. Note: the last remaining admin account cannot be demoted."
        }
        confirmLabel={adminDialog ? "Grant Admin" : "Revoke Admin"}
        confirmVariant={adminDialog ? "default" : "destructive"}
        onConfirm={async (reason) => {
          if (adminDialog !== null) await handleToggleAdmin(adminDialog, reason);
        }}
      />

      {/* Revoke MCP Dialog */}
      <DestructiveConfirmDialog
        open={revokeMcpDialog}
        onOpenChange={setRevokeMcpDialog}
        title="Revoke all MCP tokens for this user?"
        description="All active Model Context Protocol (MCP) clients and applications connected to this user will immediately lose access and must be re-authorized."
        confirmLabel="Revoke MCP Tokens"
        onConfirm={async (reason) => {
          await handleRevokeMcp(reason);
        }}
      />

      {/* Unpublish Site Dialog */}
      <DestructiveConfirmDialog
        open={unpublishDialog}
        onOpenChange={setUnpublishDialog}
        title={`Unpublish site /${detail?.site?.slug ?? ""}?`}
        description="This will take down the published portfolio. The public URL will return 404 until republished by the user."
        confirmLabel="Unpublish Site"
        onConfirm={async (reason) => {
          await handleUnpublishSite(reason);
        }}
      />

      {/* Delete User Dialog */}
      <DestructiveConfirmDialog
        open={deleteDialog}
        onOpenChange={setDeleteDialog}
        title={`Delete account of ${detail?.email ?? detail?.id ?? ""}?`}
        description={
          <span className="space-y-1 block">
            <span>This will permanently delete this user, their auth account, portfolio drafts, versions, all uploaded assets in storage, custom domain records, and connected keys.</span>
            <strong className="block text-destructive pt-1">This action cannot be undone.</strong>
          </span>
        }
        confirmLabel="Delete account permanently"
        requiredConfirmEmail={detail?.email ?? undefined}
        onConfirm={async (reason, confirmEmail) => {
          await handleDeleteUser(reason, confirmEmail);
        }}
      />
    </>
  );
}
