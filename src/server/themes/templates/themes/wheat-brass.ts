import type { SectionKey } from "../../facts";
import { accentColour, attr, esc, fontOverride, googleFontsHref, photoTag, safeHref, scriptTag, visibleSections } from "../helpers";
import type { RenderInput, ThemeTemplate } from "../types";

// Boardroom: a consulting deck printed on cream stock. Fraunces headings, Manrope body, brass rules.
const SECTIONS: SectionKey[] = ["about", "experience", "projects", "skills", "education", "achievements", "certifications", "testimonials", "extras", "contact"];
const DEFAULT_ACCENT = "#b08a3e";
const BG = "#f3ecdd";
const FG = "#2b2317";
const TITLES: Record<SectionKey, string> = {
  about: "About",
  experience: "Experience",
  projects: "Projects",
  skills: "Skills",
  education: "Education",
  achievements: "Achievements",
  certifications: "Certifications",
  testimonials: "In their words",
  extras: "Also",
  contact: "Contact",
};
const DARK: SectionKey[] = ["projects", "testimonials", "contact"];

const CSS = `
:root{--bg:${BG};--fg:${FG};--brass:var(--accent);--font-display:'Fraunces',Georgia,serif;--font-text:'Manrope',system-ui,sans-serif;--gut:clamp(16px,4vw,56px);
--line:color-mix(in srgb,var(--fg) 16%,transparent);--soft:color-mix(in srgb,var(--fg) 76%,transparent);--brass-ink:color-mix(in srgb,var(--brass) 62%,${FG});--paper:color-mix(in srgb,var(--wheat) 14%,var(--bg));--ease:cubic-bezier(.2,.8,.2,1);
--grain:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .17 0 0 0 0 .14 0 0 0 0 .09 0 0 0 1.1 -.35'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
--linen:repeating-linear-gradient(0deg,rgba(43,35,23,.035) 0 1px,transparent 1px 3px),repeating-linear-gradient(90deg,rgba(43,35,23,.03) 0 1px,transparent 1px 4px)}
*,*:before,*:after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;background:var(--bg);scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--fg);font-family:var(--font-text);font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased;overflow-x:hidden;counter-reset:sec}
img,canvas,svg{display:block;max-width:100%}
a{color:inherit;text-decoration:none}
h1,h2,h3,p,ul,ol,figure,dl,dd{margin:0}
ul,ol{padding:0;list-style:none}
:focus-visible{outline:2px solid var(--brass);outline-offset:3px}
.container{width:min(1280px,100% - var(--gut)*2);margin-inline:auto}
.skip{position:absolute;left:-999px;top:8px;z-index:200;background:var(--fg);color:var(--bg);padding:.6em 1em;border-radius:4px}
.skip:focus{left:8px}
body:after{content:"";position:fixed;inset:-50%;z-index:90;pointer-events:none;background-image:var(--grain);opacity:.12;mix-blend-mode:multiply;animation:grain 1.1s steps(6) infinite}
@keyframes grain{0%{transform:translate(0)}20%{transform:translate(-3%,2%)}40%{transform:translate(2%,-3%)}60%{transform:translate(-2%,-1%)}80%{transform:translate(3%,3%)}to{transform:translate(0)}}
.display,.h2,.statement{font-family:var(--font-display);font-weight:300;font-variation-settings:"SOFT" 60;letter-spacing:-.02em}
.h2{font-size:clamp(2rem,4.4vw,4rem);line-height:1.04}
.statement{font-size:clamp(1.7rem,3.6vw,3.2rem);line-height:1.12;margin:.2em 0 .8em}
.lbl{display:flex;align-items:baseline;gap:.7em;margin:0 0 1.3em;font-family:var(--font-display);font-style:italic;font-weight:400;font-size:1.02rem;color:var(--brass-ink)}
.lbl:before{content:"";flex:none;width:9px;height:9px;transform:translateY(-1px) rotate(45deg);border:1.3px solid currentColor}
.lbl:after{counter-increment:sec;content:counter(sec,decimal-leading-zero);margin-left:auto;font:600 .72rem var(--font-text);font-style:normal;letter-spacing:.2em;opacity:.8}
.dark .lbl{color:var(--wheat)}
.lede{font-size:clamp(1rem,1.12vw,1.12rem);line-height:1.72;color:var(--soft);max-width:60ch}
.dark .lede{color:color-mix(in srgb,var(--bg) 76%,transparent)}
.disc{display:inline-flex;align-items:center;gap:.85em;font-weight:600;font-size:.94rem;padding:.2em 0}
.disc-o{flex:none;display:grid;place-items:center;width:46px;height:46px;border-radius:50%;background:var(--brass);color:#fff;transition:transform .45s var(--ease),background .3s,color .3s}
.disc-o svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.disc span{background:linear-gradient(currentColor,currentColor) 0 100%/0 1px no-repeat;padding-bottom:2px;transition:background-size .45s var(--ease)}
.disc:hover .disc-o,.disc:focus-visible .disc-o{transform:rotate(-45deg)}
.disc:hover span,.disc:focus-visible span{background-size:100% 1px}
.disc.hollow .disc-o{background:transparent;color:currentColor;box-shadow:inset 0 0 0 1px color-mix(in srgb,currentColor 50%,transparent)}
.disc.hollow:hover .disc-o{background:var(--wheat);color:var(--fg);box-shadow:none}
.disc+.disc{margin-left:clamp(14px,2vw,28px)}
.mast{position:fixed;top:0;left:0;right:0;z-index:60;display:flex;align-items:center;justify-content:space-between;gap:24px;padding:16px var(--gut);color:var(--bg);transition:background .4s,color .4s,padding .4s,border-color .4s;border-bottom:1px solid transparent}
.mast.solid{background:color-mix(in srgb,var(--bg) 94%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);color:var(--fg);padding-block:10px;border-color:var(--line)}
.mark{font-family:var(--font-display);font-size:1.25rem;font-weight:400;letter-spacing:-.01em;white-space:nowrap}
.mast ul{display:flex;gap:clamp(14px,2vw,30px);flex-wrap:wrap;justify-content:flex-end}
.mast ul a{font-size:.82rem;font-weight:500;padding:.4em 0;position:relative}
.mast ul a:before{content:"";position:absolute;left:50%;top:-4px;width:5px;height:5px;margin-left:-2.5px;border-radius:50%;background:var(--brass);transform:scale(0);transition:transform .35s var(--ease)}
.mast ul a:hover:before,.mast ul a.on:before{transform:scale(1)}
@media (max-width:860px){.mast ul{display:none}}
.hero{position:relative;min-height:100svh;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden;isolation:isolate;background:var(--fg);color:var(--bg);padding:clamp(96px,14vh,140px) 0 clamp(28px,5vh,48px)}
.hero:before{content:"";position:absolute;inset:0;z-index:-1;background:radial-gradient(70% 60% at 85% 80%,color-mix(in srgb,var(--brass) 28%,transparent),transparent 70%),radial-gradient(60% 50% at 10% 10%,color-mix(in srgb,var(--wheat) 10%,transparent),transparent 70%)}
.name{font-family:var(--font-display);font-size:clamp(3rem,11.5vw,10.5rem);line-height:.92;letter-spacing:-.03em;font-weight:300;color:#f6efdf;margin:0 0 clamp(28px,6vh,64px);overflow-wrap:anywhere}
.name .nw{display:inline-block;overflow:hidden;vertical-align:top;padding:.07em .02em .16em;margin:-.07em .18em -.16em 0}
.name .nw i{display:inline-block;font-style:normal}
.hero-row{display:grid;grid-template-columns:1fr minmax(0,470px);gap:clamp(24px,6vw,80px);align-items:end}
.kicker{font-size:.7rem;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:var(--wheat)}
.hero-line{font-size:clamp(1.5rem,2.6vw,2.4rem);line-height:1.12;margin:.55em 0 1em;color:#f6efdf}
.hero-cta{display:flex;flex-wrap:wrap;gap:12px 0}
.hero .disc{color:#f6efdf}
.hero .disc-o{background:var(--wheat);color:var(--fg)}
.hero .disc.hollow .disc-o{background:transparent;color:#f6efdf}
.hero-proof{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:clamp(14px,2vw,28px);margin-top:clamp(28px,5vh,56px);padding-top:14px;border-top:1px solid color-mix(in srgb,var(--bg) 28%,transparent)}
.hero-proof li{display:grid;gap:3px;align-content:start}
.hero-proof b{font-family:var(--font-display);font-weight:300;font-size:clamp(1.3rem,2vw,1.9rem);line-height:1;color:#f6efdf}
.hero-proof span{font-size:.72rem;line-height:1.35;color:color-mix(in srgb,var(--bg) 80%,transparent)}
.hero-cap{font-family:var(--font-display);font-style:italic;font-size:.85rem;color:color-mix(in srgb,var(--bg) 70%,transparent);margin-top:1.4em}
@media (max-width:860px){.hero-row{grid-template-columns:1fr}}
.sec{position:relative;padding:clamp(56px,7vw,104px) 0}
.sec.dark{background:var(--fg);color:var(--bg)}
.sec.paper{background:var(--paper)}
.sec.linen:before{content:"";position:absolute;inset:0;background:var(--linen);pointer-events:none}
.sec>*{position:relative}
.about-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:clamp(32px,7vw,120px);align-items:start}
.about-grid.solo{grid-template-columns:minmax(0,860px)}
.photo{position:relative;overflow:hidden;border-radius:2px;isolation:isolate;aspect-ratio:4/5;background:color-mix(in srgb,var(--fg) 18%,var(--bg))}
.photo img{width:100%;height:100%;object-fit:cover;filter:saturate(.86) contrast(1.04) sepia(.12)}
.photo:before{content:"";position:absolute;inset:0;z-index:2;background-image:var(--grain);opacity:.2;mix-blend-mode:multiply;pointer-events:none}
.photo:after{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;background:radial-gradient(120% 90% at 50% 40%,transparent 55%,rgba(43,35,23,.26));mix-blend-mode:multiply}
.about-photo{margin-top:clamp(0px,5vw,70px)}
.caption{font-family:var(--font-display);font-style:italic;font-size:.85rem;color:var(--soft);margin-top:.8em}
.table{border-top:1px solid var(--fg)}
.row{display:grid;grid-template-columns:minmax(120px,.7fr) 1.2fr 1.6fr;gap:clamp(12px,3vw,48px);padding:clamp(20px,2.6vw,34px) 0;border-bottom:1px solid var(--line)}
.row .when{font:600 .78rem var(--font-text);letter-spacing:.08em;text-transform:uppercase;color:var(--brass-ink)}
.row h3{font-family:var(--font-display);font-weight:400;font-size:clamp(1.3rem,1.9vw,1.8rem);line-height:1.15;letter-spacing:-.01em}
.row .org{color:var(--soft);font-size:.92rem;margin-top:.3em}
.row p{color:var(--soft);line-height:1.65;font-size:.96rem}
.row ul{display:grid;gap:.6em;margin-top:.6em}
.row li,.bul li{position:relative;padding-left:1.1em;line-height:1.55;font-size:.95rem}
.row li:before,.bul li:before{content:"";position:absolute;left:0;top:.62em;width:5px;height:5px;transform:rotate(45deg);background:var(--brass)}
@media (min-width:861px){.row.nowhen{grid-template-columns:1.2fr 1.6fr}}
@media (max-width:860px){.about-grid{grid-template-columns:1fr}.row{grid-template-columns:1fr;gap:8px}}
.strip{display:flex;gap:clamp(14px,2vw,28px);overflow-x:auto;scroll-snap-type:x proximity;padding:0 var(--gut) 20px;margin-top:clamp(28px,4vw,48px);cursor:grab;scrollbar-width:thin;scrollbar-color:var(--brass) transparent}
.strip.drag{cursor:grabbing;scroll-snap-type:none;user-select:none}
.card{flex:none;width:min(380px,82vw);scroll-snap-align:start;display:flex;flex-direction:column;gap:14px;padding:clamp(22px,2.4vw,32px);border:1px solid color-mix(in srgb,var(--bg) 22%,transparent);background:color-mix(in srgb,var(--bg) 5%,transparent);transition:transform .5s var(--ease),border-color .3s}
.card:hover{transform:translateY(-6px);border-color:var(--wheat)}
.card .sk{font-size:.7rem;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--wheat)}
.card h3{font-family:var(--font-display);font-weight:300;font-size:clamp(1.6rem,2.2vw,2.1rem);line-height:1.1;letter-spacing:-.015em;color:#f6efdf}
.card p{color:color-mix(in srgb,var(--bg) 78%,transparent);font-size:.94rem;line-height:1.6}
.card .bul{display:grid;gap:.5em}
.metrics{display:flex;flex-wrap:wrap;gap:10px 26px;padding-top:12px;border-top:1px solid color-mix(in srgb,var(--bg) 22%,transparent)}
.metrics div{display:grid;gap:2px}
.metrics b{font-family:var(--font-display);font-weight:300;font-size:1.7rem;line-height:1;color:var(--wheat)}
.metrics span{font-size:.72rem;color:color-mix(in srgb,var(--bg) 75%,transparent)}
.tags{display:flex;flex-wrap:wrap;gap:6px}
.tags span{font-size:.72rem;padding:.25em .7em;border:1px solid color-mix(in srgb,currentColor 30%,transparent);border-radius:99px}
.card .disc{margin-top:auto;color:#f6efdf}
.card .disc-o{background:var(--wheat);color:var(--fg);width:38px;height:38px}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:clamp(20px,3vw,48px)}
.col{border-top:1px solid var(--line);padding-top:22px}
.col h3{font-family:var(--font-display);font-weight:300;font-size:clamp(1.4rem,2vw,2rem);letter-spacing:-.015em;margin-bottom:.7em}
.col .meta{font:600 .72rem var(--font-text);letter-spacing:.14em;text-transform:uppercase;color:var(--brass-ink);margin-bottom:.6em}
.col p{color:var(--soft);line-height:1.6;font-size:.95rem}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chips li{font-size:.88rem;padding:.35em .9em;border:1px solid var(--line);border-radius:99px;background:var(--paper)}
.quotes{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:clamp(24px,4vw,64px)}
.quote p{font-family:var(--font-display);font-weight:300;font-size:clamp(1.4rem,2.4vw,2.2rem);line-height:1.2;letter-spacing:-.015em;color:#f6efdf}
.quote p:before{content:"\\201C"}.quote p:after{content:"\\201D"}
.quote cite{display:block;margin-top:1.2em;font-style:normal;font-size:.85rem;color:var(--wheat)}
.contact-grid{display:grid;grid-template-columns:1fr 1fr;gap:clamp(28px,6vw,100px);align-items:end}
.contact-list{display:grid;gap:14px}
.contact-list a{display:flex;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid color-mix(in srgb,var(--bg) 24%,transparent);font-family:var(--font-display);font-size:clamp(1.1rem,1.6vw,1.5rem);overflow-wrap:anywhere;transition:color .3s,padding .4s var(--ease)}
.contact-list a:hover{color:var(--wheat);padding-left:10px}
.contact-list span{font:600 .7rem var(--font-text);letter-spacing:.16em;text-transform:uppercase;opacity:.7;align-self:center;flex:none}
.contact-list p{padding:14px 0;border-bottom:1px solid color-mix(in srgb,var(--bg) 24%,transparent);font-family:var(--font-display);font-size:clamp(1.1rem,1.6vw,1.5rem)}
@media (max-width:860px){.contact-grid{grid-template-columns:1fr}}
.foot{background:var(--fg);color:color-mix(in srgb,var(--bg) 70%,transparent);padding:28px 0 36px;border-top:1px solid color-mix(in srgb,var(--bg) 18%,transparent);font-size:.82rem}
.foot .container{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
.js [data-r]{opacity:0;transform:translateY(26px);transition:opacity 1s var(--ease),transform 1s var(--ease);transition-delay:var(--d,0s)}
.js [data-r].in{opacity:1;transform:none}
.js .name .nw i{transform:translateY(105%);transition:transform 1.1s var(--ease);transition-delay:calc(var(--i)*90ms + .1s)}
.js.go .name .nw i{transform:none}
@media (prefers-reduced-motion:reduce){body:after{animation:none}html{scroll-behavior:auto}.js [data-r],.js .name .nw i{opacity:1;transform:none;transition:none}.card,.disc-o{transition:none}}
`;

