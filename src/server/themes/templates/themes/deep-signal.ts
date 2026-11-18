import type { PortfolioFacts, SectionKey } from "../../facts";
import { accentColour, attr, esc, fontOverride, googleFontsHref, photoTag, safeHref, scriptTag, visibleSections } from "../helpers";
import type { RenderInput, ThemeTemplate } from "../types";

// Data Glow: a dark, glowing page whose hero is a field of drifting points that line up into a trend as the visitor scrolls.
// The sample draws the field with three.js; this version uses a plain 2D canvas (same idea: scatter, then fitted line). Decorative only.
// Google Fonts: Cormorant Garamond (display), Inter (body).

const BG = "#03141a";
const DEFAULT_ACCENT = "#3ee3c6";
const SECTIONS: SectionKey[] = ["about", "experience", "projects", "skills", "education", "achievements", "certifications", "testimonials", "extras", "contact"];

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixWhite(hex: string, t: number): string {
  const c = rgb(hex).map((v) => Math.round(v + (255 - v) * t));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}

const NAV_LABEL: Record<SectionKey, string> = {
  about: "About",
  experience: "Experience",
  projects: "Work",
  skills: "Skills",
  education: "Education",
  achievements: "Highlights",
  certifications: "Certifications",
  testimonials: "Kind words",
  extras: "More",
  contact: "Contact",
};

/** Escaped text with its last word set in the accent italic. */
function lastWordEm(text: string): string {
  const t = text.trim();
  const i = t.lastIndexOf(" ");
  return i < 0 ? `<em>${esc(t)}</em>` : `${esc(t.slice(0, i))} <em>${esc(t.slice(i + 1))}</em>`;
}

function head(eyebrow: string, titleHtml: string, id: string): string {
  return `<div class="section-head" data-reveal><p class="eyebrow">${esc(eyebrow)}</p><h2 id="${id}-title" class="section-title">${titleHtml}</h2></div>`;
}

function section(key: SectionKey, inner: string): string {
  return `<section class="section" id="${key}" aria-labelledby="${key}-title"><div class="container">${inner}</div></section>`;
}

