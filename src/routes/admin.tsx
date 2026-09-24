import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ShieldAlert, LogOut, Trash2, Pencil, Loader2, KeyRound, Globe, HardDrive } from "lucide-react";
import type { AdminUserSummary } from "@/server/admin-users";

// No link to this route exists anywhere in the app's UI, by design — see
// the conversation that introduced it. Reaching it means knowing the URL.
export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Shipfolio" }] }),
  component: AdminPage,
});

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

type UserDetail = {
  id: string;
  email: string | null;
  createdAt: string;
  plan: "free" | "pro";
  portfolio: { content: unknown; updatedAt: string } | null;
  uploads: { id: string; kind: string; filename: string; size_bytes: number; created_at: string }[];
  byokProviders: { provider: string; created_at: string }[];
  vercelConnection: { vercel_username: string | null; connected_at: string } | null;
};

function AdminPage() {
  const [phase, setPhase] = React.useState<"checking" | "login" | "dashboard">("checking");
  const [loginError, setLoginError] = React.useState<string | null>(null);
  const [loginLoading, setLoginLoading] = React.useState(false);

  const [users, setUsers] = React.useState<AdminUserSummary[] | null>(null);
  const [listError, setListError] = React.useState<string | null>(null);

  const [selected, setSelected] = React.useState<UserDetail | null>(null);
  const [contentDraft, setContentDraft] = React.useState("");
  const [contentError, setContentError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<AdminUserSummary | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const loadUsers = React.useCallback(async () => {
    setListError(null);
    const res = await fetch("/api/admin/users");
    if (!res.ok) {
      setListError("Could not load users.");
      return;
    }
    const data = (await res.json()) as { users: AdminUserSummary[] };
    setUsers(data.users);
  }, []);

  React.useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/session");
      if (res.ok) {
        setPhase("dashboard");
        void loadUsers();
      } else {
        setPhase("login");
      }
    })();
  }, [loadUsers]);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setLoginError(data?.error?.message ?? "Sign-in failed");
        return;
      }
      setPhase("dashboard");
      void loadUsers();
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setUsers(null);
    setPhase("login");
  }

  async function openUser(userId: string) {
    const res = await fetch(`/api/admin/users/${userId}`);
    if (!res.ok) return;
    const detail = (await res.json()) as UserDetail;
    setSelected(detail);
    setContentDraft(JSON.stringify(detail.portfolio?.content ?? {}, null, 2));
    setContentError(null);
  }

  async function saveSelected(planOverride?: "free" | "pro") {
    if (!selected) return;
    setContentError(null);

    let parsedContent: unknown;
    try {
      parsedContent = JSON.parse(contentDraft);
    } catch {
      setContentError("Portfolio content is not valid JSON.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${selected.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: planOverride ?? selected.plan, content: parsedContent }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setContentError(data?.error?.message ?? "Save failed");
        return;
      }
      if (planOverride) setSelected({ ...selected, plan: planOverride });
      void loadUsers();
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${pendingDelete.id}`, { method: "DELETE" });
      if (res.ok) {
        setPendingDelete(null);
        setSelected(null);
        void loadUsers();
      }
    } finally {
      setDeleting(false);
    }
  }

  if (phase === "checking") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (phase === "login") {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center space-y-6">
        <div className="space-y-1 text-center">
          <ShieldAlert className="mx-auto size-8 text-accent" />
          <h1 className="text-xl font-bold text-foreground">Admin sign-in</h1>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="admin-username" className="text-xs font-medium text-muted-foreground">
              Username
            </label>
            <Input id="admin-username" name="username" autoComplete="off" required />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="admin-password" className="text-xs font-medium text-muted-foreground">
              Password
            </label>
            <Input id="admin-password" name="password" type="password" autoComplete="off" required />
          </div>
          {loginError && (
            <Alert variant="destructive">
              <AlertDescription>{loginError}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" className="w-full" disabled={loginLoading}>
            {loginLoading ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Admin</h1>
          <p className="text-sm text-muted-foreground">{users?.length ?? 0} accounts</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void handleLogout()} className="gap-1.5">
          <LogOut className="size-3.5" />
          Sign out
        </Button>
      </div>

      {listError && (
        <Alert variant="destructive">
          <AlertDescription>{listError}</AlertDescription>
        </Alert>
      )}

      {!users ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <Card key={u.id} className="border-border/80">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">{u.email ?? u.id}</span>
                    <Badge variant={u.plan === "pro" ? "default" : "secondary"} className="text-[10px] uppercase">
                      {u.plan}
                    </Badge>
                    {u.hasPortfolioContent && (
                      <Badge variant="outline" className="text-[10px]">
                        has portfolio
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>Joined {new Date(u.createdAt).toLocaleDateString()}</span>
                    <span className="inline-flex items-center gap-1">
                      <HardDrive className="size-3" />
                      {formatBytes(u.storageUsedBytes)}
                    </span>
                    {u.vercelConnected && (
                      <span className="inline-flex items-center gap-1">
                        <Globe className="size-3" />
                        Vercel connected
                      </span>
                    )}
                    {u.byokProviders.length > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <KeyRound className="size-3" />
                        {u.byokProviders.join(", ")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => void openUser(u.id)} className="gap-1.5">
                    <Pencil className="size-3.5" />
                    View / Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPendingDelete(u)}
                    className="gap-1.5 text-destructive hover:border-destructive/40 hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={selected != null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.email ?? selected.id}</DialogTitle>
                <DialogDescription>
                  Joined {new Date(selected.createdAt).toLocaleString()} · {selected.uploads.length} upload(s)
                  {selected.vercelConnection ? ` · Vercel: ${selected.vercelConnection.vercel_username ?? "connected"}` : ""}
                  {selected.byokProviders.length > 0
                    ? ` · BYOK: ${selected.byokProviders.map((k) => k.provider).join(", ")}`
                    : ""}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Plan</span>
                  <Button
                    size="sm"
                    variant={selected.plan === "free" ? "default" : "outline"}
                    onClick={() => void saveSelected("free")}
                    disabled={saving}
                  >
                    Free
                  </Button>
                  <Button
                    size="sm"
                    variant={selected.plan === "pro" ? "default" : "outline"}
                    onClick={() => void saveSelected("pro")}
                    disabled={saving}
                  >
                    Pro
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Portfolio content (raw JSON)</span>
                  <Textarea
                    value={contentDraft}
                    onChange={(e) => setContentDraft(e.target.value)}
                    className="h-64 font-mono text-xs"
                    spellCheck={false}
                  />
                  {contentError && <p className="text-xs text-destructive">{contentError}</p>}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Close
                </Button>
                <Button onClick={() => void saveSelected()} disabled={saving}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : "Save content"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={pendingDelete != null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this account?</DialogTitle>
            <DialogDescription>
              This permanently deletes {pendingDelete?.email ?? pendingDelete?.id} — their auth account, portfolio,
              uploads (including storage files), BYOK keys, and Vercel connection. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting ? <Loader2 className="size-4 animate-spin" /> : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
