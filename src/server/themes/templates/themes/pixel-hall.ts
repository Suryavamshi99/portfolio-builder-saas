import type { PortfolioFacts, SectionKey } from "../../facts";
import { accentColour, attr, contrast, esc, fontOverride, googleFontsHref, photoTag, safeHref, scriptTag, visibleSections } from "../helpers";
import type { RenderInput, ThemeTemplate } from "../types";

const SECTIONS: SectionKey[] = ["about", "experience", "projects", "education", "skills", "achievements", "certifications", "testimonials", "extras", "contact"];
const DEFAULT_ACCENT = "#6ce398";
const NIGHT = "#1b1240";

const li = (items: string[]) => (items.length ? `<ul>${items.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : "");
const meta = (...parts: Array<string | undefined>) => {
  const p = parts.filter((x): x is string => Boolean(x));
  return p.length ? `<p class="meta">${p.map(esc).join(" · ")}</p>` : "";
};
const linkTag = (url: string | undefined, label: string) => {
  const h = safeHref(url);
  return h ? `<a class="pbtn" href="${attr(h)}" rel="noopener noreferrer" target="_blank">${esc(label)}</a>` : "";
};

function article(lv: string, title: string, kicker: string, inner: string): string {
  return `<article class="lv card" data-lv="${lv}" data-title="${attr(title)}" data-kicker="${attr(kicker)}"><h3 class="lvt h-pixel">${esc(title)}</h3>${inner}</article>`;
}

function heading(label: string): string {
  return `<h2 class="h-pixel sec-h">${esc(label)}</h2>`;
}

/** A section that is not a level of its own: it is collected into the bonus level of the game. */
function bonusSection(key: SectionKey, f: PortfolioFacts): string {
  const wrap = (id: string, label: string, body: string) => `<section class="sec" id="${id}" data-lv="b">${heading(label)}${body}</section>`;
  switch (key) {
    case "skills":
      return wrap(
        "skills",
        "Skills",
        f.skills
          .map((g) => `<div class="card">${g.group ? `<h3 class="h-pixel">${esc(g.group)}</h3>` : ""}<div class="chips">${g.items.map((i) => `<span>${esc(i)}</span>`).join("")}</div></div>`)
          .join(""),
      );
    case "achievements":
      return wrap(
        "achievements",
        "Wins",
        `<div class="card"><ul class="plainlist">${f.achievements.map((a) => `<li><b>${esc(a.title)}</b>${a.year ? ` <span class="meta">${esc(a.year)}</span>` : ""}${a.detail ? `<br>${esc(a.detail)}` : ""}</li>`).join("")}</ul></div>`,
      );
    case "certifications":
      return wrap(
        "certifications",
        "Certifications",
        `<div class="card"><ul class="plainlist">${f.certifications.map((c) => `<li><b>${esc(c.name)}</b>${c.issuer || c.year ? ` <span class="meta">${[c.issuer, c.year].filter(Boolean).map(esc).join(" · ")}</span>` : ""}</li>`).join("")}</ul></div>`,
      );
    case "testimonials":
      return wrap(
        "testimonials",
        "Kind words",
        f.testimonials.map((t) => `<blockquote class="quote"><p>${esc(t.quote)}</p><cite>${esc(t.author)}${t.role ? `, ${esc(t.role)}` : ""}</cite></blockquote>`).join(""),
      );
    case "extras":
      return wrap(
        "extras",
        "More about me",
        f.extras.map((e) => `<div class="card"><h3 class="h-pixel">${esc(e.label)}</h3><div class="chips">${e.items.map((i) => `<span>${esc(i)}</span>`).join("")}</div></div>`).join(""),
      );
    case "contact": {
      const rows: string[] = [];
      if (f.email) rows.push(`<li><a href="mailto:${attr(f.email)}">${esc(f.email)}</a></li>`);
      if (f.phone) rows.push(`<li><a href="tel:${attr(f.phone.replace(/[^\d+]/g, ""))}">${esc(f.phone)}</a></li>`);
      for (const l of f.links) {
        const h = safeHref(l.url);
        rows.push(h ? `<li><a href="${attr(h)}" rel="noopener noreferrer" target="_blank">${esc(l.label)}</a></li>` : `<li>${esc(l.label)}</li>`);
      }
      return wrap("contact", "Say hello", `<div class="card"><ul class="plainlist contact">${rows.join("")}</ul></div>`);
    }
    default:
      return "";
  }
}

const CSS = String.raw`
:root{--night:#1b1240;--sky:#6b55d9;--gold:#ffd23f;--pink:#ff4fd8;--cyan:#3ef0ff;--console:#4a2a6e;--console-dark:#2c1745;--console-hi:#7a4ea8;
--paper:color-mix(in srgb,var(--accent) 22%,#fff);--paper-2:color-mix(in srgb,var(--accent) 9%,#fff);
--ink:color-mix(in srgb,var(--accent) 18%,#000);--ink-soft:color-mix(in srgb,var(--accent) 34%,#000);
--rule:2px solid var(--ink)}
*{box-sizing:border-box}
html,body{margin:0}
body{font-family:var(--font-text);color:var(--ink);background:var(--night);-webkit-font-smoothing:antialiased;font-variant-ligatures:none}
img{max-width:100%;display:block}
a{color:inherit}
:focus-visible{outline:3px solid var(--pink);outline-offset:2px}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.h-pixel{font-family:var(--font-pixel);font-weight:400;line-height:1.05;margin:0}
.pbtn{font-family:var(--font-label);font-size:13px;letter-spacing:.02em;text-transform:uppercase;display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:8px 14px;background:var(--ink);color:var(--paper);border:0;cursor:pointer;text-decoration:none;box-shadow:inset -3px -3px 0 rgba(0,0,0,.35),inset 3px 3px 0 rgba(255,255,255,.15)}
.pbtn:hover{filter:brightness(1.25)}
.pbtn:active{transform:translateY(1px)}
.pbtn.ghost{background:transparent;color:var(--ink);box-shadow:inset 0 0 0 2px var(--ink)}
.pbtn.ghost:hover{background:var(--accent);filter:none}
.pbtn.go{background:var(--accent);color:var(--on-accent)}

/* content blocks shared by plain view and game panel */
.meta{font-family:var(--font-label);font-size:12px;text-transform:uppercase;letter-spacing:.03em;color:var(--ink-soft);margin:4px 0 8px}
.card{background:var(--paper-2);border:var(--rule);padding:16px 18px;margin:0 0 14px}
.card h3.h-pixel{font-size:24px;margin:0 0 4px}
.card p{font-size:16px;line-height:1.6;margin:8px 0}
.card ul{padding-left:20px;margin:8px 0}
.card li{font-size:16px;line-height:1.55;margin:4px 0}
.plainlist{list-style:none;padding:0!important}
.plainlist li{padding:6px 0;border-bottom:1px dashed var(--ink-soft)}
.plainlist li:last-child{border-bottom:0}
.role{font-weight:600;margin:4px 0 0!important}
.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));border:var(--rule);margin:14px 0;background:var(--paper)}
.metrics>div{padding:10px 12px;border-right:var(--rule)}
.metrics>div:last-child{border-right:0}
.metrics b{display:block;font-family:var(--font-pixel);font-weight:400;font-size:26px;line-height:1.1}
.metrics span{font-size:13px;color:var(--ink-soft)}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.chips span{font-size:13px;padding:3px 8px;border:1px solid var(--ink);background:var(--paper)}
.quote{margin:0 0 14px;padding:14px 16px;background:var(--paper-2);border:var(--rule)}
.quote p{margin:0 0 8px;font-style:italic;line-height:1.55}
.quote cite{font-style:normal;font-size:13px;color:var(--ink-soft)}
.contact a{font-weight:600}
.start-photo{width:132px;height:132px;object-fit:cover;border:var(--rule);image-rendering:auto;margin:0 0 12px;box-shadow:4px 4px 0 var(--ink)}

