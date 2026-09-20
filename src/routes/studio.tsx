import { useEffect, useState, type ComponentType } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { isPortfolioReady } from "@/lib/portfolio-gate";

import type { Content } from "@/data/content";

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [{ title: "Studio — Shipfolio" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: StudioPage,
});

function StudioPage() {
  return (
    <AuthGuard actionName="edit your portfolio in the Studio">
      <StudioRoute />
    </AuthGuard>
  );
}

type LoadState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "error"; message: string }
  | { status: "ready"; content: Content };

function StudioRoute() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const navigate = useNavigate();

  useEffect(() => {
    if (state.status === "ready" && !isPortfolioReady(state.content)) {
      void navigate({ to: "/onboarding" });
    }
  }, [state, navigate]);

  const loadContent = () => {
    setState({ status: "loading" });
    let alive = true;
    void fetch("/api/content")
      .then(async (res) => {
        if (!alive) return;
        if (res.status === 401) return setState({ status: "unauthenticated" });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return setState({ status: "error", message: err?.error?.message ?? res.statusText });
        }
        const json = (await res.json()) as { content: Content };
        setState({ status: "ready", content: json.content });
      })
      .catch((e: unknown) => {
        if (alive) setState({ status: "error", message: String(e) });
      });
    return () => {
      alive = false;
    };
  };

  useEffect(() => {
    const cleanup = loadContent();
    return cleanup;
  }, []);

  if (state.status === "loading") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center" role="status">
        <Loader2 className="size-8 animate-spin text-accent" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Loading your portfolio draft…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-md py-20">
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="size-5" />
            </div>
            <CardTitle className="text-destructive">Failed to Load Content</CardTitle>
            <CardDescription className="text-xs">{state.message}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={loadContent} variant="outline" className="gap-2">
              <RefreshCw className="size-3.5" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.status === "unauthenticated") {
    return null; // Handled by AuthGuard
  }

  if (!isPortfolioReady(state.content)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center" role="status">
        <Loader2 className="size-8 animate-spin text-accent" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          No portfolio yet — taking you to the wizard…
        </p>
      </div>
    );
  }

  return <StudioClient initialContent={state.content} />;
}

function StudioClient({ initialContent }: { initialContent: Content }) {
  const [Cmp, setCmp] = useState<ComponentType<{ initialContent: Content }> | null>(null);

  useEffect(() => {
    let alive = true;
    void import("./-studio/Editor").then((m) => {
      if (alive) setCmp(() => m.Editor);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!Cmp) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-center" role="status">
        <Loader2 className="size-6 animate-spin text-accent" />
        <span className="text-xs text-muted-foreground">Preparing editor…</span>
      </div>
    );
  }

  return <Cmp initialContent={initialContent} />;
}
