import type { PortfolioFacts, SectionKey } from "../../facts";
import { accentColour, attr, esc, fontOverride, googleFontsHref, initials, photoTag, safeHref, scriptTag, visibleSections } from "../helpers";
import type { RenderInput, ThemeTemplate } from "../types";

const DEFAULT_ACCENT = "#0b57d0";
const SECTIONS: SectionKey[] = ["about", "experience", "projects", "education", "skills", "achievements", "certifications", "testimonials", "extras", "contact"];

const ICONS: Record<string, string> = {
  search: "M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
  add: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
  remove: "M19 13H5v-2h14v2z",
  close: "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
  work: "M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z",
  school: "M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3 1 9l11 6 9-4.91V17h2V9L12 3z",
  folder: "M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z",
  place: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z",
  mail: "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z",
  phone: "M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2z",
  link: "M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z",
  star: "M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z",
  check: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
  history: "M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z",
  chev: "M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z",
  me: "M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z",
};
const icon = (n: string, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${ICONS[n]}"/></svg>`;

function hash(s: string, seed: number): number {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) % 100000;
}
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An abstract city-map backdrop: blocks, parks, water and roads. Not a real place. */
function mapArt(): string {
  const r = rng(7);
  const blocks: string[] = [];
  for (let gx = 0; gx < 22; gx++) {
    for (let gy = 0; gy < 17; gy++) {
      const w = 36 + Math.round(r() * 30);
      const h = 32 + Math.round(r() * 28);
      const x = -380 + gx * 80 + 4;
      const y = -300 + gy * 72 + 4;
      blocks.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${(gx + gy) % 3 === 0 ? "#e4e0d8" : "#ebe8e1"}"/>`);
    }
  }
  return `<rect x="-600" y="-500" width="2200" height="1700" fill="#fbfaf7"/>
<g transform="rotate(-9 500 350)">${blocks.join("")}</g>
<g fill="#cde9cf"><ellipse cx="250" cy="170" rx="95" ry="58"/><ellipse cx="760" cy="520" rx="110" ry="64"/><ellipse cx="560" cy="60" rx="70" ry="40"/><ellipse cx="140" cy="470" rx="60" ry="46"/></g>
<path d="M-300 620 C 40 500 220 680 430 630 S 650 800 1300 780 L 1300 1100 L -300 1100Z" fill="#aadaff"/>
<path d="M1300 -150 C 1020 100 790 150 720 330 S 560 540 430 650" fill="none" stroke="#aadaff" stroke-width="30" stroke-linecap="round"/>
<g fill="none" stroke-linecap="round"><path d="M-300 210 C 250 150 520 400 1300 300" stroke="#f1c964" stroke-width="13"/><path d="M-300 210 C 250 150 520 400 1300 300" stroke="#fde293" stroke-width="9"/>
<path d="M140 -200 C 260 200 410 470 690 1000" stroke="#f1c964" stroke-width="13"/><path d="M140 -200 C 260 200 410 470 690 1000" stroke="#fde293" stroke-width="9"/>
<path d="M-300 560 C 300 540 800 440 1300 540" stroke="#ffffff" stroke-width="9"/></g>`;
}

interface Pin {
  key: string;
  label: string;
  x: number;
  y: number;
  lines: string[];
}

function locKey(loc: string): string {
  return (loc.split(",")[0] ?? loc).trim().toLowerCase();
}

function buildPins(f: PortfolioFacts): Pin[] {
  const pins: Pin[] = [];
  const add = (loc: string | undefined, line: string) => {
    if (!loc) return;
    const key = locKey(loc);
    if (!key) return;
    let p = pins.find((q) => q.key === key);
    if (!p) {
      p = { key, label: loc, x: 0, y: 0, lines: [] };
      pins.push(p);
    }
    if (loc.length > p.label.length) p.label = loc;
    if (!p.lines.includes(line)) p.lines.push(line);
  };
  add(f.location, "Based here");
  for (const e of f.experience) add(e.location, e.org);
  pins.forEach((p, i) => {
    let x = 230 + (hash(p.key, 1) % 560);
    let y = 150 + (hash(p.key, 2) % 380);
    for (let n = 0; n < 12; n++) {
      if (!pins.slice(0, i).some((q) => Math.hypot(q.x - x, q.y - y) < 110)) break;
      x = 230 + ((x - 230 + 137) % 560);
      y = 150 + ((y - 150 + 89) % 380);
    }
    p.x = x;
    p.y = y;
  });
  return pins;
}

const yearOf = (p: string | undefined): number | null => {
  const m = p?.match(/\b(19|20)\d\d\b/);
  return m ? Number(m[0]) : null;
};

