import type { PortfolioFacts, SectionKey } from "../../facts";
import { accentColour, attr, esc, fontOverride, googleFontsHref, photoTag, safeHref, scriptTag, visibleSections } from "../helpers";
import type { ThemeTemplate } from "../types";

// "Spreadsheet": the portfolio as a workbook. One sheet tab per visible section, real cells you can select (click or arrow keys),
// and a formula bar that shows the selected cell's text. Every cell comes from the facts; nothing is computed or invented.

const DEFAULT_ACCENT = "#0b57d0";
const BG = "#f9fbfd";
const SECTIONS: SectionKey[] = ["about", "experience", "projects", "skills", "education", "achievements", "certifications", "testimonials", "extras", "contact"];

interface Cell {
  html: string;
  cls?: string;
  span?: number;
  rowspan?: number;
  h?: string | undefined; // label shown above the value on small screens
  full?: string | undefined; // text for the formula bar when it differs from the cell's own text
}

const td = (c: Cell): string =>
  `<td${c.cls ? ` class="${c.cls}"` : ""}${c.span && c.span > 1 ? ` colspan="${c.span}"` : ""}${c.rowspan ? ` rowspan="${c.rowspan}"` : ""}${c.h ? ` data-h="${attr(c.h)}"` : ""}${c.full ? ` data-full="${attr(c.full)}"` : ""}>${c.html}</td>`;

const t = (text: string | undefined, extra: Partial<Cell> = {}): Cell => ({ html: text ? esc(text) : "", ...extra });
const ln = (text: string, cls = ""): string => `<div class="ln${cls ? ` ${cls}` : ""}">${esc(text)}</div>`;
const anchor = (href: string, text: string): string => `<a href="${attr(href)}"${/^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : ""}>${esc(text)}</a>`;

