import type { PortfolioFacts, SectionKey } from "../../facts";
import { accentColour, attr, esc, fontOverride, googleFontsHref, initials, photoTag, safeHref, scriptTag, visibleSections } from "../helpers";
import type { RenderInput, ThemeTemplate } from "../types";

// "Movie Poster": a theatre bill and a trophy cabinet. Flat colour scenes, grain, a stage frame, an opening curtain,
// a marquee ribbon, and one poster card for every project and win, built only from the facts.

const SECTIONS: SectionKey[] = ["about", "projects", "skills", "education", "certifications", "experience", "achievements", "testimonials", "extras", "contact"];
const DEFAULT_ACCENT = "#d1504e";
const INK = "#141210";
const FONTS = [
  { family: "Poiret One", weights: "400" },
  { family: "Big Shoulders Display", weights: "700;800;900" },
  { family: "Bricolage Grotesque", weights: "400;500;600;700;800" },
];

type Pair = [string, string];
const PROJECT_COLOURS: Pair[] = [
  ["var(--accent)", "var(--ink)"], ["var(--cobalt)", "var(--ink)"], ["var(--plum)", "var(--cream)"], ["var(--teal)", "var(--ink)"],
  ["var(--orange)", "var(--ink)"], ["var(--violet)", "var(--ink)"], ["var(--pink)", "var(--ink)"], ["var(--mustard)", "var(--ink)"],
];
const WIN_COLOURS: Pair[] = [
  ["var(--accent)", "var(--ink)"], ["var(--cobalt)", "var(--ink)"], ["var(--plum)", "var(--cream)"], ["var(--teal)", "var(--ink)"],
  ["var(--violet)", "var(--ink)"], ["var(--grass)", "var(--ink)"], ["var(--pink)", "var(--ink)"], ["var(--mustard)", "var(--ink)"],
];
const TILTS = ["-1.4deg", "1deg", "-0.6deg", "1.5deg"];

const NAV_LABEL: Record<string, string> = {
  about: "About", projects: "Work", record: "Record", experience: "Journey", achievements: "Wins", testimonials: "Praise", extras: "After hours", contact: "Contact",
};
const SECTION_ID: Record<string, string> = {
  about: "about", projects: "projects", record: "record", experience: "journey", achievements: "wins", testimonials: "voices", extras: "outside", contact: "contact",
};

function starPoints(cx: number, cy: number, R: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r : R;
    pts.push(`${(cx + Math.cos(a) * rad).toFixed(1)},${(cy + Math.sin(a) * rad).toFixed(1)}`);
  }
  return pts.join(" ");
}

const STAR_ART = `<svg viewBox="0 0 400 420" role="presentation" focusable="false">
  <polygon points="150,0 250,0 380,400 20,400" fill="#f4ecdc" opacity=".16"/>
  <polygon points="40,0 100,0 90,400 -60,400" fill="#f4ecdc" opacity=".1"/>
  <polygon points="300,0 360,0 460,400 310,400" fill="#f4ecdc" opacity=".1"/>
  <ellipse cx="200" cy="380" rx="170" ry="30" fill="#141210"/>
  <ellipse cx="200" cy="372" rx="170" ry="30" fill="#f4ecdc" opacity=".35"/>
  <polygon points="${starPoints(200, 190, 130, 54)}" fill="#d9a441" stroke="#141210" stroke-width="9" stroke-linejoin="round"/>
  <polygon points="${starPoints(200, 190, 76, 31)}" fill="#f4ecdc" opacity=".5"/>
  <polygon points="${starPoints(70, 80, 28, 12)}" fill="#f4ecdc" stroke="#141210" stroke-width="5" stroke-linejoin="round"/>
  <polygon points="${starPoints(338, 120, 22, 9)}" fill="#f4ecdc" stroke="#141210" stroke-width="5" stroke-linejoin="round"/>
</svg>`;

function ringsSvg(): string {
  let rings = "";
  for (let r = 300, i = 0; r > 40; r -= 13, i++) rings += `<circle r="${r}" fill="${i % 2 ? "#4a2231" : "#5c2b3d"}" stroke="#2a121c" stroke-width="${i % 3 ? 1.5 : 3}"/>`;
  return `<svg class="rings" id="rings" viewBox="-300 -300 600 600" aria-hidden="true" focusable="false">${rings}<g id="dEye"><circle r="38" fill="#d9a441" stroke="#141210" stroke-width="5"/><circle r="24" fill="#f4ecdc"/><rect x="-6" y="-20" width="12" height="40" rx="6" fill="#141210"/></g></svg>`;
}

const ENGINE = `<div class="engine" aria-hidden="true"><svg viewBox="0 0 250 330"><rect x="40" y="130" width="210" height="160" rx="22" fill="#141210"/><rect x="150" y="40" width="100" height="110" rx="16" fill="#141210"/><rect x="170" y="62" width="60" height="50" rx="10" fill="#f4ecdc"/><rect x="60" y="150" width="70" height="46" rx="10" fill="#f4ecdc" opacity=".9"/><rect x="62" y="64" width="38" height="70" rx="6" fill="#141210"/><rect x="56" y="54" width="50" height="16" rx="8" fill="#141210"/><circle cx="90" cy="298" r="32" fill="#141210" stroke="#27957d" stroke-width="9"/><circle cx="196" cy="298" r="32" fill="#141210" stroke="#27957d" stroke-width="9"/></svg></div>`;

const ROPE = `<svg viewBox="0 0 60 420" aria-hidden="true" focusable="false"><path d="M30 0V300" stroke="#141210" stroke-width="7" stroke-dasharray="10 5"/><path d="M30 0V300" stroke="#d9a441" stroke-width="3"/><circle cx="30" cy="306" r="13" fill="#141210"/><path d="M14 318h32l8 92H6z" fill="#141210"/><path d="M14 330h32M12 346h36M10 362h40M9 378h42" stroke="#d9a441" stroke-width="3"/></svg>`;

const VALANCE = (() => {
  let d = "M0 0H1440V70";
  for (let x = 1368; x >= 0; x -= 72) d += ` Q${x + 36} 112 ${x} 70`;
  return `<svg class="valance" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="${d}Z" fill="#8f2b30"/><path d="M0 58H1440" stroke="#d9a441" stroke-width="5" stroke-dasharray="2 12" stroke-linecap="round"/></svg>`;
})();

