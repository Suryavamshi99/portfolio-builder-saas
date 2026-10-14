import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Globe,
  ExternalLink,
  Loader2,
  Trash2,
  ShieldAlert,
} from "lucide-react";
import {
  adminApi,
  AdminSiteSummary,
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

export function SitesTab({
  showToast,
}: {
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [query, setQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [page, setPage] = React.useState(1);

  const [result, setResult] = React.useState<PaginatedResult<AdminSiteSummary> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notAvailable, setNotAvailable] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Destructive actions state
  const [unpublishSiteTarget, setUnpublishSiteTarget] = React.useState<AdminSiteSummary | null>(null);
  const [removeDomainTarget, setRemoveDomainTarget] = React.useState<{ hostname: string; slug: string } | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const loadSites = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotAvailable(false);
    try {
      const res = await adminApi.getSites({
        query: debouncedQuery,
        status: statusFilter,
        page,
        pageSize: 25,
      });
      if (res === null) {
        setNotAvailable(true);
      } else {
        setResult(res);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load sites");
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, statusFilter, page]);

  React.useEffect(() => {
    void loadSites();
  }, [loadSites]);

  async function handleUnpublish(slug: string, reason: string) {
    await adminApi.unpublishSite(slug, { reason });
    showToast(`Site /${slug} unpublished.`);
    void loadSites();
  }

  async function handleRemoveDomain(hostname: string, reason: string) {
    await adminApi.removeDomain({ hostname, reason });
    showToast(`Domain ${hostname} removed.`);
    void loadSites();
  }

  if (notAvailable) {
    return <NotAvailablePanel title="Sites & domains endpoint not available" />;
  }

  const pagination = result
    ? calculatePagination(result.total, result.page, result.pageSize)
    : null;

  return (
    <div className="space-y-4">
      {/* Search & Status Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/60 border border-border/80 rounded-xl p-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by slug or owner email..."
            className="pl-9 text-xs h-9"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-card px-2.5 text-xs text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label="Filter by status"
        >
          <option value="all">All Statuses</option>
          <option value="published">Published</option>
          <option value="unpublished">Unpublished</option>
        </select>
      </div>

      {error && <ErrorState error={error} onRetry={loadSites} />}

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && result && (
        <>
          {result.data.length === 0 ? (
            <EmptyState
              message="No sites found"
              description="No published or drafted sites match your search or filters."
            />
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block rounded-xl border border-border/80 overflow-hidden bg-card">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground border-b border-border/80">
                    <tr>
                      <th className="p-3 font-semibold">Site Slug</th>
                      <th className="p-3 font-semibold">Owner</th>
                      <th className="p-3 font-semibold">Status</th>
                      <th className="p-3 font-semibold">Domain</th>
                      <th className="p-3 font-semibold">Updated</th>
                      <th className="p-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {result.data.map((site) => (
                      <tr key={site.slug} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-semibold text-foreground">
                          <a
                            href={site.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent hover:underline inline-flex items-center gap-1 font-mono"
                          >
                            /{site.slug}
                            <ExternalLink className="size-3" />
                          </a>
                        </td>
                        <td className="p-3 text-muted-foreground font-medium">
                          {site.ownerEmail ?? site.ownerId}
                        </td>
                        <td className="p-3">
                          <StatusBadge status={site.status} />
                        </td>
                        <td className="p-3">
                          {site.domain ? (
                            <div className="flex items-center gap-1.5 font-mono text-[11px]">
                              <span>{site.domain.hostname}</span>
                              <Badge variant="outline" className="text-[9px] uppercase">
                                {site.domain.status}
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">—</span>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          <Tooltip content={formatExactTime(site.updatedAt)}>
                            <span className="underline decoration-dotted">
                              {formatRelativeTime(site.updatedAt)}
                            </span>
                          </Tooltip>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {site.status === "published" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setUnpublishSiteTarget(site)}
                                className="h-7 text-xs text-warning hover:bg-warning/10 border-warning/40"
                              >
                                <ShieldAlert className="size-3 mr-1" />
                                Unpublish
                              </Button>
                            )}
                            {site.domain && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setRemoveDomainTarget({
                                    hostname: site.domain!.hostname,
                                    slug: site.slug,
                                  })
                                }
                                className="h-7 text-xs text-destructive hover:bg-destructive/10 border-destructive/40"
                              >
                                <Trash2 className="size-3 mr-1" />
                                Remove Domain
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked Card View */}
              <div className="md:hidden space-y-2">
                {result.data.map((site) => (
                  <Card key={site.slug} className="border-border/80">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <a
                          href={site.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-xs text-accent hover:underline flex items-center gap-1 font-mono"
                        >
                          /{site.slug}
                          <ExternalLink className="size-3" />
                        </a>
                        <StatusBadge status={site.status} />
                      </div>

                      <div className="text-[11px] text-muted-foreground space-y-1">
                        <div>Owner: <span className="text-foreground">{site.ownerEmail ?? site.ownerId}</span></div>
                        {site.domain && (
                          <div className="flex items-center gap-1">
                            <Globe className="size-3 text-accent" />
                            <span className="font-mono">{site.domain.hostname}</span>
                            <Badge variant="outline" className="text-[9px] uppercase">
                              {site.domain.status}
                            </Badge>
                          </div>
                        )}
                        <div>Updated: {formatRelativeTime(site.updatedAt)}</div>
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-border/60">
                        {site.status === "published" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setUnpublishSiteTarget(site)}
                            className="h-7 text-xs text-warning flex-1"
                          >
                            Unpublish
                          </Button>
                        )}
                        {site.domain && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setRemoveDomainTarget({
                                hostname: site.domain!.hostname,
                                slug: site.slug,
                              })
                            }
                            className="h-7 text-xs text-destructive flex-1"
                          >
                            Remove Domain
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination Controls */}
              {pagination && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
                  <div>
                    Showing {pagination.startIndex}–{pagination.endIndex} of {result.total} sites
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

      {/* Unpublish Confirmation Dialog */}
      <DestructiveConfirmDialog
        open={unpublishSiteTarget !== null}
        onOpenChange={(op) => !op && setUnpublishSiteTarget(null)}
        title={`Unpublish site /${unpublishSiteTarget?.slug ?? ""}?`}
        description="This will immediately take down the site. The URL will return 404 until republished."
        confirmLabel="Unpublish Site"
        onConfirm={async (reason) => {
          if (unpublishSiteTarget) {
            await handleUnpublish(unpublishSiteTarget.slug, reason);
          }
        }}
      />

      {/* Remove Domain Confirmation Dialog */}
      <DestructiveConfirmDialog
        open={removeDomainTarget !== null}
        onOpenChange={(op) => !op && setRemoveDomainTarget(null)}
        title={`Remove custom domain ${removeDomainTarget?.hostname ?? ""}?`}
        description="This will remove the domain mapping from edge routing and delete the record. Traffic to this domain will stop resolving."
        confirmLabel="Remove Domain"
        onConfirm={async (reason) => {
          if (removeDomainTarget) {
            await handleRemoveDomain(removeDomainTarget.hostname, reason);
          }
        }}
      />
    </div>
  );
}
