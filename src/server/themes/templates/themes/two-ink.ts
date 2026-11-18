import type { PortfolioFacts, SectionKey } from "../../facts";
import { accentColour, attr, esc, fontOverride, googleFontsHref, initials, photoTag, safeHref, scriptTag, visibleSections } from "../helpers";
import type { RenderInput, ThemeTemplate } from "../types";

// Poster Pop: a two-ink risograph print. Cream paper, magenta (the accent) and orange inks that multiply where they overlap,
// a hero name printed off-register that follows the pointer, draggable stickers, a proof-sheet project rail.
const PAPER = "#f6f1e7";
const INK = "#1a0f14";
const ORANGE = "#ff7a1a";
const DEFAULT_ACCENT = "#e2007a";
const SECTIONS: SectionKey[] = ["about", "projects", "experience", "achievements", "skills", "education", "certifications", "testimonials", "extras", "contact"];
const NAV_LABEL: Partial<Record<SectionKey, string>> = {
  about: "About", projects: "Work", experience: "Experience", achievements: "Wins", skills: "Skills", education: "Education",
  certifications: "Certificates", testimonials: "Kind words", extras: "Outside", contact: "Contact",
};

const CSS = `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--paper);color:var(--ink);font:400 17px/1.5 var(--f-body);overflow-x:hidden}
body::before{content:"";position:fixed;inset:-50%;z-index:60;pointer-events:none;opacity:.09;mix-blend-mode:multiply;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1.4 -.3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");animation:grain 1.2s steps(6) infinite}
@keyframes grain{0%{transform:translate(0,0)}20%{transform:translate(-3%,2%)}40%{transform:translate(2%,-3%)}60%{transform:translate(-2%,-1%)}80%{transform:translate(3%,3%)}100%{transform:translate(0,0)}}
a{color:inherit}
img{max-width:100%;display:block}
.mono{font:400 12px/1.4 var(--f-mono);text-transform:uppercase;letter-spacing:.06em}
.skip{position:absolute;left:-999px;top:8px;background:var(--ink);color:var(--paper);padding:8px 12px;z-index:100}.skip:focus{left:8px}
.mis{position:relative;display:inline-block;isolation:isolate}
.mis::before{content:attr(data-mis);position:absolute;inset:0;color:var(--b);transform:translate(calc(var(--mx) * 1.6 + 2px),calc(var(--my) * 1.6 + 1px));mix-blend-mode:multiply;z-index:-1;pointer-events:none;white-space:nowrap}
.kicker{display:inline-flex;margin:0 0 14px;border:2px solid var(--ink);border-radius:3px;padding:4px 12px;background:var(--paper)}
.h2{font:400 clamp(44px,8vw,120px)/.88 var(--f-display);text-transform:uppercase;letter-spacing:-.01em;margin:0;text-shadow:calc(var(--mx) * 2 + 3px) calc(var(--my) * 2 + 2px) 0 var(--b);overflow-wrap:anywhere}
.sec-head{padding:0 var(--gut);margin-bottom:clamp(26px,5vw,60px)}
.btn{display:inline-flex;align-items:center;gap:10px;border:var(--line);border-radius:3px;padding:10px 20px;font:600 15px/1 var(--f-body);text-decoration:none;background:var(--paper);color:var(--ink);box-shadow:3px 3px 0 var(--ink);transition:box-shadow .15s,translate .15s}
.btn:hover{box-shadow:6px 6px 0 var(--b)}
.btn:active{translate:3px 3px;box-shadow:1px 1px 0 var(--ink)}
.btn-ink{background:var(--a);color:var(--paper)}
.btn-big{font-size:clamp(18px,1.8vw,22px);padding:18px 30px}
.nav{position:fixed;z-index:50;top:14px;left:var(--gut);right:var(--gut);display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 10px 8px 20px;border:var(--line);border-radius:6px;background:color-mix(in srgb,var(--paper) 88%,transparent);backdrop-filter:blur(8px);box-shadow:5px 5px 0 var(--a)}
.nav-logo{font:400 22px/1 var(--f-display);text-decoration:none;letter-spacing:.02em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.nav-links{display:flex;gap:20px;font:600 14px/1 var(--f-body);flex-wrap:wrap;justify-content:center}
.nav-links a{text-decoration:none;padding:6px 0;background:linear-gradient(var(--b),var(--b)) 0 100%/0 3px no-repeat;transition:background-size .3s var(--ease)}
.nav-links a:hover{background-size:100% 3px}
.nav-cta{padding:9px 16px;box-shadow:none;white-space:nowrap}

.hero{position:relative;min-height:100svh;padding:150px var(--gut) 90px;overflow:hidden;isolation:isolate;display:flex;flex-direction:column;justify-content:center;touch-action:pan-y}
.hero-wash{position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(circle at 82% 28%,color-mix(in srgb,var(--b) 30%,transparent) 0 18%,transparent 18.4%),radial-gradient(circle at 70% 36%,color-mix(in srgb,var(--a) 22%,transparent) 0 20%,transparent 20.4%),radial-gradient(circle,rgba(26,15,20,.10) 1.3px,transparent 1.8px) 0 0/9px 9px;mix-blend-mode:multiply;transform:translate(calc(var(--mx) * -2),calc(var(--my) * -2))}
.hero-hud{position:absolute;left:var(--gut);right:var(--gut);top:92px;display:flex;justify-content:space-between;gap:12px;pointer-events:none;flex-wrap:wrap}
.hero-hud span{border:2px solid var(--ink);border-radius:3px;background:var(--paper);padding:4px 10px;display:inline-flex;gap:8px;align-items:center}
.reg-mark{width:16px;height:16px;fill:none;stroke:var(--a);stroke-width:2.2}
.hero-main{display:flex;gap:clamp(20px,4vw,60px);align-items:center;justify-content:space-between;flex-wrap:wrap}
.hero-copy{flex:1 1 440px;min-width:0}
.eyebrow{margin:0 0 14px}.eyebrow span{display:inline-block;background:var(--ink);color:var(--paper);border-radius:3px;padding:5px 12px}
.headline{margin:0;font:400 clamp(60px,13.5vw,214px)/.84 var(--f-display);text-transform:uppercase;letter-spacing:-.01em;color:var(--a)}
.headline .mis{display:block;width:max-content;max-width:100%}
.headline .mis::before{white-space:normal;overflow-wrap:anywhere}
.tagline{display:inline-block;margin:26px 0 0;max-width:34ch;font:italic 500 clamp(22px,2.6vw,36px)/1.15 var(--f-serif);background:var(--paper);border:2px solid var(--ink);border-radius:6px;padding:8px 14px;box-shadow:4px 4px 0 var(--b);transform:rotate(-1deg)}
.hero-links{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
.portrait{position:relative;flex:0 1 min(34vw,380px);width:min(80vw,380px);aspect-ratio:4/5;border:3px solid var(--ink);border-radius:18px;overflow:hidden;box-shadow:9px 9px 0 var(--ink);transform:rotate(2deg);background:var(--paper);isolation:isolate;margin:0 auto}
.portrait img{width:100%;height:100%;object-fit:cover;filter:grayscale(1) contrast(1.35)}
.portrait::before,.portrait::after{content:"";position:absolute;inset:0;z-index:2;pointer-events:none;mix-blend-mode:multiply}
.portrait::before{background:var(--a);opacity:.38;transform:translate(calc(var(--mx) * .6),calc(var(--my) * .6))}
.portrait::after{background:var(--b);opacity:.4;clip-path:polygon(0 0,100% 0,100% 55%,0 80%);transform:translate(calc(var(--mx) * -.8),calc(var(--my) * -.8))}
.stickers{position:absolute;inset:0;z-index:5;pointer-events:none}
.sticker{position:absolute;display:grid;place-content:center;text-align:center;padding:12px;width:clamp(96px,8.6vw,128px);aspect-ratio:1;border-radius:50%;border:3px solid var(--ink);box-shadow:5px 6px 0 rgba(26,15,20,.85);pointer-events:auto;cursor:grab;touch-action:none;user-select:none;background:var(--b);transition:box-shadow .2s}
.sticker.held{cursor:grabbing;box-shadow:0 0 0 5px #fff,12px 18px 0 5px rgba(0,0,0,.16)}
.sticker b{font:400 clamp(22px,2.4vw,34px)/.95 var(--f-display);overflow-wrap:anywhere}
.sticker small{font:600 11px/1.15 var(--f-body);margin-top:3px}
.sticker.s1{background:var(--a);color:var(--paper)}.sticker.s2{background:var(--paper)}
.hero-foot{position:absolute;left:var(--gut);right:var(--gut);bottom:16px;display:flex;justify-content:space-between;gap:12px;pointer-events:none;flex-wrap:wrap}
.hero-foot span{background:var(--paper);padding:3px 8px;border-radius:4px}

.marquee{border-block:var(--line);background:var(--ink);color:var(--paper);padding:10px 0;overflow:hidden}
.mq-row{overflow:hidden;white-space:nowrap;display:flex}
.mq-track{display:inline-flex;align-items:center;gap:26px;padding-right:26px;flex:none;animation:roll 38s linear infinite}
.mq-row:hover .mq-track{animation-play-state:paused}
.mq-item{font:400 clamp(30px,5vw,68px)/1.05 var(--f-display);text-transform:uppercase}
.mq-item:nth-child(4n+1){color:var(--b)}
.mq-star{color:var(--a);font-size:clamp(22px,3vw,40px);font-style:normal}
.mq-rev{background:var(--b);color:var(--ink);margin-top:8px}
.mq-rev .mq-track{animation-direction:reverse;animation-duration:46s}
.mq-rev .mq-item{font-size:clamp(20px,2.8vw,36px);color:var(--ink)}
.mq-rev .mq-star{color:var(--ink);font-size:14px}
@keyframes roll{to{transform:translateX(-100%)}}

.pitch{padding:clamp(70px,11vw,150px) var(--gut)}
.pitch-text{font:500 clamp(26px,4vw,60px)/1.1 var(--f-body);letter-spacing:-.02em;margin:0;max-width:1180px}
.js .pitch-text .w{opacity:.2;transition:opacity .25s}
.js .pitch-text .w.lit{opacity:1}
.pitch-meta{margin:30px 0 0;display:flex;gap:10px;flex-wrap:wrap}
.pitch-meta span{border:2px solid var(--ink);padding:4px 12px;border-radius:3px;background:color-mix(in srgb,var(--b) 40%,var(--paper))}

.reel{padding:clamp(60px,9vw,120px) 0;overflow:hidden}
.reel-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;padding:0 var(--gut);margin-bottom:28px;flex-wrap:wrap}
.reel-nav{display:flex;gap:10px}
.reel-nav button{font:400 26px/1 var(--f-display);width:48px;height:48px;border:var(--line);border-radius:50%;background:var(--paper);color:var(--ink);cursor:pointer;box-shadow:3px 3px 0 var(--ink)}
.reel-nav button:hover{background:var(--b)}
.reel-track{display:flex;gap:28px;padding:20px var(--gut) 34px;overflow-x:auto;scroll-snap-type:x proximity;scrollbar-width:none;counter-reset:post;cursor:grab}
.reel-track::-webkit-scrollbar{display:none}
.reel-track.drag{cursor:grabbing;scroll-snap-type:none}
.post{counter-increment:post;flex:0 0 min(78vw,300px);scroll-snap-align:start;position:relative;border:3px solid var(--ink);border-radius:30px;background:var(--paper);padding:20px 12px 16px;box-shadow:9px 9px 0 var(--b);transition:transform .35s var(--ease),box-shadow .35s var(--ease);display:flex;flex-direction:column}
.post:nth-child(even){transform:translateY(24px)}
.post:hover{transform:translateY(-6px) rotate(-1deg);box-shadow:13px 13px 0 var(--a)}
.post::before{content:"";width:70px;height:8px;border-radius:6px;background:var(--ink);margin:-8px auto 12px}
.post-top{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.avatar{flex:none;width:34px;height:34px;border-radius:50%;background:var(--a);color:var(--paper);border:2px solid var(--ink);display:grid;place-items:center;font:400 14px/1 var(--f-display)}
.post-who{min-width:0;flex:1;font:700 13px/1.2 var(--f-body)}.post-who small{display:block;font:400 11px/1.2 var(--f-body);opacity:.7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.post-tag{font:400 10px/1 var(--f-mono);text-transform:uppercase;border:1.5px solid var(--ink);border-radius:3px;padding:3px 6px;white-space:nowrap}
.poster{position:relative;aspect-ratio:1;border:2.5px solid var(--ink);border-radius:12px;overflow:hidden;display:grid;place-content:center;text-align:center;background:var(--b);padding:12px}
.poster::after{content:"";position:absolute;inset:0;background:radial-gradient(circle,rgba(0,0,0,.18) 30%,transparent 32%) 0 0/7px 7px;mix-blend-mode:multiply;pointer-events:none}
.poster b{font:400 clamp(46px,5vw,72px)/.95 var(--f-display);color:var(--a);text-shadow:calc(var(--mx) * 2 + 5px) 4px 0 var(--paper);overflow-wrap:anywhere;text-transform:uppercase;position:relative;z-index:1}
.poster.word b{font-size:clamp(34px,4vw,52px)}
.poster span{font:700 18px/1.1 var(--f-body);position:relative;z-index:1;margin-top:6px}
.poster::before{content:counter(post,decimal-leading-zero);position:absolute;top:8px;right:8px;z-index:2;background:var(--ink);color:var(--paper);font:400 11px/1 var(--f-mono);padding:4px 6px;border-radius:4px}
.post-icons{display:flex;gap:12px;margin:10px 0 4px}
.post-icons svg{width:22px;height:22px;fill:none;stroke:var(--ink);stroke-width:2}
.post-icons svg:first-child{fill:var(--a);stroke:var(--ink)}
.post h3{margin:6px 0 4px;font:700 17px/1.2 var(--f-body)}
.post p{margin:0 0 8px;font-size:14.5px}
.post ul{margin:0 0 8px;padding-left:18px;font-size:14px}
.post-tags{margin-top:auto;color:var(--a);font:700 13px/1.4 var(--f-body)}
.post .btn{margin-top:12px;align-self:flex-start;padding:9px 14px;font-size:14px}
.reel-progress{position:relative;height:5px;margin:0 var(--gut);background:color-mix(in srgb,var(--ink) 15%,transparent)}
.reel-progress i{position:absolute;left:0;top:0;bottom:0;width:20%;background:var(--a)}

.cv{padding:clamp(60px,9vw,120px) 0;background:var(--ink);color:var(--paper);border-block:var(--line)}
.cv .h2{color:var(--paper);text-shadow:calc(var(--mx) * 2 + 3px) calc(var(--my) * 2 + 2px) 0 var(--a)}
.cv .kicker{background:transparent;border-color:var(--paper)}
.cv-list{padding:0 var(--gut);display:grid;gap:0}
.row{display:grid;grid-template-columns:minmax(120px,200px) 1fr;gap:clamp(14px,3vw,40px);padding:24px 0;border-top:1px solid color-mix(in srgb,var(--paper) 28%,transparent);transition:padding-left .3s var(--ease)}
.row:hover{padding-left:12px}
.row .mono{opacity:.75;margin:4px 0 0}
.row h3{margin:0 0 4px;font:400 clamp(26px,3.2vw,44px)/1 var(--f-display);text-transform:uppercase;color:var(--b)}
.row h3 em{font:italic 500 .55em var(--f-serif);text-transform:none;color:var(--paper);margin-left:8px}
.row p{margin:6px 0;max-width:70ch;opacity:.92}
.row ul{margin:8px 0 0;padding-left:20px;max-width:70ch}.row li{margin:0 0 5px;opacity:.92}

.wins{padding:clamp(60px,9vw,120px) 0;overflow:hidden}
.win-row{display:flex;flex-wrap:wrap;gap:clamp(20px,3vw,40px);padding:10px var(--gut) 30px}
.poster-w{flex:1 1 220px;max-width:340px;margin:0;background:var(--paper);border:3px solid var(--ink);border-radius:10px;padding:10px;box-shadow:6px 6px 0 var(--ink);transition:transform .35s var(--ease)}
.poster-w:nth-child(3n+1){transform:rotate(-2deg)}.poster-w:nth-child(3n+2){transform:rotate(1.5deg) translateY(10px)}.poster-w:nth-child(3n){transform:rotate(-.6deg)}
.poster-w:hover{transform:rotate(0) translateY(-6px)}
.riso{position:relative;aspect-ratio:5/3;border-radius:4px;overflow:hidden;background:var(--b);isolation:isolate}
.riso::before{content:"";position:absolute;inset:0;background:var(--a);mix-blend-mode:multiply;clip-path:circle(46% at 70% 40%)}
.riso::after{content:"";position:absolute;inset:0;background:radial-gradient(circle,rgba(0,0,0,.2) 30%,transparent 32%) 0 0/7px 7px;mix-blend-mode:multiply}
.poster-w figcaption{padding:10px 2px 2px}
.poster-w b{display:block;font:400 26px/1 var(--f-display);text-transform:uppercase;color:var(--a);overflow-wrap:anywhere}
.poster-w span{font-size:14px;display:block;margin-top:4px}

.skills{padding:clamp(60px,9vw,120px) 0;border-top:var(--line)}
.skill-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:22px;padding:0 var(--gut)}
.skill-col{border:var(--line);border-radius:18px;padding:18px;background:var(--paper);box-shadow:5px 5px 0 var(--b)}
.skill-col:nth-child(even){box-shadow:5px 5px 0 var(--a)}
.skill-col h3{font:400 32px/1 var(--f-display);text-transform:uppercase;margin:0 0 12px;color:var(--a)}
.skill-col ul{list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:8px}
.skill-col li{border:1.5px solid var(--ink);border-radius:3px;padding:4px 11px;font-size:14px;transition:transform .2s var(--ease),box-shadow .2s}
.skill-col li:hover{transform:translate(-2px,-2px);box-shadow:3px 3px 0 var(--b)}

.school{padding:clamp(60px,9vw,120px) var(--gut);background:color-mix(in srgb,var(--b) 16%,var(--paper));border-block:var(--line)}
.school-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:22px}
.card{border:var(--line);border-radius:12px;padding:18px;background:var(--paper);box-shadow:5px 5px 0 var(--ink)}
.card h3{margin:0 0 4px;font:400 28px/1 var(--f-display);text-transform:uppercase;color:var(--a);overflow-wrap:anywhere}
.card p{margin:4px 0}.card .mono{opacity:.7}

.notes{padding:clamp(60px,9vw,120px) 0}
.note-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:clamp(20px,3vw,40px);padding:0 var(--gut)}
.note{margin:0;padding:30px 22px 24px;background:color-mix(in srgb,var(--b) 40%,#fff);color:var(--ink);transform:rotate(-1.4deg);box-shadow:5px 6px 0 rgba(26,15,20,.18);position:relative}
.note:nth-child(even){transform:rotate(1.2deg);background:color-mix(in srgb,var(--a) 16%,#fff)}
.note::before{content:"";position:absolute;top:-10px;left:50%;width:100px;height:22px;margin-left:-50px;background:color-mix(in srgb,var(--paper) 65%,transparent);border:1px dashed rgba(0,0,0,.25);transform:rotate(-4deg)}
.note blockquote{margin:0;font:italic 500 clamp(21px,2vw,26px)/1.25 var(--f-serif)}
.note figcaption{margin-top:16px;font-size:14px;display:grid}.note figcaption b{font-size:16px}

.outside{padding:clamp(60px,9vw,120px) 0;background:color-mix(in srgb,var(--a) 12%,var(--paper));border-block:var(--line)}
.flip-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:clamp(18px,3vw,36px);padding:0 var(--gut)}
.flip{border:3px solid var(--ink);border-radius:16px;box-shadow:7px 7px 0 var(--ink);background:var(--paper);overflow:hidden;transition:transform .3s var(--ease)}
.flip:nth-child(odd){transform:rotate(-1deg)}.flip:nth-child(even){transform:rotate(1deg)}
.flip:hover{transform:rotate(0) translateY(-4px)}
.flip .riso{aspect-ratio:7/2;border-radius:0;border-bottom:3px solid var(--ink)}
.flip h3{margin:0;padding:14px 16px 4px;font:400 30px/1 var(--f-display);text-transform:uppercase;color:var(--a)}
.flip ul{list-style:none;margin:0;padding:6px 16px 18px;display:flex;flex-wrap:wrap;gap:8px}
.flip li{border:1.5px solid var(--ink);border-radius:3px;padding:3px 10px;font-size:14px}

.contact{padding:clamp(80px,11vw,150px) var(--gut) 40px;background:var(--ink);color:var(--paper);text-align:center;overflow:hidden}
.contact .kicker{background:transparent;border-color:var(--paper)}
.contact .h2{color:var(--paper);margin:0 auto;text-shadow:calc(var(--mx) * 2 + 4px) calc(var(--my) * 2 + 3px) 0 var(--a)}
.mail{display:block;margin:30px auto 10px;font:400 clamp(26px,6vw,92px)/1 var(--f-display);text-transform:uppercase;text-decoration:none;color:var(--b);overflow-wrap:anywhere;transition:color .2s}
.mail:hover{color:var(--paper)}
.contact-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;max-width:1100px;margin:30px auto 0;text-align:left}
.ticket{border:2px solid var(--paper);border-radius:14px;padding:14px 16px;text-decoration:none;display:grid;gap:4px;transition:background .25s,color .25s,transform .25s var(--ease);overflow-wrap:anywhere}
a.ticket:hover{background:var(--b);color:var(--ink);border-color:var(--b);transform:translateY(-4px) rotate(-1deg)}
.ticket .mono{opacity:.7}.ticket b{font-size:18px}
.foot-word{margin-top:clamp(40px,6vw,80px);font:400 clamp(54px,15vw,250px)/.85 var(--f-display);color:var(--a);text-transform:uppercase;overflow-wrap:anywhere;text-align:center}
.foot-word .mis{display:block;width:100%}
.foot-word .mis::before{white-space:normal;overflow-wrap:anywhere}
.foot-row{margin-top:30px;opacity:.7;display:flex;justify-content:center}

.reveal{opacity:1}
.js .reveal{opacity:0;transform:translateY(26px);transition:opacity .7s var(--ease),transform .7s var(--ease)}
.js .reveal.in{opacity:1;transform:none}
:focus-visible{outline:3px solid var(--b);outline-offset:3px}
@media (max-width:860px){
  .nav-links{display:none}
  .nav{padding-left:14px}
  .hero{padding-top:170px}
  .hero-hud{top:84px}
  .hero-hud span:last-child{display:none}
  .row{grid-template-columns:1fr;gap:4px}
  .portrait{order:-1;width:min(62vw,260px);flex-basis:auto}
  .hero-main{flex-direction:column;align-items:flex-start}
}
@media (max-width:520px){
  .nav-cta{display:none}
  .hero-foot{display:none}
  .stickers{position:relative;display:flex;flex-wrap:wrap;gap:12px;margin-top:26px;inset:auto}
  .sticker{position:relative}
}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}
  .js .reveal{opacity:1;transform:none}
  .js .pitch-text .w{opacity:1}
}
`;

