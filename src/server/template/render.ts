import type { Content } from "@/data/content";
import type { Plan } from "@/config/plans";
import { escapeAttr, escapeHtml } from "./escape";

/**
 * Renders a Content object into ONE self-contained static HTML page
 * (embedded CSS, no build step) — the same shape the portfolio-builder
 * skill's own output takes, and what Vercel's zero-config static hosting
 * wants. Deliberately plain: every field renders, semantically and
 * accessibly, but visual design is Antigravity's job, not this pipeline's.
 * Swap or extend this module for real theming later; nothing else in the
 * publish pipeline needs to change to do that.
 *
 * `plan` gates the one thing Free vs. Pro actually changes about the
 * published output itself (storage/rate limits are enforced elsewhere,
 * upstream of this function ever running) — a small "Published with
 * Portfol.io" credit on the free tier, removed on Pro.
 */
export function renderSiteHtml(content: Content, plan: Plan = "free", appOrigin?: string): string {
  const title = `${content.profile.name}${content.profile.role ? ` — ${content.profile.role}` : ""}`;

  const sections = [
    renderHeader(content),
    renderAbout(content),
    renderWork(content),
    renderSkills(content),
    renderProjects(content),
    renderContact(content),
  ]
    .filter((s): s is string => s !== null)
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeAttr(content.profile.thesis)}" />
<style>${BASE_CSS}</style>
</head>
<body>
${renderNav(content)}
<main>
${sections}
</main>
${plan === "free" ? renderBadge(appOrigin) : ""}
</body>
</html>`;
}

/**
 * Links to our own app (appOrigin), not a marketing domain — we don't own
 * a vanity domain for this product, so the badge must never hardcode one.
 */
function renderBadge(appOrigin?: string): string {
  const label = "Published with Portfol.io";
  return appOrigin
    ? `<div class="pio-badge"><a href="${escapeAttr(appOrigin)}" target="_blank" rel="noopener">${label}</a></div>`
    : `<div class="pio-badge"><span>${label}</span></div>`;
}

function renderNav(content: Content): string {
  const items = [
    content.about.intro ? `<a href="#about">About</a>` : null,
    content.work.roles.length ? `<a href="#work">Work</a>` : null,
    content.skills.groups.length ? `<a href="#skills">Skills</a>` : null,
    content.projects.length ? `<a href="#projects">Projects</a>` : null,
    `<a href="#contact">Contact</a>`,
  ].filter((i): i is string => i !== null);

  return `<nav class="nav"><span class="nav-name">${escapeHtml(content.profile.name)}</span><div class="nav-links">${items.join("")}</div></nav>`;
}

function renderHeader(content: Content): string {
  const p = content.profile;
  return `<header class="hero" id="top">
  ${p.portrait ? `<img class="portrait" src="${escapeAttr(p.portrait)}" alt="${escapeAttr(p.name)}" />` : ""}
  <h1>${escapeHtml(p.name)}</h1>
  <p class="role">${escapeHtml(p.role)}${p.location ? ` &middot; ${escapeHtml(p.location)}` : ""}</p>
  <p class="thesis">${escapeHtml(p.thesis)}</p>
  ${content.home.nowText ? `<p class="now"><strong>${escapeHtml(content.home.nowTitle || "Now")}:</strong> ${escapeHtml(content.home.nowText)}</p>` : ""}
</header>`;
}

function renderAbout(content: Content): string | null {
  const a = content.about;
  if (!a.intro && a.stats.length === 0 && a.offHours.length === 0) return null;

  const stats = a.stats.length
    ? `<div class="stats">${a.stats.map((s) => `<div class="stat"><span class="stat-value">${escapeHtml(s.value)}</span><span class="stat-label">${escapeHtml(s.label)}</span></div>`).join("")}</div>`
    : "";

  const offHours = a.offHours.length
    ? `<ul class="off-hours">${a.offHours.map((o) => `<li><strong>${escapeHtml(o.title)}</strong> — ${escapeHtml(o.note)}</li>`).join("")}</ul>`
    : "";

  return `<section id="about">
  <h2>${escapeHtml(a.title || "About")}</h2>
  ${a.intro ? `<p>${escapeHtml(a.intro)}</p>` : ""}
  ${stats}
  ${offHours}