const CSS = String.raw`
:root{--ink:#141210;--cream:#f4ecdc;--gold:#d9a441;--plum:#5c2b3d;--violet:#a35bb6;--grass:#3f9142;--cobalt:#4183c6;--teal:#27957d;--orange:#de7a3e;--pink:#de6d89;--mustard:#cf9a25;--frame:12px;--radius:18px;--pad:clamp(20px,6vw,96px)}
*{box-sizing:border-box}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0;background:var(--ink);color:var(--ink);font:400 17px/1.5 var(--f-body);overflow-x:hidden}
img{max-width:100%;display:block}
a{color:inherit}
p{margin:0 0 .8em}
h1,h2,h3{margin:0;font-weight:inherit}
ul{margin:0}
.skip{position:fixed;left:24px;top:24px;z-index:100;background:var(--cream);padding:10px 14px;clip-path:inset(50%);opacity:0}
.skip:focus{clip-path:none;opacity:1}
:focus-visible{outline:3px solid var(--cream);outline-offset:3px;box-shadow:0 0 0 6px var(--ink)}
html.has-eye,html.has-eye *{cursor:none!important}

.frame{position:fixed;inset:var(--frame);border-radius:var(--radius);box-shadow:0 0 0 calc(var(--frame)*3) var(--ink);pointer-events:none;z-index:70}
.grain{position:fixed;inset:0;pointer-events:none;z-index:69;opacity:.2;mix-blend-mode:multiply;background-size:180px 180px;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .9 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");animation:grain 1s steps(8) infinite}
@keyframes grain{0%{background-position:0 0}12%{background-position:-40px -61px}25%{background-position:-90px 33px}37%{background-position:52px -120px}50%{background-position:110px 90px}62%{background-position:-121px 64px}75%{background-position:83px 22px}87%{background-position:-30px 81px}100%{background-position:0 0}}

.curtain{display:none;position:fixed;inset:0;z-index:80;pointer-events:none}
.js .curtain{display:block}
.drape{position:absolute;top:0;bottom:0;width:51%;transition:transform 1.5s cubic-bezier(.7,0,.2,1);background:repeating-linear-gradient(90deg,#8f2b30 0 26px,#a93a3f 26px 44px,#b94a4e 44px 52px,#9a3237 52px 70px,#6e1f24 70px 86px)}
.drape.l{left:0;transform-origin:left;border-right:6px solid #4d1317}
.drape.r{right:0;border-left:6px solid #4d1317}
.valance{position:absolute;top:0;left:0;width:100%;height:clamp(60px,9vw,120px);transition:transform 1.2s cubic-bezier(.7,0,.2,1) .25s}
.curtain.open .drape.l{transform:translateX(-102%) scaleX(.6)}
.curtain.open .drape.r{transform:translateX(102%) scaleX(.6)}
.curtain.open .valance{transform:translateY(-110%)}
.curtain.gone{display:none!important}

.bar{position:fixed;top:calc(var(--frame) + 10px);left:calc(var(--frame) + 14px);right:calc(var(--frame) + 14px);z-index:65;display:flex;align-items:center;justify-content:space-between;gap:16px;pointer-events:none}
.bar>*{pointer-events:auto}
.me,.nav a,.menu-btn{font:800 15px/1 var(--f-cut);letter-spacing:.09em;text-transform:uppercase;text-decoration:none;color:var(--ink);background:var(--cream);border:2.5px solid var(--ink);border-radius:999px;padding:9px 14px}
.me{max-width:48vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nav{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.nav a:hover,.nav a:focus-visible{background:var(--ink);color:var(--cream)}
.menu-btn{display:none;cursor:pointer}

.scene{position:relative;background:var(--bg);color:var(--fg,var(--ink));padding:calc(var(--frame) + 86px) var(--pad) calc(var(--frame) + 70px);overflow:clip}
.scene.dark-scene{--fg:var(--cream)}
.cut{font:900 clamp(56px,9vw,150px)/.86 var(--f-cut);text-transform:uppercase;letter-spacing:-.01em;overflow-wrap:anywhere}
.small-cut{font-size:clamp(46px,6.4vw,104px)}
.lbl{font:800 15px/1 var(--f-cut);letter-spacing:.16em;text-transform:uppercase;margin:0 0 12px}
.lede{font-size:clamp(19px,1.6vw,23px);line-height:1.45;font-weight:500}
.window{margin:0;border:5px solid var(--ink);border-radius:26px;overflow:hidden;background:var(--ink);box-shadow:10px 10px 0 rgba(20,18,16,.85)}
.window img{width:100%;height:100%;object-fit:cover}
.tilt-l{transform:rotate(-2.5deg)}
.pill{display:inline-block;font:800 14px/1 var(--f-cut);letter-spacing:.12em;text-transform:uppercase;text-decoration:none;background:var(--ink);color:var(--cream);border:2.5px solid var(--ink);border-radius:999px;padding:12px 18px}
.pill.ghost{background:var(--cream);color:var(--ink)}
.pill:hover,.pill:focus-visible{background:var(--gold);color:var(--ink)}

/* hero */
.hero{display:flex;flex-direction:column;align-items:center;padding-bottom:0;text-align:center;min-height:100vh;background:var(--accent)}
.kicker{font:800 clamp(14px,1.2vw,18px)/1 var(--f-cut);letter-spacing:.24em;text-transform:uppercase;margin:0 0 6px}
.name{font:400 clamp(58px,10.6vw,180px)/.9 var(--f-name);text-transform:uppercase;letter-spacing:-.02em;position:relative;z-index:1;overflow-wrap:anywhere}
.name span{display:inline-block}
.hero-body{position:relative;width:100%;flex:1;display:grid;grid-template-columns:1fr minmax(300px,min(34vw,60vh));align-items:end;justify-content:center;gap:clamp(20px,4vw,64px);margin-top:-3vw;max-width:1400px}
.hero-body.has-stats{grid-template-columns:1fr minmax(300px,min(34vw,60vh)) 1fr}
.hero-facts{list-style:none;margin:0;padding:0 0 8vh;align-self:center;text-align:left;display:grid;gap:14px}
.hero-facts b{display:block;font:900 clamp(40px,3.8vw,62px)/.9 var(--f-cut);overflow-wrap:anywhere}
.hero-facts span{font-weight:600;font-size:15px}
.hero-left{text-align:left;align-self:center;padding-bottom:8vh}
.headline{font:900 clamp(26px,2.8vw,46px)/1 var(--f-cut);text-transform:uppercase;margin-bottom:12px}
.avail{font-weight:600}
.hero-cta{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
.who{margin:0;align-self:end;position:relative;z-index:2}
.who svg{width:100%;height:auto;display:block}
.cue{position:absolute;left:50%;bottom:calc(var(--frame) + 62px);transform:translateX(-50%);font:800 13px/1 var(--f-cut);letter-spacing:.3em;text-transform:uppercase;margin:0;z-index:3;display:none}
.ribbon{position:relative;z-index:3;width:calc(100% + var(--pad)*2);margin:0 calc(var(--pad)*-1) 0;background:var(--gold);color:var(--ink);border-block:4px solid var(--ink);overflow:hidden;padding:12px 0;transform:rotate(-1.6deg) scale(1.03);transform-origin:center;margin-bottom:calc(var(--frame) + 34px)}
.ribbon-track{display:flex;width:max-content;animation:marq 38s linear infinite}
.ribbon-set{display:flex;flex:none}
.ribbon-set span{font:900 clamp(22px,2.4vw,34px)/1 var(--f-cut);text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;padding:0 18px}
.ribbon-set span::after{content:"\2605";margin-left:36px;font-size:.7em}
@keyframes marq{to{transform:translateX(-50%)}}

/* dive */
.dive{padding:calc(var(--frame) + 86px) 0 calc(var(--frame) + 70px)}
.sticky{position:relative}
.rings{position:absolute;width:min(130vh,100vw);height:min(130vh,100vw);left:50%;top:50%;transform:translate(-50%,-50%) scale(var(--s,1));opacity:.45}
.dive-lines{position:relative;list-style:none;margin:0 auto;padding:0 var(--pad);max-width:1000px;text-align:center;display:grid;gap:34px}
.dive-lines li{font:900 clamp(34px,4.6vw,76px)/.98 var(--f-cut);text-transform:uppercase;overflow-wrap:anywhere}
.dive-lines li.long{font-size:clamp(26px,3vw,48px);line-height:1.05}
.dive-lines li small{display:block;font:600 clamp(16px,1.3vw,19px)/1.4 var(--f-body);text-transform:none;margin-top:14px;opacity:.9}
.motion .dive{height:260vh;padding:0}
.motion .dive .sticky{position:sticky;top:0;height:100vh;overflow:clip;display:grid;place-items:center}
.motion .dive .rings{opacity:1}
.motion .dive-lines{gap:0}
.motion .dive-lines li{grid-area:1/1;opacity:0;transform:translateY(30px) rotate(-1.5deg);transition:opacity .45s,transform .45s}
.motion .dive-lines li.on{opacity:1;transform:none}

/* about */
.hi .cut{font-size:clamp(70px,13vw,230px);white-space:nowrap;margin:0 0 4vw;transform:translateX(var(--x,0))}
.cut .ch{display:inline-block;transform:rotate(var(--r)) translateY(var(--y))}
.hi-grid{display:grid;grid-template-columns:minmax(260px,420px) 1fr;gap:clamp(28px,5vw,80px);align-items:start;max-width:1200px}
.hi-grid.solo{grid-template-columns:1fr}
.hi .window{aspect-ratio:3/4}
.hi-text{max-width:640px}

/* posters */
.head{display:flex;align-items:end;justify-content:space-between;gap:24px;flex-wrap:wrap}
.posters{display:flex;flex-wrap:wrap;gap:clamp(22px,2.8vw,44px);margin-top:36px;align-items:flex-start}
.posters>.poster{flex:1 1 300px;max-width:420px}
.poster{position:relative;background:var(--c);color:var(--t);border:5px solid var(--ink);border-radius:10px;padding:24px 22px 22px;box-shadow:10px 10px 0 rgba(20,18,16,.85);transform:rotate(var(--rot,0deg));transition:transform .35s cubic-bezier(.5,1.6,.4,1),box-shadow .35s;display:flex;flex-direction:column;gap:12px}
.poster::before{content:"";position:absolute;inset:8px;border:2px solid currentColor;opacity:.4;border-radius:4px;pointer-events:none}
.poster:hover,.poster:focus-within{transform:rotate(0deg) translateY(-6px) scale(1.015);box-shadow:14px 16px 0 rgba(20,18,16,.85)}
.p-top{display:flex;justify-content:space-between;gap:10px;font:400 16px/1.2 var(--f-name);letter-spacing:.18em;text-transform:uppercase;-webkit-text-stroke:.4px currentColor}
.p-art{position:relative;aspect-ratio:1/.74;border:3px solid var(--ink);border-radius:6px;overflow:hidden;display:grid;place-items:center;background:repeating-conic-gradient(from 0deg at 50% 60%,rgba(255,255,255,.22) 0 6deg,rgba(255,255,255,0) 6deg 12deg),radial-gradient(circle at 50% 60%,rgba(255,255,255,.28),rgba(0,0,0,.18) 80%)}
.spot{width:min(68%,210px);aspect-ratio:1;border-radius:50%;background:var(--cream);color:var(--ink);border:4px solid var(--ink);box-shadow:0 0 0 6px rgba(20,18,16,.18);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:10px;transform:rotate(-4deg)}
.spot b{font:900 clamp(40px,4.4vw,64px)/.9 var(--f-cut);text-transform:uppercase;overflow-wrap:anywhere}
.spot b.m{font-size:clamp(30px,3.2vw,46px)}
.spot b.s{font-size:clamp(22px,2.2vw,32px)}
.spot small{font:700 12.5px/1.15 var(--f-body);margin-top:6px;max-width:92%}
.p-title{font:900 clamp(34px,3.3vw,52px)/.92 var(--f-cut);text-transform:uppercase;text-align:center;margin-top:4px;overflow-wrap:anywhere}
.p-desc{font-weight:500;font-size:15.5px;margin:0;text-align:center}
.p-bullets{list-style:none;padding:0;display:grid;gap:6px;font-size:14.5px;font-weight:500}
.p-bullets li{padding-left:18px;position:relative}
.p-bullets li::before{content:"\2605";position:absolute;left:0;font-size:11px;top:.35em}
.p-metrics{display:flex;flex-wrap:wrap;gap:8px 20px;justify-content:center;list-style:none;padding:0}
.p-metrics li{text-align:center;min-width:70px}
.p-metrics b{display:block;font:900 30px/.95 var(--f-cut)}
.p-metrics span{font:600 12.5px/1.2 var(--f-body)}
.p-tags{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;list-style:none;padding:0}
.p-tags li{border:2px solid currentColor;border-radius:999px;padding:3px 10px;font-weight:600;font-size:13px}
.p-link{align-self:center}
.p-credits{margin:2px 0 0;text-align:center;font:800 12px/1.2 var(--f-cut);letter-spacing:.24em;text-transform:uppercase;opacity:.85;border-top:2px solid currentColor;padding-top:10px}
.poster.mini .p-art{aspect-ratio:1/.5}
.p-year{font:900 clamp(56px,6vw,92px)/.9 var(--f-cut);text-align:center;background:var(--cream);color:var(--ink);border:4px solid var(--ink);border-radius:999px;padding:6px 26px;transform:rotate(-3deg)}
.p-star{width:46%;height:auto}
.wins-grid>.poster{flex-basis:250px;max-width:340px}

/* record */
.record-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:clamp(24px,4vw,56px);margin-top:34px;align-items:start}
.edu,.certs{list-style:none;margin:0;padding:0;display:grid;gap:12px;font-size:15.5px}
.edu b,.certs b{display:block}
.skill-group{margin-bottom:16px}
.skill-group h4{font:800 13px/1 var(--f-cut);letter-spacing:.16em;text-transform:uppercase;margin:0 0 8px;opacity:.85}
.skills{display:flex;flex-wrap:wrap;gap:8px}
.skills span{border:2.5px solid var(--ink);border-radius:999px;padding:6px 12px;font-weight:600;font-size:14.5px;background:rgba(244,236,220,.25)}

/* journey */
.journey{padding:0}
.journey .sticky{padding:calc(var(--frame) + 86px) 0 calc(var(--frame) + 40px)}
.based{padding:0 var(--pad)}
.sub{padding:0 var(--pad);font-weight:600;margin:14px 0 0}
.rail{position:relative;overflow-x:auto;padding:30px 0 40px;scroll-snap-type:x mandatory;scrollbar-width:none}
.rail::-webkit-scrollbar{display:none}
.train{display:flex;align-items:flex-end;gap:14px;padding:0 var(--pad);width:max-content}
.car{position:relative;width:340px;min-height:300px;background:var(--ink);border-radius:30px 30px 14px 14px;padding:22px 18px 40px;color:var(--cream);flex:none;scroll-snap-align:center;display:flex;flex-direction:column}
.car::before,.car::after{content:"";position:absolute;bottom:-22px;width:44px;height:44px;border-radius:50%;background:var(--ink);border:8px solid var(--teal)}
.car::before{left:42px}.car::after{right:42px}
.car .win{background:var(--cream);color:var(--ink);border-radius:18px;padding:16px 16px 14px;flex:1;display:flex;flex-direction:column;overflow:hidden}
.car .yr{font:900 32px/.95 var(--f-cut);text-transform:uppercase}
.car h3{font:800 22px/1.05 var(--f-cut);text-transform:uppercase;margin:8px 0 4px}
.car .org{font-weight:700;font-size:14px;margin:0 0 8px}
.car p{font-size:14.5px;line-height:1.38;margin:0 0 6px}
.car ul{margin:0;padding-left:18px;font-size:14px;line-height:1.35}
.car li{margin-bottom:3px}
.engine{width:250px;height:330px;flex:none;position:relative;scroll-snap-align:center}
.engine svg{width:100%;height:100%}
.track{height:8px;background:var(--ink);margin:18px 0 0;box-shadow:0 18px 0 -4px rgba(20,18,16,.5)}
.motion .journey{height:calc(100vh + var(--n,2)*55vh)}
.motion .journey .sticky{position:sticky;top:0;height:100vh;overflow:clip;display:grid;grid-template-rows:auto 1fr auto;align-content:start}

/* testimonials */
.quotes{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:clamp(18px,2.4vw,34px);margin-top:30px}
.bubble{background:var(--cream);color:var(--ink);border:3px solid var(--ink);border-radius:26px;padding:22px 22px 18px;position:relative;margin:0 0 26px;box-shadow:8px 8px 0 rgba(20,18,16,.6)}
.bubble::after{content:"";position:absolute;left:34px;bottom:-22px;width:30px;height:24px;background:var(--cream);border:3px solid var(--ink);border-top:0;border-left:0;transform:skewX(-35deg);clip-path:polygon(0 0,100% 0,100% 100%)}
.bubble blockquote{margin:0 0 14px;font-size:17px;font-weight:500}
.bubble figcaption b{display:block;font:900 20px/1 var(--f-cut);text-transform:uppercase}
.bubble figcaption span{font-size:14px}

/* extras */
.out-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:clamp(18px,2.4vw,34px);margin-top:30px;align-items:start}
.out{background:var(--cream);border:4px solid var(--ink);border-radius:20px;padding:20px;box-shadow:8px 8px 0 rgba(20,18,16,.85)}
.out h3{font:900 28px/1 var(--f-cut);text-transform:uppercase;margin:0 0 12px}
.out ul{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:8px}
.out li{border:2.5px solid var(--ink);border-radius:999px;padding:5px 12px;font-weight:600;font-size:14.5px}

/* contact */
.contact{display:grid;place-items:center;text-align:center;min-height:70vh}
.contact-in{max-width:880px;display:grid;justify-items:center}
.headshot{width:clamp(150px,14vw,210px);aspect-ratio:1;border-radius:50%;object-fit:cover;border:5px solid var(--ink);margin-bottom:22px}
.contact .cut{font-size:clamp(64px,10vw,170px)}
.contact-line{font-size:clamp(18px,1.5vw,22px);font-weight:500;margin:18px 0 26px;max-width:640px}
.links{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.links a,.links span{display:inline-block;font:900 clamp(22px,2vw,30px)/1 var(--f-cut);text-transform:uppercase;text-decoration:none;border:3px solid var(--ink);border-radius:999px;padding:14px 22px;background:var(--cream);overflow-wrap:anywhere}
.links a:hover,.links a:focus-visible{background:var(--ink);color:var(--cream)}
.rope{display:none;position:absolute;top:var(--frame);right:clamp(28px,7vw,120px);width:44px;height:clamp(220px,32vh,320px);padding:0;border:0;background:none;transform-origin:top center;animation:sway 3.6s ease-in-out infinite;cursor:pointer}
.js .rope{display:block}
.rope svg{width:100%;height:100%}
.rope.pulled{animation:none;transform:translateY(36px);transition:transform .25s}
@keyframes sway{0%,100%{transform:rotate(2deg)}50%{transform:rotate(-2deg)}}

/* the eye cursor */
.eye{position:fixed;left:0;top:0;z-index:75;pointer-events:none;width:0;height:0;opacity:0}
.eye.on{opacity:1}
.eye .ring{position:absolute;left:-48px;top:-48px;width:96px;height:96px;animation:spin 9s linear infinite;transition:opacity .25s,transform .35s}
.eye .ring text{font:800 11.5px var(--f-cut);letter-spacing:.2em;fill:var(--ink);text-transform:uppercase}
.eye.light .ring text{fill:var(--cream)}
@keyframes spin{to{transform:rotate(360deg)}}
.lens{position:absolute;left:0;top:0;width:44px;height:44px;border-radius:50%;transform:translate(-50%,-50%);background:var(--cream);border:3px solid var(--ink);overflow:hidden;transition:width .45s cubic-bezier(.5,1.6,.4,1),height .45s cubic-bezier(.5,1.6,.4,1),border-radius .45s,background .3s}
.ball{position:absolute;inset:0;display:grid;place-items:center;transition:opacity .2s,transform .3s}
.pupil{display:block;width:10px;height:28px;border-radius:6px;background:var(--ink);transform:translate(var(--px,0),var(--py,0));transition:width .3s cubic-bezier(.5,1.6,.4,1),height .3s cubic-bezier(.5,1.6,.4,1),border-radius .3s}
.lid{position:absolute;left:-2px;right:-2px;top:-2px;height:0;background:var(--ink);transition:height .09s ease-in}
.eye.blink .lid{height:110%}
.eye.wide .pupil{width:26px;height:26px;border-radius:50%}
.eye.wide .ring{transform:scale(1.12)}
.tile{position:absolute;inset:0;display:grid;place-items:center;opacity:0;transform:scale(.4);transition:opacity .25s,transform .45s cubic-bezier(.5,1.6,.4,1);text-align:center;padding:10px;font:900 30px/.9 var(--f-cut);text-transform:uppercase;overflow:hidden;overflow-wrap:anywhere}
.eye.morph .lens{width:138px;height:138px;border-radius:30px}
.eye.morph .ball{opacity:0;transform:scaleY(.1)}
.eye.morph .tile{opacity:1;transform:none;transition-delay:.12s}
.eye.morph .ring{opacity:0}
.tag{position:absolute;left:82px;top:-62px;width:240px;background:var(--ink);color:var(--cream);border-radius:20px;padding:14px 16px;opacity:0;transform:translateX(-14px) scale(.9);transform-origin:left center;transition:opacity .2s,transform .35s cubic-bezier(.5,1.6,.4,1)}
.eye.flip .tag{left:auto;right:82px;transform-origin:right center;transform:translateX(14px) scale(.9)}
.eye.morph .tag{opacity:1;transform:none;transition-delay:.15s}
.tag .nm{font:900 22px/1 var(--f-cut);text-transform:uppercase;margin-bottom:8px;overflow-wrap:anywhere}
.tag .dt{font:800 11px/1 var(--f-cut);letter-spacing:.18em;text-transform:uppercase;color:var(--gold)}
.tag .dd{font:900 26px/1 var(--f-cut);margin-top:2px}

@media (max-width:1100px){
  .hero-body,.hero-body.has-stats{grid-template-columns:1fr;justify-items:center}
  .hero-facts{grid-template-columns:repeat(auto-fit,minmax(110px,1fr));text-align:center;padding-bottom:0;width:100%;order:3}
  .hero-facts b{font-size:34px}
  .hero-left{text-align:center;padding-bottom:0}
  .hero-cta{justify-content:center}
  .who{width:min(380px,70%)}
}
@media (max-width:700px){
  :root{--frame:7px;--radius:14px;--pad:22px}
  body{font-size:16px}
  .js .menu-btn{display:block}
  .js .nav{display:none;position:fixed;top:calc(var(--frame) + 62px);right:calc(var(--frame) + 12px);left:calc(var(--frame) + 12px);background:var(--ink);border-radius:22px;padding:14px;flex-direction:column;gap:8px}
  .js .nav.open{display:flex}
  .nav{display:none}
  .nav a{font-size:19px;padding:14px 16px;text-align:center}
  .js .nav a{background:var(--cream)}
  .me,.menu-btn{font-size:14px;padding:9px 13px}
  .scene{padding:calc(var(--frame) + 78px) var(--pad) calc(var(--frame) + 56px)}
  .name{font-size:clamp(52px,16vw,74px);line-height:.95}
  .name span{display:block}
  .hero-body{margin-top:18px;gap:22px}
  .headline{font-size:26px}
  .hi .cut{font-size:19vw;white-space:normal;margin-bottom:28px;transform:none}
  .hi-grid{grid-template-columns:1fr}
  .hi .window{max-width:300px;justify-self:center;width:84%}
  .posters>.poster{flex-basis:100%;max-width:none}
  .poster{padding:20px 16px 18px}
  .dive-lines li{font-size:32px}
  .dive-lines li.long{font-size:24px}
  .motion .dive{height:240vh}
  .motion .journey{height:auto}
  .motion .journey .sticky{position:relative;height:auto;display:block}
  .based{font-size:46px}
  .car{width:78vw}
  .engine{display:none}
  .rope{right:16px;height:170px;width:34px}
  .links{flex-direction:column;align-items:stretch;width:100%}
}
@media (min-width:701px){.nav{display:flex}.js .menu-btn{display:none}.cue{display:block}.js .cue{display:block}}
@media (min-width:701px){.motion .journey .rail{overflow:visible;scroll-snap-type:none;align-self:end}.motion .train{transform:translateX(var(--tx,0));will-change:transform}}

@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  .grain{animation:none}
  .curtain,.eye,.rope{display:none!important}
  .ribbon-track{animation:none;width:auto;flex-wrap:wrap}
  .ribbon-set.dup{display:none}
  .ribbon-set{flex-wrap:wrap}
  *{transition:none!important}
}
`;

