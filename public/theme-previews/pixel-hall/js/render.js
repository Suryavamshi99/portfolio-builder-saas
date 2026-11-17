// Shared content helpers: load portfolio.json and build HTML for write-ups.
// Used by the game panels (index.html), project.html and resume.html.

export async function loadContent() {
  const r = await fetch('content/portfolio.json');
  return r.json();
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Persona paths (photos/..., projects/..., logos/...) live under media/ in this site.
export const media = (p) => (p ? 'media/' + p.replace(/^media\//, '') : '');

const TOOL_NAMES = {
  notion: 'Notion', slack: 'Slack', googleforms: 'Google Forms', looker: 'Looker Studio', whatsapp: 'WhatsApp',
  googlesheets: 'Google Sheets', typeform: 'Typeform', python: 'Python', pandas: 'pandas', linkedin: 'LinkedIn',
  zoom: 'Zoom', miro: 'Miro', canva: 'Canva',
};

export const PHOTO_ALT = (d, src) => {
  const g = (d.media.gallery || []).find((x) => x.src === src);
  return g ? g.caption : 'Photo of Lakshmi Naidu';
};

export function companyFromQuery() {
  const v = new URLSearchParams(location.search).get('for');
  if (!v) return '';
  return v.replace(/[^\p{L}\p{N} .&'-]/gu, '').trim().slice(0, 40);
}

export function forCompanyLine(d) {
  const c = companyFromQuery();
  if (!c) return '';
  return d.pitch.for_company_template.replaceAll('{company}', c);
}

export function toolsHTML(keys) {
  return `<div class="tools">${(keys || []).map((k) => `<span><img src="media/logos/skills/${esc(k)}.svg" alt="" width="16" height="16">${esc(TOOL_NAMES[k] || k)}</span>`).join('')}</div>`;
}

export function metricsHTML(p) {
  return `<div class="metrics">${p.metrics.map(([v, l]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div>`;
}

// Full project write-up. opts.headingLevel lets the resume nest it.
export function projectBodyHTML(d, slug, opts = {}) {
  const p = d.projects.find((x) => x.slug === slug);
  const pg = d.project_pages[slug];
  if (!p || !pg) return '';
  const imgs = (pg.images || []).filter((s) => s !== p.thumbnail);
  const secondImg = imgs[0];
  return `
  ${metricsHTML(p)}
  <dl class="meta-grid">
    <div><dt>Role</dt><dd>${esc(pg.my_role || p.role)}</dd></div>
    <div><dt>When</dt><dd>${esc(pg.dates || p.year)}</dd></div>
    <div><dt>Team</dt><dd>${esc(p.team)}</dd></div>
    <div><dt>Where</dt><dd>${esc(p.org)}</dd></div>
  </dl>
  ${opts.noThumb ? '' : `<figure class="figure"><img src="${media(p.thumbnail)}" alt="${esc(p.title)}: project cover" loading="lazy" width="1600" height="1000"></figure>`}
  <div class="prose">
    <h3>Context</h3><p>${esc(pg.context)}</p>
    <h3>The problem</h3><p>${esc(pg.problem)}</p>
    <h3>What I did</h3><ul>${pg.what_i_did.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    ${visualHTML(slug)}
    <h3>Key decisions</h3>
    ${pg.decisions.slice(0, 3).map((x) => `<div class="decision"><b>${esc(x.choice)}</b>${esc(x.why)}</div>`).join('')}
    <h3>Results</h3>
    <div class="results">${pg.results.map((r) => `<div class="result"><span>${esc(r.metric)}</span><span class="v">${esc(r.value)}</span><span class="n">${esc(r.note)}</span></div>`).join('')}</div>
    ${secondImg ? `<figure class="figure"><img src="${media(secondImg)}" alt="${esc(altFor(d, secondImg, p))}" loading="lazy"><figcaption>${esc(altFor(d, secondImg, p))}</figcaption></figure>` : ''}
    <h3>What I learned</h3><p>${esc(pg.learned)}</p>
    ${pg.next ? `<h3>Next</h3><p>${esc(pg.next)}</p>` : ''}
    <h3>Tools</h3>${toolsHTML(p.tools)}
  </div>`;
}

function altFor(d, src, p) {
  if (src.startsWith('photos/')) return PHOTO_ALT(d, src);
  const name = src.split('/').pop().replace('.jpg', '');
  const map = { attrition: '90-day attrition by joining cohort, before and after', journey: 'The first 90 days, five checkpoints', 'exit-reasons': 'Why new dock hands left in their first three weeks', drivers: 'Which survey drivers moved most with eNPS' };
  return map[name] || p.title;
}

/* ---------------- code-drawn visuals, one per project ---------------- */
const C = { bg: '#401220', grid: '#7a2d46', text: '#ffe4ec', dim: '#e89eb8', pink: '#ffce4f', cyan: '#ad3eff', lime: '#4affdd', orange: '#51ff3d', gold: '#3fff72' };
const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" fill="${o.fill || C.text}" font-family="Silkscreen, monospace" font-size="${o.size || 12}" text-anchor="${o.anchor || 'start'}">${esc(s)}</text>`;
const R = (x, y, w, h, f) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"/>`;
const svg = (w, h, body, label) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${body}</svg>`;

function barPair(y, label, a, b, max, ca, cb, la, lb) {
  const W = 360;
  return T(0, y - 6, label, { fill: C.dim, size: 11 }) +
    R(0, y, (a / max) * W, 18, ca) + T((a / max) * W + 8, y + 14, la) +
    R(0, y + 24, (b / max) * W, 18, cb) + T((b / max) * W + 8, y + 38, lb);
}

const VISUALS = {
  'new-hire-orientation': () => {
    const steps = ['Badge ready', 'Floor buddy', 'First solo wk 2', 'Day-30 pulse', 'Goals day 60'];
    let b = T(0, 14, '90-day attrition', { fill: C.dim, size: 11 }) +
      R(0, 22, 18.8 * 17, 20, C.pink) + T(18.8 * 17 + 8, 37, '18.8%  2022, 138 hires') +
      R(0, 48, 9.8 * 17, 20, C.lime) + T(9.8 * 17 + 8, 63, '9.8%  164 hires after') +
      T(0, 104, 'Five checkpoints, one owner each', { fill: C.dim, size: 11 });
    steps.forEach((s, i) => { const x = i * 112; b += R(x, 114, 100, 30, i < 2 ? C.cyan : C.grid) + T(x + 6, 133, `${i + 1}`, { fill: i < 2 ? C.bg : C.text }) + T(x, 162, s, { size: 10 }); });
    return svg(560, 172, b, '90-day attrition fell from 18.8% to 9.8%; five orientation checkpoints');
  },
  'depot-first-month': () => svg(560, 150,
    barPair(20, 'Pilot depots, 3-week attrition', 21, 12, 26, C.orange, C.lime, '21% before', '12% after') +
    barPair(98, 'Control depots', 20, 19, 26, C.orange, C.grid, '20% before', '19% after'),
    'Pilot depots 21% to 12%, control depots 20% to 19%'),
  'staff-survey-readout': () => {
    const x0 = 280, s = 8; // eNPS scale: 1 unit = s px, 0 at x0
    const row = (y, label, v, col) => T(0, y + 14, label, { size: 11 }) + R(v < 0 ? x0 + v * s : x0, y, Math.abs(v) * s, 20, col) + T(v < 0 ? x0 + v * s - 6 : x0 + v * s + 6, y + 14, (v > 0 ? '+' : '') + String(v).replace('-', '−'), { anchor: v < 0 ? 'end' : 'start' });
    return svg(560, 150,
      R(x0, 4, 2, 120, C.dim) + T(x0, 142, '0', { fill: C.dim, size: 10, anchor: 'middle' }) +
      row(10, 'Company-wide', 9, C.cyan) + row(48, 'Packing hall, first survey', -27, C.pink) + row(86, 'Packing hall, 6 weeks on', -11, C.lime),
      'eNPS: company +9, packing hall −27 then −11');
  },
  'autumn-rush-hiring': () => {
    const row = (y, label, v, max, col, txt) => T(0, y + 14, label, { size: 11 }) + R(170, y, (v / max) * 330, 22, col) + T(170 + (v / max) * 330 - 6, y + 15, txt, { anchor: 'end', fill: C.bg });
    return svg(560, 130,
      row(6, 'Offers made', 72, 72, C.cyan, '72') + row(40, 'Started, Sep 2021', 61, 72, C.lime, '61') + row(74, 'Finished the season', 88, 100, C.gold, '88%') +
      T(0, 124, 'Needed 60 seasonal staff in five weeks, with a parcel-packing trial', { fill: C.dim, size: 10 }),
      '72 offers, 61 started, 88% finished the season');
  },
  'job-grades-pay-bands': () => {
    let b = T(0, 12, '44 titles', { fill: C.dim, size: 11 });
    for (let i = 0; i < 44; i++) b += R((i % 11) * 14, 22 + Math.floor(i / 11) * 14, 10, 10, C.pink);
    b += T(170, 60, '→', { size: 22 });
    b += T(220, 12, '9 grades', { fill: C.dim, size: 11 });
    for (let i = 0; i < 6; i++) b += R(220 + i * 34, 82 - i * 10, 30, 10 + i * 10, C.cyan) + T(222 + i * 34, 104, 'G' + (i + 1), { size: 10 });
    for (let i = 0; i < 3; i++) b += R(440 + i * 34, 82 - i * 12, 30, 10 + i * 12, C.lime) + T(442 + i * 34, 104, 'M' + (i + 1), { size: 10 });
    b += T(0, 140, 'Out-of-band pay cases', { fill: C.dim, size: 11 }) + R(0, 148, 58 * 5, 16, C.pink) + T(58 * 5 + 8, 161, '58') + R(0, 168, 14 * 5, 16, C.lime) + T(14 * 5 + 8, 181, '14 next cycle');
    return svg(560, 190, b, '44 titles mapped to 6 specialist and 3 lead grades; out-of-band cases 58 to 14');
  },
  'plain-english-handbook': () => {
    const box = (x, y, w, h, t1, t2, col) => R(x, y, w, h, col) + R(x + 3, y + 3, w - 6, h - 6, C.bg) + T(x + w / 2, y + 24, t1, { anchor: 'middle', size: 11 }) + T(x + w / 2, y + 42, t2, { anchor: 'middle', size: 10, fill: C.dim });
    return svg(560, 150,
      box(0, 40, 150, 60, 'Old handbook', '70 pages', C.lime) + T(165, 76, '→', { size: 20 }) +
      box(195, 40, 160, 60, 'Plain kit', '12 one-page policies', C.cyan) + T(368, 60, '↗', { size: 18 }) + T(368, 104, '↘', { size: 18 }) +
      box(400, 0, 160, 60, 'Five-question', 'check each', C.pink) + box(400, 84, 160, 60, '3 employers', '~140 staff', C.pink),
      'A 70-page handbook becomes twelve one-page policies with checks, used by three employers');
  },
  'case-challenge': () => {
    const W = 520, h = (x) => (x / 48) * W;
    return svg(560, 130,
      T(0, 12, '48 hours', { fill: C.dim, size: 11 }) +
      R(0, 22, h(30), 26, C.cyan) + T(8, 40, 'Survey: 52 replies in 30 h', { fill: C.bg, size: 11 }) +
      R(h(30), 22, h(18), 26, C.pink) + T(h(30) + 6, 40, 'Plan and deck', { fill: C.bg, size: 11 }) +
      T(0, 66, '0 h', { fill: C.dim, size: 10 }) + T(h(30), 66, '30 h', { fill: C.dim, size: 10, anchor: 'middle' }) + T(W, 66, '48 h', { fill: C.dim, size: 10, anchor: 'end' }) +
      R(0, 86, 40, 36, C.gold) + T(20, 110, '1', { fill: C.bg, anchor: 'middle', size: 16 }) + T(52, 110, 'First of 18 teams, $1,500 prize'),
      '48-hour case: survey in 30 hours, then the plan; first of 18 teams');
  },
  'third-drawer': () => {
    let b = T(0, 12, '24 issues, one a month since 2024', { fill: C.dim, size: 11 });
    for (let i = 0; i < 24; i++) b += R((i % 12) * 44, 24 + Math.floor(i / 12) * 34, 38, 28, i === 23 ? C.gold : C.cyan) + T((i % 12) * 44 + 19, 43 + Math.floor(i / 12) * 34, String(i + 1), { fill: C.bg, size: 10, anchor: 'middle' });
    b += T(0, 120, '1,450 subscribers   ~980 average opens');
    return svg(560, 130, b, '24 issues, 1,450 subscribers, about 980 average opens');
  },
};

export function visualHTML(slug) {
  const f = VISUALS[slug];
  if (!f) return '';
  return `<figure class="viz">${f()}<figcaption>Drawn from the project numbers</figcaption></figure>`;
}