</section>`;
}

function renderWork(content: Content): string | null {
  const { roles, education, certifications } = content.work;
  if (roles.length === 0 && education.length === 0 && certifications.length === 0) return null;

  const rolesHtml = roles
    .map((r) => {
      const metrics = r.metrics?.length
        ? `<div class="metrics">${r.metrics.map((m) => `<div class="metric"><span class="metric-value">${escapeHtml(m.value)}</span><span class="metric-label">${escapeHtml(m.label)}</span></div>`).join("")}</div>`
        : "";
      const groups = r.groups
        .map(
          (g) =>
            `<div class="role-group">${g.heading ? `<h4>${escapeHtml(g.heading)}</h4>` : ""}<ul>${g.points.map((pt) => `<li>${escapeHtml(pt)}</li>`).join("")}</ul></div>`,
        )
        .join("");
      return `<article class="role" id="role-${escapeAttr(r.id)}">
    <h3>${escapeHtml(r.title)} — ${escapeHtml(r.org)}${r.orgNote ? ` <span class="muted">(${escapeHtml(r.orgNote)})</span>` : ""}</h3>
    <p class="meta">${escapeHtml(r.period)} &middot; ${escapeHtml(r.location)}</p>
    <p class="claim">${escapeHtml(r.claim)}</p>
    ${metrics}
    ${groups}
  </article>`;
    })
    .join("\n");

  const educationHtml = education.length
    ? `<div class="education">${education
        .map(
          (e) =>
            `<article><h3>${escapeHtml(e.qualification)} — ${escapeHtml(e.org)}</h3><p class="meta">${escapeHtml(e.period)} &middot; ${escapeHtml(e.location)}</p><ul>${e.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul></article>`,
        )
        .join("")}</div>`
    : "";

  const certsHtml = certifications.length
    ? `<ul class="certifications">${certifications.map((c) => `<li>${escapeHtml(c.name)} <span class="muted">(${escapeHtml(c.year)})</span></li>`).join("")}</ul>`
    : "";

  return `<section id="work">
  <h2>Work</h2>
  ${rolesHtml}
  ${educationHtml ? `<h3>Education</h3>${educationHtml}` : ""}
  ${certsHtml ? `<h3>Certifications</h3>${certsHtml}` : ""}
</section>`;
}

function renderSkills(content: Content): string | null {
  if (content.skills.groups.length === 0) return null;

  const groups = content.skills.groups
    .map((g) => {
      const skills = g.skills
        .map((s) => {
          const inner = `<span class="skill-name">${escapeHtml(s.name)}</span>${s.evidence ? `<span class="skill-evidence">${escapeHtml(s.evidence)}</span>` : ""}`;
          return s.href
            ? `<a class="skill" href="${escapeAttr(s.href)}">${inner}</a>`
            : `<div class="skill">${inner}</div>`;
        })
        .join("");
      return `<div class="skill-group"><h3>${escapeHtml(g.title)}</h3>${g.claim ? `<p class="claim">${escapeHtml(g.claim)}</p>` : ""}<div class="skill-list">${skills}</div></div>`;
    })
    .join("\n");

  return `<section id="skills">
  <h2>Skills</h2>
  ${groups}