/* plain read-it-all view */
#plain{min-height:100vh;background:var(--paper)}
.p-head{background:var(--night);padding:44px max(20px,calc((100% - 860px)/2)) 30px;color:#fff}
.p-main{padding-top:30px!important}
.p-head h1{font-family:var(--font-pixel);font-weight:400;font-size:clamp(40px,8vw,72px);line-height:1;margin:0 0 10px;text-shadow:4px 4px 0 var(--sky)}
.p-head .headline{font-family:var(--font-label);font-size:15px;text-transform:uppercase;letter-spacing:.04em;color:var(--accent);margin:0 0 6px}
.p-head .loc{font-size:14px;color:#cdbff0;margin:0}
.p-head .start-photo{border-color:var(--accent);box-shadow:4px 4px 0 var(--sky)}
.p-main{max-width:860px;margin:0 auto;padding:0 20px 56px}
.sec{margin:0 0 34px}
.sec-h{font-size:34px;margin:0 0 14px;color:var(--ink)}
.sec>.card:first-of-type{margin-top:0}
.p-top{display:none}
.js .p-top{display:flex;justify-content:flex-end;padding:14px max(20px,calc((100% - 860px)/2)) 0;background:var(--night)}
.p-foot{text-align:center;padding:20px;background:var(--night);color:#cdbff0;font-family:var(--font-label);font-size:12px;text-transform:uppercase}

/* game */
#game{display:none}
.js:not(.plain) #plain{display:none}
.js:not(.plain) #game{display:grid}
.js:not(.plain) body{overflow:hidden;height:100%;overscroll-behavior:none}
.js:not(.plain){height:100%;overflow:hidden}
#game{position:fixed;inset:0;grid-template-rows:minmax(0,1fr) auto;grid-template-columns:minmax(0,1fr);background:var(--night);-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
#stage{position:relative;overflow:hidden;min-height:0}
#c{position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;image-rendering:crisp-edges;display:block;outline:none;touch-action:none}
#c:focus-visible{outline:3px solid var(--pink);outline-offset:-3px}
#prompt{position:absolute;left:0;top:0;z-index:5;font-family:var(--font-label);font-size:13px;color:#fff;background:rgba(20,10,50,.92);border:2px solid var(--accent);padding:6px 10px;white-space:nowrap;box-shadow:0 0 0 2px #0c0524,0 0 18px rgba(255,255,255,.12);cursor:pointer;transform:translate(-50%,-100%);max-width:calc(100vw - 16px);overflow:hidden;text-overflow:ellipsis}
#prompt b{display:inline-block;min-width:20px;text-align:center;background:var(--accent);color:var(--on-accent);margin-right:6px;padding:0 4px}
.map{position:absolute;left:12px;top:12px;z-index:4;max-width:calc(100% - 190px);display:flex;flex-wrap:wrap;gap:6px;padding:8px 10px;background:rgba(27,18,64,.82);border:2px solid var(--console-dark);box-shadow:inset 0 0 0 2px var(--console-hi)}
.map button{width:28px;height:28px;padding:0;border:2px solid #8f78d6;background:var(--night);color:#cdbff0;font-family:var(--font-label);font-size:11px;cursor:pointer}
.map button.lit{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.map button.here{box-shadow:0 0 0 2px var(--pink),0 0 12px var(--pink);color:#fff}
.map button.lit.here{color:var(--on-accent)}
.map button:hover{border-color:#fff}
.readall{position:absolute;right:12px;top:12px;z-index:4;font-family:var(--font-pixel);font-size:18px;color:var(--on-accent);background:var(--accent);border:2px solid var(--ink);box-shadow:4px 4px 0 rgba(0,0,0,.4);padding:8px 14px;cursor:pointer}
.readall:hover{filter:brightness(1.12)}
.hud{position:absolute;right:12px;bottom:12px;z-index:4;display:flex;align-items:center;gap:10px;background:var(--console);border:3px solid var(--console-dark);box-shadow:inset 0 0 0 2px var(--console-hi),0 6px 0 rgba(0,0,0,.35);padding:8px 12px;color:#e9dcff;font-family:var(--font-label);font-size:13px}
.hud .folders{display:inline-flex;gap:3px}
.hud .folders i{width:9px;height:8px;background:#1d1240;display:block}
.hud .folders i.on{background:var(--gold);box-shadow:0 0 6px rgba(255,210,63,.7)}
#pad{display:none}
body.touch #pad{display:flex;flex-direction:column;gap:10px;background:var(--console);border-top:3px solid var(--console-dark);box-shadow:inset 0 2px 0 var(--console-hi);padding:10px 14px calc(12px + env(safe-area-inset-bottom));touch-action:none}
body.touch .hud{display:none}
body.touch .map{max-width:calc(100% - 130px)}
body.touch .readall{font-size:15px;padding:6px 10px}
.pad-row{display:flex;align-items:center;justify-content:space-between;gap:10px}
.dpad{display:flex;gap:8px}
.pad-b{touch-action:none;user-select:none;-webkit-user-select:none;cursor:pointer;width:58px;height:58px;background:#3b2060;color:#fff;border:3px solid #1c0d33;box-shadow:inset 0 -5px 0 #1c0d33,inset 0 0 0 2px var(--console-hi);display:grid;place-items:center;font-family:var(--font-pixel);font-size:22px}
.pad-b svg{width:24px;height:24px}
.pad-b.down{transform:translateY(2px);box-shadow:inset 0 0 0 2px var(--console-hi)}
.ab{display:flex;gap:10px}
.ab .pad-b{border-radius:50%;font-size:22px;line-height:1}
.ab .pad-b small{display:block;font-family:var(--font-label);font-size:9px;margin-top:2px}
.ab .a{background:var(--pink);color:#2a0c26}
.ab .b{background:var(--accent);color:var(--on-accent)}
.pad-count{font-family:var(--font-label);font-size:12px;color:#e9dcff;text-align:center;display:flex;flex-direction:column;align-items:center;gap:6px}
.pad-count .folders{display:inline-flex;gap:3px}
.pad-count .folders i{width:9px;height:8px;background:#1d1240;display:block}
.pad-count .folders i.on{background:var(--gold)}

/* start screen */
#start{position:absolute;inset:0;z-index:8;display:grid;place-items:center;padding:20px;background:rgba(14,6,40,.72);text-align:center}
#start[hidden]{display:none}
.st-box{max-width:560px;color:#fff}
.st-box h1{font-family:var(--font-pixel);font-weight:400;font-size:clamp(40px,9vw,76px);line-height:1;margin:0 0 10px;text-shadow:4px 4px 0 var(--sky),8px 8px 0 #0c0524;overflow-wrap:anywhere}
.st-box .headline{font-family:var(--font-label);font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:var(--accent);margin:0 0 22px}
.st-box .press{font-family:var(--font-pixel);font-size:26px;padding:12px 22px;min-height:54px}
.st-box .blink{animation:blink 1s steps(2) infinite}
.st-box .hint{font-size:14px;line-height:1.5;color:#cdbff0;margin:18px 0 0}
.st-box .st-photo{width:96px;height:96px;object-fit:cover;border:3px solid var(--accent);margin:0 auto 14px;box-shadow:4px 4px 0 var(--sky)}
@keyframes blink{50%{opacity:.35}}

/* chapter panel */
#panel{position:fixed;inset:0;z-index:20;display:grid;place-items:center;padding:14px;background:rgba(12,5,36,.78)}
#panel[hidden]{display:none}
.sheet{width:min(760px,100%);max-height:100%;display:flex;flex-direction:column;background:var(--paper);border:3px solid var(--ink);box-shadow:8px 8px 0 rgba(0,0,0,.5)}
.sheet header{display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--accent);color:var(--on-accent);border-bottom:3px solid var(--ink)}
.sheet .ttl{flex:1;min-width:0}
.sheet .kicker{font-family:var(--font-label);font-size:12px;text-transform:uppercase;letter-spacing:.04em;margin:0 0 4px;opacity:.85}
.sheet h2{font-family:var(--font-pixel);font-weight:400;font-size:clamp(24px,5vw,34px);line-height:1.05;margin:0;overflow-wrap:anywhere}
.sheet .x{width:40px;height:40px;border:2px solid currentColor;background:transparent;color:inherit;cursor:pointer;font-family:var(--font-pixel);font-size:20px;flex:none}
.sheet .x:hover{background:rgba(0,0,0,.15)}
.sheet .body{overflow:auto;padding:16px 16px 6px;-webkit-user-select:text;user-select:text}
.sheet .body .lvt{display:none}
.sheet .body .sec-h{font-size:26px;margin:0 0 10px}
.sheet .body .sec{margin:0 0 18px}
.sheet .body .p-head{padding:0 0 12px;color:var(--ink);background:none}
.sheet .body .p-head h1{font-size:34px;text-shadow:none}
.sheet .body .p-head .headline{color:var(--ink-soft)}
.sheet .body .p-head .loc{color:var(--ink-soft)}
.sheet footer{display:flex;gap:10px;justify-content:space-between;flex-wrap:wrap;padding:12px 14px;border-top:3px solid var(--ink);background:var(--paper-2)}
.sheet .body .start-photo{margin:0 0 12px}

@media (max-width:560px){
  .card{padding:12px 13px}
  .metrics b{font-size:20px}
  .sec-h{font-size:28px}
}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}
}
`;

const JS = String.raw`
(function(){
var doc=document,root=doc.documentElement,body=doc.body;
var cv=doc.getElementById("c");
var ctx=null;
try{ctx=cv&&cv.getContext("2d");}catch(e){ctx=null;}
if(!ctx){return;}
root.classList.add("js");
var plainBtns=doc.querySelectorAll("[data-play]");
var reduce=false;
try{reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;}catch(e){}
var cs=getComputedStyle(root);
var ACC=cs.getPropertyValue("--accent").trim()||"#6ce398";

/* ---- chapters, read from the plain view ---- */
var nodes=doc.querySelectorAll("#plain [data-lv]");
var order=[],groups={};
for(var i=0;i<nodes.length;i++){var k=nodes[i].getAttribute("data-lv");if(!groups[k]){groups[k]=[];order.push(k);}groups[k].push(nodes[i]);}
order.sort(function(a,b){var ra=a==="0"?-1:a==="b"?1e9:+a,rb=b==="0"?-1:b==="b"?1e9:+b;return ra-rb;});
var levels=order.map(function(k,idx){
  var els=groups[k],first=els[0];
  var t=first.getAttribute("data-title")||first.querySelector("h1,h2,h3").textContent;
  var kick=first.getAttribute("data-kicker")||"";
  var label=k==="0"?"S":k==="b"?"*":String(idx);
  return {key:k,title:t,kicker:kick,els:els,label:label,visited:false,x:0,idx:idx};
});
var N=levels.length;
var SP=270,W=170+(N-1)*SP+170;
for(var j=0;j<N;j++){levels[j].x=j===0?80:200+j*SP-SP+40;}
W=levels[N-1].x+200;

/* ---- tiny helpers ---- */
function seed(n){var s=n*9301+49297;return function(){s=(s*9301+49297)%233280;return s/233280;};}
var stage=doc.getElementById("stage");
var sc=2,VW=300,VH=200,GY=160,dpr=1;
function resize(){
  dpr=Math.min(window.devicePixelRatio||1,3);
  var w=stage.clientWidth,h=stage.clientHeight;
  cv.width=Math.max(1,Math.round(w*dpr));cv.height=Math.max(1,Math.round(h*dpr));
  sc=Math.max(1,Math.floor(Math.min(cv.height/150,cv.width/190)));
  VW=Math.floor(cv.width/sc);VH=Math.floor(cv.height/sc);
  GY=VH-Math.max(28,Math.floor(VH*0.2));
}
var cam=0;
function R(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h);}
function RW(x,y,w,h,c){R(x-cam,y,w,h,c);}
var GLY={"0":"111101101101111","1":"010110010010111","2":"111001111100111","3":"111001111001111","4":"101101111001001","5":"111100111001111","6":"111100111101111","7":"111001001010010","8":"111101111101111","9":"111101111001111","S":"011100010001110","*":"101010111010101"};
function glyph(ch,x,y,s,c){var g=GLY[ch];if(!g)return;for(var r=0;r<5;r++)for(var q=0;q<3;q++)if(g.charAt(r*3+q)==="1")R(x+q*s,y+r*s,s,s,c);}
function text(str,cx,y,s,c){var w=str.length*4*s-s;var x=cx-w/2;for(var i=0;i<str.length;i++){glyph(str.charAt(i),Math.round(x+i*4*s),y,s,c);}}
function shade(hex,amt){var n=parseInt(hex.slice(1),16),r=(n>>16)&255,g=(n>>8)&255,b=n&255;function f(v){return Math.max(0,Math.min(255,Math.round(v+(amt<0?v*amt:(255-v)*amt))));}return "rgb("+f(r)+","+f(g)+","+f(b)+")";}

/* ---- world ---- */
var BCOL=["#4a2a6e","#2a3a78","#7a2f6a","#1f5a6a","#5a3a9a","#34508f"];
var NEON=["#ff4fd8","#3ef0ff","#c6ff4a","#ff8a3d","#ffd23f"];
var STARS=(function(){var r=seed(7),a=[];for(var i=0;i<70;i++)a.push({x:r(),y:r(),p:r()*6});return a;})();
function skyline(n,wmin,wmax,hmin,hmax,sd){var r=seed(sd),a=[],x=0;while(x<n){var w=Math.floor(wmin+r()*(wmax-wmin)),h=Math.floor(hmin+r()*(hmax-hmin));a.push({x:x,w:w,h:h,s:Math.floor(r()*1000)});x+=w+Math.floor(r()*6);}return a;}
var FAR=skyline(W*0.3+700,14,30,30,90,3),MID=skyline(W*0.55+700,18,36,36,100,5);
var BLD=levels.map(function(l,i){var r=seed(i+11);return {w:i===0?0:96+Math.floor(r()*3)*16,h:70+Math.floor(r()*4)*14,col:BCOL[i%BCOL.length],neon:NEON[i%NEON.length],seed:i+3};});
var LAMPS=[];for(var lx=SP/2;lx<W;lx+=SP/1){LAMPS.push(lx+40);}
var rain=[];for(var ri=0;ri<70;ri++){rain.push({x:Math.random(),y:Math.random(),v:0.6+Math.random()*0.8});}

var P={x:levels[0].x+60,y:0,vx:0,vy:0,face:1,on:true,t:0};
var keys={l:0,r:0,j:0};
var near=-1,openIdx=-1,started=false,mode="game",lastJumpHeld=0;

/* ---- drawing ---- */
function drawSky(tm){
  var bands=["#1b1240","#221550","#2a1a62","#33207a","#3f2a94","#4c36ad","#5a42c0","#6b55d9"];
  var bh=Math.ceil(GY/bands.length);
  for(var i=0;i<bands.length;i++)R(0,i*bh,VW,bh+1,bands[i]);
  for(var s=0;s<STARS.length;s++){var st=STARS[s];var tw=reduce?1:(Math.sin(tm/500+st.p)>0.6?0:1);if(tw)R(((st.x*(VW+W*0.05))-cam*0.05)%VW,st.y*GY*0.6,1,1,"#e9dcff");}
  var mx=VW-56,my=26,rr=11;
  for(var yy=-rr;yy<=rr;yy++){var wv=Math.floor(Math.sqrt(rr*rr-yy*yy));R(mx-wv,my+yy,wv*2,1,"#fff3c4");}
  for(var yy2=-rr+3;yy2<=rr-5;yy2++){var w2=Math.floor(Math.sqrt(6*6-(yy2+1)*(yy2+1)));if(!isNaN(w2))R(mx-3-w2+2,my+yy2,Math.max(0,w2),1,"#f0dc9a");}
}
function drawSkyline(arr,par,col,winCol,tm){
  var off=cam*par;
  for(var i=0;i<arr.length;i++){var b=arr[i],x=b.x-off;if(x>VW||x+b.w<0)continue;
    R(x,GY-b.h,b.w,b.h,col);
    if(winCol){for(var wy=GY-b.h+5;wy<GY-6;wy+=8)for(var wx=x+3;wx<x+b.w-3;wx+=6){if(((b.s+Math.floor(wx)*7+wy*3)%5)===0)R(wx,wy,2,3,winCol);}}
  }
}
function drawBuilding(i,tm){
  var l=levels[i];
  if(i===0){drawStart(tm);return;}
  var b=BLD[i],bx=l.x-b.w/2-cam,by=GY-b.h;
  if(bx>VW+10||bx+b.w<-10)return;
  R(bx,by,b.w,b.h,b.col);
  R(bx,by,b.w,3,shade(b.col,0.25));
  R(bx-3,by-4,b.w+6,5,shade(b.col,-0.35));
  R(bx,by+b.h-3,b.w,3,shade(b.col,-0.4));
  var r=seed(b.seed);
  for(var wy=by+12;wy<GY-34;wy+=16){for(var wx=bx+8;wx<bx+b.w-14;wx+=18){var lit=r()>0.35;var flick=(!reduce&&lit&&r()>0.97&&Math.floor(tm/400)%3===0);R(wx,wy,10,8,lit&&!flick?"#ffe08a":"#1a1038");R(wx,wy+8,10,1,"rgba(0,0,0,.35)");}}
  /* awning in the accent colour */
  R(bx+b.w/2-24,GY-36,48,6,ACC);
  for(var s=0;s<8;s++)R(bx+b.w/2-24+s*6,GY-30,3,3,ACC);
  R(bx+b.w/2-24,GY-36,48,1,shade(ACC,0.35));
  /* door */
  R(bx+b.w/2-10,GY-26,20,26,"#12082c");
  R(bx+b.w/2-8,GY-24,16,24,"#241255");
  /* neon sign */
  var pulse=reduce?1:(0.82+0.18*Math.sin(tm/260+i));
  R(bx+b.w/2-14,by+b.h-58+0,28,14,"#0c0524");
  R(bx+b.w/2-13,by+b.h-57,26,12,l.visited?"#3a2a6a":b.neon);
  ctx.globalAlpha=pulse;text(l.label,bx+b.w/2+cam*0+0,by+b.h-55,2,l.visited?"#8f78d6":"#0c0524");ctx.globalAlpha=1;
  drawTerminal(l,bx+b.w/2+20,tm,i);
}
function drawTerminal(l,sx,tm,i){
  var x=sx-8,y=GY-20,glow=reduce?1:(0.7+0.3*Math.sin(tm/300+i*2));
  R(x,y,16,20,"#2a1650");R(x+1,y+1,14,12,"#0c0524");
  ctx.globalAlpha=glow;R(x+2,y+2,12,10,l.visited?"#3a8a60":"#3ef0ff");ctx.globalAlpha=1;
  text(l.label,sx,y+4,1,"#0c0524");
  R(x+2,y+14,12,2,"#7a4ea8");R(x+6,y+16,4,4,"#1c0d33");
  l.tx=sx+cam;
}
function drawStart(tm){
  var l=levels[0],sx=l.x-cam;
  if(sx>VW+30||sx<-30)return;
  /* arcade cabinet as the start checkpoint */
  R(sx-12,GY-38,24,38,"#2a3a78");R(sx-12,GY-38,24,3,"#4a5ab8");
  R(sx-9,GY-33,18,14,"#0c0524");
  var g=reduce?1:(0.75+0.25*Math.sin(tm/250));ctx.globalAlpha=g;R(sx-8,GY-32,16,12,l.visited?"#3a8a60":"#c6ff4a");ctx.globalAlpha=1;
  text("S",sx,GY-29,2,"#0c0524");
  R(sx-9,GY-16,18,3,"#1b2560");R(sx-6,GY-15,3,1,"#ff4fd8");R(sx+3,GY-15,3,1,"#3ef0ff");
  R(sx-12,GY-3,24,3,"#14194a");
  l.tx=l.x;
}
function drawLamps(tm){
  for(var i=0;i<LAMPS.length;i++){var x=LAMPS[i]-cam;if(x<-20||x>VW+20)continue;
    var by=GY-52;
    ctx.globalAlpha=0.12;ctx.fillStyle="#ffe08a";ctx.beginPath();ctx.moveTo(Math.round(x+5),by+4);ctx.lineTo(Math.round(x-14),GY);ctx.lineTo(Math.round(x+24),GY);ctx.closePath();ctx.fill();ctx.globalAlpha=1;
    R(x,by+4,2,GY-by-4,"#1a1038");R(x-2,by+2,8,3,"#1a1038");R(x-1,by+5,6,2,"#ffe08a");
  }
}
function drawGround(){
  R(0,GY,VW,VH-GY,"#2c1745");R(0,GY,VW,2,"#7a4ea8");R(0,GY+2,VW,1,"#1c0d33");
  var off=Math.floor(cam)%24;
  for(var x=-off;x<VW;x+=24)R(x,GY+10,12,2,"#3d2468");
  for(var x2=-(Math.floor(cam*1)%16);x2<VW;x2+=16)R(x2,GY+3,1,6,"#3a2166");
  R(0,GY+Math.floor((VH-GY)*0.6),VW,2,"#1c0d33");
}
function drawPlayer(tm){
  var x=Math.round(P.x-cam)-4,y=Math.round(P.y)-14,f=P.face,wk=(Math.abs(P.vx)>1&&P.on)?(Math.floor(tm/110)%2):0;
  var skin="#d9a066",hair="#241638",shirt=ACC,pants="#2a3a78";
  R(x+1,y+14,6,1,"rgba(0,0,0,.35)");
  /* legs */
  R(x+1,y+9,3,5-(wk?1:0),pants);R(x+4,y+9,3,5-(wk?0:1),pants);
  /* body */
  R(x,y+5,8,5,shirt);R(x,y+5,8,1,shade(shirt,0.3));
  R(f>0?x+7:x-1,y+6,2,3,skin);
  /* head */
  R(x+1,y,6,5,skin);R(x+1,y-1,6,2,hair);R(f>0?x+6:x+1,y,1,3,hair);
  R(f>0?x+5:x+2,y+2,1,1,"#0c0524");
}
function drawRain(tm){
  if(reduce)return;
  ctx.globalAlpha=0.35;
  for(var i=0;i<rain.length;i++){var d=rain[i];d.y+=d.v*0.012;d.x-=d.v*0.002;if(d.y>1){d.y=0;d.x=Math.random();}if(d.x<0)d.x=1;R(d.x*VW,d.y*VH,1,4,"#cdbff0");}
  ctx.globalAlpha=1;
}
function frame(tm){
  ctx.setTransform(sc,0,0,sc,0,0);ctx.imageSmoothingEnabled=false;
  var maxCam=Math.max(0,W-VW);cam=Math.max(0,Math.min(maxCam,P.x-VW/2));
  if(W<VW)cam=-(VW-W)/2;
  cam=Math.round(cam);
  drawSky(tm);drawSkyline(FAR,0.25,"#2c1745",null,tm);drawSkyline(MID,0.5,"#3a2062","#8f78d6",tm);
  drawGround();
  for(var i=0;i<N;i++)drawBuilding(i,tm);
  drawLamps(tm);
  drawPlayer(tm);
  drawRain(tm);
}

/* ---- logic ---- */
var prompt=doc.getElementById("prompt");
function updPrompt(){
  var best=-1,bd=18;
  for(var i=0;i<N;i++){var d=Math.abs(P.x-(levels[i].tx||levels[i].x));if(d<bd){bd=d;best=i;}}
  near=(openIdx>=0||!started||mode!=="game")?-1:best;
  if(near<0){prompt.hidden=true;return;}
  var l=levels[near];
  var touch=body.classList.contains("touch");
  prompt.innerHTML="";var b=doc.createElement("b");b.textContent=touch?"B":"E";prompt.appendChild(b);prompt.appendChild(doc.createTextNode(l.title));
  prompt.hidden=false;
  var px=(l.tx-cam)*sc/dpr,py=(GY-30)*sc/dpr;
  var pw=prompt.offsetWidth,half=pw/2,sw=stage.clientWidth;
  px=Math.max(half+6,Math.min(sw-half-6,px));
  prompt.style.left=Math.round(px)+"px";prompt.style.top=Math.round(py)+"px";
}
var last=0,raf=0;
function tick(tm){
  raf=requestAnimationFrame(tick);
  if(mode!=="game"||doc.hidden){last=tm;return;}
  var dt=Math.min(0.05,(tm-last)/1000||0);last=tm;
  if(openIdx<0&&started){
    var dir=keys.r-keys.l;P.vx=dir*92;
    if(dir)P.face=dir;
    P.x=Math.max(10,Math.min(W-10,P.x+P.vx*dt));
    if(keys.j&&P.on){P.vy=-175;P.on=false;}
    if(!keys.j&&P.vy<-70)P.vy=-70;
    P.vy+=560*dt;P.y+=P.vy*dt;
    if(P.y>=GY){P.y=GY;P.vy=0;P.on=true;}
  }else{P.vx=0;if(!P.on){P.vy+=560*dt;P.y+=P.vy*dt;if(P.y>=GY){P.y=GY;P.vy=0;P.on=true;}}}
  if(P.y===0)P.y=GY;
  frame(tm);updPrompt();
}

/* ---- map, HUD ---- */
var mapEls=doc.querySelectorAll(".map");
var folderEls=doc.querySelectorAll("[data-folders]");
var countEls=doc.querySelectorAll("[data-count]");
mapEls.forEach(function(m){levels.forEach(function(l,i){var b=doc.createElement("button");b.type="button";b.textContent=l.label;b.title=l.title;b.setAttribute("aria-label","Go to "+l.title);b.addEventListener("click",function(){goTo(i);});m.appendChild(b);});});
folderEls.forEach(function(f){levels.forEach(function(){f.appendChild(doc.createElement("i"));});});
function refresh(){
  var v=0;levels.forEach(function(l){if(l.visited)v++;});
  mapEls.forEach(function(m){var bs=m.children;for(var i=0;i<bs.length;i++){bs[i].className=(levels[i].visited?"lit ":"")+(near===i?"here":"");}});
  folderEls.forEach(function(f){for(var i=0;i<f.children.length;i++)f.children[i].className=levels[i].visited?"on":"";});
  countEls.forEach(function(c){c.textContent=v+"/"+N;});
}
function goTo(i){
  var l=levels[i];P.x=Math.max(10,(l.tx||l.x)-24);P.face=1;
  if(!started)startGame();
  canvasFocus();setTimeout(refresh,0);
}
function canvasFocus(){try{cv.focus({preventScroll:true});}catch(e){}}

/* ---- panel ---- */
var panel=doc.getElementById("panel"),pBody=doc.getElementById("panel-body"),pTitle=doc.getElementById("panel-title"),pKick=doc.getElementById("panel-kicker"),pNext=doc.getElementById("panel-next"),pClose=doc.getElementById("panel-close");
var restore=null;
function openLevel(i){
  var l=levels[i];openIdx=i;l.visited=true;
  pBody.innerHTML="";
  l.els.forEach(function(e){var c=e.cloneNode(true);c.removeAttribute("id");var withId=c.querySelectorAll("[id]");for(var q=0;q<withId.length;q++)withId[q].removeAttribute("id");pBody.appendChild(c);});
  pTitle.textContent=l.title;pKick.textContent=l.kicker||"Start";
  pNext.hidden=i>=N-1;
  if(i<N-1)pNext.textContent="Next: "+levels[i+1].title;
  pBody.scrollTop=0;
  restore=doc.activeElement;
  panel.hidden=false;pClose.focus();
  refresh();
}
function closePanel(){
  if(openIdx<0)return;
  panel.hidden=true;openIdx=-1;
  refresh();
  if(restore&&restore.focus&&mode==="game"){try{restore.focus();}catch(e){}}
  canvasFocus();
}
pClose.addEventListener("click",closePanel);doc.getElementById("panel-back").addEventListener("click",closePanel);
panel.addEventListener("click",function(e){if(e.target===panel)closePanel();});
pNext.addEventListener("click",function(){var n=Math.min(N-1,openIdx+1);var l=levels[n];panel.hidden=true;openIdx=-1;P.x=Math.max(10,(l.tx||l.x)-8);openLevel(n);});
prompt.addEventListener("click",function(){if(near>=0)openLevel(near);});

/* ---- start, modes ---- */
var startEl=doc.getElementById("start");
function startGame(){started=true;startEl.hidden=true;canvasFocus();}
doc.getElementById("start-go").addEventListener("click",startGame);
function setMode(m){
  mode=m;
  if(m==="plain"){root.classList.add("plain");if(openIdx>=0)closePanel();prompt.hidden=true;window.scrollTo(0,0);}
  else{root.classList.remove("plain");resize();canvasFocus();}
}
doc.querySelectorAll("[data-read]").forEach(function(b){b.addEventListener("click",function(e){e.preventDefault();setMode("plain");});});
doc.querySelectorAll("[data-play]").forEach(function(b){b.addEventListener("click",function(){setMode("game");});});

/* ---- input ---- */
function typing(t){return t&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA"||t.isContentEditable);}
doc.addEventListener("keydown",function(e){
  if(e.metaKey||e.ctrlKey||e.altKey||typing(e.target))return;
  var k=e.key;
  if(openIdx>=0){
    if(k==="Escape"){closePanel();e.preventDefault();}
    else if(k==="Tab"){var f=panel.querySelectorAll("button,a[href]");if(f.length){var first=f[0],lastE=f[f.length-1];if(e.shiftKey&&doc.activeElement===first){e.preventDefault();lastE.focus();}else if(!e.shiftKey&&doc.activeElement===lastE){e.preventDefault();first.focus();}}}
    return;
  }
  if(mode!=="game")return;
  var tag=e.target&&e.target.tagName;
  if(!started){if(k==="Enter"||(k===" "&&tag!=="BUTTON")){startGame();e.preventDefault();}return;}
  if(k==="ArrowLeft"||k==="a"||k==="A"){keys.l=1;e.preventDefault();}
  else if(k==="ArrowRight"||k==="d"||k==="D"){keys.r=1;e.preventDefault();}
  else if(k==="ArrowUp"||k==="w"||k==="W"||(k===" "&&tag!=="BUTTON")){keys.j=1;e.preventDefault();}
  else if((k==="e"||k==="E"||(k==="Enter"&&tag!=="BUTTON"&&tag!=="A"))&&near>=0){openLevel(near);e.preventDefault();}
});
doc.addEventListener("keyup",function(e){
  var k=e.key;
  if(k==="ArrowLeft"||k==="a"||k==="A")keys.l=0;
  else if(k==="ArrowRight"||k==="d"||k==="D")keys.r=0;
  else if(k==="ArrowUp"||k==="w"||k==="W"||k===" ")keys.j=0;
});
window.addEventListener("blur",function(){keys.l=keys.r=keys.j=0;});

/* touch console */
var touch=false;try{touch=window.matchMedia("(pointer: coarse)").matches||"ontouchstart" in window;}catch(e){}
if(touch)body.classList.add("touch");
doc.querySelectorAll("[data-pad]").forEach(function(b){
  var a=b.getAttribute("data-pad");
  function set(v){b.classList.toggle("down",!!v);if(a==="l")keys.l=v;else if(a==="r")keys.r=v;else if(a==="jump")keys.j=v;}
  b.addEventListener("pointerdown",function(e){e.preventDefault();try{b.setPointerCapture(e.pointerId);}catch(x){}
    if(a==="open"){if(!started)startGame();else if(near>=0&&openIdx<0)openLevel(near);return;}
    if(!started)startGame();
    set(1);});
  var up=function(){if(a!=="open")set(0);};
  b.addEventListener("pointerup",up);b.addEventListener("pointercancel",up);b.addEventListener("lostpointercapture",up);
});
/* tap the left or right edge of the street to walk when there is no console */
window.addEventListener("resize",resize);
resize();P.y=GY;
refresh();
last=performance.now();raf=requestAnimationFrame(tick);
})();
`;

function levelsMarkup(input: RenderInput): { plain: string; hasData: boolean } {
  const { facts: f, custom } = input;
  const secs = visibleSections(f, custom, SECTIONS);
  const hasBonusKeys: SectionKey[] = ["skills", "achievements", "certifications", "testimonials", "extras", "contact"];
  let n = 0;
  let aboutDone = false;
  const parts: string[] = [];
  for (const key of secs) {
    if (key === "about") {
      aboutDone = true;
      const inner = `${f.tagline ? `<p class="role">${esc(f.tagline)}</p>` : ""}${f.summary ? `<p>${esc(f.summary)}</p>` : ""}`;
      parts.push(`<section class="sec" id="about" data-lv="0">${heading("About")}<div class="card">${inner}</div></section>`);
    } else if (key === "experience") {
      const items = f.experience.map((e) => {
        n += 1;
        return article(String(n), e.org, "Experience", `<p class="role">${esc(e.role)}</p>${meta(e.period, e.location)}${e.summary ? `<p>${esc(e.summary)}</p>` : ""}${li(e.bullets)}`);
      });
      parts.push(`<section class="sec" id="experience">${heading("Experience")}${items.join("")}</section>`);
    } else if (key === "projects") {
      const items = f.projects.map((p) => {
        n += 1;
        const metrics = p.metrics.length ? `<div class="metrics">${p.metrics.map((m) => `<div><b>${esc(m.value)}</b><span>${esc(m.label)}</span></div>`).join("")}</div>` : "";
        const tags = p.tags.length ? `<div class="chips">${p.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : "";
        const lk = linkTag(p.link, "Open the project");
        return article(String(n), p.name, "Projects", `${p.role ? `<p class="role">${esc(p.role)}</p>` : ""}${meta(p.period)}${p.description ? `<p>${esc(p.description)}</p>` : ""}${metrics}${li(p.bullets)}${tags}${lk ? `<p>${lk}</p>` : ""}`);
      });
      parts.push(`<section class="sec" id="projects">${heading("Projects")}${items.join("")}</section>`);
    } else if (key === "education") {
      const items = f.education.map((e) => {
        n += 1;
        return article(String(n), e.school, "Education", `${e.degree ? `<p class="role">${esc(e.degree)}</p>` : ""}${meta(e.period)}${e.detail ? `<p>${esc(e.detail)}</p>` : ""}`);
      });
      parts.push(`<section class="sec" id="education">${heading("Education")}${items.join("")}</section>`);
    } else if (hasBonusKeys.includes(key)) {
      parts.push(bonusSection(key, f));
    }
  }
  return { plain: parts.join("\n"), hasData: aboutDone };
}

function startData(f: PortfolioFacts): string {
  const photo = photoTag(f, { alt: f.name, className: "start-photo" });
  return `<header class="p-head lv" data-lv="0" data-title="${attr(f.name)}" data-kicker="Start">${photo}<h1>${esc(f.name)}</h1>${f.headline ? `<p class="headline">${esc(f.headline)}</p>` : ""}${f.location ? `<p class="loc">${esc(f.location)}</p>` : ""}</header>`;
}

const template: ThemeTemplate = {
  id: "pixel-hall",
  sections: SECTIONS,
  defaultAccent: DEFAULT_ACCENT,
  render(input) {
    const { facts: f, custom } = input;
    const accent = accentColour(custom, DEFAULT_ACCENT, "#0c0524");
    const onAccent = contrast(accent, "#0c1a12") >= contrast(accent, "#ffffff") ? "#0c1a12" : "#ffffff";
    const fo = fontOverride(custom);
    const families: Array<string | { family: string; weights?: string }> = fo
      ? [{ family: fo.family, weights: "400;500;600;700" }]
      : [{ family: "Silkscreen", weights: "400;700" }, { family: "Tiny5", weights: "400" }, { family: "IBM Plex Sans", weights: "400;500;600;700" }];
    const fontVars = fo
      ? `--font-pixel:${fo.stack};--font-label:${fo.stack};--font-text:${fo.stack};`
      : `--font-pixel:'Tiny5','Silkscreen',monospace;--font-label:'Silkscreen','Tiny5',monospace;--font-text:'IBM Plex Sans',system-ui,sans-serif;`;
    const { plain } = levelsMarkup(input);
    const desc = f.tagline ?? f.summary ?? f.headline ?? f.name;
    const title = [f.name, f.headline].filter(Boolean).join(" · ");
    const photoStart = f.photoUrl ? `<img class="st-photo" src="${attr(f.photoUrl)}" alt="${attr(f.name)}">` : "";

    return `<!doctype html>
<html lang="en" style="--accent:${attr(accent)};--on-accent:${onAccent};${fontVars}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${attr(desc.slice(0, 240))}">
<meta name="theme-color" content="${NIGHT}">
<link rel="stylesheet" href="${attr(googleFontsHref(families))}">
<style>${CSS}</style>
</head>
<body>
<div id="game" aria-label="Playable resume of ${attr(f.name)}">
  <main id="stage">
    <canvas id="c" tabindex="0" role="img" aria-label="A pixel street at night with one building for each chapter of ${attr(f.name)}'s career. Use the arrow keys to walk, Space to jump and E to open a chapter. The plain version is one button away."></canvas>
    <div id="prompt" hidden></div>
    <nav class="map" aria-label="Chapters: jump to one"></nav>
    <button class="readall" type="button" data-read>Read it all</button>
    <div class="hud"><span class="sr-only">Chapters visited</span><span class="folders" data-folders></span><b data-count></b></div>
    <div id="start">
      <div class="st-box">
        ${photoStart}
        <h1>${esc(f.name)}</h1>
        ${f.headline ? `<p class="headline">${esc(f.headline)}</p>` : ""}
        <button id="start-go" class="pbtn go press" type="button"><span class="blink">Press start</span></button>
        <p class="hint">Walk with the arrow keys or A and D, jump with Space, open a chapter with E. On a phone, use the console below. Prefer to just read? <a href="#plain" data-read>Read it all</a>.</p>
      </div>
    </div>
  </main>
  <div id="pad" aria-label="Game controls">
    <div class="pad-row">
      <div class="dpad">
        <button type="button" class="pad-b" data-pad="l" aria-label="Move left"><svg viewBox="0 0 10 10" aria-hidden="true"><path d="M7 1L2 5l5 4z" fill="currentColor"/></svg></button>
        <button type="button" class="pad-b" data-pad="r" aria-label="Move right"><svg viewBox="0 0 10 10" aria-hidden="true"><path d="M3 1l5 4-5 4z" fill="currentColor"/></svg></button>
      </div>
      <div class="pad-count"><span class="folders" data-folders></span><b data-count></b></div>
      <div class="ab">
        <button type="button" class="pad-b b" data-pad="open" aria-label="Open the chapter here">B<small>Open</small></button>
        <button type="button" class="pad-b a" data-pad="jump" aria-label="Jump">A<small>Jump</small></button>
      </div>
    </div>
  </div>
</div>

<div id="panel" hidden role="dialog" aria-modal="true" aria-labelledby="panel-title">
  <div class="sheet">
    <header>
      <div class="ttl"><p id="panel-kicker" class="kicker"></p><h2 id="panel-title"></h2></div>
      <button id="panel-close" class="x" type="button" aria-label="Close">X</button>
    </header>
    <div id="panel-body" class="body"></div>
    <footer>
      <button id="panel-back" class="pbtn ghost" type="button">Back to the street</button>
      <button id="panel-next" class="pbtn go" type="button" hidden></button>
    </footer>
  </div>
</div>

<div id="plain">
  <div class="p-top"><button class="pbtn go" type="button" data-play>Play the game</button></div>
  ${startData(f)}
  <main class="p-main">
${plain}
  </main>
  <p class="p-foot">${esc(f.name)}</p>
</div>
${scriptTag(JS)}
</body>
</html>`;
  },
};

export default template;
