import { useEffect, useState, type ComponentType } from "react";
import { createFileRoute } from "@tanstack/react-router";

import type { Content } from "@/data/content";

/**
 * `/studio` — the content editor, ported from the personal-portfolio repo.
 *
 * The real security boundary is `authMiddleware` on `/api/content` (see
 * src/server/auth-middleware.ts) — this route's own loading state is UX
 * only, not the data boundary, per TanStack Start's own auth guidance.
 * There's no login page yet (Antigravity's job), so an unauthenticated
 * visitor just sees a message instead of a broken empty editor.
 */
export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [{ title: "Studio" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: StudioRoute,
});

type LoadState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "error"; message: string }
  | { status: "ready"; content: Content };

function StudioRoute() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    void fetch("/api/content")
      .then(async (res) => {
        if (!alive) return;
        if (res.status === 401) return setState({ status: "unauthenticated" });
        if (!res.ok) return setState({ status: "error", message: res.statusText });
        const json = (await res.json()) as { content: Content };
        setState({ status: "ready", content: json.content });
      })
      .catch((e: unknown) => {
        if (alive) setState({ status: "error", message: String(e) });
      });
    return () => {
      alive = false;
    };
  }, []);

  if (state.status === "loading") {
    return <div className="py-32 text-center text-sm text-muted-foreground">Loading studio…</div>;
  }
  if (state.status === "unauthenticated") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <h1 className="text-2xl font-semibold">Sign in to edit your portfolio</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Studio edits the content behind your live site — sign in first.
        </p>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <h1 className="text-2xl font-semibold">Studio didn't load</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{state.message}</p>
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

  if (!Cmp) return <div className="py-32 text-center text-sm text-muted-foreground">Loading studio…</div>;
  return <Cmp initialContent={initialContent} />;
}