const JS = `
(function(){
  var root=document.documentElement;
  var reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hero=document.querySelector(".hero");
  var readout=document.getElementById("mis-read");
  var tx=0,ty=0,cx=0,cy=0,raf=0;
  function setMis(x,y){
    root.style.setProperty("--mx",x.toFixed(2)+"px");root.style.setProperty("--my",y.toFixed(2)+"px");
    if(readout)readout.textContent="\\u2194 "+(x>=0?"+":"")+(x/6).toFixed(1)+"  \\u2195 "+(y>=0?"+":"")+(y/6).toFixed(1)+" mm";
  }
  function loop(){
    cx+=(tx-cx)*0.14;cy+=(ty-cy)*0.14;setMis(cx,cy);
    if(Math.abs(tx-cx)>0.02||Math.abs(ty-cy)>0.02)raf=requestAnimationFrame(loop);else raf=0;
  }
  function aim(x,y){tx=x;ty=y;if(!raf)raf=requestAnimationFrame(loop);}
  if(hero&&!reduce){
    hero.addEventListener("pointermove",function(e){
      if(e.target&&e.target.closest&&e.target.closest(".sticker"))return;
      var r=hero.getBoundingClientRect();
      aim(((e.clientX-r.left)/r.width-0.5)*26,((e.clientY-r.top)/r.height-0.5)*14);
    });
    hero.addEventListener("pointerleave",function(){aim(1.5,0.7);});
    setMis(1.5,0.7);cx=1.5;cy=0.7;
  }

  // stickers: drag them around the hero
  var held=null,ox=0,oy=0;
  var stickers=[].slice.call(document.querySelectorAll(".sticker"));
  stickers.forEach(function(s,i){
    var layout=getComputedStyle(s).position==="absolute";
    if(layout){
      var spots=[[0.56,0.74],[0.70,0.80],[0.84,0.70]];
      var sp=spots[i%3];
      s.style.left=(sp[0]*100)+"%";s.style.top=(sp[1]*100)+"%";
      s.style.transform="rotate("+((i%2?6:-8))+"deg)";
    }
    s.addEventListener("pointerdown",function(e){
      held=s;s.classList.add("held");
      var sr=s.getBoundingClientRect();ox=e.clientX-sr.left;oy=e.clientY-sr.top;
      try{s.setPointerCapture(e.pointerId);}catch(_){}
      e.preventDefault();
    });
    s.addEventListener("pointermove",function(e){
      if(held!==s||!hero)return;
      var hr=hero.getBoundingClientRect();var sr=s.getBoundingClientRect();
      if(getComputedStyle(s).position!=="absolute")return;
      var x=Math.min(Math.max(e.clientX-hr.left-ox,0),hr.width-sr.width);
      var y=Math.min(Math.max(e.clientY-hr.top-oy,0),hr.height-sr.height);
      s.style.left=x+"px";s.style.top=y+"px";
    });
    var up=function(){if(held===s){s.classList.remove("held");held=null;}};
    s.addEventListener("pointerup",up);s.addEventListener("pointercancel",up);
  });

  // reel: drag to scroll, arrows, progress
  var track=document.querySelector(".reel-track");
  var bar=document.querySelector(".reel-progress i");
  if(track){
    var down=false,sx=0,sl=0,moved=false;
    track.addEventListener("pointerdown",function(e){
      if(e.pointerType!=="mouse")return;
      down=true;moved=false;sx=e.clientX;sl=track.scrollLeft;
    });
    window.addEventListener("pointermove",function(e){
      if(!down)return;var d=e.clientX-sx;if(Math.abs(d)>4){moved=true;track.classList.add("drag");}
      track.scrollLeft=sl-d;
    });
    window.addEventListener("pointerup",function(){down=false;track.classList.remove("drag");});
    track.addEventListener("click",function(e){if(moved){e.preventDefault();e.stopPropagation();moved=false;}},true);
    var upd=function(){
      var max=track.scrollWidth-track.clientWidth;var p=max>0?track.scrollLeft/max:0;
      if(bar){var w=Math.min(100,Math.max(12,(track.clientWidth/track.scrollWidth)*100));bar.style.width=w+"%";bar.style.left=((100-w)*p)+"%";}
    };
    track.addEventListener("scroll",upd,{passive:true});window.addEventListener("resize",upd);upd();
    [].forEach.call(document.querySelectorAll("[data-reel]"),function(b){
      b.addEventListener("click",function(){track.scrollBy({left:(+b.getAttribute("data-reel"))*Math.min(320,track.clientWidth*0.8),behavior:reduce?"auto":"smooth"});});
    });
  }

  // pitch: words light up as you scroll
  var pitch=document.querySelector(".pitch-text");
  if(pitch){
    var words=[].slice.call(pitch.querySelectorAll(".w"));
    var light=function(){
      var r=pitch.getBoundingClientRect(),vh=window.innerHeight||800;
      var p=(vh*0.85-r.top)/(r.height+vh*0.35);p=Math.min(1,Math.max(0,p));
      var n=Math.round(p*words.length);
      words.forEach(function(w,i){w.classList.toggle("lit",i<n);});
    };
    if(reduce){words.forEach(function(w){w.classList.add("lit");});}
    else{window.addEventListener("scroll",light,{passive:true});window.addEventListener("resize",light);light();}
  }

  // reveal on scroll
  var items=[].slice.call(document.querySelectorAll(".reveal"));
  if("IntersectionObserver" in window&&!reduce){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target);}});},{threshold:0.08});
    items.forEach(function(el){io.observe(el);});
  }else{items.forEach(function(el){el.classList.add("in");});}
})();
`;

