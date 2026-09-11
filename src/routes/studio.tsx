import { useEffect, useState, type ComponentType } from "react";
import { createFileRoute } from "@tanstack/react-router";

/**
 * `/studio` — the content editor, ported from the personal-portfolio repo.
 *
 * TEMPORARY: gated behind `import.meta.env.DEV` only until milestone 1/2
 * (auth + per-user DB row) land. Once wired, this becomes an auth check
 * (redirect to /login if no session) instead of an env check — see
 * API.md milestone 2.
 */
export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [{ title: "Studio" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: StudioRoute,
});

function StudioRoute() {
  if (!import.meta.env.DEV) return <Unavailable />;
  return <StudioClient />;
}

function Unavailable() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-2xl font-semibold">Studio isn't wired up yet</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Auth + per-user storage land in milestone 1/2. Run locally in the meantime.
      </p>
    </div>
  );
}

function StudioClient() {
  const [Cmp, setCmp] = useState<ComponentType | null>(null);

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
  return <Cmp />;
}
