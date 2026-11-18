import type { PortfolioFacts, SectionKey } from "../../facts";
import { accentColour, attr, esc, fontOverride, googleFontsHref, initials, photoTag, safeHref, scriptTag, visibleSections } from "../helpers";
import type { ThemeTemplate } from "../types";

// Design Canvas: the portfolio as frames on a pannable, zoomable design canvas with layers and inspector panels.
// Fonts (Google Fonts stand-ins for the sample's local files): Inter Tight (UI and headings), IBM Plex Mono (small values).
const DEFAULT_ACCENT = "#3d3bf3";
const PAPER = "#fbf8f2";
const SUPPORTED: SectionKey[] = ["about", "experience", "projects", "skills", "education", "achievements", "certifications", "testimonials", "extras", "contact"];
const SECTION_LABEL: Record<SectionKey, string> = {
  about: "About",
  experience: "Experience",
  projects: "Projects",
  skills: "Skills",
  education: "Education",
  achievements: "Wins",
  certifications: "Certifications",
  testimonials: "Testimonials",
  extras: "More",
  contact: "Contact",
};

interface Ins {
  kv: Array<[string, string | undefined]>;
  metrics?: Array<{ value: string; label: string }>;
  tags?: string[];
  actions?: Array<{ label: string; href: string }>;
}
interface Frame {
  id: string;
  name: string;
  kind: string;
  cls?: string;
  html: string;
  ins: Ins;
}

