import { useMemo, useState } from "react";

import { content, type Content } from "@/data/content";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { projectErrors, serialize } from "./model";
import { SECTIONS } from "./sections";

/**
 * Visual editor for `src/content.json`. Dev only — loaded lazily by
 * `src/routes/studio.tsx` and never bundled for production.
 */
export function Editor() {
  const [draft, setDraft] = useState<Content>(() => structuredClone(content));
  const [saved, setSaved] = useState<Content>(() => structuredClone(content));
  const [activeId, setActiveId] = useState<string>(SECTIONS[0]?.id ?? "profile");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const set = (fn: (d: Content) => void) => {
    setDraft((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
    setStatus(null);
  };

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  const errors = useMemo(() => projectErrors(draft.projects), [draft.projects]);
  const active = SECTIONS.find((s) => s.id === activeId) ?? SECTIONS[0];

  async function save() {
    if (errors.size) {
      setActiveId("projects");
      setStatus({ kind: "err", msg: "Fix the errors flagged below before saving." });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/__studio/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: serialize(draft),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? res.statusText);
      setSaved(structuredClone(draft));
      setStatus({ kind: "ok", msg: "Saved to src/content.json — the site will refresh." });
    } catch (e) {
      setStatus({ kind: "err", msg: `Save failed: ${String(e)}` });
    } finally {
      setBusy(false);
    }
  }

  function download() {
    const blob = new Blob([serialize(draft)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "content.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function revert() {
    setDraft(structuredClone(saved));
    setStatus(null);
  }

  return (
    <div className="py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-rule pb-4">
        <div>
          <h1 className="display text-4xl">Studio</h1>
          <p className="mt-1 text-sm text-muted">
            Edits <code className="text-ink">src/content.json</code>. Local dev only.
          </p>
        </div>
        <span className={cn("text-xs", dirty ? "text-accent" : "text-muted")}>
          {dirty ? "● Unsaved changes" : "All changes saved"}
        </span>
      </header>

      <div className="grid gap-6 md:grid-cols-[180px_minmax(0,1fr)]">
        <nav className="flex flex-wrap gap-1 md:sticky md:top-20 md:h-fit md:flex-col">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveId(s.id)}
              className={cn(
                "rounded px-3 py-1.5 text-left text-sm text-muted transition-colors hover:text-ink",
                s.id === activeId && "bg-accent/10 text-accent",
              )}
            >
              {s.label}
              {s.id === "projects" && errors.size > 0 ? (
                <span className="ml-1.5 text-red-500">{errors.size}</span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="min-w-0">
          {active?.id === "projects" && errors.size > 0 ? (
            <div className="mb-4 flex flex-col gap-1 rounded-md border border-red-500/40 bg-red-500/5 p-3 text-xs text-red-500">
              {[...errors.entries()].map(([i, m]) => (
                <div key={i}>
                  Project {i + 1}: {m}
                </div>
              ))}
            </div>
          ) : null}
          {active?.render({ draft, set })}
        </div>
      </div>

      <div className="sticky bottom-0 z-10 mt-10 flex flex-wrap items-center gap-3 border-t border-rule bg-paper/95 py-3 backdrop-blur">
        <Button type="button" onClick={save} disabled={busy || !dirty}>
          {busy ? "Saving…" : "Save to content.json"}
        </Button>
        <Button type="button" variant="outline" onClick={revert} disabled={!dirty}>
          Revert
        </Button>
        <Button type="button" variant="ghost" onClick={download}>
          Download JSON
        </Button>
        {status ? (
          <span className={cn("text-xs", status.kind === "ok" ? "text-accent" : "text-red-500")}>
            {status.msg}
          </span>
        ) : null}
      </div>
    </div>
  );
}
