import type { PortfolioFacts, SectionKey } from "../../facts";
import { accentColour, attr, esc, fontOverride, googleFontsHref, initials, photoTag, safeHref, scriptTag, visibleSections } from "../helpers";
import type { RenderInput, ThemeTemplate } from "../types";

const DEFAULT_ACCENT = "#ff7a1a";
const BG = "#141414";

// Decorative colour mixes for the poster art. They are the theme's, not the user's.
const ART = [
  "var(--accent)",
  "color-mix(in srgb, var(--accent) 55%, #3a1c71)",
  "color-mix(in srgb, var(--accent) 50%, #0f5e9c)",
  "color-mix(in srgb, var(--accent) 60%, #0b6e4f)",
  "color-mix(in srgb, var(--accent) 40%, #b0123f)",
];
const art = (i: number): string => ART[i % ART.length] as string;

const AVATARS = ["#ff7a1a", "#0aa5c0", "#e5b109", "#7a5cff", "#46d369"];
const SMILE = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="9.5" r="1.7" fill="#141414"/><circle cx="16" cy="9.5" r="1.7" fill="#141414"/><path d="M6.5 14.5c1.4 3 9.6 3 11 0" fill="none" stroke="#141414" stroke-width="2" stroke-linecap="round"/></svg>`;
const ICON_PLAY = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" fill="currentColor"/></svg>`;
const ICON_INFO = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v6M12 7.5v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const ICON_MAIL = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18v12H3z" fill="none" stroke="currentColor" stroke-width="2"/><path d="m3 7 9 6 9-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
const ICON_HOME = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z" fill="currentColor"/></svg>`;
const ICON_ROW = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="m10 9 5 3-5 3z" fill="currentColor"/></svg>`;
const ICON_CLOSE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;

const ROW_TITLES: Record<string, string> = {
  projects: "Projects",
  experience: "Experience",
  achievements: "Achievements",
  skills: "Skills",
  certifications: "Certifications",
  education: "Education",
  testimonials: "Testimonials",
  extras: "More about me",
};
// Sections that become shelves, in the sample's order.
const ROW_KEYS: SectionKey[] = ["projects", "experience", "achievements", "skills", "certifications", "education", "testimonials", "extras"];

function chip(text: string | undefined, cls = ""): string {
  return text ? `<span class="chip${cls ? ` ${cls}` : ""}">${esc(text)}</span>` : "";
}

function extLink(url: string | undefined, label: string, cls: string): string {
  const href = safeHref(url);
  if (!href) return "";
  const ext = /^https?:/i.test(href);
  return `<a class="${cls}" href="${attr(href)}"${ext ? ' target="_blank" rel="noopener"' : ""}>${esc(label)}</a>`;
}

interface Detail {
  id: string;
  title: string;
  sub?: string | undefined;
  c: string;
  actions: string;
  meta: string;
  body: string;
}

function detailHtml(d: Detail): string {
  return `<div class="modal-wrap detail" id="${attr(d.id)}" role="dialog" aria-modal="true" aria-label="${attr(d.title)}">