const eb = (parts: Array<string | undefined>): string => {
  const p = parts.filter((x): x is string => Boolean(x));
  return p.length ? `<p class="eb"><i>/</i> ${p.map(esc).join(" &middot; ")}</p>` : "";
};
const chips = (items: string[]): string => (items.length ? `<ul class="chips">${items.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "");
const bullets = (items: string[]): string => (items.length ? `<ul class="bl">${items.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "");
const btn = (label: string, href: string | null, cls = ""): string => {
  if (!href) return "";
  const ext = /^https?:/i.test(href) ? ` target="_blank" rel="noopener noreferrer"` : "";
  return `<a class="btn ${cls}" href="${attr(href)}"${ext}>${esc(label)}</a>`;
};

function buildFrames(facts: PortfolioFacts, key: SectionKey): Frame[] {
  const f = facts;
  switch (key) {
    case "about": {
      const h1 = f.tagline ?? f.name;
      const links = f.links.map((l) => ({ l, h: safeHref(l.url) })).filter((x) => x.h);
      const buttons = [f.email ? btn("Email", `mailto:${f.email}`, "lime") : "", ...links.slice(0, 2).map((x) => btn(x.l.label, x.h, ""))].join("");
      const stats = f.stats.length
        ? `<dl class="stats">${f.stats.map((s) => `<div><dt>${esc(s.value)}</dt><dd>${esc(s.label)}</dd></div>`).join("")}</dl>`
        : "";
      const photo = f.photoUrl ? `<div class="a-r"><div class="pic">${photoTag(f, { alt: f.name })}</div></div>` : "";
      const html = `<div class="a-l">${eb([h1 === f.name ? undefined : f.name, f.headline, f.location])}<h1>${esc(h1)}</h1>${f.summary ? `<p class="lead">${esc(f.summary)}</p>` : ""}${buttons ? `<div class="btns">${buttons}</div>` : ""}${stats}</div>${photo}`;
      return [
        {
          id: "f-about",
          name: "About",
          kind: "About",
          cls: f.photoUrl ? "about has-pic" : "about",
          html,
          ins: { kv: [["Name", f.name], ["Role", f.headline], ["Based in", f.location], ["Email", f.email], ["Phone", f.phone]], metrics: f.stats },
        },
      ];
    }
    case "experience":
      return f.experience.map((x, i) => ({
        id: `f-exp-${i}`,
        name: x.org,
        kind: "Experience",
        html: `${eb(["Experience", x.period])}<h2>${esc(x.role)}</h2><p class="org">${esc(x.org)}${x.location ? ` &middot; ${esc(x.location)}` : ""}</p>${x.summary ? `<p>${esc(x.summary)}</p>` : ""}${bullets(x.bullets)}`,
        ins: { kv: [["Role", x.role], ["Company", x.org], ["Period", x.period], ["Where", x.location]] },
      }));
    case "projects":
      return f.projects.map((p, i) => {
        const href = safeHref(p.link);
        const mets = p.metrics.length ? `<dl class="stats">${p.metrics.map((s) => `<div><dt>${esc(s.value)}</dt><dd>${esc(s.label)}</dd></div>`).join("")}</dl>` : "";
        return {
          id: `f-proj-${i}`,
          name: p.name,
          kind: "Project",
          html: `${eb(["Project", p.role, p.period])}<h2>${esc(p.name)}</h2>${p.description ? `<p>${esc(p.description)}</p>` : ""}${bullets(p.bullets)}${mets}${chips(p.tags)}${href ? `<div class="btns">${btn("Open project", href, "lime")}</div>` : ""}`,
          ins: { kv: [["Name", p.name], ["Role", p.role], ["Period", p.period]], metrics: p.metrics, tags: p.tags, actions: href ? [{ label: "Open project", href }] : [] },
        };
      });
    case "skills":
      return [
        {
          id: "f-skills",
          name: "Skills",
          kind: "Skills",
          html: `${eb(["Skills"])}${f.skills.map((g) => `<div class="grp">${g.group ? `<h3>${esc(g.group)}</h3>` : ""}${chips(g.items)}</div>`).join("")}`,
          ins: { kv: f.skills.map((g, i): [string, string] => [g.group ?? (i === 0 ? "Skills" : ""), g.items.join(", ")]) },
        },
      ];
    case "education":
      return f.education.map((e, i) => ({
        id: `f-edu-${i}`,
        name: e.school,
        kind: "Education",
        html: `${eb(["Education", e.period])}<h2>${esc(e.school)}</h2>${e.degree ? `<p class="org">${esc(e.degree)}</p>` : ""}${e.detail ? `<p>${esc(e.detail)}</p>` : ""}`,
        ins: { kv: [["School", e.school], ["Degree", e.degree], ["Period", e.period], ["Detail", e.detail]] },
      }));
    case "achievements":
      return [
        {
          id: "f-wins",
          name: "Wins",
          kind: "Wins",
          html: `${eb(["Wins"])}<ul class="rows">${f.achievements.map((a) => `<li><b>${esc(a.title)}</b>${a.year ? ` <span class="mono">${esc(a.year)}</span>` : ""}${a.detail ? `<span class="sub">${esc(a.detail)}</span>` : ""}</li>`).join("")}</ul>`,
          ins: { kv: f.achievements.map((a): [string, string | undefined] => [a.year ?? "Win", a.title]) },
        },
      ];
    case "certifications":
      return [
        {
          id: "f-certs",
          name: "Certifications",
          kind: "Certifications",
          html: `${eb(["Certifications"])}<ul class="rows">${f.certifications.map((c) => `<li><b>${esc(c.name)}</b>${c.year ? ` <span class="mono">${esc(c.year)}</span>` : ""}${c.issuer ? `<span class="sub">${esc(c.issuer)}</span>` : ""}</li>`).join("")}</ul>`,
          ins: { kv: f.certifications.map((c): [string, string | undefined] => [c.issuer ?? "Certificate", c.name]) },
        },
      ];
    case "testimonials":
      return f.testimonials.map((t, i) => ({
        id: `f-quote-${i}`,
        name: t.author,
        kind: "Testimonial",
        html: `${eb(["Testimonial"])}<blockquote><p>${esc(t.quote)}</p><footer>${esc(t.author)}${t.role ? `, ${esc(t.role)}` : ""}</footer></blockquote>`,
        ins: { kv: [["From", t.author], ["Role", t.role]] },
      }));
    case "extras":
      return f.extras.map((x, i) => ({
        id: `f-more-${i}`,
        name: x.label,
        kind: "More",
        html: `${eb([x.label])}${chips(x.items)}`,
        ins: { kv: [[x.label, x.items.join(", ")]] },
      }));
    case "contact": {
      const links = f.links.map((l) => ({ l, h: safeHref(l.url) })).filter((x) => x.h);
      const rows = [
        f.email ? `<li><span class="mono">Email</span><a href="${attr(`mailto:${f.email}`)}">${esc(f.email)}</a></li>` : "",
        f.phone ? `<li><span class="mono">Phone</span><a href="${attr(`tel:${f.phone}`)}">${esc(f.phone)}</a></li>` : "",
        f.location ? `<li><span class="mono">Based in</span><span>${esc(f.location)}</span></li>` : "",
        ...links.map((x) => `<li><span class="mono">${esc(x.l.label)}</span><a href="${attr(x.h as string)}" target="_blank" rel="noopener noreferrer">${esc(x.l.url.replace(/^https?:\/\/(www\.)?/i, ""))}</a></li>`),
      ].join("");
      const actions = [
        ...(f.email ? [{ label: "Email", href: `mailto:${f.email}` }] : []),
        ...links.map((x) => ({ label: x.l.label, href: x.h as string })),
      ];
      return [
        {
          id: "f-contact",
          name: "Contact",
          kind: "Contact",
          html: `${eb(["Contact"])}<ul class="contact">${rows}</ul>`,
          ins: { kv: [["Email", f.email], ["Phone", f.phone], ["Based in", f.location]], actions },
        },
      ];
    }
  }
}

function insHtml(fr: Frame): string {
  const kv = fr.ins.kv.filter((r): r is [string, string] => Boolean(r[1]));
  const sec = (title: string, body: string) => (body ? `<div class="psec"><h4>${title}</h4>${body}</div>` : "");
  return `<div class="ins" data-f="${attr(fr.id)}" hidden>
<div class="psec"><div class="sel-name"><span class="ic">#</span>${esc(fr.name)}</div><div class="sel-kind">Frame &middot; ${esc(fr.kind)}</div></div>
<div class="psec"><h4>Frame</h4><div class="xywh"><div><span>W</span><b data-w></b></div><div><span>H</span><b data-h></b></div></div></div>
${sec("Facts", kv.length ? `<dl class="kv">${kv.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` : "")}
${sec("Proof", fr.ins.metrics?.length ? fr.ins.metrics.map((m) => `<div class="mrow"><b>${esc(m.value)}</b><span>${esc(m.label)}</span></div>`).join("") : "")}
${sec("Tags", fr.ins.tags?.length ? `<div class="tchips">${fr.ins.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : "")}
${sec("Links", fr.ins.actions?.length ? `<div class="pact">${fr.ins.actions.map((a) => `<a href="${attr(a.href)}"${/^https?:/i.test(a.href) ? ` target="_blank" rel="noopener noreferrer"` : ""}>${esc(a.label)}<span aria-hidden="true">&#8599;</span></a>`).join("")}</div>` : "")}
</div>`;
}

const CSS = `
:root{--font:'Inter Tight',system-ui,Arial,sans-serif;--mono:'IBM Plex Mono',ui-monospace,Menlo,monospace;
--chrome:#fff;--chrome-line:#e6e6e6;--chrome-ink:#1e1e1e;--chrome-mute:#6f6f6f;--chrome-hover:#f2f2f2;
--canvas:#e9e7e2;--dot:#cfccc5;--select:#0d99ff;--select-soft:#e5f4ff;--section:#f4f2ee;
--paper:${PAPER};--ink:#141414;--mute:#5c5a55;--rule:#d9d5cc;--red:#e5322d;--lime:#dfff7a;--blue:var(--acc);
--r-panel:12px;--shadow-panel:0 1px 3px rgba(0,0,0,.08),0 8px 24px rgba(0,0,0,.08);
--fp:22px;--fs:16px;--h1:34px;--h2:26px}
*{box-sizing:border-box}
html,body{margin:0}
body{font-family:var(--font);color:var(--ink);background:var(--canvas);-webkit-font-smoothing:antialiased;font-size:14px}
img{display:block;max-width:100%}
a{color:inherit}
button{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--select);outline-offset:2px}
.sr-only{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
/* top bar */
.topbar{position:sticky;top:0;height:48px;background:var(--chrome);border-bottom:1px solid var(--chrome-line);display:flex;align-items:center;gap:12px;padding:0 12px;z-index:40;color:var(--chrome-ink)}
.tb-left{display:flex;align-items:center;gap:10px;flex:1;min-width:0}
.mark{width:30px;height:30px;border-radius:7px;background:var(--ink);color:var(--lime);display:grid;place-items:center;font:700 12px/1 var(--font);letter-spacing:-.02em;flex:none}
.file{display:flex;gap:6px;font-size:13px;min-width:0;white-space:nowrap;overflow:hidden}
.file span{color:var(--chrome-mute)}
.file b{font-weight:600;overflow:hidden;text-overflow:ellipsis}
.tb-center{display:none;align-items:center;gap:8px;font-size:13px;font-weight:500}
.tb-center img{width:24px;height:24px;border-radius:50%;object-fit:cover}
.tb-right{display:flex;align-items:center;gap:8px;flex:none;justify-content:flex-end}
.tbtn{height:32px;border-radius:6px;border:1px solid var(--chrome-line);background:none;display:inline-flex;align-items:center;gap:6px;padding:0 10px;cursor:pointer;font-size:12px;font-weight:500;text-decoration:none;white-space:nowrap}
.tbtn:hover{background:var(--chrome-hover)}
.tbtn svg{width:16px;height:16px;flex:none}
.tbtn.primary{background:var(--select);color:#fff;border-color:var(--select)}
.tbtn.primary:hover{background:#0a86e0}
#readBtn{display:none}
.cv #readBtn{display:inline-flex}
/* chips strip (read view) */
.mstrip{position:sticky;top:48px;z-index:39;background:var(--chrome);border-bottom:1px solid var(--chrome-line);display:flex;gap:6px;padding:8px 12px;overflow-x:auto;scrollbar-width:none}
.mstrip a{flex:none;border:1px solid var(--chrome-line);border-radius:999px;padding:5px 12px;font-size:13px;text-decoration:none;color:var(--chrome-ink);background:#fff}
.mstrip a:hover{background:var(--select-soft);border-color:var(--select)}
/* panels and canvas chrome are canvas-only */
.panel,.toolbar,.hint{display:none}
/* read view (default, and the no-JS view) */
.viewport{display:block}
.world{display:flex;flex-direction:column;gap:28px;padding:20px 12px 60px;max-width:960px;margin:0 auto}
.sec{display:flex;flex-direction:column;gap:14px}
.sl{margin:0;font:600 12px/1 var(--font);letter-spacing:.06em;text-transform:uppercase;color:var(--mute)}
.frame{position:relative;background:var(--paper);border:1px solid var(--rule);border-radius:6px;padding:var(--fp);font-size:var(--fs);line-height:1.5;display:flex;flex-direction:column;gap:12px;min-width:0;overflow-wrap:anywhere}
.frame:focus-visible{outline:2px solid var(--select)}
.dim{display:none}
/* frame content */
.eb{margin:0;font:500 12px/1.4 var(--font);letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}
.eb i{font-style:normal;color:var(--red);font-weight:700;margin-right:4px}
.frame h1{margin:0;font-size:var(--h1);line-height:1.05;letter-spacing:-.03em;font-weight:600}
.frame h2{margin:0;font-size:var(--h2);line-height:1.12;letter-spacing:-.025em;font-weight:600}
.frame h3{margin:0 0 6px;font-size:13px;font-weight:600;letter-spacing:.02em;color:var(--mute);text-transform:uppercase}
.frame p{margin:0}
.lead{color:#3b3a37;font-size:1.06em}
.org{color:var(--mute);font-weight:500}
.bl{margin:0;padding-left:1.1em;display:grid;gap:6px}
.bl li::marker{color:var(--red)}
.chips{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px}
.chips li{border:1px solid var(--rule);background:#fff;border-radius:2px;padding:5px 9px;font:500 12px/1.2 var(--font);text-transform:uppercase;letter-spacing:.04em}
.grp+.grp{margin-top:10px}
.btns{display:flex;flex-wrap:wrap;gap:10px;margin-top:4px}
.btn{display:inline-flex;align-items:center;gap:6px;border:1.5px solid var(--ink);background:#fff;color:var(--ink);padding:9px 14px;font-weight:500;font-size:.92em;text-decoration:none;box-shadow:3px 3px 0 var(--ink);transition:transform .12s,box-shadow .12s}
.btn.lime{background:var(--lime)}
.btn:hover{transform:translate(1px,1px);box-shadow:2px 2px 0 var(--ink)}
.stats{margin:6px 0 0;padding-top:14px;border-top:1px solid var(--rule);display:flex;flex-wrap:wrap;gap:14px 28px}
.stats div{min-width:0}
.stats dt{font-size:1.7em;line-height:1.1;letter-spacing:-.02em;color:var(--blue);font-weight:500}
.stats dd{margin:3px 0 0;font-size:.78em;color:var(--mute);max-width:170px;line-height:1.35}
.about{display:grid;gap:20px}
.a-l{display:flex;flex-direction:column;gap:14px;justify-content:center;min-width:0}
.a-r{min-width:0}
.pic{background:var(--blue);border-radius:4px;aspect-ratio:4/3;display:flex;align-items:flex-end;justify-content:center;padding:16px 16px 0;background-image:linear-gradient(rgba(255,255,255,.14) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.14) 1px,transparent 1px);background-size:32px 32px;overflow:hidden}
.pic img{height:100%;width:auto;max-width:78%;object-fit:cover;border-radius:3px 3px 0 0;box-shadow:0 12px 30px rgba(0,0,0,.28)}
.rows{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.rows li{border-bottom:1px dashed var(--rule);padding-bottom:10px;display:flex;flex-wrap:wrap;gap:2px 10px;align-items:baseline}
.rows li:last-child{border-bottom:0;padding-bottom:0}
.rows .sub{flex-basis:100%;color:var(--mute);font-size:.92em}
.mono{font-family:var(--mono);font-size:.82em;color:var(--blue)}
blockquote{margin:0;display:grid;gap:14px}
blockquote p{font-size:1.45em;line-height:1.3;letter-spacing:-.015em;font-weight:500}
blockquote footer{color:var(--mute);font-size:.9em}
.contact{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.contact li{display:grid;gap:2px;border-bottom:1px dashed var(--rule);padding-bottom:10px}
.contact li:last-child{border-bottom:0}
.contact a{font-size:1.25em;letter-spacing:-.01em;font-weight:500;text-decoration:none;border-bottom:2px solid var(--lime);justify-self:start;max-width:100%;overflow-wrap:anywhere}
.contact a:hover{background:var(--lime)}
.contact span:not(.mono){font-size:1.25em;font-weight:500}
@media (min-width:700px){:root{--fp:36px;--fs:17px;--h1:48px;--h2:32px}.about.has-pic{grid-template-columns:1.1fr 1fr}}
/* ============ canvas mode ============ */
.cv:not(.rd),.cv:not(.rd) body{height:100%;overflow:hidden}
.cv:not(.rd) body{font-size:12px;color:var(--chrome-ink)}
.cv:not(.rd) .topbar{position:fixed;inset:0 0 auto}
.cv:not(.rd) .mstrip{display:none}
.cv:not(.rd) .tb-center{display:flex}
.cv:not(.rd) .viewport{position:fixed;inset:48px 0 0;overflow:hidden;background-color:var(--canvas);background-image:radial-gradient(var(--dot) 1px,transparent 1.2px);background-size:var(--gs,24px) var(--gs,24px);background-position:var(--gx,0) var(--gy,0);touch-action:none;outline:none;cursor:default}
.cv:not(.rd) .viewport.dragging{cursor:grabbing}
.cv:not(.rd) .world{position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform;display:flex;flex-direction:row;flex-wrap:wrap;align-items:flex-start;gap:140px 120px;padding:120px 80px;width:3100px;max-width:none;margin:0;user-select:none;-webkit-user-select:none}
.cv:not(.rd) .sec{position:relative;flex-direction:row;flex-wrap:wrap;gap:40px;padding:40px;width:max-content;max-width:1840px;background:var(--section);border:1px solid #d8d4cb;border-radius:calc(10px * var(--iz,1))}
.cv:not(.rd) .sl{position:absolute;left:24px;top:-2px;transform-origin:0 100%;transform:translateY(-100%) scale(var(--iz,1));background:#fff;border:1px solid #d8d4cb;border-radius:6px;padding:6px 10px;font:600 12px/1 var(--font);letter-spacing:0;text-transform:none;color:var(--chrome-ink);white-space:nowrap;margin-top:-6px}
.cv:not(.rd) .frame{flex:none;width:560px;--fp:44px;--fs:17px;--h1:60px;--h2:38px;border:0;border-radius:2px;box-shadow:0 1px 2px rgba(0,0,0,.06),0 6px 22px rgba(10,30,12,.08);cursor:default;gap:16px}
.cv:not(.rd) .frame.about{width:1160px}
.cv:not(.rd) .frame.about:not(.has-pic){width:760px}
.cv:not(.rd) .about.has-pic{grid-template-columns:1.1fr 1fr;gap:36px}
.cv:not(.rd) .pic{aspect-ratio:auto;height:100%;min-height:420px}
.cv:not(.rd) .frame.is-hover::after,.cv:not(.rd) .frame.is-sel::after{content:"";position:absolute;inset:0;pointer-events:none;outline:calc(1.5px * var(--iz,1)) solid var(--select);z-index:6}
.cv:not(.rd) .frame.is-sel .dim{display:block;position:absolute;left:50%;top:100%;transform-origin:50% 0;transform:translateX(-50%) translateY(calc(8px * var(--iz,1))) scale(var(--iz,1));background:var(--select);color:#fff;font:500 11px/1 var(--mono);padding:4px 6px;border-radius:3px;white-space:nowrap;z-index:7}
.cv:not(.rd) .panel{display:flex;position:fixed;top:60px;bottom:12px;width:244px;background:var(--chrome);border-radius:var(--r-panel);box-shadow:var(--shadow-panel);z-index:30;flex-direction:column;overflow:hidden}
.panel.left{left:12px}
.panel.right{right:12px;width:272px}
.ph{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--chrome-line);font-weight:600;font-size:12px;flex:none}
.ph small{font-weight:400;color:var(--chrome-mute)}
.ph button{border:0;background:none;cursor:pointer;font-size:16px;line-height:1;padding:2px 6px;border-radius:4px;display:none}
.ph button:hover{background:var(--chrome-hover)}
.pscroll{overflow:auto;flex:1;padding:6px 0 10px;overscroll-behavior:contain}
.layers{padding:4px 6px}
.layer{display:flex;align-items:center;gap:8px;width:100%;border:0;background:none;text-align:left;padding:0 8px;height:30px;border-radius:5px;cursor:pointer;font-size:12px;white-space:nowrap;overflow:hidden}
.layer:hover{background:var(--chrome-hover)}
.layer[aria-current="true"]{background:var(--select-soft);color:#0a6fb8;font-weight:500}
.layer .ic{width:14px;text-align:center;color:var(--chrome-mute);font:500 12px/1 var(--mono);flex:none}
.layer[aria-current="true"] .ic{color:var(--select)}
.layer.child{padding-left:30px}
.layer .nm{overflow:hidden;text-overflow:ellipsis}
.panel-foot{border-top:1px solid var(--chrome-line);padding:10px 14px;color:var(--chrome-mute);font-size:11px;line-height:1.6;flex:none}
kbd{font:500 10px/1 var(--mono);border:1px solid var(--chrome-line);border-bottom-width:2px;border-radius:4px;padding:2px 4px;background:#fff;color:var(--chrome-ink)}
.psec{padding:12px 14px;border-bottom:1px solid var(--chrome-line)}
.psec h4{margin:0 0 10px;font-size:11px;font-weight:600}
.sel-name{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;overflow-wrap:anywhere}
.sel-name .ic{color:var(--select);font:500 12px var(--mono)}
.sel-kind{color:var(--chrome-mute);font-size:11px;margin-top:3px}
.xywh{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.xywh div{background:var(--chrome-hover);border-radius:5px;padding:6px 8px;display:flex;gap:8px;font:400 11px/1 var(--mono)}
.xywh span{color:var(--chrome-mute)}
.xywh b{font-weight:400}
.kv{display:grid;grid-template-columns:78px 1fr;gap:7px 10px;margin:0;font-size:12px;line-height:1.4}
.kv dt{color:var(--chrome-mute)}
.kv dd{margin:0;overflow-wrap:anywhere}
.mrow{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:6px 0;border-bottom:1px dashed var(--chrome-line)}
.mrow:last-child{border-bottom:0}
.mrow b{font:500 13px/1.2 var(--mono);color:var(--blue);white-space:nowrap}
.mrow span{color:var(--chrome-mute);text-align:right;font-size:11.5px;line-height:1.35}
.tchips{display:flex;flex-wrap:wrap;gap:5px}
.tchips span{background:var(--chrome-hover);border-radius:4px;padding:4px 7px;font-size:11px}
.pact{display:flex;flex-direction:column;gap:6px}
.pact a{display:flex;justify-content:space-between;align-items:center;border:1px solid var(--chrome-line);border-radius:6px;padding:8px 10px;background:#fff;text-decoration:none;font-size:12px;font-weight:500}
.pact a:hover{background:var(--chrome-hover)}
.empty{padding:16px 14px;color:var(--chrome-mute);line-height:1.5;font-size:12px}
.has-sel .empty{display:none}
.toolbar{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);background:var(--chrome);border-radius:12px;box-shadow:var(--shadow-panel);align-items:center;gap:2px;padding:5px;z-index:35}
.cv:not(.rd) .toolbar{display:flex}
.tool{white-space:nowrap;min-width:36px;height:36px;border-radius:8px;border:0;background:none;display:grid;place-items:center;cursor:pointer;padding:0 8px;font:500 13px var(--font)}
.tool:hover{background:var(--chrome-hover)}
.zoomread{font:500 12px/1 var(--mono);min-width:56px}
.tsep{width:1px;height:22px;background:var(--chrome-line);margin:0 4px}
.cv:not(.rd) .hint{display:block;position:fixed;left:50%;transform:translateX(-50%);bottom:72px;background:var(--chrome);border-radius:10px;box-shadow:var(--shadow-panel);padding:9px 12px;font-size:11.5px;color:#444;z-index:34;white-space:nowrap;transition:opacity .4s}
.hint.gone{opacity:0;pointer-events:none}
@media (max-width:899px){
.cv:not(.rd) .panel.left{display:none}
.cv:not(.rd) .hint{display:none}
.cv:not(.rd) .tb-center{display:none}
.cv:not(.rd) .panel.right{top:auto;bottom:70px;left:12px;right:12px;width:auto;max-height:34vh;display:none}
.cv:not(.rd).has-sel .panel.right{display:flex}
.ph button{display:block}
.tbtn.primary{display:none}
}
@media (min-width:900px){.cv:not(.rd) .panel.right .ph button{display:none}}
.cv.rd .world{transform:none!important}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

const JS = `
(function(){
var d=document,root=d.documentElement,vp=d.getElementById("vp"),world=d.getElementById("world");
if(!vp||!world)return;
var frames=[].slice.call(d.querySelectorAll(".frame"));
var cam={x:0,y:0,k:1},sel=null,inited=false,touched=false,anim=0;
var reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
var MIN=.05,MAX=2.5;
var zr=d.getElementById("zoomRead"),hint=d.getElementById("hint"),layersEl=d.getElementById("layers");
function on(){return !root.classList.contains("rd");}
function insets(){var w=innerWidth;if(w>=900)return{l:268,r:296,t:12,b:80};return{l:12,r:12,t:12,b:sel?Math.round(innerHeight*.34)+90:84};}
function apply(){
world.style.transform="translate("+cam.x+"px,"+cam.y+"px) scale("+cam.k+")";
world.style.setProperty("--iz",Math.min(4,1/cam.k).toFixed(3));
vp.style.setProperty("--gs",Math.max(10,24*cam.k)+"px");vp.style.setProperty("--gx",cam.x+"px");vp.style.setProperty("--gy",cam.y+"px");
if(zr)zr.textContent=Math.round(cam.k*100)+"%";
}
function box(el){var a=el.getBoundingClientRect(),b=vp.getBoundingClientRect();return{x:(a.left-b.left-cam.x)/cam.k,y:(a.top-b.top-cam.y)/cam.k,w:a.width/cam.k,h:a.height/cam.k};}
function clamp(k){return Math.max(MIN,Math.min(MAX,k));}
function zoomAt(px,py,nk){nk=clamp(nk);var r=nk/cam.k;cam.x=px-(px-cam.x)*r;cam.y=py-(py-cam.y)*r;cam.k=nk;}
function target(b,cap){var i=insets(),vw=vp.clientWidth,vh=vp.clientHeight,aw=Math.max(80,vw-i.l-i.r),ah=Math.max(80,vh-i.t-i.b);
var k=clamp(Math.min(aw/b.w,ah/b.h,cap));
return{k:k,x:i.l+(aw-b.w*k)/2-b.x*k,y:i.t+(ah-b.h*k)/2-b.y*k};}
function flyTo(t){cancelAnimationFrame(anim);
if(reduce){cam.x=t.x;cam.y=t.y;cam.k=t.k;apply();return;}
var s={x:cam.x,y:cam.y,k:cam.k},t0=performance.now(),D=340;
(function step(n){var p=Math.min(1,(n-t0)/D),e=1-Math.pow(1-p,3);
cam.x=s.x+(t.x-s.x)*e;cam.y=s.y+(t.y-s.y)*e;cam.k=s.k+(t.k-s.k)*e;apply();
if(p<1)anim=requestAnimationFrame(step);})(t0);}
function fitFrame(f){flyTo(target(box(f),1));}
function fitAll(){flyTo(target(box(world),1));}
function fitSection(s){flyTo(target(box(s),1));}
var layerBtn={};
function select(f){
if(sel===f)return;
if(sel){sel.classList.remove("is-sel");if(layerBtn[sel.id])layerBtn[sel.id].removeAttribute("aria-current");}
sel=f;
[].forEach.call(d.querySelectorAll(".ins"),function(n){n.hidden=!(f&&n.getAttribute("data-f")===f.id);});
if(f){f.classList.add("is-sel");root.classList.add("has-sel");if(layerBtn[f.id])layerBtn[f.id].setAttribute("aria-current","true");
var b=f.getBoundingClientRect(),m=d.querySelector('.ins[data-f="'+f.id+'"]');
if(m){var w=m.querySelector("[data-w]"),h=m.querySelector("[data-h]");if(w)w.textContent=Math.round(b.width/cam.k);if(h)h.textContent=Math.round(b.height/cam.k);}
var dm=f.querySelector(".dim");if(dm)dm.textContent=Math.round(b.width/cam.k)+" x "+Math.round(b.height/cam.k);
}else root.classList.remove("has-sel");
}
function deselect(){select(null);}
frames.forEach(function(f){
var dm=d.createElement("b");dm.className="dim";dm.setAttribute("aria-hidden","true");f.appendChild(dm);
f.addEventListener("pointerenter",function(){if(on())f.classList.add("is-hover");});
f.addEventListener("pointerleave",function(){f.classList.remove("is-hover");});
f.addEventListener("focusin",function(e){if(!on())return;select(f);
if(e.target.matches&&e.target.matches(":focus-visible")){var r=f.getBoundingClientRect(),v=vp.getBoundingClientRect(),i=insets();
if(r.left<v.left+i.l||r.right>v.right-i.r||r.top<v.top+i.t||r.bottom>v.bottom-i.b)fitFrame(f);}});
});
// layers panel from the DOM
[].forEach.call(d.querySelectorAll(".sec"),function(s){
var fs=[].slice.call(s.querySelectorAll(".frame"));
function row(txt,cls,fn){var b=d.createElement("button");b.type="button";b.className="layer "+cls;var ic=d.createElement("span");ic.className="ic";ic.textContent="#";var nm=d.createElement("span");nm.className="nm";nm.textContent=txt;b.appendChild(ic);b.appendChild(nm);b.addEventListener("click",fn);layersEl.appendChild(b);return b;}
if(fs.length===1){var f=fs[0];layerBtn[f.id]=row(f.getAttribute("data-name"),"",function(){select(f);fitFrame(f);touched=true;});}
else{row(s.getAttribute("data-label"),"",function(){fitSection(s);touched=true;}).firstChild.textContent="\\u25A6";
fs.forEach(function(f){layerBtn[f.id]=row(f.getAttribute("data-name"),"child",function(){select(f);fitFrame(f);touched=true;});});}
});
var lc=d.getElementById("lcount");if(lc)lc.textContent=frames.length+(frames.length===1?" frame":" frames");
// pointer: pan, pinch, click-to-select
var pts={},drag=null,pinch=null;
function np(){return Object.keys(pts).length;}
vp.addEventListener("pointerdown",function(e){if(!on()||e.button>0)return;if(e.target.closest&&e.target.closest("a,button"))return;
cancelAnimationFrame(anim);touched=true;pts[e.pointerId]={x:e.clientX,y:e.clientY};
if(np()===1){drag={sx:e.clientX,sy:e.clientY,cx:cam.x,cy:cam.y,moved:false,t:e.target};}
else if(np()===2){var k=Object.keys(pts),a=pts[k[0]],b=pts[k[1]],r=vp.getBoundingClientRect();
pinch={d:Math.hypot(a.x-b.x,a.y-b.y)||1,k:cam.k,cx:(a.x+b.x)/2-r.left,cy:(a.y+b.y)/2-r.top};pinch.wx=(pinch.cx-cam.x)/cam.k;pinch.wy=(pinch.cy-cam.y)/cam.k;drag=null;}
});
vp.addEventListener("pointermove",function(e){if(!pts[e.pointerId])return;pts[e.pointerId]={x:e.clientX,y:e.clientY};
if(pinch&&np()>=2){var k=Object.keys(pts),a=pts[k[0]],b=pts[k[1]],r=vp.getBoundingClientRect();
var nk=clamp(pinch.k*Math.hypot(a.x-b.x,a.y-b.y)/pinch.d),cx=(a.x+b.x)/2-r.left,cy=(a.y+b.y)/2-r.top;
cam.k=nk;cam.x=cx-pinch.wx*nk;cam.y=cy-pinch.wy*nk;apply();return;}
if(drag){var dx=e.clientX-drag.sx,dy=e.clientY-drag.sy;
if(!drag.moved&&Math.hypot(dx,dy)>5){drag.moved=true;vp.classList.add("dragging");try{vp.setPointerCapture(e.pointerId);}catch(x){}}
if(drag.moved){cam.x=drag.cx+dx;cam.y=drag.cy+dy;apply();}}
});
function up(e){if(!pts[e.pointerId])return;delete pts[e.pointerId];
if(pinch&&np()<2){pinch=null;drag=null;}
if(np()===0){vp.classList.remove("dragging");
if(drag&&!drag.moved&&e.type==="pointerup"){var f=drag.t.closest&&drag.t.closest(".frame");if(f)select(f);else deselect();}
drag=null;}
}
vp.addEventListener("pointerup",up);vp.addEventListener("pointercancel",up);
vp.addEventListener("wheel",function(e){if(!on())return;e.preventDefault();cancelAnimationFrame(anim);touched=true;
var r=vp.getBoundingClientRect();
if(e.ctrlKey||e.metaKey){zoomAt(e.clientX-r.left,e.clientY-r.top,cam.k*Math.exp(-e.deltaY*(e.ctrlKey?.01:.0025)));}
else{cam.x-=e.shiftKey?e.deltaY:e.deltaX;cam.y-=e.shiftKey?0:e.deltaY;}
apply();},{passive:false});
function zoomBy(m){touched=true;var r=vp.getBoundingClientRect(),i=insets();var cx=i.l+(r.width-i.l-i.r)/2,cy=i.t+(r.height-i.t-i.b)/2;zoomAt(cx,cy,cam.k*m);apply();}
d.getElementById("zIn").addEventListener("click",function(){zoomBy(1.25);});
d.getElementById("zOut").addEventListener("click",function(){zoomBy(.8);});
d.getElementById("zFit").addEventListener("click",function(){touched=true;fitAll();});
d.getElementById("zSel").addEventListener("click",function(){touched=true;if(sel)fitFrame(sel);else fitAll();});
zr.addEventListener("click",function(){touched=true;var r=vp.getBoundingClientRect(),i=insets();zoomAt(i.l+(r.width-i.l-i.r)/2,i.t+(r.height-i.t-i.b)/2,1);apply();});
var cl=d.getElementById("closeIns");if(cl)cl.addEventListener("click",deselect);
// read toggle
var rb=d.getElementById("readBtn"),rl=d.getElementById("readLbl");
function setMode(read){root.classList.toggle("rd",read);rb.setAttribute("aria-pressed",read?"true":"false");rl.textContent=read?"Canvas":"Read all";
if(!read){if(!inited)init();else apply();}else{[].forEach.call(frames,function(f){f.classList.remove("is-hover");});scrollTo(0,0);}}
rb.addEventListener("click",function(){setMode(on());});
// keyboard
d.addEventListener("keydown",function(e){if(e.altKey||e.ctrlKey||e.metaKey)return;var k=e.key,t=e.target;
if(k==="r"||k==="R"){setMode(on());return;}
if(!on())return;
if(k==="Escape"){deselect();return;}
if(k==="+"||k==="="){zoomBy(1.25);e.preventDefault();return;}
if(k==="-"||k==="_"){zoomBy(.8);e.preventDefault();return;}
if(k==="f"||k==="F"){touched=true;fitAll();return;}
if(k==="Enter"&&t&&t.classList&&t.classList.contains("frame")){select(t);fitFrame(t);touched=true;return;}
if(t&&t.closest&&t.closest(".panel"))return;
var s=e.shiftKey?240:80,m=false;
if(k==="ArrowLeft"){cam.x+=s;m=true;}else if(k==="ArrowRight"){cam.x-=s;m=true;}else if(k==="ArrowUp"){cam.y+=s;m=true;}else if(k==="ArrowDown"){cam.y-=s;m=true;}
if(m){e.preventDefault();cancelAnimationFrame(anim);touched=true;apply();}
});
function init(){inited=true;var f=frames[0];if(f){select(f);}
var tgt=f?target(box(f),1):target(box(world),1);cam.x=tgt.x;cam.y=tgt.y;cam.k=tgt.k;apply();
if(hint)setTimeout(function(){hint.classList.add("gone");},9000);}
rb.setAttribute("aria-pressed",on()?"false":"true");rl.textContent=on()?"Read all":"Canvas";
if(on()){init();if(d.fonts&&d.fonts.ready)d.fonts.ready.then(function(){if(!touched&&on()&&sel){var t=target(box(sel),1);cam.x=t.x;cam.y=t.y;cam.k=t.k;apply();}});}
})();
`;

const render: ThemeTemplate["render"] = ({ facts, custom }) => {
  const sections = visibleSections(facts, custom, SUPPORTED);
  const accent = accentColour(custom, DEFAULT_ACCENT, PAPER);
  const fo = fontOverride(custom);
  const fonts = [{ family: "Inter Tight", weights: "400;500;600;700" }, { family: "IBM Plex Mono", weights: "400;500" }];
  if (fo && !fonts.some((f) => f.family === fo.family)) fonts.push({ family: fo.family, weights: "400;500;600;700" });
  const fontVars = fo ? `--font:${fo.stack};${custom.fonts === "mono" ? `--mono:${fo.stack};` : ""}` : "";

  const built = sections.map((key) => ({ key, frames: buildFrames(facts, key) })).filter((s) => s.frames.length > 0);
  const allFrames = built.flatMap((s) => s.frames);

  const secHtml = built
    .map((s) => {
      const label = SECTION_LABEL[s.key];
      return `<section class="sec" id="s-${s.key}" data-label="${attr(label)}" aria-label="${attr(label)}"><h2 class="sl">${esc(label)}</h2>${s.frames
        .map((fr) => `<article class="frame ${fr.cls ?? ""}" id="${attr(fr.id)}" data-name="${attr(fr.name)}" tabindex="0" aria-label="${attr(`${fr.kind}: ${fr.name}`)}">${fr.html}</article>`)
        .join("")}</section>`;
    })
    .join("\n");

  const strip = built.map((s) => `<a href="#s-${s.key}">${esc(SECTION_LABEL[s.key])}</a>`).join("");
  const links = facts.links.map((l) => ({ l, h: safeHref(l.url) })).find((x) => x.h);
  const cta = facts.email
    ? `<a class="tbtn primary" href="${attr(`mailto:${facts.email}`)}">Get in touch</a>`
    : links
      ? `<a class="tbtn primary" href="${attr(links.h as string)}" target="_blank" rel="noopener noreferrer">${esc(links.l.label)}</a>`
      : "";
  const face = facts.photoUrl ? photoTag(facts, { alt: "", className: "face" }).replace(` class="face"`, ` class="face" width="24" height="24"`) : "";
  const title = facts.headline ? `${facts.name} · ${facts.headline}` : facts.name;
  const desc = facts.tagline ?? facts.summary ?? facts.headline ?? facts.name;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${attr(desc.slice(0, 200))}">
<link rel="stylesheet" href="${attr(googleFontsHref(fonts))}">
${scriptTag(`(function(){var r=document.documentElement;r.classList.add("cv");if(innerWidth<900)r.classList.add("rd");})();`)}
<style>:root{--acc:${accent};${fontVars}}${CSS}</style>
</head>
<body>
<a class="sr-only" href="#read">Skip to the readable version</a>
<header class="topbar">
  <div class="tb-left"><div class="mark" aria-hidden="true">${esc(initials(facts.name))}</div><div class="file"><span>${esc(facts.name)} /</span> <b>Portfolio</b></div></div>
  <div class="tb-center">${face}<span>${esc(facts.name)}${facts.headline ? `, ${esc(facts.headline)}` : ""}</span></div>
  <div class="tb-right">
    <button class="tbtn" id="readBtn" type="button" aria-pressed="false" title="Read everything as one page (R)"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M3 2.5h7l3 3v8H3z"/><path d="M5.5 7.5h5M5.5 10h5"/></svg><span id="readLbl">Read all</span></button>
    ${cta}
  </div>
</header>
<nav class="mstrip" aria-label="Sections">${strip}</nav>
<aside class="panel left" aria-label="Layers"><div class="ph">Layers <small id="lcount"></small></div><div class="pscroll"><div class="layers" id="layers"></div></div>
<div class="panel-foot">Drag to pan. <kbd>Ctrl</kbd> + scroll or pinch to zoom. <kbd>F</kbd> shows everything, <kbd>R</kbd> reads it as a page.</div></aside>
<aside class="panel right" aria-label="Inspector"><div class="ph">Inspect <button type="button" id="closeIns" aria-label="Close inspector">&times;</button></div><div class="pscroll">
<p class="empty">Click a frame or a layer to see its facts here.</p>
${allFrames.map(insHtml).join("\n")}
</div></aside>
<main id="vp" class="viewport" aria-label="Design canvas"><span id="read"></span>
<div id="world" class="world">
${secHtml}
</div></main>
<div class="hint" id="hint">Drag to pan, scroll to move, Ctrl + scroll to zoom</div>
<div class="toolbar" role="toolbar" aria-label="Canvas controls"><button class="tool" id="zOut" type="button" aria-label="Zoom out">&minus;</button><button class="tool zoomread" id="zoomRead" type="button" aria-label="Reset zoom">&nbsp;</button><button class="tool" id="zIn" type="button" aria-label="Zoom in">+</button><span class="tsep"></span><button class="tool" id="zSel" type="button">Fit frame</button><button class="tool" id="zFit" type="button">Fit all</button></div>
${scriptTag(JS)}
</body>
</html>`;
};

const template: ThemeTemplate = { id: "design-file", sections: SUPPORTED, defaultAccent: DEFAULT_ACCENT, render };
export default template;
