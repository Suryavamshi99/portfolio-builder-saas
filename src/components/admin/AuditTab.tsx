import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Shield,
} from "lucide-react";
import {
  adminApi,
  AdminAuditEntry,
  PaginatedResult,
  calculatePagination,
  formatRelativeTime,
  formatExactTime,
} from "@/lib/admin-api";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { NotAvailablePanel } from "./NotAvailablePanel";
import { Tooltip } from "@/components/ui/tooltip";

export function AuditTab() {
  const [actionFilter, setActionFilter] = React.useState("all");
  const [targetTypeFilter, setTargetTypeFilter] = React.useState("all");
  const [page, setPage] = React.useState(1);

  const [result, setResult] = React.useState<PaginatedResult<AdminAuditEntry> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notAvailable, setNotAvailable] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadAudit = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotAvailable(false);
    try {
      const res = await adminApi.getAudit({
        action: actionFilter,
        targetType: targetTypeFilter,
        page,
        pageSize: 25,
      });
      if (res === null) {
        setNotAvailable(true);
      } else {
        setResult(res);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [actionFilter, targetTypeFilter, page]);

  React.useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  if (notAvailable) {
    return <NotAvailablePanel title="Audit log endpoint not available" />;
  }

  const pagination = result
    ? calculatePagination(result.total, result.page, result.pageSize)
    : null;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card/60 border border-border/80 rounded-xl p-3">
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-accent" />
          <span className="text-xs font-semibold text-foreground">Audit Log Trail</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Target Type Filter */}
          <select
            value={targetTypeFilter}
            onChange={(e) => {
              setTargetTypeFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-md border border-input bg-card px-2.5 text-xs text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Filter audit by target type"
          >
            <option value="all">All Targets</option>
            <option value="user">User</option>
            <option value="site">Site</option>
            <option value="domain">Domain</option>
            <option value="job">Job</option>
            <option value="provider">Provider</option>
            <option value="mcp">MCP</option>
            <option value="system">System</option>
          </select>

          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-md border border-input bg-card px-2.5 text-xs text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Filter audit by action"
          >
            <option value="all">All Actions</option>
            <option value="user.plan_change">user.plan_change</option>
            <option value="user.admin_flag">user.admin_flag</option>
            <option value="user.html_edit">user.html_edit</option>
            <option value="user.delete">user.delete</option>
            <option value="user.mcp_revoke">user.mcp_revoke</option>
            <option value="site.takedown">site.takedown</option>
            <option value="domain.remove">domain.remove</option>
            <option value="job.cancel">job.cancel</option>
            <option value="provider.clear_cooldown">provider.clear_cooldown</option>
            <option value="admin.login_ok">admin.login_ok</option>
            <option value="admin.login_fail">admin.login_fail</option>
            <option value="admin.login_locked">admin.login_locked</option>
            <option value="admin.step_up">admin.step_up</option>
            <option value="admin.2fa_enrolled">admin.2fa_enrolled</option>
            <option value="admin.logout_all">admin.logout_all</option>
            <option value="admin.recovery_used">admin.recovery_used</option>
            <option value="admin.recovery_regenerated">admin.recovery_regenerated</option>
          </select>
        </div>
      </div>

      {error && <ErrorState error={error} onRetry={loadAudit} />}

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && result && (
        <>
          {result.data.length === 0 ? (
            <EmptyState
              message="No audit entries found"
              description="No audit records match the current filters."
            />
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block rounded-xl border border-border/80 overflow-hidden bg-card">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground border-b border-border/80">
                    <tr>
                      <th className="p-3 font-semibold">Time</th>
                      <th className="p-3 font-semibold">Action</th>
                      <th className="p-3 font-semibold">Target</th>
                      <th className="p-3 font-semibold">Reason</th>
                      <th className="p-3 font-semibold">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {result.data.map((entry) => {
                      const detailEntries = Object.entries(entry.detail || {});
                      return (
                        <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3 text-muted-foreground font-mono whitespace-nowrap">
                            <Tooltip content={formatExactTime(entry.createdAt)}>
                              <span className="underline decoration-dotted">
                                {formatRelativeTime(entry.createdAt)}
                              </span>
                            </Tooltip>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {entry.action}
                            </Badge>
                          </td>
                          <td className="p-3 text-foreground font-mono text-[11px]">
                            <span className="text-muted-foreground uppercase text-[10px] mr-1">
                              {entry.targetType}:
                            </span>
                            {entry.targetId ?? "—"}
                          </td>
                          <td className="p-3 text-muted-foreground max-w-xs break-words">
                            {entry.reason ? (
                              <span className="text-foreground">{entry.reason}</span>
                            ) : (
                              <span className="text-muted-foreground/60 italic">none</span>
                            )}
                          </td>
                          <td className="p-3">
                            {detailEntries.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-sm">
                                {detailEntries.map(([k, v]) => (
                                  <span
                                    key={k}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/60 font-mono text-[10px] text-muted-foreground"
                                  >
                                    <strong className="text-foreground">{k}:</strong> {String(v)}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground/60">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked Card View */}
              <div className="md:hidden space-y-2">
                {result.data.map((entry) => {
                  const detailEntries = Object.entries(entry.detail || {});
                  return (
                    <Card key={entry.id} className="border-border/80">
                      <CardContent className="p-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {entry.action}
                          </Badge>
                          <span className="text-muted-foreground font-mono text-[10px]">
                            {formatRelativeTime(entry.createdAt)}
                          </span>
                        </div>

                        <div className="text-[11px] text-muted-foreground">
                          Target: <span className="font-mono text-foreground">{entry.targetType} {entry.targetId}</span>
                        </div>

                        {entry.reason && (
                          <div className="text-[11px] bg-muted/30 p-2 rounded border border-border/50 text-foreground">
                            {entry.reason}
                          </div>
                        )}

                        {detailEntries.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1 border-t border-border/50">
                            {detailEntries.map(([k, v]) => (
                              <span
                                key={k}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/60 font-mono text-[9px] text-muted-foreground"
                              >
                                <strong>{k}:</strong> {String(v)}
                              </span>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {pagination && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
                  <div>
                    Showing {pagination.startIndex}–{pagination.endIndex} of {result.total} entries
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={!pagination.hasPrev}
                      className="h-8 gap-1 text-xs"
                    >
                      <ChevronLeft className="size-3.5" /> Prev
                    </Button>
                    <span className="px-2">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={!pagination.hasNext}
                      className="h-8 gap-1 text-xs"
                    >
                      Next <ChevronRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
