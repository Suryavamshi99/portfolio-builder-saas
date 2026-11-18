import type { PortfolioFacts, SectionKey } from "../../facts";
import { accentColour, attr, contrast, esc, fontOverride, googleFontsHref, photoTag, safeHref, safeJson, scriptTag, visibleSections } from "../helpers";
import type { RenderInput, ThemeTemplate } from "../types";

const PAPER = "#ebebea";
const INK = "#111111";
const DEFAULT_ACCENT = "#5fb57a";

const TITLES: Record<SectionKey, string> = {
  about: "About",
  experience: "Work history",
  projects: "Selected work",
  skills: "Skills and tools",
  education: "Education",
  achievements: "Wins",
  certifications: "Certifications",
  testimonials: "Kind words",
  extras: "Also",
  contact: "Get in touch",
};

/** The mascot: a friendly geometric robot drawn from shapes (no person, no photo). Eyes follow the pointer; one arm waves, one points. */
function mascot(kind: "hero" | "mini"): string {
  const view = kind === "hero" ? "-70 0 540 470" : "60 20 280 310";
  return `<svg class="mc mc-${kind}" viewBox="${view}" role="img" aria-label="Friendly character">
<g class="mc-bob">
<rect x="172" y="290" width="56" height="60" rx="14" fill="#6fb0d6" stroke="${INK}" stroke-width="5"/>
${
  kind === "hero"
    ? `<g class="mc-armr"><line x1="318" y1="385" x2="392" y2="290" stroke="${INK}" stroke-width="50" stroke-linecap="round"/><line x1="318" y1="385" x2="392" y2="290" stroke="var(--accent)" stroke-width="40" stroke-linecap="round"/><circle cx="398" cy="280" r="27" fill="#fff" stroke="${INK}" stroke-width="5"/><path d="M386 270 L410 270 M386 282 L410 282" stroke="${INK}" stroke-width="3" stroke-linecap="round"/></g>
<g class="mc-arml"><line x1="82" y1="385" x2="14" y2="318" stroke="${INK}" stroke-width="50" stroke-linecap="round"/><line x1="82" y1="385" x2="14" y2="318" stroke="var(--accent)" stroke-width="40" stroke-linecap="round"/><circle cx="6" cy="310" r="27" fill="#fff" stroke="${INK}" stroke-width="5"/><rect x="-34" y="276" width="36" height="16" rx="8" transform="rotate(-38 -16 284)" fill="#fff" stroke="${INK}" stroke-width="5"/></g>`
    : ""
}
<path d="M40 470 C40 365 110 335 200 335 C290 335 360 365 360 470 Z" fill="var(--accent)" stroke="${INK}" stroke-width="5"/>
<path d="M158 338 L200 392 L242 338" fill="#fff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
<circle cx="200" cy="420" r="7" fill="${INK}"/><circle cx="200" cy="450" r="7" fill="${INK}"/>
<line x1="200" y1="96" x2="200" y2="52" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
<circle class="mc-ball" cx="200" cy="40" r="15" fill="var(--accent)" stroke="${INK}" stroke-width="5"/>
<circle cx="78" cy="218" r="28" fill="#7dbbe0" stroke="${INK}" stroke-width="5"/><circle cx="322" cy="218" r="28" fill="#7dbbe0" stroke="${INK}" stroke-width="5"/>
<rect x="78" y="90" width="244" height="236" rx="112" fill="#8fc7e8" stroke="${INK}" stroke-width="5"/>
<ellipse cx="124" cy="258" rx="24" ry="15" fill="#ff9fb0" opacity=".65"/><ellipse cx="276" cy="258" rx="24" ry="15" fill="#ff9fb0" opacity=".65"/>
<path d="M126 148 Q158 130 186 146 M214 146 Q242 130 274 148" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>
<g class="mc-open">
<g class="mc-eye"><ellipse cx="158" cy="196" rx="31" ry="35" fill="#fff" stroke="${INK}" stroke-width="5"/><g class="mc-pupil"><circle cx="158" cy="198" r="15" fill="${INK}"/><circle cx="153" cy="192" r="5" fill="#fff"/></g></g>
<g class="mc-eye"><ellipse cx="242" cy="196" rx="31" ry="35" fill="#fff" stroke="${INK}" stroke-width="5"/><g class="mc-pupil"><circle cx="242" cy="198" r="15" fill="${INK}"/><circle cx="237" cy="192" r="5" fill="#fff"/></g></g>
</g>
<g class="mc-happy"><path d="M128 205 Q158 168 188 205 M212 205 Q242 168 272 205" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/></g>
<circle cx="200" cy="232" r="9" fill="#7dbbe0" stroke="${INK}" stroke-width="4"/>
<path d="M146 258 Q200 330 254 258 Z" fill="#3a1f2b" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
<path d="M156 261 Q200 276 244 261 L240 272 Q200 288 160 272 Z" fill="#fff"/>
<ellipse cx="200" cy="302" rx="22" ry="10" fill="#ff8aa0"/>
</g>
</svg>`;
}

