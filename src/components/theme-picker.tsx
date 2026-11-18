import * as React from "react";

import { apiClient, type ThemeCustom, type ThemeSummary } from "@/lib/api-client";

const FEELS = ["All", "Editorial", "Playable", "App-style", "3D"] as const;
/** What each feel is called on screen. The stored values stay as they are. */
const FEEL_LABEL: Record<string, string> = { All: "All", Editorial: "Classic", Playable: "Game-like", "App-style": "Looks like an app", "3D": "3D" };

/** Pick a design language for the portfolio, or leave it to the AI. Themes are grouped by profession and tagged by feel. Paid themes show a tag; the server enforces the tier. */
export function ThemePicker({
  value,
  onChange,
  custom,
  onCustomChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  /** With onCustomChange, a chosen theme shows the "Make it yours" panel. */
  custom?: ThemeCustom | undefined;
  onCustomChange?: ((c: ThemeCustom | undefined) => void) | undefined;
}) {
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
  // Changing the look starts the "Make it yours" choices over: they belong to one theme's layout.
  const pick = (id: string | null) => {
    if (id !== value) onCustomChange?.(undefined);
    onChange(id);
  };
  const chosen = themes.find((t) => t.id === value);
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
      <Card selected={value === null} onClick={() => pick(null)} title="Custom" sub="The AI designs it from your resume." />
      {groups.map((g) => (
        <section key={g.profession} aria-label={g.profession} className="space-y-1.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.profession}</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {g.items.map((t) => (
              <Card
                key={t.id}
                selected={value === t.id}
                onClick={() => pick(t.id)}
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
      {chosen && onCustomChange && chosen.sections.length > 0 ? <MakeItYours key={chosen.id} theme={chosen} value={custom} onChange={onCustomChange} /> : null}
    </div>
  );
}

const SECTION_LABEL: Record<string, string> = {
  about: "About me",
  experience: "Experience",
  projects: "Projects",
  skills: "Skills",
  education: "Education",
  achievements: "Achievements",
  certifications: "Certifications",
  testimonials: "Recommendations",
  extras: "More about me",
  contact: "Contact",
};
const SWATCHES = ["#2563eb", "#7c3aed", "#db2777", "#dc2626", "#ea580c", "#16a34a", "#0d9488", "#111827"];
const FONT_FEELS: Array<{ id: NonNullable<ThemeCustom["fonts"]>; label: string }> = [
  { id: "theme", label: "This look's own" },
  { id: "serif", label: "Classic (serif)" },
  { id: "sans", label: "Clean (sans-serif)" },
  { id: "mono", label: "Typewriter" },
];
const HEX = /^#[0-9a-fA-F]{6}$/;

/** Only what differs from the theme's defaults goes to the server; undefined when nothing was changed. */
function compactCustom(c: ThemeCustom, sections: string[]): ThemeCustom | undefined {
  const order = (c.order ?? []).filter((k) => sections.includes(k));
  const orderChanged = order.some((k, i) => k !== sections[i]);
  const out: ThemeCustom = {
    ...(c.accent && HEX.test(c.accent) ? { accent: c.accent } : {}),
    ...(c.fonts && c.fonts !== "theme" ? { fonts: c.fonts } : {}),
    ...((c.hidden ?? []).length > 0 ? { hidden: c.hidden! } : {}),
    ...(orderChanged ? { order } : {}),
  };
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Colour, font feel and which sections to show, in what order, for the chosen look. */
function MakeItYours({ theme, value, onChange }: { theme: ThemeSummary; value: ThemeCustom | undefined; onChange: (c: ThemeCustom | undefined) => void }) {
  const cur: ThemeCustom = value ?? {};
  const [hex, setHex] = React.useState(cur.accent ?? "");
  const hexBad = hex !== "" && !HEX.test(hex);
  const set = (patch: Partial<ThemeCustom>) => onChange(compactCustom({ ...cur, ...patch }, theme.sections));

  // The order shown: sections the user moved first, then the rest in the theme's own order.
  const moved = (cur.order ?? []).filter((k) => theme.sections.includes(k));
  const list = [...moved, ...theme.sections.filter((k) => !moved.includes(k))];
  const hidden = cur.hidden ?? [];
  const move = (i: number, d: -1 | 1) => {
    const next = [...list];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    set({ order: next });
  };
  const toggle = (k: string) => set({ hidden: hidden.includes(k) ? hidden.filter((h) => h !== k) : [...hidden, k] });
  const accent = cur.accent ?? theme.defaultAccent;

  return (
    <div className="space-y-3 rounded-lg border border-accent/40 bg-background p-3" role="group" aria-label={`Make the ${theme.name} look yours`}>
      <div>
        <div className="text-xs font-semibold text-foreground">Make it yours</div>
        <p className="text-[11px] text-muted-foreground">Optional. Change the colour, the type or the sections of {theme.name}.</p>
      </div>

      <div className="space-y-1.5">
        <div className="text-[11px] font-medium text-foreground">Main colour</div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setHex("");
              set({ accent: undefined });
            }}
            aria-pressed={!cur.accent}
            aria-label="This look's own colour"
            title="This look's own colour"
            className={`h-7 w-7 rounded-full border-2 ${!cur.accent ? "border-foreground" : "border-border"}`}
            style={{ backgroundColor: theme.defaultAccent }}
          />
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setHex(c);
                set({ accent: c });
              }}
              aria-pressed={accent.toLowerCase() === c && Boolean(cur.accent)}
              aria-label={`Use colour ${c}`}
              className={`h-7 w-7 rounded-full border-2 ${cur.accent?.toLowerCase() === c ? "border-foreground" : "border-border"}`}
              style={{ backgroundColor: c }}
            />
          ))}
          <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className="sr-only">Colour code, for example #2563eb</span>
            <input
              value={hex}
              onChange={(e) => {
                const v = e.target.value.trim();
                setHex(v);
                if (HEX.test(v)) set({ accent: v.toLowerCase() });
              }}
              placeholder="#2563eb"
              maxLength={7}
              spellCheck={false}
              aria-invalid={hexBad}
              className="w-20 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground"
            />
          </label>
        </div>
        {hexBad ? <p className="text-[11px] text-destructive">Use a colour code like #2563eb (a # and six letters or digits).</p> : null}
      </div>

      <div className="space-y-1.5">
        <div className="text-[11px] font-medium text-foreground">Type style</div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Type style">
          {FONT_FEELS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => set({ fonts: f.id })}
              aria-pressed={(cur.fonts ?? "theme") === f.id}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] ${(cur.fonts ?? "theme") === f.id ? "border-accent bg-accent/10" : "border-border"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-[11px] font-medium text-foreground">Sections</div>
        <p className="text-[11px] text-muted-foreground">Untick to hide one, use the arrows to move it. A section with nothing in your resume is left out anyway.</p>
        <ul className="space-y-1">
          {list.map((k, i) => (
            <li key={k} className="flex items-center gap-2 rounded-md border border-border/70 px-2 py-1">
              <label className="flex min-w-0 flex-1 items-center gap-2 text-[11px] text-foreground">
                <input type="checkbox" checked={!hidden.includes(k)} onChange={() => toggle(k)} />
                <span className="truncate">{SECTION_LABEL[k] ?? k}</span>
              </label>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${SECTION_LABEL[k] ?? k} up`} className="rounded border border-border px-1.5 text-[11px] disabled:opacity-30">
                ↑
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label={`Move ${SECTION_LABEL[k] ?? k} down`} className="rounded border border-border px-1.5 text-[11px] disabled:opacity-30">
                ↓
              </button>
            </li>
          ))}
        </ul>
      </div>
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
