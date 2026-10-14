import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  XCircle,
  RotateCcw,
  Clock,
  Briefcase,
  AlertCircle,
} from "lucide-react";
import {
  adminApi,
  AdminJobSummary,
  AdminOverview,
  PaginatedResult,
  calculatePagination,
  formatRelativeTime,
  formatExactTime,
} from "@/lib/admin-api";
import { StatusBadge } from "./StatusBadge";
import { DestructiveConfirmDialog } from "./DestructiveConfirmDialog";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { NotAvailablePanel } from "./NotAvailablePanel";
import { Tooltip } from "@/components/ui/tooltip";

export function JobsTab({
  showToast,
}: {
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [sourceFilter, setSourceFilter] = React.useState("all");
  const [page, setPage] = React.useState(1);

  const [jobsResult, setJobsResult] = React.useState<PaginatedResult<AdminJobSummary> | null>(null);
  const [providers, setProviders] = React.useState<AdminOverview["freeProviders"] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notAvailable, setNotAvailable] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Expanded error message state for mobile/table
  const [expandedErrorId, setExpandedErrorId] = React.useState<string | null>(null);

  // Dialog targets
  const [cancelJobTarget, setCancelJobTarget] = React.useState<AdminJobSummary | null>(null);
  const [clearCooldownTarget, setClearCooldownTarget] = React.useState<{ id: string; label: string } | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotAvailable(false);
    try {
      const [jobsRes, overviewRes] = await Promise.all([
        adminApi.getJobs({
          status: statusFilter,
          source: sourceFilter,
          page,
          pageSize: 25,
        }),
        adminApi.getOverview(),
      ]);

      if (jobsRes === null && overviewRes === null) {
        setNotAvailable(true);
      } else {
        setJobsResult(jobsRes);
        if (overviewRes) {
          setProviders(overviewRes.freeProviders);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, sourceFilter, page]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleCancelJob(jobId: string, reason: string) {
    await adminApi.cancelJob(jobId, { reason });
    showToast("Job cancelled.");
    void loadData();
  }

  async function handleClearCooldown(providerId: string, reason: string) {
    await adminApi.clearProviderCooldown({ provider: providerId, reason });
    showToast(`Cooldown cleared for ${providerId}.`);
    void loadData();
  }

  if (notAvailable) {
    return <NotAvailablePanel title="Jobs & providers endpoint not available" />;
  }

  const pagination = jobsResult
    ? calculatePagination(jobsResult.total, jobsResult.page, jobsResult.pageSize)
    : null;

  return (
    <div className="space-y-6">
      {/* Free Providers Card */}
      {providers && providers.length > 0 && (
        <Card className="border-border/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Clock className="size-4 text-accent" />
              Free Model Providers & Capacity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {providers.map((p) => {
                const percent = p.dailyBudget > 0
                  ? Math.min(100, Math.round((p.usedToday / p.dailyBudget) * 100))
                  : 0;
                return (
                  <div key={p.id} className="rounded-xl border border-border/70 p-3 space-y-2 bg-card/60">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">{p.label}</span>
                      {p.cooldownUntil ? (
                        <Tooltip content={formatExactTime(p.cooldownUntil)}>
                          <Badge variant="warning" className="text-[10px] uppercase">
                            Cooldown: {formatRelativeTime(p.cooldownUntil)}
                          </Badge>
                        </Tooltip>
                      ) : (
                        <StatusBadge status="ready" />
                      )}
                    </div>

                    <div className="text-[11px] text-muted-foreground font-mono">{p.model}</div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>Used today: {p.usedToday} / {p.dailyBudget}</span>
                        <span>{percent}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-accent transition-all rounded-full"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-1 flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setClearCooldownTarget({ id: p.id, label: p.label })}
                        className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                      >
                        <RotateCcw className="size-3" />
                        Clear cooldown
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card/60 border border-border/80 rounded-xl p-3">
        <div className="flex items-center gap-2">
          <Briefcase className="size-4 text-accent" />
          <span className="text-xs font-semibold text-foreground">Generation Jobs</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-md border border-input bg-card px-2.5 text-xs text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Filter jobs by status"
          >
            <option value="all">All Statuses</option>
            <option value="queued">Queued</option>
            <option value="running">Running</option>
            <option value="done">Done</option>
            <option value="failed">Failed</option>
          </select>

          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-md border border-input bg-card px-2.5 text-xs text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Filter jobs by source"
          >
            <option value="all">All Sources</option>
            <option value="free">Free Chain</option>
            <option value="gemini">Gemini BYOK</option>
            <option value="mcp">MCP</option>
          </select>
        </div>
      </div>

      {error && <ErrorState error={error} onRetry={loadData} />}

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && jobsResult && (
        <>
          {jobsResult.data.length === 0 ? (
            <EmptyState
              message="No jobs in the last 24 hours"
              description="No generation jobs match your current status and source filters."
            />
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block rounded-xl border border-border/80 overflow-hidden bg-card">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground border-b border-border/80">
                    <tr>
                      <th className="p-3 font-semibold">Time</th>
                      <th className="p-3 font-semibold">User</th>
                      <th className="p-3 font-semibold">Source</th>
                      <th className="p-3 font-semibold">Status</th>
                      <th className="p-3 font-semibold">Provider</th>
                      <th className="p-3 font-semibold">Error / Details</th>
                      <th className="p-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {jobsResult.data.map((job) => {
                      const isPending = job.status === "queued" || job.status === "running";
                      return (
                        <tr key={job.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3 text-muted-foreground font-mono">
                            <Tooltip content={formatExactTime(job.createdAt)}>
                              <span className="underline decoration-dotted">
                                {formatRelativeTime(job.createdAt)}
                              </span>
                            </Tooltip>
                          </td>
                          <td className="p-3 font-medium text-foreground">
                            {job.userEmail ?? <span className="font-mono text-muted-foreground">anonymous</span>}
                          </td>
                          <td className="p-3 text-muted-foreground uppercase text-[11px] font-mono">
                            {job.source}
                          </td>
                          <td className="p-3">
                            <StatusBadge status={job.status} />
                          </td>
                          <td className="p-3 font-medium text-foreground">
                            {job.provider}
                          </td>
                          <td className="p-3">
                            {job.errorCode ? (
                              <Tooltip content={job.errorMessage ?? job.errorCode}>
                                <span className="font-mono text-destructive inline-flex items-center gap-1 cursor-help">
                                  <AlertCircle className="size-3" />
                                  {job.errorCode}
                                </span>
                              </Tooltip>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">—</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {isPending && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setCancelJobTarget(job)}
                                className="h-7 text-xs text-destructive hover:bg-destructive/10 border-destructive/40"
                              >
                                <XCircle className="size-3 mr-1" />
                                Cancel
                              </Button>
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
                {jobsResult.data.map((job) => {
                  const isPending = job.status === "queued" || job.status === "running";
                  const isErrorExpanded = expandedErrorId === job.id;
                  return (
                    <Card key={job.id} className="border-border/80">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {job.provider} ({job.source})
                          </span>
                          <StatusBadge status={job.status} />
                        </div>

                        <div className="text-[11px] text-muted-foreground space-y-1">
                          <div>User: <span className="text-foreground">{job.userEmail ?? "anonymous"}</span></div>
                          <div>Started: {formatRelativeTime(job.createdAt)}</div>
                          {job.errorCode && (
                            <div>
                              <button
                                type="button"
                                onClick={() => setExpandedErrorId(isErrorExpanded ? null : job.id)}
                                className="text-destructive font-mono text-left inline-flex items-center gap-1 underline"
                              >
                                <AlertCircle className="size-3" />
                                {job.errorCode}
                              </button>
                              {isErrorExpanded && job.errorMessage && (
                                <p className="text-destructive text-[10px] mt-1 p-1.5 bg-destructive/10 rounded">
                                  {job.errorMessage}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {isPending && (
                          <div className="pt-1 border-t border-border/60">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setCancelJobTarget(job)}
                              className="h-7 text-xs text-destructive w-full"
                            >
                              <XCircle className="size-3 mr-1" />
                              Cancel Job
                            </Button>
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
                    Showing {pagination.startIndex}–{pagination.endIndex} of {jobsResult.total} jobs
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

      {/* Cancel Job Dialog */}
      <DestructiveConfirmDialog
        open={cancelJobTarget !== null}
        onOpenChange={(op) => !op && setCancelJobTarget(null)}
        title="Cancel this queued/running generation job?"
        description="The generation job will be aborted immediately and marked as cancelled by admin."
        confirmLabel="Cancel Job"
        onConfirm={async (reason) => {
          if (cancelJobTarget) {
            await handleCancelJob(cancelJobTarget.id, reason);
          }
        }}
      />

      {/* Clear Cooldown Dialog */}
      <DestructiveConfirmDialog
        open={clearCooldownTarget !== null}
        onOpenChange={(op) => !op && setClearCooldownTarget(null)}
        title={`Clear cooldown for provider ${clearCooldownTarget?.label ?? ""}?`}
        description="This resets the rate-limit cooldown timestamp for this provider, making it available for subsequent free generation requests immediately."
        confirmLabel="Clear Cooldown"
        confirmVariant="default"
        onConfirm={async (reason) => {
          if (clearCooldownTarget) {
            await handleClearCooldown(clearCooldownTarget.id, reason);
          }
        }}
      />
    </div>
  );
}
