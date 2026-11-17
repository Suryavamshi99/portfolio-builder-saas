import * as React from "react";

import { apiClient, type ThemeSummary } from "@/lib/api-client";

const FEELS = ["All", "Editorial", "Playable", "App-style", "3D"] as const;

/** Pick a design language for the portfolio, or leave it to the AI. Paid themes show a tag; the server enforces the tier. */
export function ThemePicker({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const [themes, setThemes] = React.useState<ThemeSummary[]>([]);
  const [feel, setFeel] = React.useState<(typeof FEELS)[number]>("All");

  React.useEffect(() => {
    let live = true;
    apiClient.getThemes().then((r) => live && setThemes(r.themes)).catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (themes.length === 0) return null;
  const shown = themes.filter((t) => feel === "All" || t.feel === feel);

  return (
    <div className="space-y-2 rounded-xl border border-border/80 bg-muted/20 p-3.5">
      <div className="text-xs font-semibold text-foreground">Pick a look</div>
      <p className="text-[11px] text-muted-foreground">
        Your portfolio is written from your resume in the style you pick. Or let the AI design it.
      </p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter looks">
        {FEELS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFeel(f)}
            aria-pressed={feel === f}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] ${feel === f ? "border-accent bg-accent/10" : "border-border"}`}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
        <Card selected={value === null} onClick={() => onChange(null)} title="Custom" sub="The AI designs it from your resume." />
        {shown.map((t) => (
          <Card
            key={t.id}
            selected={value === t.id}
            onClick={() => onChange(t.id)}
            title={t.name}
            sub={t.tagline}
            tag={`${t.profession} · ${t.feel}${t.tier === "paid" ? " · Paid" : ""}`}
            palette={t.palette}
            previewHref={`/theme-previews/${t.id}/index.html`}
          />
        ))}
      </div>
    </div>
  );
}

function Card(props: { selected: boolean; onClick: () => void; title: string; sub: string; tag?: string; palette?: string[]; previewHref?: string }) {
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={props.onClick}
        aria-pressed={props.selected}
        className={`flex-1 rounded-lg border p-3 text-left transition-all ${props.selected ? "border-accent bg-accent/10 ring-1 ring-accent" : "border-border hover:border-accent/50"}`}
      >
      {props.palette ? (
        <div className="mb-2 flex h-5 overflow-hidden rounded">
          {props.palette.map((c) => (
            <span key={c} className="flex-1" style={{ background: c }} />
          ))}
        </div>
      ) : null}
      <div className="text-xs font-semibold text-foreground">{props.title}</div>
      {props.tag ? <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{props.tag}</div> : null}
      <div className="mt-0.5 text-[11px] text-muted-foreground">{props.sub}</div>
      </button>
      {props.previewHref ? (
        <a href={props.previewHref} target="_blank" rel="noreferrer" className="mt-1 px-1 text-[11px] text-accent underline-offset-2 hover:underline">
          Preview a sample site ↗
        </a>
      ) : null}
    </div>
  );
}
