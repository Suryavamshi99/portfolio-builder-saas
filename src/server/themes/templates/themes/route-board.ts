import type { PortfolioFacts, SectionKey } from "../../facts";
import { accentColour, attr, esc, fontOverride, googleFontsHref, photoTag, safeHref, safeJson, scriptTag, visibleSections } from "../helpers";
import type { RenderInput, ThemeTemplate } from "../types";

// Road Trip: a trip-planning interface. Work is a route of numbered stops on a sticky map; a truck travels to the stop you are reading.
// Fonts (Google Fonts, the sample's own files are not available): Barlow Condensed, Inter Tight.
const DEFAULT_ACCENT = "#ff5a1f";
const BACKGROUND = "#11181d";
const SECTIONS: SectionKey[] = ["experience", "projects", "about", "skills", "education", "achievements", "certifications", "testimonials", "extras", "contact"];

interface Stop {
  kind: string;
  title: string;
  role?: string | undefined;
  period?: string | undefined;
  location?: string | undefined;
  text?: string | undefined;
  bullets: string[];
  metrics: Array<{ value: string; label: string }>;
  tags: string[];
  link?: string | undefined;
}

type Pt = [number, number];

function stopsOf(f: PortfolioFacts, keys: SectionKey[]): Stop[] {
  const out: Stop[] = [];
  if (keys.includes("experience")) {
    // The route runs from the earliest job to the latest.
    for (const e of [...f.experience].reverse()) {
      out.push({ kind: "Role", title: e.org, role: e.role, period: e.period, location: e.location, text: e.summary, bullets: e.bullets, metrics: [], tags: [] });
    }
  }
  if (keys.includes("projects")) {
    for (const p of f.projects) {
      out.push({ kind: "Project", title: p.name, role: p.role, period: p.period, text: p.description, bullets: p.bullets, metrics: p.metrics, tags: p.tags, link: p.link });
    }
  }
  return out;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** A smooth path through the points (Catmull-Rom turned into cubic curves). */
function smoothPath(pts: Pt[]): string {
  const p0 = pts[0] as Pt;
  let d = `M${r1(p0[0])} ${r1(p0[1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = (pts[i - 1] ?? pts[i]) as Pt;
    const b = pts[i] as Pt;
    const c = pts[i + 1] as Pt;
    const e = (pts[i + 2] ?? c) as Pt;
    d += `C${r1(b[0] + (c[0] - a[0]) / 6)} ${r1(b[1] + (c[1] - a[1]) / 6)} ${r1(c[0] - (e[0] - b[0]) / 6)} ${r1(c[1] - (e[1] - b[1]) / 6)} ${r1(c[0])} ${r1(c[1])}`;
  }
  return d;
}

/** Stops climbing a tall map, swinging left and right. */
function portraitPoints(n: number): Pt[] {
  const count = Math.max(n, 2);
  const pts: Pt[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    pts.push([300 + Math.sin(i * 1.9 + 0.7) * 150 * (0.7 + 0.3 * Math.cos(i * 0.9)), 700 - t * 600]);
  }
  return pts;
}

/** A route across a wide hero map. */
function wideRoute(): Pt[] {
  return [[380, 560], [520, 470], [640, 500], [760, 380], [700, 250], [830, 170], [930, 90]];
}

/** Quiet map furniture drawn with SVG only: graticule, contour rings, a coast and hatching. */
function backdrop(w: number, h: number): string {
  const lines: string[] = [];
  for (let x = -400; x <= w + 400; x += 100) lines.push(`<path class="grat" d="M${x} -400V${h + 400}"/>`);
  for (let y = -400; y <= h + 400; y += 100) lines.push(`<path class="grat" d="M-400 ${y}H${w + 400}"/>`);
  const rings = (cx: number, cy: number, rx: number, ry: number, rot: number, n: number) =>
    Array.from({ length: n }, (_, i) => {
      const k = 1 - i * (0.78 / n);
      return `<ellipse class="ctr${i % 3 === 0 ? " hi" : ""}" cx="${cx}" cy="${cy}" rx="${r1(rx * k)}" ry="${r1(ry * k)}" transform="rotate(${rot} ${cx} ${cy})"/>`;
    }).join("");
  return [
    `<g>${lines.join("")}</g>`,
    `<path class="sea" d="M-400 ${h * 0.62}C${w * 0.12} ${h * 0.5} ${w * 0.2} ${h * 0.78} ${w * 0.42} ${h * 0.7}S${w * 0.55} ${h + 400} ${w * 0.5} ${h + 400}H-400Z"/>`,
    `<path class="coast" d="M-400 ${h * 0.62}C${w * 0.12} ${h * 0.5} ${w * 0.2} ${h * 0.78} ${w * 0.42} ${h * 0.7}S${w * 0.55} ${h + 400} ${w * 0.5} ${h + 400}"/>`,
    rings(w * 0.28, h * 0.3, w * 0.24, h * 0.2, -18, 9),
    rings(w * 0.82, h * 0.62, w * 0.2, h * 0.17, 24, 7),
    rings(w * 0.62, h * 0.12, w * 0.14, h * 0.1, 8, 5),
    `<path class="river" d="M${w * 0.1} -400C${w * 0.25} ${h * 0.2} ${w * 0.05} ${h * 0.45} ${w * 0.34} ${h * 0.62}S${w * 0.5} ${h * 0.92} ${w * 0.7} ${h + 400}"/>`,
  ].join("");
}

const NAV_LABEL: Record<SectionKey, string> = {
  about: "About",
  experience: "Route",
  projects: "Route",
  skills: "Kit",
  education: "Education",
  achievements: "Achievements",
  certifications: "Certifications",
  testimonials: "People",
  extras: "More",
  contact: "Contact",
};

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

function heroTitle(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => `<span class="w" style="--d:${i * 90}ms">${esc(w)}</span>`)
    .join(" ");
}

function eyebrow(label: string): string {
  return `<span class="eyebrow lab">${esc(label)}</span>`;
}

function rowsSection(id: string, tone: string, label: string, title: string, rows: Array<{ main: string; sub?: string | undefined; meta?: string | undefined }>): string {
  const items = rows
    .map(
      (r) =>
        `<li data-reveal><div><b>${esc(r.main)}</b>${r.sub ? `<span>${esc(r.sub)}</span>` : ""}</div>${r.meta ? `<em class="lab">${esc(r.meta)}</em>` : ""}</li>`,
    )
    .join("");
  return `<section class="sec ${tone}" id="${id}" aria-labelledby="${id}-h"><div class="container rows-grid"><div data-reveal>${eyebrow(label)}<h2 id="${id}-h">${esc(title)}</h2></div><ul class="rows">${items}</ul></div></section>`;
}

function renderStop(s: Stop, i: number): string {
  const role = [s.role, s.location].filter(Boolean).join(" · ");
  const metrics = s.metrics.length
    ? `<ul class="smetrics">${s.metrics.map((m) => `<li><b>${esc(m.value)}</b><span>${esc(m.label)}</span></li>`).join("")}</ul>`
    : "";
  const bullets = s.bullets.length ? `<ul class="sbullets">${s.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : "";
  const tags = s.tags.length ? `<ul class="tags">${s.tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "";
  const href = safeHref(s.link);
  const link = href ? `<a class="tlink" href="${attr(href)}" target="_blank" rel="noopener noreferrer">Open the work <i aria-hidden="true">&rarr;</i></a>` : "";
  return `<li class="stop" id="stop-${i}" data-i="${i}"><div class="stop-card" data-reveal>
<div class="stop-top lab"><span>${esc(s.kind)}</span>${s.period ? `<span>${esc(s.period)}</span>` : ""}</div>
<h3>${esc(s.title)}</h3>${role ? `<p class="stop-role">${esc(role)}</p>` : ""}${s.text ? `<p class="stop-text">${esc(s.text)}</p>` : ""}${metrics}${bullets}${tags}${link}</div></li>`;
}

function renderRoute(stops: Stop[]): string {
  const pts = portraitPoints(stops.length);
  const d = smoothPath(pts);
  const labelled = stops.length <= 7;
  const pins = stops
    .map((s, i) => {
      // With one stop the route has an extra unmarked start, so the stop sits at the end.
      const p = (stops.length === 1 ? pts[1] : pts[i]) as Pt;
      const right = p[0] < 300;
      return `<a class="pin" href="#stop-${i}" data-i="${i}" aria-label="${attr(s.title)}"><circle class="p-pulse" cx="${r1(p[0])}" cy="${r1(p[1])}" r="15"/><circle class="p-dot" cx="${r1(p[0])}" cy="${r1(p[1])}" r="15"/><text class="p-n" x="${r1(p[0])}" y="${r1(p[1] + 4.5)}" text-anchor="middle"></text><text class="p-l" x="${r1(p[0] + (right ? 26 : -26))}" y="${r1(p[1] + 5)}" text-anchor="${right ? "start" : "end"}">${esc(clip(s.title, 22))}</text></a>`;
    })
    .join("");
  const start = pts[0] as Pt;
  const startDot = stops.length === 1 ? `<circle class="start" cx="${r1(start[0])}" cy="${r1(start[1])}" r="7"/>` : "";
  const svg = `<svg class="map" id="map" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid meet" aria-hidden="false" role="group" aria-label="Route map">${backdrop(600, 800)}<g class="map-route"><path class="r-base" id="r-base" d="${d}"/><path class="r-flow" d="${d}"/><path class="r-glow" id="r-glow" d="${d}"/><path class="r-line" id="r-line" d="${d}"/>${startDot}<g id="r-pins" class="${labelled ? "all-labels" : ""}">${pins}</g><g class="truck" id="r-truck"><rect x="-10" y="-7" width="20" height="14" rx="2"/><circle r="3"/></g></g></svg>`;
  return `<section class="sec route" id="route" aria-labelledby="route-h"><div class="container route-grid">
<div class="route-list"><div class="route-head" data-reveal>${eyebrow("The route")}<h2 id="route-h">Stops along the way</h2></div><ol class="stops" id="stops">${stops.map(renderStop).join("")}</ol></div>
<div class="route-map" id="route-map"><div class="map-box">${svg}<div class="map-shade" aria-hidden="true"></div><div class="hud" aria-hidden="true"><i></i><span id="hud-t"></span></div></div></div>
</div></section>`;
}

function renderAbout(f: PortfolioFacts, tone: string): string {
  const stats = f.stats.length
    ? `<ul class="why-list">${f.stats.map((s) => `<li data-reveal><span class="why-n">${esc(s.value)}</span><p>${esc(s.label)}</p></li>`).join("")}</ul>`
    : "";
  const text = f.summary ?? f.tagline ?? "";
  return `<section class="sec ${tone}" id="about" aria-labelledby="about-h"><div class="container why-grid${stats ? "" : " solo"}"><div data-reveal>${eyebrow("About")}<h2 id="about-h">${esc(f.headline ?? f.name)}</h2><p class="about-p">${esc(text)}</p></div>${stats}</div></section>`;
}

function renderSkills(f: PortfolioFacts, tone: string): string {
  const items = f.skills
    .map((g) => `<li data-reveal>${g.group ? `<h3>${esc(g.group)}</h3>` : ""}<ul class="tags">${g.items.map((it) => `<li>${esc(it)}</li>`).join("")}</ul></li>`)
    .join("");
  return `<section class="sec ${tone}" id="skills" aria-labelledby="skills-h"><div class="container rows-grid"><div data-reveal>${eyebrow("What comes on the trip")}<h2 id="skills-h">Skills and tools</h2></div><ul class="kit-list">${items}</ul></div></section>`;
}

function renderTestimonials(f: PortfolioFacts, tone: string): string {
  const items = f.testimonials
    .map((t) => `<li data-reveal><q>${esc(t.quote)}</q><span class="who lab">${esc(t.author)}</span>${t.role ? `<span class="where">${esc(t.role)}</span>` : ""}</li>`)
    .join("");
  return `<section class="sec ${tone}" id="testimonials" aria-labelledby="testimonials-h"><div class="container rows-grid"><div data-reveal>${eyebrow("People on the route")}<h2 id="testimonials-h">In their words</h2></div><ul class="quotes">${items}</ul></div></section>`;
}

function renderExtras(f: PortfolioFacts, tone: string): string {
  const items = f.extras
    .map((g) => `<li data-reveal><h3>${esc(g.label)}</h3><ul class="tags">${g.items.map((it) => `<li>${esc(it)}</li>`).join("")}</ul></li>`)
    .join("");
  return `<section class="sec ${tone}" id="extras" aria-labelledby="extras-h"><div class="container rows-grid"><div data-reveal>${eyebrow("Off the main road")}<h2 id="extras-h">More about me</h2></div><ul class="kit-list">${items}</ul></div></section>`;
}

function renderContact(f: PortfolioFacts): string {
  const rows: string[] = [];
  const row = (label: string, text: string, href: string | null) =>
    rows.push(
      href
        ? `<li><a href="${attr(href)}"${/^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : ""}><span class="lab">${esc(label)}</span><b>${esc(text)}</b><i aria-hidden="true">&rarr;</i></a></li>`
        : `<li><div><span class="lab">${esc(label)}</span><b>${esc(text)}</b></div></li>`,
    );
  if (f.email) row("Email", f.email, safeHref(`mailto:${f.email}`));
  if (f.phone) row("Phone", f.phone, safeHref(`tel:${f.phone.replace(/[^\d+]/g, "")}`));
  for (const l of f.links) {
    const h = safeHref(l.url);
    if (h) row(l.label, l.url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, ""), h);
  }
  if (f.location) row("Based in", f.location, null);
  const mail = f.email ? `<a class="btn or" href="${attr(safeHref(`mailto:${f.email}`) ?? "")}">Send an email <span class="arrow" aria-hidden="true">&rarr;</span></a>` : "";
  return `<section class="book" id="contact" aria-labelledby="contact-h"><div class="container book-grid"><div>${eyebrow("Plan the next leg")}<h2 id="contact-h">Get in touch</h2>${mail}</div><ul class="direct">${rows.join("")}</ul></div></section>`;
}

const CSS = `
:root{--paper:#eeede8;--paper-hi:#f8f7f3;--ink:#161c21;--steel:#2e3a44;--fog:#dfe0db;--asphalt:#11181d;--asphalt-2:#18222a;
--orange:var(--accent);--orange-hi:color-mix(in srgb,var(--accent) 78%,#fff);--orange-ink:color-mix(in srgb,var(--accent) 76%,#000);
--ink-soft:rgba(22,28,33,.74);--ink-mute:rgba(22,28,33,.62);--line:rgba(22,28,33,.14);--line-strong:rgba(22,28,33,.3);
--on-dark:#f0efea;--on-dark-soft:rgba(240,239,234,.76);--line-dark:rgba(240,239,234,.18);
--pad:clamp(16px,3.4vw,60px);--nav-h:68px;--ease:cubic-bezier(.2,.7,.2,1);scroll-padding-top:calc(var(--nav-h) + 12px)}
*,*:before,*:after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--paper);color:var(--ink);font:400 1rem/1.55 var(--font-text);overflow-x:clip;-webkit-font-smoothing:antialiased;counter-reset:sec stop}
img,svg{display:block;max-width:100%}
a{color:inherit;text-decoration:none}
h1,h2,h3{font-family:var(--font-display);font-weight:500;margin:0;line-height:.98;letter-spacing:-.005em}
p{margin:0}ul,ol{margin:0;padding:0;list-style:none}
.container{width:100%;max-width:1480px;margin:0 auto;padding:0 var(--pad)}
.skip{position:absolute;left:-9999px;top:8px;z-index:200;background:var(--orange);color:#0a1316;padding:10px 14px}.skip:focus{left:8px}
:focus-visible{outline:2px solid var(--orange);outline-offset:3px}
.lab{font-family:var(--font-display);font-weight:500;text-transform:uppercase;letter-spacing:.14em;font-size:.78rem}
.prog{position:fixed;left:0;top:0;right:0;height:3px;z-index:120;background:transparent}.prog i{display:block;height:100%;background:var(--orange);transform-origin:left;transform:scaleX(0)}
/* nav */
.nav{position:fixed;z-index:100;top:0;left:0;right:0;height:var(--nav-h);display:flex;align-items:center;justify-content:space-between;gap:24px;padding:0 var(--pad);color:var(--on-dark);border-bottom:1px solid var(--line-dark);transition:background .35s,color .35s,border-color .35s}
.nav.is-solid{background:rgba(17,24,29,.94);backdrop-filter:blur(10px)}
.logo{display:inline-flex;align-items:center;gap:12px;font-family:var(--font-display);font-weight:600;font-size:1.28rem;letter-spacing:.01em;text-transform:uppercase;min-width:0}
.logo svg{flex:none}.logo span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nav-links{display:flex;gap:28px;margin:0 auto}
.nav-links a{font-family:var(--font-display);font-weight:500;font-size:1.02rem;text-transform:uppercase;letter-spacing:.06em;position:relative;padding:4px 0}
.nav-links a:after{content:"";position:absolute;left:0;right:0;bottom:-2px;height:2px;background:var(--orange);transform:scaleX(0);transform-origin:left;transition:transform .35s var(--ease)}
.nav-links a:hover:after{transform:scaleX(1)}
.nav-cta{display:inline-flex;align-items:center;gap:10px;background:var(--orange);color:#0a1316;padding:11px 16px 10px;font-family:var(--font-display);font-weight:600;text-transform:uppercase;letter-spacing:.08em;font-size:.92rem;clip-path:polygon(0 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%);white-space:nowrap}
.nav-cta:hover{background:var(--orange-hi)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.8em;padding:1em 1.35em .95em;font-family:var(--font-display);font-weight:600;font-size:1.02rem;text-transform:uppercase;letter-spacing:.08em;border:0;cursor:pointer;clip-path:polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%)}
.btn .arrow{transition:transform .3s var(--ease)}.btn:hover .arrow{transform:translateX(5px)}
.btn.or{background:var(--orange);color:#0a1316}.btn.or:hover{background:var(--orange-hi)}
.tlink{display:inline-flex;gap:10px;align-items:center;border-bottom:1.5px solid currentColor;padding-bottom:4px;margin-top:16px;font-family:var(--font-display);font-weight:500;text-transform:uppercase;letter-spacing:.08em;color:var(--orange-hi)}
.tlink i{font-style:normal;transition:transform .3s var(--ease)}.tlink:hover i{transform:translateX(4px)}
/* section heads */
.eyebrow{display:inline-flex;align-items:center;gap:12px;color:var(--ink-soft)}
.eyebrow:before{counter-increment:sec;content:counter(sec,decimal-leading-zero);color:var(--orange-ink);padding-right:12px;border-right:1.5px solid currentColor;line-height:1}
.sec{padding:clamp(80px,10vw,150px) 0;position:relative}
.sec h2{font-size:clamp(2.6rem,5.4vw,5.6rem);text-transform:uppercase;line-height:.92;margin:.35em 0 .3em;max-width:16ch;overflow-wrap:anywhere}
.tone-a{background:var(--paper)}.tone-b{background:var(--paper-hi)}.tone-c{background:var(--fog)}
/* hero */
.hero{position:relative;min-height:100svh;background:var(--asphalt);color:var(--on-dark);overflow:hidden;display:flex;flex-direction:column;isolation:isolate}
.hero .map{position:absolute;inset:0;width:100%;height:100%;max-width:none;z-index:-2}
.hero-shade{position:absolute;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(90deg,rgba(9,13,16,.92) 0%,rgba(9,13,16,.66) 34%,rgba(9,13,16,0) 62%),linear-gradient(0deg,rgba(9,13,16,.6),transparent 22%)}
.hero-in{flex:1;width:100%;max-width:1480px;margin:0 auto;padding:calc(var(--nav-h) + clamp(28px,7svh,80px)) var(--pad) 40px;display:flex;flex-direction:column;justify-content:center}
.kicker{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;color:var(--on-dark-soft);margin-bottom:clamp(14px,2.6svh,26px)}
.kicker span:before{content:"";display:inline-block;vertical-align:middle;width:28px;height:1.5px;background:var(--orange);margin-right:14px}
.hero h1{font-size:clamp(3.4rem,7.4vw,7.6rem);text-transform:uppercase;line-height:.86;letter-spacing:-.01em;max-width:11ch;color:#fff;overflow-wrap:anywhere}
.hero h1 .w{display:inline-block;animation:rise .9s var(--ease) both;animation-delay:var(--d)}
.hero h1 .w:last-child{color:var(--orange)}
.hero h1 .w:only-child{color:#fff}
@keyframes rise{from{opacity:0;transform:translateY(.5em)}to{opacity:1;transform:none}}
.hero-sub{max-width:40ch;margin-top:clamp(14px,2.6svh,24px);font-size:clamp(1rem,1.25vw,1.16rem);color:var(--on-dark-soft);display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.ticket{margin-top:clamp(18px,3.6svh,34px);width:min(560px,100%);background:var(--paper-hi);color:var(--ink);box-shadow:0 30px 70px rgba(4,8,10,.45);clip-path:polygon(0 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%);animation:rise .9s .3s var(--ease) both}
.ticket-head{display:flex;gap:18px;align-items:center;padding:9px 18px;color:var(--ink-mute);border-bottom:1px dashed var(--line-strong);font-size:.72rem}
.ticket-head b{color:var(--ink);font-weight:600}
.ticket-row{display:flex}
.tf{display:flex;flex-direction:column;gap:4px;padding:12px 18px 14px;border-right:1px solid var(--line);min-width:0;flex:1}
.tf-k{color:var(--ink-mute);font-size:.72rem}
.tf-v{font:500 1.35rem/1.1 var(--font-display);overflow-wrap:anywhere}
.ticket-go{display:flex;align-items:center;gap:14px;padding:0 24px;background:var(--orange);color:#0a1316;font-family:var(--font-display);font-weight:600;font-size:1.1rem;text-transform:uppercase;letter-spacing:.08em;min-height:64px;margin-left:auto;transition:background .2s}
.ticket-go:hover{background:var(--orange-hi)}
.stop1{position:absolute;right:max(var(--pad),calc((100vw - 1480px)/2 + var(--pad)));bottom:calc(112px + 4svh);width:clamp(240px,22vw,330px);background:var(--paper-hi);color:var(--ink);padding:8px 8px 0;box-shadow:0 34px 80px rgba(2,6,8,.55);z-index:3;margin:0;animation:rise 1s .5s var(--ease) both}
.stop1-media{position:relative;aspect-ratio:4/5;overflow:hidden;background:var(--steel)}
.stop1-media img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(.92) contrast(1.06)}
.stop1-tag{position:absolute;left:0;top:0;background:var(--orange);color:#0a1316;padding:6px 10px 5px;z-index:2;font-size:.74rem}
.stop1-body{padding:12px 6px;display:flex;flex-direction:column;gap:2px}
.stop1-body b{font:500 1.5rem/1 var(--font-display);text-transform:uppercase;overflow-wrap:anywhere}
.stop1-body small{color:var(--ink-mute);font-size:.82rem}
.strip{position:relative;z-index:4;border-top:1px solid var(--line-dark);background:linear-gradient(0deg,rgba(9,13,16,.7),rgba(9,13,16,.15))}
.strip-in{display:flex;align-items:stretch;color:var(--on-dark-soft);width:100%;max-width:1480px;margin:0 auto;padding:0 var(--pad)}
.strip-in>*{padding:14px 26px 15px;border-left:1px solid var(--line-dark);display:flex;flex-direction:column;justify-content:center;min-width:0}
.strip-in>:first-child{padding-left:0;border-left:0}
.s-k{font-size:.7rem;color:rgba(240,239,234,.6)}
.s-v{font:500 1.15rem/1.15 var(--font-display);letter-spacing:.05em;color:#fff;display:inline-flex;align-items:center;gap:10px;overflow-wrap:anywhere}
.s-v i{width:7px;height:7px;border-radius:50%;background:var(--orange);animation:beat 2.2s infinite;flex:none}
@keyframes beat{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--accent) 60%,transparent)}60%{box-shadow:0 0 0 8px transparent}}
.strip .grow{flex:1}
.cue{align-items:center;gap:8px;color:#fff;font-size:.72rem}
.cue i{width:1.5px;height:26px;background:linear-gradient(var(--orange) 50%,rgba(255,255,255,.2) 50%);background-size:100% 200%;animation:cue 1.8s infinite}
@keyframes cue{from{background-position:0 100%}to{background-position:0 -100%}}
/* maps */
.map .grat{stroke:rgba(240,239,234,.07);stroke-width:1;fill:none}
.map .sea{fill:#0c1216}
.map .coast{fill:none;stroke:rgba(240,239,234,.32);stroke-width:1.4}
.map .river{fill:none;stroke:rgba(150,170,190,.28);stroke-width:1.3;stroke-linecap:round}
.map .ctr{fill:none;stroke:rgba(240,239,234,.075);stroke-width:1}.map .ctr.hi{stroke:rgba(240,239,234,.13)}
.map .r-base{fill:none;stroke:rgba(240,239,234,.32);stroke-width:2.2;stroke-dasharray:2 9;stroke-linecap:round}
.map .r-flow{fill:none;stroke:color-mix(in srgb,var(--accent) 60%,transparent);stroke-width:2;stroke-dasharray:1 26;stroke-linecap:round;animation:flow 2.6s linear infinite}
@keyframes flow{to{stroke-dashoffset:-108}}
.map .r-glow{fill:none;stroke:var(--orange);stroke-opacity:.22;stroke-width:16;stroke-linecap:round;stroke-linejoin:round}
.map .r-line{fill:none;stroke:var(--orange);stroke-width:5;stroke-linecap:round;stroke-linejoin:round}
.map .start{fill:var(--orange);stroke:#fff;stroke-width:3}
.map .hero-dot{fill:var(--asphalt);stroke:rgba(240,239,234,.7);stroke-width:2}
.map .pin{cursor:pointer}
.map .pin .p-dot{fill:var(--orange);stroke:#fff;stroke-width:3.5}
.map .pin.is-on .p-dot{fill:#fff;stroke:var(--orange)}
.map .pin text.p-n{fill:#0a1417;font:600 13px var(--font-display);pointer-events:none}
.map .pin.is-on text.p-n{fill:var(--orange-ink)}
.map .pin text.p-l{fill:#fff;font:500 16px var(--font-display);letter-spacing:.1em;text-transform:uppercase;paint-order:stroke;stroke:rgba(9,13,16,.85);stroke-width:4px;opacity:0;transition:opacity .3s}
.map .all-labels .pin text.p-l,.map .pin.is-on text.p-l,.map .pin:hover text.p-l,.map .pin:focus-visible text.p-l{opacity:1}
.map .pin:focus{outline:none}.map .pin:focus-visible .p-dot{stroke:var(--orange-hi);stroke-width:5}
.map .p-pulse{fill:none;stroke:#fff;stroke-opacity:.7;stroke-width:2;transform-box:fill-box;transform-origin:center;animation:ping 2.2s infinite;visibility:hidden}
.map .pin.is-on .p-pulse{visibility:visible}
@keyframes ping{0%{transform:scale(.7);opacity:.9}to{transform:scale(1.8);opacity:0}}
.map .truck{display:none}.js .map .truck{display:block}
.map .truck rect{fill:var(--orange);stroke:#fff;stroke-width:1.5}.map .truck circle{fill:#fff}
/* route */
.route{background:var(--asphalt);color:var(--on-dark);padding-bottom:clamp(60px,8vw,110px)}
.route .eyebrow{color:var(--on-dark-soft)}.route .eyebrow:before{color:var(--orange)}
.route-grid{display:grid;grid-template-columns:minmax(0,.95fr) minmax(0,1.05fr);gap:clamp(24px,4vw,70px);align-items:start}
.route-head{border-top:1px solid var(--line-dark);padding-top:22px;margin-bottom:28px}
.route-head h2{color:#fff}
.stops{position:relative}
.stops:before{content:"";position:absolute;left:19px;top:8px;bottom:8px;width:2px;background:repeating-linear-gradient(var(--line-dark) 0 6px,transparent 6px 12px)}
.stop{position:relative;padding:0 0 22px 60px;counter-increment:stop}
.stop:before{content:counter(stop,decimal-leading-zero);position:absolute;left:0;top:14px;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:var(--asphalt);border:2px solid var(--line-dark);font:600 .95rem var(--font-display);color:var(--on-dark-soft);transition:background .3s,border-color .3s,color .3s}
.stop.is-active:before{background:var(--orange);border-color:#fff;color:#0a1316;box-shadow:0 0 0 6px color-mix(in srgb,var(--accent) 25%,transparent)}
.stop-card{background:var(--asphalt-2);border:1px solid var(--line-dark);padding:20px 22px 22px;transition:border-color .35s,background .35s,box-shadow .35s}
.stop.is-active .stop-card{border-color:var(--orange);background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 14%,var(--asphalt-2)),var(--asphalt-2));box-shadow:inset 4px 0 0 var(--orange)}
.stop-top{display:flex;justify-content:space-between;gap:12px;color:rgba(240,239,234,.6);font-size:.72rem}
.stop.is-active .stop-top{color:var(--orange-hi)}
.stop-card h3{font-size:clamp(1.8rem,2.6vw,2.6rem);text-transform:uppercase;color:#fff;margin:.35em 0 .2em;overflow-wrap:anywhere}
.stop-role{font:500 1.15rem var(--font-display);letter-spacing:.04em;text-transform:uppercase;color:var(--orange-hi)}
.stop-text{margin-top:12px;color:var(--on-dark-soft);font-size:.96rem}
.sbullets{margin-top:12px;display:grid;gap:6px}
.sbullets li{position:relative;padding-left:18px;color:var(--on-dark-soft);font-size:.94rem}
.sbullets li:before{content:"";position:absolute;left:0;top:.65em;width:8px;height:2px;background:var(--orange)}
.smetrics{display:flex;flex-wrap:wrap;gap:10px 28px;margin-top:16px;padding-top:14px;border-top:1px dashed var(--line-dark)}
.smetrics li{display:flex;flex-direction:column}
.smetrics b{font:500 2.2rem/1 var(--font-display);color:var(--orange-hi)}
.smetrics span{font-size:.8rem;color:rgba(240,239,234,.65)}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
.tags li{border:1px solid var(--line-strong);padding:4px 9px 3px;font:500 .95rem var(--font-display);letter-spacing:.03em;color:var(--ink)}
.route .tags li{border-color:var(--line-dark);color:var(--on-dark)}
.route-map{position:sticky;top:calc(var(--nav-h) + 16px);height:calc(100svh - var(--nav-h) - 32px);min-height:340px}
.map-box{position:relative;height:100%;overflow:hidden;background:#0c1216;border:1px solid var(--line-dark)}
.route-map .map{width:100%;height:100%;overflow:visible}
.map-shade{position:absolute;inset:0;pointer-events:none;background:radial-gradient(120% 90% at 50% 45%,transparent 55%,rgba(5,9,11,.55))}
.hud{position:absolute;left:16px;bottom:14px;display:inline-flex;align-items:center;gap:10px;font:500 1rem var(--font-display);letter-spacing:.08em;text-transform:uppercase;color:#fff;max-width:calc(100% - 32px)}
.hud i{width:7px;height:7px;border-radius:50%;background:var(--orange);flex:none;animation:beat 2.2s infinite}
.hud span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* about */
.why-grid{display:grid;grid-template-columns:.85fr 1.15fr;gap:clamp(32px,6vw,110px);align-items:start}
.why-grid.solo{grid-template-columns:1fr}
.about-p{max-width:54ch;color:var(--ink-soft);font-size:1.08rem}
.why-list li{display:grid;grid-template-columns:minmax(150px,260px) 1fr;gap:28px;align-items:baseline;padding:28px 0;border-top:1.5px solid var(--line-strong)}
.why-list li:last-child{border-bottom:1.5px solid var(--line-strong)}
.why-n{font:300 clamp(3.4rem,7vw,7.4rem)/.85 var(--font-display);letter-spacing:-.02em;color:var(--ink);overflow-wrap:anywhere}
.why-list p{font-size:1.04rem;max-width:40ch}
/* rows */
.rows-grid{display:grid;grid-template-columns:.8fr 1.2fr;gap:clamp(32px,6vw,110px);align-items:start}
.rows{border-top:1.5px solid var(--line-strong)}
.rows li{display:flex;justify-content:space-between;gap:20px;padding:22px 0;border-bottom:1px solid var(--line)}
.rows b{display:block;font:500 clamp(1.4rem,2vw,1.8rem)/1.1 var(--font-display);text-transform:uppercase;overflow-wrap:anywhere}
.rows span{display:block;color:var(--ink-soft);margin-top:4px;font-size:.95rem}
.rows em{font-style:normal;color:var(--orange-ink);white-space:nowrap;padding-top:.3em}
.kit-list{border-top:1.5px solid var(--line-strong)}
.kit-list>li{padding:24px 0;border-bottom:1px solid var(--line)}
.kit-list h3{font-size:1.6rem;text-transform:uppercase;margin-bottom:.1em}
.quotes{border-top:1.5px solid var(--line-strong)}
.quotes li{padding:26px 0;border-bottom:1px solid var(--line)}
.quotes q{display:block;font:400 clamp(1.5rem,2.3vw,2.1rem)/1.2 var(--font-display);quotes:none;max-width:30ch}
.quotes q:before{content:"\\201C";color:var(--orange-ink)}.quotes q:after{content:"\\201D";color:var(--orange-ink)}
.quotes .who{display:block;margin-top:12px;color:var(--ink-mute);font-size:.74rem}
.quotes .where{display:block;margin-top:2px;color:var(--ink-mute);font-size:.86rem}
/* contact */
.book{background:var(--asphalt);color:var(--on-dark);padding:clamp(90px,11vw,160px) 0 clamp(60px,8vw,110px);position:relative;overflow:clip}
.book:before{content:"";position:absolute;inset:0;background:radial-gradient(60% 80% at 85% 20%,color-mix(in srgb,var(--accent) 16%,transparent),transparent 70%);pointer-events:none}
.book .eyebrow{color:var(--on-dark-soft)}.book .eyebrow:before{color:var(--orange)}
.book-grid{position:relative;display:grid;grid-template-columns:1fr minmax(320px,520px);gap:clamp(32px,6vw,110px);align-items:start}
.book h2{font-size:clamp(3.6rem,9vw,9rem);text-transform:uppercase;line-height:.84;margin:.25em 0 .5em;max-width:8ch;color:#fff}
.direct{border-top:1px solid var(--line-dark)}
.direct li{border-bottom:1px solid var(--line-dark)}
.direct a,.direct div{display:grid;grid-template-columns:110px 1fr auto;gap:12px;padding:16px 0;align-items:center}
.direct div{grid-template-columns:110px 1fr}
.direct .lab{font-size:.7rem;color:rgba(240,239,234,.6)}
.direct b{font:500 clamp(1.2rem,1.8vw,1.6rem)/1.15 var(--font-display);letter-spacing:.03em;overflow-wrap:anywhere}
.direct i{font-style:normal;color:var(--orange-hi);transition:transform .3s var(--ease)}
.direct a:hover i{transform:translateX(5px)}.direct a:hover b{color:var(--orange-hi)}
.foot{background:var(--asphalt);color:var(--on-dark-soft);border-top:1px solid var(--line-dark);padding:22px 0;font-size:.85rem}
.foot .container{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
/* reveal */
.js [data-reveal]{opacity:0;transform:translateY(22px);transition:opacity .8s var(--ease),transform .8s var(--ease)}
.js [data-reveal].in{opacity:1;transform:none}
@media (max-width:900px){
:root{--nav-h:104px}
.nav{flex-wrap:wrap;align-content:center;gap:2px 12px;padding-top:6px;padding-bottom:4px}
.nav-links{order:3;width:100%;margin:0;gap:20px;overflow-x:auto;padding:4px 0 6px;scrollbar-width:none}
.nav-links a{white-space:nowrap;font-size:.95rem}
.nav-cta{padding:8px 12px 7px;font-size:.82rem}
.hero-in{justify-content:flex-start;padding-bottom:28px}
.stop1{position:relative;right:auto;bottom:auto;margin:0 var(--pad) 24px;width:min(260px,calc(100% - 2 * var(--pad)));align-self:flex-start}
.ticket-row{flex-wrap:wrap}.tf{flex:1 1 40%;border-bottom:1px solid var(--line)}.ticket-go{width:100%;justify-content:center;margin:0}
.strip-in{flex-wrap:wrap}.strip-in>*{padding:10px 16px 10px 0;border-left:0}.cue{display:none}
.route-grid,.why-grid,.rows-grid,.book-grid{grid-template-columns:1fr}
.route-map{order:-1;top:var(--nav-h);height:36svh;min-height:230px;margin:0 calc(var(--pad) * -1);z-index:6}
.map-box{border-left:0;border-right:0}
.why-list li{grid-template-columns:1fr;gap:6px}
.direct a,.direct div{grid-template-columns:84px 1fr auto}.direct div{grid-template-columns:84px 1fr}
.stop{padding-left:48px}.stop:before{width:34px;height:34px;font-size:.85rem}.stops:before{left:16px}
}
@media (prefers-reduced-motion:reduce){
html{scroll-behavior:auto}
*,*:before,*:after{animation:none!important;transition:none!important}
.js [data-reveal]{opacity:1;transform:none}
}
`;

const JS = `(function(){
var d=document,w=window;
var rm=w.matchMedia&&w.matchMedia("(prefers-reduced-motion: reduce)").matches;
var nav=d.querySelector(".nav"),bar=d.getElementById("prog-i");
var stops=[].slice.call(d.querySelectorAll(".stop")),pins=[].slice.call(d.querySelectorAll("#r-pins .pin"));
var path=d.getElementById("r-base"),line=d.getElementById("r-line"),truck=d.getElementById("r-truck"),hud=d.getElementById("hud-t"),rmap=d.getElementById("route-map");
var DATA=JSON.parse(d.getElementById("rb-data").textContent||"[]");
var total=0,lens=[],cur=0,target=0,raf=0,active=-1;
function at(l){var p=path.getPointAtLength(l);return p}
function setup(){
 if(!path||!pins.length)return;
 total=path.getTotalLength();
 pins.forEach(function(pin,i){
  var n=pin.querySelector(".p-n");if(n)n.textContent=String(i+1);
  var cx=+pin.querySelector(".p-dot").getAttribute("cx"),cy=+pin.querySelector(".p-dot").getAttribute("cy"),best=0,bd=1e12;
  for(var l=0;l<=total;l+=3){var p=at(l),dx=p.x-cx,dy=p.y-cy,dd=dx*dx+dy*dy;if(dd<bd){bd=dd;best=l}}
  lens[i]=best;
 });
 line.style.strokeDasharray="0 "+(total+10);
 var g=d.getElementById("r-glow");if(g)g.style.strokeDasharray="0 "+(total+10);
}
function paint(){
 var g=d.getElementById("r-glow"),dash=cur+" "+(total+10);
 line.style.strokeDasharray=dash;if(g)g.style.strokeDasharray=dash;
 var p=at(cur),q=at(Math.min(total,cur+2));
 var a=Math.atan2(q.y-p.y,q.x-p.x)*180/Math.PI;
 truck.setAttribute("transform","translate("+p.x+" "+p.y+") rotate("+a+")");
}
function tick(){
 cur+=(target-cur)*(rm?1:.1);
 if(Math.abs(target-cur)<.4)cur=target;
 paint();
 raf=cur===target?0:w.requestAnimationFrame(tick);
}
function activate(i){
 if(i===active||!lens.length)return;active=i;
 stops.forEach(function(s,k){s.classList.toggle("is-active",k===i)});
 pins.forEach(function(p,k){p.classList.toggle("is-on",k===i)});
 if(hud&&DATA[i])hud.textContent=DATA[i];
 target=lens[i];
 if(!raf)raf=w.requestAnimationFrame(tick);
}
function pick(){
 if(!stops.length)return;
 var sec=d.getElementById("route"),r=sec.getBoundingClientRect(),vh=w.innerHeight;
 if(r.bottom<0||r.top>vh)return;
 var mr=rmap.getBoundingClientRect(),stacked=mr.left<=1&&mr.width>=w.innerWidth-2;
 var y=stacked?mr.bottom+Math.min(160,vh*.22):vh*.5,best=0,bd=1e9;
 stops.forEach(function(s,k){var b=s.getBoundingClientRect(),c=Math.abs((b.top+b.bottom)/2-y);if(b.top<=y&&b.bottom>=y)c=-1;if(c<bd){bd=c;best=k}});
 activate(best);
}
var ticking=false;
function onScroll(){
 if(ticking)return;ticking=true;
 w.requestAnimationFrame(function(){
  ticking=false;
  var y=w.pageYOffset||0,h=d.documentElement.scrollHeight-w.innerHeight;
  if(nav)nav.classList.toggle("is-solid",y>40);
  if(bar)bar.style.transform="scaleX("+(h>0?Math.min(1,y/h):0)+")";
  pick();
 });
}
d.documentElement.classList.add("js");
setup();
if(stops.length){activate(0);cur=target;paint()}
pins.forEach(function(p){p.addEventListener("click",function(e){var s=d.getElementById("stop-"+p.getAttribute("data-i"));if(s){e.preventDefault();s.scrollIntoView({behavior:rm?"auto":"smooth",block:"center"})}})});
var els=[].slice.call(d.querySelectorAll("[data-reveal]"));
if("IntersectionObserver" in w&&!rm){
 var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}})},{rootMargin:"0px 0px -8% 0px",threshold:.05});
 els.forEach(function(e){io.observe(e)});
}else els.forEach(function(e){e.classList.add("in")});
w.addEventListener("scroll",onScroll,{passive:true});w.addEventListener("resize",onScroll);
onScroll();
})();`;

function render({ facts: f, custom }: RenderInput): string {
  const accent = accentColour(custom, DEFAULT_ACCENT, BACKGROUND);
  const fo = fontOverride(custom);
  const fontFamilies = fo ? [fo.family] : [{ family: "Barlow Condensed", weights: "300;400;500;600" }, { family: "Inter Tight", weights: "400;500;600" }];
  const display = fo ? fo.stack : "'Barlow Condensed','Arial Narrow',sans-serif";
  const text = fo ? fo.stack : "'Inter Tight','Inter',system-ui,sans-serif";

  const keys = visibleSections(f, custom, SECTIONS);
  const stops = stopsOf(f, keys);
  const hasRoute = stops.length > 0;
  const tones = ["tone-a", "tone-b", "tone-c"];
  let toneI = 0;
  let routeDone = false;
  const blocks: Array<{ key: SectionKey; id: string; html: string }> = [];
  for (const k of keys) {
    const tone = tones[toneI % tones.length] as string;
    if (k === "experience" || k === "projects") {
      if (!hasRoute || routeDone) continue;
      routeDone = true;
      blocks.push({ key: k, id: "route", html: renderRoute(stops) });
      continue;
    }
    toneI++;
    switch (k) {
      case "about": blocks.push({ key: k, id: "about", html: renderAbout(f, tone) }); break;
      case "skills": blocks.push({ key: k, id: "skills", html: renderSkills(f, tone) }); break;
      case "education":
        blocks.push({ key: k, id: "education", html: rowsSection("education", tone, "Before the road", "Education", f.education.map((e) => ({ main: e.school, sub: [e.degree, e.detail].filter(Boolean).join(" · ") || undefined, meta: e.period }))) });
        break;
      case "achievements":
        blocks.push({ key: k, id: "achievements", html: rowsSection("achievements", tone, "Milestones", "Achievements", f.achievements.map((a) => ({ main: a.title, sub: a.detail, meta: a.year }))) });
        break;
      case "certifications":
        blocks.push({ key: k, id: "certifications", html: rowsSection("certifications", tone, "Papers", "Certifications", f.certifications.map((c) => ({ main: c.name, sub: c.issuer, meta: c.year }))) });
        break;
      case "testimonials": blocks.push({ key: k, id: "testimonials", html: renderTestimonials(f, tone) }); break;
      case "extras": blocks.push({ key: k, id: "extras", html: renderExtras(f, tone) }); break;
      case "contact": blocks.push({ key: k, id: "contact", html: renderContact(f) }); break;
    }
  }

  const navLinks = blocks.filter((b) => b.key !== "contact").map((b) => `<a href="#${b.id}">${NAV_LABEL[b.key]}</a>`).join("");
  const hasContact = blocks.some((b) => b.key === "contact");
  const cta = hasContact ? `<a class="nav-cta" href="#contact">Get in touch</a>` : "";
  const goTarget = hasContact ? "#contact" : blocks[0] ? `#${blocks[0].id}` : "#main";

  // Hero: the trip request card holds what the facts say about the role and the base.
  const latest = f.experience[0];
  const role = f.headline ?? latest?.role;
  const cells: string[] = [];
  if (role) cells.push(`<div class="tf"><span class="tf-k lab">Role</span><span class="tf-v">${esc(role)}</span></div>`);
  if (f.location) cells.push(`<div class="tf"><span class="tf-k lab">Based in</span><span class="tf-v">${esc(f.location)}</span></div>`);
  if (!f.location && latest) cells.push(`<div class="tf"><span class="tf-k lab">Now at</span><span class="tf-v">${esc(latest.org)}</span></div>`);
  const ticket = `<div class="ticket" aria-label="Trip request"><div class="ticket-head lab"><b>Trip request</b></div><div class="ticket-row">${cells.join("")}<a class="ticket-go" href="${attr(goTarget)}">Plan it <svg viewBox="0 0 20 12" width="20" height="12" aria-hidden="true"><path d="M0 6h18M13 1l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></a></div></div>`;
  const sub = f.tagline ?? f.summary;
  const photo = photoTag(f, { alt: f.name });
  const stop1 = photo
    ? `<figure class="stop1"><div class="stop1-media"><span class="stop1-tag lab">Start</span>${photo}</div><figcaption class="stop1-body"><b>${esc(f.name)}</b>${f.location ? `<small>${esc(f.location)}</small>` : ""}</figcaption></figure>`
    : "";

  const heroPts = wideRoute();
  const heroPath = smoothPath(heroPts);
  const heroDots = heroPts.map((p) => `<circle class="hero-dot" cx="${p[0]}" cy="${p[1]}" r="7"/>`).join("");
  const heroMap = `<svg class="map" viewBox="0 0 1000 640" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${backdrop(1000, 640)}<g><path class="r-base" d="${heroPath}"/><path class="r-flow" d="${heroPath}"/><path class="r-glow" d="${heroPath}"/><path class="r-line" d="${heroPath}"/>${heroDots}</g></svg>`;

  const stripCells: string[] = [];
  if (f.location) stripCells.push(`<div><span class="s-k lab">Position</span><span class="s-v"><i></i>${esc(f.location)}</span></div>`);
  if (latest) stripCells.push(`<div class="grow"><span class="s-k lab">Latest stop</span><span class="s-v">${esc([latest.role, latest.org].join(", "))}</span></div>`);
  if (f.email) stripCells.push(`<div><span class="s-k lab">Contact</span><span class="s-v">${esc(f.email)}</span></div>`);
  if (!stripCells.some((c) => c.includes("grow"))) stripCells.push(`<div class="grow"></div>`);
  stripCells.push(`<a class="cue lab" href="${attr(goTarget === "#main" ? "#main" : blocks[0] ? `#${blocks[0].id}` : "#main")}" aria-label="Scroll along the route"><span>Scroll</span><i></i></a>`);

  const logo = `<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#11181D" stroke="currentColor" stroke-opacity=".5"/><path d="M12 3.4l2.7 8.6H9.3z" fill="var(--orange)"/><path d="M12 20.6l-2.7-8.6h5.4z" fill="#fff" opacity=".6"/></svg>`;
  const routeNames = stops.map((s) => s.title);
  const title = `${f.name}${f.headline ? ` · ${f.headline}` : ""}`;
  const desc = clip(f.tagline ?? f.summary ?? f.headline ?? f.name, 200);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${attr(desc)}">
<meta name="theme-color" content="#11181d">
<link rel="stylesheet" href="${googleFontsHref(fontFamilies)}">
<style>:root{--accent:${accent};--font-display:${display};--font-text:${text}}${CSS}</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="prog" aria-hidden="true"><i id="prog-i"></i></div>
<header class="nav"><a class="logo" href="#top">${logo}<span>${esc(f.name)}</span></a><nav class="nav-links" aria-label="Sections">${navLinks}</nav>${cta}</header>
<main id="main">
<section class="hero" id="top" aria-label="${attr(f.name)}">
${heroMap}<div class="hero-shade" aria-hidden="true"></div>
<div class="hero-in">
${f.headline || f.location ? `<p class="kicker lab">` : ""}${f.headline ? `<b>${esc(f.headline)}</b>` : ""}${f.location ? `<span>${esc(f.location)}</span>` : ""}${f.headline || f.location ? "</p>" : ""}
<h1>${heroTitle(f.name)}</h1>
${sub ? `<p class="hero-sub">${esc(sub)}</p>` : ""}
${ticket}
</div>
${stop1}
<div class="strip"><div class="strip-in">${stripCells.join("")}</div></div>
</section>
${blocks.map((b) => b.html).join("\n")}
</main>
<footer class="foot"><div class="container"><span>${esc(f.name)}</span>${f.location ? `<span>${esc(f.location)}</span>` : ""}</div></footer>
<script type="application/json" id="rb-data">${safeJson(routeNames)}</script>
${scriptTag(JS)}
</body>
</html>`;
}

const template: ThemeTemplate = { id: "route-board", sections: SECTIONS, defaultAccent: DEFAULT_ACCENT, render };
export default template;
