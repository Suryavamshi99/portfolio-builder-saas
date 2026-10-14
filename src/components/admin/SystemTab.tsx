import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Server,
  GitCommit,
  Globe,
  CreditCard,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { adminApi, AdminSystemInfo } from "@/lib/admin-api";
import { ErrorState } from "./ErrorState";
import { NotAvailablePanel } from "./NotAvailablePanel";

const SETTING_FEATURE_MAP: Record<string, string> = {
  SUPABASE_URL: "Database & Auth API endpoint",
  SUPABASE_SERVICE_ROLE_KEY: "Elevated backend database access",
  ENCRYPTION_KEY: "AES-GCM encryption for BYOK & admin 2FA keys",
  ADMIN_SESSION_SECRET: "Admin authentication cookie signing",
  OPENROUTER_API_KEY: "Free generation model routing",
  FREE_MODEL_OPENROUTER_A: "Default free generation model",
  CRON_SECRET: "Scheduled asset retention maintenance",
  SITES_BASE_URL: "Subdomain portfolio hosting",
  GITHUB_APP_ID: "GitHub portfolio export & repository push",
  GITHUB_APP_PRIVATE_KEY: "GitHub App authentication key",
  VERCEL_API_TOKEN: "Vercel edge hosting & custom domains",
  SITES_PROJECT_ID: "Vercel Sites project identifier",
  DODO_PAYMENTS_API_KEY: "Payment checkout API",
  DODO_PRODUCT_ID_PRO: "Pro plan product ID",
  DODO_WEBHOOK_SECRET: "Payment webhook signature verification",
};

export function SystemTab() {
  const [system, setSystem] = React.useState<AdminSystemInfo | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notAvailable, setNotAvailable] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadSystem = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotAvailable(false);
    try {
      const res = await adminApi.getSystem();
      if (res === null) {
        setNotAvailable(true);
      } else {
        setSystem(res);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load system information");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadSystem();
  }, [loadSystem]);

  if (notAvailable) {
    return <NotAvailablePanel title="System status endpoint not available" />;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !system) {
    return <ErrorState title="System information error" error={error ?? "No data returned"} onRetry={loadSystem} />;
  }

  const shortCommit = system.commit ? system.commit.slice(0, 7) : "development";
  const missingCount = system.settings.filter((s) => !s.set).length;

  return (
    <div className="space-y-6">
      {/* System Infrastructure Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Commit */}
        <Card className="border-border/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Deploy Commit
            </CardTitle>
            <GitCommit className="size-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="font-mono text-base font-bold text-foreground">{shortCommit}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Active running revision</p>
          </CardContent>
        </Card>

        {/* App Origin */}
        <Card className="border-border/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              App Origin
            </CardTitle>
            <Server className="size-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="font-mono text-xs font-semibold text-foreground truncate">
              {system.appOrigin}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Primary application domain</p>
          </CardContent>
        </Card>

        {/* Sites Base URL */}
        <Card className="border-border/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Sites Base URL
            </CardTitle>
            <Globe className="size-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="font-mono text-xs font-semibold text-foreground truncate">
              {system.sitesBaseUrl ?? <span className="text-muted-foreground italic">Not set</span>}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Subdomain hosting root</p>
          </CardContent>
        </Card>

        {/* Payments Badge */}
        <Card className="border-border/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Payments Gateway
            </CardTitle>
            <CreditCard className="size-4 text-accent" />
          </CardHeader>
          <CardContent>
            <Badge
              variant={system.payments.enabled ? "success" : "secondary"}
              className="text-xs uppercase font-semibold"
            >
              {system.payments.enabled ? "Enabled (Pro Live)" : "Disabled (Invite/Free)"}
            </Badge>
            <p className="text-[11px] text-muted-foreground mt-1">Dodo checkout status</p>
          </CardContent>
        </Card>
      </div>

      {/* Environment Settings Checklist */}
      <Card className="border-border/80">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShieldAlert className="size-4 text-accent" />
                Environment & Integration Settings
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Presence status for server credentials and service tokens. Values are never exposed.
              </CardDescription>
            </div>
            {missingCount > 0 ? (
              <Badge variant="warning" className="text-xs">
                {missingCount} missing
              </Badge>
            ) : (
              <Badge variant="success" className="text-xs">
                All configured
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {missingCount > 0 && (
            <Alert variant="warning" className="border-warning/40 bg-warning/10">
              <AlertTriangle className="size-4 text-warning" />
              <AlertTitle className="text-xs font-semibold">Missing settings can break features</AlertTitle>
              <AlertDescription className="text-xs text-muted-foreground">
                Some features may be degraded or disabled because their corresponding environment variables are unset.
              </AlertDescription>
            </Alert>
          )}

          <div className="divide-y divide-border/60 rounded-xl border border-border/80 overflow-hidden bg-card">
            {system.settings.map((setting) => {
              const featureDesc = SETTING_FEATURE_MAP[setting.name] ?? "System service dependency";
              return (
                <div
                  key={setting.name}
                  className="flex items-center justify-between p-3 text-xs hover:bg-muted/30 transition-colors"
                >
                  <div className="space-y-0.5 min-w-0 pr-3">
                    <span className="font-mono font-semibold text-foreground truncate block">
                      {setting.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{featureDesc}</span>
                  </div>

                  <div className="shrink-0">
                    {setting.set ? (
                      <Badge variant="success" className="gap-1 text-[10px]">
                        <CheckCircle2 className="size-3" />
                        Set
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1 text-[10px]">
                        <XCircle className="size-3" />
                        Missing
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