const HEART = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-8-5.2-8-11a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3c0 5.800-8 11-8 11z"/></svg>`;
const CHAT = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>`;
const SEND = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11 21 3l-6 18-3-7z"/></svg>`;
const REG = `<svg class="reg-mark" viewBox="-20 -20 40 40" aria-hidden="true"><circle r="6"/><path d="M-18 0H-9M9 0H18M0 -18V-9M0 9V18"/></svg>`;

function misWord(text: string): string {
  return `<span class="mis" data-mis="${attr(text)}">${esc(text)}</span>`;
}

function linkBtn(label: string, url: string | undefined, cls = "btn"): string {
  const href = safeHref(url);
  return href ? `<a class="${cls}" href="${attr(href)}" rel="noopener noreferrer">${esc(label)}</a>` : "";
}

function head(id: string, kicker: string, title: string): string {
  return `<header class="sec-head"><p class="kicker mono">${esc(kicker)}</p><h2 class="h2" id="${id}-h">${esc(title)}</h2></header>`;
}

function renderAbout(f: PortfolioFacts): string {
  const text = f.summary ?? f.tagline ?? "";
  const words = text.split(/\s+/).filter(Boolean).map((w) => `<span class="w">${esc(w)}</span>`).join(" ");
  const meta = [f.location, ...f.stats.map((s) => `${s.value} ${s.label}`)].filter((x): x is string => Boolean(x));
  return `<section class="pitch" id="about" aria-labelledby="about-h">
<p class="kicker mono" id="about-h">The pitch</p>
<p class="pitch-text">${words}</p>
${meta.length ? `<p class="pitch-meta mono">${meta.map((m) => `<span>${esc(m)}</span>`).join("")}</p>` : ""}
</section>`;
}

