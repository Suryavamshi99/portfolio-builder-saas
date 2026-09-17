import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useAuth } from "@/lib/auth";
import { PRO_PRICE_USD } from "@/config/plans";
import { ByokManager } from "@/components/byok/ByokManager";
import { UploadWidget } from "@/components/upload/UploadWidget";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  KeyRound,
  HardDrive,
  Globe,
  Trash2,
  CheckCircle2,
  Loader2,
  ExternalLink,
  ShieldCheck,
  Zap,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Clock,
} from "lucide-react";

interface SettingsSearch {
  upgrade?: "pending";
}

export const Route = createFileRoute("/settings")({
  validateSearch: (search: Record<string, unknown>): SettingsSearch => {
    return search["upgrade"] === "pending" ? { upgrade: "pending" } : {};
  },
  head: () => ({
    meta: [{ title: "Account & Settings — Portfol.io" }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <AuthGuard actionName="view your settings">
      <SettingsContent />
    </AuthGuard>
  );
}

interface UserRecord {
  id: string;
  email: string;
  plan: string;
  createdAt: string;
  storage: { usedBytes: number; quotaBytes: number };
  vercel: { connected: boolean };
}

interface VercelStatus {
  connected: boolean;
  vercelUsername?: string;
  connectedAt?: string;
}

function SettingsContent() {
  const navigate = useNavigate();
  const { upgrade } = Route.useSearch();
  const { refreshPortfolioStatus } = useAuth();
  const [activeTab, setActiveTab] = React.useState("byok");
  const [userRecord, setUserRecord] = React.useState<UserRecord | null>(null);
  const [vercelStatus, setVercelStatus] = React.useState<VercelStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [disconnectingVercel, setDisconnectingVercel] = React.useState(false);
  const [statusMsg, setStatusMsg] = React.useState<string | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);
  const [resetError, setResetError] = React.useState<string | null>(null);
  const [upgrading, setUpgrading] = React.useState(false);
  const [upgradeError, setUpgradeError] = React.useState<string | null>(null);
  const [pendingUpgrade, setPendingUpgrade] = React.useState(upgrade === "pending");

  const fetchStatus = React.useCallback(async () => {
    try {
      setLoading(true);
      const [meRes, vercelRes] = await Promise.all([
        fetch("/api/me"),
        fetch("/api/vercel/status"),
      ]);

      if (meRes.ok) {
        const meJson = (await meRes.json()) as UserRecord;
        setUserRecord(meJson);
      }
      if (vercelRes.ok) {
        const vJson = (await vercelRes.json()) as VercelStatus;
        setVercelStatus(vJson);
      }
    } catch (e) {
      console.warn("Error fetching settings data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  // Dodo's webhook can land a moment after the return_url redirect brings
  // the user back here — poll briefly rather than telling them to refresh.
  React.useEffect(() => {
    if (!pendingUpgrade) return;
    if (userRecord?.plan === "pro") {
      setPendingUpgrade(false);
      return;
    }
    const interval = setInterval(() => void fetchStatus(), 3000);
    const timeout = setTimeout(() => setPendingUpgrade(false), 30000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [pendingUpgrade, userRecord?.plan, fetchStatus]);

  const handleUpgrade = async () => {
    setUpgrading(true);
    setUpgradeError(null);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.checkoutUrl) {
        throw new Error(json?.error?.message ?? `Could not start checkout (${res.status})`);
      }
      window.location.href = json.checkoutUrl;
    } catch (e: unknown) {
      setUpgradeError(e instanceof Error ? e.message : "Failed to start checkout.");
      setUpgrading(false);
    }
  };

  const handleConnectVercel = () => {
    // Top-level navigation redirect as specified in API.md milestone 5
    window.location.href = "/api/vercel/oauth/start";
  };

  const handleDisconnectVercel = async () => {
    setDisconnectingVercel(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/vercel", { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        throw new Error("Failed to disconnect Vercel");
      }
      setStatusMsg("Disconnected Vercel account.");
      await fetchStatus();
    } catch (e: unknown) {
      setStatusMsg(e instanceof Error ? e.message : "Failed to disconnect.");
    } finally {
      setDisconnectingVercel(false);
    }
  };

  const handleStartOver = async () => {
    setResetting(true);
    setResetError(null);
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error?.message ?? `Reset failed (${res.status})`);
      }
      await refreshPortfolioStatus();
      setResetDialogOpen(false);
      void navigate({ to: "/onboarding" });
    } catch (e: unknown) {
      setResetError(e instanceof Error ? e.message : "Failed to reset your account.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account & Integrations</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Manage your AI keys, storage assets, and deployment connections.
        </p>
      </div>

      {statusMsg && (
        <Alert variant="accent">
          <CheckCircle2 className="size-4" />
          <AlertTitle>Notice</AlertTitle>
          <AlertDescription>{statusMsg}</AlertDescription>
        </Alert>
      )}

      {pendingUpgrade && userRecord?.plan !== "pro" && (
        <Alert variant="warning">
          <Clock className="size-4" />
          <AlertTitle>Payment processing</AlertTitle>
          <AlertDescription>
            Confirming your payment — this usually takes a few seconds. This will update
            automatically once it's through.
          </AlertDescription>
        </Alert>
      )}

      <Card className={userRecord?.plan === "pro" ? "border-accent/40" : undefined}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="size-4 text-accent" />
              Plan & Billing
            </CardTitle>
            <Badge variant={userRecord?.plan === "pro" ? "accent" : "outline"} className="uppercase text-[10px]">
              {userRecord?.plan ?? "free"}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            {userRecord?.plan === "pro"
              ? "Pro is a one-time unlock — no subscription, nothing recurring."
              : "50MB storage, 5 generations/hour, 10 uploads/hour, and a small badge on your published site."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {userRecord?.plan !== "pro" && (
            <>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>• 250MB storage (5x free)</li>
                <li>• 20 generations/hour, 30 uploads/hour</li>
                <li>• "Published with Portfol.io" badge removed</li>
              </ul>
              {upgradeError && (
                <Alert variant="destructive">
                  <AlertTitle>Couldn't start checkout</AlertTitle>
                  <AlertDescription>{upgradeError}</AlertDescription>
                </Alert>
              )}
              <Button onClick={() => void handleUpgrade()} disabled={upgrading} className="gap-2">
                {upgrading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Upgrade to Pro — ${PRO_PRICE_USD} one-time
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Handled by Dodo Payments. Not a subscription — nothing recurring, ever.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="byok" className="gap-2 text-xs">
            <KeyRound className="size-3.5" />
            BYOK Keys
          </TabsTrigger>
          <TabsTrigger value="vercel" className="gap-2 text-xs">
            <Globe className="size-3.5" />
            Vercel Hosting
          </TabsTrigger>
          <TabsTrigger value="storage" className="gap-2 text-xs">
            <HardDrive className="size-3.5" />
            Storage & Files
          </TabsTrigger>
          <TabsTrigger value="danger" className="gap-2 text-xs text-destructive">
            <AlertTriangle className="size-3.5" />
            Danger Zone
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: BYOK Keys */}
        <TabsContent value="byok" className="pt-4 space-y-6">
          <ByokManager />
        </TabsContent>

        {/* Tab 2: Vercel Hosting */}
        <TabsContent value="vercel" className="pt-4 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="size-4 text-accent" />
                  Vercel Deployment Integration
                </CardTitle>
                {vercelStatus?.connected ? (
                  <Badge variant="success" className="gap-1">
                    <CheckCircle2 className="size-3" /> Connected
                  </Badge>
                ) : (
                  <Badge variant="outline">Not connected</Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                Link your personal Vercel account via OAuth. When you publish, your static portfolio is deployed directly to your own Vercel account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {vercelStatus?.connected ? (
                <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-xs">
                    <div>
                      <span className="text-muted-foreground">Connected Username: </span>
                      <span className="font-semibold text-foreground">
                        @{vercelStatus.vercelUsername || "account"}
                      </span>
                    </div>
                    {vercelStatus.connectedAt && (
                      <span className="text-muted-foreground">
                        Linked on {new Date(vercelStatus.connectedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-3">
                    <span className="text-xs text-muted-foreground">
                      Deployments will be created in your account.
                    </span>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={disconnectingVercel}
                      onClick={handleDisconnectVercel}
                      className="h-8 gap-1.5 text-xs"
                    >
                      {disconnectingVercel ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                      Disconnect Vercel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border p-8 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <Zap className="size-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm">No Vercel Account Linked</h4>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      Connect your Vercel account to enable 1-click publishing of your portfolio to the global edge.
                    </p>
                  </div>
                  <Button onClick={handleConnectVercel} className="gap-2">
                    <Globe className="size-4" />
                    Connect Vercel Account
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Storage & Files */}
        <TabsContent value="storage" className="pt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <HardDrive className="size-4 text-accent" />
                Asset Management
              </CardTitle>
              <CardDescription className="text-xs">
                Upload and manage your headshots, resume files, and project showcase images.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <UploadWidget kind="photo" title="Profile Headshot" />
              <div className="border-t border-border pt-4">
                <UploadWidget kind="project_image" title="Project Showcase Images" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Danger Zone */}
        <TabsContent value="danger" className="pt-4 space-y-6">
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-destructive">
                <AlertTriangle className="size-4" />
                Start Over
              </CardTitle>
              <CardDescription className="text-xs">
                Wipe your current draft and every uploaded file so you can build your portfolio from
                scratch — for example if you want to start with a completely different resume or
                direction rather than editing what's there.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-xs text-muted-foreground space-y-2">
                <p>
                  <strong className="text-foreground">This deletes:</strong> your portfolio content
                  (everything in Studio), your resume, visual reference screenshots, profile photo, and
                  project images.
                </p>
                <p>
                  <strong className="text-foreground">This keeps:</strong> your connected API key(s) — you
                  won't need to reconnect them.
                </p>
                <p>You'll be taken to the wizard afterward and will need to upload everything again.</p>
              </div>
              <Button
                variant="destructive"
                className="gap-2"
                onClick={() => {
                  setResetError(null);
                  setResetDialogOpen(true);
                }}
              >
                <RotateCcw className="size-4" />
                Start Over
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              Delete everything and start over?
            </DialogTitle>
            <DialogDescription>
              This permanently deletes your current portfolio draft and all uploaded files (resume,
              visual references, photo, project images). Your connected API key(s) will be kept. You'll
              need to re-upload everything and generate again. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {resetError && (
            <Alert variant="destructive" className="mt-2">
              <AlertTitle>Couldn't reset</AlertTitle>
              <AlertDescription>{resetError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)} disabled={resetting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleStartOver()} disabled={resetting} className="gap-2">
              {resetting ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
              Yes, start over
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