const ARROW = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
const disc = (href: string, label: string, cls = "") => `<a class="disc${cls ? ` ${cls}` : ""}" href="${attr(href)}"><span class="disc-o">${ARROW}</span><span>${esc(label)}</span></a>`;

function listOf(items: string[]): string {
  return items.length ? `<ul class="bul">${items.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : "";
}

function render({ facts: f, custom }: RenderInput): string {
  const accent = accentColour(custom, DEFAULT_ACCENT, BG);
  const wheat = custom.accent && accent === custom.accent ? `color-mix(in srgb,${accent} 38%,#fff)` : "#e4cb91";
  const ov = fontOverride(custom);
  const fontCss = ov ? `:root{--font-display:${ov.stack};--font-text:${ov.stack}}` : "";
  const fonts = ov ? [ov.family] : [{ family: "Fraunces", weights: "300;400;500;600" }, { family: "Manrope", weights: "400;500;600;700" }];
  const secs = visibleSections(f, custom, SECTIONS);

  const nameWords = f.name.split(/\s+/).filter(Boolean);
  const nameHtml = nameWords.map((w, i) => `<span class="nw"><i style="--i:${i}">${esc(w)}</i></span>`).join(" ");

  const firstSec = secs[0];
  const stats = f.stats.slice(0, 4).map((s) => `<li><b>${esc(s.value)}</b><span>${esc(s.label)}</span></li>`).join("");
  const mailHref = f.email ? `mailto:${f.email}` : null;
  const hero = `
<header class="hero" id="top">
  <div class="container">
    <h1 class="name" aria-label="${attr(f.name)}">${nameHtml}</h1>
    <div class="hero-row">
      <div class="hero-cap-wrap">${f.location ? `<p class="hero-cap">${esc(f.location)}</p>` : ""}</div>
      <div>
        ${f.headline ? `<p class="kicker" data-r>${esc(f.headline)}</p>` : ""}
        ${f.tagline ? `<p class="hero-line display" data-r style="--d:.1s">${esc(f.tagline)}</p>` : ""}
        <div class="hero-cta" data-r style="--d:.2s">
          ${firstSec ? disc(`#${firstSec}`, TITLES[firstSec] === "About" ? "Read the brief" : `Go to ${TITLES[firstSec].toLowerCase()}`) : ""}
          ${mailHref && secs.includes("contact") ? disc("#contact", "Get in touch", "hollow") : ""}
        </div>
      </div>
    </div>
    ${stats ? `<ul class="hero-proof" data-r aria-label="Highlights">${stats}</ul>` : ""}
  </div>
</header>`;

  const head = (k: SectionKey, title?: string) => `<p class="lbl">${esc(title ?? TITLES[k])}</p>`;

  const build: Record<SectionKey, () => string> = {
    about: () => {
      const photo = photoTag(f, { className: "" });
      return `<div class="about-grid${photo ? "" : " solo"}">
  <div>${head("about")}
    <p class="statement" data-r>${esc(f.summary ?? f.tagline ?? "")}</p>
    <p hidden>${esc(f.summary ?? f.tagline ?? "")}</p>
  </div>
  ${photo ? `<figure class="about-photo" data-r><div class="photo">${photo}</div>${f.location ? `<figcaption class="caption">${esc(f.name)}, ${esc(f.location)}</figcaption>` : ""}</figure>` : ""}
</div>`;
    },
    experience: () => `${head("experience")}
<div class="table">${f.experience
      .map(
        (e, i) => `<article class="row${e.period ? "" : " nowhen"}" data-r style="--d:${(i % 3) * 0.07}s">
  ${e.period ? `<div class="when">${esc(e.period)}</div>` : ""}
  <div><h3>${esc(e.role)}</h3><p class="org">${esc(e.org)}${e.location ? `, ${esc(e.location)}` : ""}</p></div>
  <div>${e.summary ? `<p>${esc(e.summary)}</p>` : ""}${listOf(e.bullets)}</div>
</article>`,
      )
      .join("")}</div>`,
    projects: () => {
      const cards = f.projects
        .map((p) => {
          const href = safeHref(p.link);
          const meta = [p.role, p.period].filter(Boolean).join(" · ");
          return `<article class="card">
  ${meta ? `<span class="sk">${esc(meta)}</span>` : ""}
  <h3>${esc(p.name)}</h3>
  ${p.description ? `<p>${esc(p.description)}</p>` : ""}
  ${listOf(p.bullets)}
  ${p.metrics.length ? `<div class="metrics">${p.metrics.map((m) => `<div><b>${esc(m.value)}</b><span>${esc(m.label)}</span></div>`).join("")}</div>` : ""}
  ${p.tags.length ? `<div class="tags">${p.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
  ${href ? disc(href, "View project") : ""}
</article>`;
        })
        .join("");
      return `<div class="container">${head("projects")}</div><div class="strip" id="strip" tabindex="0" aria-label="Projects, scroll sideways">${cards}</div>`;
    },
    skills: () => `${head("skills")}<div class="cols">${f.skills
      .map((g, i) => `<div class="col" data-r style="--d:${(i % 3) * 0.07}s">${g.group ? `<h3>${esc(g.group)}</h3>` : ""}<ul class="chips">${g.items.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></div>`)
      .join("")}</div>`,
    education: () => `${head("education")}<div class="cols">${f.education
      .map((e, i) => `<div class="col" data-r style="--d:${(i % 3) * 0.07}s">${e.period ? `<p class="meta">${esc(e.period)}</p>` : ""}<h3>${esc(e.school)}</h3>${e.degree ? `<p>${esc(e.degree)}</p>` : ""}${e.detail ? `<p>${esc(e.detail)}</p>` : ""}</div>`)
      .join("")}</div>`,
    achievements: () => `${head("achievements")}<div class="cols">${f.achievements
      .map((a, i) => `<div class="col" data-r style="--d:${(i % 3) * 0.07}s">${a.year ? `<p class="meta">${esc(a.year)}</p>` : ""}<h3>${esc(a.title)}</h3>${a.detail ? `<p>${esc(a.detail)}</p>` : ""}</div>`)
      .join("")}</div>`,
    certifications: () => `${head("certifications")}<div class="cols">${f.certifications
      .map((c, i) => `<div class="col" data-r style="--d:${(i % 3) * 0.07}s">${c.year ? `<p class="meta">${esc(c.year)}</p>` : ""}<h3>${esc(c.name)}</h3>${c.issuer ? `<p>${esc(c.issuer)}</p>` : ""}</div>`)
      .join("")}</div>`,
    testimonials: () => `${head("testimonials")}<div class="quotes">${f.testimonials
      .map((t, i) => `<figure class="quote" data-r style="--d:${(i % 3) * 0.1}s"><blockquote style="margin:0"><p>${esc(t.quote)}</p></blockquote><cite>${esc(t.author)}${t.role ? `, ${esc(t.role)}` : ""}</cite></figure>`)
      .join("")}</div>`,
    extras: () => `${head("extras")}<div class="cols">${f.extras
      .map((x, i) => `<div class="col" data-r style="--d:${(i % 3) * 0.07}s"><h3>${esc(x.label)}</h3><ul class="chips">${x.items.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></div>`)
      .join("")}</div>`,
    contact: () => {
      const rows: string[] = [];
      if (f.email) rows.push(`<a href="${attr(`mailto:${f.email}`)}"><span>Email</span>${esc(f.email)}</a>`);
      if (f.phone) rows.push(`<a href="${attr(`tel:${f.phone.replace(/[^\d+]/g, "")}`)}"><span>Phone</span>${esc(f.phone)}</a>`);
      for (const l of f.links) {
        const h = safeHref(l.url);
        rows.push(h ? `<a href="${attr(h)}"><span>Link</span>${esc(l.label)}</a>` : `<p>${esc(l.label)}</p>`);
      }
      if (f.location) rows.push(`<p>${esc(f.location)}</p>`);
      return `${head("contact")}<div class="contact-grid"><h2 class="h2" data-r>${esc(f.name)}</h2><div class="contact-list" data-r>${rows.join("")}</div></div>`;
    },
  };

  const alt = ["linen", "paper"];
  let light = 0;
  const body = secs
    .map((k) => {
      const dark = DARK.includes(k);
      const cls = dark ? "dark" : alt[light++ % 2] ?? "";
      const inner = k === "projects" ? build[k]() : `<div class="container">${build[k]()}</div>`;
      return `<section class="sec ${cls}" id="${k}" aria-label="${attr(TITLES[k])}">${inner}</section>`;
    })
    .join("\n");

  const nav = secs.map((k) => `<li><a href="#${k}">${esc(TITLES[k])}</a></li>`).join("");
  const js = `(function(){var d=document.documentElement;d.classList.add('js');
requestAnimationFrame(function(){requestAnimationFrame(function(){d.classList.add('go')})});
var m=document.querySelector('.mast');function t(){m.classList.toggle('solid',window.scrollY>window.innerHeight*0.6)}t();window.addEventListener('scroll',t,{passive:true});
var els=document.querySelectorAll('[data-r]');
if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.12});els.forEach(function(e){io.observe(e)})}else{els.forEach(function(e){e.classList.add('in')})}
var links=document.querySelectorAll('.mast ul a');
if('IntersectionObserver' in window&&links.length){var so=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){links.forEach(function(a){a.classList.toggle('on',a.getAttribute('href')==='#'+e.target.id)})}})},{rootMargin:'-45% 0px -50% 0px'});document.querySelectorAll('.sec').forEach(function(s){so.observe(s)})}
var s=document.getElementById('strip');
if(s){var down=false,sx=0,sl=0,moved=false;
s.addEventListener('pointerdown',function(e){if(e.pointerType!=='mouse')return;down=true;moved=false;sx=e.clientX;sl=s.scrollLeft});
window.addEventListener('pointermove',function(e){if(!down)return;var dx=e.clientX-sx;if(Math.abs(dx)>4){moved=true;s.classList.add('drag')}s.scrollLeft=sl-dx});
window.addEventListener('pointerup',function(){down=false;s.classList.remove('drag')});
s.addEventListener('click',function(e){if(moved){e.preventDefault();moved=false}},true);
s.addEventListener('keydown',function(e){if(e.key==='ArrowRight')s.scrollBy({left:300,behavior:'smooth'});if(e.key==='ArrowLeft')s.scrollBy({left:-300,behavior:'smooth'})})}
})();`;

  const footBits = [f.headline, f.location].filter(Boolean).map((x) => esc(x));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(f.name)}${f.headline ? ` · ${esc(f.headline)}` : ""}</title>
${f.tagline || f.summary ? `<meta name="description" content="${attr((f.tagline ?? f.summary ?? "").slice(0, 160))}">` : ""}
<link rel="stylesheet" href="${attr(googleFontsHref(fonts))}">
<style>:root{--accent:${accent};--wheat:${wheat}}${CSS}${fontCss}</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="mast"><a class="mark" href="#top">${esc(f.name)}</a>${nav ? `<nav aria-label="Sections"><ul>${nav}</ul></nav>` : ""}</div>
<main id="main">
${hero}
${body}
</main>
<footer class="foot"><div class="container"><span>${esc(f.name)}</span><span>${footBits.join(" · ")}</span></div></footer>
${scriptTag(js)}
</body>
</html>`;
}

const template: ThemeTemplate = { id: "wheat-brass", sections: SECTIONS, defaultAccent: DEFAULT_ACCENT, render };
export default template;
