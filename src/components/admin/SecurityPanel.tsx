// replaced by 08c
import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, LogOut, Loader2, CheckCircle2 } from "lucide-react";
import { formatRelativeTime } from "@/lib/admin-api";

export function SecurityPanel() {
  const [data, setData] = React.useState<{
    twoFactorEnabledAt: string | null;
    recoveryCodesLeft: number;
    recentAttempts: Array<{ createdAt: string; stage: string; ok: boolean }>;
  } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [actionMsg, setActionMsg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [operating, setOperating] = React.useState(false);

  const fetchSecurity = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/security");
      if (res.status === 404) {
        setData(null);
        return;
      }
      if (!res.ok) {
        throw new Error("Could not load security status.");
      }
      const json = await res.json();
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error loading security settings");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchSecurity();
  }, [fetchSecurity]);

  async function handleLogoutAll() {
    setOperating(true);
    setActionMsg(null);
    try {
      const res = await fetch("/api/admin/logout-all", { method: "POST" });
      if (res.ok) {
        setActionMsg("Signed out from all sessions.");
      }
    } finally {
      setOperating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {actionMsg && (
        <Alert variant="accent">
          <CheckCircle2 className="size-4" />
          <AlertDescription>{actionMsg}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="size-4 text-accent" />
              Two-Factor Authentication (2FA)
            </CardTitle>
            {data?.twoFactorEnabledAt ? (
              <Badge variant="success">Enabled</Badge>
            ) : (
              <Badge variant="outline">Enrolment required on next sign-in</Badge>
            )}
          </div>
          <CardDescription className="text-xs">
            Admin console requires RFC 6238 TOTP authenticator app verification.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {data?.twoFactorEnabledAt
              ? `Enabled ${formatRelativeTime(data.twoFactorEnabledAt)} · ${data.recoveryCodesLeft} recovery codes remaining`
              : "2FA is active or will be required upon next authentication."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LogOut className="size-4 text-accent" />
            Session Control
          </CardTitle>
          <CardDescription className="text-xs">
            Invalidate all active admin session cookies across all browsers by bumping session epoch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleLogoutAll()}
            disabled={operating}
            className="text-destructive hover:bg-destructive/10"
          >
            {operating ? <Loader2 className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />}
            Sign out everywhere
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