/** One table row: row number header, the gutter column, the cells, then empty cells out to the last column. */
function row(cells: Cell[], total: number, opts: { cls?: string; lead?: number } = {}): string {
  const used = 1 + (opts.lead ?? 0) + cells.reduce((n, c) => n + (c.span ?? 1), 0);
  const fill = Math.max(0, total - used);
  return `<tr${opts.cls ? ` class="${opts.cls}"` : ""}><th class="rh" scope="row"></th><td class="fill"></td>${cells.map(td).join("")}${'<td class="fill"></td>'.repeat(fill)}</tr>`;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function table(widths: number[], rows: string[]): string {
  const total = widths.length;
  const cols = `<col class="c0">${widths.map((w) => `<col style="width:${w}px">`).join("")}`;
  const head = `<thead aria-hidden="true"><tr><th class="corner"></th>${widths.map((_, i) => `<th class="cl" data-l="${LETTERS[i] ?? ""}"></th>`).join("")}</tr></thead>`;
  const empty = row([], total, { cls: "fr" }).repeat(26);
  return `<table class="g"><colgroup>${cols}</colgroup>${head}<tbody>${rows.join("")}${empty}</tbody></table>`;
}

/** Pad a column-width list with empty columns so the sheet always runs past the content. */
const pad = (w: number[]): number[] => {
  const out = [28, ...w];
  while (out.length < 11) out.push(100);
  return out;
};

const hdr = (text: string, extra: Partial<Cell> = {}): Cell => ({ html: esc(text), cls: "hdr", ...extra });

// ---- the sheets ------------------------------------------------------------------------------------------------------

function summarySheet(f: PortfolioFacts, aboutOn: boolean, contactOn: boolean): string {
  const widths = pad([150, 150, 200, 200, 150, 150]);
  const total = widths.length;
  const photo = photoTag(f, { alt: f.name, className: "cimg" });
  const span = photo ? 5 : 7;
  const right: Cell[][] = [];
  right.push([{ html: esc(f.name), cls: "name def", span }]);
  if (f.headline) right.push([{ html: esc(f.headline), cls: "headline", span }]);
  if (aboutOn && f.tagline) right.push([{ html: esc(f.tagline), cls: "tagline", span }]);
  if (aboutOn && f.summary) right.push([{ html: esc(f.summary), cls: "para", span }]);
  if (f.location) right.push([{ html: "Based in", cls: "mute", span: 1 }, { html: esc(f.location), span: span - 1 }]);
  const pills: string[] = [];
  const href = contactOn ? safeHref(f.email ? `mailto:${f.email}` : undefined) : null;
  if (href && f.email) pills.push(`<a class="pill solid" href="${attr(href)}">${esc(f.email)}</a>`);
  if (contactOn) for (const l of f.links) {
    const h = safeHref(l.url);
    if (h) pills.push(`<a class="pill" href="${attr(h)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}</a>`);
  }
  if (pills.length) right.push([{ html: pills.join(""), cls: "pills", span, full: [f.email, ...f.links.map((l) => l.label)].filter(Boolean).join(" ") }]);

  const rows: string[] = [row([], total, { cls: "sp" })];
  right.forEach((cells, i) => {
    if (photo && i === 0) rows.push(row([{ html: photo, cls: "photo", span: 2, rowspan: right.length }, ...cells], total));
    else rows.push(row(cells, total, { lead: photo ? 2 : 0 }));
  });
  if (aboutOn && f.stats.length) {
    rows.push(row([], total, { cls: "sp" }));
    rows.push(row([{ html: "Highlights", cls: "sect", span: 3 }], total, { cls: "sectrow" }));
    rows.push(row(f.stats.map((s) => ({ html: `<small>${esc(s.label)}</small><strong>${esc(s.value)}</strong>`, cls: "stat", full: `${s.value} ${s.label}` })), total, { cls: "stats" }));
  }
  return table(widths, rows);
}

function experienceSheet(f: PortfolioFacts): string {
  const widths = pad([210, 210, 130, 130, 430]);
  const total = widths.length;
  const rows = [row([hdr("Organisation", { cls: "hdr def" }), hdr("Role"), hdr("Period"), hdr("Location"), hdr("Highlights")], total, { cls: "hdrrow" })];
  for (const e of f.experience) {
    const lines = [...(e.summary ? [ln(e.summary)] : []), ...e.bullets.map((b) => ln(b, "b"))].join("");
    rows.push(row([t(e.org, { cls: "b", h: "Organisation" }), t(e.role, { h: "Role" }), t(e.period, { h: "Period" }), t(e.location, { h: "Location" }), { html: lines, h: e.summary || e.bullets.length ? "Highlights" : undefined, full: [e.summary, ...e.bullets].filter(Boolean).join(" ") }], total));
  }
  return table(widths, rows);
}

function projectsSheet(f: PortfolioFacts): string {
  const widths = pad([200, 130, 100, 340, 200, 200, 90]);
  const total = widths.length;
  const rows = [row([hdr("Project", { cls: "hdr def" }), hdr("Role"), hdr("Period"), hdr("Description"), hdr("Results"), hdr("Tags"), hdr("Link")], total, { cls: "hdrrow" })];
  for (const p of f.projects) {
    const desc = [...(p.description ? [ln(p.description)] : []), ...p.bullets.map((b) => ln(b, "b"))].join("");
    const metrics = p.metrics.map((m) => `<div class="ln"><b class="mv">${esc(m.value)}</b> ${esc(m.label)}</div>`).join("");
    const tags = p.tags.length ? `<div class="chips">${p.tags.map((x) => `<span class="chip">${esc(x)}</span>`).join("")}</div>` : "";
    const h = safeHref(p.link);
    rows.push(
      row(
        [
          t(p.name, { cls: "b", h: "Project" }),
          t(p.role, { h: "Role" }),
          t(p.period, { h: "Period" }),
          { html: desc, h: desc ? "Description" : undefined, full: [p.description, ...p.bullets].filter(Boolean).join(" ") },
          { html: metrics, h: metrics ? "Results" : undefined, full: p.metrics.map((m) => `${m.value} ${m.label}`).join(", ") },
          { html: tags, h: tags ? "Tags" : undefined, full: p.tags.join(", ") },
          { html: h ? anchor(h, "Open") : "", h: h ? "Link" : undefined, full: h ?? undefined },
        ],
        total,
      ),
    );
  }
  return table(widths, rows);
}

/** Groups of short items as rows: the group name, then its items six to a row. */
function groupsSheet(groups: Array<{ label: string; items: string[] }>): string {
  const widths = pad([170, 150, 150, 150, 150, 150, 150]);
  const total = widths.length;
  const rows: string[] = [];
  groups.forEach((g, gi) => {
    for (let i = 0; i < g.items.length; i += 6) {
      const chunk = g.items.slice(i, i + 6);
      const label: Cell = i === 0 ? { html: esc(g.label), cls: gi === 0 ? "hdr def" : "hdr" } : { html: "", cls: "hdr" };
      rows.push(row([label, ...chunk.map((x) => ({ html: esc(x), cls: "item" }))], total, { cls: "flexrow" }));
    }
  });
  return table(widths, rows);
}

function educationSheet(f: PortfolioFacts): string {
  const widths = pad([260, 260, 130, 320]);
  const total = widths.length;
  const rows = [row([hdr("School", { cls: "hdr def" }), hdr("Degree"), hdr("Period"), hdr("Detail")], total, { cls: "hdrrow" })];
  for (const e of f.education) rows.push(row([t(e.school, { cls: "b", h: "School" }), t(e.degree, { h: "Degree" }), t(e.period, { h: "Period" }), t(e.detail, { h: "Detail" })], total));
  return table(widths, rows);
}

function achievementsSheet(f: PortfolioFacts): string {
  const widths = pad([90, 300, 380]);
  const total = widths.length;
  const rows = [row([hdr("Year", { cls: "hdr def" }), hdr("Achievement"), hdr("Detail")], total, { cls: "hdrrow" })];
  for (const a of f.achievements) rows.push(row([t(a.year, { cls: "num", h: "Year" }), t(a.title, { cls: "b", h: "Achievement" }), t(a.detail, { h: "Detail" })], total));
  return table(widths, rows);
}

function certificationsSheet(f: PortfolioFacts): string {
  const widths = pad([300, 220, 90]);
  const total = widths.length;
  const rows = [row([hdr("Certification", { cls: "hdr def" }), hdr("Issuer"), hdr("Year")], total, { cls: "hdrrow" })];
  for (const c of f.certifications) rows.push(row([t(c.name, { cls: "b", h: "Certification" }), t(c.issuer, { h: "Issuer" }), t(c.year, { cls: "num", h: "Year" })], total));
  return table(widths, rows);
}

function testimonialsSheet(f: PortfolioFacts): string {
  const widths = pad([560, 170, 200]);
  const total = widths.length;
  const rows = [row([hdr("Quote", { cls: "hdr def" }), hdr("Author"), hdr("Role")], total, { cls: "hdrrow" })];
  for (const q of f.testimonials) rows.push(row([t(q.quote, { cls: "quote", h: "Quote" }), t(q.author, { cls: "b", h: "Author" }), t(q.role, { h: "Role" })], total));
  return table(widths, rows);
}

function contactSheet(f: PortfolioFacts): string {
  const widths = pad([150, 420]);
  const total = widths.length;
  const rows: string[] = [];
  let first = true;
  const add = (label: string, value: Cell) => {
    rows.push(row([{ html: esc(label), cls: first ? "hdr def" : "hdr" }, value], total));
    first = false;
  };
  if (f.email) {
    const h = safeHref(`mailto:${f.email}`);
    add("Email", { html: h ? anchor(h, f.email) : esc(f.email), full: f.email });
  }
  if (f.phone) {
    const h = safeHref(`tel:${f.phone.replace(/[^\d+]/g, "")}`);
    add("Phone", { html: h ? anchor(h, f.phone) : esc(f.phone), full: f.phone });
  }
  for (const l of f.links) {
    const h = safeHref(l.url);
    add(l.label, { html: h ? anchor(h, l.url) : esc(l.url), full: l.url });
  }
  return table(widths, rows);
}

// ---- page ------------------------------------------------------------------------------------------------------------

const TAB_NAME: Record<SectionKey, string> = {
  about: "Summary",
  experience: "Experience",
  projects: "Projects",
  skills: "Skills",
  education: "Education",
  achievements: "Achievements",
  certifications: "Certifications",
  testimonials: "Testimonials",
  extras: "More",
  contact: "Contact",
};

const ICON = (inner: string) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

const CSS = `
:root{--acc:#0b57d0;--acc-soft:#d3e3fd;--acc-mid:#c2e7ff;--acc-ink:#0b57d0;--bg:#f9fbfd;--tb:#edf2fa;--ink:#1f1f1f;--ink2:#444746;--mute:#5f6368;--line2:#e1e3e1;--grid:#e1e1e1;--hdr:#f8f9fa;--hdr-ink:#575a5f;
--f-ui:'Inter',Roboto,system-ui,sans-serif;--f-grid:'Roboto',Arial,sans-serif;--f-mono:'Roboto Mono',ui-monospace,Menlo,monospace}
@supports (background:color-mix(in srgb,red 10%,white)){:root{--acc-soft:color-mix(in srgb,var(--acc) 18%,#fff);--acc-mid:color-mix(in srgb,var(--acc) 24%,#fff)}}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--ink);font:14px/20px var(--f-ui);-webkit-font-smoothing:antialiased}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;padding:0}
a{color:var(--acc-ink)}
:focus-visible{outline:2px solid var(--acc);outline-offset:1px}
#app{display:flex;flex-direction:column;min-height:100vh}
.js body{height:100vh;height:100dvh;overflow:hidden}
.js #app{height:100vh;height:100dvh;min-height:0}
.docbar{display:flex;align-items:center;gap:10px;padding:8px 16px 0 12px;height:60px;flex:none}
.logo{width:34px;height:40px;display:grid;place-items:center;flex:none}
.doc-mid{flex:1;min-width:0}
.title{font:400 18px/26px var(--f-ui);margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.doc-sub{color:var(--mute);font-size:13px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.doc-right{display:flex;align-items:center;gap:10px}
.share{display:inline-flex;align-items:center;height:36px;padding:0 20px;border-radius:18px;background:var(--acc-mid);color:var(--ink);font-weight:500;text-decoration:none;max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.share:hover{box-shadow:0 1px 2px rgba(0,0,0,.25),0 1px 3px 1px rgba(0,0,0,.12)}
.avatar{width:32px;height:32px;border-radius:50%;overflow:hidden;flex:none;background:var(--acc-soft)}
.avatar img{width:100%;height:100%;object-fit:cover;display:block}
.toolbar{display:flex;align-items:center;gap:2px;margin:6px 8px 0;padding:0 10px;height:40px;background:var(--tb);border-radius:24px;flex:none;overflow:hidden}
.find{display:flex;align-items:center;gap:6px;height:30px;padding:0 10px;border-radius:15px;color:var(--ink2)}
.find:focus-within{background:#fff;box-shadow:0 0 0 1px #c7c7c7}
.find input{border:0;background:none;width:150px;font:14px var(--f-ui);color:var(--ink);outline:none}
.tbb{height:30px;min-width:30px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;color:var(--ink2);flex:none;padding:0 4px}
.tbb:hover{background:rgba(68,71,70,.1)}
.tbb.on{background:var(--acc-soft);color:var(--acc-ink)}
.zl{font:500 13px var(--f-grid);color:var(--ink2);min-width:42px;text-align:center}
.sep{width:1px;height:20px;background:#c7c7c7;margin:0 8px;flex:none}
.hits{font-size:12px;color:var(--mute);padding:0 6px;white-space:nowrap}
.fbar{display:flex;align-items:center;min-height:32px;margin-top:6px;border-top:1px solid var(--line2);border-bottom:1px solid var(--line2);background:#fff;flex:none;font:13px var(--f-mono)}
.nb{width:140px;padding-left:8px;flex:none}
#namebox{width:112px;border:0;font:13px var(--f-mono);color:var(--ink);background:none;padding:4px;outline:none}
.fx-ic{color:#80868b;font:italic 500 15px/1 Georgia,serif;padding:0 10px 0 8px;flex:none;border-left:1px solid var(--line2);margin-left:0}
.fx-view{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:5px 8px;cursor:text;color:var(--ink)}
.fx-view.open{white-space:normal;overflow-wrap:anywhere;max-height:30vh;overflow-y:auto}
.work{flex:1;min-height:0;display:flex;position:relative;flex-direction:column}
.gridwrap{flex:1;min-width:0;min-height:0;overflow:auto;background:#fff;outline:none;position:relative;overscroll-behavior:contain}
.js .sheet[hidden]{display:none}
.gin{position:relative;width:max-content;min-width:100%}
.js .sheet{animation:sh .18s ease-out}
@keyframes sh{from{opacity:.4}to{opacity:1}}
.sheet-h{margin:0;padding:14px 12px 6px;font:500 16px var(--f-ui)}
.js .sheet-h{display:none}
table.g{border-collapse:separate;border-spacing:0;table-layout:fixed;font-family:var(--f-grid);color:#000;counter-reset:r;font-size:13px}
.g col.c0{width:46px}
.g th,.g td{border-right:1px solid var(--grid);border-bottom:1px solid var(--grid);padding:2px 6px;vertical-align:top;line-height:1.4;position:relative;height:22px;white-space:normal;overflow-wrap:anywhere;overflow:hidden;background-clip:padding-box}
.g thead th{position:sticky;top:0;z-index:8;background:var(--hdr);color:var(--hdr-ink);font:400 11px var(--f-grid);text-align:center;vertical-align:middle;border-color:#c4c7c5;height:22px;padding:0}
.g th.cl::before{content:attr(data-l)}
.g th.corner{left:0;z-index:9}
.g tbody tr{counter-increment:r}
.g th.rh{position:sticky;left:0;z-index:7;background:var(--hdr);color:var(--hdr-ink);font:400 11px var(--f-grid);text-align:center;vertical-align:middle;border-color:#c4c7c5;padding:0;width:46px}
.g th.rh::before{content:counter(r)}
.g th.on{background:var(--acc-soft);color:var(--acc-ink);font-weight:500}
.g td.fill{padding:0}
.g td{cursor:cell}
.nogrid .g td{border-color:transparent}
.g td.sel{box-shadow:inset 0 0 0 2px var(--acc);background-color:var(--acc-soft)}
.g td.hit{background-color:#fff2b3}
.g td.sel.hit{background-color:var(--acc-soft)}
.g tr.sp td{height:14px}
.g td.b{font-weight:600}
.g td.num{text-align:right;font-variant-numeric:tabular-nums}
.g td.mute{color:var(--mute)}
.g td.hdr{background:#f1f3f4;font-weight:700;color:#202124;border-bottom-color:#9aa0a6;vertical-align:middle}
.g td.name{font:500 30px/38px var(--f-ui);color:#202124;vertical-align:bottom;padding-top:6px}
.g td.headline{font:400 17px/24px var(--f-ui);color:var(--acc-ink);vertical-align:middle}
.g td.tagline{font:italic 14px/20px var(--f-ui);color:var(--ink2);vertical-align:middle}
.g td.para{font-size:14px;line-height:1.5;color:#202124;padding-top:4px;padding-bottom:6px}
.g td.photo{padding:0;background:var(--hdr)}
.g td.photo .cimg{width:100%;aspect-ratio:1;object-fit:cover;display:block}
.g td.photo.sel{box-shadow:inset 0 0 0 3px var(--acc)}
.g td.sect{font:600 15px/22px var(--f-ui);color:#202124;border-bottom:3px solid var(--acc);vertical-align:bottom}
.g td.stat{background:var(--hdr);border-top:3px solid var(--acc);padding:6px 8px 8px}
.g td.stat small{display:block;font:500 11px/16px var(--f-ui);letter-spacing:.04em;text-transform:uppercase;color:var(--mute)}
.g td.stat strong{display:block;font:500 24px/32px var(--f-ui);color:var(--acc-ink)}
.g td.pills{padding:6px}
.pill{display:inline-block;margin:2px 8px 2px 0;padding:3px 14px;border:1px solid #c7c7c7;border-radius:16px;text-decoration:none;color:var(--acc-ink);font:500 13px/20px var(--f-ui);background:#fff;overflow-wrap:anywhere}
.pill:hover{background:var(--acc-soft)}
.pill.solid{background:var(--acc);border-color:var(--acc);color:#fff}
.ln+.ln{margin-top:3px}
.ln.b{padding-left:12px;position:relative}
.ln.b::before{content:"";position:absolute;left:2px;top:.62em;width:4px;height:4px;border-radius:50%;background:var(--mute)}
.mv{color:var(--acc-ink);font-weight:700}
.chips{display:flex;flex-wrap:wrap;gap:4px}
.chip{display:inline-block;padding:0 9px;border-radius:12px;font:500 11.5px/20px var(--f-grid);background:var(--acc-soft);color:#1f1f1f}
.g td.quote{font-style:italic;color:#3c4043}
.g td.item{font-family:var(--f-grid)}
.g td a{color:var(--acc-ink)}
.tabbar{display:flex;align-items:center;gap:4px;height:42px;background:var(--bg);border-top:1px solid var(--line2);padding:0 8px;flex:none}
html:not(.js) .tabbar,html:not(.js) .toolbar,html:not(.js) .fbar{display:none}
.tabs{display:flex;gap:2px;overflow-x:auto;flex:1;scrollbar-width:none;align-items:center;height:100%}
.tabs::-webkit-scrollbar{display:none}
.tab{position:relative;height:34px;padding:0 18px;border-radius:6px 6px 0 0;font:500 14px var(--f-ui);color:var(--ink2);border-bottom:3px solid var(--grid);white-space:nowrap;flex:none}
.tab:hover{background:rgba(68,71,70,.08)}
.tab[aria-selected=true]{background:var(--acc-soft);color:var(--acc-ink);border-bottom-color:var(--acc)}
.tab.hasHit::after{content:"";position:absolute;top:5px;right:6px;width:7px;height:7px;border-radius:50%;background:#e8a400}
@media (max-width:760px){
 .toolbar{display:none}
 .docbar{height:54px;padding:6px 8px 0 6px}
 .logo{width:26px}
 .doc-sub{display:none}
 .share{padding:0 14px;max-width:150px}
 .work{order:1}.fbar{order:2;margin-top:0;border-bottom:0}.tabbar{order:3}
 .nb{width:64px;padding-left:4px}#namebox{width:56px}
 .fx-view{white-space:normal;max-height:42px;overflow:hidden;font-family:var(--f-ui)}
 .fx-view.open{max-height:34vh}
 .tab{padding:0 14px}
 .gin{width:100%;zoom:1!important}
 table.g{width:100%}
 table.g,.g tbody,.g tr,.g td{display:block}
 .g td.photo .cimg{width:220px;max-width:100%;border-radius:8px}
 .g td.photo{background:none}
 .g colgroup,.g thead,.g th.rh,.g tr.fr,.g tr.sp,.g td:empty,.g tr.hdrrow{display:none}
 .g tr{padding:8px 12px;border-bottom:1px solid var(--grid)}
 .g td{border:0;padding:3px 0;height:auto;overflow:visible;cursor:default}
 .g td.sel{box-shadow:none;background:var(--acc-soft);margin:0 -6px;padding:3px 6px;border-radius:4px}
 .g td[data-h]::before{content:attr(data-h);display:block;font:500 11px/16px var(--f-ui);letter-spacing:.04em;text-transform:uppercase;color:var(--mute)}
 .g td.name{font-size:26px;line-height:32px}
 .g td.photo{margin-bottom:8px}.g td.photo .cimg{max-height:340px}
 .g tr.stats{display:grid;grid-template-columns:1fr 1fr;gap:8px}
 .g tr.stats td{margin:0}
 .g td.stat{padding:6px 8px 8px}
 .g tr.flexrow{display:flex;flex-wrap:wrap;gap:0 8px;padding:4px 12px}
 .g tr.flexrow td.hdr{flex:0 0 100%;background:none;border:0;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--acc-ink);padding-top:10px}
 .g tr.flexrow td.item{flex:0 0 calc(50% - 4px);padding:2px 0}
 .g td.hdr{background:none}
 .g .sectrow td.sect{border-bottom:3px solid var(--acc)}
}
@media (prefers-reduced-motion:reduce){.js .sheet{animation:none}}
@media print{.toolbar,.tabbar,.fbar,.share{display:none}.js body,.js #app{height:auto;overflow:visible}.gridwrap{overflow:visible}}
`;

const JS = `
(function(){
var root=document.documentElement;root.classList.add("js");
var $=function(s,r){return(r||document).querySelector(s)};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var wrap=$("#gridwrap"),gin=$("#gin"),nb=$("#namebox"),fx=$("#fx-view");
var tabs=$$(".tab"),sheets=$$(".sheet");
var cur=null,active=null,zoom=1;
function txt(td){
  if(td.hasAttribute("data-full"))return td.getAttribute("data-full");
  return (td.textContent||"").replace(/\\s+/g," ").trim();
}
function shown(td){return td.offsetWidth>0&&td.offsetHeight>0}
function select(td,quiet){
  if(!td)return;
  if(cur){cur.classList.remove("sel");var op=cur.parentNode.querySelector("th.rh");if(op)op.classList.remove("on")}
  $$("th.cl.on").forEach(function(h){h.classList.remove("on")});
  cur=td;td.classList.add("sel");
  var sheet=td.closest(".sheet"),r=td.getBoundingClientRect(),first=-1;
  var ths=$$("thead th.cl",sheet);
  ths.forEach(function(h,i){var hr=h.getBoundingClientRect();if(hr.width&&hr.right>r.left+1&&hr.left<r.right-1){h.classList.add("on");if(first<0)first=i}});
  var tr=td.parentNode,rows=Array.prototype.indexOf.call(tr.parentNode.rows,tr);
  var rh=tr.querySelector("th.rh");if(rh)rh.classList.add("on");
  nb.value=(first>=0?String.fromCharCode(65+first):"")+(rows+1);
  fx.textContent=txt(td);
  if(!quiet){try{td.scrollIntoView({block:"nearest",inline:"nearest"})}catch(e){}}
}
function show(id,quiet){
  var s=document.getElementById(id);if(!s)return;
  active=s;
  sheets.forEach(function(x){x.hidden=x!==s});
  tabs.forEach(function(b){var on=b.getAttribute("data-sheet")===id;b.setAttribute("aria-selected",on?"true":"false");b.tabIndex=on?0:-1;if(on&&b.scrollIntoView){try{b.scrollIntoView({block:"nearest",inline:"nearest"})}catch(e){}}});
  wrap.scrollTop=0;wrap.scrollLeft=0;
  cur=null;
  var d=$("td.def",s);
  if(!d||!shown(d))d=$$("td:not(.fill)",s).filter(function(c){return shown(c)&&txt(c)})[0];
  select(d,true);
  if(!quiet){try{history.replaceState(null,"","#"+id)}catch(e){}}
}
function move(dx,dy){
  if(!cur||!active)return;
  var r=cur.getBoundingClientRect(),best=null,bd=1e9;
  $$("td",active).forEach(function(c){
    if(c===cur||!shown(c))return;
    var b=c.getBoundingClientRect(),d=-1,hov=b.left<r.right-1&&b.right>r.left+1,vov=b.top<r.bottom-1&&b.bottom>r.top+1;
    if(dx>0&&vov&&b.left>=r.right-1)d=b.left-r.right;
    else if(dx<0&&vov&&b.right<=r.left+1)d=r.left-b.right;
    else if(dy>0&&hov&&b.top>=r.bottom-1)d=(b.top-r.bottom)*50+Math.abs(b.left-r.left)/50;
    else if(dy<0&&hov&&b.bottom<=r.top+1)d=(r.top-b.bottom)*50+Math.abs(b.left-r.left)/50;
    if(d>=0&&d<bd){bd=d;best=c}
  });
  if(best)select(best);
}
wrap.addEventListener("click",function(e){var td=e.target.closest&&e.target.closest("td");if(td&&wrap.contains(td)){select(td);wrap.focus({preventScroll:true})}});
wrap.addEventListener("keydown",function(e){
  var k=e.key,m=true;
  if(e.metaKey||e.ctrlKey||e.altKey){
    if(k==="Home"){var f=$("td.def",active);select(f)}else m=false;
  }else if(k==="ArrowRight")move(1,0);
  else if(k==="ArrowLeft")move(-1,0);
  else if(k==="ArrowDown"||k==="Enter")move(0,e.shiftKey&&k==="Enter"?-1:1);
  else if(k==="ArrowUp")move(0,-1);
  else if(k==="Tab"){move(e.shiftKey?-1:1,0)}
  else if(k==="Home"){var row=cur&&cur.parentNode.querySelector("td:not(.fill)");if(row)select(row)}
  else m=false;
  if(m)e.preventDefault();
});
tabs.forEach(function(b,i){
  b.addEventListener("click",function(){show(b.getAttribute("data-sheet"))});
  b.addEventListener("keydown",function(e){
    var n=e.key==="ArrowRight"?1:e.key==="ArrowLeft"?-1:0;
    if(n){var t=tabs[(i+n+tabs.length)%tabs.length];t.focus();show(t.getAttribute("data-sheet"));e.preventDefault()}
  });
});
fx.addEventListener("click",function(){fx.classList.toggle("open")});
var zl=$("#zl");
function applyZoom(){gin.style.zoom=zoom;zl.textContent=Math.round(zoom*100)+"%"}
$("#zin").addEventListener("click",function(){zoom=Math.min(1.5,Math.round((zoom+.1)*10)/10);applyZoom()});
$("#zout").addEventListener("click",function(){zoom=Math.max(.7,Math.round((zoom-.1)*10)/10);applyZoom()});
applyZoom();
$("#grid-toggle").addEventListener("click",function(e){var off=wrap.classList.toggle("nogrid");e.currentTarget.classList.toggle("on",!off);e.currentTarget.setAttribute("aria-pressed",off?"false":"true")});
$("#print").addEventListener("click",function(){window.print()});
var fin=$("#find"),hitsEl=$("#hits"),hits=[],hi=-1;
function runFind(){
  var q=fin.value.trim().toLowerCase();
  $$("td.hit").forEach(function(c){c.classList.remove("hit")});
  tabs.forEach(function(b){b.classList.remove("hasHit")});
  hits=[];hi=-1;
  if(q){sheets.forEach(function(s){$$("td:not(.fill)",s).forEach(function(c){if(txt(c).toLowerCase().indexOf(q)>=0){c.classList.add("hit");hits.push(c);var b=$('.tab[data-sheet="'+s.id+'"]');if(b)b.classList.add("hasHit")}})})}
  hitsEl.textContent=q?(hits.length?hits.length+" found":"None"):"";
}
function nextHit(step){
  if(!hits.length)return;
  hi=(hi+step+hits.length)%hits.length;
  var c=hits[hi],s=c.closest(".sheet");
  if(s!==active)show(s.id,true);
  select(c);
}
fin.addEventListener("input",runFind);
fin.addEventListener("keydown",function(e){
  if(e.key==="Enter"){nextHit(e.shiftKey?-1:1);e.preventDefault()}
  else if(e.key==="Escape"){fin.value="";runFind();wrap.focus()}
});
document.addEventListener("keydown",function(e){if((e.metaKey||e.ctrlKey)&&(e.key==="f"||e.key==="F")){e.preventDefault();fin.focus();fin.select()}});
var start=location.hash.replace("#","");
show(document.getElementById(start)&&sheets.some(function(s){return s.id===start})?start:sheets[0].id,true);
})();
`;

const template: ThemeTemplate = {
  id: "grid-ledger",
  sections: SECTIONS,
  defaultAccent: DEFAULT_ACCENT,
  render({ facts: f, custom }) {
    const vis = visibleSections(f, custom, SECTIONS);
    const accent = accentColour(custom, DEFAULT_ACCENT, BG);
    const over = fontOverride(custom);
    const ui = over ? over.stack : "'Inter',Roboto,system-ui,sans-serif";
    const grid = over ? over.stack : "'Roboto',Arial,sans-serif";
    const mono = over ? over.stack : "'Roboto Mono',ui-monospace,Menlo,monospace";
    const fontsHref = googleFontsHref(over ? [over.family] : ["Inter", "Roboto", "Roboto Mono"]);
    const aboutOn = vis.includes("about");
    const contactOn = vis.includes("contact");

    const bodies: Array<{ id: string; label: string; html: string }> = [{ id: "s-summary", label: TAB_NAME.about, html: summarySheet(f, aboutOn, contactOn) }];
    for (const k of vis) {
      if (k === "about") continue;
      let html = "";
      if (k === "experience") html = experienceSheet(f);
      else if (k === "projects") html = projectsSheet(f);
      else if (k === "skills") html = groupsSheet(f.skills.map((g) => ({ label: g.group ?? "Skills", items: g.items })));
      else if (k === "education") html = educationSheet(f);
      else if (k === "achievements") html = achievementsSheet(f);
      else if (k === "certifications") html = certificationsSheet(f);
      else if (k === "testimonials") html = testimonialsSheet(f);
      else if (k === "extras") html = groupsSheet(f.extras.map((g) => ({ label: g.label, items: g.items })));
      else if (k === "contact") html = contactSheet(f);
      bodies.push({ id: `s-${k}`, label: TAB_NAME[k], html });
    }

    const subtitle = [f.headline, f.location].filter(Boolean).join(" · ");
    const contactHref = contactOn ? safeHref(f.email ? `mailto:${f.email}` : f.links[0]?.url) : null;
    const desc = f.tagline ?? f.headline ?? f.summary?.slice(0, 160) ?? "";
    const avatar = photoTag(f, { alt: "" });

    const sheetsHtml = bodies.map((b) => `<section class="sheet" id="${b.id}" role="tabpanel" aria-label="${attr(b.label)}"><h2 class="sheet-h">${esc(b.label)}</h2>${b.html}</section>`).join("");
    const tabsHtml = bodies.map((b, i) => `<button class="tab" role="tab" data-sheet="${b.id}" aria-selected="${i === 0 ? "true" : "false"}">${esc(b.label)}</button>`).join("");

    const rootVars = `:root{--acc:${accent};--acc-ink:${accent};--f-ui:${ui};--f-grid:${grid};--f-mono:${mono}}`;

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(f.name)}</title>
${desc ? `<meta name="description" content="${attr(desc)}">` : ""}
<link rel="stylesheet" href="${attr(fontsHref)}">
<style>${CSS}${rootVars}</style>
</head>
<body>
<div id="app">
<header class="docbar">
  <div class="logo" aria-hidden="true"><svg viewBox="0 0 48 66" width="26" height="36"><path d="M29 0H4.5A4.5 4.5 0 0 0 0 4.5v57A4.5 4.5 0 0 0 4.5 66h39a4.5 4.5 0 0 0 4.5-4.5V19z" fill="var(--acc)"/><path d="M29 0v14.5a4.5 4.5 0 0 0 4.5 4.5H48z" fill="#fff" fill-opacity=".45"/><path d="M12 31v18h24V31zm10.5 15H15v-4.5h7.5zm0-7.5H15V34h7.5zM33 46h-7.5v-4.5H33zm0-7.5h-7.5V34H33z" fill="#fff"/></svg></div>
  <div class="doc-mid"><h1 class="title">${esc(f.name)}</h1>${subtitle ? `<div class="doc-sub">${esc(subtitle)}</div>` : ""}</div>
  <div class="doc-right">${contactHref ? `<a class="share" href="${attr(contactHref)}"${/^https?:/i.test(contactHref) ? ' target="_blank" rel="noopener noreferrer"' : ""}>Contact</a>` : ""}${avatar ? `<span class="avatar">${avatar}</span>` : ""}</div>
</header>
<div class="toolbar" role="toolbar" aria-label="Toolbar">
  <label class="find">${ICON('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.8-4.8"/>')}<input id="find" placeholder="Find" aria-label="Find in workbook" autocomplete="off"></label><span class="hits" id="hits"></span>
  <i class="sep"></i>
  <button class="tbb" id="print" title="Print" aria-label="Print">${ICON('<path d="M7 9V4h10v5M7 17H4v-7h16v7h-3M7 14h10v6H7z"/>')}</button>
  <button class="tbb" id="zout" title="Zoom out" aria-label="Zoom out">${ICON('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.8-4.8M8.5 11h5"/>')}</button>
  <span class="zl" id="zl" aria-live="polite"></span>
  <button class="tbb" id="zin" title="Zoom in" aria-label="Zoom in">${ICON('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.8-4.8M8.5 11h5M11 8.5v5"/>')}</button>
  <i class="sep"></i>
  <button class="tbb on" id="grid-toggle" title="Gridlines" aria-label="Gridlines" aria-pressed="true">${ICON('<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 12h16M12 4v16"/>')}</button>
</div>
<div class="fbar" id="fbar">
  <div class="nb"><input id="namebox" aria-label="Selected cell" readonly spellcheck="false" autocomplete="off"></div>
  <span class="fx-ic" aria-hidden="true">fx</span>
  <div class="fx-view" id="fx-view" role="textbox" aria-readonly="true" aria-label="Formula bar" title="Click to expand"></div>
</div>
<main class="work"><div class="gridwrap" id="gridwrap" tabindex="0" aria-label="Spreadsheet grid"><div class="gin" id="gin">${sheetsHtml}</div></div></main>
<footer class="tabbar"><div class="tabs" role="tablist" aria-label="Sheets">${tabsHtml}</div></footer>
</div>
${scriptTag(JS)}
</body>
</html>`;
  },
};

export default template;