const JS = String.raw`
(function(){
  var d=document,root=d.documentElement;
  var reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine=matchMedia("(hover: hover) and (pointer: fine)").matches;
  var $=function(id){return d.getElementById(id)};
  if(!reduce)root.classList.add("motion");

  var menuBtn=$("menuBtn"),nav=$("nav");
  if(menuBtn&&nav){
    menuBtn.addEventListener("click",function(){var o=nav.classList.toggle("open");menuBtn.setAttribute("aria-expanded",String(o));menuBtn.textContent=o?"Close":"Menu"});
    nav.addEventListener("click",function(e){if(e.target.closest("a")){nav.classList.remove("open");menuBtn.setAttribute("aria-expanded","false");menuBtn.textContent="Menu"}});
  }

  var curtain=$("curtain");
  function openCurtain(){if(!curtain)return;curtain.classList.remove("gone");requestAnimationFrame(function(){curtain.classList.add("open")});setTimeout(function(){curtain.classList.add("gone")},1700)}
  if(curtain){if(reduce)curtain.classList.add("gone");else setTimeout(openCurtain,250)}

  var rope=$("rope");
  if(rope)rope.addEventListener("click",function(){
    rope.classList.add("pulled");setTimeout(function(){rope.classList.remove("pulled")},400);
    if(!curtain){scrollTo({top:0});return}
    curtain.classList.remove("gone","open");
    setTimeout(function(){scrollTo({top:0,behavior:"instant"});openCurtain()},1600);
  });

  /* hi word: letters thrown about */
  var hi=$("hiWord");
  if(hi){
    var rnd=function(i){return (Math.sin(i*91.7)+1)/2};
    var wi=0;
    hi.querySelectorAll(".w").forEach(function(w){
      var i=0;
      w.querySelectorAll(".ch").forEach(function(c){
        c.style.setProperty("--r",((rnd(i+wi*7)-.5)*12).toFixed(1)+"deg");
        c.style.setProperty("--y",((rnd(i*3+wi)-.5)*18).toFixed(0)+"px");
        i++;
      });
      wi++;
    });
  }

  /* the eye */
  if(!reduce&&fine){
    var eye=d.createElement("div");eye.className="eye";eye.setAttribute("aria-hidden","true");
    eye.innerHTML='<svg class="ring" viewBox="0 0 120 120"><defs><path id="ringPath" d="M60 60 m-47 0 a47 47 0 1 1 94 0 a47 47 0 1 1 -94 0"/></defs><text><textPath href="#ringPath" id="ringText"></textPath></text></svg><div class="lens"><div class="ball"><i class="pupil"></i><i class="lid"></i></div><div class="tile"></div></div><div class="tag"><div class="nm"></div><div class="dt"></div><div class="dd"></div></div>';
    d.body.appendChild(eye);
    root.classList.add("has-eye");
    var ringText=eye.querySelector("#ringText"),tile=eye.querySelector(".tile"),nm=eye.querySelector(".nm"),dt=eye.querySelector(".dt"),dd=eye.querySelector(".dd"),pupil=eye.querySelector(".pupil");
    var pos={x:innerWidth/2,y:innerHeight/2},target={x:pos.x,y:pos.y},ringNow="",lastBlink=0,seen=false,lastMove=0;
    var setRing=function(w){if(w===ringNow)return;ringNow=w;ringText.textContent=[w,w,w,w,w].join(" · ")+" ·"};
    setRing("Scroll");
    addEventListener("mousemove",function(e){target.x=e.clientX;target.y=e.clientY;lastMove=performance.now();if(!seen){seen=true;pos.x=target.x;pos.y=target.y;eye.classList.add("on")}});
    root.addEventListener("mouseleave",function(){eye.classList.remove("on");seen=false});
    d.addEventListener("mouseover",function(e){
      var t=e.target;if(!t||!t.closest)return;
      var m=t.closest("[data-eye]");
      eye.classList.toggle("light",!!t.closest(".dark-scene"));
      if(m){
        tile.textContent=m.getAttribute("data-eye")||"";
        nm.textContent=m.getAttribute("data-name")||"";
        dt.textContent=m.getAttribute("data-label")||"";
        dd.textContent=m.getAttribute("data-eye")||"";
        eye.classList.add("morph");eye.classList.remove("wide");return;
      }
      eye.classList.remove("morph");
      var l=t.closest("a,button");
      eye.classList.toggle("wide",!!l);
      setRing(l?"Open":"Scroll");
    });
    var tick=function(now){
      pos.x+=(target.x-pos.x)*.2;pos.y+=(target.y-pos.y)*.2;
      eye.style.transform="translate("+pos.x.toFixed(1)+"px,"+pos.y.toFixed(1)+"px)";
      eye.classList.toggle("flip",pos.x>innerWidth-330);
      var dx=Math.max(-8,Math.min(8,(target.x-pos.x)*.4)),dy=Math.max(-6,Math.min(6,(target.y-pos.y)*.3));
      pupil.style.setProperty("--px",dx.toFixed(1)+"px");pupil.style.setProperty("--py",dy.toFixed(1)+"px");
      if(now-lastBlink>3200&&now-lastMove>600){lastBlink=now;eye.classList.add("blink");setTimeout(function(){eye.classList.remove("blink")},140)}
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* scroll playhead */
  if(!reduce){
    var dive=$("dive"),rings=$("rings"),dEye=$("dEye"),lines=dive?[].slice.call(dive.querySelectorAll(".dive-lines li")):[];
    var about=$("about"),journey=$("journey"),train=$("train");
    var clamp=function(v){return Math.max(0,Math.min(1,v))};
    var ticking=false;
    var frame=function(){
      ticking=false;var vh=innerHeight,vw=innerWidth,r;
      if(dive&&rings){
        r=dive.getBoundingClientRect();var p=clamp(-r.top/Math.max(1,r.height-vh));
        rings.style.setProperty("--s",(1+p*p*5).toFixed(3));
        if(dEye)dEye.style.opacity=(1-p*4).toFixed(2);
        var n=lines.length,idx=p<.08?-1:Math.min(n-1,Math.floor((p-.08)/(.92/n)));
        lines.forEach(function(l,i){l.classList.toggle("on",i===idx)});
      }
      if(about&&hi&&vw>700){
        r=about.getBoundingClientRect();var q=clamp((vh-r.top)/(vh+r.height));
        hi.style.setProperty("--x",((.35-q*.9)*vw*.35).toFixed(1)+"px");
      }
      if(journey&&train&&vw>700){
        r=journey.getBoundingClientRect();var t=clamp(-r.top/Math.max(1,r.height-vh));
        var tw=train.scrollWidth;
        train.style.setProperty("--tx",((vw*.5)*(1-t)-Math.max(0,tw-vw*.9)*t).toFixed(1)+"px");
      }
    };
    addEventListener("scroll",function(){if(!ticking){ticking=true;requestAnimationFrame(frame)}},{passive:true});
    addEventListener("resize",frame);frame();
  }
})();
`;

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), 40)).trim();
}