function renderAbout(f: PortfolioFacts): string {
  const photo = photoTag(f, { alt: f.name });
  const paras = (f.summary ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const lead = f.tagline && f.summary ? `<p class="lead">${esc(f.tagline)}</p>` : "";
  const body = f.summary ? paras.map((p) => `<p>${esc(p)}</p>`).join("") : `<p class="lead">${esc(f.tagline ?? "")}</p>`;
  const rows: string[] = [];
  if (f.headline) rows.push(`<li><span>Role</span><b>${esc(f.headline)}</b></li>`);
  if (f.location) rows.push(`<li><span>Based in</span><b>${esc(f.location)}</b></li>`);
  const path = rows.length ? `<ul class="path" role="list">${rows.join("")}</ul>` : "";
  const frame = photo ? `<figure class="frame" data-reveal>${photo}</figure>` : "";
  return section(
    "about",
    `<div class="about-row${photo ? "" : " solo"}">${frame}<div class="about-copy" data-reveal><p class="eyebrow">About</p><h2 id="about-title" class="section-title">About <em>me</em></h2>${lead}${body}${path}</div></div>`,
  );
}

function renderExperience(f: PortfolioFacts): string {
  const rows = f.experience
    .map((e, i) => {
      const meta = [e.period, e.location].filter(Boolean).map((m) => `<span>${esc(m)}</span>`).join("");
      const bullets = e.bullets.length ? `<ul class="bul">${e.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : "";
      return `<li class="xp" data-reveal data-reveal-delay="${(Math.min(i, 4) * 0.06).toFixed(2)}"><div class="xp-meta"><p class="micro">${esc(e.org)}</p>${meta}</div><div class="xp-body"><h3>${esc(e.role)}</h3>${e.summary ? `<p>${esc(e.summary)}</p>` : ""}${bullets}</div></li>`;
    })
    .join("");
  return section("experience", `${head("Experience", "Where I have <em>worked</em>", "experience")}<ol class="xps" role="list">${rows}</ol>`);
}

function renderProjects(f: PortfolioFacts): string {
  const kinds = ["slope", "bars", "cluster"];
  const cards = f.projects
    .map((p, i) => {
      const href = safeHref(p.link);
      const top = [p.role, p.period].filter(Boolean).map((m) => `<span class="micro">${esc(m)}</span>`).join("");
      const metrics = p.metrics.length ? `<dl class="metrics">${p.metrics.map((m) => `<div><dt>${esc(m.label)}</dt><dd>${esc(m.value)}</dd></div>`).join("")}</dl>` : "";
      const bullets = p.bullets.length ? `<ul class="bul">${p.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : "";
      const tags = p.tags.length ? `<ul class="chips" role="list">${p.tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "";
      const go = href ? `<div class="card-go"><a class="link-rule" href="${attr(href)}" rel="noopener noreferrer">Open project</a></div>` : "";
      return `<li class="card-wrap" data-reveal data-reveal-delay="${(Math.min(i, 5) * 0.07).toFixed(2)}"><article class="card"><div class="card-top">${top || "<span></span>"}</div><div class="card-art"><canvas data-dots="${kinds[i % 3]}" data-phase="${(i * 2.7).toFixed(1)}" aria-hidden="true"></canvas></div><h3>${esc(p.name)}</h3>${p.description ? `<p>${esc(p.description)}</p>` : ""}${bullets}${metrics}${tags}${go}</article></li>`;
    })
    .join("");
  return section("projects", `${head("Work", "Selected <em>work</em>", "projects")}<ul class="cards" role="list">${cards}</ul>`);
}

function renderSkills(f: PortfolioFacts): string {
  const groups = f.skills
    .map((g) => `<div class="skill-group" data-reveal>${g.group ? `<p class="eyebrow">${esc(g.group)}</p>` : ""}<ul class="tags" role="list">${g.items.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></div>`)
    .join("");
  return section("skills", `${head("Skills", "What I <em>work with</em>", "skills")}<div class="skill-groups">${groups}</div>`);
}

function shelfSection(key: SectionKey, eyebrow: string, titleHtml: string, items: Array<{ title: string; sub?: string | undefined; tag?: string | undefined }>): string {
  const lis = items
    .map((x) => `<li data-reveal><b>${esc(x.title)}</b>${x.sub ? `<span>${esc(x.sub)}</span>` : ""}${x.tag ? `<i>${esc(x.tag)}</i>` : ""}</li>`)
    .join("");
  return section(key, `${head(eyebrow, titleHtml, key)}<ul class="shelf-list" role="list">${lis}</ul>`);
}

function renderTestimonials(f: PortfolioFacts): string {
  const quotes = f.testimonials
    .map((t, i) => {
      const initial = t.author.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
      return `<li data-reveal data-reveal-delay="${(i * 0.1).toFixed(2)}"><figure class="quote"><blockquote><p>“${esc(t.quote)}”</p></blockquote><figcaption><span class="avatar" aria-hidden="true"><canvas data-avatar="${i}"></canvas><b>${esc(initial)}</b></span><span><strong>${esc(t.author)}</strong>${t.role ? `<span class="micro-sm">${esc(t.role)}</span>` : ""}</span></figcaption></figure></li>`;
    })
    .join("");
  return section("testimonials", `${head("Kind words", "What people <em>say</em>", "testimonials")}<ul class="quotes" role="list">${quotes}</ul>`);
}

function renderExtras(f: PortfolioFacts): string {
  const groups = f.extras
    .map((g) => `<div class="skill-group" data-reveal><p class="eyebrow">${esc(g.label)}</p><ul class="tags" role="list">${g.items.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></div>`)
    .join("");
  return section("extras", `${head("More", "<em>More</em> about me", "extras")}<div class="skill-groups">${groups}</div>`);
}

function renderContact(f: PortfolioFacts, photoInBand: boolean): string {
  const lines: string[] = [];
  if (f.email) lines.push(`<li><span>Email</span><a href="mailto:${attr(f.email)}">${esc(f.email)}</a></li>`);
  if (f.phone) lines.push(`<li><span>Phone</span><a href="tel:${attr(f.phone.replace(/[^\d+]/g, ""))}">${esc(f.phone)}</a></li>`);
  for (const l of f.links) {
    const href = safeHref(l.url);
    if (href) lines.push(`<li><span>${esc(l.label)}</span><a href="${attr(href)}" rel="noopener noreferrer">${esc(l.url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, ""))}</a></li>`);
  }
  if (f.location) lines.push(`<li><span>Based in</span><b>${esc(f.location)}</b></li>`);
  const photo = photoInBand ? photoTag(f, { alt: f.name }) : "";
  return `<section class="band-wrap" id="contact" aria-labelledby="contact-title"><div class="container"><div class="band" data-reveal><div class="band-art"><canvas data-dots="ripple" aria-hidden="true"></canvas></div>${photo ? `<figure class="band-photo">${photo}</figure>` : ""}<div class="band-copy"><p class="eyebrow">Contact</p><h2 id="contact-title" class="band-title">Get in <em>touch</em></h2><ul class="lines" role="list">${lines.join("")}</ul></div></div></div></section>`;
}

const CSS = String.raw`
*,*:before,*:after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--font-text);font-weight:400;line-height:1.5;-webkit-font-smoothing:antialiased;overflow-x:hidden}
img,canvas,svg{display:block;max-width:100%}
a{color:inherit;text-decoration:none}
button{font:inherit;color:inherit;cursor:pointer;border:0;background:none;padding:0}
h1,h2,h3,p,dl,dd,figure,blockquote{margin:0}
em{font-style:italic}
.container{width:min(1240px,100% - var(--gutter));margin-inline:auto}
::selection{background:rgba(var(--rgb),.45)}
.skip{position:fixed;left:12px;top:-60px;z-index:100;background:var(--ink);color:var(--bg);padding:.6em 1em;border-radius:4px;font-size:.85rem;transition:top .4s var(--ease)}
.skip:focus{top:12px}
:focus-visible{outline:2px solid var(--aqua-mid);outline-offset:3px;border-radius:3px}
h1,h2,h3{font-family:var(--font-display);font-weight:300;letter-spacing:-.012em}
.eyebrow,.micro{font-weight:500;font-size:.7rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.sub,.section-sub{font-weight:300;font-size:1.05rem;line-height:1.6;color:var(--muted);max-width:32rem}
.kicker{display:inline-flex;align-items:center;gap:.7em;font-size:.76rem;letter-spacing:.05em;color:var(--muted)}
.kicker:before{content:"";width:7px;height:7px;border-radius:50%;background:var(--aqua-mid);box-shadow:0 0 12px var(--glow);transform:scale(var(--cyc,.8))}

.act-row{display:flex;flex-wrap:wrap;gap:.7rem 1.4rem;margin-top:2rem;align-items:center}
.act{position:relative;display:inline-flex;align-items:center;gap:.7em;padding:1em 1.5em;border:1px solid var(--aqua-mid);box-shadow:0 0 22px -8px var(--glow);border-radius:2px;font-size:.88rem;font-weight:500;letter-spacing:.01em;overflow:hidden;isolation:isolate;transition:color .6s var(--ease)}
.act-fill{position:absolute;inset:0;z-index:-1;background:var(--aqua-mid);transform:translateY(calc(100% - 3px));transition:transform .7s var(--ease)}
.act:hover .act-fill,.act:focus-visible .act-fill{transform:translateY(0)}
.act:hover,.act:focus-visible{color:var(--dark)}
.act.quiet{border-color:transparent;box-shadow:none;padding-inline:.2em;color:var(--muted)}
.act.quiet:hover{color:var(--ink)}
.link-rule{display:inline-flex;align-items:center;gap:.7em;font-size:.86rem;font-weight:500;color:var(--ink)}
.link-rule:after{content:"";width:22px;height:1px;background:currentColor;transition:width .7s var(--ease)}
.link-rule:hover:after{width:44px}

header.top{position:fixed;inset:0 0 auto;z-index:60;transition:background .8s var(--ease),box-shadow .8s var(--ease)}
header.top.scrolled{background:rgba(3,20,26,.78);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 1px 0 var(--line)}
.nav-inner{display:flex;align-items:center;justify-content:space-between;height:66px;gap:1rem}
.wordmark{display:inline-flex;align-items:center;gap:.7rem;font-family:var(--font-display);font-size:1.3rem;font-weight:400;letter-spacing:.01em;min-width:0}
.wordmark span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wm-dot{flex:none;width:9px;height:9px;border-radius:50%;background:var(--aqua-mid);box-shadow:0 0 12px var(--glow);transform:scale(var(--cyc,.8))}
.nav-links{display:flex;gap:1.8rem;font-size:.85rem;color:var(--muted)}
.nav-links a{position:relative;padding:.3rem 0;transition:color .6s var(--ease)}
.nav-links a:after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;background:var(--aqua-mid);transform:scaleX(0);transform-origin:left;transition:transform .8s var(--ease)}
.nav-links a:hover{color:var(--ink)}
.nav-links a:hover:after{transform:scaleX(1)}
.nav-right{display:flex;align-items:center;gap:.75rem;flex:none}
.menu-btn{display:none;width:38px;height:38px;border-radius:3px;border:1px solid var(--line);position:relative}
.menu-btn span{position:absolute;left:10px;right:10px;height:1.5px;background:var(--ink);transition:transform .6s var(--ease),top .6s var(--ease)}
.menu-btn span:nth-child(1){top:15px}
.menu-btn span:nth-child(2){top:21px}
.menu-open .menu-btn span:nth-child(1){top:18px;transform:rotate(45deg)}
.menu-open .menu-btn span:nth-child(2){top:18px;transform:rotate(-45deg)}

.coords{position:fixed;z-index:40;top:84px;left:max(calc(var(--gutter)/2),calc((100vw - 1240px)/2));pointer-events:none;transition:opacity .3s}
.coords.gone{opacity:0}
.coords-in{display:grid;grid-template-columns:auto auto;column-gap:14px;row-gap:2px;font-size:.66rem;line-height:1.55;letter-spacing:.1em;font-weight:500}
.coords .k{color:var(--soft)}
.coords .v{color:var(--aqua-mid);font-variant-numeric:tabular-nums;min-width:10ch}

.hero-track{position:relative;height:360svh}
.hero{position:sticky;top:0;height:100svh;min-height:560px;overflow:clip;isolation:isolate;background:radial-gradient(60% 75% at 70% 46%,rgba(var(--rgb),.17),transparent 70%),radial-gradient(40% 50% at 12% 90%,rgba(var(--rgb),.08),transparent 70%),var(--bg)}
.hero:after{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(120% 90% at 50% 40%,transparent 55%,rgba(0,0,0,.55))}
.hero canvas.stage{position:absolute;inset:0;width:100%;height:100%;z-index:-1;touch-action:pan-y}
.hero-grid{position:absolute;inset:0;display:grid;align-content:start;padding-top:clamp(168px,24svh,230px);pointer-events:none}
.hero-grid>*{grid-area:1/1;max-width:39rem;pointer-events:auto}
h1.lead-line{font-size:clamp(1.7rem,2.5vw,2.5rem);line-height:1.12;margin-top:1rem;max-width:32rem;color:var(--ink);text-wrap:balance}
h1.lead-line em,.section-title em,.band-title em,.mega em{color:var(--aqua);text-shadow:0 0 24px var(--glow)}
.beat{visibility:hidden;opacity:0}
.beat-title{font-size:clamp(2.2rem,4.2vw,3.8rem);line-height:1.02;margin-top:1.1rem;text-wrap:balance}
.beat .sub{margin-top:1.2rem}
.beat-name{max-width:30rem}
.stat-row{display:flex;flex-wrap:wrap;gap:1.4rem 3rem;margin-top:1.4rem}
.stat-row .num{font-family:var(--font-display);font-weight:300;font-size:clamp(3rem,6vw,5.4rem);line-height:.95;color:var(--aqua);text-shadow:0 0 40px var(--glow);font-variant-numeric:lining-nums tabular-nums}
.stat-row .lbl{font-size:.82rem;color:var(--muted);font-weight:300;margin-top:.4rem;max-width:14rem}
.mega{position:absolute;left:0;right:0;bottom:78px;z-index:2;pointer-events:none}
.mega span{display:block;font-family:var(--font-display);font-weight:300;font-size:var(--mega);line-height:.8;letter-spacing:-.035em;white-space:nowrap;color:var(--ink);text-shadow:0 2px 40px rgba(0,0,0,.5)}
.hero-foot{position:absolute;left:0;right:0;bottom:26px;display:grid;grid-template-columns:1fr auto 1fr;align-items:end;gap:1rem;pointer-events:none}
.hero-foot .micro{text-transform:none;letter-spacing:.04em;font-weight:400;font-size:.78rem}
.hero-foot .right-wrap{justify-self:end}
.guide{position:relative;display:flex;gap:1.6rem;font-size:.68rem;letter-spacing:.16em;text-transform:uppercase;font-weight:500;color:var(--soft);padding-bottom:14px}
.guide span{transition:color 1.2s var(--ease)}
.guide span.on{color:var(--aqua)}
.guide .bar{position:absolute;left:0;right:0;bottom:0;height:1px;background:var(--line)}
.guide .bar b{position:absolute;inset:0;background:var(--aqua-mid);box-shadow:0 0 10px var(--glow);transform:scaleX(0);transform-origin:left}

.section{position:relative;padding:clamp(80px,12vw,160px) 0 0;scroll-margin-top:60px}
.section-head{max-width:46rem;margin-bottom:clamp(36px,5vw,60px)}
.section-title{font-size:clamp(2.4rem,5vw,4.3rem);line-height:1.03;margin:1rem 0 0;text-wrap:balance}

.about-row{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:clamp(28px,5vw,72px);align-items:center}
.about-row.solo{grid-template-columns:minmax(0,46rem)}
.frame{position:relative;border-radius:22px;overflow:hidden;background:var(--bg2);aspect-ratio:4/5;box-shadow:0 30px 90px -30px rgba(var(--rgb),.35)}
.frame img{width:100%;height:100%;object-fit:cover;filter:saturate(.78) contrast(1.02)}
.frame:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 55%,rgba(3,20,26,.55));pointer-events:none}
.frame:before{content:"";position:absolute;left:0;right:0;height:2px;z-index:2;background:var(--aqua-mid);box-shadow:0 0 18px 4px var(--glow);top:0;animation:scanv 5s linear infinite;pointer-events:none}
@keyframes scanv{0%{top:0}100%{top:100%}}
.about-copy p{font-weight:300;font-size:1.05rem;line-height:1.7;color:var(--muted)}
.about-copy p+p{margin-top:1rem}
.about-copy p.eyebrow{font-size:.7rem;line-height:1.5}
.about-copy .section-title{margin-bottom:1.4rem}
.about-copy .lead{font-family:var(--font-display);font-size:clamp(1.6rem,2.4vw,2.1rem);line-height:1.25;color:var(--ink);font-weight:300;margin-bottom:1.2rem}
.path{list-style:none;margin:1.8rem 0 0;padding:0;display:grid;border-top:1px solid var(--line)}
.path li{display:grid;grid-template-columns:6.2rem minmax(0,1fr);gap:1rem;padding:.65rem 0;border-bottom:1px solid var(--line);font-size:.88rem}
.path li span{color:var(--soft)}
.path li b{font-weight:500}

.xps{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
.xp{display:grid;grid-template-columns:minmax(0,.7fr) minmax(0,1.3fr);gap:1rem 4rem;padding:30px 0;border-bottom:1px solid var(--line)}
.xp-meta{display:flex;flex-direction:column;gap:.35rem}
.xp-meta .micro{color:var(--aqua)}
.xp-meta span:not(.micro){font-size:.85rem;color:var(--soft)}
.xp-body h3{font-size:clamp(1.7rem,2.6vw,2.3rem);line-height:1.1}
.xp-body p{margin-top:.8rem;font-weight:300;color:var(--muted);line-height:1.65;max-width:40rem}
.bul{list-style:none;margin:1rem 0 0;padding:0;display:grid;gap:.5rem;max-width:42rem}
.bul li{position:relative;padding-left:1.3rem;font-size:.92rem;line-height:1.55;font-weight:300;color:var(--muted)}
.bul li:before{content:"";position:absolute;left:0;top:.62em;width:6px;height:6px;border-radius:50%;background:var(--aqua-mid);box-shadow:0 0 8px var(--glow)}

.cards{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:16px}
.cards.few{grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),460px))}
.card-wrap{display:flex}
.card{width:100%;display:flex;flex-direction:column;border:1px solid var(--line);border-radius:22px;padding:18px 18px 24px;background:var(--bg2);transition:border-color .9s var(--ease),background .9s var(--ease)}
.card:hover{border-color:var(--aqua-mid);background:var(--bg3)}
.card-top{display:flex;justify-content:space-between;gap:.6rem;margin-bottom:14px}
.card-art{aspect-ratio:16/9;border-radius:14px;background:#021015;overflow:hidden;position:relative}
.card-art:after{content:"";position:absolute;inset:0;background:linear-gradient(160deg,rgba(var(--rgb),.18),transparent 70%);pointer-events:none}
.card-art canvas{width:100%;height:100%}
.card h3{font-size:1.8rem;line-height:1.08;margin:20px 0 10px}
.card p{font-size:.92rem;line-height:1.6;color:var(--muted);font-weight:300}
.card .bul{margin-top:.9rem}
.metrics{display:flex;flex-wrap:wrap;gap:.8rem 2rem;margin-top:1.2rem;padding-top:1rem;border-top:1px solid var(--line)}
.metrics dd{font-family:var(--font-display);font-weight:300;font-size:2.3rem;line-height:1;color:var(--aqua);text-shadow:0 0 30px var(--glow);order:1;font-variant-numeric:lining-nums tabular-nums}
.metrics dt{font-size:.78rem;color:var(--muted);font-weight:300;order:2;margin-top:.3rem}
.metrics div{display:flex;flex-direction:column}
.chips{list-style:none;margin:1rem 0 0;padding:0;display:flex;flex-wrap:wrap;gap:6px}
.chips li{border:1px solid var(--line);border-radius:3px;padding:.3em .7em;font-size:.76rem;color:var(--muted);font-weight:300}
.card .card-go{margin-top:auto;padding-top:20px}

.skill-groups{display:grid;gap:2rem}
.skill-group .eyebrow{margin-bottom:.8rem}
.tags{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px}
.tags li{border:1px solid var(--line);border-radius:3px;padding:.5em 1em;font-size:.88rem;color:var(--muted);font-weight:300;transition:color .6s var(--ease),border-color .6s var(--ease),background .6s var(--ease)}
.tags li:hover{color:var(--ink);border-color:var(--aqua-mid);background:rgba(var(--rgb),.12)}

.shelf-list{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
.shelf-list li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.3rem 1.5rem;padding:18px 0;border-bottom:1px solid var(--line)}
.shelf-list b{font-family:var(--font-display);font-weight:400;font-size:1.6rem;line-height:1.2}
.shelf-list span{font-size:.9rem;color:var(--muted);font-weight:300;grid-column:1}
.shelf-list i{font-style:normal;font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--aqua);grid-column:2;grid-row:1;align-self:center}