</section>`;
}

function renderProjects(content: Content): string | null {
  if (content.projects.length === 0) return null;

  const sorted = [...content.projects].sort((a, b) => b.date.localeCompare(a.date));

  const cards = sorted
    .map((p) => {
      const links = [
        p.links?.github ? `<a href="${escapeAttr(p.links.github)}">GitHub</a>` : null,
        p.links?.paper ? `<a href="${escapeAttr(p.links.paper)}">Paper</a>` : null,
        p.links?.external ? `<a href="${escapeAttr(p.links.external)}">Link</a>` : null,
        p.links?.demo ? `<a href="${escapeAttr(p.links.demo)}">Demo</a>` : null,
      ]
        .filter((l): l is string => l !== null)
        .join(" &middot; ");

      const tech = p.tech?.length
        ? `<div class="tags">${p.tech.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>`
        : "";

      const images = p.images?.length
        ? `<div class="project-images">${p.images.map((im) => `<img src="${escapeAttr(im.src)}" alt="${escapeAttr(im.alt)}" />`).join("")}</div>`
        : "";

      const body = p.body?.length
        ? p.body
            .map(
              (b) =>
                `<div class="block">${b.heading ? `<h4>${escapeHtml(b.heading)}</h4>` : ""}${b.text ? `<p>${escapeHtml(b.text)}</p>` : ""}${b.points?.length ? `<ul>${b.points.map((pt) => `<li>${escapeHtml(pt)}</li>`).join("")}</ul>` : ""}</div>`,
            )
            .join("")
        : "";

      return `<article class="project" id="project-${escapeAttr(p.slug)}">
    <h3>${escapeHtml(p.title)}${p.status ? ` <span class="status status-${escapeAttr(p.status)}">${escapeHtml(p.status)}</span>` : ""}</h3>
    <p class="meta">${escapeHtml(p.date)}${p.category ? ` &middot; ${escapeHtml(p.category)}` : ""}${p.role ? ` &middot; ${escapeHtml(p.role)}` : ""}</p>
    <p class="summary">${escapeHtml(p.summary)}</p>
    ${tech}
    ${images}
    ${body}
    ${p.counterpoint ? `<p class="counterpoint">${escapeHtml(p.counterpoint)}</p>` : ""}
    ${links ? `<p class="links">${links}</p>` : ""}
  </article>`;
    })
    .join("\n");

  return `<section id="projects">
  <h2>Projects</h2>
  ${cards}
</section>`;
}

function renderContact(content: Content): string {
  const p = content.profile;
  const emails = p.emails.map((e) => `<a href="mailto:${escapeAttr(e.value)}">${escapeHtml(e.label || e.value)}</a>`).join(" &middot; ");
  const socialLinks = [
    p.links.linkedin ? `<a href="${escapeAttr(p.links.linkedin)}">LinkedIn</a>` : null,
    p.links.github ? `<a href="${escapeAttr(p.links.github)}">GitHub</a>` : null,
    p.links.instagram ? `<a href="${escapeAttr(p.links.instagram)}">Instagram</a>` : null,
  ]
    .filter((l): l is string => l !== null)
    .join(" &middot; ");

  const resumes = content.resumes.length
    ? `<p class="resumes">${content.resumes.map((r) => `<a href="${escapeAttr(r.url)}" download="${escapeAttr(r.filename)}">${escapeHtml(r.label)}</a>`).join(" &middot; ")}</p>`
    : "";

  return `<section id="contact">
  <h2>Contact</h2>
  ${p.phone ? `<p>${escapeHtml(p.phone)}</p>` : ""}
  <p>${emails}</p>
  <p>${socialLinks}</p>
  ${resumes}
</section>`;
}

const BASE_CSS = `
:root { color-scheme: light dark; --ink: #16161a; --paper: #fafafa; --muted: #6b6b70; --accent: #2e3fe5; }
* { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; background: var(--paper); color: var(--ink); line-height: 1.6; }
main { max-width: 720px; margin: 0 auto; padding: 0 1.5rem 4rem; }
.nav { position: sticky; top: 0; display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; background: color-mix(in srgb, var(--paper) 90%, transparent); backdrop-filter: blur(6px); border-bottom: 1px solid color-mix(in srgb, var(--ink) 10%, transparent); }
.nav-name { font-weight: 600; }
.nav-links a { margin-left: 1rem; color: inherit; text-decoration: none; font-size: 0.9rem; }
.nav-links a:hover { color: var(--accent); }
.hero { max-width: 720px; margin: 0 auto; padding: 3rem 1.5rem 2rem; }
.portrait { width: 96px; height: 96px; border-radius: 50%; object-fit: cover; margin-bottom: 1rem; }
h1 { font-size: 2.2rem; margin: 0 0 0.25rem; }
.role { color: var(--muted); margin: 0 0 1rem; }
.thesis { font-size: 1.1rem; }
.now { background: color-mix(in srgb, var(--accent) 8%, transparent); padding: 0.75rem 1rem; border-radius: 8px; }
section { padding: 2.5rem 0; border-top: 1px solid color-mix(in srgb, var(--ink) 10%, transparent); }
h2 { font-size: 1.5rem; }
h3 { font-size: 1.15rem; margin-bottom: 0.25rem; }
.meta, .muted { color: var(--muted); font-size: 0.9rem; }
.role, .project { margin-bottom: 2rem; }
.stats { display: flex; gap: 2rem; flex-wrap: wrap; margin-top: 1rem; }
.stat { display: flex; flex-direction: column; }
.stat-value { font-size: 1.4rem; font-weight: 600; }
.stat-label { color: var(--muted); font-size: 0.85rem; }
.metrics { display: flex; gap: 1.5rem; flex-wrap: wrap; margin: 0.75rem 0; }
.metric-value { font-weight: 600; margin-right: 0.35rem; }
.skill-group { margin-bottom: 1.5rem; }
.skill-list { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; }
.skill { display: flex; flex-direction: column; gap: 0.15rem; padding: 0.5rem 0.75rem; border: 1px solid color-mix(in srgb, var(--ink) 12%, transparent); border-radius: 8px; text-decoration: none; color: inherit; font-size: 0.85rem; }
.skill-name { font-weight: 600; }
.skill-evidence { color: var(--muted); }
.tags { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.5rem 0; }
.tag { font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 999px; background: color-mix(in srgb, var(--ink) 8%, transparent); }
.project-images img { max-width: 100%; border-radius: 8px; margin: 0.5rem 0; }
.status { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); }
.counterpoint { border-left: 2px solid var(--accent); padding-left: 0.75rem; color: var(--muted); }
a { color: var(--accent); }
ul { padding-left: 1.2rem; }
.resumes a { margin-right: 0.75rem; }
.pio-badge { position: fixed; bottom: 1rem; right: 1rem; font-size: 0.7rem; padding: 0.4rem 0.7rem; border-radius: 999px; background: color-mix(in srgb, var(--ink) 85%, transparent); backdrop-filter: blur(4px); }
.pio-badge a { color: var(--paper); text-decoration: none; }
`;
