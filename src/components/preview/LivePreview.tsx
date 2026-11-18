import * as React from "react";
import { Button } from "@/components/ui/button";
import { Monitor, Tablet, Smartphone, Sparkles, Pencil, Save, Undo2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { inlineEditorScript } from "@/components/preview/inline-editor";
import { PHOTO_ACCEPT, uploadPhotoFile } from "@/components/preview/photo-upload";
import { EDIT_TOKEN_KEY, MAX_EDIT_HTML_CHARS, isAllowedNewImageUrl, type FrameToParent, type ParentToFrame } from "@/lib/inline-edit-protocol";

export type SaveEditResult = { ok: true } | { ok: false; message: string; details?: string[] | undefined; stale?: boolean | undefined };

interface LivePreviewProps {
  html: string;
  /** Shows the "Edit text and photos" toggle. Everything below is only used when it is on. */
  editable?: boolean;
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  /** Called before edit mode starts (the Studio loads the newest saved page). Return false to stay out of edit mode. */
  onStartEdit?: () => Promise<boolean>;
  onSave?: (html: string) => Promise<SaveEditResult>;
  /** After a save was refused because the page changed elsewhere. */
  onReloadLatest?: () => Promise<void>;
}

// In a srcDoc frame a link like href="#experience" resolves against the Shipfolio page and loads it inside the frame.
// The published site is a real page, so this only affects the preview: handle in-page links by scrolling instead.
const PREVIEW_LINK_GUARD = `<script data-sf-preview-guard>document.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest("a[href]"):null;if(!a)return;var h=a.getAttribute("href")||"";if(h.charAt(0)==="#"){e.preventDefault();var id=h.slice(1);var t=id?document.getElementById(decodeURIComponent(id)):null;if(t)t.scrollIntoView();else window.scrollTo(0,0);}else if(!/^(mailto:|tel:)/i.test(h)){e.preventDefault();}},true);</script>`;

function withPreviewScripts(html: string, extra: string): string {
  const scripts = PREVIEW_LINK_GUARD + extra;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, () => `${scripts}</body>`) : html + scripts;
}

function newToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const HINT = "Click any text to change it. Tab moves to the next. Press Save when done.";
type Banner = { kind: "ok" | "err" | "info"; text: string; details?: string[] | undefined; stale?: boolean };

type ViewportMode = "desktop" | "tablet" | "mobile";

const DEVICE_WIDTH: Record<ViewportMode, number> = { desktop: 1280, tablet: 820, mobile: 390 };

