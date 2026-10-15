import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ShieldCheck, ShieldAlert, KeyRound, LogOut, RefreshCw, Loader2, Copy, Check, Download } from "lucide-react";
import { StepUpDialog } from "./StepUpDialog";
import { requestStepUp } from "@/lib/admin-stepup";

interface SecurityData {
  twoFactorEnabledAt: string | null;
  recoveryCodesLeft: number;
  recentAttempts: Array<{
    createdAt: string;
    stage: "password" | "totp";
    ok: boolean;
  }>;
}

export function SecurityPanel() {
  const [data, setData] = React.useState<SecurityData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Regenerated recovery codes modal state
  const [newCodes, setNewCodes] = React.useState<string[] | null>(null);
  const [codesCopied, setCodesCopied] = React.useState(false);
  const [regenerating, setRegenerating] = React.useState(false);

  // Sign out everywhere state
  const [loggingOutAll, setLoggingOutAll] = React.useState(false);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/security");
      if (!res.ok) {
        setError("Failed to load security status");
        return;
      }
      const json = (await res.json()) as SecurityData;
      setData(json);
    } catch {
      setError("Network error loading security status");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleRegenerateCodes() {
    setError(null);
    const steppedUp = await requestStepUp();
    if (!steppedUp) return;

    setRegenerating(true);
    try {
      const res = await fetch("/api/admin/2fa/recovery/regenerate", { method: "POST" });
      if (!res.ok) {
        const errJson = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(errJson?.error?.message ?? "Failed to regenerate recovery codes");
        return;
      }
      const json = (await res.json()) as { recoveryCodes: string[] };
      setNewCodes(json.recoveryCodes);
      void loadData();
    } catch {
      setError("Network error regenerating recovery codes");
    } finally {
      setRegenerating(false);
    }
  }

  async function handleSignOutAll() {
    setError(null);
    const steppedUp = await requestStepUp();
    if (!steppedUp) return;

    setLoggingOutAll(true);
    try {
      const res = await fetch("/api/admin/logout-all", { method: "POST" });
      if (res.ok) {
        window.location.reload();
      } else {
        setError("Failed to sign out everywhere");
      }
    } catch {
      setError("Network error signing out everywhere");
    } finally {
      setLoggingOutAll(false);
    }
  }

  function handleCopyNewCodes() {
    if (!newCodes) return;
    void navigator.clipboard.writeText(newCodes.join("\n"));
    setCodesCopied(true);
    setTimeout(() => setCodesCopied(false), 2000);
  }

  function handleDownloadNewCodes() {
    if (!newCodes) return;
    const text = `Shipfolio Admin Recovery Codes\nRegenerated: ${new Date().toISOString()}\n\n` +
      newCodes.map((c, i) => `${i + 1}. ${c}`).join("\n") +
      "\n\nEach code can only be used once. Previous recovery codes are now invalid.";
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "shipfolio-admin-recovery-codes.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (loading && !data) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StepUpDialog />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* 2FA Status Card */}
        <Card className="border-border/80">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="size-4 text-accent" />
                <CardTitle className="text-base font-semibold">Two-Factor Authentication</CardTitle>
              </div>
              <Badge variant={data?.twoFactorEnabledAt ? "default" : "destructive"}>
                {data?.twoFactorEnabledAt ? "Enabled" : "Not Enrolled"}
              </Badge>
            </div>
            <CardDescription>
              {data?.twoFactorEnabledAt
                ? `Enrolled on ${new Date(data.twoFactorEnabledAt).toLocaleDateString()}`
                : "2FA is required for administrator console access"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded border border-border/60 bg-muted/30 p-3 text-xs">
              <span className="font-medium text-foreground">Recovery codes remaining</span>
              <span className="font-mono font-semibold">{data?.recoveryCodesLeft ?? 0}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleRegenerateCodes()}
              disabled={regenerating}
              className="w-full gap-1.5"
            >
              {regenerating ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              Regenerate recovery codes
            </Button>
          </CardContent>
        </Card>

        {/* Global Sessions Card */}
        <Card className="border-border/80">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LogOut className="size-4 text-destructive" />
                <CardTitle className="text-base font-semibold">Active Sessions</CardTitle>
              </div>
              <Badge variant="outline">Session v2</Badge>
            </div>
            <CardDescription>
              Invalidate all signed admin session tokens across all devices
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Bumps the global session epoch in Postgres. All active admin sessions will immediately expire and require re-authenticating with password and 2FA.
            </p>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => void handleSignOutAll()}
              disabled={loggingOutAll}
              className="w-full gap-1.5"
            >
              {loggingOutAll ? <Loader2 className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />}
              Sign out everywhere
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sign-in Attempts */}
      <Card className="border-border/80">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Recent Sign-in Attempts</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => void loadData()} className="h-7 px-2">
              <RefreshCw className="size-3" />
            </Button>
          </div>
          <CardDescription>Last 20 authentication events. IP addresses and keys are not logged.</CardDescription>
        </CardHeader>
        <CardContent>
          {!data?.recentAttempts || data.recentAttempts.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No recent attempts recorded</p>
          ) : (
            <div className="space-y-2">
              {data.recentAttempts.map((att, idx) => (
                <div
                  key={`${att.createdAt}-${idx}`}
                  className="flex items-center justify-between rounded border border-border/50 bg-muted/20 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    {att.ok ? (
                      <ShieldCheck className="size-4 text-success" />
                    ) : (
                      <ShieldAlert className="size-4 text-destructive" />
                    )}
                    <span className="font-medium text-foreground">
                      {att.stage === "password" ? "Password check" : "Two-factor code"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={att.ok ? "default" : "destructive"} className="text-[10px]">
                      {att.ok ? "Success" : "Failed"}
                    </Badge>
                    <span className="text-muted-foreground">
                      {new Date(att.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Regenerated Codes Dialog */}
      <Dialog open={newCodes != null} onOpenChange={(open) => !open && setNewCodes(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Recovery Codes</DialogTitle>
            <DialogDescription>
              All previous recovery codes are now invalid. Save these 8 new codes in a secure location.
            </DialogDescription>
          </DialogHeader>

          {newCodes && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-2 rounded border border-border bg-muted/30 p-3 font-mono text-xs">
                {newCodes.map((c) => (
                  <div key={c} className="rounded bg-background px-2 py-1.5 text-center font-medium">
                    {c}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleCopyNewCodes} className="flex-1 gap-1.5">
                  {codesCopied ? <Check className="size-3.5 text-accent" /> : <Copy className="size-3.5" />}
                  {codesCopied ? "Copied" : "Copy codes"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleDownloadNewCodes} className="flex-1 gap-1.5">
                  <Download className="size-3.5" />
                  Download (.txt)
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setNewCodes(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