function renderProjects(f: PortfolioFacts): string {
  const posts = f.projects.map((p) => {
    const m = p.metrics[0];
    const poster = m
      ? `<div class="poster"><b>${esc(m.value)}</b><span>${esc(m.label)}</span></div>`
      : `<div class="poster word"><b>${esc(p.name)}</b></div>`;
    const who = [p.role, p.period].filter((x): x is string => Boolean(x)).join(" · ");
    const more = p.metrics.slice(1).map((x) => `${x.value} ${x.label}`).join(" · ");
    return `<article class="post">
<div class="post-top"><span class="avatar" aria-hidden="true">${esc(initials(p.name))}</span><div class="post-who">${esc(p.name)}${who ? `<small>${esc(who)}</small>` : ""}</div>${p.tags[0] ? `<span class="post-tag">${esc(p.tags[0])}</span>` : ""}</div>
${poster}
<div class="post-icons" aria-hidden="true">${HEART}${CHAT}${SEND}</div>
${m ? `<h3>${esc(p.name)}</h3>` : ""}
${p.description ? `<p>${esc(p.description)}</p>` : ""}
${more ? `<p class="mono">${esc(more)}</p>` : ""}
${p.bullets.length ? `<ul>${p.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}
${p.tags.length ? `<div class="post-tags">${p.tags.map((t) => `#${esc(t.replace(/\s+/g, ""))}`).join(" ")}</div>` : ""}
${linkBtn("See the project", p.link, "btn btn-ink")}
</article>`;
  }).join("\n");
  return `<section class="reel" id="projects" aria-labelledby="projects-h">
<div class="reel-head"><div><p class="kicker mono">Proof sheets</p><h2 class="h2" id="projects-h">Work</h2></div>
<div class="reel-nav"><button type="button" data-reel="-1" aria-label="Previous">←</button><button type="button" data-reel="1" aria-label="Next">→</button></div></div>
<div class="reel-track" tabindex="0" aria-label="Projects">${posts}</div>
<div class="reel-progress" aria-hidden="true"><i></i></div>
</section>`;
}

function renderExperience(f: PortfolioFacts): string {
  const rows = f.experience.map((e) => {
    const when = [e.period, e.location].filter((x): x is string => Boolean(x)).join(" · ");
    return `<div class="row reveal"><p class="mono">${esc(when)}</p><div><h3>${esc(e.role)} <em>${esc(e.org)}</em></h3>${e.summary ? `<p>${esc(e.summary)}</p>` : ""}${e.bullets.length ? `<ul>${e.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}</div></div>`;
  }).join("\n");
  return `<section class="cv" id="experience" aria-labelledby="experience-h">${head("experience", "Track record", "Experience")}<div class="cv-list">${rows}</div></section>`;
}

function renderAchievements(f: PortfolioFacts): string {
  const items = f.achievements.map((a) => `<figure class="poster-w reveal"><div class="riso" aria-hidden="true"></div><figcaption><b>${esc(a.title)}</b>${a.detail ? `<span>${esc(a.detail)}</span>` : ""}${a.year ? `<span class="mono">${esc(a.year)}</span>` : ""}</figcaption></figure>`).join("");
  return `<section class="wins" id="achievements" aria-labelledby="achievements-h">${head("achievements", "Hall of fame", "Wins")}<div class="win-row">${items}</div></section>`;
}

function renderSkills(f: PortfolioFacts): string {
  const cols = f.skills.map((g) => `<div class="skill-col reveal">${g.group ? `<h3>${esc(g.group)}</h3>` : ""}<ul>${g.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>`).join("");
  return `<section class="skills" id="skills" aria-labelledby="skills-h">${head("skills", "In the toolbox", "Skills")}<div class="skill-cols">${cols}</div></section>`;
}

function renderEducation(f: PortfolioFacts): string {
  const ed = f.education.map((e) => `<div class="card reveal"><h3>${esc(e.school)}</h3>${e.degree ? `<p>${esc(e.degree)}</p>` : ""}${e.detail ? `<p>${esc(e.detail)}</p>` : ""}${e.period ? `<p class="mono">${esc(e.period)}</p>` : ""}</div>`).join("");
  return `<section class="school" id="education" aria-labelledby="education-h">${head("education", "School", "Education")}<div class="school-grid">${ed}</div></section>`;
}

function renderCerts(f: PortfolioFacts): string {
  const cs = f.certifications.map((c) => `<div class="card reveal"><h3>${esc(c.name)}</h3>${c.issuer ? `<p>${esc(c.issuer)}</p>` : ""}${c.year ? `<p class="mono">${esc(c.year)}</p>` : ""}</div>`).join("");
  return `<section class="school" id="certifications" aria-labelledby="certifications-h">${head("certifications", "On paper", "Certificates")}<div class="school-grid">${cs}</div></section>`;
}

function renderTestimonials(f: PortfolioFacts): string {
  const ns = f.testimonials.map((t) => `<figure class="note reveal"><blockquote>${esc(t.quote)}</blockquote><figcaption><b>${esc(t.author)}</b>${t.role ? `<span>${esc(t.role)}</span>` : ""}</figcaption></figure>`).join("");
  return `<section class="notes" id="testimonials" aria-labelledby="testimonials-h">${head("testimonials", "Fan mail", "Kind words")}<div class="note-row">${ns}</div></section>`;
}

function renderExtras(f: PortfolioFacts): string {
  const cs = f.extras.map((x) => `<div class="flip reveal"><div class="riso" aria-hidden="true"></div><h3>${esc(x.label)}</h3><ul>${x.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>`).join("");
  return `<section class="outside" id="extras" aria-labelledby="extras-h">${head("extras", "Off the clock", "Outside")}<div class="flip-row">${cs}</div></section>`;
}

function renderContact(f: PortfolioFacts): string {
  const tickets: string[] = [];
  if (f.email) tickets.push(`<a class="ticket" href="mailto:${attr(f.email)}"><span class="mono">Email</span><b>${esc(f.email)}</b></a>`);
  if (f.phone) tickets.push(`<a class="ticket" href="tel:${attr(f.phone.replace(/[^\d+]/g, ""))}"><span class="mono">Phone</span><b>${esc(f.phone)}</b></a>`);
  for (const l of f.links) {
    const href = safeHref(l.url);
    if (href) tickets.push(`<a class="ticket" href="${attr(href)}" rel="noopener noreferrer"><span class="mono">Link</span><b>${esc(l.label)}</b></a>`);
  }
  if (f.location) tickets.push(`<div class="ticket"><span class="mono">Based in</span><b>${esc(f.location)}</b></div>`);
  return `<section class="contact" id="contact" aria-labelledby="contact-h">
<p class="kicker mono">Brief me</p>
<h2 class="h2" id="contact-h">Let’s make something</h2>
${f.email ? `<a class="mail" href="mailto:${attr(f.email)}">${esc(f.email)}</a>` : ""}
<div class="contact-grid">${tickets.join("")}</div>
<div class="foot-word" aria-hidden="true">${misWord(f.name)}</div>
</section>`;
}

const renderers: Record<SectionKey, (f: PortfolioFacts) => string> = {
  about: renderAbout, projects: renderProjects, experience: renderExperience, achievements: renderAchievements, skills: renderSkills,
  education: renderEducation, certifications: renderCerts, testimonials: renderTestimonials, extras: renderExtras, contact: renderContact,
};

function render({ facts, custom }: RenderInput): string {
  const accent = accentColour(custom, DEFAULT_ACCENT, PAPER);
  const font = fontOverride(custom);
  const families = font ? [{ family: font.family, weights: "400;500;600;700;800" }] : [{ family: "Anton", weights: "400" }, "Bricolage Grotesque", "Space Mono", { family: "Fraunces", weights: "400;500;600;700" }];
  const fontVars = font
    ? `--f-display:${font.stack};--f-body:${font.stack};--f-mono:${font.stack};--f-serif:${font.stack};`
    : `--f-display:'Anton',Impact,'Arial Narrow',sans-serif;--f-body:'Bricolage Grotesque',system-ui,sans-serif;--f-mono:'Space Mono',ui-monospace,monospace;--f-serif:'Fraunces',Georgia,serif;`;
  const fontFix = font ? `.h2,.headline,.nav-logo,.mq-item,.sticker b,.poster b,.row h3,.poster-w b,.skill-col h3,.card h3,.flip h3,.mail,.foot-word{font-weight:800}.headline,.foot-word,.h2{line-height:1.02}` : "";
  const sections = visibleSections(facts, custom, SECTIONS);
  const tokens = `:root{--paper:${PAPER};--a:${accent};--b:${ORANGE};--ink:${INK};--mx:1.5px;--my:.7px;${fontVars}--line:2.5px solid var(--ink);--gut:clamp(16px,4vw,56px);--ease:cubic-bezier(.2,.8,.2,1)}`;

  const skillItems = facts.skills.flatMap((g) => g.items);
  const marquee = skillItems.length
    ? (() => {
        const items = [...skillItems, ...skillItems].slice(0, Math.max(skillItems.length, 8));
        const track = (list: string[], hidden: boolean) => `<div class="mq-track"${hidden ? ' aria-hidden="true"' : ""}>${list.map((s) => `<span class="mq-item">${esc(s)}</span><i class="mq-star">✶</i>`).join("")}</div>`;
        const row = (cls: string, list: string[]) => `<div class="mq-row ${cls}">${track(list, false)}${track(list, true)}</div>`;
        return `<section class="marquee" aria-label="Skills">${row("", items)}${row("mq-rev", [...items].reverse())}</section>`;
      })()
    : "";

  const nameWords = facts.name.split(/\s+/).filter(Boolean);
  const tag = [facts.headline, facts.location].filter((x): x is string => Boolean(x));
  const stickers = facts.stats.slice(0, 3).map((s, i) => `<div class="sticker s${i}" role="img" aria-label="${attr(`${s.value} ${s.label}`)}"><b>${esc(s.value)}</b><small>${esc(s.label)}</small></div>`).join("");
  const heroLinks = [
    facts.email ? `<a class="btn btn-ink btn-big" href="mailto:${attr(facts.email)}">Brief me</a>` : "",
    ...facts.links.slice(0, 2).map((l) => linkBtn(l.label, l.url)),
  ].join("");
  const hero = `<section class="hero" id="hero" aria-label="Introduction">
<div class="hero-wash" aria-hidden="true"></div>
<div class="hero-hud mono" aria-hidden="true"><span>${REG} Sheet · two inks</span><span>Off register <span id="mis-read">↔ +0.0 ↕ +0.0 mm</span> ${REG}</span></div>
<div class="hero-main">
<div class="hero-copy">
${tag.length ? `<p class="eyebrow mono"><span>${esc(tag.join(" · "))}</span></p>` : ""}
<h1 class="headline" aria-label="${attr(facts.name)}">${nameWords.map(misWord).join("")}</h1>
${facts.tagline ? `<p class="tagline">${esc(facts.tagline)}</p>` : ""}
${heroLinks ? `<div class="hero-links">${heroLinks}</div>` : ""}
</div>
${facts.photoUrl ? `<div class="portrait">${photoTag(facts, { alt: facts.name })}</div>` : ""}
</div>
${stickers ? `<div class="stickers" aria-label="Numbers">${stickers}</div>` : ""}
<div class="hero-foot mono" aria-hidden="true"><span>Move the pointer to misregister the print</span></div>
</section>`;

  const body = sections.map((k) => renderers[k](facts)).join("\n");
  const navLinks = sections.map((k) => `<a href="#${k}">${esc(NAV_LABEL[k] ?? k)}</a>`).join("");
  const cta = sections.includes("contact") ? `<a class="btn btn-ink nav-cta" href="#contact">Brief me</a>` : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(facts.name)}${facts.headline ? ` · ${esc(facts.headline)}` : ""}</title>
<meta name="theme-color" content="${PAPER}">
<link rel="stylesheet" href="${attr(googleFontsHref(families))}">
<style>${tokens}${CSS}${fontFix}</style>
</head>
<body>
<script>document.documentElement.classList.add("js");</script>
<a class="skip" href="#main">Skip to content</a>
<header class="nav" id="top"><a class="nav-logo" href="#top" aria-label="${attr(facts.name)}, back to top">${esc(facts.name)}</a><nav class="nav-links" aria-label="Sections">${navLinks}</nav>${cta}</header>
<main id="main">
${hero}
${marquee}
${body}
</main>
${scriptTag(JS)}
</body>
</html>`;
}

const template: ThemeTemplate = { id: "two-ink", sections: SECTIONS, defaultAccent: DEFAULT_ACCENT, render };
export default template;