<a class="modal-scrim" href="#" data-close aria-label="Close"></a>
<div class="modal" tabindex="-1">
<a class="modal-x" href="#" data-close aria-label="Close">${ICON_CLOSE}</a>
<div class="m-hero" style="--c:${d.c}"><div class="m-art"></div><div class="m-hero-text"><h2 class="m-title">${esc(d.title)}</h2>${d.sub ? `<p class="m-sub">${esc(d.sub)}</p>` : ""}${d.actions ? `<div class="m-actions">${d.actions}</div>` : ""}</div></div>
<div class="m-body">${d.meta ? `<p class="m-meta">${d.meta}</p>` : ""}${d.body}</div>
</div></div>`;
}

function episodes(bullets: string[]): string {
  return bullets.length ? `<ol class="eps">${bullets.map((b) => `<li class="ep"><span class="ep-n"></span><p>${esc(b)}</p></li>`).join("")}</ol>` : "";
}

function statBoxes(stats: Array<{ value: string; label: string }>): string {
  return stats.length ? `<div class="res">${stats.map((s) => `<div><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join("")}</div>` : "";
}

function render({ facts, custom }: RenderInput): string {
  const f: PortfolioFacts = facts;
  const accent = accentColour(custom, DEFAULT_ACCENT, BG);
  const over = fontOverride(custom);
  const families = over ? [{ family: over.family, weights: "400;500;600;700;800;900" }] : [{ family: "Inter", weights: "400;500;600;700;800;900" }, { family: "Bebas Neue", weights: "400" }];
  const fontsHref = googleFontsHref(families);
  const uiStack = over ? over.stack : "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";
  const displayStack = over ? over.stack : "'Bebas Neue', 'Arial Narrow', Impact, sans-serif";

  const sections = visibleSections(f, custom, template.sections);
  const has = (k: SectionKey) => sections.includes(k);
  const rowKeys = sections.filter((k) => ROW_KEYS.includes(k));
  const mark = esc((f.name.split(/\s+/)[0] ?? f.name).toUpperCase());
  const letter = esc(initials(f.name).slice(0, 1) || f.name.slice(0, 1).toUpperCase());

  const details: string[] = [];
  const projectsOn = has("projects");
  const expOn = has("experience");
  const aboutOn = has("about");

  // ---- project / experience / achievement cards and their detail panels ----
  const projectItems = projectsOn
    ? f.projects.map((p, i) => {
        const id = `d-projects-${i}`;
        details.push(
          detailHtml({
            id,
            title: p.name,
            sub: p.role,
            c: art(i),
            actions: extLink(p.link, "Visit project", "btn btn-white"),
            meta: [chip(p.period), ...p.tags.map((t) => chip(t))].join(""),
            body: [p.description ? `<p class="m-summary">${esc(p.description)}</p>` : "", statBoxes(p.metrics), episodes(p.bullets)].join(""),
          }),
        );
        const tags = p.tags.slice(0, 2).map(esc).join(" &bull; ");
        return `<a class="top-item" href="#${id}" data-open><span class="num" aria-hidden="true"></span><span class="card art" style="--c:${art(i)}"><span class="kb" aria-hidden="true">${letter}</span><span class="ctitle">${esc(p.name)}</span>${tags ? `<span class="ctags">${tags}</span>` : ""}</span></a>`;
      })
    : [];

  const expItems = expOn
    ? f.experience.map((e, i) => {
        const id = `d-experience-${i}`;
        details.push(
          detailHtml({
            id,
            title: e.role,
            sub: e.org,
            c: art(i + 1),
            actions: "",
            meta: [chip(e.period), chip(e.location)].join(""),
            body: [e.summary ? `<p class="m-summary">${esc(e.summary)}</p>` : "", episodes(e.bullets)].join(""),
          }),
        );
        return `<a class="card brand-card art" style="--c:${art(i + 1)}" href="#${id}" data-open><span class="mark">${esc(e.org)}</span><span class="bname">${esc(e.role)}${e.period ? ` &middot; ${esc(e.period)}` : ""}</span></a>`;
      })
    : [];

  const winItems = has("achievements")
    ? f.achievements.map((a, i) => {
        const id = `d-achievements-${i}`;
        details.push(
          detailHtml({
            id,
            title: a.title,
            sub: a.year,
            c: art(i + 2),
            actions: "",
            meta: "",
            body: a.detail ? `<p class="m-summary">${esc(a.detail)}</p>` : "",
          }),
        );
        return `<a class="card win-card" href="#${id}" data-open><span class="ph art" style="--c:${art(i + 2)}"><span class="kb" aria-hidden="true">${letter}</span><span class="wtitle">${esc(a.title)}</span>${a.year ? `<span class="ribbon">${esc(a.year)}</span>` : ""}</span>${a.detail ? `<span class="cap"><span>${esc(a.detail)}</span></span>` : ""}</a>`;
      })
    : [];

  const skillItems = has("skills")
    ? f.skills.map((g, i) => `<div class="card skill-card" style="--c:${art(i)}">${g.group ? `<h3>${esc(g.group)}</h3>` : ""}<ul>${g.items.map((it) => `<li>${esc(it)}</li>`).join("")}</ul></div>`)
    : [];

  const certItems = has("certifications")
    ? f.certifications.map((c, i) => `<div class="card list-card" style="--c:${art(i)}"><b>${esc(c.name)}</b>${c.issuer ? `<span>${esc(c.issuer)}</span>` : ""}${c.year ? `<em>${esc(c.year)}</em>` : ""}</div>`)
    : [];

  const eduItems = has("education")
    ? f.education.map((e, i) => `<div class="card list-card" style="--c:${art(i + 1)}"><b>${esc(e.school)}</b>${e.degree ? `<span>${esc(e.degree)}</span>` : ""}${e.period ? `<em>${esc(e.period)}</em>` : ""}${e.detail ? `<small>${esc(e.detail)}</small>` : ""}</div>`)
    : [];

  const testiItems = has("testimonials")
    ? f.testimonials.map((t) => `<figure class="card quote-card"><blockquote>${esc(t.quote)}</blockquote><figcaption><b>${esc(t.author)}</b>${t.role ? `<span>${esc(t.role)}</span>` : ""}</figcaption></figure>`)
    : [];

  const extraItems = has("extras")
    ? f.extras.map((x, i) => `<div class="card skill-card" style="--c:${art(i + 3)}"><h3>${esc(x.label)}</h3><ul>${x.items.map((it) => `<li>${esc(it)}</li>`).join("")}</ul></div>`)
    : [];

  const rowItems: Record<string, string[]> = {
    projects: projectItems,
    experience: expItems,
    achievements: winItems,
    skills: skillItems,
    certifications: certItems,
    education: eduItems,
    testimonials: testiItems,
    extras: extraItems,
  };

  const rowsHtml = rowKeys
    .map((k) => {
      const top = k === "projects" ? " top-row" : "";
      return `<section class="row" id="row-${k}" aria-label="${attr(ROW_TITLES[k] ?? k)}"><div class="row-head"><h2>${esc(ROW_TITLES[k])}</h2></div><div class="track${top}">${(rowItems[k] ?? []).join("")}</div></section>`;
    })
    .join("");

  // ---- about panel (modal) ----
  if (aboutOn) {
    const links = f.links.map((l) => extLink(l.url, l.label, "pill pill-dark")).join("");
    details.push(
      detailHtml({
        id: "d-about",
        title: f.name,
        sub: f.headline ?? f.tagline,
        c: "var(--accent)",
        actions: "",
        meta: chip(f.location),
        body: [f.tagline && f.summary ? `<p class="m-result">${esc(f.tagline)}</p>` : "", f.summary ? `<p class="m-summary">${esc(f.summary)}</p>` : "", statBoxes(f.stats), links ? `<div class="contact-row">${links}</div>` : ""].join(""),
      }),
    );
  }

  // ---- billboard: the strongest project, else the first role, else the person ----
  const fp = projectsOn ? f.projects[0] : undefined;
  const fe = !fp && expOn ? f.experience[0] : undefined;
  const bbTitle = fp?.name ?? f.name;
  const bbType = fp ? "Project" : fe ? "Experience" : f.headline ? "Portfolio" : "";
  const bbBlurb = fp?.description ?? f.tagline ?? f.summary ?? f.headline ?? (fe ? fe.summary : undefined);
  const bbMeta = fp
    ? [...fp.metrics.slice(0, 2).map((m) => `<span class="m">${esc(m.value)} ${esc(m.label)}</span>`), chip(fp.period, "solid"), chip(fp.role)].join("")
    : fe
      ? [chip(fe.role, "solid"), chip(fe.org), chip(fe.period)].join("")
      : [chip(f.headline, "solid"), chip(f.location)].join("");
  const openId = fp ? "d-projects-0" : fe ? "d-experience-0" : aboutOn ? "d-about" : "";
  const bbActions = [
    openId ? `<a class="btn btn-white" href="#${openId}" data-open>${ICON_PLAY}${fp ? "Open project" : fe ? "Open role" : "Read more"}</a>` : "",
    aboutOn && openId !== "d-about" ? `<a class="btn btn-grey" href="#d-about" data-open>${ICON_INFO}About me</a>` : "",
  ].join("");

  const photo = photoTag(f, { alt: `Portrait of ${f.name}`, className: "meet-photo" });
  const meetLine = f.headline ?? (fp || fe ? f.tagline : undefined);
  const meetOn = Boolean(photo || meetLine || f.email);
  const mailHref = f.email ? `mailto:${f.email}` : "";
  const meet = meetOn
    ? `<aside class="meet" aria-label="About ${attr(f.name)}"><div class="meet-head"><div><h2 class="meet-name">${esc(f.name)}</h2>${meetLine ? `<p class="meet-line">${esc(meetLine)}</p>` : ""}</div>${photo}</div>${aboutOn || f.email ? `<div class="meet-actions">${aboutOn ? `<a class="pill pill-white" href="#d-about" data-open>About me</a>` : ""}${f.email ? `<a class="pill pill-dark" href="${attr(mailHref)}">Email</a>` : ""}</div>` : ""}</aside>`
    : "";

  // ---- picker ----
  const pickRows = rowKeys.slice(0, 5);
  const picker =
    pickRows.length >= 2
      ? `<section class="picker" id="picker" aria-labelledby="picker-title"><div class="picker-logo wordmark" aria-hidden="true">${mark}<span>.</span>TV</div><h1 id="picker-title">Who's watching?</h1><p class="picker-sub">Pick a shelf to start with.</p><ul class="profiles">${pickRows
          .map((k, i) => `<li><a class="profile" href="#row-${k}" data-pick="row-${k}" data-label="${attr(ROW_TITLES[k] ?? k)}" data-c="${AVATARS[i % AVATARS.length]}"><span class="av" style="background-color:${AVATARS[i % AVATARS.length]}">${SMILE}</span><span class="lbl">${esc(ROW_TITLES[k])}</span></a></li>`)
          .join("")}</ul></section>`
      : "";

  // ---- header, footer, tab bar ----
  const navLinks = rowKeys.slice(0, 5).map((k) => `<a href="#row-${k}">${esc(ROW_TITLES[k])}</a>`).join("");
  const topLinks = f.links.slice(0, 2).map((l) => extLink(l.url, l.label, "top-link")).join("");
  const contactOn = has("contact");
  const foot = contactOn
    ? `<footer class="foot" id="contact"><div class="foot-inner"><h2>Talk to ${esc(f.name)}</h2>${f.location ? `<p>${esc(f.location)}</p>` : ""}<div class="foot-actions">${f.email ? `<a class="btn btn-white" href="${attr(mailHref)}">${ICON_MAIL}${esc(f.email)}</a>` : ""}${f.phone ? `<a class="btn btn-grey" href="tel:${attr(f.phone.replace(/[^+\d]/g, ""))}">${esc(f.phone)}</a>` : ""}${f.links.map((l) => extLink(l.url, l.label, "btn btn-grey")).join("")}</div></div></footer>`
    : `<footer class="foot"><div class="foot-inner"><p class="foot-small">${esc(f.name)}</p></div></footer>`;
  const tabs = [
    `<a href="#top">${ICON_HOME}Home</a>`,
    ...rowKeys.slice(0, 3).map((k) => `<a href="#row-${k}">${ICON_ROW}${esc(ROW_TITLES[k])}</a>`),
    contactOn ? `<a href="#contact">${ICON_MAIL}Contact</a>` : "",
  ].join("");

  const css = `
:root{--bg:${BG};--bg-2:#181818;--card:#232323;--line:rgba(255,255,255,.14);--text:#fff;--muted:#b3b3b3;--dim:#808080;--accent:${accent};--lens:var(--accent);--font-ui:${uiStack};--font-display:${displayStack};--radius:4px;--radius-lg:14px;--gutter:clamp(16px,3.4vw,56px);--header:68px;--ease:cubic-bezier(.2,.8,.2,1)}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth;scroll-padding-top:80px}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--font-ui);font-size:16px;line-height:1.45;-webkit-font-smoothing:antialiased;overflow-x:hidden}
body.is-picking,body.modal-open{overflow:hidden}
img{display:block;max-width:100%}
a{color:inherit}
button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
:focus-visible{outline:3px solid #fff;outline-offset:3px;border-radius:4px}
.skip{position:absolute;left:8px;top:8px;z-index:300;background:#fff;color:#000;padding:8px 12px;clip-path:inset(50%);width:1px;height:1px;overflow:hidden;white-space:nowrap}
.skip:focus{clip-path:none;width:auto;height:auto}
.wordmark{font-family:var(--font-display);color:var(--accent);font-size:38px;letter-spacing:.02em;line-height:1;text-decoration:none;display:inline-block;text-shadow:0 2px 0 rgba(0,0,0,.35)}
.wordmark span{color:#fff}
.picker{display:none;position:fixed;inset:0;z-index:200;background:var(--bg);flex-direction:column;align-items:center;justify-content:center;padding:80px var(--gutter) 40px;text-align:center;transition:opacity .5s var(--ease),transform .5s var(--ease);overflow-y:auto}
.js .picker{display:flex}
.picker-logo{position:absolute;top:22px;left:var(--gutter)}
.picker h1{font-weight:500;font-size:clamp(30px,3.6vw,60px);margin:0 0 10px;letter-spacing:-.01em}
.picker-sub{color:var(--muted);max-width:560px;margin:0 0 clamp(28px,4vw,52px);font-size:clamp(15px,1.15vw,18px)}
.profiles{list-style:none;display:flex;flex-wrap:wrap;justify-content:center;gap:clamp(14px,2vw,32px);padding:0;margin:0}
.profile{display:flex;flex-direction:column;align-items:center;gap:12px;width:clamp(96px,10vw,168px);color:var(--dim);text-decoration:none}
.profile .av{width:100%;aspect-ratio:1;border-radius:6px;overflow:hidden;outline:3px solid transparent;transition:outline-color .15s,transform .25s var(--ease);display:grid;place-items:center}
.profile .av{background-image:linear-gradient(135deg,rgba(255,255,255,.18),transparent 45%,rgba(0,0,0,.55))}
.profile .av svg{width:58%;height:58%}
.profile .lbl{font-size:clamp(13px,1.1vw,18px);line-height:1.25;transition:color .15s}
.profile:hover .av,.profile:focus-visible .av{outline-color:#fff;transform:scale(1.04)}
.profile:hover .lbl,.profile:focus-visible .lbl{color:#fff}
.profile:focus-visible{outline:none}
body:not(.is-picking) .picker{opacity:0;pointer-events:none;transform:scale(1.06)}
.top{position:fixed;top:0;left:0;right:0;height:var(--header);z-index:50;display:flex;align-items:center;gap:36px;padding:0 var(--gutter);background:linear-gradient(180deg,rgba(0,0,0,.72),rgba(0,0,0,0));transition:background .35s}
.top.solid{background:var(--bg)}
.nav{display:flex;gap:22px}
.nav a{text-decoration:none;color:#e5e5e5;font-size:15px;transition:color .2s}
.nav a:hover{color:var(--muted)}
.top-right{margin-left:auto;display:flex;align-items:center;gap:10px}
.top-link,.icon-btn{height:32px;border-radius:8px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);display:inline-flex;align-items:center;justify-content:center;padding:0 12px;font-size:13px;text-decoration:none}
.icon-btn{width:32px;padding:0}
.icon-btn svg{width:16px;height:16px}
.who{display:none;align-items:center;gap:8px;margin-left:6px}
.js .who.on{display:flex}
.who-av{width:32px;height:32px;border-radius:4px;display:grid;place-items:center;background:var(--accent)}
.who-av svg{width:70%;height:70%}
.who-name{font-size:13px;color:var(--muted);max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.caret{width:10px;height:6px;transition:transform .2s}
.who:hover .caret{transform:rotate(180deg)}
.billboard{position:relative;height:100vh;min-height:640px;max-height:1000px;overflow:hidden;background:#0c0c0c}
.bb-art{position:absolute;inset:0;overflow:hidden}
.bb-art i{position:absolute;border-radius:50%;filter:blur(70px);opacity:.55;animation:drift 18s ease-in-out infinite alternate}
.bb-art i:nth-child(1){width:55vw;height:55vw;right:-12vw;top:-18vw;background:var(--accent)}
.bb-art i:nth-child(2){width:36vw;height:36vw;right:22vw;top:12vw;background:color-mix(in srgb,var(--accent) 45%,#3a1c71);opacity:.4;animation-duration:24s;animation-direction:alternate-reverse}
.bb-art i:nth-child(3){width:30vw;height:30vw;right:2vw;bottom:2vw;background:color-mix(in srgb,var(--accent) 50%,#0f5e9c);opacity:.28;animation-duration:30s}
.bb-art::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(135deg,rgba(255,255,255,.035) 0 2px,transparent 2px 11px)}
.bb-big{position:absolute;right:calc(var(--gutter) - 1vw);top:52%;transform:translateY(-50%);font-family:var(--font-display);font-size:clamp(200px,32vw,520px);line-height:.8;color:transparent;-webkit-text-stroke:2px rgba(255,255,255,.12);user-select:none;pointer-events:none}
@keyframes drift{from{transform:translate(0,0) scale(1)}to{transform:translate(-5vw,4vw) scale(1.15)}}
.bb-shade{position:absolute;inset:0;pointer-events:none;background:linear-gradient(77deg,rgba(0,0,0,.82) 0%,rgba(0,0,0,.45) 34%,rgba(0,0,0,0) 58%),linear-gradient(180deg,rgba(20,20,20,0) 62%,rgba(20,20,20,.75) 82%,var(--bg) 100%)}
.bb-text{position:absolute;left:var(--gutter);bottom:31%;width:min(40vw,640px);z-index:2}
.badge{display:flex;align-items:center;gap:8px;font-weight:700;letter-spacing:.2em;font-size:13px;color:#ddd;margin:0 0 14px;text-transform:uppercase}
.badge .k{font-family:var(--font-display);color:var(--accent);font-size:26px;letter-spacing:0;line-height:.8}
.badge-type{margin-left:4px;font-family:ui-monospace,Menlo,monospace;font-weight:400;letter-spacing:.12em;color:var(--accent);font-size:11px;border:1px solid currentColor;padding:3px 6px;border-radius:3px}
.bb-title{font-size:clamp(44px,6vw,96px);line-height:.95;font-weight:900;letter-spacing:-.035em;margin:0 0 18px;text-shadow:0 2px 20px rgba(0,0,0,.4);overflow-wrap:anywhere}
.meta{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0 0 14px;font-size:17px;font-weight:600}
.meta .m{color:var(--accent);font-weight:700}
.chip{display:inline-block;border:1px solid rgba(255,255,255,.4);padding:0 6px;font-size:12px;border-radius:3px;line-height:20px;font-weight:600}
.chip.solid{background:rgba(255,255,255,.14);border-color:transparent}
.bb-blurb{font-size:clamp(15px,1.25vw,19px);line-height:1.5;margin:0 0 22px;color:#f2f2f2;text-shadow:0 1px 8px rgba(0,0,0,.5);display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.bb-actions{display:flex;gap:12px;flex-wrap:wrap}
.btn{display:inline-flex;align-items:center;gap:10px;min-height:52px;padding:0 28px 0 22px;border-radius:var(--radius);font-weight:700;font-size:19px;transition:background .2s,transform .15s;text-decoration:none;overflow-wrap:anywhere}
.btn svg{width:26px;height:26px;flex:none}
.btn:active{transform:scale(.97)}
.btn-white{background:#fff;color:#000}
.btn-white:hover{background:rgba(255,255,255,.78)}
.btn-grey{background:rgba(109,109,110,.7);color:#fff}
.btn-grey:hover{background:rgba(109,109,110,.45)}
.meet{position:absolute;bottom:31%;right:var(--gutter);width:330px;z-index:4;padding:22px;border-radius:var(--radius-lg);background:rgba(28,28,30,.62);backdrop-filter:blur(18px) saturate(1.3);-webkit-backdrop-filter:blur(18px) saturate(1.3);border:1px solid rgba(255,255,255,.1);box-shadow:0 20px 50px rgba(0,0,0,.35)}
.meet-head{display:flex;gap:14px;justify-content:space-between}
.meet-name{font-size:23px;margin:0 0 4px;font-weight:800;letter-spacing:-.01em;overflow-wrap:anywhere}
.meet-line{margin:0;font-size:13.5px;color:#d6d6d6;line-height:1.4}
.meet-photo{width:76px;height:76px;border-radius:10px;object-fit:cover;object-position:50% 30%;border:2px solid rgba(255,255,255,.75);flex:none}
.meet-actions{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap}
.pill{height:38px;padding:0 18px;border-radius:999px;display:inline-flex;align-items:center;font-weight:700;font-size:14px;text-decoration:none;transition:background .2s}
.pill-white{background:#fff;color:#000}
.pill-white:hover{background:#ddd}
.pill-dark{background:rgba(0,0,0,.55);color:#fff;border:1px solid rgba(255,255,255,.12)}
.pill-dark:hover{background:rgba(0,0,0,.8)}
.rows{position:relative;z-index:5;margin-top:-22vh;padding-bottom:40px}
.row{position:relative;margin-bottom:clamp(28px,3.2vw,48px)}
.row-head{display:flex;align-items:baseline;gap:14px;padding:0 var(--gutter);margin:0 0 12px}
.row-head h2{font-size:clamp(18px,1.55vw,24px);font-weight:700;margin:0;letter-spacing:-.01em}
.track{display:flex;gap:8px;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scroll-padding:0 var(--gutter);padding:22px var(--gutter) 26px;margin:-16px 0 -16px;scrollbar-width:none;overscroll-behavior-x:contain}
.track::-webkit-scrollbar{display:none}
.track>*{scroll-snap-align:start;flex:none}
.top-row{counter-reset:top}
.arrow{position:absolute;top:36px;bottom:10px;width:calc(var(--gutter) - 6px);min-width:34px;z-index:6;background:rgba(20,20,20,.55);display:grid;place-items:center;opacity:0;transition:opacity .2s}
.arrow svg{width:26px;height:26px;transition:transform .2s}
.arrow:hover svg{transform:scale(1.3)}
.arrow.prev{left:0}.arrow.next{right:0}
.row:hover .arrow,.arrow:focus-visible{opacity:1}
.card{position:relative;border-radius:var(--radius);overflow:hidden;background:var(--card);text-align:left;display:block;align-self:flex-start;text-decoration:none;transition:transform .3s var(--ease),box-shadow .3s}
a.card:hover,a.card:focus-visible,.top-item:hover .card,.top-item:focus-visible .card{transform:scale(1.07);z-index:3;box-shadow:0 14px 34px rgba(0,0,0,.6)}
.art{background:radial-gradient(120% 120% at 100% 0%,color-mix(in srgb,var(--c) 70%,transparent),transparent 62%),linear-gradient(160deg,#272727,#191919)}
.art::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 2px,transparent 2px 9px);pointer-events:none}
.kb{position:absolute;top:8px;left:10px;font-family:var(--font-display);color:#fff;opacity:.9;font-size:24px;line-height:.8;z-index:1;text-shadow:0 1px 4px rgba(0,0,0,.5)}
.top-item{width:clamp(300px,27vw,440px);display:flex;align-items:center;text-decoration:none;counter-increment:top}
.top-item .num{font-family:var(--font-display);font-size:clamp(150px,14vw,230px);line-height:.78;color:var(--bg);-webkit-text-stroke:3px #5c5c5c;width:36%;text-align:right;margin-right:-4%;letter-spacing:-.04em;position:relative;user-select:none;transition:-webkit-text-stroke-color .2s}
.top-item .num::before{content:counter(top)}
.top-item .card{width:68%;aspect-ratio:16/10;z-index:1;padding:36px 14px 12px;display:flex;flex-direction:column;justify-content:flex-end;gap:4px}
.top-item:hover .num,.top-item:focus-visible .num{-webkit-text-stroke-color:var(--accent)}
.top-item:focus-visible{outline:none}
.top-item:focus-visible .card{outline:3px solid #fff;outline-offset:2px}
.ctitle{position:relative;z-index:1;font-family:var(--font-display);font-size:clamp(24px,2.2vw,34px);line-height:.95;letter-spacing:.02em;overflow-wrap:anywhere;text-shadow:0 2px 8px rgba(0,0,0,.4)}
.ctags{position:relative;z-index:1;font-size:12px;color:#e3e3e3}
.brand-card{width:clamp(220px,19vw,320px);aspect-ratio:16/9;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:8px;padding:14px 14px 34px}
.brand-card .mark{position:relative;z-index:1;font-family:var(--font-display);font-size:clamp(30px,2.8vw,44px);line-height:.95;letter-spacing:.02em;text-align:center;overflow-wrap:anywhere}
.brand-card .bname{position:absolute;left:10px;bottom:8px;right:10px;font-size:12px;font-weight:700;opacity:.8;line-height:1.25;z-index:1}
.win-card{width:clamp(260px,23vw,380px);display:flex;flex-direction:column;background:#0e0e0e}
.win-card .ph{aspect-ratio:16/9;position:relative;overflow:hidden;width:100%;flex:none;display:flex;align-items:flex-end;padding:12px 14px}
.wtitle{position:relative;z-index:1;font-family:var(--font-display);font-size:clamp(24px,2vw,32px);line-height:.95;letter-spacing:.02em;overflow-wrap:anywhere;text-shadow:0 2px 8px rgba(0,0,0,.4);padding-right:46px}
.ribbon{position:absolute;bottom:0;right:10px;background:var(--accent);color:#111;font-weight:800;font-size:12px;padding:3px 8px;z-index:1}
.win-card .cap{display:block;padding:10px 12px 12px}
.win-card .cap span{font-size:12.5px;color:var(--muted);line-height:1.4;display:block}
.skill-card{width:clamp(240px,21vw,340px);padding:16px 18px;display:flex;flex-direction:column;background:radial-gradient(120% 120% at 100% 0%,color-mix(in srgb,var(--c) 45%,transparent),transparent 60%),#1b1b1d}
.skill-card h3{font-family:var(--font-display);font-size:36px;line-height:.95;margin:0 0 6px;font-weight:400;letter-spacing:.02em;overflow-wrap:anywhere}
.skill-card ul{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:5px}
.skill-card li{font-size:12.5px;background:rgba(255,255,255,.09);padding:3px 8px;border-radius:3px}
.list-card{width:clamp(220px,19vw,320px);min-height:120px;padding:16px;display:flex;flex-direction:column;gap:4px;background:radial-gradient(120% 120% at 100% 0%,color-mix(in srgb,var(--c) 30%,transparent),transparent 60%),#1b1b1d}
.list-card b{font-size:16px;overflow-wrap:anywhere}
.list-card span{font-size:13px;color:var(--muted)}
.list-card em{font-style:normal;font-size:12px;color:var(--accent);font-weight:700;letter-spacing:.06em}
.list-card small{font-size:12.5px;color:#bbb}
.quote-card{width:clamp(260px,24vw,380px);margin:0;padding:18px;background:#232323}
.quote-card blockquote{margin:0 0 12px;font-size:15px;line-height:1.5}
.quote-card figcaption b{display:block;font-size:13.5px}
.quote-card figcaption span{font-size:12.5px;color:var(--muted)}
.detail{display:none;position:fixed;inset:0;z-index:120;overflow-y:auto;overscroll-behavior:contain}
.detail:target,.detail.open{display:block}
.modal-scrim{position:fixed;inset:0;background:rgba(0,0,0,.72);animation:fade .25s both}
@keyframes fade{from{opacity:0}}
.modal{position:relative;width:min(900px,calc(100vw - 32px));margin:32px auto 48px;background:var(--bg-2);border-radius:8px;overflow:hidden;box-shadow:0 20px 80px rgba(0,0,0,.6);animation:modalIn .35s var(--ease) both;outline:none}
@keyframes modalIn{from{transform:translateY(30px) scale(.97);opacity:0}}
.modal-x{position:absolute;top:14px;right:14px;z-index:5;width:38px;height:38px;border-radius:50%;background:#181818;display:grid;place-items:center}
.modal-x svg{width:20px;height:20px}
.m-hero{position:relative;aspect-ratio:16/7;min-height:220px;background:#000;overflow:hidden;display:flex;align-items:flex-end}
.m-art{position:absolute;inset:0;background:radial-gradient(90% 140% at 100% 0%,color-mix(in srgb,var(--c) 75%,transparent),transparent 65%),linear-gradient(160deg,#2a2a2a,#151515)}
.m-art::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 2px,transparent 2px 9px),linear-gradient(180deg,rgba(24,24,24,0) 50%,var(--bg-2))}
.m-hero-text{position:relative;padding:0 48px 28px;width:100%}
.m-title{font-family:var(--font-display);font-weight:400;font-size:clamp(40px,6vw,76px);line-height:.92;margin:0 0 8px;letter-spacing:.01em;text-shadow:0 2px 18px rgba(0,0,0,.6);overflow-wrap:anywhere;padding-right:40px}
.m-sub{margin:0 0 14px;font-size:17px;font-weight:600;color:#e8e8e8}
.m-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.m-actions .btn{min-height:44px;font-size:17px;padding:0 22px}
.m-body{padding:8px 48px 40px}
.m-meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-weight:600;margin:14px 0 12px}
.m-summary{font-size:16px;line-height:1.55;margin:0 0 14px}
.m-result{font-size:16px;font-weight:700;color:var(--accent);margin:12px 0 8px}
.eps{list-style:none;margin:14px 0 0;padding:0;border-top:1px solid #404040;counter-reset:ep}
.ep{display:grid;grid-template-columns:34px 1fr;gap:16px;padding:16px 8px;border-bottom:1px solid #404040;align-items:start;counter-increment:ep}
.ep:first-child{background:#262626}
.ep-n::before{content:counter(ep);font-size:22px;color:#d2d2d2;display:block;text-align:center}
.ep p{font-size:14.5px;color:#dcdcdc;line-height:1.5;margin:0}
.res{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:8px 0 12px}
.res div{background:#262626;border-radius:6px;padding:10px 12px}
.res b{display:block;font-family:var(--font-display);font-size:32px;font-weight:400;line-height:1;color:var(--accent)}
.res span{display:block;font-size:12.5px;color:#ddd;margin-top:4px;font-weight:600}
.contact-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}
.foot{padding:40px var(--gutter) 80px;border-top:1px solid #262626}
.foot-inner{max-width:980px}
.foot h2{font-size:clamp(24px,2.4vw,36px);margin:0 0 8px;letter-spacing:-.02em;overflow-wrap:anywhere}
.foot p{color:var(--muted);margin:0 0 18px;max-width:640px}
.foot-actions{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px}
.foot .foot-small{font-size:13px;color:#777;margin:0}
.tabbar{display:none}
@media (max-width:1100px){.nav{gap:16px}.nav a{font-size:14px}.who-name{display:none}.bb-text{width:min(52vw,560px)}}
@media (max-width:900px){.meet{position:relative;bottom:auto;right:auto;width:auto;margin:0 var(--gutter)}.billboard{overflow:visible}}
@media (max-width:760px){
:root{--header:56px}
.nav,.top-link,.icon-btn{display:none}
.wordmark{font-size:30px}
.top{gap:12px}
.billboard{height:auto;min-height:0;max-height:none;display:flex;flex-direction:column;background:var(--bg)}
.bb-art{position:relative;height:50svh;min-height:340px;max-height:480px;flex:none}
.bb-big{font-size:60vw;right:0;top:25svh}
.bb-shade{height:50svh;min-height:340px;max-height:480px;background:linear-gradient(180deg,rgba(0,0,0,.4) 0,rgba(0,0,0,0) 18%,rgba(20,20,20,0) 50%,rgba(20,20,20,.9) 80%,var(--bg) 100%)}
.bb-text{position:relative;left:auto;bottom:auto;width:auto;margin:-170px var(--gutter) 0}
.bb-title{font-size:44px;margin-bottom:12px}
.meta{font-size:14px;gap:8px}
.bb-blurb{font-size:15px}
.bb-actions .btn{flex:1;justify-content:center;min-height:46px;font-size:16px;padding:0 12px}
.bb-actions .btn svg{width:22px;height:22px}
.meet{margin:24px var(--gutter) 0;padding:18px}
.meet-photo{width:64px;height:64px}
.meet-actions .pill{flex:1;justify-content:center;padding:0 10px}
.rows{margin-top:32px}
.top-item{width:84vw}
.top-item .num{font-size:120px;-webkit-text-stroke-width:2px;width:26%}
.top-item .card{width:76%}
.brand-card{width:58vw}.win-card{width:72vw}.skill-card{width:72vw}.list-card{width:62vw}.quote-card{width:78vw}
.arrow{display:none}
.modal{width:100%;margin:0;border-radius:0;min-height:100%}
.detail{background:var(--bg-2)}
.m-hero{aspect-ratio:auto;min-height:200px;padding-top:60px}
.m-hero-text{padding:0 18px 20px}
.m-title{font-size:42px}
.m-body{padding:8px 18px 100px}
.ep{grid-template-columns:28px 1fr;gap:10px}
.foot{padding-bottom:110px}
main{padding-bottom:calc(64px + env(safe-area-inset-bottom))}
.tabbar{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:80;background:rgba(18,18,18,.97);border-top:1px solid #262626;padding:6px 4px calc(6px + env(safe-area-inset-bottom))}
.tabbar a{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10.5px;color:#b3b3b3;text-decoration:none;padding:4px 0;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.tabbar svg{width:22px;height:22px}
.picker{justify-content:flex-start;padding-top:96px}
.profiles{gap:22px 18px;max-width:340px}
.profile{width:96px}
.profile .lbl{font-size:13px}
}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
`;

  const js = `(function(){
var d=document,b=d.body,root=d.documentElement;
var top=d.getElementById("top");
function onScroll(){if(top)top.classList.toggle("solid",window.scrollY>40)}
window.addEventListener("scroll",onScroll,{passive:true});onScroll();
var last=null;
function open(id){var m=d.getElementById(id);if(!m)return;last=d.activeElement;m.classList.add("open");b.classList.add("modal-open");var box=m.querySelector(".modal");if(box){box.scrollTop=0;m.scrollTop=0;box.focus({preventScroll:true})}}
function closeAll(){var o=d.querySelectorAll(".detail.open");for(var i=0;i<o.length;i++)o[i].classList.remove("open");b.classList.remove("modal-open");if(location.hash&&/^#d-/.test(location.hash)){try{history.replaceState(null,"",location.pathname+location.search)}catch(e){}}if(last&&last.focus){last.focus({preventScroll:true});last=null}}
d.addEventListener("click",function(e){
var t=e.target;if(!t||!t.closest)return;
var c=t.closest("[data-close]");if(c){e.preventDefault();closeAll();return}
var o=t.closest("[data-open]");if(o){e.preventDefault();closeAll();open(o.getAttribute("href").slice(1));return}
});
d.addEventListener("keydown",function(e){if(e.key==="Escape"){if(d.querySelector(".detail.open"))closeAll();else if(b.classList.contains("is-picking")&&who&&who.classList.contains("on"))pick(null)}});
if(/^#d-/.test(location.hash)){var h=location.hash.slice(1);if(d.getElementById(h)){history.replaceState(null,"",location.pathname+location.search);open(h)}}
var who=d.getElementById("who"),whoAv=d.getElementById("who-av"),whoName=d.getElementById("who-name");
var picker=d.getElementById("picker");
function pick(a){
b.classList.remove("is-picking");
if(!a)return;
var id=a.getAttribute("data-pick"),row=d.getElementById(id),rows=d.getElementById("rows");
if(row&&rows&&rows.firstChild!==row)rows.insertBefore(row,rows.firstChild);
if(who){who.classList.add("on");if(whoAv)whoAv.style.background=a.getAttribute("data-c")||"";if(whoName)whoName.textContent=a.getAttribute("data-label")||""}
window.scrollTo(0,0);
}
if(picker){
root.classList.add("js");b.classList.add("is-picking");
picker.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("[data-pick]");if(a){e.preventDefault();pick(a)}});
if(who)who.addEventListener("click",function(){b.classList.add("is-picking");var p=picker.querySelector(".profile");if(p)p.focus()});
}
var tracks=d.querySelectorAll(".track");
for(var i=0;i<tracks.length;i++)(function(tr){
var row=tr.parentNode;
function mk(dir){var a=d.createElement("button");a.className="arrow "+(dir<0?"prev":"next");a.type="button";a.setAttribute("aria-label",dir<0?"Scroll left":"Scroll right");a.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+(dir<0?"M15 5l-7 7 7 7":"M9 5l7 7-7 7")+'" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';a.addEventListener("click",function(){tr.scrollBy({left:dir*tr.clientWidth*.8,behavior:"smooth"})});row.appendChild(a);return a}
var p=mk(-1),n=mk(1);
function upd(){p.style.display=tr.scrollLeft>8?"":"none";n.style.display=tr.scrollLeft+tr.clientWidth<tr.scrollWidth-8?"":"none"}
tr.addEventListener("scroll",upd,{passive:true});window.addEventListener("resize",upd);upd();
})(tracks[i]);
})();`;

  const whoBtn = pickRows.length >= 2 ? `<button class="who" id="who" type="button" aria-label="Switch profile"><span class="who-av" id="who-av">${SMILE}</span><span class="who-name" id="who-name"></span><svg class="caret" viewBox="0 0 10 6" aria-hidden="true"><path d="M0 0h10L5 6z" fill="currentColor"/></svg></button>` : "";

  const title = `${esc(f.name)}${f.headline ? ` · ${esc(f.headline)}` : ""}`;
  const desc = f.tagline ?? f.summary ?? f.headline ?? f.name;
  const bbBig = esc(initials(f.name).slice(0, 2));

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${attr(desc)}">
<meta name="theme-color" content="${BG}">
<link rel="stylesheet" href="${attr(fontsHref)}">
<style>${css}</style>
</head>
<body>
<a class="skip" href="#rows">Skip to the shelves</a>
${picker}
<header class="top" id="top">
<a class="wordmark" href="#top" aria-label="${attr(f.name)}">${mark}<span>.</span>TV</a>
${navLinks ? `<nav class="nav" aria-label="Sections">${navLinks}</nav>` : ""}
<div class="top-right">${topLinks}${f.email ? `<a class="icon-btn" href="${attr(mailHref)}" aria-label="Email ${attr(f.name)}">${ICON_MAIL}</a>` : ""}${whoBtn}</div>
</header>
<main id="main">
<section class="billboard" aria-label="Featured">
<div class="bb-art" aria-hidden="true"><i></i><i></i><i></i></div>
<div class="bb-big" aria-hidden="true">${bbBig}</div>
<div class="bb-shade"></div>
<div class="bb-text">
<p class="badge"><span class="k" aria-hidden="true">${letter}</span>${bbType ? `<span class="badge-type">${esc(bbType)}</span>` : ""}</p>
<h1 class="bb-title">${esc(bbTitle)}</h1>
${bbMeta ? `<p class="meta">${bbMeta}</p>` : ""}
${bbBlurb ? `<p class="bb-blurb">${esc(bbBlurb)}</p>` : ""}
${bbActions ? `<div class="bb-actions">${bbActions}</div>` : ""}
</div>
${meet}
</section>
<div class="rows" id="rows">${rowsHtml}</div>
${foot}
</main>
${details.join("\n")}
<nav class="tabbar" aria-label="Quick links">${tabs}</nav>
${scriptTag(js)}
</body>
</html>`;
}

const template: ThemeTemplate = {
  id: "stream-shelf",
  sections: ["about", "projects", "experience", "achievements", "skills", "certifications", "education", "testimonials", "extras", "contact"],
  defaultAccent: DEFAULT_ACCENT,
  render,
};

export default template;
