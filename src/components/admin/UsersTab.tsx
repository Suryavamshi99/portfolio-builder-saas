import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  Globe,
  Loader2,
  ExternalLink,
} from "lucide-react";
import {
  adminApi,
  AdminUserSummary,
  PaginatedResult,
  calculatePagination,
  formatBytes,
  formatRelativeTime,
  formatExactTime,
} from "@/lib/admin-api";
import { StatusBadge } from "./StatusBadge";
import { UserDetailDrawer } from "./UserDetailDrawer";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { NotAvailablePanel } from "./NotAvailablePanel";
import { Tooltip } from "@/components/ui/tooltip";

export function UsersTab({
  showToast,
}: {
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [query, setQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [planFilter, setPlanFilter] = React.useState<"all" | "free" | "pro">("all");
  const [adminOnly, setAdminOnly] = React.useState(false);
  const [siteFilter, setSiteFilter] = React.useState<"all" | "published">("all");
  const [page, setPage] = React.useState(1);

  const [result, setResult] = React.useState<PaginatedResult<AdminUserSummary> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notAvailable, setNotAvailable] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);

  // Debounce search query 400ms
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [query]);

  const loadUsers = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotAvailable(false);
    try {
      const res = await adminApi.getUsers({
        query: debouncedQuery,
        plan: planFilter,
        admin: adminOnly || undefined,
        site: siteFilter,
        page,
        pageSize: 25,
      });
      if (res === null) {
        setNotAvailable(true);
      } else {
        setResult(res);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, planFilter, adminOnly, siteFilter, page]);

  React.useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  if (notAvailable) {
    return <NotAvailablePanel title="Users endpoint not available" />;
  }

  const pagination = result
    ? calculatePagination(result.total, result.page, result.pageSize)
    : null;

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/60 border border-border/80 rounded-xl p-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users by email..."
            className="pl-9 text-xs h-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Plan Filter */}
          <select
            value={planFilter}
            onChange={(e) => {
              setPlanFilter(e.target.value as "all" | "free" | "pro");
              setPage(1);
            }}
            className="h-9 rounded-md border border-input bg-card px-2.5 text-xs text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Filter by plan"
          >
            <option value="all">All Plans</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
          </select>

          {/* Admin Toggle */}
          <Button
            size="sm"
            variant={adminOnly ? "default" : "outline"}
            onClick={() => {
              setAdminOnly(!adminOnly);
              setPage(1);
            }}
            className="h-9 text-xs"
          >
            Admins only
          </Button>

          {/* Published Site Filter */}
          <Button
            size="sm"
            variant={siteFilter === "published" ? "default" : "outline"}
            onClick={() => {
              setSiteFilter(siteFilter === "published" ? "all" : "published");
              setPage(1);
            }}
            className="h-9 text-xs"
          >
            Has Site
          </Button>
        </div>
      </div>

      {error && <ErrorState error={error} onRetry={loadUsers} />}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Content */}
      {!loading && result && (
        <>
          {result.data.length === 0 ? (
            <EmptyState
              message="No users match your criteria"
              description="Try adjusting your email search query or active filter settings."
            />
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block rounded-xl border border-border/80 overflow-hidden bg-card">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground border-b border-border/80">
                    <tr>
                      <th className="p-3 font-semibold">User</th>
                      <th className="p-3 font-semibold">Plan</th>
                      <th className="p-3 font-semibold">Role</th>
                      <th className="p-3 font-semibold">Storage</th>
                      <th className="p-3 font-semibold">Site</th>
                      <th className="p-3 font-semibold">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {result.data.map((u) => (
                      <tr
                        key={u.id}
                        onClick={() => setSelectedUserId(u.id)}
                        className="hover:bg-muted/30 cursor-pointer transition-colors"
                      >
                        <td className="p-3 font-medium text-foreground">
                          <div className="truncate max-w-xs">{u.email ?? u.id}</div>
                          {u.email && <div className="text-[10px] text-muted-foreground font-mono">{u.id}</div>}
                        </td>
                        <td className="p-3">
                          <StatusBadge status={u.plan} />
                        </td>
                        <td className="p-3">
                          {u.isAdmin ? (
                            <Badge variant="accent" className="text-[10px] uppercase">Admin</Badge>
                          ) : (
                            <span className="text-muted-foreground">User</span>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground font-mono">
                          {formatBytes(u.storageUsedBytes)}
                        </td>
                        <td className="p-3">
                          {u.siteSlug ? (
                            <a
                              href={`/s/${u.siteSlug}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-accent hover:underline inline-flex items-center gap-1 font-mono text-[11px]"
                            >
                              /{u.siteSlug}
                              <ExternalLink className="size-3" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          <Tooltip content={formatExactTime(u.createdAt)}>
                            <span className="underline decoration-dotted">
                              {formatRelativeTime(u.createdAt)}
                            </span>
                          </Tooltip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked Card View */}
              <div className="md:hidden space-y-2">
                {result.data.map((u) => (
                  <Card
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className="border-border/80 cursor-pointer hover:border-accent/40 transition-colors"
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-foreground">
                          {u.email ?? u.id}
                        </span>
                        <div className="flex items-center gap-1">
                          <StatusBadge status={u.plan} />
                          {u.isAdmin && (
                            <Badge variant="accent" className="text-[9px] uppercase">
                              Admin
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1 font-mono">
                          <HardDrive className="size-3" />
                          {formatBytes(u.storageUsedBytes)}
                        </span>
                        <span>Joined {formatRelativeTime(u.createdAt)}</span>
                        {u.siteSlug && (
                          <span className="inline-flex items-center gap-1 text-accent font-mono">
                            <Globe className="size-3" />
                            /{u.siteSlug}
                          </span>
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
                    Showing {pagination.startIndex}–{pagination.endIndex} of {result.total} accounts
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

      {/* User Detail Drawer */}
      <UserDetailDrawer
        userId={selectedUserId}
        open={selectedUserId !== null}
        onOpenChange={(op) => !op && setSelectedUserId(null)}
        onUserMutated={() => void loadUsers()}
        showToast={showToast}
      />
    </div>
  );
}
