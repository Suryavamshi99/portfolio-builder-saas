import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  LogOut,
  Loader2,
  Users,
  Globe,
  Briefcase,
  Shield,
  Server,
  Lock,
  LayoutDashboard,
} from "lucide-react";
import { adminApi } from "@/lib/admin-api";
import { registerStepUpHandler } from "@/lib/admin-stepup";
import { SignIn } from "@/components/admin/SignIn";
import { StepUpDialog } from "@/components/admin/StepUpDialog";
import { SecurityPanel } from "@/components/admin/SecurityPanel";
import { OverviewTab } from "@/components/admin/OverviewTab";
import { UsersTab } from "@/components/admin/UsersTab";
import { SitesTab } from "@/components/admin/SitesTab";
import { JobsTab } from "@/components/admin/JobsTab";
import { AuditTab } from "@/components/admin/AuditTab";
import { SystemTab } from "@/components/admin/SystemTab";
import { AdminToast, ToastMessage } from "@/components/admin/AdminToast";

export type AdminTab = "overview" | "users" | "sites" | "jobs" | "audit" | "system" | "security";

interface AdminSearch {
  tab?: AdminTab;
}

const VALID_TABS: AdminTab[] = ["overview", "users", "sites", "jobs", "audit", "system", "security"];

export const Route = createFileRoute("/admin")({
  validateSearch: (search: Record<string, unknown>): AdminSearch => {
    const rawTab = search["tab"];
    if (typeof rawTab === "string" && (VALID_TABS as readonly string[]).includes(rawTab)) {
      return { tab: rawTab as AdminTab };
    }
    return { tab: "overview" };
  },
  head: () => ({ meta: [{ title: "Admin Console — Shipfolio" }] }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const activeTab: AdminTab = search.tab ?? "overview";

  const [phase, setPhase] = React.useState<"checking" | "login" | "dashboard">("checking");

  // Step-up modal coordination
  const [stepUpOpen, setStepUpOpen] = React.useState(false);
  const stepUpResolverRef = React.useRef<((ok: boolean) => void) | null>(null);

  // Toast notifications
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const showToast = React.useCallback((message: string, type: "success" | "error" = "success") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Register step-up dialog hook
  React.useEffect(() => {
    const unregister = registerStepUpHandler(() => {
      return new Promise<boolean>((resolve) => {
        stepUpResolverRef.current = resolve;
        setStepUpOpen(true);
      });
    });
    return unregister;
  }, []);

  // Check admin session on mount
  const checkSession = React.useCallback(async () => {
    setPhase("checking");
    try {
      const session = await adminApi.getSession();
      if (session.authenticated) {
        setPhase("dashboard");
      } else {
        setPhase("login");
      }
    } catch {
      setPhase("login");
    }
  }, []);

  React.useEffect(() => {
    void checkSession();
  }, [checkSession]);

  async function handleLogout() {
    await adminApi.logout();
    setPhase("login");
  }

  function handleTabChange(tabValue: string) {
    void navigate({
      to: "/admin",
      search: { tab: tabValue as AdminTab },
      replace: true,
    });
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
      <div className="py-8">
        <SignIn onDone={() => void checkSession()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-4 px-2 sm:px-4">
      {/* Console Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Shield className="size-5 text-accent" />
            Admin Console
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Founder console for operations, moderation, health inspection, and audit.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleLogout()}
            className="gap-1.5 text-xs h-8"
          >
            <LogOut className="size-3.5" />
            Sign out
          </Button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <div className="overflow-x-auto pb-1">
          <TabsList className="flex w-max min-w-full sm:grid sm:grid-cols-7 gap-1 h-auto p-1.5 bg-muted/60">
            <TabsTrigger value="overview" className="gap-1.5 text-xs py-2 px-3">
              <LayoutDashboard className="size-3.5 shrink-0" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5 text-xs py-2 px-3">
              <Users className="size-3.5 shrink-0" />
              Users
            </TabsTrigger>
            <TabsTrigger value="sites" className="gap-1.5 text-xs py-2 px-3">
              <Globe className="size-3.5 shrink-0" />
              Sites & domains
            </TabsTrigger>
            <TabsTrigger value="jobs" className="gap-1.5 text-xs py-2 px-3">
              <Briefcase className="size-3.5 shrink-0" />
              Jobs & providers
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5 text-xs py-2 px-3">
              <Shield className="size-3.5 shrink-0" />
              Audit log
            </TabsTrigger>
            <TabsTrigger value="system" className="gap-1.5 text-xs py-2 px-3">
              <Server className="size-3.5 shrink-0" />
              System
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-1.5 text-xs py-2 px-3">
              <Lock className="size-3.5 shrink-0" />
              Security
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Overview */}
        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>

        {/* Tab 2: Users */}
        <TabsContent value="users">
          <UsersTab showToast={showToast} />
        </TabsContent>

        {/* Tab 3: Sites & domains */}
        <TabsContent value="sites">
          <SitesTab showToast={showToast} />
        </TabsContent>

        {/* Tab 4: Jobs & providers */}
        <TabsContent value="jobs">
          <JobsTab showToast={showToast} />
        </TabsContent>

        {/* Tab 5: Audit log */}
        <TabsContent value="audit">
          <AuditTab />
        </TabsContent>

        {/* Tab 6: System */}
        <TabsContent value="system">
          <SystemTab />
        </TabsContent>

        {/* Tab 7: Security */}
        <TabsContent value="security">
          <SecurityPanel />
        </TabsContent>
      </Tabs>

      {/* Step-Up Dialog */}
      <StepUpDialog
        open={stepUpOpen}
        onOpenChange={(open) => {
          setStepUpOpen(open);
          if (!open) {
            stepUpResolverRef.current?.(false);
            stepUpResolverRef.current = null;
          }
        }}
        onSuccess={() => {
          stepUpResolverRef.current?.(true);
          stepUpResolverRef.current = null;
        }}
        onCancel={() => {
          stepUpResolverRef.current?.(false);
          stepUpResolverRef.current = null;
        }}
      />

      {/* Global Toast */}
      <AdminToast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