function render({ facts: f, custom }: RenderInput): string {
  const accent = accentColour(custom, DEFAULT_ACCENT, "#ffffff");
  const font = fontOverride(custom);
  const headFont = font ? font.stack : "'Inter', 'Roboto', system-ui, sans-serif";
  const textFont = font ? font.stack : "'Roboto', 'Inter', system-ui, sans-serif";
  const fontsHref = googleFontsHref(font ? [font.family] : [{ family: "Inter", weights: "400;500;600" }, { family: "Roboto", weights: "400;500;700" }]);
  const secs = visibleSections(f, custom, SECTIONS);
  const pins = buildPins(f);
  const pinIdx = (loc: string | undefined) => (loc ? pins.findIndex((p) => p.key === locKey(loc)) : -1);

  // ----- place cards -----
  const metrics = (m: { value: string; label: string }[]) => (m.length ? `<div class="mets">${m.map((x) => `<span class="met"><b>${esc(x.value)}</b> ${esc(x.label)}</span>`).join("")}</div>` : "");
  const card = (o: { layer: string; ic: string; title: string; sub?: string | undefined; loc?: string | undefined; pin: number; body: string }) => {
    const sub = o.sub ? `<span class="csub">${esc(o.sub)}</span>` : "";
    const loc = o.loc ? `<span class="cloc">${icon("place")}${esc(o.loc)}</span>` : "";
    const chev = o.body ? icon("chev", "chev") : "";
    return `<article class="card" data-layer="${o.layer}"${o.pin >= 0 ? ` data-pin="${o.pin}"` : ""}>
<button class="chead" type="button"${o.body ? ' aria-expanded="false"' : ""}><span class="cic ${o.layer}">${icon(o.ic)}</span><span class="ctx"><span class="ct">${esc(o.title)}</span>${sub}${loc}</span>${chev}</button>
${o.body ? `<div class="cbody">${o.body}</div>` : ""}</article>`;
  };
  const bullets = (b: string[]) => (b.length ? `<ul class="bl">${b.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "");
  const para = (t?: string) => (t ? `<p>${esc(t)}</p>` : "");

  const timelineEntries = (() => {
    if (f.experience.length < 2) return [];
    const rev = [...f.experience].reverse();
    const ys = f.experience.map((e) => yearOf(e.period));
    if (ys.every((y) => y !== null)) return [...f.experience].sort((a, b) => (yearOf(a.period) as number) - (yearOf(b.period) as number));
    return rev;
  })();

  const sec = (k: SectionKey): string => {
    switch (k) {
      case "about": {
        const stats = f.stats.length ? `<div class="stats">${f.stats.map((s) => `<div class="stat"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join("")}</div>` : "";
        return `<section class="blk" id="sec-about"><h2>About</h2>${f.tagline ? `<p class="lead">${esc(f.tagline)}</p>` : ""}${para(f.summary)}${stats}</section>`;
      }
      case "experience": {
        const cards = f.experience.map((e) => card({ layer: "exp", ic: "work", title: e.org, sub: [e.role, e.period].filter(Boolean).join(" · "), loc: e.location, pin: pinIdx(e.location), body: para(e.summary) + bullets(e.bullets) })).join("");
        const tl = timelineEntries.length
          ? `<section class="blk" id="sec-timeline" data-layer="exp"><h2>Timeline</h2><ol class="route">${timelineEntries.map((e) => `<li><span class="dot"></span><b>${esc(e.role)}</b><span>${esc([e.org, e.period].filter(Boolean).join(" · "))}</span></li>`).join("")}</ol></section>`
          : "";
        return `<section class="blk" id="sec-experience" data-layer="exp"><h2>Experience</h2>${cards}</section>${tl}`;
      }
      case "projects": {
        const cards = f.projects
          .map((p) => {
            const href = safeHref(p.link);
            const tags = p.tags.length ? `<div class="chips-s">${p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : "";
            const lk = href ? `<a class="vis" href="${attr(href)}" target="_blank" rel="noopener noreferrer">${icon("link")}Visit</a>` : "";
            return card({ layer: "proj", ic: "folder", title: p.name, sub: [p.role, p.period].filter(Boolean).join(" · "), pin: -1, body: para(p.description) + metrics(p.metrics) + bullets(p.bullets) + tags + lk });
          })
          .join("");
        return `<section class="blk" id="sec-projects" data-layer="proj"><h2>Projects</h2>${cards}</section>`;
      }
      case "education": {
        const cards = f.education.map((e) => card({ layer: "edu", ic: "school", title: e.school, sub: [e.degree, e.period].filter(Boolean).join(" · "), pin: -1, body: para(e.detail) })).join("");
        return `<section class="blk" id="sec-education" data-layer="edu"><h2>Education</h2>${cards}</section>`;
      }
      case "skills":
        return `<section class="blk" id="sec-skills"><h2>Skills</h2>${f.skills.map((g) => `${g.group ? `<h3>${esc(g.group)}</h3>` : ""}<div class="chips-s">${g.items.map((i) => `<span class="tag">${esc(i)}</span>`).join("")}</div>`).join("")}</section>`;
      case "achievements":
        return `<section class="blk" id="sec-achievements"><h2>Achievements</h2>${f.achievements.map((a) => `<div class="row">${icon("star", "ri")}<div><b>${esc(a.title)}</b>${a.detail ? `<span>${esc(a.detail)}</span>` : ""}</div>${a.year ? `<em>${esc(a.year)}</em>` : ""}</div>`).join("")}</section>`;
      case "certifications":
        return `<section class="blk" id="sec-certifications"><h2>Certifications</h2>${f.certifications.map((c) => `<div class="row">${icon("check", "ri")}<div><b>${esc(c.name)}</b>${c.issuer ? `<span>${esc(c.issuer)}</span>` : ""}</div>${c.year ? `<em>${esc(c.year)}</em>` : ""}</div>`).join("")}</section>`;
      case "testimonials":
        return `<section class="blk" id="sec-testimonials"><h2>Reviews</h2>${f.testimonials.map((t) => `<figure class="rev"><figcaption><span class="av2">${esc(initials(t.author))}</span><span><b>${esc(t.author)}</b>${t.role ? `<span>${esc(t.role)}</span>` : ""}</span></figcaption><blockquote>${esc(t.quote)}</blockquote></figure>`).join("")}</section>`;
      case "extras":
        return `<section class="blk" id="sec-extras"><h2>Good to know</h2>${f.extras.map((x) => `<h3>${esc(x.label)}</h3><div class="chips-s">${x.items.map((i) => `<span class="tag">${esc(i)}</span>`).join("")}</div>`).join("")}</section>`;
      case "contact": {
        const rows: string[] = [];
        if (f.email) rows.push(`<a class="row lk" href="mailto:${attr(f.email)}">${icon("mail", "ri")}<div><b>${esc(f.email)}</b></div></a>`);
        if (f.phone) rows.push(`<a class="row lk" href="tel:${attr(f.phone.replace(/[^\d+]/g, ""))}">${icon("phone", "ri")}<div><b>${esc(f.phone)}</b></div></a>`);
        for (const l of f.links) {
          const h = safeHref(l.url);
          rows.push(h ? `<a class="row lk" href="${attr(h)}" target="_blank" rel="noopener noreferrer">${icon("link", "ri")}<div><b>${esc(l.label)}</b></div></a>` : `<div class="row">${icon("link", "ri")}<div><b>${esc(l.label)}</b></div></div>`);
        }
        return `<section class="blk" id="sec-contact"><h2>Contact</h2>${rows.join("")}</section>`;
      }
    }
  };

  // ----- header actions -----
  const actions: string[] = [];
  if (secs.includes("contact")) {
    if (f.email) actions.push(`<a class="act" href="mailto:${attr(f.email)}"><span class="c">${icon("mail")}</span>Email</a>`);
    if (f.phone) actions.push(`<a class="act" href="tel:${attr(f.phone.replace(/[^\d+]/g, ""))}"><span class="c">${icon("phone")}</span>Call</a>`);
    for (const l of f.links.slice(0, 3)) {
      const h = safeHref(l.url);
      if (h) actions.push(`<a class="act" href="${attr(h)}" target="_blank" rel="noopener noreferrer"><span class="c">${icon("link")}</span>${esc(l.label)}</a>`);
    }
  }
  const hero = f.photoUrl ? `<div class="hero">${photoTag(f, { className: "hp" })}</div>` : "";
  const header = `<header class="ph" id="top">${hero}<div class="phi"><h1>${esc(f.name)}</h1>${f.headline ? `<p class="hl">${esc(f.headline)}</p>` : ""}${f.location ? `<p class="hloc">${icon("place")}${esc(f.location)}</p>` : ""}</div>${actions.length ? `<div class="actions">${actions.join("")}</div>` : ""}</header>`;

  // ----- layers (chips) -----
  const layers = [
    secs.includes("experience") ? { id: "exp", label: "Experience" } : null,
    secs.includes("projects") ? { id: "proj", label: "Projects" } : null,
    secs.includes("education") ? { id: "edu", label: "Education" } : null,
  ].filter((x): x is { id: string; label: string } => x !== null);
  const chips = layers.length >= 2 ? `<div class="chips" id="chips" role="group" aria-label="Layers"><button class="chip" type="button" data-chip="all" aria-pressed="true">All</button>${layers.map((l) => `<button class="chip" type="button" data-chip="${l.id}" aria-pressed="false">${l.label}</button>`).join("")}</div>` : "";

  // ----- navigation -----
  const nav: Array<{ href: string; label: string; ic: string; key: string }> = [{ href: "#top", label: "Explore", ic: "place", key: "top" }];
  if (secs.includes("experience") && timelineEntries.length) nav.push({ href: "#sec-timeline", label: "Timeline", ic: "history", key: "sec-timeline" });
  if (secs.includes("testimonials")) nav.push({ href: "#sec-testimonials", label: "Reviews", ic: "star", key: "sec-testimonials" });
  if (secs.includes("contact")) nav.push({ href: "#sec-contact", label: "Contact", ic: "mail", key: "sec-contact" });
  const showNav = nav.length >= 2;
  const rail = showNav ? `<nav class="rail" aria-label="Main">${nav.map((n) => `<a class="rail-item" href="${n.href}" data-key="${n.key}"><span class="ri-ic">${icon(n.ic)}</span><span>${n.label}</span></a>`).join("")}</nav>` : "";
  const bnav = showNav ? `<nav class="bnav" aria-label="App">${nav.map((n) => `<a href="${n.href}" data-key="${n.key}">${icon(n.ic)}<span>${n.label}</span></a>`).join("")}</nav>` : "";

  // ----- map -----
  const pinSvg = pins
    .map(
      (p, i) =>
        `<g class="pin" data-pin="${i}" data-x="${p.x}" data-y="${p.y}" transform="translate(${p.x} ${p.y})" tabindex="0" role="button" aria-label="${attr(p.label)}"><g class="pi" transform="scale(1)"><path d="M0 0C-5 -11 -13 -17 -13 -27A13 13 0 1 1 13 -27C13 -17 5 -11 0 0Z" fill="#ea4335" stroke="#b3261e" stroke-width="1"/><circle cy="-27" r="5" fill="#ffffff"/><text x="19" y="-22" class="pl">${esc(p.label)}</text></g></g>`,
    )
    .join("");
  const pops = pins.map((p, i) => `<div class="pop" data-for="${i}" hidden><b>${esc(p.label)}</b>${p.lines.map((l) => `<span>${esc(l)}</span>`).join("")}</div>`).join("");
  const home = f.location ? pins.findIndex((p) => p.key === locKey(f.location as string)) : -1;
  const searchPh = [f.name, f.headline].filter(Boolean).join(" · ");
  const avatar = f.photoUrl ? photoTag(f, { alt: "", className: "av" }) : `<span class="av av-i">${esc(initials(f.name))}</span>`;

  const css = `
:root{--blue:${accent};--blue-l:color-mix(in srgb,var(--blue) 22%,#fff);--blue-50:color-mix(in srgb,var(--blue) 8%,#fff);--blue-ink:color-mix(in srgb,var(--blue) 30%,#000);--ink:#1f1f1f;--ink-2:#444746;--mute:#5e5e5e;--line:#e3e3e3;--hover:#f1f3f4;--surface:#f0f4f9;--f-head:${headFont};--f-text:${textFont};--rail:72px;--side:408px;--sh:0 1px 2px rgba(60,64,67,.3),0 1px 3px 1px rgba(60,64,67,.15)}
*{box-sizing:border-box}[hidden]{display:none!important}
html{scroll-behavior:smooth}
body{margin:0;font:400 14px/20px var(--f-text);color:var(--ink);background:var(--surface);-webkit-font-smoothing:antialiased}
button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;text-align:left}
a{color:var(--blue);text-decoration:none}a:hover{text-decoration:underline}
img{display:block;max-width:100%}h1,h2,h3,p,ol,ul,figure,blockquote{margin:0}
:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
.ic{width:24px;height:24px;fill:currentColor;flex:none}
.skip{position:fixed;left:8px;top:8px;z-index:200;background:#fff;padding:8px 12px;clip-path:inset(50%)}.skip:focus{clip-path:none}
.rail,.sbmask{display:none}
body.sc .sbmask{display:block;position:fixed;z-index:68;left:0;right:0;top:0;height:64px;background:#fff}body.sc .chips{display:none!important}.bnav{position:fixed;z-index:60;left:0;right:0;bottom:0;height:60px;background:#fff;border-top:1px solid var(--line);display:flex;justify-content:space-around;align-items:center;padding-bottom:env(safe-area-inset-bottom)}
.bnav a{display:flex;flex-direction:column;align-items:center;gap:2px;font:500 11px/14px var(--f-head);color:var(--ink-2);text-decoration:none;padding:4px 12px;border-radius:12px}
.bnav a.on{color:var(--blue)}
.mapwrap{position:fixed;z-index:1;left:0;right:0;top:0;height:46vh;overflow:hidden;background:#fbfaf7}
#mapsvg{width:100%;height:100%;display:block;touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none}
#mapsvg.drag{cursor:grabbing}
.pin{cursor:pointer}.pin .pi{transition:filter .15s}.pin:hover .pi,.pin.sel .pi{filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))}
.pin.sel path{fill:#d93025}
.pl{font:500 13px var(--f-head);fill:#202124;paint-order:stroke;stroke:#fff;stroke-width:4px;stroke-linejoin:round}
.pin:focus,.pin:focus-visible{outline:none}.pin:focus-visible path{stroke:var(--blue);stroke-width:3}
.pop{position:absolute;z-index:6;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.3);padding:10px 14px;max-width:240px;pointer-events:none;transform:translate(-50%,-100%);display:flex;flex-direction:column}
.pop b{font:500 14px/20px var(--f-head)}.pop span{color:var(--mute);font-size:13px}
.searchbox{position:fixed;z-index:70;left:8px;right:8px;top:8px;height:48px;background:#fff;border-radius:24px;box-shadow:0 2px 4px rgba(0,0,0,.2);display:flex;align-items:center;padding:0 6px 0 18px;gap:6px}
.searchbox .ic{color:var(--ink-2)}
.searchbox input{flex:1;min-width:0;border:0;outline:0;background:none;font:400 15px/24px var(--f-text);color:var(--ink);height:100%}
.searchbox input::placeholder{color:var(--mute);opacity:1}
.av{width:34px;height:34px;border-radius:50%;object-fit:cover;flex:none}
.av-i{display:grid;place-items:center;background:var(--blue);color:#fff;font:500 13px var(--f-head)}
.chips{position:fixed;z-index:65;left:8px;right:8px;top:64px;display:none;gap:8px;overflow-x:auto;scrollbar-width:none}
html.js .chips{display:flex}
.chip{flex:none;height:32px;padding:0 14px;border-radius:16px;background:#fff;box-shadow:0 1px 2px rgba(60,64,67,.3);font:500 13px var(--f-head);color:var(--ink-2);display:inline-flex;align-items:center}
.chip[aria-pressed="true"]{background:var(--blue-l);color:var(--blue-ink)}
.ctrls{position:absolute;z-index:5;right:10px;bottom:30px;display:flex;flex-direction:column;gap:10px;align-items:flex-end}
.ctl{width:40px;height:40px;border-radius:50%;background:#fff;box-shadow:var(--sh);display:grid;place-items:center;color:var(--ink-2)}
.zoom{display:flex;flex-direction:column;background:#fff;border-radius:20px;box-shadow:var(--sh)}.zoom .ctl{box-shadow:none}.zoom .ctl+.ctl{border-top:1px solid var(--line);border-radius:0 0 20px 20px}.zoom .ctl:first-child{border-radius:20px 20px 0 0}
.ctl:hover{background:var(--hover)}
html:not(.js) .ctrls{display:none}
.mapfoot{position:absolute;left:8px;bottom:26px;font:400 11px/14px var(--f-text);color:#5a5a5a;background:rgba(255,255,255,.78);padding:1px 6px;border-radius:4px}
.sheet{position:relative;z-index:10;margin-top:calc(46vh - 16px);background:#fff;border-radius:16px 16px 0 0;box-shadow:0 -2px 12px rgba(0,0,0,.2);padding-bottom:90px;min-height:60vh}
.hero{height:200px;background:#e8eaed;overflow:hidden;border-radius:16px 16px 0 0}.hp{width:100%;height:100%;object-fit:cover}
.phi{padding:18px 20px 4px}
.ph h1{font:400 24px/30px var(--f-head);overflow-wrap:anywhere}
.hl{color:var(--ink-2);margin-top:2px;font-size:15px}
.hloc{display:flex;align-items:center;gap:4px;color:var(--mute);margin-top:6px}.hloc .ic{width:18px;height:18px}
.actions{display:flex;flex-wrap:wrap;gap:6px 4px;padding:14px 12px 16px;border-bottom:1px solid var(--line);margin-top:8px}
.act{display:flex;flex-direction:column;align-items:center;gap:6px;width:76px;font:500 12px/16px var(--f-head);color:var(--blue);text-align:center;text-decoration:none!important;overflow-wrap:anywhere}
.act .c{width:40px;height:40px;border-radius:50%;border:1px solid var(--line);display:grid;place-items:center;background:var(--blue-50)}.act:hover .c{background:var(--blue-l)}
.ph:not(:has(.actions)){border-bottom:1px solid var(--line);padding-bottom:14px}
.blk{padding:18px 20px;border-bottom:8px solid var(--surface)}
.blk h2{font:500 16px/24px var(--f-head);margin-bottom:10px}
.blk h3{font:500 13px/18px var(--f-head);color:var(--mute);margin:12px 0 6px}
.blk p{color:var(--ink-2);overflow-wrap:anywhere}.blk p+p{margin-top:8px}
.lead{font:400 16px/24px var(--f-head);color:var(--ink)!important;margin-bottom:8px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-top:14px}
.stat{background:var(--blue-50);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column}.stat b{font:500 20px/26px var(--f-head);color:var(--blue-ink)}.stat span{color:var(--mute);font-size:13px}
.card{border:1px solid var(--line);border-radius:12px;margin-bottom:10px;overflow:hidden;transition:box-shadow .15s,border-color .15s}
.card.sel{border-color:var(--blue);box-shadow:0 0 0 1px var(--blue)}
.chead{display:flex;align-items:flex-start;gap:12px;width:100%;padding:12px 14px}
.chead:hover{background:var(--hover)}
.cic{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;flex:none;background:var(--blue-l);color:var(--blue-ink)}
.cic.proj{background:#ceead6;color:#0d652d}.cic.edu{background:#feefc3;color:#794d00}
.ctx{display:flex;flex-direction:column;min-width:0;flex:1}.ct{font:500 15px/22px var(--f-head);overflow-wrap:anywhere}.csub{color:var(--ink-2);overflow-wrap:anywhere}
.cloc{display:flex;align-items:center;gap:2px;color:var(--mute);font-size:13px;margin-top:2px}.cloc .ic{width:15px;height:15px}
.chev{color:var(--mute);margin-top:8px;transition:transform .2s}
.card.open .chev{transform:rotate(180deg)}
.cbody{padding:2px 16px 14px 66px;border-top:0}
.cbody p{color:var(--ink-2)}
.bl{padding-left:18px;color:var(--ink-2);margin-top:8px}.bl li{margin:3px 0}
html.js .card:not(.open) .cbody{display:none}
.mets{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.met{background:var(--blue-50);border-radius:8px;padding:2px 8px;color:var(--ink-2);font-size:13px}.met b{color:var(--blue-ink);font-weight:500}
.chips-s{display:flex;flex-wrap:wrap;gap:6px}
.tag{border:1px solid var(--line-2,#c4c7c5);border-radius:8px;padding:3px 10px;font-size:13px;color:var(--ink-2);background:#fff}
.vis{display:inline-flex;align-items:center;gap:6px;margin-top:10px;font:500 13px var(--f-head)}.vis .ic{width:18px;height:18px}
.row{display:flex;align-items:flex-start;gap:14px;padding:8px 0;color:var(--ink);text-decoration:none!important}
.row .ri{color:var(--blue);margin-top:1px}.row div{flex:1;min-width:0;display:flex;flex-direction:column}.row b{font-weight:500;overflow-wrap:anywhere}.row span{color:var(--mute);font-size:13px}
.row em{font-style:normal;color:var(--mute);font-size:13px}
a.row:hover{background:var(--hover)}
.route{list-style:none;padding:0 0 0 6px;position:relative}
.route::before{content:"";position:absolute;left:11px;top:10px;bottom:10px;width:2px;background:var(--blue-l)}
.route li{position:relative;padding:0 0 14px 30px;display:flex;flex-direction:column}.route li:last-child{padding-bottom:0}
.route .dot{position:absolute;left:0;top:3px;width:12px;height:12px;border-radius:50%;background:#fff;border:3px solid var(--blue)}
.route li:last-child .dot{background:var(--blue)}
.route b{font-weight:500;overflow-wrap:anywhere}.route span:not(.dot){color:var(--mute);overflow-wrap:anywhere}
.rev{background:var(--blue-50);border-radius:12px;padding:14px;margin-bottom:10px}
.rev figcaption{display:flex;align-items:center;gap:10px;margin-bottom:8px}.rev figcaption b{display:block;font-weight:500}.rev figcaption span span{display:block;color:var(--mute);font-size:13px}
.av2{width:36px;height:36px;border-radius:50%;background:var(--blue);color:#fff;display:grid;place-items:center;font:500 13px var(--f-head);flex:none}
.rev blockquote{color:var(--ink-2)}
.none{padding:24px 20px;color:var(--mute)}
body[data-layer="exp"] [data-layer="proj"],body[data-layer="exp"] [data-layer="edu"],body[data-layer="proj"] [data-layer="exp"],body[data-layer="proj"] [data-layer="edu"],body[data-layer="edu"] [data-layer="exp"],body[data-layer="edu"] [data-layer="proj"]{display:none}
body[data-layer="proj"] .pin,body[data-layer="edu"] .pin{display:none}
@media (min-width:900px){
.bnav{display:none}
.sbmask,body.sc .sbmask{display:block;position:fixed;z-index:68;left:var(--rail);right:auto;top:0;width:var(--side);height:72px;background:#fff}
.rail{display:flex;position:fixed;z-index:45;left:0;top:0;bottom:0;width:var(--rail);background:#fff;flex-direction:column;align-items:center;padding-top:76px;gap:6px;border-right:1px solid var(--line)}
.rail-item{display:flex;flex-direction:column;align-items:center;gap:4px;width:64px;padding:4px 0 8px;color:var(--ink-2);font:500 12px/16px var(--f-head);text-decoration:none!important;text-align:center}
.ri-ic{width:56px;height:32px;border-radius:16px;display:grid;place-items:center;transition:background .15s}.rail-item:hover .ri-ic{background:var(--hover)}
.rail-item.on .ri-ic{background:var(--blue-l);color:var(--blue-ink)}
.searchbox{left:calc(var(--rail) + 12px);right:auto;width:384px;top:12px;box-shadow:0 2px 4px rgba(0,0,0,.2)}
.sheet{position:fixed;z-index:40;left:var(--rail);top:0;bottom:0;width:var(--side);margin:0;border-radius:0;box-shadow:0 0 20px rgba(0,0,0,.2);overflow-y:auto;overflow-x:hidden;padding:72px 0 40px;min-height:0;scroll-behavior:smooth;scrollbar-width:thin}
.hero{border-radius:0}
.mapwrap{left:calc(var(--rail) + var(--side));height:auto;bottom:0}
.chips{left:calc(var(--rail) + var(--side) + 14px);right:70px;top:12px}
.ctrls{bottom:34px;right:14px}.mapfoot{bottom:8px;left:auto;right:8px}
}
@media (prefers-reduced-motion:reduce){html,.sheet{scroll-behavior:auto}*{transition:none!important;animation:none!important}}
`;

  const js = `(function(){
var d=document,b=d.body,root=d.documentElement;root.classList.add("js");
var reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
var svg=d.getElementById("mapsvg"),vp=d.getElementById("vp"),wrap=d.getElementById("mapwrap");
var pins=[].slice.call(d.querySelectorAll(".pin")),pops=[].slice.call(d.querySelectorAll(".pop"));
var cards=[].slice.call(d.querySelectorAll(".card"));
var W=1000,H=700,st={k:1,x:0,y:0},sel=-1,raf=0;
b.setAttribute("data-layer","all");
function dims(){var r=svg.getBoundingClientRect();var s=Math.max(r.width/W,r.height/H)||1;return{w:r.width,h:r.height,s:s,e:(r.width-W*s)/2,f:(r.height-H*s)/2};}
function clampS(m){var k=st.k;
st.x=Math.min(Math.max(st.x,(m.w-m.e)/m.s-k*W),-m.e/m.s);
st.y=Math.min(Math.max(st.y,(m.h-m.f)/m.s-k*H),-m.f/m.s);}
function place(){if(sel<0)return;var p=pins[sel];if(!p)return;var m=dims(),pop=pops.filter(function(q){return q.getAttribute("data-for")==String(sel);})[0];if(!pop)return;
var sx=m.s*(st.k*(+p.getAttribute("data-x"))+st.x)+m.e,sy=m.s*(st.k*(+p.getAttribute("data-y"))+st.y)+m.f;
pop.style.left=sx+"px";pop.style.top=(sy-44)+"px";}
function apply(){var m=dims();clampS(m);vp.setAttribute("transform","translate("+st.x+" "+st.y+") scale("+st.k+")");
var u=(1/(st.k*m.s)).toFixed(4);pins.forEach(function(p){p.firstChild.setAttribute("transform","scale("+u+")");});place();}
function go(t,ms){cancelAnimationFrame(raf);if(reduce||!ms){st.k=t.k;st.x=t.x;st.y=t.y;apply();return;}
var a={k:st.k,x:st.x,y:st.y},t0=performance.now();
(function step(n){var p=Math.min(1,(n-t0)/ms),e=1-Math.pow(1-p,3);st.k=a.k+(t.k-a.k)*e;st.x=a.x+(t.x-a.x)*e;st.y=a.y+(t.y-a.y)*e;apply();if(p<1)raf=requestAnimationFrame(step);})(t0);}
function target(cx,cy,k){var m=dims();return{k:k,x:(m.w/2-m.e)/m.s-k*cx,y:(m.h/2-m.f)/m.s-k*cy};}
function fit(ms){var vis=pins.filter(function(p){return p.style.display!=="none"&&p.getBoundingClientRect;});
if(!vis.length){go(target(W/2,H/2,1),0);return;}
var xs=vis.map(function(p){return +p.getAttribute("data-x");}),ys=vis.map(function(p){return +p.getAttribute("data-y");});
var x0=Math.min.apply(null,xs),x1=Math.max.apply(null,xs),y0=Math.min.apply(null,ys),y1=Math.max.apply(null,ys),m=dims();
var k=Math.min((m.w*.55/m.s)/Math.max(x1-x0,80),(m.h*.5/m.s)/Math.max(y1-y0,80),1.8);k=Math.max(1,k);
go(target((x0+x1)/2,(y0+y1)/2,k),ms);}
function zoom(f,cx,cy){var m=dims(),k=Math.min(3.5,Math.max(1,st.k*f)),ux=((cx-m.e)/m.s-st.x)/st.k,uy=((cy-m.f)/m.s-st.y)/st.k;
go({k:k,x:(cx-m.e)/m.s-k*ux,y:(cy-m.f)/m.s-k*uy},reduce?0:160);}
function select(i,fromCard){sel=i;pins.forEach(function(p,j){p.classList.toggle("sel",j===i);});
pops.forEach(function(q){q.hidden=String(i)!==q.getAttribute("data-for");});
cards.forEach(function(c){c.classList.toggle("sel",i>=0&&c.getAttribute("data-pin")===String(i));});
if(i>=0){var p=pins[i];go(target(+p.getAttribute("data-x"),+p.getAttribute("data-y"),Math.max(st.k,1.6)),350);
if(!fromCard){var c=d.querySelector('.card[data-pin="'+i+'"]');if(c){c.classList.add("open");var h=c.querySelector(".chead");if(h&&h.hasAttribute("aria-expanded"))h.setAttribute("aria-expanded","true");c.scrollIntoView({block:"center",behavior:reduce?"auto":"smooth"});}}}
place();}
pins.forEach(function(p,i){p.addEventListener("click",function(e){e.stopPropagation();select(i,false);});p.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();select(i,false);}});});
cards.forEach(function(c){var h=c.querySelector(".chead");h.addEventListener("click",function(){var o=!c.classList.contains("open");
if(h.hasAttribute("aria-expanded")){c.classList.toggle("open",o);h.setAttribute("aria-expanded",String(o));}
var pi=c.getAttribute("data-pin");if(pi!==null&&o)select(+pi,true);else if(pi!==null&&!o)select(-1,true);});});
var down=null,moved=false;
svg.addEventListener("pointerdown",function(e){if(e.target.closest&&e.target.closest(".pin"))return;down={x:e.clientX,y:e.clientY};moved=false;svg.setPointerCapture(e.pointerId);svg.classList.add("drag");cancelAnimationFrame(raf);});
svg.addEventListener("pointermove",function(e){if(!down)return;var dx=e.clientX-down.x,dy=e.clientY-down.y;if(Math.abs(dx)+Math.abs(dy)>3)moved=true;down={x:e.clientX,y:e.clientY};var m=dims();st.x+=dx/m.s;st.y+=dy/m.s;apply();});
function up(){if(down&&!moved&&sel>=0)select(-1,true);down=null;svg.classList.remove("drag");}
svg.addEventListener("pointerup",up);svg.addEventListener("pointercancel",up);
svg.addEventListener("wheel",function(e){e.preventDefault();var r=svg.getBoundingClientRect();zoom(e.deltaY<0?1.25:.8,e.clientX-r.left,e.clientY-r.top);},{passive:false});
function ctr(id,fn){var el=d.getElementById(id);if(el)el.addEventListener("click",fn);}
ctr("zin",function(){var r=svg.getBoundingClientRect();zoom(1.4,r.width/2,r.height/2);});
ctr("zout",function(){var r=svg.getBoundingClientRect();zoom(.7,r.width/2,r.height/2);});
ctr("me",function(){var i=+this.getAttribute("data-pin");if(i>=0)select(i,false);});
var chipEls=[].slice.call(d.querySelectorAll(".chip"));
chipEls.forEach(function(c){c.addEventListener("click",function(){var v=c.getAttribute("data-chip");b.setAttribute("data-layer",v);chipEls.forEach(function(o){o.setAttribute("aria-pressed",String(o===c));});
pins.forEach(function(p){p.style.display=(v==="proj"||v==="edu")?"none":"";});select(-1,true);fit(300);});});
var q=d.getElementById("q"),none=d.createElement("p");none.className="none";none.hidden=true;none.textContent="No matching places.";
var firstBlk=d.querySelector(".blk");if(firstBlk&&firstBlk.parentNode)firstBlk.parentNode.appendChild(none);
q.addEventListener("input",function(){var v=q.value.trim().toLowerCase(),shown=0;cards.forEach(function(c){var ok=!v||c.textContent.toLowerCase().indexOf(v)>=0;c.style.display=ok?"":"none";if(ok)shown++;});
none.hidden=!(v&&!shown);});
var links=[].slice.call(d.querySelectorAll("[data-key]"));var sheet=d.querySelector(".sheet");
function active(){var cur="top",lim=170;links.forEach(function(a){var id=a.getAttribute("data-key"),t=d.getElementById(id);if(t&&t.getBoundingClientRect().top<=lim)cur=id;});
links.forEach(function(a){a.classList.toggle("on",a.getAttribute("data-key")===cur);});}
sheet.addEventListener("scroll",active);window.addEventListener("scroll",function(){active();b.classList.toggle("sc",window.scrollY>window.innerHeight*.46-80);},{passive:true});active();
window.addEventListener("resize",function(){apply();});
apply();fit(0);
})();`;

  const secHtml = secs.map(sec).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(f.name)}${f.headline ? ` · ${esc(f.headline)}` : ""}</title>
<link rel="stylesheet" href="${attr(fontsHref)}">
<style>${css}</style>
</head>
<body>
<a class="skip" href="#top">Skip to the place card</a>
${rail}
<div class="sbmask" aria-hidden="true"></div>
<div class="searchbox" role="search">${icon("search")}<input id="q" type="text" placeholder="${attr(searchPh)}" autocomplete="off" spellcheck="false" aria-label="Search places">${avatar}</div>
${chips}
<div class="mapwrap" id="mapwrap">
<svg id="mapsvg" viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Abstract illustrated map. Drag to pan, scroll or use the buttons to zoom."><g id="vp">${mapArt()}${pinSvg}</g></svg>
${pops}
<div class="ctrls"><button class="ctl" id="me" type="button" aria-label="Show home"${home >= 0 ? ` data-pin="${home}"` : ' data-pin="-1" hidden'}>${icon("me")}</button><div class="zoom"><button class="ctl" id="zin" type="button" aria-label="Zoom in">${icon("add")}</button><button class="ctl" id="zout" type="button" aria-label="Zoom out">${icon("remove")}</button></div></div>
<div class="mapfoot">Illustrative map</div>
</div>
<main class="sheet" id="sheet" aria-label="Place card">
${header}
${secHtml}
</main>
${bnav}
${scriptTag(js)}
</body>
</html>`;
}

const template: ThemeTemplate = { id: "atlas-desk", sections: SECTIONS, defaultAccent: DEFAULT_ACCENT, render };
export default template;
