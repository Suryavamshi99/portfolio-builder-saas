import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Users,
  Layers,
  Globe,
  Briefcase,
  Bot,
  CreditCard,
  AlertTriangle,
  Clock,
  Loader2,
  HardDrive,
} from "lucide-react";
import { adminApi, AdminOverview, formatBytes, formatRelativeTime, formatExactTime } from "@/lib/admin-api";
import { NotAvailablePanel } from "./NotAvailablePanel";
import { ErrorState } from "./ErrorState";
import { StatusBadge } from "./StatusBadge";
import { Tooltip } from "@/components/ui/tooltip";

export function OverviewTab() {
  const [data, setData] = React.useState<AdminOverview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notAvailable, setNotAvailable] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotAvailable(false);
    try {
      const res = await adminApi.getOverview();
      if (res === null) {
        setNotAvailable(true);
      } else {
        setData(res);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load overview data");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notAvailable) {
    return <NotAvailablePanel title="Overview statistics not available" />;
  }

  if (error || !data) {
    return <ErrorState title="Could not load overview" error={error ?? "No data returned"} onRetry={loadData} />;
  }

  const { users, content, sites, domains, jobs, mcp, freeProviders, payments } = data;

  return (
    <div className="space-y-6">
      {/* Warning banner when jobs are queued waiting for free capacity */}
      {jobs.oldestQueuedRetryAt && (
        <Alert variant="warning" className="border-warning/50 bg-warning/10">
          <AlertTriangle className="size-4 text-warning" />
          <div className="space-y-1">
            <AlertTitle className="text-sm font-semibold text-foreground">
              Capacity Limitation Warning
            </AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground">
              {jobs.last24h.queued} job(s) are waiting for free capacity. Oldest retry scheduled{" "}
              <Tooltip content={formatExactTime(jobs.oldestQueuedRetryAt)}>
                <span className="font-semibold underline decoration-dotted">
                  {formatRelativeTime(jobs.oldestQueuedRetryAt)}
                </span>
              </Tooltip>
              .
            </AlertDescription>
          </div>
        </Alert>
      )}

      {/* Primary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Users Card */}
        <Card className="border-border/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Users
            </CardTitle>
            <Users className="size-4 text-accent" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold tracking-tight text-foreground">{users.total}</div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>+{users.new7d} new 7d</span>
              <span>·</span>
              <span className="text-accent font-medium">{users.pro} pro</span>
              <span>·</span>
              <span>{users.admins} admin(s)</span>
            </div>
          </CardContent>
        </Card>

        {/* Content & Storage Card */}
        <Card className="border-border/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Portfolios & Storage
            </CardTitle>
            <Layers className="size-4 text-accent" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold tracking-tight text-foreground">{content.portfolios}</div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{content.versions} version(s)</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1 font-mono">
                <HardDrive className="size-3" />
                {formatBytes(content.uploadsBytes)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Sites & Domains Card */}
        <Card className="border-border/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Sites & Domains
            </CardTitle>
            <Globe className="size-4 text-accent" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold tracking-tight text-foreground">{sites.published}</div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span>{sites.unpublished} unpub</span>
              <span>·</span>
              <span>{domains.live} live domains</span>
              <span>({domains.verified} ver, {domains.pending} pend)</span>
            </div>
          </CardContent>
        </Card>

        {/* System & Payments Card */}
        <Card className="border-border/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              System & Gateway
            </CardTitle>
            <CreditCard className="size-4 text-accent" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-sm font-semibold text-muted-foreground">Payments:</span>
              <Badge variant={payments.enabled ? "success" : "secondary"} className="uppercase text-[10px]">
                {payments.enabled ? "Active" : "Disabled"}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
              <Bot className="size-3.5 text-accent" />
              <span>{mcp.activeConnections} active MCP connection(s)</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Jobs last 24 hours card */}
      <Card className="border-border/80">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Briefcase className="size-4 text-accent" />
              Jobs (Last 24 Hours)
            </CardTitle>
            <Badge variant="outline" className="font-mono text-xs">
              {jobs.last24h.total} total
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border/60 bg-card/60 p-3">
              <div className="text-xs text-muted-foreground">Done</div>
              <div className="text-lg font-bold text-success">{jobs.last24h.done}</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/60 p-3">
              <div className="text-xs text-muted-foreground">Running</div>
              <div className="text-lg font-bold text-warning">{jobs.last24h.running}</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/60 p-3">
              <div className="text-xs text-muted-foreground">Queued</div>
              <div className="text-lg font-bold text-muted-foreground">{jobs.last24h.queued}</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/60 p-3">
              <div className="text-xs text-muted-foreground">Failed</div>
              <div className="text-lg font-bold text-destructive">{jobs.last24h.failed}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-t border-border/60 pt-3">
            <span className="font-medium text-foreground">Source Split:</span>
            <span>Free: <strong className="text-foreground">{jobs.last24h.bySource.free}</strong></span>
            <span>Gemini: <strong className="text-foreground">{jobs.last24h.bySource.gemini}</strong></span>
            <span>MCP: <strong className="text-foreground">{jobs.last24h.bySource.mcp}</strong></span>
          </div>
        </CardContent>
      </Card>

      {/* Grid: Free Models Today & Top Errors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Free Models Today */}
        <Card className="border-border/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Clock className="size-4 text-accent" />
              Free Models Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            {freeProviders.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">No free providers configured.</p>
            ) : (
              <div className="space-y-3">
                {freeProviders.map((provider) => {
                  const percent = provider.dailyBudget > 0
                    ? Math.min(100, Math.round((provider.usedToday / provider.dailyBudget) * 100))
                    : 0;
                  return (
                    <div key={provider.id} className="rounded-lg border border-border/60 p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <span className="font-semibold text-foreground">{provider.label}</span>
                          <span className="text-muted-foreground ml-1.5 font-mono text-[11px]">
                            ({provider.model})
                          </span>
                        </div>
                        {provider.cooldownUntil ? (
                          <Tooltip content={formatExactTime(provider.cooldownUntil)}>
                            <Badge variant="warning" className="text-[10px] uppercase">
                              Cooldown: {formatRelativeTime(provider.cooldownUntil)}
                            </Badge>
                          </Tooltip>
                        ) : (
                          <StatusBadge status="ready" />
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                          <span>Usage: {provider.usedToday} / {provider.dailyBudget}</span>
                          <span>{percent}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-accent transition-all rounded-full"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Errors (24h) */}
        <Card className="border-border/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" />
              Top Errors (24 h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {jobs.topErrors.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">No errors in the last 24 hours.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {jobs.topErrors.map((err, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 text-xs">
                    <span className="font-mono text-destructive font-medium">{err.code}</span>
                    <Badge variant="outline" className="font-mono">
                      {err.count} occurrence(s)
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