function flower(): string {
  return `<svg class="flower" viewBox="0 0 100 100" aria-hidden="true"><g fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"><path d="M50 50 C30 30 38 6 50 6 C62 6 70 30 50 50Z"/><path d="M50 50 C70 30 94 38 94 50 C94 62 70 70 50 50Z"/><path d="M50 50 C70 70 62 94 50 94 C38 94 30 70 50 50Z"/><path d="M50 50 C30 70 6 62 6 50 C6 38 30 30 50 50Z"/></g><circle cx="50" cy="50" r="7" fill="var(--accent)" stroke="${INK}" stroke-width="3"/></svg>`;
}

function link(url: string | undefined, label: string, cls: string): string {
  const href = safeHref(url);
  return href ? `<a class="${cls}" href="${attr(href)}" target="_blank" rel="noopener noreferrer">${esc(label)} <span class="arr">&#8599;</span></a>` : "";
}

function lines(items: string[]): string {
  return items.length ? `<ul class="bl">${items.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : "";
}

function renderSection(key: SectionKey, f: PortfolioFacts): string {
  switch (key) {
    case "about": {
      const photo = photoTag(f, { alt: f.name, className: "ph" });
      return `<div class="about${photo ? " has-photo" : ""}"><div>${f.tagline ? `<p class="lead">${esc(f.tagline)}</p>` : ""}${f.summary ? `<p class="body">${esc(f.summary)}</p>` : ""}</div>${photo ? `<figure class="frame">${photo}</figure>` : ""}</div>`;
    }
    case "projects":
      return `<div class="grid3">${f.projects
        .map((p) => {
          const meta = [p.role, p.period].filter(Boolean).map((m) => esc(m)).join(" &middot; ");
          const extra = p.bullets.length ? `<details class="more"><summary>More</summary>${lines(p.bullets)}</details>` : "";
          return `<article class="card rv">${meta ? `<p class="meta">${meta}</p>` : ""}<h3>${esc(p.name)}</h3>${p.description ? `<p>${esc(p.description)}</p>` : ""}${
            p.metrics.length ? `<div class="pills">${p.metrics.map((m) => `<span class="ev"><b>${esc(m.value)}</b> ${esc(m.label)}</span>`).join("")}</div>` : ""
          }${p.tags.length ? `<div class="tags">${p.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}${extra}${link(p.link, "Open project", "btn")}</article>`;
        })
        .join("")}</div>`;
    case "experience":
      return `<div class="stack">${f.experience
        .map((e) => {
          const meta = [e.period, e.location].filter(Boolean).map((m) => esc(m)).join(" &middot; ");
          return `<article class="card row rv"><div class="row-h">${meta ? `<p class="meta">${meta}</p>` : ""}<h3>${esc(e.role)}</h3><p class="org">${esc(e.org)}</p></div><div>${e.summary ? `<p>${esc(e.summary)}</p>` : ""}${lines(e.bullets)}</div></article>`;
        })
        .join("")}</div>`;
    case "education":
      return `<div class="grid3">${f.education
        .map((e) => `<article class="card rv">${e.period ? `<p class="meta">${esc(e.period)}</p>` : ""}<h3>${esc(e.school)}</h3>${e.degree ? `<p class="org">${esc(e.degree)}</p>` : ""}${e.detail ? `<p>${esc(e.detail)}</p>` : ""}</article>`)
        .join("")}</div>`;
    case "achievements":
      return `<ol class="wins">${f.achievements
        .map((a) => `<li class="rv"><span class="no"></span><div><h3>${esc(a.title)}${a.year ? ` <span class="yr">${esc(a.year)}</span>` : ""}</h3>${a.detail ? `<p>${esc(a.detail)}</p>` : ""}</div></li>`)
        .join("")}</ol>`;
    case "certifications":
      return `<div class="pills big">${f.certifications.map((c) => `<span class="ev rv">${esc(c.name)}${c.issuer ? ` &middot; ${esc(c.issuer)}` : ""}${c.year ? ` &middot; ${esc(c.year)}` : ""}</span>`).join("")}</div>`;
    case "skills":
      return `<div class="grid3">${f.skills
        .map((g) => `<article class="card rv">${g.group ? `<h3>${esc(g.group)}</h3>` : ""}<div class="tags">${g.items.map((i) => `<span>${esc(i)}</span>`).join("")}</div></article>`)
        .join("")}</div>`;
    case "testimonials":
      return `<div class="grid3">${f.testimonials
        .map((t) => `<blockquote class="card quote rv"><p>&ldquo;${esc(t.quote)}&rdquo;</p><footer><b>${esc(t.author)}</b>${t.role ? `<span>${esc(t.role)}</span>` : ""}</footer></blockquote>`)
        .join("")}</div>`;
    case "extras":
      return `<div class="grid3">${f.extras.map((x) => `<article class="card rv"><h3>${esc(x.label)}</h3><div class="tags">${x.items.map((i) => `<span>${esc(i)}</span>`).join("")}</div></article>`).join("")}</div>`;
    case "contact": {
      const rows: string[] = [];
      if (f.email) rows.push(`<a class="crow" href="mailto:${attr(f.email)}"><span>Email</span><b>${esc(f.email)}</b><i class="arr">&#8599;</i></a>`);
      if (f.phone) rows.push(`<a class="crow" href="tel:${attr(f.phone.replace(/[^\d+]/g, ""))}"><span>Phone</span><b>${esc(f.phone)}</b><i class="arr">&#8599;</i></a>`);
      for (const l of f.links) {
        const href = safeHref(l.url);
        if (href) rows.push(`<a class="crow" href="${attr(href)}" target="_blank" rel="noopener noreferrer"><span>${esc(l.label)}</span><b>${esc(l.url.replace(/^https?:\/\/(www\.)?/, ""))}</b><i class="arr">&#8599;</i></a>`);
      }
      return `<div class="crows">${rows.join("")}</div>`;
    }
  }
}

const CSS = `
:root{--paper:${PAPER};--ink:${INK};--white:#fff;--muted:#4a4a48;--display:'Archivo Black','Arial Black',Arial,sans-serif;--sans:'Inter',system-ui,sans-serif;--dw:400;--spring:cubic-bezier(.3,1.6,.5,1);--gut:clamp(18px,4.6vw,64px)}
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);font-size:17px;line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden}
h1,h2,h3,p,ul,ol,figure,blockquote{margin:0}ul,ol{padding:0;list-style:none}a{color:inherit}
:focus-visible{outline:3px dashed var(--ink);outline-offset:3px;border-radius:6px}
.skip{position:absolute;left:12px;top:-60px;z-index:100;background:var(--ink);color:var(--paper);padding:10px 16px;border-radius:99px;font-weight:800;text-decoration:none}.skip:focus{top:12px}
body{background-image:linear-gradient(rgba(17,17,17,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(17,17,17,.06) 1px,transparent 1px);background-size:64px 64px;background-attachment:fixed}
.idx{display:inline-flex;align-items:center;border:2px solid var(--ink);border-radius:99px;padding:3px 14px 3px 3px;gap:10px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;line-height:1.1;text-decoration:none;white-space:nowrap;background:transparent}
.idx b{background:var(--accent);color:var(--on);border-radius:99px;padding:6px 14px;font-weight:800}
.idx b.dot{width:26px;height:22px;padding:0}
.arr{display:inline-block;transition:transform .35s var(--spring);font-style:normal}
.nav{position:fixed;top:0;left:0;right:0;z-index:50;display:flex;align-items:center;gap:14px;padding:10px var(--gut);background:rgba(235,235,234,.88);backdrop-filter:blur(10px);border-bottom:2px solid var(--ink);transform:translateY(-110%);transition:transform .4s var(--spring)}
.nav.on{transform:none}
.nav ul{display:flex;gap:6px;overflow-x:auto;margin-left:auto;scrollbar-width:none}.nav ul::-webkit-scrollbar{display:none}
.nav ul a{display:block;padding:6px 12px;border-radius:99px;font-size:12px;font-weight:800;text-decoration:none;text-transform:uppercase;white-space:nowrap;border:2px solid transparent}
.nav ul a:hover,.nav ul a.cur{border-color:var(--ink);background:var(--white)}
@media(max-width:700px){.nav .idx span{display:none}}
/* hero */
.hero{position:relative;min-height:min(100svh,920px);padding:clamp(22px,4vw,48px) var(--gut) 0;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);align-items:end;column-gap:2vw;overflow:hidden}
.hero-top{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:12px 28px;align-items:center;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.02em}
.hero-main{align-self:center;padding:3vh 0 24px;position:relative;z-index:2}
h1{font-family:var(--display);font-weight:var(--dw);text-transform:uppercase;font-size:clamp(38px,6.2vw,108px);line-height:.92;letter-spacing:-.035em;overflow-wrap:break-word}
h1 .l2{display:block;font-size:.5em;line-height:1;margin-top:.14em;letter-spacing:-.02em}
.tagpill{display:inline-flex;margin-top:clamp(18px,3vw,34px);max-width:100%;border:2px solid var(--ink);border-radius:99px;background:var(--accent);color:var(--on);font-weight:800;font-size:clamp(14px,1.5vw,20px);line-height:1.3;padding:10px 24px;box-shadow:5px 5px 0 var(--ink)}
.chips{display:flex;flex-wrap:wrap;gap:10px 22px;margin-top:clamp(18px,3vw,34px);font-weight:800;font-size:clamp(14px,1.3vw,17px)}
.next{display:inline-flex;align-items:center;gap:10px;margin-top:22px;font-weight:800;text-decoration:none;border:2px solid var(--ink);border-radius:99px;padding:8px 18px;background:var(--white)}
.next:hover .arr{transform:translateY(4px)}
.stage{position:relative;align-self:end;justify-self:center;width:min(100%,560px);z-index:1}
.mc{display:block;width:100%;height:auto;overflow:visible}
.mc-hero{cursor:pointer}
.mc-happy{display:none}.mc.happy .mc-open{display:none}.mc.happy .mc-happy{display:block}
.mc-pupil{transition:transform .08s linear}
.mc-eye{transform-box:fill-box;transform-origin:center;animation:blink 5.5s infinite}
.mc-armr{transform-box:view-box;transform-origin:318px 385px;animation:wave 1.8s ease-in-out infinite}
.mc-arml{transform-box:view-box;transform-origin:82px 385px;animation:point 2.4s ease-in-out infinite}
.mc-ball{animation:hint 2.4s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.mc-bob{animation:bob 4s ease-in-out infinite}
@keyframes blink{0%,94%,100%{transform:scaleY(1)}97%{transform:scaleY(.1)}}
@keyframes wave{0%,100%{transform:rotate(-12deg)}50%{transform:rotate(16deg)}}
@keyframes point{0%,100%{transform:rotate(0)}50%{transform:rotate(-5deg)}}
@keyframes hint{0%,100%{transform:scale(1)}50%{transform:scale(1.25)}}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes wiggle{0%,100%{transform:rotate(8deg)}50%{transform:rotate(-4deg) translateY(-5px)}}
.bubble{position:absolute;left:2%;top:6%;z-index:3;background:var(--white);border:2px solid var(--ink);border-radius:50%;padding:12px 20px;font-weight:800;font-size:14px;text-decoration:none;box-shadow:4px 4px 0 var(--accent);animation:wiggle 3.2s ease-in-out infinite}
.flower{position:absolute;width:clamp(44px,5vw,76px);right:6%;bottom:54%;animation:spin 14s linear infinite;z-index:2}
@media(max-width:860px){.hero{grid-template-columns:1fr;min-height:0}.stage{width:min(88%,420px);margin-top:6px}.hero-main{padding-bottom:6px}.bubble{left:0;top:2%}}
/* sections */
.sec{padding:clamp(52px,9vw,120px) var(--gut) 0;scroll-margin-top:50px}
.sec-h{display:flex;flex-direction:column;align-items:flex-start;gap:16px;margin-bottom:clamp(22px,4vw,48px)}
h2{font-family:var(--display);font-weight:var(--dw);text-transform:uppercase;font-size:clamp(38px,8vw,120px);line-height:.92;letter-spacing:-.035em;overflow-wrap:anywhere}
h2 sup{font-size:.4em;vertical-align:super}
h3{font-size:clamp(18px,1.6vw,22px);line-height:1.25;font-weight:800}
.card{background:var(--white);border:2px solid var(--ink);border-radius:26px;padding:clamp(18px,2.2vw,30px);display:flex;flex-direction:column;gap:12px;box-shadow:6px 6px 0 var(--ink);transition:transform .35s var(--spring),box-shadow .35s}
.card:hover{transform:translate(-3px,-3px) rotate(-.4deg);box-shadow:9px 9px 0 var(--accent)}
.grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr));gap:clamp(16px,2vw,28px)}
.stack{display:flex;flex-direction:column;gap:clamp(16px,2vw,26px)}
.row{display:grid;grid-template-columns:minmax(0,.7fr) minmax(0,1.3fr);gap:clamp(12px,3vw,40px)}
@media(max-width:760px){.row{grid-template-columns:1fr}}
.meta{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.org{font-weight:600;color:var(--muted)}
.bl{display:flex;flex-direction:column;gap:8px;margin-top:6px}.bl li{padding-left:22px;position:relative}.bl li::before{content:"";position:absolute;left:0;top:.6em;width:10px;height:10px;border-radius:50%;background:var(--accent);border:2px solid var(--ink)}
.ev{display:inline-flex;align-items:center;gap:.5em;font-size:13px;font-weight:700;line-height:1.2;padding:7px 14px;border-radius:99px;border:2px solid var(--ink);background:var(--white)}
.pills{display:flex;flex-wrap:wrap;gap:10px}.pills.big .ev{font-size:15px;padding:10px 18px}
.tags{display:flex;flex-wrap:wrap;gap:8px}.tags span{font-size:13px;font-weight:700;padding:6px 13px;border-radius:99px;border:2px solid var(--ink);background:var(--paper)}
.more summary{cursor:pointer;font-weight:800;font-size:13px;text-transform:uppercase}
.btn{align-self:flex-start;display:inline-flex;gap:8px;text-decoration:none;font-weight:800;background:var(--accent);color:var(--on);border:2px solid var(--ink);border-radius:99px;padding:8px 18px;margin-top:auto}
.btn:hover,.crow:hover{background:var(--ink);color:var(--paper)}.btn:hover .arr,.crow:hover .arr{transform:translate(3px,-3px)}
.about{display:grid;gap:clamp(20px,4vw,56px);align-items:center}
.about.has-photo{grid-template-columns:minmax(0,1.3fr) minmax(0,.7fr)}
@media(max-width:760px){.about.has-photo{grid-template-columns:1fr}}
.lead{font-family:var(--display);font-weight:var(--dw);font-size:clamp(22px,3vw,40px);line-height:1.1;letter-spacing:-.02em;margin-bottom:18px;overflow-wrap:anywhere}
.body{font-size:clamp(17px,1.5vw,20px);max-width:46em}
.frame{border:3px solid var(--ink);border-radius:26px;background:var(--white);padding:10px;box-shadow:8px 8px 0 var(--accent);transform:rotate(2deg);max-width:420px}
.frame img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:16px}
.nums{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:clamp(14px,2vw,24px)}
.num{background:var(--accent);color:var(--on);border:2px solid var(--ink);border-radius:26px;padding:22px;box-shadow:6px 6px 0 var(--ink)}
.num b{display:block;font-family:var(--display);font-weight:var(--dw);font-size:clamp(34px,4.6vw,64px);line-height:1;letter-spacing:-.03em;overflow-wrap:anywhere}
.num span{font-weight:700}
.wins{display:flex;flex-direction:column;border-top:2px solid var(--ink)}
.wins li{display:grid;grid-template-columns:56px 1fr;gap:16px;padding:18px 0;border-bottom:2px solid var(--ink)}
.no{display:grid;place-items:center;width:44px;height:44px;border-radius:50%;background:var(--accent);color:var(--on);border:2px solid var(--ink);font-weight:800}
.yr{font-size:13px;font-weight:700;color:var(--muted);margin-left:6px}
.quote p{font-size:19px;font-weight:600}.quote footer{display:flex;flex-direction:column;margin-top:auto}.quote footer span{color:var(--muted);font-size:14px}
.crows{display:flex;flex-direction:column;border-top:2px solid var(--ink)}
.crow{display:grid;grid-template-columns:minmax(80px,.25fr) 1fr auto;gap:16px;align-items:center;padding:18px 12px;border-bottom:2px solid var(--ink);text-decoration:none;transition:background .25s,color .25s}
.crow span{font-size:12px;font-weight:800;text-transform:uppercase}.crow b{font-size:clamp(17px,2.4vw,30px);overflow-wrap:anywhere}
.foot{padding:clamp(48px,8vw,100px) var(--gut) 40px;font-weight:800;font-size:13px;text-transform:uppercase}
/* margin guide */
.guide{position:fixed;right:clamp(10px,2vw,28px);bottom:clamp(10px,2vw,24px);z-index:40;display:flex;align-items:flex-end;gap:8px;opacity:0;pointer-events:none;transform:translateY(20px);transition:opacity .4s,transform .5s var(--spring)}
.guide.on{opacity:1;pointer-events:auto;transform:none}
.guide .mc{width:clamp(62px,8vw,100px)}
.guide-say{order:-1;display:inline-flex;gap:8px;align-items:center;background:var(--white);border:2px solid var(--ink);border-radius:18px;padding:8px 14px;font-size:13px;font-weight:800;text-decoration:none;margin-bottom:30px;box-shadow:3px 3px 0 var(--accent);position:relative}
.guide-say::after{content:"";position:absolute;right:-9px;bottom:10px;width:14px;height:14px;background:var(--white);border-right:2px solid var(--ink);border-top:2px solid var(--ink);transform:rotate(45deg)}
@media(max-width:600px){.guide-say{display:none}}
/* reveal: content is visible without JS */
.js .rv{opacity:0;transform:translateY(26px);transition:opacity .6s,transform .7s var(--spring)}
.js .rv.in{opacity:1;transform:none}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*::before,*::after{animation:none!important;transition:none!important}.js .rv{opacity:1;transform:none}.mc-pupil{transform:none!important}}
`;

const JS = `
(function(){
var d=document,root=d.documentElement;root.classList.add('js');
var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
var secs=JSON.parse(d.getElementById('secs').textContent);
var els=secs.map(function(s){return d.getElementById(s.id)});
var nav=d.getElementById('nav'),guide=d.getElementById('guide'),say=d.getElementById('say'),hero=d.getElementById('top');
var links=[].slice.call(d.querySelectorAll('#navlinks a'));
function go(id){var e=d.getElementById(id);if(e)e.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'})}
function cur(){var y=innerHeight*.4,i=-1;els.forEach(function(e,k){if(e&&e.getBoundingClientRect().top<y)i=k});return i}
function upd(){
  var h=hero.getBoundingClientRect().bottom<80;nav.classList.toggle('on',h);guide.classList.toggle('on',h);
  var i=cur();links.forEach(function(a,k){a.classList.toggle('cur',k===i)});
  if(i>=0){d.getElementById('navname').textContent=secs[i].title}
  var n=i+1;if(n<secs.length){say.hidden=false;say.querySelector('b').textContent=secs[n].title;say.setAttribute('href','#'+secs[n].id);guide.dataset.t=secs[n].id}else{say.hidden=true;guide.dataset.t='top'}
}
addEventListener('scroll',upd,{passive:true});addEventListener('resize',upd);upd();
guide.addEventListener('click',function(e){e.preventDefault();go(guide.dataset.t||'top')});
// reveal
if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.12});d.querySelectorAll('.rv').forEach(function(e){io.observe(e)})}else{d.querySelectorAll('.rv').forEach(function(e){e.classList.add('in')})}
// eyes follow the pointer
var mcs=[].slice.call(d.querySelectorAll('.mc'));
if(!reduce){var px=0,py=0,raf=0;
addEventListener('pointermove',function(e){px=e.clientX;py=e.clientY;if(!raf)raf=requestAnimationFrame(function(){raf=0;mcs.forEach(function(m){var r=m.getBoundingClientRect();if(!r.width)return;var dx=(px-(r.left+r.width/2))/Math.max(r.width,260),dy=(py-(r.top+r.height*.4))/Math.max(r.height,260);var l=Math.hypot(dx,dy)||1,k=Math.min(1,l*1.4)/l;m.querySelectorAll('.mc-pupil').forEach(function(p){p.style.transform='translate('+(dx*k*13).toFixed(1)+'px,'+(dy*k*13).toFixed(1)+'px)'})})})},{passive:true})}
// click the big character: happy face
var big=d.querySelector('.mc-hero'),t=0;
if(big)big.addEventListener('click',function(){big.classList.add('happy');clearTimeout(t);t=setTimeout(function(){big.classList.remove('happy')},1600)});
})();
`;

function render({ facts, custom }: RenderInput): string {
  const accent = accentColour(custom, DEFAULT_ACCENT, PAPER);
  const on = contrast(accent, INK) >= contrast(accent, "#ffffff") ? INK : "#ffffff";
  const ov = fontOverride(custom);
  const fontsHref = googleFontsHref(ov ? [ov.family] : [{ family: "Archivo Black", weights: "400" }, "Inter"]);
  const fontVars = ov ? `:root{--display:${ov.stack};--sans:${ov.stack};--dw:800}` : "";

  const keys = visibleSections(facts, custom, template.sections);
  const items: Array<{ id: string; title: string; html: string }> = [];
  for (const k of keys) {
    items.push({ id: k, title: TITLES[k], html: renderSection(k, facts) });
  }
  if (facts.stats.length) {
    const block = {
      id: "numbers",
      title: "Numbers",
      html: `<div class="nums">${facts.stats.map((s) => `<div class="num rv"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join("")}</div>`,
    };
    const at = items.findIndex((i) => i.id === "about");
    items.splice(at >= 0 ? at + 1 : 0, 0, block);
  }

  const sectionsHtml = items
    .map(
      (it) => `<section class="sec" id="${it.id}" aria-labelledby="h-${it.id}"><div class="sec-h"><span class="idx"><b class="dot"></b>${esc(it.title)}</span><h2 id="h-${it.id}">${esc(it.title)}<sup>*</sup></h2></div>${it.html}</section>`,
    )
    .join("");

  const first = items[0];
  const chips = [facts.location, ...facts.skills.flatMap((g) => g.items).slice(0, 4)].filter((c): c is string => Boolean(c));
  const secMeta = items.map((i) => ({ id: i.id, title: i.title }));
  const email = facts.email ? `<a class="bubble" href="mailto:${attr(facts.email)}">Say hello &#8599;</a>` : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(facts.name)}${facts.headline ? ` | ${esc(facts.headline)}` : ""}</title>
${facts.tagline || facts.summary ? `<meta name="description" content="${attr((facts.tagline ?? facts.summary ?? "").slice(0, 200))}">` : ""}
<meta name="theme-color" content="${PAPER}">
<link rel="stylesheet" href="${attr(fontsHref)}">
<style>:root{--accent:${accent};--on:${on}}${CSS}${fontVars}</style>
</head>
<body>
<a class="skip" href="#${first ? first.id : "top"}">Skip to content</a>
<nav class="nav" id="nav" aria-label="Sections"><a class="idx" href="#top"><b class="dot"></b><span id="navname">${esc(facts.name)}</span></a><ul id="navlinks">${items.map((i) => `<li><a href="#${i.id}">${esc(i.title)}</a></li>`).join("")}</ul></nav>
<main id="main">
<header class="hero" id="top">
<div class="hero-top"><span class="idx"><b class="dot"></b>${esc(facts.headline ?? facts.name)}</span>${facts.tagline ? `<span>${esc(facts.tagline)}</span>` : ""}</div>
<div class="hero-main">
<h1>${esc(facts.name)}${facts.headline ? `<span class="l2">${esc(facts.headline)}</span>` : ""}</h1>
${chips.length ? `<div class="chips">${chips.map((c) => `<span>${esc(c)}</span>`).join("")}</div>` : ""}
${first ? `<a class="next" href="#${first.id}">${esc(first.title)} <span class="arr">&#8595;</span></a>` : ""}
</div>
<div class="stage">${email}${flower()}${mascot("hero")}</div>
</header>
${sectionsHtml}
</main>
<footer class="foot">${esc(facts.name)}</footer>
<a class="guide" id="guide" href="#top" aria-label="Guide: jump to the next section"><span class="guide-say" id="say" hidden>Next <b></b></span>${mascot("mini")}</a>
<script type="application/json" id="secs">${safeJson(secMeta)}</script>
${scriptTag(JS)}
</body>
</html>`;
}

const template: ThemeTemplate = {
  id: "mascot-guide",
  sections: ["about", "projects", "experience", "education", "achievements", "certifications", "skills", "testimonials", "extras", "contact"],
  defaultAccent: DEFAULT_ACCENT,
  render,
};

export default template;