function posterTags(tags: string[]): string {
  return tags.length ? `<ul class="p-tags">${tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "";
}

function spotSize(value: string): string {
  return value.length > 9 ? " s" : value.length > 5 ? " m" : "";
}

function projectPoster(facts: PortfolioFacts, p: PortfolioFacts["projects"][number], i: number): string {
  const [bg, fg] = PROJECT_COLOURS[i % PROJECT_COLOURS.length] as Pair;
  const first = p.metrics[0];
  const rest = p.metrics.slice(1);
  const spot = first
    ? `<div class="spot"><b class="${spotSize(first.value).trim()}">${esc(first.value)}</b><small>${esc(first.label)}</small></div>`
    : `<div class="spot"><b>${esc(initials(p.name))}</b></div>`;
  const href = safeHref(p.link);
  const top = p.role || p.period ? `<div class="p-top"><span>${esc(p.role)}</span><span>${esc(p.period)}</span></div>` : "";
  const eyeVal = first ? first.value : initials(p.name);
  return `<article class="poster" style="--c:${bg};--t:${fg};--rot:${TILTS[i % TILTS.length]}" data-eye="${attr(eyeVal)}" data-name="${attr(p.name)}" data-label="${attr(first ? first.label : "Project")}">
  ${top}
  <div class="p-art">${spot}</div>
  <h3 class="p-title">${esc(p.name)}</h3>
  ${p.description ? `<p class="p-desc">${esc(p.description)}</p>` : ""}
  ${rest.length ? `<ul class="p-metrics">${rest.map((m) => `<li><b>${esc(m.value)}</b><span>${esc(m.label)}</span></li>`).join("")}</ul>` : ""}
  ${p.bullets.length ? `<ul class="p-bullets">${p.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}
  ${posterTags(p.tags)}
  ${href ? `<a class="pill p-link" href="${attr(href)}" rel="noopener noreferrer" target="_blank">View project</a>` : ""}
  <p class="p-credits">Starring ${esc(facts.name)}</p>
</article>`;
}

function winPoster(a: PortfolioFacts["achievements"][number], i: number): string {
  const [bg, fg] = WIN_COLOURS[i % WIN_COLOURS.length] as Pair;
  const art = a.year
    ? `<div class="p-year">${esc(a.year)}</div>`
    : `<svg class="p-star" viewBox="0 0 120 120" role="presentation" focusable="false"><polygon points="${starPoints(60, 62, 52, 22)}" fill="#d9a441" stroke="#141210" stroke-width="6" stroke-linejoin="round"/></svg>`;
  return `<article class="poster mini" style="--c:${bg};--t:${fg};--rot:${TILTS[(i + 1) % TILTS.length]}" data-eye="${attr(a.year ?? "Win")}" data-name="${attr(a.title)}" data-label="Win">
  <div class="p-art">${art}</div>
  <h3 class="p-title">${esc(a.title)}</h3>
  ${a.detail ? `<p class="p-desc">${esc(a.detail)}</p>` : ""}
</article>`;
}

function renderRecord(facts: PortfolioFacts, keys: SectionKey[], id: string): string {
  const cols = keys.map((k) => {
    if (k === "skills") {
      const groups = facts.skills.map((g) => `<div class="skill-group">${g.group ? `<h4>${esc(g.group)}</h4>` : ""}<div class="skills">${g.items.map((s) => `<span>${esc(s)}</span>`).join("")}</div></div>`).join("");
      return `<div><h3 class="lbl">Skills</h3>${groups}</div>`;
    }
    if (k === "education") {
      const items = facts.education.map((e) => `<li><b>${esc(e.degree ?? e.school)}</b>${e.degree ? esc(e.school) : ""}${e.period ? `, ${esc(e.period)}` : ""}${e.detail ? `. ${esc(e.detail)}` : ""}</li>`).join("");
      return `<div><h3 class="lbl">Education</h3><ul class="edu">${items}</ul></div>`;
    }
    const items = facts.certifications.map((c) => `<li><b>${esc(c.name)}</b>${[c.issuer, c.year].filter(Boolean).map((v) => esc(v)).join(", ")}</li>`).join("");
    return `<div><h3 class="lbl">Certifications</h3><ul class="certs">${items}</ul></div>`;
  });
  return `<section class="scene record" id="${id}" style="--bg:var(--cobalt)"><h2 class="cut small-cut">The record</h2><div class="record-grid">${cols.join("")}</div></section>`;
}

function render({ facts, custom }: RenderInput): string {
  const accent = accentColour(custom, DEFAULT_ACCENT, INK);
  const fo = fontOverride(custom);
  const fName = fo ? fo.stack : "'Poiret One', Georgia, serif";
  const fCut = fo ? fo.stack : "'Big Shoulders Display', Impact, sans-serif";
  const fBody = fo ? fo.stack : "'Bricolage Grotesque', system-ui, sans-serif";
  const fontsHref = googleFontsHref(fo ? [fo.family] : FONTS);

  const visible = visibleSections(facts, custom, SECTIONS);
  const recordKeys: SectionKey[] = visible.filter((k) => k === "skills" || k === "education" || k === "certifications");
  const first = facts.name.split(/\s+/)[0] ?? facts.name;

  // Nav entries and scene order: record group is one scene at the position of its first member.
  const order: Array<SectionKey | "record"> = [];
  for (const k of visible) {
    if (recordKeys.includes(k)) {
      if (!order.includes("record")) order.push("record");
    } else order.push(k);
  }
  const navItems = order.map((k) => `<a href="#${SECTION_ID[k]}">${NAV_LABEL[k]}</a>`).join("");
  const firstTarget = order[0] ? `#${SECTION_ID[order[0]]}` : "";

  // Dive lines: tagline (when about is not already showing it).
  const showsTaglineInAbout = visible.includes("about") && !facts.summary;
  const diveLines: Array<{ text: string; small?: string; long: boolean }> = [];
  if (facts.tagline && !showsTaglineInAbout) diveLines.push({ text: facts.tagline, long: facts.tagline.length > 60 });
  const dive = diveLines.length
    ? `<section class="scene dive dark-scene" id="dive" style="--bg:var(--plum)" aria-label="Highlights"><div class="sticky">${ringsSvg()}<ol class="dive-lines">${diveLines
        .map((l) => `<li${l.long ? ' class="long"' : ""}>${esc(l.text)}${l.small ? `<small>${esc(l.small)}</small>` : ""}</li>`)
        .join("")}</ol></div></section>`
    : "";

  // Hero.
  const headline = facts.headline ?? facts.experience[0]?.role;
  const ribbonItems: string[] = [];
  const seen = new Set<string>();
  const addRibbon = (t: string | undefined) => {
    if (!t) return;
    const k = t.toLowerCase();
    if (seen.has(k) || ribbonItems.length >= 10) return;
    seen.add(k);
    ribbonItems.push(t);
  };
  addRibbon(facts.headline);
  facts.experience.forEach((e) => addRibbon(e.role));
  facts.skills.forEach((g) => g.items.slice(0, 4).forEach((s) => addRibbon(s)));
  const ribbonSet = ribbonItems.map((t) => `<span>${esc(t)}</span>`).join("");
  const ribbon = ribbonItems.length ? `<div class="ribbon" aria-hidden="true"><div class="ribbon-track"><div class="ribbon-set">${ribbonSet}</div><div class="ribbon-set dup">${ribbonSet}</div></div></div>` : "";
  const mail = safeHref(facts.email ? `mailto:${facts.email}` : undefined);
  const cta = [
    firstTarget ? `<a class="pill" href="${attr(firstTarget)}">See the work</a>` : "",
    mail && visible.includes("contact") ? `<a class="pill ghost" href="${attr(mail)}">Email me</a>` : "",
  ].join("");
  const heroLeft = `<div class="hero-left">${headline ? `<p class="headline">${esc(headline)}</p>` : ""}${facts.location ? `<p class="avail">${esc(facts.location)}</p>` : ""}${cta ? `<p class="hero-cta">${cta}</p>` : ""}</div>`;
  const hero = `<section class="scene hero" id="hero">
  <p class="kicker">Now showing</p>
  <h1 class="name">${facts.name.split(/\s+/).map((w) => `<span>${esc(w)}</span>`).join(" ")}</h1>
  <div class="hero-body${facts.stats.length ? " has-stats" : ""}">${heroLeft}<figure class="who" aria-hidden="true">${STAR_ART}</figure>${facts.stats.length ? `<ul class="hero-facts">${facts.stats.slice(0, 3).map((x) => `<li><b>${esc(x.value)}</b><span>${esc(x.label)}</span></li>`).join("")}</ul>` : ""}</div>
  ${ribbon}
</section>`;

  const parts: string[] = [];
  for (const k of order) {
    switch (k) {
      case "about": {
        const photo = photoTag(facts, { alt: facts.name });
        const text = facts.summary ?? facts.tagline ?? "";
        parts.push(`<section class="scene hi" id="about" style="--bg:var(--violet)">
  <h2 class="cut" id="hiWord" aria-label="Hi, I'm ${attr(first)}">${["Hi,", "I'm", first].map((w) => `<span class="w" aria-hidden="true">${[...w].map((ch) => `<span class="ch">${esc(ch)}</span>`).join("")}</span>`).join(" ")}</h2>
  <div class="hi-grid${photo ? "" : " solo"}">${photo ? `<figure class="window tilt-l">${photo}</figure>` : ""}<div class="hi-text"><p class="lede">${esc(text)}</p></div></div>
</section>`);
        break;
      }
      case "projects":
        parts.push(`<section class="scene deals" id="projects" style="--bg:var(--grass)"><div class="head"><h2 class="cut small-cut">Now showing</h2></div><div class="posters">${facts.projects.map((p, i) => projectPoster(facts, p, i)).join("")}</div></section>`);
        break;
      case "record":
        parts.push(renderRecord(facts, recordKeys, "record"));
        break;
      case "experience": {
        const cars = facts.experience
          .map((e) => {
            const meta = [e.org, e.location].filter(Boolean).map((v) => esc(v)).join(" · ");
            return `<article class="car"><div class="win">${e.period ? `<span class="yr">${esc(e.period)}</span>` : ""}<h3>${esc(e.role)}</h3><p class="org">${meta}</p>${e.summary ? `<p>${esc(e.summary)}</p>` : ""}${e.bullets.length ? `<ul>${e.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}</div></article>`;
          })
          .join("");
        parts.push(`<section class="scene journey" id="journey" style="--bg:var(--teal);--n:${Math.max(2, facts.experience.length)}"><div class="sticky"><div class="jh"><h2 class="cut small-cut based">The journey</h2>${facts.location ? `<p class="sub">Now in ${esc(facts.location)}</p>` : ""}</div><div class="rail"><div class="train" id="train">${ENGINE}${cars}</div></div><div class="track" aria-hidden="true"></div></div></section>`);
        break;
      }
      case "achievements":
        parts.push(`<section class="scene wins" id="wins" style="--bg:var(--orange)"><h2 class="cut small-cut">Wins</h2><div class="posters wins-grid">${facts.achievements.map((a, i) => winPoster(a, i)).join("")}</div></section>`);
        break;
      case "testimonials":
        parts.push(`<section class="scene voices dark-scene" id="voices" style="--bg:var(--plum)"><h2 class="cut small-cut">What people say</h2><div class="quotes">${facts.testimonials
          .map((t) => `<figure class="bubble"><blockquote>${esc(t.quote)}</blockquote><figcaption><b>${esc(t.author)}</b>${t.role ? `<span>${esc(t.role)}</span>` : ""}</figcaption></figure>`)
          .join("")}</div></section>`);
        break;
      case "extras":
        parts.push(`<section class="scene outside" id="outside" style="--bg:var(--pink)"><h2 class="cut small-cut">After hours</h2><div class="out-grid">${facts.extras
          .map((x) => `<div class="out"><h3>${esc(x.label)}</h3><ul>${x.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>`)
          .join("")}</div></section>`);
        break;
      case "contact": {
        const items: string[] = [];
        if (facts.email) items.push(`<li><a href="${attr(`mailto:${facts.email}`)}">${esc(facts.email)}</a></li>`);
        if (facts.phone) {
          const tel = safeHref(`tel:${facts.phone.replace(/[^\d+]/g, "")}`);
          items.push(`<li>${tel ? `<a href="${attr(tel)}">${esc(facts.phone)}</a>` : `<span>${esc(facts.phone)}</span>`}</li>`);
        }
        for (const l of facts.links) {
          const href = safeHref(l.url);
          items.push(`<li>${href ? `<a href="${attr(href)}" rel="noopener noreferrer" target="_blank">${esc(l.label)}</a>` : `<span>${esc(l.label)}</span>`}</li>`);
        }
        const photo = photoTag(facts, { alt: facts.name, className: "headshot" });
        parts.push(`<section class="scene contact" id="contact" style="--bg:var(--gold)">
  <button class="rope" id="rope" type="button" aria-label="Pull the rope: close the curtain and go back to the start">${ROPE}</button>
  <div class="contact-in">${photo}<h2 class="cut">Get in touch</h2>${facts.location ? `<p class="contact-line">${esc(facts.location)}</p>` : ""}<ul class="links">${items.join("")}</ul></div>
</section>`);
        break;
      }
      default:
        break;
    }
  }

  const title = facts.headline ? `${facts.name} · ${facts.headline}` : facts.name;
  const description = clip(facts.tagline ?? facts.summary ?? facts.headline ?? facts.name, 160);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${attr(description)}">
<link rel="stylesheet" href="${attr(fontsHref)}">
${scriptTag('document.documentElement.classList.add("js");')}
<style>:root{--accent:${accent};--f-name:${fName};--f-cut:${fCut};--f-body:${fBody}}${CSS}</style>
</head>
<body>
${firstTarget ? `<a class="skip" href="${attr(firstTarget)}">Skip to the content</a>` : ""}
<div class="frame" aria-hidden="true"></div>
<div class="grain" aria-hidden="true"></div>
<div class="curtain" id="curtain" aria-hidden="true"><div class="drape l"></div><div class="drape r"></div>${VALANCE}</div>
<header class="bar" id="bar">
  <a class="me" href="#top">${esc(facts.name)}</a>
  ${navItems ? `<nav class="nav" id="nav" aria-label="Sections">${navItems}</nav><button class="menu-btn" id="menuBtn" type="button" aria-expanded="false" aria-controls="nav">Menu</button>` : ""}
</header>
<main id="top">
${hero}
${dive}
${parts.join("\n")}
</main>
${scriptTag(JS)}
</body>
</html>`;
}

const template: ThemeTemplate = { id: "deal-stage", sections: SECTIONS, defaultAccent: DEFAULT_ACCENT, render };
export default template;
