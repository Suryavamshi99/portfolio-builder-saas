import type { Theme } from "./types";

/**
 * Our own stylesheet for the shared class vocabulary (see prompts.ts), themed from the plan.
 * Used when the design call fails, and as the base the model's CSS is checked against.
 */
export function defaultCss(t: Theme, bold: boolean): string {
  const c = t.colors;
  return `:root{--bg:${c.bg};--surface:${c.surface};--text:${c.text};--muted:${c.muted};--accent:${c.accent};--accent2:${c.accent2};--line:color-mix(in srgb,${c.text} 14%,transparent);--display:"${t.fonts.display}",system-ui,sans-serif;--body:"${t.fonts.body}",system-ui,sans-serif}
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
.hero{padding:clamp(56px,10vw,128px) 0 clamp(40px,7vw,88px);${bold ? "background:radial-gradient(1200px 420px at 15% -10%,color-mix(in srgb,var(--accent) 26%,transparent),transparent 60%),radial-gradient(900px 380px at 95% 0%,color-mix(in srgb,var(--accent2) 22%,transparent),transparent 60%);" : ""}}
.hero .wrap{display:grid;gap:28px;grid-template-columns:1.4fr .8fr;align-items:center}
.hero .wrap>:not(img){grid-column:1}
.hero img{grid-column:2;grid-row:1/span 4;width:100%;max-width:340px;aspect-ratio:1;object-fit:cover;border-radius:${bold ? "28px" : "50%"};justify-self:end}
h1{font:800 clamp(2.2rem,6.5vw,4.2rem)/1.05 var(--display);letter-spacing:-.02em;margin:0}
.eyebrow{font:600 .78rem var(--body);letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin:0}
.lead{font-size:clamp(1.05rem,2.4vw,1.3rem);color:var(--muted);max-width:60ch;margin:0}
.links{display:flex;flex-wrap:wrap;gap:12px}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 20px;border-radius:999px;background:var(--accent);color:${c.bg};font-weight:600;text-decoration:none;border:1px solid var(--accent);transition:transform .2s,box-shadow .2s}
.btn:hover{transform:translateY(-2px);box-shadow:0 10px 30px -12px var(--accent)}
.sec{padding:clamp(44px,7vw,84px) 0;border-top:1px solid var(--line)}
.sec-title{font:700 clamp(1.5rem,4vw,2.2rem)/1.15 var(--display);margin:0 0 28px;letter-spacing:-.01em}
.grid{display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))}
.card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:22px;transition:transform .25s,border-color .25s}
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
@media (max-width:768px){.hero .wrap{grid-template-columns:1fr}.hero img{grid-column:1;grid-row:auto;justify-self:start;max-width:220px}header.top nav{padding:8px 16px}.wrap{padding:0 16px}}
@media (max-width:480px){.card{padding:18px}.navlinks{gap:0 14px}.btn{width:100%}}
@media (prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
`;
}

/** Checks a model-written stylesheet and returns the cleaned CSS, or null when it should not be used. */
export function cleanModelCss(raw: string): string | null {
  let css = raw.trim();
  const fenced = /```(?:css)?\s*([\s\S]*?)```/i.exec(css);
  if (fenced?.[1]) css = fenced[1].trim();
  css = css.replace(/<\/?style[^>]*>/gi, "").trim();
  if (/@import|url\s*\(|expression\s*\(|javascript:|<\/?script|<\//i.test(css)) return null;
  if (css.length < 700 || css.length > 14000) return null;
  if (!/\.wrap\b/.test(css) || !/\.sec\b/.test(css)) return null;
  if (!/@media/i.test(css)) return null;
  const open = (css.match(/\{/g) ?? []).length;
  const close = (css.match(/\}/g) ?? []).length;
  if (open === 0 || open !== close) return null;
  return css;
}
