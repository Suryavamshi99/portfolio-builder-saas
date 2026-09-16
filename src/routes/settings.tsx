import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { ByokManager } from "@/components/byok/ByokManager";
import { UploadWidget } from "@/components/upload/UploadWidget";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
} from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [{ title: "Account & Settings — Portfolio Builder" }],
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
  const [activeTab, setActiveTab] = React.useState("byok");
  const [userRecord, setUserRecord] = React.useState<UserRecord | null>(null);
  const [vercelStatus, setVercelStatus] = React.useState<VercelStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [disconnectingVercel, setDisconnectingVercel] = React.useState(false);
  const [statusMsg, setStatusMsg] = React.useState<string | null>(null);

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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
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
      </Tabs>
    </div>
  );
}
