import type { PortfolioFacts, SectionKey } from "../../facts";
import { accentColour, attr, esc, fontOverride, initials, photoTag, safeHref, safeJson, scriptTag, visibleSections } from "../helpers";
import type { RenderInput, ThemeTemplate } from "../types";

// Sprint Wall: warm paper, near-black ink, one strong blue, marker-yellow highlight.
// Fonts: Syne (display), Inter (text), IBM Plex Mono (labels), Newsreader italic (accents).
const PAPER = "#f4f1ea";
const DEFAULT_ACCENT = "#2f5cf0";

const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Syne:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&family=Newsreader:ital,wght@0,400;0,500;1,300;1,400&display=swap";

const SECTIONS: SectionKey[] = ["about", "projects", "experience", "skills", "education", "achievements", "certifications", "testimonials", "extras", "contact"];

const NAV_LABEL: Record<SectionKey, string> = {
  about: "About",
  projects: "Work",
  experience: "Experience",
  skills: "Skills",
  education: "Education",
  achievements: "Wins",
  certifications: "Certs",
  testimonials: "Kind words",
  extras: "Beyond",
  contact: "Contact",
};

const CSS = `
:root{--paper:${PAPER};--paper-2:#ebe6da;--ink:#15171c;--ink-2:#1f222a;--hl:#ffe14d;--muted:#5f6372;--muted-d:#9a9eab;
--line:rgba(21,23,28,.14);--line-d:rgba(244,241,234,.16);
--blue-d:color-mix(in srgb,var(--blue) 55%,#ffffff);
--f-display:'Syne','Inter',system-ui,sans-serif;--f-text:'Inter',system-ui,sans-serif;--f-mono:'IBM Plex Mono',ui-monospace,Menlo,monospace;--f-serif:'Newsreader',Georgia,serif;
--gut:clamp(18px,3.4vw,56px);--ease:cubic-bezier(.2,.7,.1,1)}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;overflow-x:clip;scroll-behavior:smooth}
body{margin:0;background:var(--paper);color:var(--ink);font:400 16px/1.55 var(--f-text);-webkit-font-smoothing:antialiased;overflow-x:clip;counter-reset:sec}
img,svg{display:block;max-width:100%}
a{color:inherit}
h1,h2,h3,h4,p,ul,ol,dl,dd,figure,blockquote{margin:0}
ul,ol{padding:0;list-style:none}
mark{background:linear-gradient(transparent 12%,var(--hl) 12%,var(--hl) 88%,transparent 88%);color:var(--ink);padding:0 .08em}
em{font-family:var(--f-serif);font-style:italic;font-weight:400;letter-spacing:-.01em}
.mono{font-family:var(--f-mono);font-size:12px;letter-spacing:.05em;text-transform:uppercase}
.wrap{width:100%;max-width:1480px;margin:0 auto;padding:0 var(--gut)}
.skip{position:absolute;left:-999px;top:8px;z-index:999;background:var(--hl);padding:8px 12px}
.skip:focus{left:8px}
:focus-visible{outline:2px solid var(--blue);outline-offset:3px}
section{position:relative}
.sec{padding:clamp(64px,9vw,140px) 0}
.sec.dark{background:var(--ink);color:var(--paper)}
.sec.alt{background:var(--paper-2)}
.eyebrow{font-family:var(--f-mono);font-size:12px;letter-spacing:.08em;text-transform:uppercase;display:inline-flex;gap:.7em;align-items:center}
.eyebrow::before{counter-increment:sec;content:counter(sec,decimal-leading-zero);color:var(--blue);font-weight:500}
.dark .eyebrow::before{color:var(--blue-d)}
.h2{font-family:var(--f-display);font-weight:700;font-size:clamp(2.3rem,6vw,6rem);line-height:.92;letter-spacing:-.045em;margin-top:10px;overflow-wrap:anywhere}
.h2 em{font-weight:300;letter-spacing:-.02em}
.sec-head{margin-bottom:clamp(28px,4vw,64px)}
.lede{color:var(--muted)}
.dark .lede{color:var(--muted-d)}
.pill{display:inline-flex;align-items:center;gap:.6em;height:50px;padding:0 24px;border-radius:999px;font-weight:500;font-size:15px;text-decoration:none;border:1px solid currentColor;background:transparent;transition:background .3s,color .3s,border-color .3s;white-space:nowrap}
.pill.sm{height:38px;padding:0 16px;font-size:13px}
.pill-solid{background:var(--hl);color:var(--ink);border-color:var(--hl)}
.pill-solid:hover{background:var(--paper);border-color:var(--paper)}
.pill-ink{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.pill-ink:hover{background:var(--blue);border-color:var(--blue)}
.pill .arr{transition:transform .4s var(--ease)}
.pill:hover .arr{transform:translateX(4px)}
.js [data-reveal]{opacity:0;transform:translateY(28px);transition:opacity .9s var(--ease),transform .9s var(--ease)}
.js [data-reveal].in{opacity:1;transform:none}

/* nav */
.nav{position:fixed;z-index:60;top:14px;left:50%;transform:translateX(-50%);width:min(1440px,calc(100% - 2 * var(--gut) + 24px));display:flex;align-items:center;gap:28px;padding:8px 8px 8px 18px;border-radius:999px;color:var(--paper);transition:background .4s,color .4s,box-shadow .4s}
.nav.is-scrolled{background:rgba(244,241,234,.88);color:var(--ink);backdrop-filter:blur(14px) saturate(1.2);-webkit-backdrop-filter:blur(14px);box-shadow:0 0 0 1px var(--line),0 10px 30px rgba(0,0,0,.06)}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-family:var(--f-display);font-weight:700;font-size:16px;letter-spacing:-.02em;min-width:0}
.brand span:last-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.brand-mark{flex:none;width:28px;height:28px;border:1.5px solid currentColor;display:grid;place-items:center;font-family:var(--f-mono);font-size:10px;font-weight:500;letter-spacing:0}
.nav-links{display:flex;gap:22px;font-family:var(--f-mono);font-size:12px;letter-spacing:.06em;text-transform:uppercase}
.nav-links a{text-decoration:none;opacity:.82}
.nav-links a:hover{opacity:1}
.nav-r{margin-left:auto;flex:none}
.nav .pill-solid{height:38px;padding:0 18px;font-size:12px;font-family:var(--f-mono);text-transform:uppercase;letter-spacing:.05em}
@media(max-width:900px){.nav-links{display:none}.nav{gap:12px}}

/* hero */
.hero{min-height:100svh;position:relative;overflow:hidden;background:var(--ink);color:var(--paper);isolation:isolate;display:flex;flex-direction:column;justify-content:flex-end;padding:96px 0 84px}
.hero-photo{position:absolute;inset:0;z-index:-3}
.hero-photo img{width:100%;height:100%;object-fit:cover;filter:grayscale(.35) brightness(.5) contrast(1.05)}
.hero-grid{position:absolute;inset:0;z-index:-4;background:radial-gradient(ellipse at 75% 30%,rgba(47,92,240,.22),transparent 55%),var(--ink)}
.hero-scrim{position:absolute;inset:0;z-index:-2;pointer-events:none;background:linear-gradient(180deg,rgba(21,23,28,.65) 0%,rgba(21,23,28,.1) 38%,rgba(21,23,28,.7) 100%)}
.hero-grain{position:absolute;inset:0;z-index:-1;pointer-events:none;opacity:.5;mix-blend-mode:overlay;background-image:radial-gradient(rgba(255,255,255,.14) 1px,transparent 1px);background-size:3px 3px}
.reticle i{position:absolute;width:16px;height:16px;border:1px solid var(--muted-d);pointer-events:none}
.reticle i:nth-child(1){left:var(--gut);top:84px;border-right:0;border-bottom:0}
.reticle i:nth-child(2){right:var(--gut);top:84px;border-left:0;border-bottom:0}
.reticle i:nth-child(3){left:var(--gut);bottom:20px;border-right:0;border-top:0}
.reticle i:nth-child(4){right:var(--gut);bottom:20px;border-left:0;border-top:0}
.hero-top{position:absolute;left:0;right:0;top:112px}
.hero-top .wrap{display:flex;flex-direction:column;gap:20px;align-items:flex-start}
.hero-kicker{color:var(--blue-d);max-width:46ch}
.hero-line{font-size:clamp(18px,2vw,28px);line-height:1.35;max-width:22em;color:var(--paper);font-weight:400}
.hero-cta{display:flex;gap:12px;flex-wrap:wrap}
.hero-cta .pill-ghost{color:var(--paper);border-color:rgba(244,241,234,.45)}
.hero-cta .pill-ghost:hover{background:var(--paper);color:var(--ink)}
.hero-name{font-family:var(--f-display);font-weight:800;text-transform:none;letter-spacing:-.05em;line-height:.88;font-size:clamp(2.8rem,calc((100vw - 2 * var(--gut)) / (var(--n) * .93)),17.5vw);position:relative;overflow-wrap:anywhere}
.hero-name .l1{display:block}
.hero-name .l2{display:block;font-family:var(--f-serif);font-style:italic;font-weight:300;letter-spacing:-.03em;margin-top:-.04em;margin-left:.9em}
.hero-name-wrap{position:relative;margin:0}
.hero-bar{position:absolute;left:var(--gut);right:var(--gut);bottom:26px;display:flex;justify-content:space-between;gap:6px 16px;flex-wrap:wrap;border-top:1px solid var(--line-d);padding-top:12px;color:var(--muted-d)}
.hero-bar b{font-weight:500;color:var(--paper)}
.lens-layer{position:absolute;inset:0;z-index:2;pointer-events:none;-webkit-mask-image:radial-gradient(circle var(--lr,120px) at var(--lx,72%) var(--ly,34%),#000 97%,transparent 100%);mask-image:radial-gradient(circle var(--lr,120px) at var(--lx,72%) var(--ly,34%),#000 97%,transparent 100%);background-color:#0c0e13;background-image:linear-gradient(rgba(47,92,240,.38) 1px,transparent 1px),linear-gradient(90deg,rgba(47,92,240,.38) 1px,transparent 1px);background-image:linear-gradient(color-mix(in srgb,var(--blue) 45%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--blue) 45%,transparent) 1px,transparent 1px);background-size:26px 26px;display:flex;flex-direction:column;justify-content:flex-end;padding:96px 0 84px}
.lens-layer .hero-name{color:transparent;-webkit-text-stroke:1.2px var(--blue-d)}
.lens-layer .hero-name .l2{-webkit-text-stroke:1px var(--blue-d)}
.lens-ring{position:absolute;z-index:3;left:0;top:0;width:calc(var(--lr,120px) * 2);height:calc(var(--lr,120px) * 2);margin:calc(var(--lr,120px) * -1) 0 0 calc(var(--lr,120px) * -1);border:1.5px solid var(--blue-d);border-radius:50%;pointer-events:none;transform:translate(var(--rx,72%),var(--ry,34%));opacity:0;transition:opacity .4s}
.lens-ring.on{opacity:1}
.lens-tag{position:absolute;left:50%;bottom:-30px;transform:translateX(-50%);background:var(--blue);color:#fff;padding:3px 8px;font-size:10px;white-space:nowrap}
.hint{color:var(--blue-d)}
@media(hover:none){.hint{display:none}}
@media(max-width:700px){.hero{padding-bottom:116px}.lens-layer{padding-bottom:116px}.hero-top{top:96px}.hero-name .l2{margin-left:.4em}.hero{--lr:85px}}

/* marquee */
.marquee{background:var(--hl);color:var(--ink);overflow:hidden;border-block:1px solid var(--ink);padding:14px 0}
.mq-track{display:flex;width:max-content;gap:0;animation:mq 38s linear infinite}
.mq-track span{font-family:var(--f-display);font-weight:700;font-size:clamp(18px,2.4vw,30px);letter-spacing:-.02em;padding:0 26px;white-space:nowrap}
.mq-track span::after{content:"/";margin-left:52px;font-family:var(--f-mono);font-weight:400;opacity:.5}
@keyframes mq{to{transform:translateX(-50%)}}

/* about */
.about{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:clamp(28px,5vw,80px);align-items:start}
.about.no-photo{grid-template-columns:1fr}
.fig{position:relative}
.fig img{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:22px;filter:contrast(1.03)}
.fig figcaption{display:flex;justify-content:space-between;margin-top:10px;color:var(--muted)}
.about-body .big{font-size:clamp(18px,1.7vw,24px);line-height:1.55;margin-top:clamp(20px,2.4vw,32px);max-width:34em}
.pull{font-family:var(--f-serif);font-style:italic;font-weight:300;font-size:clamp(24px,3vw,40px);line-height:1.2;letter-spacing:-.02em;margin-top:20px;padding-left:18px;border-left:3px solid var(--blue);max-width:26em}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:0 16px;margin-top:clamp(28px,4vw,52px);border-top:2px solid var(--ink)}
.stat{padding:16px 16px 4px 0}
.stat b{display:block;font-family:var(--f-display);font-weight:800;font-size:clamp(1.8rem,3.2vw,3rem);line-height:1;letter-spacing:-.04em;color:var(--blue);overflow-wrap:anywhere}
.stat span{display:block;margin-top:8px;color:var(--muted)}

/* projects */
.cases{display:grid;gap:clamp(18px,2.4vw,32px)}
.case{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);background:var(--ink-2);border:1px solid var(--line-d);border-radius:26px;overflow:hidden;transition:transform .5s var(--ease),box-shadow .5s var(--ease);counter-increment:case}
.case:hover{transform:translateY(-6px);box-shadow:0 26px 60px rgba(0,0,0,.35)}
.case-l{padding:clamp(22px,3vw,40px);display:flex;flex-direction:column;gap:16px;min-width:0}
.case-meta{display:flex;gap:14px;flex-wrap:wrap;color:var(--muted-d)}
.case-meta::before{content:counter(case,decimal-leading-zero);color:var(--blue-d)}
.case h3{font-family:var(--f-display);font-weight:700;font-size:clamp(1.6rem,2.8vw,2.7rem);line-height:1;letter-spacing:-.035em;overflow-wrap:anywhere}
.case p.d{color:var(--muted-d);max-width:36em}
.ledger{margin-top:auto;border-top:1px solid var(--line-d)}
.ledger li{display:grid;grid-template-columns:20px 1fr;gap:8px;padding:12px 0;border-bottom:1px solid var(--line-d);color:var(--paper);font-size:15px}
.ledger li::before{content:"+";color:var(--blue-d);font-family:var(--f-mono)}
.case-r{background:var(--paper);background-image:linear-gradient(rgba(21,23,28,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(21,23,28,.06) 1px,transparent 1px);background-size:28px 28px;padding:clamp(18px,3vw,44px);display:grid;place-items:center;color:var(--ink);min-width:0}
.frame{width:100%;max-width:520px;background:#fff;border-radius:14px;box-shadow:0 22px 50px rgba(21,23,28,.18),0 0 0 1px var(--line);overflow:hidden;transition:transform .6s var(--ease)}
.case:hover .frame{transform:translateY(-4px) rotate(-.4deg)}
.frame-bar{display:flex;align-items:center;gap:6px;padding:10px 14px;border-bottom:1px solid var(--line);background:#faf8f3}
.frame-bar i{width:9px;height:9px;border-radius:50%;background:#d9d3c5}
.frame-bar .addr{margin-left:10px;color:var(--muted);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.frame-body{padding:20px;display:grid;gap:16px}
.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px}
.metric{background:var(--paper);border-radius:10px;padding:14px}
.metric b{display:block;font-family:var(--f-display);font-weight:800;font-size:clamp(1.7rem,3vw,2.6rem);letter-spacing:-.04em;line-height:1;color:var(--blue);overflow-wrap:anywhere}
.metric span{display:block;margin-top:6px;color:var(--muted)}
.skel{display:grid;gap:9px}
.skel i{display:block;height:11px;border-radius:6px;background:var(--paper-2)}
.skel i:nth-child(1){width:42%;height:16px;background:var(--blue);opacity:.85}
.skel i:nth-child(2){width:92%}.skel i:nth-child(3){width:76%}.skel i:nth-child(4){width:58%}
.tags{display:flex;gap:6px;flex-wrap:wrap}
.tag{font-family:var(--f-mono);font-size:11px;text-transform:uppercase;letter-spacing:.05em;padding:4px 9px;border-radius:999px;background:var(--hl);color:var(--ink)}
.case .pill{align-self:flex-start;color:var(--paper)}
.case .pill:hover{background:var(--paper);color:var(--ink)}
@media(max-width:860px){.case{grid-template-columns:1fr}}

/* experience */
.rows{border-top:2px solid var(--ink)}
.row{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,9fr);gap:clamp(14px,3vw,48px);padding:clamp(20px,2.4vw,34px) 0;border-bottom:1px solid var(--line);transition:background .3s,padding .3s}
.row:hover{background:linear-gradient(90deg,rgba(255,225,77,.35),transparent 70%)}
.row-t{color:var(--muted)}
.row-t b{display:block;font-weight:500;color:var(--blue);margin-bottom:6px}
.row h3{font-family:var(--f-display);font-weight:700;font-size:clamp(1.3rem,2.2vw,2rem);letter-spacing:-.03em;line-height:1.1;overflow-wrap:anywhere}
.row h3 em{font-weight:300}
.row .org{color:var(--muted);margin-top:6px}
.row p.s{margin-top:12px;max-width:44em}
.bul{margin-top:12px;display:grid;gap:8px;max-width:46em}
.bul li{display:grid;grid-template-columns:18px 1fr;gap:6px;color:var(--muted)}
.bul li::before{content:"+";color:var(--blue);font-family:var(--f-mono)}
.row-m{display:flex;gap:12px;align-items:flex-start}
.mono-tile{flex:none;width:52px;height:52px;border-radius:14px;background:#fff;border:1px solid var(--line);display:grid;place-items:center;font-family:var(--f-mono);font-size:13px;color:var(--blue);box-shadow:0 4px 12px rgba(21,23,28,.05)}
@media(max-width:760px){.row{grid-template-columns:1fr;gap:8px}}

/* skills: drafting sheet */
.chips{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:clamp(28px,4vw,56px)}
.chip{font-family:var(--f-mono);font-size:13px;padding:10px 16px;border-radius:14px;background:#fff;border:1px solid var(--line);box-shadow:0 4px 14px rgba(21,23,28,.05);transition:transform .3s var(--ease),background .3s}
.chip:hover{transform:translateY(-3px);background:var(--hl)}
.sheet{position:relative;border:1px solid var(--ink);background:var(--paper);background-image:linear-gradient(rgba(47,92,240,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(47,92,240,.07) 1px,transparent 1px);background-size:24px 24px;padding:clamp(22px,3vw,40px);padding-bottom:clamp(56px,6vw,72px);display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:clamp(22px,3vw,40px)}
.sheet::before{content:"";position:absolute;inset:8px;border:1px solid var(--line);pointer-events:none}
.sheet h3{font-family:var(--f-mono);font-weight:500;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--blue);padding-bottom:12px;border-bottom:1px solid var(--ink)}
.sheet li{padding:11px 0;border-bottom:1px solid var(--line)}
.title-block{position:absolute;right:0;bottom:0;display:flex;border-top:1px solid var(--ink);border-left:1px solid var(--ink);background:var(--paper)}
.title-block span{padding:9px 14px;font-size:10px;border-right:1px solid var(--line)}
.title-block span:first-child{background:var(--ink);color:var(--blue-d)}
.title-block span:last-child{border-right:0}

/* education / certs / achievements */
.edu{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr));gap:0 clamp(24px,4vw,64px)}
.edu-item{position:relative;display:flex;gap:14px;padding:22px 0;border-top:1px solid var(--line);overflow:hidden}
.edu-item .yr{position:absolute;right:0;top:50%;transform:translateY(-50%);font-family:var(--f-display);font-weight:800;font-size:clamp(3rem,7vw,6rem);letter-spacing:-.04em;color:transparent;-webkit-text-stroke:1.2px color-mix(in srgb,var(--blue) 40%,transparent);pointer-events:none;line-height:1}
.edu-item>div{position:relative;min-width:0}
.edu-item h3{font-family:var(--f-display);font-weight:700;font-size:clamp(1.15rem,1.8vw,1.55rem);letter-spacing:-.03em;line-height:1.15}
.edu-item .k{color:var(--muted);margin-top:6px}
.edu-item p{margin-top:6px}
.wins{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:clamp(14px,2vw,24px)}
.win{border:1px solid var(--line-d);border-radius:20px;padding:24px;background:var(--ink-2);transition:transform .4s var(--ease),border-color .4s}
.win:hover{transform:translateY(-6px);border-color:var(--blue-d)}
.win .y{color:var(--blue-d)}
.win h3{font-family:var(--f-display);font-weight:700;font-size:clamp(1.3rem,2vw,1.8rem);letter-spacing:-.03em;line-height:1.1;margin-top:12px;overflow-wrap:anywhere}
.win p{margin-top:10px;color:var(--muted-d)}

/* testimonials */
.quotes{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:clamp(20px,3vw,48px)}
.quote{border-top:3px solid var(--ink);padding-top:20px}
.quote blockquote{font-family:var(--f-serif);font-style:italic;font-weight:300;font-size:clamp(24px,2.8vw,38px);line-height:1.18;letter-spacing:-.02em}
.quote blockquote mark{font-style:italic}
.quote figcaption{margin-top:16px;color:var(--muted)}
.quote figcaption b{display:block;color:var(--ink);font-weight:500}

/* extras */
.extras{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:clamp(20px,3vw,48px)}
.extras h3{font-family:var(--f-mono);font-weight:500;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--blue);padding-bottom:10px;border-bottom:1px solid var(--ink)}
.extras .tags{margin-top:14px}
.extras .tag{background:#fff;border:1px solid var(--line);color:var(--ink);font-size:13px;text-transform:none;letter-spacing:0;padding:7px 14px}

/* contact */
.mail{display:block;font-family:var(--f-display);font-weight:700;font-size:clamp(1.5rem,6.4vw,6.4rem);letter-spacing:-.045em;line-height:1;text-decoration:none;overflow-wrap:anywhere;margin:clamp(8px,2vw,24px) 0 clamp(28px,4vw,56px);transition:color .3s}
.mail:hover{color:var(--hl)}
.mail-plain{display:block;font-family:var(--f-display);font-weight:700;font-size:clamp(1.5rem,6.4vw,6.4rem);letter-spacing:-.045em;line-height:1;overflow-wrap:anywhere;margin:clamp(8px,2vw,24px) 0 clamp(28px,4vw,56px)}
.clist{max-width:640px;border-top:1px solid var(--line-d)}
.clist li{display:flex;justify-content:space-between;gap:20px;padding:16px 0;border-bottom:1px solid var(--line-d)}
.clist li span{color:var(--muted-d)}
.clist li a,.clist li b{font-weight:400;text-align:right;text-decoration:none;overflow-wrap:anywhere;min-width:0}
.clist li a:hover{color:var(--hl)}
.foot{background:var(--ink);color:var(--muted-d);padding:26px 0 34px;border-top:1px solid var(--line-d)}
.foot .wrap{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}

@media(max-width:860px){.about{grid-template-columns:1fr}.fig{max-width:420px}.title-block{position:static;margin:24px -40px -72px 0;width:max-content;max-width:100%;flex-wrap:wrap}.sheet{padding-bottom:0}}
@media(max-width:480px){.title-block{display:none}.sheet{padding-bottom:clamp(22px,3vw,40px)}}
@media(prefers-reduced-motion:reduce){
html{scroll-behavior:auto}
.js [data-reveal]{opacity:1;transform:none;transition:none}
.mq-track{animation:none}
.case,.win,.chip,.frame,.pill .arr{transition:none}
.lens-layer,.lens-ring{display:none}
}
`;