export function LivePreview({ html, editable = false, editing = false, onEditingChange, onDirtyChange, onStartEdit, onSave, onReloadLatest }: LivePreviewProps) {
  const [mode, setMode] = React.useState<ViewportMode>("desktop");
  const isEmpty = !html.trim();
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      setSize({ width: Math.max(0, el.clientWidth - padX), height: Math.max(0, el.clientHeight - padY) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [session, setSession] = React.useState(0);
  // `session` is a deliberate dependency: bumping it (Discard) gives a new token and so a fresh frame.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const token = React.useMemo(() => (editing ? newToken() : ""), [editing, session]);
  const tokenRef = React.useRef(token);
  tokenRef.current = token;
  const scrollRef = React.useRef(0);
  const pending = React.useRef(new Map<string, (r: { html: string; scrollY: number }) => void>());
  const pickRef = React.useRef<{ id: string; kind: "photo" | "project_image" } | null>(null);
  const [dirty, setDirtyState] = React.useState(false);
  const dirtyRef = React.useRef(false);
  const [saving, setSaving] = React.useState(false);
  const savingRef = React.useRef(false);
  const [starting, setStarting] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  // A photo spot waiting for a file. Some browsers refuse a programmatic picker opened after an async message,
  // so this also offers a real button (a genuine click in this page) until a file is chosen or the user cancels.
  const [pickWaiting, setPickWaiting] = React.useState(false);
  const choosePhoto = () => {
    if (fileRef.current) {
      fileRef.current.value = "";
      fileRef.current.click();
    }
  };
  const cancelPick = React.useCallback(() => {
    pickRef.current = null;
    setPickWaiting(false);
  }, []);
  const [banner, setBanner] = React.useState<Banner | null>(null);
  const [info, setInfo] = React.useState({ editable: 0, photos: 0, canvas: false });

  const setDirty = React.useCallback(
    (d: boolean) => {
      dirtyRef.current = d;
      setDirtyState(d);
      onDirtyChange?.(d);
    },
    [onDirtyChange],
  );

  const previewHtml = React.useMemo(() => {
    // The token is part of the page text, so a new editing session always means a fresh token and a fresh frame.
    const extra = editing ? inlineEditorScript({ token, parentOrigin: window.location.origin, scrollY: scrollRef.current }) : "";
    return withPreviewScripts(html, extra);
  }, [html, editing, token]);

  const postToFrame = React.useCallback((msg: ParentToFrame) => {
    iframeRef.current?.contentWindow?.postMessage({ ...msg, [EDIT_TOKEN_KEY]: tokenRef.current }, "*");
  }, []);

  const requestHtml = React.useCallback(() => {
    return new Promise<{ html: string; scrollY: number }>((resolve, reject) => {
      const reqId = newToken();
      const timer = window.setTimeout(() => {
        pending.current.delete(reqId);
        reject(new Error("The preview did not answer. Try again."));
      }, 8000);
      pending.current.set(reqId, (r) => {
        window.clearTimeout(timer);
        resolve(r);
      });
      postToFrame({ type: "serialize", reqId });
    });
  }, [postToFrame]);

  const save = React.useCallback(async () => {
    if (!onSave || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setBanner(null);
    try {
      const { html: edited, scrollY } = await requestHtml();
      scrollRef.current = scrollY;
      if (!edited.trim()) throw new Error("Could not read the page. Try again.");
      if (edited.length > MAX_EDIT_HTML_CHARS) throw new Error("This page is too large to save. Remove some content or smaller pictures.");
      const res = await onSave(edited);
      if (res.ok) {
        postToFrame({ type: "saved" });
        setDirty(false);
        setBanner({ kind: "ok", text: "Saved" });
      } else {
        setBanner({ kind: "err", text: res.message, details: res.details, stale: !!res.stale });
      }
    } catch (e: unknown) {
      setBanner({ kind: "err", text: e instanceof Error ? e.message : "Could not save." });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [onSave, requestHtml, postToFrame, setDirty]);

  const requestExit = React.useCallback(() => {
    if (dirtyRef.current && !window.confirm("You have unsaved changes. Leave edit mode and lose them?")) return;
    setDirty(false);
    setBanner(null);
    onEditingChange?.(false);
  }, [onEditingChange, setDirty]);

  const discard = () => {
    if (dirtyRef.current && !window.confirm("Throw away your unsaved changes?")) return;
    setDirty(false);
    setBanner(null);
    setSession((n) => n + 1);
  };

  const startEditing = async () => {
    setStarting(true);
    setBanner(null);
    try {
      if ((await (onStartEdit?.() ?? Promise.resolve(true))) === false) return;
      scrollRef.current = 0;
      setInfo({ editable: 0, photos: 0, canvas: false });
      onEditingChange?.(true);
    } finally {
      setStarting(false);
    }
  };

  const handlePicked = async (file: File) => {
    const target = pickRef.current;
    setPickWaiting(false);
    if (!target) return;
    pickRef.current = null;
    setUploading(true);
    setBanner({ kind: "info", text: "Uploading your photo…" });
    try {
      const url = await uploadPhotoFile(file, target.kind);
      if (!isAllowedNewImageUrl(url)) throw new Error("The picture could not be shown.");
      postToFrame({ type: "set-image", id: target.id, url });
      setBanner({ kind: "info", text: "Photo replaced. Press Save when done." });
    } catch (e: unknown) {
      setBanner({ kind: "err", text: e instanceof Error ? e.message : "The upload failed." });
    } finally {
      setUploading(false);
    }
  };

  // Messages from the frame: only from our own frame window and only with this session's token.
  React.useEffect(() => {
    if (!editing) return;
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const d = e.data as (FrameToParent & Record<string, unknown>) | null;
      if (!d || typeof d !== "object" || d[EDIT_TOKEN_KEY] !== tokenRef.current || typeof d.type !== "string") return;
      switch (d.type) {
        case "ready":
          setInfo({ editable: Number(d.editable) || 0, photos: Number(d.photos) || 0, canvas: d.canvas === true });
          break;
        case "dirty":
          setDirty(d.dirty === true);
          break;
        case "scroll":
          if (typeof d.y === "number") scrollRef.current = d.y;
          break;
        case "save-request":
          void save();
          break;
        case "exit-request":
          if (pickRef.current) cancelPick();
          else requestExit();
          break;
        case "html": {
          const cb = pending.current.get(String(d.reqId));
          if (cb && typeof d.html === "string") {
            pending.current.delete(String(d.reqId));
            cb({ html: d.html, scrollY: typeof d.scrollY === "number" ? d.scrollY : 0 });
          }
          break;
        }
        case "pick-image":
          if (typeof d.id === "string" && /^\d{1,6}$/.test(d.id) && (d.kind === "photo" || d.kind === "project_image")) {
            pickRef.current = { id: d.id, kind: d.kind };
            setPickWaiting(true);
            if (fileRef.current) {
              fileRef.current.value = "";
              fileRef.current.click();
            }
          }
          break;
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !e.defaultPrevented && !document.querySelector("[role=dialog]")) {
        if (pickRef.current) cancelPick();
        else requestExit();
      } else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        void save();
      }
    }
    window.addEventListener("message", onMessage);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("keydown", onKey);
    };
  }, [editing, save, requestExit, setDirty, cancelPick]);

  // Leaving edit mode from outside (regenerate, restore) clears the local state.
  React.useEffect(() => {
    if (!editing) {
      dirtyRef.current = false;
      setDirtyState(false);
    }
  }, [editing]);

  React.useEffect(() => {
    if (!banner || banner.kind !== "ok") return;
    const t = window.setTimeout(() => setBanner(null), 3000);
    return () => window.clearTimeout(t);
  }, [banner]);
  const deviceWidth = DEVICE_WIDTH[mode];
  const scale = size.width > 0 ? Math.min(1, size.width / deviceWidth) : 1;

  return (
    <div className="flex flex-col h-full rounded-xl border border-border bg-card overflow-hidden shadow-xs">
      {/* Viewport controls bar */}
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2 text-xs">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <Sparkles className="size-3.5 text-accent" />
          <span>Client Live Preview</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
        {editable && !isEmpty && (
          <>
            <Button
              type="button"
              variant={editing ? "default" : "outline"}
              size="sm"
              aria-pressed={editing}
              disabled={starting}
              onClick={() => (editing ? requestExit() : void startEditing())}
              title={editing ? "Stop editing (Esc)" : "Change text and pictures right in the preview"}
              className="h-7 gap-1 px-2 text-xs"
            >
              {starting ? <Loader2 className="size-3 animate-spin" /> : <Pencil className="size-3" />}
              {editing ? "Done editing" : "Edit text and photos"}
            </Button>
            {editing && (
              <>
                <Button type="button" size="sm" onClick={() => void save()} disabled={!dirty || saving || uploading} className="h-7 gap-1 px-2 text-xs" title="Save (Ctrl/Cmd+S)">
                  {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={discard} disabled={!dirty || saving} className="h-7 gap-1 px-2 text-xs">
                  <Undo2 className="size-3" />
                  Discard
                </Button>
              </>
            )}
          </>
        )}
        <div className="flex items-center gap-1 bg-background/80 rounded-md p-0.5 border border-border">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMode("desktop")}
            className={`size-6 rounded ${mode === "desktop" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
            aria-label="Desktop preview width"
          >
            <Monitor className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMode("tablet")}
            className={`size-6 rounded ${mode === "tablet" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
            aria-label="Tablet preview width"
          >
            <Tablet className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMode("mobile")}
            className={`size-6 rounded ${mode === "mobile" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
            aria-label="Mobile preview width (390px)"
          >
            <Smartphone className="size-3.5" />
          </Button>
        </div>
        </div>
      </div>

      {editing && (
        <div className="border-b border-border bg-accent/5 px-3 py-1.5 text-xs space-y-1" role="status" aria-live="polite">
          <p className="text-muted-foreground">
            {HINT}
            {dirty && <span className="ml-2 font-medium text-warning">Unsaved changes</span>}
          </p>
          {info.canvas && (
            <p className="text-muted-foreground">Some text on this page is drawn on a canvas, so it can't be edited here. Everything else can.</p>
          )}
          {info.editable === 0 && info.photos === 0 && <p className="text-muted-foreground">Nothing editable was found on this page yet.</p>}
          {pickWaiting && (
            <div className="flex flex-wrap items-center gap-2 font-medium text-foreground">
              <span>Choose a photo for this spot</span>
              <Button type="button" size="sm" className="h-6 px-2 text-xs" autoFocus onClick={choosePhoto}>
                Choose photo
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={cancelPick}>
                Cancel
              </Button>
            </div>
          )}
          {banner && (
            <div className={`flex flex-wrap items-center gap-2 font-medium ${banner.kind === "err" ? "text-destructive" : banner.kind === "ok" ? "text-success" : "text-foreground"}`}>
              {banner.kind === "ok" ? <CheckCircle2 className="size-3.5" /> : banner.kind === "err" ? <AlertCircle className="size-3.5" /> : <Loader2 className="size-3.5 animate-spin" />}
              <span>{banner.text}</span>
              {banner.stale && onReloadLatest && (
                <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => void onReloadLatest().then(() => { setDirty(false); setBanner(null); setSession((n) => n + 1); })}>
                  Reload the latest page (drops your edits)
                </Button>
              )}
              {banner.details && banner.details.length > 0 && (
                <ul className="w-full list-inside list-disc font-normal">
                  {banner.details.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept={PHOTO_ACCEPT}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handlePicked(f);
        }}
      />

      {/* The page is rendered at the real device width and scaled down to fit, so its own
          responsive layout (media queries) matches what a visitor on that device sees. */}
      <div ref={canvasRef} className="relative flex-1 overflow-hidden bg-muted/20 p-2 sm:p-4">
        {isEmpty ? (
          <div className="p-12 text-center text-muted-foreground">
            <p className="text-sm font-medium">Portfolio content is empty.</p>
            <p className="text-xs mt-1">Use the Onboarding Wizard to generate one.</p>
          </div>
        ) : (
          size.width > 0 && (
            <div
              className="mx-auto overflow-hidden rounded-lg border border-border bg-white shadow-md"
              style={{ width: deviceWidth * scale, height: size.height }}
            >
              <iframe
                ref={iframeRef}
                title={editing ? "Portfolio preview, editing" : "Portfolio live preview"}
                srcDoc={previewHtml}
                sandbox="allow-scripts"
                className="block border-0 bg-white"
                style={{
                  width: deviceWidth,
                  height: size.height / scale,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
              />
            </div>
          )
        )}
      </div>
    </div>
  );
}
