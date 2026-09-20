import { useMemo, useState } from "react";
import { type Content } from "@/data/content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { LivePreview } from "@/components/preview/LivePreview";
import { PublishToolbar } from "@/components/publish/PublishToolbar";
import { cn } from "@/lib/utils";
import { projectErrors, serialize } from "./model";
import { SECTIONS } from "./sections";
import {
  Save,
  RotateCcw,
  Download,
  CheckCircle2,
  AlertCircle,
  Eye,
  Edit3,
  Columns,
  Loader2,
} from "lucide-react";

type ViewMode = "edit" | "preview" | "split";

export function Editor({ initialContent }: { initialContent: Content }) {
  const [draft, setDraft] = useState<Content>(() => structuredClone(initialContent));
  const [saved, setSaved] = useState<Content>(() => structuredClone(initialContent));
  const [activeId, setActiveId] = useState<string>(SECTIONS[0]?.id ?? "profile");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{
    kind: "ok" | "err";
    msg: string;
    issues?: Array<{ path: string; message: string }>;
  } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("split");

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
      setStatus({ kind: "err", msg: "Fix the project errors flagged below before saving." });
      return;
    }
    setBusy(true);
    setStatus(null);

    try {
      const res = await fetch("/api/content", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: draft }),
      });

      const json = (await res.json()) as {
        ok?: boolean;
        error?: { code: string; message: string };
        issues?: Array<{ path: string; message: string }>;
      };

      if (!res.ok || !json.ok) {
        setStatus({
          kind: "err",
          msg: json.error?.message ?? `Save failed (${res.status})`,
          ...(json.issues ? { issues: json.issues } : {}),
        });
        return;
      }

      setSaved(structuredClone(draft));
      setStatus({ kind: "ok", msg: "All changes saved to database draft." });
    } catch (e) {
      setStatus({ kind: "err", msg: `Network or server error: ${String(e)}` });
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
    <div className="space-y-6 pb-20">
      {/* Top Header */}
      <div className="flex flex-col gap-4 border-b border-border/80 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Portfolio Studio</h1>
            <p className="text-xs text-muted-foreground">
              Directly edit structured fields, view live preview, and deploy to Vercel.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("edit")}
                className={cn(
                  "h-7 gap-1.5 px-2.5 text-xs",
                  viewMode === "edit" ? "bg-muted font-semibold text-foreground" : "text-muted-foreground"
                )}
              >
                <Edit3 className="size-3.5" />
                <span className="hidden sm:inline">Editor</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("split")}
                className={cn(
                  "h-7 gap-1.5 px-2.5 text-xs hidden md:flex",
                  viewMode === "split" ? "bg-muted font-semibold text-foreground" : "text-muted-foreground"
                )}
              >
                <Columns className="size-3.5" />
                <span>Split</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("preview")}
                className={cn(
                  "h-7 gap-1.5 px-2.5 text-xs",
                  viewMode === "preview" ? "bg-muted font-semibold text-foreground" : "text-muted-foreground"
                )}
              >
                <Eye className="size-3.5" />
                <span>Preview</span>
              </Button>
            </div>

            {/* Save Status Badge */}
            <Badge
              variant={dirty ? "warning" : "secondary"}
              className="text-[11px] font-normal"
            >
              {dirty ? "● Unsaved edits" : "✓ Saved"}
            </Badge>
          </div>
        </div>

        {/* Publish Toolbar Component */}
        <PublishToolbar onPublishStarted={() => {}} />
      </div>

      {/* Save status notification */}
      {status && (
        <Alert variant={status.kind === "ok" ? "success" : "destructive"}>
          {status.kind === "ok" ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
          <AlertTitle className="text-xs font-semibold">
            {status.kind === "ok" ? "Draft Saved" : "Validation / Save Error"}
          </AlertTitle>
          <AlertDescription className="text-xs space-y-2">
            <p>{status.msg}</p>
            {status.issues && status.issues.length > 0 && (
              <div className="space-y-1 font-mono text-[11px] bg-black/10 p-2 rounded">
                {status.issues.map((iss, i) => (
                  <div key={i}>
                    • <strong>{iss.path}:</strong> {iss.message}
                  </div>
                ))}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Studio Viewport */}
      <div
        className={cn(
          "grid gap-6",
          viewMode === "split" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
        )}
      >
        {/* Left / Editor Column */}
        {(viewMode === "edit" || viewMode === "split") && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
              {/* Section Tabs */}
              <nav
                className="flex flex-row overflow-x-auto gap-1 sm:flex-col sm:overflow-x-visible sticky top-20 h-fit"
                aria-label="Studio sections"
              >
                {SECTIONS.map((s) => {
                  const isSectionActive = s.id === activeId;
                  const hasProjectErrors = s.id === "projects" && errors.size > 0;

                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveId(s.id)}
                      className={cn(
                        "rounded-lg px-3 py-2 text-left text-xs font-medium transition-all whitespace-nowrap",
                        isSectionActive
                          ? "bg-accent text-accent-foreground shadow-xs"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span>{s.label}</span>
                        {hasProjectErrors && (
                          <Badge variant="destructive" className="ml-1.5 px-1 py-0 text-[10px]">
                            {errors.size}
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </nav>

              {/* Form Canvas */}
              <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-xs">
                {active?.id === "projects" && errors.size > 0 && (
                  <Alert variant="destructive" className="mb-4 py-2 text-xs">
                    <AlertTitle>Project Validation Issues</AlertTitle>
                    <AlertDescription className="space-y-1 mt-1">
                      {[...errors.entries()].map(([i, m]) => (
                        <div key={i}>
                          Project {i + 1}: {m}
                        </div>
                      ))}
                    </AlertDescription>
                  </Alert>
                )}

                {active?.render({ draft, set })}
              </div>
            </div>
          </div>
        )}

        {/* Right / Live Preview Column */}
        {(viewMode === "preview" || viewMode === "split") && (
          <div className="sticky top-20 h-[80vh] min-h-[500px]">
            <LivePreview content={draft} />
          </div>
        )}
      </div>

      {/* Sticky Bottom Actions Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/80 bg-background/95 backdrop-blur-md py-3 px-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={save}
              disabled={busy || !dirty}
              className="gap-2 font-semibold bg-accent text-accent-foreground hover:bg-accent/90 shadow-md shadow-accent/20 active:scale-[0.98]"
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  Save Draft
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={revert}
              disabled={!dirty || busy}
              className="gap-1.5"
            >
              <RotateCcw className="size-3.5" />
              Revert
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={download}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground hidden sm:inline-flex"
            >
              <Download className="size-3.5" />
              Download JSON
            </Button>
          </div>

          <span className="text-xs text-muted-foreground font-mono">
            {dirty ? "Unsaved changes in draft" : "All changes saved to database"}
          </span>
        </div>
      </div>
    </div>
  );
}