.quotes{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:clamp(20px,3vw,48px)}
.quote{height:100%;display:flex;flex-direction:column;justify-content:space-between;gap:2.2rem;padding-top:28px;border-top:1px solid var(--aqua-mid)}
.quote p{font-family:var(--font-display);font-style:italic;font-weight:300;font-size:clamp(1.4rem,2vw,1.8rem);line-height:1.24}
.quote figcaption{display:flex;align-items:center;gap:14px;font-size:.9rem}
.quote strong{font-weight:500;display:block}
.micro-sm{display:block;font-size:.78rem;color:var(--muted);margin-top:.15rem}
.avatar{position:relative;width:60px;height:60px;border-radius:50%;flex:none;display:grid;place-items:center;background:radial-gradient(circle,rgba(var(--rgb),.25),var(--bg2));overflow:hidden}
.avatar canvas{position:absolute;inset:0;width:100%;height:100%}
.avatar b{position:relative;font-family:var(--font-display);font-weight:400;font-size:1.3rem;text-shadow:0 0 10px var(--bg)}

.band-wrap{padding:clamp(80px,12vw,160px) 0 clamp(60px,8vw,110px);scroll-margin-top:60px}
.band{position:relative;overflow:hidden;border-radius:34px;background:radial-gradient(70% 90% at 80% 60%,rgba(var(--rgb),.22),transparent 70%),linear-gradient(140deg,var(--bg3),var(--bg));border:1px solid rgba(var(--rgb),.3);box-shadow:0 40px 120px -50px rgba(var(--rgb),.45);padding:clamp(36px,6vw,88px);min-height:420px;display:flex;align-items:center}
.band-art{position:absolute;top:50%;right:-6%;width:min(60%,620px);aspect-ratio:1;transform:translateY(-50%);cursor:crosshair}
.band-art canvas{width:100%;height:100%}
.band-photo{position:absolute;right:clamp(24px,5vw,80px);top:50%;transform:translateY(-50%) rotate(2deg);width:min(24%,260px);aspect-ratio:3/4;border-radius:12px;overflow:hidden;z-index:1;box-shadow:0 30px 70px -20px #000;border:1px solid rgba(var(--rgb),.35)}
.band-photo img{width:100%;height:100%;object-fit:cover}
.band-copy{position:relative;z-index:1;max-width:36rem;width:100%}
.band-title{font-size:clamp(2.6rem,5.4vw,4.8rem);line-height:1;margin:1rem 0 1.3rem;text-wrap:balance}
.lines{list-style:none;margin:1.8rem 0 0;padding:0;display:grid;grid-template-columns:minmax(0,1fr);gap:.2rem;font-size:.92rem}
.lines li{display:flex;justify-content:space-between;gap:1rem;padding:.65rem 0;border-bottom:1px solid rgba(234,248,245,.14)}
.lines li span{color:var(--muted);font-weight:300;flex:none}
.lines a,.lines b{font-weight:500;text-align:right;min-width:0;overflow-wrap:anywhere}
.lines a:hover{color:var(--aqua)}

.footer{border-top:1px solid var(--line);padding:44px 0 40px}
.foot-inner{display:flex;justify-content:space-between;gap:2rem;flex-wrap:wrap;align-items:start}
.foot-line{font-family:var(--font-display);font-style:italic;font-size:1.4rem;font-weight:300;margin-top:1rem;color:var(--muted);max-width:30rem}
.foot-links{display:flex;gap:1.4rem 2rem;flex-wrap:wrap;font-size:.86rem;color:var(--muted)}
.foot-links a:hover{color:var(--ink)}

body:after{content:"";position:fixed;inset:-50%;z-index:90;pointer-events:none;opacity:.1;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");animation:grain 1s steps(6) infinite}
@keyframes grain{0%{transform:translate(0,0)}20%{transform:translate(-4%,3%)}40%{transform:translate(3%,-2%)}60%{transform:translate(-2%,-4%)}80%{transform:translate(4%,2%)}100%{transform:translate(0,0)}}

.cur{position:fixed;left:0;top:0;z-index:95;width:0;height:0;pointer-events:none;opacity:0;transition:opacity .3s}
.cur.on{opacity:1}
.cur i{position:absolute;background:var(--aqua-mid);box-shadow:0 0 10px var(--glow);transition:transform .35s var(--ease)}
.cur i:nth-child(1){left:-15px;top:-1px;width:30px;height:2px}
.cur i:nth-child(2){left:-1px;top:-15px;width:2px;height:30px}
.cur b{position:absolute;left:-3px;top:-3px;width:6px;height:6px;background:#fff;box-shadow:0 0 14px 3px var(--glow)}
.cur.hot i:nth-child(1){transform:scaleX(1.6) rotate(45deg)}
.cur.hot i:nth-child(2){transform:scaleY(1.6) rotate(45deg)}
.ripple{position:fixed;z-index:94;pointer-events:none;border:1.5px solid var(--aqua-mid);border-radius:50%;width:12px;height:12px;margin:-6px 0 0 -6px;box-shadow:0 0 12px var(--glow);animation:rip 1s var(--ease) forwards}
@keyframes rip{to{transform:scale(9);opacity:0}}
@media (pointer:fine){body.has-cur,body.has-cur a,body.has-cur button{cursor:none}}

.js [data-reveal]{opacity:0;transform:translateY(28px);transition:opacity .9s var(--ease),transform .9s var(--ease);transition-delay:var(--d,0s)}
.js [data-reveal].in{opacity:1;transform:none}
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
[data-intro]{animation:rise .9s var(--ease) both;animation-delay:var(--d,0s)}

@media (max-width:1080px){.about-row{grid-template-columns:1fr}.frame{aspect-ratio:4/3;max-width:560px}.xp{grid-template-columns:1fr;gap:.8rem}}
@media (max-width:860px){.band-art{right:-22%;width:90%;opacity:.55}}
@media (max-width:1000px){.nav-links{gap:1.1rem;font-size:.8rem}}
@media (max-width:720px){
  :root{--gutter:32px}
  .menu-btn{display:block}
  .nav-links{position:absolute;top:66px;left:0;right:0;flex-direction:column;gap:0;padding:8px 16px 18px;background:var(--bg);border-bottom:1px solid var(--line);opacity:0;visibility:hidden;transform:translateY(-8px);transition:opacity .6s var(--ease),transform .6s var(--ease),visibility .6s;font-size:1.05rem}
  .nav-links a{padding:.9rem 0;border-bottom:1px solid var(--line)}
  .menu-open .nav-links{opacity:1;visibility:visible;transform:none}
  header.top.menu-open{background:var(--bg)}
  .wordmark{font-size:1.15rem}
  .hero-grid{padding-top:112px}
  h1.lead-line{font-size:1.45rem}
  .hero .sub{display:none}
  .beat-title{font-size:2.2rem}
  .act-row{margin-top:1.3rem;gap:.5rem 1rem}
  .hero-foot{grid-template-columns:1fr auto;bottom:16px}
  .hero-foot .guide{display:none}
  .hero-foot .micro{font-size:.7rem}
  .coords{top:76px;left:auto;right:12px}
  .coords-in{font-size:.56rem}
  .coords .v{min-width:0}
  .mega{bottom:52px}
  .mega span{font-size:var(--mega-m);line-height:.84;white-space:normal}
  .stat-row{gap:1rem 2rem}
  .band{border-radius:24px;min-height:0;padding:34px 20px 200px;align-items:start}
  .band.has-photo{padding-bottom:34px}
  .band-art{top:auto;bottom:-50px;right:-10%;width:100%;transform:none;opacity:.7}
  .band-photo{position:relative;right:auto;top:auto;transform:rotate(2deg);width:56%;margin-bottom:28px}
  .lines li{flex-wrap:wrap}
}
@media (prefers-reduced-motion:reduce){
  *,*:before,*:after{animation-duration:.001ms!important;transition-duration:.001ms!important;scroll-behavior:auto!important}
  .frame:before{display:none}
  body:after{animation:none}
}

/* static hero: reduced motion, or no JavaScript */
.static-hero .hero-track{height:auto}
.static-hero .hero{position:relative;height:auto;min-height:100svh;padding-bottom:140px}
.static-hero .hero-grid{position:relative;display:block;padding-bottom:20px}
.static-hero .hero-grid>*{max-width:42rem}
.static-hero .beat{visibility:visible;opacity:1;margin-top:3rem;padding-top:1.6rem;border-top:1px solid var(--line)}
.static-hero .mega{position:relative;bottom:auto;margin-top:2.5rem}
.static-hero .hero canvas.stage{opacity:.7}
.static-hero .coords{display:none}
.static-hero [data-reveal]{opacity:1!important;transform:none!important}
.static-hero .hero-foot{position:relative;bottom:auto;margin-top:2rem}
`;

const JS = String.raw`
(function(){
var root=document.documentElement;
var reduced=root.classList.contains("static-hero");
function ss(x){x=Math.min(1,Math.max(0,x));return x*x*(3-2*x)}
function $(s,c){return (c||document).querySelector(s)}
function $$(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s))}
var cs=getComputedStyle(root);
var RGB=cs.getPropertyValue("--rgb").trim().split(",").map(Number);
var HI=cs.getPropertyValue("--aqua").trim();
var MID=cs.getPropertyValue("--aqua-mid").trim();
function rnd(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;var t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function rgba(a){return "rgba("+RGB[0]+","+RGB[1]+","+RGB[2]+","+a+")"}

/* header */
var header=$("header.top");
function onScroll(){header.classList.toggle("scrolled",window.scrollY>40)}
window.addEventListener("scroll",onScroll,{passive:true});onScroll();
var menu=$(".menu-btn");
if(menu){
  var setMenu=function(o){header.classList.toggle("menu-open",o);menu.setAttribute("aria-expanded",String(o))};
  menu.addEventListener("click",function(){setMenu(!header.classList.contains("menu-open"))});
  $$(".nav-links a").forEach(function(a){a.addEventListener("click",function(){setMenu(false)})});
  document.addEventListener("keydown",function(e){if(e.key==="Escape")setMenu(false)});
}

/* reveal on entry */
if(!reduced&&"IntersectionObserver" in window){
  $$("[data-reveal]").forEach(function(el){var d=el.getAttribute("data-reveal-delay");if(d)el.style.setProperty("--d",d+"s")});
  var io=new IntersectionObserver(function(list){list.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}})},{threshold:.1,rootMargin:"0px 0px -5% 0px"});
  $$("[data-reveal]").forEach(function(el){io.observe(el)});
}else{$$("[data-reveal]").forEach(function(el){el.classList.add("in")})}

/* custom cursor */
if(!reduced&&window.matchMedia("(pointer:fine)").matches){
  var cur=$(".cur");
  if(cur){
    document.body.classList.add("has-cur");
    window.addEventListener("pointermove",function(e){cur.style.transform="translate3d("+e.clientX+"px,"+e.clientY+"px,0)";cur.classList.add("on");cur.classList.toggle("hot",!!(e.target.closest&&e.target.closest("a,button")))},{passive:true});
    document.addEventListener("pointerleave",function(){cur.classList.remove("on")});
    window.addEventListener("pointerdown",function(e){var r=document.createElement("span");r.className="ripple";r.style.left=e.clientX+"px";r.style.top=e.clientY+"px";document.body.appendChild(r);setTimeout(function(){r.remove()},1000)});
  }
}

/* hero: a field of points that settles into a trend as the page scrolls */
var track=$(".hero-track"),hero=$(".hero"),cv=$("canvas.stage");
var state={p:0};
function readP(){
  if(!track)return 0;
  var r=track.getBoundingClientRect(),span=r.height-window.innerHeight;
  return span>0?Math.min(1,Math.max(0,-r.top/span)):0;
}
var drive=null;
(function(){
  if(!hero)return;
  var copy=$("[data-hero-copy]"),mega=$("[data-mega]"),beats=$$("[data-beat]"),right=$("[data-foot-right]"),guide=$("[data-guide]");
  var phases=guide?$$("[data-phase]",guide):[],bar=guide&&$("[data-bar]",guide),shape=$("#c-shape"),coords=$("#coords");
  var dotsCyc=$$(".wm-dot,.kicker");
  var statBeat=$('[data-beat="stats"]'),nameBeat=$('[data-beat="name"]');
  function put(el,o,y){if(!el)return;el.style.opacity=o.toFixed(3);el.style.transform="translate3d(0,"+y.toFixed(1)+"px,0)";el.style.visibility=o<.02?"hidden":"visible"}
  var lastPh=-1,t0=0;
  drive=function(p,t){
    var g=p*3;
    var a=1-ss((g-.08)/.4);put(copy,a,-(1-a)*22);
    var m=1-ss((g-.15)/.45);put(mega,m,(1-m)*60);
    var nameIn=statBeat?2.1:1.0;
    if(statBeat){var i=ss((g-.55)/.35),o=ss((g-1.5)/.35);put(statBeat,i*(1-o),o>0?-o*22:(1-i)*22)}
    if(nameBeat){var ni=ss((g-nameIn)/.35);put(nameBeat,ni,(1-ni)*22)}
    if(right)right.style.opacity=(1-ss((g-.05)/.25)).toFixed(3);
    var ph=p<.28?0:p<.7?1:2;
    if(ph!==lastPh){lastPh=ph;phases.forEach(function(e,k){e.classList.toggle("on",k===ph)});if(shape)shape.textContent=["SCATTER","FITTING","SETTLED"][ph]}
    if(bar)bar.style.transform="scaleX("+p.toFixed(3)+")";
    var sc=(.7+.5*(.5+.5*Math.sin(t*1.1))).toFixed(3);
    dotsCyc.forEach(function(e){e.style.setProperty("--cyc",sc)});
    if(coords){var track2=track.getBoundingClientRect();coords.classList.toggle("gone",track2.bottom<window.innerHeight*.6)}
  };
})();

var onTick=null;
(function(){
  if(!cv||!cv.getContext)return;
  var ctx=cv.getContext("2d"),W=0,H=0,dpr=1,pts=[],N=0,reg={};
  var mouse={x:-1e4,y:-1e4,t:0};
  var R=rnd(7);
  function layout(){
    if(W>720){reg={x0:W*.47,x1:W*.95,yT:H*.2,yB:H*.76}}
    else{reg={x0:W*.07,x1:W*.93,yT:H*.5,yB:H*.8}}
  }
  function size(){
    var r=cv.getBoundingClientRect();dpr=Math.min(2,window.devicePixelRatio||1);
    W=r.width;H=r.height;cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);layout();
    var n=W>720?1500:700;
    if(n!==N){N=n;pts=[];R=rnd(7);for(var i=0;i<N;i++){var u=R();pts.push({u:u,r:(R()+R()+R()-1.5),sx:R(),sy:R(),s:.8+R()*1.7,ph:R()*6.28,f:.25+R()*.6,hi:R()>.72})}}
  }
  var portrait=null,ar=.75;
  function loadPortrait(){
    var src=cv.getAttribute("data-photo");if(!src)return;
    var im=new Image();
    im.onload=function(){
      try{
        var iw=im.naturalWidth||1,ih=im.naturalHeight||1,cw=72,ch=Math.max(8,Math.round(cw*ih/iw));
        if(ch>110){ch=110;cw=Math.max(8,Math.round(ch*iw/ih))}
        var o=document.createElement("canvas");o.width=cw;o.height=ch;var c=o.getContext("2d");c.drawImage(im,0,0,cw,ch);
        var d=c.getImageData(0,0,cw,ch).data,list=[],Rn=rnd(11);
        for(var y=0;y<ch;y++)for(var x=0;x<cw;x++){var k=(y*cw+x)*4,l=(d[k]*.3+d[k+1]*.59+d[k+2]*.11)/255;if(d[k+3]>20&&Rn()<.15+.85*l*l)list.push([x/cw,y/ch])}
        if(list.length>40){ar=cw/ch;portrait=list}
      }catch(e){portrait=null}
    };
    im.src=src;
  }
  function portraitRect(){
    var hh=W>720?H*.78:H*.46,ww=hh*ar,maxw=W>720?W*.42:W*.86;
    if(ww>maxw){ww=maxw;hh=ww/ar}
    return W>720?{x:W*.5+(W*.45-ww)/2,y:H*.1+(H*.8-hh)/2,w:ww,h:hh}:{x:(W-ww)/2,y:H*.4+(H*.52-hh)/2,w:ww,h:hh};
  }
  size();loadPortrait();
  window.addEventListener("resize",size);
  hero.addEventListener("pointermove",function(e){var r=cv.getBoundingClientRect();mouse.x=e.clientX-r.left;mouse.y=e.clientY-r.top},{passive:true});
  hero.addEventListener("pointerleave",function(){mouse.x=-1e4;mouse.y=-1e4});
  function frame(p,t,dt){
    ctx.clearRect(0,0,W,H);
    var intro=reduced?1:ss(t/2.4);
    var fit=ss((p-.04)/.66);
    var spread=(reg.yB-reg.yT)*(.34-.3*fit);
    var breath=.55+.45*Math.sin(t*.7);
    var amp=(3+13*(1-fit))*(reduced?0:1)*(.7+.3*breath);
    var pw=portrait?1-ss((p-.02)/.16):0,pr=pw>.001?portraitRect():null;
    ctx.globalCompositeOperation="lighter";
    for(var i=0;i<N;i++){
      var q=pts[i];
      var tx=reg.x0+q.u*(reg.x1-reg.x0),ty=reg.yB-(reg.yB-reg.yT)*q.u+q.r*spread;
      tx+=Math.sin(t*q.f+q.ph)*amp;ty+=Math.cos(t*q.f*1.3+q.ph)*amp;
      if(pw>.001){var pi=portrait[(i*7)%portrait.length];var jx=Math.sin(t*q.f+q.ph)*1.5;tx=tx+(pr.x+pi[0]*pr.w+jx-tx)*pw;ty=ty+(pr.y+pi[1]*pr.h+jx-ty)*pw}
      var x=q.sx*W+(tx-q.sx*W)*intro,y=q.sy*H+(ty-q.sy*H)*intro;
      var dx=x-mouse.x,dy=y-mouse.y,d2=dx*dx+dy*dy;
      if(d2<12100){var d=Math.sqrt(d2)||1,k=(1-d/110)*38;x+=dx/d*k;y+=dy/d*k}
      ctx.fillStyle=q.hi?HI:MID;
      ctx.globalAlpha=(.35+.5*(q.s/2.5))*(.55+.45*intro);
      ctx.beginPath();ctx.arc(x,y,q.s*(1+.3*fit)*(1-.4*pw),0,6.2832);ctx.fill();
    }
    ctx.globalAlpha=1;
    var la=ss((p-.3)/.4)*intro;
    if(la>.01){
      ctx.globalCompositeOperation="source-over";
      ctx.strokeStyle=MID;ctx.lineWidth=1.6;ctx.globalAlpha=la*.85;ctx.shadowColor=rgba(.9);ctx.shadowBlur=14;
      ctx.beginPath();ctx.moveTo(reg.x0,reg.yB);ctx.lineTo(reg.x0+(reg.x1-reg.x0)*la,reg.yB-(reg.yB-reg.yT)*la);ctx.stroke();
      ctx.shadowBlur=0;ctx.globalAlpha=1;
    }
  }
  if(reduced){frame(.7,0,0);window.addEventListener("resize",function(){frame(.7,0,0)});return}
  var visible=true,last=0;
  if("IntersectionObserver" in window)new IntersectionObserver(function(e){visible=e[0].isIntersecting}).observe(hero);
  function loop(ms){
    var t=ms/1000,dt=Math.min(.05,t-last);last=t;
    if(visible){var p=readP();state.p+=(p-state.p)*.12;if(Math.abs(p-state.p)<.0005)state.p=p;frame(state.p,t,dt);if(drive)drive(state.p,t)}
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();

/* small decorative drawings: cards, avatars, contact ripple (decoration only, no data) */
var cvs=$$("canvas[data-dots]"),avs=$$("canvas[data-avatar]");
function setup(c){
  var r=c.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);
  c.width=Math.max(1,Math.round(r.width*dpr));c.height=Math.max(1,Math.round(r.height*dpr));
  var x=c.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);
  return {c:c,x:x,w:r.width,h:r.height,on:false,ph:parseFloat(c.getAttribute("data-phase")||"0"),kind:c.getAttribute("data-dots")||"avatar",mx:-1,my:-1,seed:parseFloat(c.getAttribute("data-phase")||c.getAttribute("data-avatar")||"1")};
}
var items=cvs.concat(avs).map(setup);
items.forEach(function(it){
  var r=rnd(Math.round(it.seed*10)+3);it.pts=[];
  var n=it.kind==="avatar"?34:it.kind==="bars"?14:it.kind==="ripple"?0:80;
  for(var i=0;i<n;i++)it.pts.push({a:r(),b:r(),c:r(),d:r()});
  if(it.kind==="ripple"){
    var box=it.c.closest(".band");
    box.addEventListener("pointermove",function(e){var b=it.c.getBoundingClientRect();it.mx=(e.clientX-b.left)/b.width;it.my=(e.clientY-b.top)/b.height},{passive:true});
    box.addEventListener("pointerleave",function(){it.mx=-1;it.my=-1});
  }
  if("IntersectionObserver" in window)new IntersectionObserver(function(e){it.on=e[0].isIntersecting}).observe(it.c);else it.on=true;
});
window.addEventListener("resize",function(){items.forEach(function(it){var n=setup(it.c);it.x=n.x;it.w=n.w;it.h=n.h})});
function drawItem(it,t){
  var x=it.x,w=it.w,h=it.h;x.clearRect(0,0,w,h);
  var v=reduced?1:.5-.5*Math.cos(6.2832*(t/9)+it.ph);
  x.fillStyle=MID;x.strokeStyle=MID;
  if(it.kind==="slope"){
    var n=it.pts.length;
    for(var i=0;i<n;i++){var q=it.pts[i],u=.06+q.a*.88,ly=.82-.62*u,y=ly+(q.b-.5)*(.9-.8*v)*.7;x.globalAlpha=.4+.5*q.c;x.beginPath();x.arc(u*w,Math.min(.95,Math.max(.05,y))*h,1.2+q.d*1.4,0,6.2832);x.fill()}
    x.globalAlpha=.8*v;x.lineWidth=1.4;x.beginPath();x.moveTo(.06*w,.82*h-.62*.0*h);x.lineTo(.94*w,(.82-.62*.94)*h+.62*.06*h);x.stroke();
  }else if(it.kind==="bars"){
    var m=it.pts.length,bw=w*.88/m;
    for(var j=0;j<m;j++){var s=it.pts[j],step=.14+.7*(j/(m-1)),rough=.12+s.a*.8,hh=(rough+(step-rough)*v)*h*.82;x.globalAlpha=.35+.45*s.b;x.fillRect(w*.06+j*bw+bw*.15,h*.92-hh,bw*.7,hh)}
  }else if(it.kind==="cluster"){
    var k=it.pts.length;
    for(var z=0;z<k;z++){var o=it.pts[z],ang=o.a*6.2832,rad=(.1+o.b*.42)*(1-.55*v);var cx=.5+Math.cos(ang)*rad*h/w*1.0,cy=.5+Math.sin(ang)*rad;x.globalAlpha=.35+.5*o.c;x.beginPath();x.arc(cx*w,cy*h,1.2+o.d*1.6,0,6.2832);x.fill()}
  }else if(it.kind==="ripple"){
    var g=18,gw=w/(g+1),gh=h/(g+1),cx2=it.mx>=0?it.mx*w:w*.5,cy2=it.my>=0?it.my*h:h*.5;
    for(var a=1;a<=g;a++)for(var b=1;b<=g;b++){
      var px=a*gw,py=b*gh,dd=Math.sqrt((px-cx2)*(px-cx2)+(py-cy2)*(py-cy2)),wave=Math.sin(dd*.045-t*2.2),fall=Math.exp(-dd/(w*.45));
      x.globalAlpha=.18+.7*Math.max(0,wave)*fall;x.beginPath();x.arc(px,py,1+2.2*Math.max(0,wave)*fall,0,6.2832);x.fill();
    }
  }else{
    var cnt=it.pts.length;
    for(var e=0;e<cnt;e++){var r2=it.pts[e],an=r2.a*6.2832,rr=Math.sqrt(r2.b)*.46;x.globalAlpha=.3+.6*r2.c;x.beginPath();x.arc(w*(.5+Math.cos(an+t*.2*(r2.d-.5))*rr),h*(.5+Math.sin(an+t*.2*(r2.d-.5))*rr),1+r2.d*1.3,0,6.2832);x.fill()}
  }
  x.globalAlpha=1;
}
if(items.length){
  if(reduced){items.forEach(function(it){drawItem(it,0)})}
  else{(function loop2(ms){var t=ms/1000;items.forEach(function(it){if(it.on)drawItem(it,t)});requestAnimationFrame(loop2)})(0)}
}
if(reduced&&hero){/* static layout, nothing else to drive */}
})();
`;

function render({ facts, custom }: RenderInput): string {
  const sections = visibleSections(facts, custom, SECTIONS);
  const accent = accentColour(custom, DEFAULT_ACCENT, BG);
  const hi = mixWhite(accent, 0.45);
  const [r, g, b] = rgb(accent);
  const font = fontOverride(custom);
  const fontsHref = font ? googleFontsHref([font.family]) : "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Inter:wght@300;400;500;600&display=swap";
  const display = font ? font.stack : "'Cormorant Garamond', 'Times New Roman', serif";
  const text = font ? font.stack : "'Inter', system-ui, sans-serif";

  const nameLen = Math.max(facts.name.length, 6);
  const longest = Math.max(...facts.name.split(/\s+/).map((w) => w.length), 4);
  const megaVw = Math.min(12.6, 94 / (nameLen * 0.42));
  const megaMobile = Math.min(18.5, 88 / (longest * 0.5));

  const roleOrg = facts.experience[0] ? `${facts.experience[0].role}, ${facts.experience[0].org}` : "";
  const lead = facts.tagline ?? facts.headline ?? roleOrg;
  const kicker = facts.tagline && facts.headline ? facts.headline : "";
  const first = sections.find((s) => s !== "contact");
  const hasContact = sections.includes("contact");
  const navKeys = sections.filter((s) => s !== "contact").slice(0, 6);

  const photoInBand = Boolean(facts.photoUrl) && !sections.includes("about");

  const body: Record<SectionKey, () => string> = {
    about: () => renderAbout(facts),
    experience: () => renderExperience(facts),
    projects: () => renderProjects(facts).replace('class="cards"', facts.projects.length < 3 ? 'class="cards few"' : 'class="cards"'),
    skills: () => renderSkills(facts),
    education: () =>
      shelfSection("education", "Learning", "<em>Education</em>", facts.education.map((e) => ({ title: e.school, sub: [e.degree, e.detail].filter(Boolean).join(" · ") || undefined, tag: e.period }))),
    achievements: () =>
      shelfSection("achievements", "Recognition", "<em>Highlights</em>", facts.achievements.map((a) => ({ title: a.title, sub: a.detail, tag: a.year }))),
    certifications: () =>
      shelfSection("certifications", "Credentials", "<em>Certifications</em>", facts.certifications.map((c) => ({ title: c.name, sub: c.issuer, tag: c.year }))),
    testimonials: () => renderTestimonials(facts),
    extras: () => renderExtras(facts),
    contact: () => renderContact(facts, photoInBand).replace('class="band"', photoInBand ? 'class="band has-photo"' : 'class="band"'),
  };
  const main = sections.map((k) => body[k]()).join("\n");

  const stats = facts.stats.length
    ? `<div class="beat" data-beat="stats"><p class="eyebrow">At a glance</p><div class="stat-row">${facts.stats.map((s) => `<div><p class="num">${esc(s.value)}</p><p class="lbl">${esc(s.label)}</p></div>`).join("")}</div></div>`
    : "";
  const nameBeatBits = [facts.headline, facts.location].filter(Boolean);
  const nameBeat = `<div class="beat beat-name" data-beat="name"><p class="eyebrow">${esc(facts.name)}</p>${nameBeatBits.length ? `<p class="sub">${esc(nameBeatBits.join(" · "))}</p>` : ""}</div>`;

  const ctaTarget = first ?? (hasContact ? "contact" : "");
  const ctaLabel = first === "projects" ? "See my work" : "Read on";
  const cta = ctaTarget
    ? `<div class="act-row" data-intro style="--d:1.3s"><a class="act" href="#${ctaTarget}"><i class="act-fill" aria-hidden="true"></i><span>${ctaLabel}</span></a>${hasContact && ctaTarget !== "contact" ? `<a class="act quiet" href="#contact"><span>Get in touch</span></a>` : ""}</div>`
    : "";

  const nav = navKeys.length ? `<nav class="nav-links" aria-label="Primary" id="primary-nav">${navKeys.map((k) => `<a href="#${k}">${NAV_LABEL[k]}</a>`).join("")}</nav>` : "";
  const footNav = [...navKeys, ...(hasContact ? (["contact"] as SectionKey[]) : [])].map((k) => `<a href="#${k}">${NAV_LABEL[k]}</a>`).join("");
  const footLine = facts.tagline ?? facts.headline ?? "";

  const vars = `:root{--bg:${BG};--bg2:#06222a;--bg3:#0a2f37;--ink:#eaf8f5;--soft:#5d8a86;--muted:#a3c9c3;--dark:${BG};--aqua:${hi};--aqua-mid:${accent};--rgb:${r},${g},${b};--glow:rgba(${r},${g},${b},.55);--line:rgba(${r},${g},${b},.16);--font-display:${display};--font-text:${text};--ease:cubic-bezier(.22,.61,.36,1);--gutter:48px;--mega:${megaVw.toFixed(2)}vw;--mega-m:${megaMobile.toFixed(2)}vw}`;

  const wordmark = `<a class="wordmark" href="#top" aria-label="${attr(facts.name)}, back to the top"><span class="wm-dot" aria-hidden="true"></span><span>${esc(facts.name)}</span></a>`;

  return `<!doctype html>
<html lang="en" class="static-hero">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(facts.name)}${facts.headline ? ` · ${esc(facts.headline)}` : ""}</title>
<meta name="description" content="${attr(facts.tagline ?? facts.summary?.slice(0, 160) ?? facts.headline ?? facts.name)}">
<meta name="theme-color" content="${BG}">
<link rel="stylesheet" href="${attr(fontsHref)}">
<script>(function(){var d=document.documentElement;d.classList.add("js");try{if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches)d.classList.remove("static-hero")}catch(e){}})();</script>
<style>${vars}${CSS}</style>
</head>
<body>
<div class="cur" aria-hidden="true"><i></i><i></i><b></b></div>
<a class="skip" href="#${first ?? (hasContact ? "contact" : "top")}">Skip to content</a>
<header class="top" data-intro>
  <div class="container nav-inner">
    ${wordmark}
    ${nav}
    <div class="nav-right">${hasContact ? `<a class="link-rule" href="#contact">Write to me</a>` : ""}${nav ? `<button class="menu-btn" type="button" aria-expanded="false" aria-controls="primary-nav" aria-label="Menu"><span></span><span></span></button>` : ""}</div>
  </div>
</header>
<aside class="coords" id="coords" aria-hidden="true"><div class="coords-in" data-intro style="--d:1.6s"><span class="k">SHAPE</span><span class="v" id="c-shape">SCATTER</span></div></aside>
<main id="top">
  <div class="hero-track">
    <section class="hero" aria-label="Introduction">
      <canvas class="stage" aria-hidden="true"${facts.photoUrl ? ` data-photo="${attr(facts.photoUrl)}"` : ""}></canvas>
      <div class="container hero-grid">
        <div class="hero-copy" data-hero-copy>
          ${kicker ? `<p class="kicker" data-intro style="--d:.3s">${esc(kicker)}</p>` : ""}
          ${lead ? `<h1 class="lead-line" data-intro style="--d:.45s">${lastWordEm(lead)}</h1>` : `<h1 class="lead-line" data-intro style="--d:.45s">${lastWordEm(facts.name)}</h1>`}
          ${cta}
        </div>
        ${stats}
        ${nameBeat}
      </div>
      <p class="mega" data-mega aria-hidden="true"><span class="container">${lastWordEm(facts.name)}</span></p>
      <div class="container hero-foot">
        <p class="micro" data-intro style="--d:1.6s">${esc(facts.location ?? "")}</p>
        <div class="guide" data-guide data-intro style="--d:1.6s" aria-hidden="true"><span data-phase="0" class="on">Scatter</span><span data-phase="1">Fit</span><span data-phase="2">Settle</span><i class="bar"><b data-bar></b></i></div>
        <div class="right-wrap" data-intro style="--d:1.6s"><p class="micro right" data-foot-right>Scroll, and the points settle</p></div>
      </div>
    </section>
  </div>
${main}
  <footer class="footer">
    <div class="container foot-inner">
      <div>${wordmark.replace(' aria-label="' + attr(facts.name) + ', back to the top"', "")}${footLine ? `<p class="foot-line">${esc(footLine)}</p>` : ""}</div>
      ${footNav ? `<nav class="foot-links" aria-label="Footer">${footNav}</nav>` : ""}
    </div>
  </footer>
</main>
${scriptTag(JS)}
</body>
</html>`;
}

const template: ThemeTemplate = { id: "deep-signal", sections: SECTIONS, defaultAccent: DEFAULT_ACCENT, render };
export default template;
