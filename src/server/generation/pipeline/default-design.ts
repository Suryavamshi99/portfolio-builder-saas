import type { Design, Theme } from "./types";

/**
 * Our own stylesheet for the shared class vocabulary (see prompts.ts), themed from the plan and shaped by the
 * design choices. Every variant keeps text on the page background or on a card, with the plan's own (contrast-checked)
 * colours, so no combination can make text unreadable.
 */
export function defaultCss(t: Theme, d: Design): string {
  const c = t.colors;
  const radius = { sharp: "4px", soft: "14px", round: "26px" }[d.radius];
  const hero = {
    plain: "",
    glow: "background:radial-gradient(1100px 420px at 12% -10%,color-mix(in srgb,var(--accent) 24%,transparent),transparent 60%),radial-gradient(900px 380px at 96% 0%,color-mix(in srgb,var(--accent2) 20%,transparent),transparent 60%);",
    split: "background:linear-gradient(100deg,color-mix(in srgb,var(--accent) 12%,var(--bg)) 0%,var(--bg) 62%);border-bottom:1px solid var(--line);",
    band: "background:color-mix(in srgb,var(--accent) 9%,var(--bg));border-bottom:1px solid var(--line);",
  }[d.hero];
  const heading = {
    plain: "",
    marker: ".sec-title{border-left:5px solid var(--accent);padding-left:14px}",
    highlight: ".sec-title{display:inline;box-shadow:inset 0 -.38em color-mix(in srgb,var(--accent) 30%,transparent);padding:0 .1em}",
    rule: ".sec-title::before{content:\"\";display:block;width:44px;height:4px;border-radius:4px;background:linear-gradient(90deg,var(--accent),var(--accent2));margin-bottom:14px}",
  }[d.heading];
  const cards = {
    flat: ".card{border:1px solid transparent}",
    bordered: ".card{border:1px solid var(--line)}",
    "accent-bar": ".card{border:1px solid var(--line);border-left:4px solid var(--accent)}",
    lifted: ".card{border:1px solid var(--line);box-shadow:0 14px 34px -18px color-mix(in srgb,var(--text) 38%,transparent)}",
  }[d.cards];
  const motion =
    d.motion === "rise"
      ? "@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}.sec .card,.hero .wrap>*{animation:rise .6s ease both}"
      : "";
  return `:root{--bg:${c.bg};--surface:${c.surface};--text:${c.text};--muted:${c.muted};--accent:${c.accent};--accent2:${c.accent2};--line:color-mix(in srgb,${c.text} 14%,transparent);--radius:${radius};--display:"${t.fonts.display}",system-ui,sans-serif;--body:"${t.fonts.body}",system-ui,sans-serif}
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);font:400 1rem/1.65 var(--body);overflow-wrap:anywhere;-webkit-font-smoothing:antialiased}
img{max-width:100%;height:auto;display:block}
a{color:var(--accent);text-underline-offset:3px}
.wrap{width:100%;max-width:1060px;margin:0 auto;padding:0 20px}
header.top{position:sticky;top:0;z-index:10;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
header.top nav{display:flex;align-items:center;justify-content:space-between;gap:12px 24px;flex-wrap:wrap;padding:12px 20px}
.brand{font:700 1.05rem var(--display);color:var(--text);text-decoration:none}
.navlinks{display:flex;flex-wrap:wrap;gap:4px 18px}
.navlinks a{color:var(--muted);text-decoration:none;font-size:.95rem;padding:10px 2px;min-height:44px;display:inline-flex;align-items:center;transition:color .2s}
.navlinks a:hover{color:var(--accent)}
.hero{padding:clamp(56px,10vw,128px) 0 clamp(40px,7vw,88px);${hero}}
.hero .wrap{display:grid;gap:28px;grid-template-columns:1.4fr .8fr;align-items:center}
.hero .wrap>:not(img){grid-column:1}
.hero img{grid-column:2;grid-row:1/span 4;width:100%;max-width:340px;aspect-ratio:1;object-fit:cover;border-radius:${d.radius === "sharp" ? "8px" : d.radius === "soft" ? "24px" : "50%"};justify-self:end}
h1{font:800 clamp(2.2rem,6.5vw,4.2rem)/1.05 var(--display);letter-spacing:-.02em;margin:0}
.eyebrow{font:600 .78rem var(--body);letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin:0}
.lead{font-size:clamp(1.05rem,2.4vw,1.3rem);color:var(--muted);max-width:60ch;margin:0}
.links{display:flex;flex-wrap:wrap;gap:12px}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 20px;border-radius:${d.radius === "sharp" ? "6px" : "999px"};background:var(--accent);color:${c.bg};font-weight:600;text-decoration:none;border:1px solid var(--accent);transition:transform .2s,box-shadow .2s}
.btn:hover{transform:translateY(-2px);box-shadow:0 10px 30px -12px var(--accent)}
.sec{padding:clamp(44px,7vw,84px) 0;border-top:1px solid var(--line)}
.sec-title{font:700 clamp(1.5rem,4vw,2.2rem)/1.15 var(--display);margin:0 0 28px;letter-spacing:-.01em}
${heading}
.grid{display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))}
.card{background:var(--surface);border-radius:var(--radius);padding:22px;transition:transform .25s,border-color .25s}
${cards}
.card:hover{transform:translateY(-3px);border-color:var(--accent)}
.card h3{font:700 1.12rem/1.3 var(--display);margin:0 0 6px}
.card p{margin:8px 0 0;color:var(--muted)}
.meta{color:var(--muted);font-size:.9rem;margin:0 0 8px}
.tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.tag{font-size:.85rem;padding:4px 12px;border-radius:999px;border:1px solid var(--line);color:var(--text);background:color-mix(in srgb,var(--accent) 8%,transparent)}
ul.list{margin:10px 0 0;padding-left:1.15rem;display:grid;gap:6px}
ul.list li::marker{color:var(--accent)}
.stat{font:800 clamp(1.8rem,5vw,2.8rem) var(--display);color:var(--accent)}
footer.foot{padding:40px 20px 56px;border-top:1px solid var(--line);color:var(--muted);display:flex;flex-wrap:wrap;gap:12px 24px;justify-content:space-between;align-items:center}
${motion}
@media (max-width:768px){.hero .wrap{grid-template-columns:1fr}.hero img{grid-column:1;grid-row:auto;justify-self:start;max-width:220px}header.top nav{padding:8px 16px}.wrap{padding:0 16px}}
@media (max-width:480px){.card{padding:18px}.navlinks{gap:0 14px}.btn{width:100%}}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important;scroll-behavior:auto!important}}
`;
}