function wordsOf(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return { first: name, last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] as string };
}

function yearOf(period: string | undefined): string | null {
  if (!period) return null;
  const m = period.match(/\b(19|20)\d{2}\b/g);
  return m ? (m[m.length - 1] as string) : null;
}

function head(label: string, title: string): string {
  return `<div class="sec-head" data-reveal><span class="eyebrow">${esc(label)}</span><h2 class="h2">${title}</h2></div>`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function render({ facts, custom }: RenderInput): string {
  const accent = accentColour(custom, DEFAULT_ACCENT, PAPER);
  const font = fontOverride(custom);
  const secs = visibleSections(facts, custom, SECTIONS);
  const has = (k: SectionKey) => secs.includes(k);
  const { first, last } = wordsOf(facts.name);
  const n = Math.max(4, first.length, Math.round(last.length * 0.75));

  const fontVars = font ? `--f-display:${font.stack};--f-text:${font.stack};--f-serif:${custom.fonts === "serif" ? font.stack : "'Newsreader',Georgia,serif"};` : "";

  const firstTarget = (["projects", "experience", "skills", "about"] as SectionKey[]).find(has);
  const nameBlock = (cls: string, tag = "div") =>
    `<${tag} class="hero-name ${cls}" style="--n:${n}"><span class="l1">${esc(first)}</span>${last ? `<span class="l2">${esc(last)}</span>` : ""}</${tag}>`;

  const links = secs
    .map((k) => `<a href="#${k}">${esc(NAV_LABEL[k])}</a>`)
    .join("");

  const nav = `<header id="nav" class="nav" aria-label="Site"><a class="brand" href="#top"><span class="brand-mark">${esc(initials(facts.name))}</span><span>${esc(facts.name)}</span></a><nav class="nav-links" aria-label="Sections">${links}</nav>${
    has("contact") ? `<div class="nav-r"><a class="pill pill-solid" href="#contact">Get in touch</a></div>` : ""
  }</header>`;

  const bar: string[] = [];
  if (facts.location) bar.push(`<span class="mono">${esc(facts.location)}</span>`);
  for (const s of facts.stats.slice(0, 2)) bar.push(`<span class="mono"><b>${esc(s.value)}</b> ${esc(s.label)}</span>`);
  bar.push(`<span class="mono hint">Move across the frame to see underneath it</span>`);

  const hero = `<section class="hero" id="top" aria-label="Introduction">
${facts.photoUrl ? `<div class="hero-photo" aria-hidden="true">${photoTag(facts, { alt: "" })}</div>` : ""}<div class="hero-grid" aria-hidden="true"></div><div class="hero-scrim" aria-hidden="true"></div><div class="hero-grain" aria-hidden="true"></div>
<div class="reticle" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
<div class="lens-layer" aria-hidden="true"><div class="wrap">${nameBlock("lens-name")}</div></div>
<div class="lens-ring" aria-hidden="true"><span class="lens-tag mono">Underneath</span></div>
<div class="hero-top"><div class="wrap">${facts.headline ? `<p class="hero-kicker mono">${esc(facts.headline)}</p>` : ""}${facts.tagline ? `<p class="hero-line">${esc(facts.tagline)}</p>` : ""}${
    firstTarget || has("contact")
      ? `<div class="hero-cta">${firstTarget ? `<a class="pill pill-solid" href="#${firstTarget}">See the work <span class="arr">&rarr;</span></a>` : ""}${has("contact") ? `<a class="pill pill-ghost" href="#contact">Get in touch</a>` : ""}</div>`
      : ""
  }</div></div>
<div class="wrap hero-bottom"><div class="hero-name-wrap">${nameBlock("main-name", "h1")}</div></div><div class="hero-bar">${bar.join("")}</div>
</section>`;

  const marquee =
    has("skills") && facts.skills.length
      ? (() => {
          const items = facts.skills.flatMap((g) => g.items);
          const one = items.map((i) => `<span>${esc(i)}</span>`).join("");
          const reps = Math.max(2, Math.ceil(12 / items.length));
          const half = one.repeat(reps);
          return `<div class="marquee" aria-hidden="true"><div class="mq-track">${half}${half}</div></div>`;
        })()
      : "";

  const bySection: Record<SectionKey, () => string> = {
    about: () => {
      const photo = facts.photoUrl
        ? `<figure class="fig" data-reveal>${photoTag(facts, { alt: facts.name })}${facts.location ? `<figcaption class="mono"><span>${esc(facts.location)}</span></figcaption>` : ""}</figure>`
        : "";
      const body = facts.summary
        ? `<p class="big">${esc(facts.summary)}</p>${facts.tagline ? `<p class="pull">${esc(facts.tagline)}</p>` : ""}`
        : `<p class="pull">${esc(facts.tagline)}</p>`;
      const stats = facts.stats.length
        ? `<div class="stats">${facts.stats.map((s) => `<div class="stat"><b>${esc(s.value)}</b><span class="mono">${esc(s.label)}</span></div>`).join("")}</div>`
        : "";
      return `<section class="sec" id="about" aria-labelledby="about-h"><div class="wrap"><div class="about${photo ? "" : " no-photo"}">${photo}<div class="about-body" data-reveal><span class="eyebrow">About</span><h2 class="h2" id="about-h">The person <em>behind</em> the work</h2>${body}${stats}</div></div></div></section>`;
    },
    projects: () => {
      const cards = facts.projects
        .map((p) => {
          const href = safeHref(p.link);
          const meta = [p.role, p.period].filter(Boolean).map((m) => `<span>${esc(m)}</span>`).join("");
          const metrics = p.metrics.length ? `<div class="metrics">${p.metrics.map((m) => `<div class="metric"><b>${esc(m.value)}</b><span class="mono">${esc(m.label)}</span></div>`).join("")}</div>` : `<div class="skel" aria-hidden="true"><i></i><i></i><i></i><i></i></div>`;
          const tags = p.tags.length ? `<div class="tags">${p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : "";
          const bullets = p.bullets.length ? `<ul class="ledger">${p.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : "";
          const addr = href && /^https?:/i.test(href) ? `<span class="addr mono">${esc(hostOf(href))}</span>` : "";
          return `<article class="case" data-reveal><div class="case-l"><div class="case-meta mono">${meta}</div><h3>${esc(p.name)}</h3>${p.description ? `<p class="d">${esc(p.description)}</p>` : ""}${bullets}${
            href ? `<a class="pill sm" href="${attr(href)}" target="_blank" rel="noopener noreferrer">View project <span class="arr">&nearr;</span></a>` : ""
          }</div><div class="case-r"><div class="frame" aria-hidden="false"><div class="frame-bar"><i></i><i></i><i></i>${addr}</div><div class="frame-body">${metrics}${tags}</div></div></div></article>`;
        })
        .join("");
      return `<section class="sec dark" id="projects" aria-labelledby="projects-h"><div class="wrap"><div class="sec-head" data-reveal><span class="eyebrow">Selected work</span><h2 class="h2" id="projects-h">Things I <em>shipped</em></h2></div><div class="cases">${cards}</div></div></section>`;
    },
    experience: () => {
      const rows = facts.experience
        .map((e) => {
          return `<article class="row" data-reveal><div class="row-t mono">${e.period ? `<b>${esc(e.period)}</b>` : ""}${e.location ? esc(e.location) : ""}</div><div class="row-m"><span class="mono-tile" aria-hidden="true">${esc(initials(e.org))}</span><div><h3>${esc(e.role)}</h3><p class="org mono">${esc(e.org)}</p>${e.summary ? `<p class="s">${esc(e.summary)}</p>` : ""}${
            e.bullets.length ? `<ul class="bul">${e.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""
          }</div></div></article>`;
        })
        .join("");
      return `<section class="sec" id="experience" aria-labelledby="experience-h"><div class="wrap">${head("Experience", `<span id="experience-h">Where I <em>worked</em></span>`)}<div class="rows">${rows}</div></div></section>`;
    },
    skills: () => {
      const items = facts.skills.flatMap((g) => g.items);
      const groups = facts.skills
        .map((g) => `<div><h3>${g.group ? esc(g.group) : "Toolkit"}</h3><ul>${g.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>`)
        .join("");
      const chips = items.length > 4 ? `<div class="chips" aria-hidden="true">${items.slice(0, 16).map((i) => `<span class="chip">${esc(i)}</span>`).join("")}</div>` : "";
      return `<section class="sec alt" id="skills" aria-labelledby="skills-h"><div class="wrap">${head("Skills and tools", `<span id="skills-h">The <em>toolkit</em></span>`)}${chips}<div class="sheet" data-reveal>${groups}<div class="title-block mono"><span>Toolkit</span><span>${esc(facts.name)}</span></div></div></div></section>`;
    },
    education: () => {
      const items = facts.education
        .map((e) => {
          const y = yearOf(e.period);
          return `<article class="edu-item" data-reveal>${y ? `<span class="yr" aria-hidden="true">${esc(y)}</span>` : ""}<div><h3>${esc(e.school)}</h3>${e.degree ? `<p class="k mono">${esc(e.degree)}</p>` : ""}${e.period ? `<p class="k mono">${esc(e.period)}</p>` : ""}${e.detail ? `<p>${esc(e.detail)}</p>` : ""}</div></article>`;
        })
        .join("");
      return `<section class="sec" id="education" aria-labelledby="education-h"><div class="wrap">${head("Education", `<span id="education-h">Where I <em>studied</em></span>`)}<div class="edu">${items}</div></div></section>`;
    },
    achievements: () => {
      const items = facts.achievements
        .map((a) => `<article class="win" data-reveal>${a.year ? `<span class="y mono">${esc(a.year)}</span>` : ""}<h3>${esc(a.title)}</h3>${a.detail ? `<p>${esc(a.detail)}</p>` : ""}</article>`)
        .join("");
      return `<section class="sec dark" id="achievements" aria-labelledby="achievements-h"><div class="wrap">${head("Achievements", `<span id="achievements-h">The <em>wins</em></span>`)}<div class="wins">${items}</div></div></section>`;
    },
    certifications: () => {
      const items = facts.certifications
        .map((c) => {
          const sub = [c.issuer, c.year].filter(Boolean).join(" · ");
          return `<article class="edu-item" data-reveal><div><h3>${esc(c.name)}</h3>${sub ? `<p class="k mono">${esc(sub)}</p>` : ""}</div></article>`;
        })
        .join("");
      return `<section class="sec alt" id="certifications" aria-labelledby="certifications-h"><div class="wrap">${head("Certifications", `<span id="certifications-h">Papers on <em>file</em></span>`)}<div class="edu">${items}</div></div></section>`;
    },
    testimonials: () => {
      const items = facts.testimonials
        .map((t) => `<figure class="quote" data-reveal><blockquote>&ldquo;${esc(t.quote)}&rdquo;</blockquote><figcaption class="mono"><b>${esc(t.author)}</b>${t.role ? esc(t.role) : ""}</figcaption></figure>`)
        .join("");
      return `<section class="sec" id="testimonials" aria-labelledby="testimonials-h"><div class="wrap">${head("Testimonials", `<span id="testimonials-h">Kind <em>words</em></span>`)}<div class="quotes">${items}</div></div></section>`;
    },
    extras: () => {
      const items = facts.extras
        .map((x) => `<div data-reveal><h3>${esc(x.label)}</h3><div class="tags">${x.items.map((i) => `<span class="tag">${esc(i)}</span>`).join("")}</div></div>`)
        .join("");
      return `<section class="sec alt" id="extras" aria-labelledby="extras-h"><div class="wrap">${head("Beyond the day job", `<span id="extras-h">Outside <em>work</em></span>`)}<div class="extras">${items}</div></div></section>`;
    },
    contact: () => {
      const mail = facts.email
        ? `<a class="mail" href="mailto:${attr(facts.email)}">${esc(facts.email)}</a>`
        : facts.phone
          ? `<span class="mail-plain">${esc(facts.phone)}</span>`
          : "";
      const rows: string[] = [];
      if (facts.email && facts.phone) rows.push(`<li><span class="mono">Phone</span><a href="tel:${attr(facts.phone.replace(/[^\d+]/g, ""))}">${esc(facts.phone)}</a></li>`);
      for (const l of facts.links) {
        const href = safeHref(l.url);
        rows.push(`<li><span class="mono">${esc(l.label)}</span>${href ? `<a href="${attr(href)}" target="_blank" rel="noopener noreferrer">${esc(hostOf(href).replace(/^www\./, "") + (href.replace(/^https?:\/\/[^/]+/, "") || ""))}</a>` : `<b>${esc(l.url)}</b>`}</li>`);
      }
      return `<section class="sec dark" id="contact" aria-labelledby="contact-h"><div class="wrap">${head("Get in touch", `<span id="contact-h">Let&rsquo;s <em>talk</em></span>`)}${mail}${rows.length ? `<ul class="clist">${rows.join("")}</ul>` : ""}</div></section>`;
    },
  };

  const body = secs.map((k) => bySection[k]()).join("\n");

  const js = `(function(){
var d=document,h=d.documentElement;h.classList.add('js');
var nav=d.getElementById('nav');
function sc(){if(nav)nav.classList.toggle('is-scrolled',window.scrollY>60)}
window.addEventListener('scroll',sc,{passive:true});sc();
var els=[].slice.call(d.querySelectorAll('[data-reveal]'));
if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.12,rootMargin:'0px 0px -6% 0px'});els.forEach(function(e){io.observe(e)})}else{els.forEach(function(e){e.classList.add('in')})}
var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
var hero=d.getElementById('top'),lens=hero&&hero.querySelector('.lens-layer'),ring=hero&&hero.querySelector('.lens-ring');
if(hero&&lens&&ring&&!reduce){
var cfg=${safeJson({ r: 120 })};
var tx=-1,ty=-1,cx=-1,cy=-1,last=0,run=false;
function set(x,y){lens.style.setProperty('--lx',x+'px');lens.style.setProperty('--ly',y+'px');ring.style.setProperty('--rx',x+'px');ring.style.setProperty('--ry',y+'px')}
function tick(t){
var r=hero.getBoundingClientRect();
if(r.bottom<0||r.top>innerHeight){run=false;return}
if(t-last>2200&&last){var a=t/1800;tx=r.width*(.5+.3*Math.sin(a));ty=r.height*(.45+.2*Math.cos(a*1.3))}
if(cx<0){cx=tx;cy=ty}
cx+=(tx-cx)*.12;cy+=(ty-cy)*.12;set(cx,cy);
requestAnimationFrame(tick)}
function start(){if(!run){run=true;requestAnimationFrame(tick)}}
hero.addEventListener('pointermove',function(e){var r=hero.getBoundingClientRect();tx=e.clientX-r.left;ty=e.clientY-r.top;last=performance.now();ring.classList.add('on');start()});
hero.addEventListener('pointerleave',function(){last=performance.now()});
tx=hero.clientWidth*.7;ty=hero.clientHeight*.35;cx=tx;cy=ty;set(cx,cy);ring.classList.add('on');
if('IntersectionObserver' in window){new IntersectionObserver(function(es){if(es[0].isIntersecting)start()}).observe(hero)}else{start()}
}
})();`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(facts.name)}${facts.headline ? ` · ${esc(facts.headline)}` : ""}</title>
${facts.tagline || facts.summary ? `<meta name="description" content="${attr((facts.tagline ?? facts.summary ?? "").slice(0, 200))}">` : ""}
<link rel="stylesheet" href="${FONT_HREF}">
<style>:root{--blue:${accent}}${CSS}:root{${fontVars}}</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${nav}
<main id="main">
${hero}
${marquee}
${body}
</main>
<footer class="foot"><div class="wrap"><span class="mono">${esc(facts.name)}</span>${facts.location ? `<span class="mono">${esc(facts.location)}</span>` : ""}</div></footer>
${scriptTag(js)}
</body>
</html>`;
}

const template: ThemeTemplate = { id: "paper-sprint", sections: SECTIONS, defaultAccent: DEFAULT_ACCENT, render };
export default template;
