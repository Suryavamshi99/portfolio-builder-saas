import * as React from "react";

import { apiClient, type ThemeSummary } from "@/lib/api-client";

const FEELS = ["All", "Editorial", "Playable", "App-style", "3D"] as const;
/** What each feel is called on screen. The stored values stay as they are. */
const FEEL_LABEL: Record<string, string> = { All: "All", Editorial: "Classic", Playable: "Game-like", "App-style": "Looks like an app", "3D": "3D" };

/** Pick a design language for the portfolio, or leave it to the AI. Themes are grouped by profession and tagged by feel. Paid themes show a tag; the server enforces the tier. */
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
  // Professions in the order the roster first mentions them, so the gallery order follows the roster.
  const groups = [...new Set(shown.map((t) => t.profession))].map((p) => ({ profession: p, items: shown.filter((t) => t.profession === p) }));

  return (
    <div className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-3.5">
      <div>
        <div className="text-xs font-semibold text-foreground">Pick a look</div>
        <p className="text-[11px] text-muted-foreground">
          Your portfolio is written from your resume in the style you pick. Or let the AI design it.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter looks by feel">
        {FEELS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFeel(f)}
            aria-pressed={feel === f}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] ${feel === f ? "border-accent bg-accent/10" : "border-border"}`}
          >
            {FEEL_LABEL[f]}
          </button>
        ))}
      </div>
      <Card selected={value === null} onClick={() => onChange(null)} title="Custom" sub="The AI designs it from your resume." />
      {groups.map((g) => (
        <section key={g.profession} aria-label={g.profession} className="space-y-1.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.profession}</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {g.items.map((t) => (
              <Card
                key={t.id}
                selected={value === t.id}
                onClick={() => onChange(t.id)}
                title={t.name}
                sub={t.tagline}
                tag={`${FEEL_LABEL[t.feel] ?? t.feel}${t.tier === "paid" ? " · Paid" : ""}`}
                thumb={`/theme-thumbs/${t.id}.jpg`}
                previewHref={`/theme-previews/${t.id}/index.html`}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Card(props: {
  selected: boolean;
  onClick: () => void;
  title: string;
  sub: string;
  tag?: string;
  thumb?: string;
  previewHref?: string;
}) {
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={props.onClick}
        aria-pressed={props.selected}
        className={`flex flex-1 items-start gap-3 rounded-lg border p-2.5 text-left transition-all ${props.selected ? "border-accent bg-accent/10 ring-1 ring-accent" : "border-border hover:border-accent/50"}`}
      >
        {props.thumb ? (
          <img src={props.thumb} alt="" width={72} height={72} loading="lazy" className="h-[72px] w-[72px] shrink-0 rounded-md border border-border/60 object-cover object-top" />
        ) : null}
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-foreground">{props.title}</span>
          {props.tag ? <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">{props.tag}</span> : null}
          <span className="mt-0.5 block text-[11px] text-muted-foreground">{props.sub}</span>
        </span>
      </button>
      {props.previewHref ? (
        <a href={props.previewHref} target="_blank" rel="noreferrer" className="mt-1 px-1 text-[11px] text-accent underline-offset-2 hover:underline">
          Preview a sample site ↗
        </a>
      ) : null}
    </div>
  );
}
