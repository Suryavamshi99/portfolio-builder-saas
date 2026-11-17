/* Portfolio as a design file: infinite canvas, layers, selection with a
   properties panel, comment pins, visitor cursors and a prototype player.
   All content comes from content/portfolio.json. */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isPhone = () => innerWidth <= 820;
const params = new URLSearchParams(location.search);
const FOR = (params.get('for') || '').replace(/[^\w .&'-]/g, '').slice(0, 40).trim();

let D, FRAMES = [], BY = {}, PINS = [], PROJ = [];
const cam = { x: 0, y: 0, z: 0.2 };
let selected = null, readMode = false, tab = 'design';

const ARROW = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4.5 11.5l7-7M6 4.5h5.5V10"/></svg>';
const DOWN = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 2.5v11M3.5 9l4.5 4.5L12.5 9"/></svg>';
const TARA = { name: 'Tara Iyer', ini: 'TI', c: '#141414' };

/* ---------------- Layout of the canvas (world units = px at 100%) ---------------- */
function layout() {
  const P = D.projects;
  const pw = 1000, ph = 640, g = 80, secY = 1240;
  FRAMES = [
    { id: 'about', name: 'About', ic: '#', x: 0, y: 0, w: 1800, h: 1000 },
    { id: 'experience', name: 'Experience', ic: '#', x: 1920, y: 0, w: 1600, h: 1000 },
  ];
  PROJ = P.map((p, i) => ({ id: 'p-' + p.slug, slug: p.slug, p, name: shortName(p), ic: '#', child: true, x: g + (i % 4) * (pw + g), y: secY + g + Math.floor(i / 4) * (ph + g), w: pw, h: ph, n: i + 1 }));
  FRAMES.push(...PROJ);
  const rows = Math.ceil(P.length / 4);
  const secH = g + rows * ph + (rows - 1) * g + g;
  const y3 = secY + secH + 240;
  FRAMES.push(
    { id: 'wins', name: 'Wins', ic: '#', x: 0, y: y3, w: 2160, h: 900 },
    { id: 'skills', name: 'Skills', ic: '#', x: 2280, y: y3, w: 1000, h: 900 },
    { id: 'contact', name: 'Contact', ic: '#', x: 3400, y: y3, w: 1000, h: 900 },
  );
  FRAMES.section = { x: 0, y: secY, w: 4400, h: secH };
  FRAMES.forEach(f => BY[f.id] = f);
}
function eyebrow(p) {
  return (new RegExp('\\b' + p.type + '\\b', 'i').test(p.org) ? [p.org, p.year] : [p.type, p.org, p.year]).join(' · ');
}
function shortName(p) {
  const map = { 'rules-latency': 'Rounding rule', 'teardowns': 'Margin Notes' };
  return map[p.slug] || p.cover_title || p.title;
}

/* ---------------- Frame content ---------------- */
const img = (src, alt, cls = '', extra = '') => `<img src="media/${esc(src)}" alt="${esc(alt)}" class="${cls}" loading="lazy" decoding="async" ${extra}>`;
function chips(list) { return `<ul class="chips">${list.map(t => `<li class="chip">${esc(t)}</li>`).join('')}</ul>`; }

function aboutHTML() {
  const pn = D.person, pt = D.pitch;
  const tags = ['User interviews', 'Process mapping', 'Experiment design', 'Roadmapping'];
  return `<div class="ab">
    <div class="ab-copy">
      <p class="eyebrow">/ Product manager · ${esc(pn.location.split(' (')[0])}</p>
      <h1>${esc(pn.headline)}.</h1>
      <p class="ab-lede">${esc(pt.short)}</p>
      ${chips(tags)}
      <div class="ab-ctas">
        <button class="btn lime" type="button" data-go="p-${esc(D.projects[0].slug)}">See the work ${DOWN}</button>
        <a class="btn" href="media/resume.pdf" download>Download resume ${ARROW}</a>
      </div>
      <div class="ab-stats">${pt.why_stats.map((s, i) => `<div><b>${esc(s)}</b><span>${esc(pt.why_labels[i])}</span></div>`).join('')}</div>
    </div>
    <div class="ab-art">
      <p class="ab-tag">/ ${esc(pn.current)}</p>
      ${img(D.media.professional, `${pn.first_name} ${pn.last_name}, arms folded, smiling`, 'ab-photo', 'loading="eager"')}
      <div class="ab-card c1"><b>−24%</b>phone reorders, Reorder Button pilot at Pinewick Paper & Print</div>
      <div class="ab-card c2"><b>430</b>dock slots booked at the Larchmont Falls warehouse in 10 weeks</div>
      <div class="ab-card c3"><b>${esc(pn.available_from)}</b>Available from. Looking for senior PM roles in B2B commerce or operations software.</div>
    </div>
  </div>`;
}
function experienceHTML() {
  return `<div class="ex">
    <div class="ex-head"><div><p class="eyebrow">/ Experience</p><h2 class="fr-h2">Seven years around Pinewick Paper & Print, from the order desk to product</h2></div><p>${esc(D.about.intro)}</p></div>
    <ul class="ex-roles">${D.experience.map(e => `<li class="ex-role">
      <div class="ex-logo">${img(e.logo, e.org + ' logo')}</div>
      <div class="who"><h3>${esc(e.org)}</h3><p class="r">${esc(e.role)}</p></div>
      <div class="meta"><p class="d">${esc(e.dates)}</p><p class="d">${esc(e.place)}</p></div>
      <ul>${e.points.map(x => `<li>${esc(x)}</li>`).join('')}</ul></li>`).join('')}</ul>
    <div class="ex-edu">${D.education.map(e => `<div><p class="eyebrow">/ ${esc(e.years)}</p><b>${esc(e.school)}</b><span>${esc(e.degree)}. ${esc(e.notes)}</span></div>`).join('')}</div>
  </div>`;
}
function projectHTML(f) {
  const p = f.p;
  return `<div class="pj">
    <div class="pj-copy">
      <p class="eyebrow">/ ${esc(eyebrow(p))}</p>
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.summary)}</p>
      ${chips(p.tags.slice(0, 3))}
      <div class="pj-metrics">${p.metrics.map(m => `<div><b>${esc(m[0])}</b><span>${esc(m[1])}</span></div>`).join('')}</div>
      <a class="btn lime pj-cta" href="project.html?p=${esc(p.slug)}">Open write-up ${ARROW}</a>
    </div>
    <div class="pj-art">${img(p.cover, p.cover_title + ': ' + p.result)}<span class="pj-num">${String(f.n).padStart(2, '0')} / ${String(PROJ.length).padStart(2, '0')}</span></div>
  </div>`;
}
function winsHTML() {
  return `<div class="wn">
    <div class="wn-head"><div><p class="eyebrow">/ Wins</p><h2 class="fr-h2">Results and recognition</h2></div><p>Five results from Pinewick Paper & Print, Thistlewood Institute and Marsh End College. Each project frame above traces its number back to the source.</p></div>
    <ul class="wn-grid">${D.wins.map(w => `<li class="wn-card">${img(w.image, w.title)}<div><b>${esc(w.title)}</b><span>${esc(w.detail)}</span></div></li>`).join('')}</ul>
  </div>`;
}
function skillsHTML() {
  const flat = Object.values(D.skills).flat().join(' ');
  const tools = D.tools.map(t => t.name).filter(n => !flat.includes(n.split(' ')[0]));
  return `<div class="sk">
    <div><p class="eyebrow">/ Skills</p><h2 class="fr-h2">What I work with</h2></div>
    ${Object.entries(D.skills).map(([k, v]) => `<div class="sk-group"><p class="eyebrow">${esc(k)}</p>${chips(v)}</div>`).join('')}
    <div class="sk-group"><p class="eyebrow">Tools</p>${chips(tools.slice(0, 10))}</div>
    <div class="sk-group"><p class="eyebrow">Certifications</p><ul class="sk-certs">${D.certifications.map(c => `<li>${esc(c.name)}<span>${esc(c.issuer)}, ${esc(c.year)}</span></li>`).join('')}</ul></div>
  </div>`;
}
function contactHTML() {
  const c = D.contact, pn = D.person;
  return `<div class="ct">
    <div class="ct-top">${img(D.media.headshot, pn.first_name + ' ' + pn.last_name + ', headshot')}<div><p class="eyebrow">/ Contact</p><h2 class="fr-h2">Let's talk</h2><p>${esc(pn.looking_for)}.</p></div></div>
    <ul class="ct-rows">
      <li><a href="mailto:${esc(c.email)}"><span>Email</span><b>${esc(c.email)}</b></a></li>
      <li><a href="${esc(c.linkedin)}" target="_blank" rel="noopener"><span>LinkedIn</span><b>linkedin.com/in/example</b></a></li>
      <li><a href="${esc(c.calendly)}" target="_blank" rel="noopener"><span>Book a call</span><b>calendly.com/example</b></a></li>
      <li><a href="${esc(c.substack)}" target="_blank" rel="noopener"><span>Newsletter</span><b>Margin Notes</b></a></li>
      <li><div class="row"><span>Based in</span><b>${esc(pn.location)}</b></div></li>
      <li><div class="row"><span>Available</span><b>${esc(pn.available_from)}</b></div></li>
    </ul>
    <a class="btn lime" href="mailto:${esc(c.email)}">Email Tara ${ARROW}</a>
  </div>`;
}
function frameHTML(f) {
  if (f.id === 'about') return aboutHTML();
  if (f.id === 'experience') return experienceHTML();
  if (f.id === 'wins') return winsHTML();
  if (f.id === 'skills') return skillsHTML();
  if (f.id === 'contact') return contactHTML();
  return projectHTML(f);
}

/* ---------------- Comments (write-up highlights and testimonials) ---------------- */
function buildPins() {
  const T = D.testimonials, pp = D.project_pages;
  const person = (t, c) => ({ name: t.name, ini: t.name.replace(/^Dr\. /, '').split(' ').map(w => w[0]).join('').slice(0, 2), c, role: t.role });
  const list = [];
  if (FOR) list.push({ f: 'about', x: .05, y: .055, msgs: [{ a: TARA, t: D.pitch.for_company_template.replaceAll('{company}', FOR) }] });
  list.push({ f: 'about', x: .53, y: .30, msgs: [{ a: TARA, t: 'How I work: ' + D.values.join(' ') }] });
  list.push({ f: 'experience', x: .33, y: .30, msgs: [{ a: TARA, t: 'In 2021 I left the Pinewick order desk to analyse quotes at Quillfold, and in 2023 Gordie hired me back as a product manager.' }, { a: person(T[0], '#a3e52d'), t: T[0].quote, sub: T[0].relation }] });
  PROJ.forEach(f => {
    const pg = pp[f.slug]; if (!pg) return;
    const learned = { f: f.id, x: .40, y: .14, msgs: [{ a: TARA, t: 'What I learned: ' + pg.learned }] };
    if (f.slug === 'slotwise') learned.msgs.push({ a: person(T[1], '#1433ae'), t: T[1].quote, sub: T[1].relation });
    if (f.slug === 'uc-reschedules') learned.msgs.push({ a: person(T[2], '#ff61b0'), t: T[2].quote, sub: T[2].relation });
    list.push(learned);
    const d = pg.decisions && pg.decisions[0];
    if (d) list.push({ f: f.id, x: .90, y: .78, msgs: [{ a: TARA, t: `Decision: ${d.choice}. ${d.why}` }] });
  });
  list.push({ f: 'contact', x: .80, y: .12, msgs: [{ a: TARA, t: 'Outside work: ' + D.about.now }] });
  list.forEach((p, i) => p.n = i + 1);
  PINS = list;
}

/* ---------------- Build DOM ---------------- */
const world = $('#world'), vp = $('#viewport');
function build() {
  const sec = FRAMES.section;
  const s = document.createElement('div');
  s.className = 'section'; s.id = 'sec-projects';
  Object.assign(s.style, { left: sec.x + 'px', top: sec.y + 'px', width: sec.w + 'px', height: sec.h + 'px' });
  s.innerHTML = `<div class="section-label">Projects · ${PROJ.length}</div>`;
  world.appendChild(s);

  FRAMES.forEach(f => {
    const el = document.createElement('section');
    el.className = 'frame'; el.id = 'f-' + f.id; el.dataset.id = f.id;
    el.setAttribute('aria-label', f.name + ' frame');
    Object.assign(el.style, { left: f.x + 'px', top: f.y + 'px', width: f.w + 'px', height: f.h + 'px' });
    el.innerHTML = `<button class="frame-label" type="button" data-sel="${f.id}"><span>${esc(f.name)}</span><span class="fl-size">${f.w} × ${f.h} · Inspect</span></button>
      <div class="frame-body">${frameHTML(f)}</div>
      <div class="handles" aria-hidden="true"><i></i><i></i><i></i><i></i><b>${f.w} × ${f.h}</b></div>
      <div class="pins"></div>`;
    f.el = el;
    world.appendChild(el);
  });
  PINS.forEach(p => {
    const b = document.createElement('button');
    b.className = 'pin'; b.type = 'button'; b.dataset.pin = p.n;
    b.style.left = (p.x * 100) + '%'; b.style.top = (p.y * 100) + '%';
    const last = p.msgs[p.msgs.length - 1].a;
    b.style.setProperty('--pc', last.c);
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-label', `Comment ${p.n} by ${p.msgs.map(m => m.a.name).join(' and ')}`);
    b.innerHTML = `${esc(last.ini)}<i>${p.n}</i>`;
    BY[p.f].el.querySelector('.pins').appendChild(b);
    p.el = b;
  });
  // flow flag + noodles
  const flag = document.createElement('button');
  flag.className = 'flowflag'; flag.type = 'button'; flag.id = 'flowflag';
  flag.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M2 1v8l7-4z"/></svg> Projects flow';
  flag.style.left = (PROJ[0].x + PROJ[0].w * 0.5) + 'px'; flag.style.top = PROJ[0].y + 'px';
  world.appendChild(flag);
  const note = document.createElement('div');
  note.className = 'note'; note.id = 'note';
  Object.assign(note.style, { left: '3640px', top: '0px', width: '760px' });
  note.innerHTML = `<div class="who">${img(D.media.headshot, '')}Note from Tara</div><p>Hi, this file is my portfolio. Select any frame to see its facts in the panel on the right.</p><p>The numbered pins are my notes on each project, with replies from people I worked with.</p><p>Press <kbd>P</kbd> to click through the projects, or Read all for one long page.</p>`;
  world.appendChild(note);
  drawNoodles();

  // layers
  const L = $('#layers');
  const row = f => `<li><button class="layer${f.child ? ' child' : ''}" type="button" data-sel="${f.id}" aria-current="false"><span class="ic">${f.ic}</span><span class="nm">${esc(f.name)}</span></button></li>`;
  let html = '';
  FRAMES.forEach(f => {
    if (f.id === PROJ[0].id) html += `<li><button class="layer" type="button" data-sel="__projects"><span class="tw"><svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><path d="M1 2h6L4 6z"/></svg></span><span class="ic">⊞</span><span class="nm">Projects</span></button></li>`;
    html += row(f);
  });
  L.innerHTML = html;
  $('#layerCount').textContent = FRAMES.length + ' frames';
  $('#mstrip').innerHTML = FRAMES.map(f => `<button type="button" data-sel="${f.id}" aria-current="false"><span class="ic">#</span>${esc(f.name)}</button>`).join('');
  $('#cCount').textContent = PINS.length;

  // read view order
  const R = $('#rvInner');
  R.insertAdjacentHTML('beforeend', '<div id="rvSlot"></div>');
  if (FOR) $('#fileName').textContent = 'Portfolio for ' + FOR;
}

function drawNoodles() {
  const svg = $('#noodles');
  let d = '';
  for (let i = 0; i < PROJ.length - 1; i++) {
    const a = PROJ[i], b = PROJ[i + 1];
    const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2;
    if (b.y === a.y) d += `<path d="M${x1} ${y1} C${x1 + 50} ${y1} ${x2 - 50} ${y2} ${x2 - 4} ${y2}"/><circle cx="${x1}" cy="${y1}" r="6"/><path d="M${x2 - 14} ${y2 - 8} L${x2 - 2} ${y2} L${x2 - 14} ${y2 + 8}"/>`;
    else {
      const x1b = a.x + a.w / 2, y1b = a.y + a.h, x2b = b.x + b.w / 2, y2b = b.y;
      d += `<path d="M${x1b} ${y1b} C${x1b} ${y1b + 60} ${x2b} ${y2b - 60} ${x2b} ${y2b - 4}"/><circle cx="${x1b}" cy="${y1b}" r="6"/><path d="M${x2b - 8} ${y2b - 14} L${x2b} ${y2b - 2} L${x2b + 8} ${y2b - 14}"/>`;
    }
  }
  svg.setAttribute('width', 4400); svg.setAttribute('height', 3600);
  svg.innerHTML = d;
}

/* ---------------- Camera ---------------- */
let raf = 0, tween = null;
function view() {
  const r = vp.getBoundingClientRect();
  if (isPhone()) return { l: 8, t: 8, w: r.width - 16, h: r.height - 80, r };
  const left = innerWidth > 820 ? 268 : 12, right = innerWidth > 1000 ? 296 : 12;
  return { l: left, t: 16, w: r.width - left - right, h: r.height - 16 - 84, r };
}
function apply() {
  raf = 0;
  world.style.transform = `translate(${cam.x}px,${cam.y}px) scale(${cam.z})`;
  document.documentElement.style.setProperty('--iz', (1 / cam.z).toFixed(4));
  let gs = 24 * cam.z; while (gs < 10) gs *= 4;
  vp.style.setProperty('--gs', gs + 'px'); vp.style.setProperty('--gx', cam.x + 'px'); vp.style.setProperty('--gy', cam.y + 'px');
  $('#zoomFit').textContent = Math.round(cam.z * 100) + '%';
  document.body.classList.toggle('far', cam.z < 0.26);
  placeThread();
}
function render() { if (!raf) raf = requestAnimationFrame(apply); }
function setCam(x, y, z) { cam.x = x; cam.y = y; cam.z = Math.min(4, Math.max(0.04, z)); render(); }
function zoomAt(sx, sy, factor) {
  const z2 = Math.min(4, Math.max(0.04, cam.z * factor)), k = z2 / cam.z;
  setCam(sx - (sx - cam.x) * k, sy - (sy - cam.y) * k, z2);
}
function fitTarget(rect, pad = 60, maxZ = 1.25) {
  const v = view();
  const z = Math.min(maxZ, v.w / (rect.w + pad * 2), v.h / (rect.h + pad * 2));
  return { z, x: v.l + (v.w - rect.w * z) / 2 - rect.x * z, y: v.t + (v.h - rect.h * z) / 2 - rect.y * z };
}
function flyTo(t, dur = 520) {
  if (tween) cancelAnimationFrame(tween.id);
  if (RM || dur === 0) { setCam(t.x, t.y, t.z); return; }
  const s = { ...cam }, t0 = performance.now();
  // interpolate in log-zoom so the move feels even
  const step = now => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    const z = Math.exp(Math.log(s.z) + (Math.log(t.z) - Math.log(s.z)) * e);
    // keep the world point under screen centre moving on a straight line
    const cx = s.x + (t.x - s.x) * e, cy = s.y + (t.y - s.y) * e;
    const lin = s.z + (t.z - s.z) * e, adj = z / lin;
    const v = view(), mx = v.l + v.w / 2, my = v.t + v.h / 2;
    setCam(mx - (mx - cx) * adj, my - (my - cy) * adj, z);
    if (k < 1) tween.id = requestAnimationFrame(step); else { setCam(t.x, t.y, t.z); tween = null; }
  };
  tween = { id: requestAnimationFrame(step) };
}
const allRect = () => ({ x: 0, y: 0, w: 4400, h: BY.contact.y + BY.contact.h });
function fitAll(anim = true) { flyTo(fitTarget(allRect(), 80), anim ? 520 : 0); }
function fitFrame(id, anim = true) {
  const f = id === '__projects' ? FRAMES.section : BY[id];
  flyTo(fitTarget(f, isPhone() ? 16 : 56), anim ? 560 : 0);
}

/* ---------------- Selection ---------------- */
function select(id, opts = {}) {
  closeThread();
  if (id === '__projects') { deselect(); setLayer('__projects'); if (!readMode) fitFrame('__projects'); else BY[PROJ[0].id].el.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' }); return; }
  const f = BY[id]; if (!f) return;
  FRAMES.forEach(g => g.el.classList.toggle('is-selected', g === f));
  selected = id; setLayer(id);
  if (opts.zoom !== false) {
    if (readMode) f.el.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' });
    else fitFrame(id);
  }
  if (tab !== 'design' && !opts.keepTab) setTab('design'); else renderProps();
  if (isPhone() && opts.sheet) openSheet();
  if (opts.user) stopFollow();
}
function deselect() {
  FRAMES.forEach(g => g.el.classList.remove('is-selected'));
  selected = null; setLayer(null); renderProps();
}
function setLayer(id) {
  $$('[data-sel]', $('#layers')).forEach(b => b.setAttribute('aria-current', String(b.dataset.sel === id)));
  $$('#mstrip [data-sel]').forEach(b => {
    const on = b.dataset.sel === id; b.setAttribute('aria-current', String(on));
    if (on) { const s = $('#mstrip'); s.scrollTo({ left: b.offsetLeft - 40, behavior: RM ? 'auto' : 'smooth' }); }
  });
}

/* ---------------- Properties panel ---------------- */
function sec(title, body, small = '') { return `<div class="psec"><h4>${title}${small ? `<small>${small}</small>` : ''}</h4>${body}</div>`; }
const kv = rows => `<dl class="kv">${rows.filter(r => r[1]).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
const mrows = rows => rows.map(([v, l]) => `<div class="mrow"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('');
function evidenceFor(slug) {
  return D.hiring_lens.filter(h => h.evidence[slug]).map(h => `<li><b>${esc(h.label)}</b><span>${esc(h.evidence[slug])}</span></li>`).join('');
}
function head(f, kind) {
  return `<div class="psec"><div class="sel-name"><span class="ic">#</span>${esc(f.name)}</div><div class="sel-kind">${kind}</div></div>
  ${sec('Frame', `<div class="xywh"><div><span>X</span>${f.x}</div><div><span>Y</span>${f.y}</div><div><span>W</span>${f.w}</div><div><span>H</span>${f.h}</div></div>`)}`;
}
const fill = (hex = 'FBF8F2') => sec('Fill', `<div class="fill"><i style="--sw:#${hex}"></i>${hex}<em>100%</em></div>`);
function propsFor(id) {
  const f = BY[id], pn = D.person, c = D.contact;
  if (!f) return pageProps();
  if (f.p) {
    const p = f.p, pg = D.project_pages[p.slug] || {};
    return head(f, `Frame ${f.n} of ${PROJ.length} in Projects`) +
      sec('Facts', kv([['Project', p.title], ['Role', pg.my_role || p.role], ['Org', p.org], ['Dates', pg.dates || p.year], ['Duration', p.duration], ['Team', p.team]])) +
      sec('Metrics', mrows(p.metrics), 'from the write-up') +
      sec('Result', `<p class="ptext">${esc(p.result)}</p>`) +
      sec('Evidence', `<ul class="ev">${evidenceFor(p.slug)}</ul>`, 'by hiring signal') +
      sec('Tools', `<div class="tchips">${p.tools.map(t => `<span>${esc(toolName(t))}</span>`).join('')}</div>`) +
      sec('Export', `<div class="pact"><a class="go" href="project.html?p=${esc(p.slug)}">Open full write-up <span>↗</span></a><button type="button" data-present="${f.n - 1}">Present from here <span>▷</span></button></div>`);
  }
  if (id === 'about') return head(f, 'Frame · Intro') +
    sec('Facts', kv([['Name', `${pn.first_name} ${pn.last_name} (${pn.pronouns})`], ['Now', pn.current], ['Wants', pn.looking_for], ['Based in', pn.location], ['Available', pn.available_from]])) +
    sec('Proof', mrows(D.pitch.why_stats.map((s, i) => [s, D.pitch.why_labels[i]]))) +
    sec('Why hire me', D.pitch.why_hire.map(t => `<p class="ptext">${esc(t)}</p>`).join('')) + fill() +
    sec('Export', `<div class="pact"><a class="go" href="media/resume.pdf" download>Download resume <span>↓</span></a></div>`);
  if (id === 'experience') return head(f, 'Frame · Roles and education') +
    sec('Roles', D.experience.map(e => `<div class="mrow" style="display:block"><b style="color:var(--chrome-ink);font-family:var(--font);font-weight:600">${esc(e.org)}</b><div style="color:var(--chrome-mute);margin-top:2px">${esc(e.role)}<br>${esc(e.dates)}, ${esc(e.place)}</div></div>`).join('')) +
    sec('Education', kv(D.education.map(e => [e.years, `${e.school}. ${e.notes}`]))) +
    sec('Reference', `<p class="ptext">“${esc(D.testimonials[0].quote)}”</p><p class="ptext" style="color:var(--chrome-mute)">${esc(D.testimonials[0].name)}, ${esc(D.testimonials[0].role)}</p>`) + fill();
  if (id === 'wins') return head(f, 'Frame · ' + D.wins.length + ' items') +
    sec('Wins', D.wins.map(w => `<div class="mrow" style="display:block"><b style="color:var(--chrome-ink);font-family:var(--font);font-weight:600;white-space:normal">${esc(w.title)}</b><div style="color:var(--chrome-mute);margin-top:2px">${esc(w.detail)}</div></div>`).join('')) + fill();
  if (id === 'skills') return head(f, 'Frame · Skills and tools') +
    Object.entries(D.skills).map(([k, v]) => sec(k, `<div class="tchips">${v.map(x => `<span>${esc(x)}</span>`).join('')}</div>`)).join('') +
    sec('Certifications', kv(D.certifications.map(c => [c.year, `${c.name}, ${c.issuer}`]))) + fill();
  if (id === 'contact') return head(f, 'Frame · Contact') +
    sec('Reach Tara', `<div class="pact"><a class="go" href="mailto:${esc(c.email)}">Email ${esc(c.email)} <span>↗</span></a><a href="${esc(c.linkedin)}" target="_blank" rel="noopener">LinkedIn <span>↗</span></a><a href="${esc(c.calendly)}" target="_blank" rel="noopener">Book a call <span>↗</span></a><a href="media/resume.pdf" download>Resume (PDF) <span>↓</span></a></div>`) +
    sec('Facts', kv([['Phone', c.phone], ['Wants', pn.looking_for], ['Available', pn.available_from]])) + fill();
  return pageProps();
}
function pageProps() {
  const pn = D.person;
  return `<div class="psec"><div class="sel-name">Page · Portfolio</div><div class="sel-kind">Nothing selected. Pick a frame on the canvas or in Layers.</div></div>
    ${sec('About this file', `<p class="ptext">${esc(pn.first_name)} ${esc(pn.last_name)}. ${esc(pn.headline)}.</p><p class="ptext">${esc(pn.looking_for)}. Available ${esc(pn.available_from)}.</p>`)}
    ${sec('Start here', `<div class="pact"><button type="button" data-sel="about">Inspect the About frame <span>→</span></button><button type="button" data-present="0">Present the projects flow <span>▷</span></button><button type="button" data-read>Read everything as one page <span>¶</span></button></div>`)}
    ${sec('Background', `<div class="fill"><i style="--sw:#e9e7e2"></i>E9E7E2<em>100%</em></div>`)}`;
}
function toolName(slug) { const t = D.tools.find(t => t.logo.includes('/' + slug + '.')); return t ? t.name : slug; }
function protoProps() {
  return `<div class="psec"><div class="sel-name"><span class="ic">▷</span>Projects flow</div><div class="sel-kind">Starting frame: ${esc(PROJ[0].name)}</div></div>
  ${sec('Frames in the flow', `<ol class="flowlist">${PROJ.map(f => `<li>${esc(f.name)}</li>`).join('')}</ol>`)}
  ${sec('Interaction', `<div class="inter"><b>On click</b> → Navigate to next project<br><b>Animation</b> Smart animate, ease out, 320 ms<br><b>Keys</b> ← → to move, Esc to close</div>`)}
  ${sec('Present', `<div class="pact"><button class="go" type="button" data-present="0">Present from the first project <span>▷</span></button></div>`)}`;
}
function commentsProps() {
  return `<ul class="clist">${PINS.map(p => {
    const m = p.msgs[0], last = p.msgs[p.msgs.length - 1];
    return `<li><button type="button" data-open-pin="${p.n}"><span class="cav" style="--pc:${last.a.c}">${esc(last.a.ini)}</span><span><small>#${p.n} · ${esc(BY[p.f].name)}${p.msgs.length > 1 ? ' · ' + p.msgs.length + ' messages' : ''}</small><p>${esc(m.t)}</p></span></button></li>`;
  }).join('')}</ul>`;
}
function renderProps() {
  const html = tab === 'proto' ? protoProps() : tab === 'comments' ? commentsProps() : propsFor(selected);
  $('#props').innerHTML = html;
  if ($('#sheet').classList.contains('open')) fillSheet();
}
function setTab(t) {
  tab = t;
  $$('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
  document.body.classList.toggle('proto', t === 'proto');
  $('#toolProto').setAttribute('aria-pressed', String(t === 'proto'));
  if (t === 'proto' && !readMode) flyTo(fitTarget(FRAMES.section, 120));
  if (t === 'comments') setComments(true);
  renderProps();
}

/* ---------------- Bottom sheet (phones) ---------------- */
function fillSheet() {
  $('#shTitle').textContent = selected ? BY[selected].name : 'Portfolio';
  $('#shBody').innerHTML = propsFor(selected);
}
function openSheet() { fillSheet(); $('#sheet').classList.add('open'); $('#scrim').classList.add('open'); }
function closeSheet() { $('#sheet').classList.remove('open'); $('#scrim').classList.remove('open'); }

/* ---------------- Comment threads ---------------- */
let openPin = null;
function showThread(n) {
  const p = PINS.find(x => x.n === +n); if (!p) return;
  if (openPin && openPin !== p) openPin.el.setAttribute('aria-expanded', 'false');
  openPin = p; p.el.setAttribute('aria-expanded', 'true');
  const t = $('#thread');
  t.innerHTML = `<div class="th-head"><span>Comment #${p.n} · ${esc(BY[p.f].name)}</span><button type="button" id="thClose" aria-label="Close comment">×</button></div>
    ${p.msgs.map(m => `<div class="msg"><span class="cav" style="--pc:${m.a.c}">${esc(m.a.ini)}</span><div><b>${esc(m.a.name)}</b><small>${esc(m.sub || (m.a === TARA ? 'Author' : m.a.role))}</small><p>${esc(m.t)}</p></div></div>`).join('')}
    ${BY[p.f].p ? `<div class="th-foot"><a href="project.html?p=${esc(BY[p.f].slug)}">Read the full write-up ↗</a></div>` : ''}`;
  t.classList.add('open');
  placeThread();
  $('#thClose').focus({ preventScroll: true });
}
function placeThread() {
  if (!openPin || isPhone()) return;
  const t = $('#thread'), r = openPin.el.getBoundingClientRect();
  if (!r.width) { closeThread(); return; }
  let x = r.right + 10, y = r.top - 10;
  if (x + 310 > innerWidth - (innerWidth > 1000 ? 290 : 10)) x = r.left - 310;
  y = Math.min(Math.max(58, y), innerHeight - t.offsetHeight - 12);
  t.style.left = Math.max(10, x) + 'px'; t.style.top = y + 'px';
}
function closeThread() {
  if (openPin) { openPin.el.setAttribute('aria-expanded', 'false'); const el = openPin.el; openPin = null; if (document.activeElement && $('#thread').contains(document.activeElement)) el.focus({ preventScroll: true }); }
  $('#thread').classList.remove('open');
}
function goPin(n) {
  const p = PINS.find(x => x.n === +n); if (!p) return;
  setComments(true);
  if (readMode) { BY[p.f].el.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' }); setTimeout(() => showThread(n), RM ? 0 : 450); return; }
  const f = BY[p.f];
  flyTo(fitTarget(f, 56));
  setTimeout(() => showThread(n), RM ? 0 : 600);
}
function setComments(on) {
  document.body.classList.toggle('hide-comments', !on);
  $('#toolComment').setAttribute('aria-pressed', String(on));
  if (!on) closeThread();
}

/* ---------------- Visitor cursors ---------------- */
const VIS = [
  { name: 'Recruiter', ini: 'RC', c: '#a3e52d', route: ['about', 'experience', 'contact', 'wins', 'about'] },
  { name: 'Hiring manager', ini: 'HM', c: '#ff61b0', route: ['p-suggested-routing-rules', 'p-slotwise', 'p-uc-reschedules', 'about', 'p-hrtech-pricing'] },
  { name: 'Engineer', ini: 'EN', c: '#1433ae', route: ['p-rules-latency', 'p-suggested-routing-rules', 'p-assignment-health', 'skills'] },
];
const STATUS = { about: 'Reading the intro', experience: 'Reading the experience', wins: 'Looking at the wins', skills: 'Checking the tools', contact: 'Copying the email' };
const statusFor = (v, id) => STATUS[id] || (v.name === 'Engineer' ? 'Reading ' + BY[id].name : 'Checking the numbers on ' + BY[id].name);
let following = null;
function buildVisitors() {
  const av = $('#avatars');
  av.innerHTML = `<button class="av you" type="button" style="--c:#1e1e1e" aria-label="You">You</button>` + VIS.map((v, i) => `<button class="av" type="button" data-follow="${i}" style="--c:${v.c}" aria-pressed="false" aria-label="${v.name}, click to follow">${v.ini}<span class="tip">${v.name}<small id="vs${i}"></small><small>Click to follow</small></span></button>`).join('');
  const cl = $('#cursors');
  VIS.forEach((v, i) => {
    v.k = 0; v.frame = v.route[0];
    const f = BY[v.frame];
    v.pos = { x: f.x + f.w * (.3 + .2 * i), y: f.y + f.h * (.4 + .1 * i) }; v.to = { ...v.pos };
    v.el = document.createElement('div'); v.el.className = 'cur'; v.el.style.setProperty('--c', v.c);
    v.el.innerHTML = `<svg viewBox="0 0 18 18"><path d="M2 1.5l13 6.8-5.9 1.3-2.6 5.6z" fill="${v.c}" stroke="#ffffff" stroke-width="1.3" stroke-linejoin="round"/></svg><div class="lab">${v.name}<small></small></div>`;
    cl.appendChild(v.el);
    v.next = performance.now() + 1200 + i * 900;
    setStatus(v, i);
  });
  if (!RM) requestAnimationFrame(tickVisitors); else drawVisitors();
}
function setStatus(v, i) { const s = statusFor(v, v.frame); v.el.querySelector('small').textContent = s; const t = $('#vs' + i); if (t) t.textContent = s; }
function tickVisitors(now) {
  VIS.forEach((v, i) => {
    if (now > v.next) {
      if (Math.random() < .45) { v.k = (v.k + 1) % v.route.length; v.frame = v.route[v.k]; setStatus(v, i); if (following === v) select(v.frame, { keepTab: true }); }
      const f = BY[v.frame];
      v.to = { x: f.x + f.w * (.15 + Math.random() * .7), y: f.y + f.h * (.15 + Math.random() * .7) };
      v.next = now + 2200 + Math.random() * 2600;
    }
    v.pos.x += (v.to.x - v.pos.x) * .035; v.pos.y += (v.to.y - v.pos.y) * .035;
  });
  drawVisitors();
  requestAnimationFrame(tickVisitors);
}
function drawVisitors() {
  if (readMode) return;
  VIS.forEach(v => { v.el.style.transform = `translate(${(v.pos.x * cam.z + cam.x).toFixed(1)}px,${(v.pos.y * cam.z + cam.y).toFixed(1)}px)`; });
}
function follow(i) {
  const v = VIS[i];
  if (following === v) { stopFollow(); return; }
  if (readMode) setRead(false);
  following = v;
  document.body.classList.add('following');
  $('#followRing').style.setProperty('--c', v.c);
  $('#followLbl').textContent = `Following ${v.name} · click or press Esc to stop`;
  $$('[data-follow]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.follow === i)));
  select(v.frame, { keepTab: true });
}
function stopFollow() {
  if (!following) return;
  following = null; document.body.classList.remove('following');
  $$('[data-follow]').forEach(b => b.setAttribute('aria-pressed', 'false'));
}

/* ---------------- Pointer, wheel, touch ---------------- */
const ptrs = new Map();
let drag = null, pinch = null, space = false, tool = 'move';
function local(e) { const r = vp.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
let suppressClick = 0;
vp.addEventListener('pointerdown', e => {
  const touch = e.pointerType === 'touch';
  if (!touch && e.target.closest('a,button,.pin') && !space && tool !== 'hand') return;
  if (e.button > 1) return;
  if (!touch) vp.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, local(e));
  hideHint();
  if (ptrs.size === 1) drag = { s: local(e), c: { ...cam }, moved: false, target: e.target };
  if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, c: { ...cam } };
    drag = null;
  }
});
vp.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.set(e.pointerId, local(e));
  if (pinch && ptrs.size >= 2) {
    const [a, b] = [...ptrs.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const z = Math.min(4, Math.max(.04, pinch.c.z * d / pinch.d)), k = z / pinch.c.z;
    setCam(m.x - (pinch.m.x - pinch.c.x) * k, m.y - (pinch.m.y - pinch.c.y) * k, z);
    stopFollow();
  } else if (drag) {
    const p = local(e), dx = p.x - drag.s.x, dy = p.y - drag.s.y;
    if (!drag.moved && Math.hypot(dx, dy) > 4) { drag.moved = true; vp.classList.add('dragging'); stopFollow(); if (tween) { cancelAnimationFrame(tween.id); tween = null; } }
    if (drag.moved) setCam(drag.c.x + dx, drag.c.y + dy, cam.z);
  }
});
function endPtr(e) {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  if (pinch) suppressClick = performance.now();
  if (ptrs.size < 2) pinch = null;
  if (drag && drag.moved) suppressClick = performance.now();
  if (drag && !drag.moved && ptrs.size === 0 && e.type === 'pointerup' && !drag.target.closest('a,button,.pin')) {
    const fr = drag.target.closest && drag.target.closest('.frame');
    if (fr && tool === 'move') select(fr.dataset.id, { user: true, sheet: true, zoom: !fr.classList.contains('is-selected') });
    else if (!fr) { deselect(); closeThread(); }
  }
  if (ptrs.size === 0) { drag = null; vp.classList.remove('dragging'); }
}
vp.addEventListener('pointerup', endPtr);
vp.addEventListener('click', e => { if (performance.now() - suppressClick < 80) { e.preventDefault(); e.stopPropagation(); } }, true);
vp.addEventListener('pointercancel', endPtr);
vp.addEventListener('wheel', e => {
  e.preventDefault(); hideHint();
  if (tween) { cancelAnimationFrame(tween.id); tween = null; }
  const p = local(e);
  const lineMode = e.deltaMode === 1;
  const mouseWheel = lineMode || (e.deltaX === 0 && Math.abs(e.deltaY) >= 50 && Number.isInteger(e.deltaY));
  if (e.ctrlKey || e.metaKey || mouseWheel) {
    const dy = lineMode ? e.deltaY * 33 : e.deltaY;
    const f = Math.exp(-Math.max(-300, Math.min(300, dy)) * (e.ctrlKey && !mouseWheel ? 0.012 : 0.0022));
    zoomAt(p.x, p.y, f);
  } else setCam(cam.x - e.deltaX, cam.y - e.deltaY, cam.z);
  stopFollow();
}, { passive: false });

/* ---------------- Read view ---------------- */
let io = null;
function setRead(on, first = false) {
  readMode = on;
  document.body.classList.toggle('read', on);
  $('#readBtn').setAttribute('aria-pressed', String(on));
  $('#readLbl').textContent = on ? 'Canvas' : 'Read all';
  $('#readBtn svg').innerHTML = on ? '<rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><path d="M2.5 6.5h11M6.5 6.5v7"/>' : '<path d="M3 2.5h7l3 3v8H3z"/><path d="M5.5 7.5h5M5.5 10h5"/>';
  $('#readBtn').setAttribute('aria-label', on ? 'Open the canvas' : 'Read everything as one page');
  closeThread(); closeSheet();
  const slot = $('#rvSlot');
  if (on) {
    const add = (html) => slot.insertAdjacentHTML('beforeend', html);
    slot.innerHTML = '';
    FRAMES.forEach(f => {
      if (f.id === PROJ[0].id) add(`<div class="rv-section">Projects · ${PROJ.length}</div>`);
      slot.appendChild(f.el);
      if (f.id === 'wins') add(`<div class="rv-section">What people said</div><div class="rv-quotes">${D.testimonials.map(t => `<figure><blockquote>“${esc(t.quote)}”</blockquote><figcaption><b>${esc(t.name)}</b>${esc(t.role)}. ${esc(t.relation)}</figcaption></figure>`).join('')}</div>`);
    });
    io = new IntersectionObserver(es => {
      es.forEach(en => { if (en.isIntersecting) setLayer(en.target.dataset.id); });
    }, { rootMargin: '-30% 0px -60% 0px' });
    FRAMES.forEach(f => io.observe(f.el));
    if (!first) scrollTo(0, 0);
    if (selected) BY[selected].el.scrollIntoView({ block: 'start' });
  } else {
    if (io) io.disconnect();
    FRAMES.forEach(f => world.appendChild(f.el));
    world.appendChild($('#flowflag'));
    scrollTo(0, 0);
    if (selected) fitFrame(selected, false); else fitAll(false);
  }
  const u = new URL(location.href);
  if (on) u.searchParams.set('view', 'read'); else u.searchParams.delete('view');
  history.replaceState(null, '', u);
}

/* ---------------- Prototype player ---------------- */
let pl = { i: 0, open: false, last: null };
function present(i = 0) {
  pl.open = true; closeThread(); closeSheet(); stopFollow();
  $('#player').classList.add('open');
  $('#plDots').innerHTML = PROJ.map((f, k) => `<button type="button" aria-label="Go to ${esc(f.name)}" data-k="${k}"></button>`).join('');
  pl.last = document.activeElement;
  show(i, 1);
  $('#plClose').focus({ preventScroll: true });
}
function show(i, dir) {
  pl.i = Math.max(0, Math.min(PROJ.length - 1, i));
  const f = PROJ[pl.i], stage = $('#plStage');
  $$('.pl-slide', stage).forEach(s => s.remove());
  const c = f.el.cloneNode(true);
  c.removeAttribute('id'); c.classList.remove('is-selected', 'is-hover');
  c.classList.add('pl-slide');
  if (!RM) c.classList.add('in'); if (dir < 0) c.classList.add('back');
  const flow = stage.clientWidth < 760;
  stage.classList.toggle('flow', flow);
  if (flow) {
    Object.assign(c.style, { position: 'relative', left: 'auto', top: 'auto', width: (stage.clientWidth - 24) + 'px', height: 'auto', transform: 'none', margin: '12px auto' });
    c.querySelector('.frame-body').style.height = 'auto';
    stage.style.overflow = 'auto'; stage.style.display = 'block'; stage.scrollTop = 0;
  } else {
    const s = Math.min((stage.clientWidth - 80) / f.w, (stage.clientHeight - 60) / f.h, 1.3);
    Object.assign(c.style, { left: '50%', top: '50%', width: f.w + 'px', height: f.h + 'px', transform: `translate(-50%,-50%) scale(${s})` });
    stage.style.overflow = 'hidden'; stage.style.display = 'grid';
  }
  stage.appendChild(c);
  $('#plCount').textContent = `${pl.i + 1} of ${PROJ.length} · ${f.name}`;
  $('#plOpen').href = 'project.html?p=' + f.slug;
  $$('#plDots button').forEach((b, k) => b.setAttribute('aria-current', String(k === pl.i)));
  $('#plPrev').disabled = pl.i === 0; $('#plNext').disabled = pl.i === PROJ.length - 1;
  if (!readMode) select(f.id, { zoom: false, keepTab: true });
}
function closePlayer() {
  pl.open = false; $('#player').classList.remove('open');
  $$('.pl-slide').forEach(s => s.remove());
  if (!readMode && selected) fitFrame(selected, false);
  if (readMode && selected) BY[selected].el.scrollIntoView({ block: 'start' });
  if (pl.last && pl.last.focus) pl.last.focus({ preventScroll: true });
}
function flash() { const h = $('#hotspot'); h.classList.remove('flash'); void h.offsetWidth; if (!RM) h.classList.add('flash'); }
(function playerEvents() {
  const st = $('#plStage');
  let sx = null, sy = null, moved = false;
  st.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; moved = false; });
  st.addEventListener('pointermove', e => { if (sx !== null && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) moved = true; });
  st.addEventListener('pointerup', e => {
    if (sx === null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { show(pl.i + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1); return; }
    if (!moved && !e.target.closest('a,button') && st.clientWidth >= 760) { flash(); if (pl.i < PROJ.length - 1) show(pl.i + 1, 1); }
  });
  $('#plPrev').onclick = () => show(pl.i - 1, -1);
  $('#plNext').onclick = () => show(pl.i + 1, 1);
  $('#plClose').onclick = closePlayer;
  $('#plDots').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) show(+b.dataset.k, +b.dataset.k > pl.i ? 1 : -1); });
  addEventListener('resize', () => { if (pl.open) show(pl.i, 0); });
})();

/* ---------------- Share ---------------- */
function buildShare() {
  const c = D.contact;
  $('#shareLine').textContent = `${D.person.looking_for}. Available ${D.person.available_from}.`;
  $('#shareActs').innerHTML = `<a class="go" href="mailto:${esc(c.email)}">Email ${esc(c.email)} <span>↗</span></a>
    <a href="${esc(c.linkedin)}" target="_blank" rel="noopener">LinkedIn <span>↗</span></a>
    <a href="${esc(c.calendly)}" target="_blank" rel="noopener">Book a call <span>↗</span></a>
    <a href="media/resume.pdf" download>Download resume <span>↓</span></a>
    <button type="button" id="copyLink">Copy link to this file <span>⧉</span></button>`;
}
function toggleShare(force) {
  const p = $('#sharePop'), on = force ?? !p.classList.contains('open');
  p.classList.toggle('open', on); $('#shareBtn').setAttribute('aria-expanded', String(on));
}

/* ---------------- Hint ---------------- */
let hintTimer = 0;
function hideHint() { $('#hint').classList.add('gone'); clearTimeout(hintTimer); }

/* ---------------- Global events ---------------- */
function setTool(t) {
  tool = t;
  $('#toolMove').setAttribute('aria-pressed', String(t === 'move'));
  $('#toolHand').setAttribute('aria-pressed', String(t === 'hand'));
  vp.classList.toggle('hand', t === 'hand');
}
function order() { return FRAMES.map(f => f.id); }
function step(d) {
  const o = order(); const i = selected ? o.indexOf(selected) : -1;
  select(o[(i + d + o.length) % o.length], { user: true });
}
function events() {
  document.addEventListener('click', e => {
    const t = e.target;
    const sel = t.closest('[data-sel]');
    if (sel && !t.closest('.viewport .frame-body')) {
      e.preventDefault();
      const fromSheetish = sel.closest('.frame-label') && isPhone();
      select(sel.dataset.sel, { user: true, sheet: fromSheetish || (isPhone() && !readMode) });
      return;
    }
    const go = t.closest('[data-go]');
    if (go) { e.preventDefault(); select(go.dataset.go, { user: true }); return; }
    const pr = t.closest('[data-present]');
    if (pr) { present(+pr.dataset.present); return; }
    if (t.closest('[data-read]')) { setRead(true); return; }
    const pin = t.closest('.pin');
    if (pin) { e.stopPropagation(); if (openPin && openPin.n === +pin.dataset.pin) closeThread(); else showThread(pin.dataset.pin); return; }
    const op = t.closest('[data-open-pin]');
    if (op) { closeSheet(); goPin(op.dataset.openPin); return; }
    const fl = t.closest('[data-follow]');
    if (fl) { follow(+fl.dataset.follow); return; }
    if (t.closest('#thClose')) { closeThread(); return; }
    if (t.closest('#flowflag')) { present(0); return; }
    if (t.closest('#copyLink')) {
      const u = location.href.split('#')[0];
      (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => { t.closest('#copyLink').firstChild.textContent = 'Link copied '; }).catch(() => { t.closest('#copyLink').firstChild.textContent = u + ' '; });
      return;
    }
    if (!t.closest('#sharePop,#shareBtn')) toggleShare(false);
    if (openPin && !t.closest('#thread,.pin,.clist')) closeThread();
  });
  // in Read view, clicking a frame selects it (desktop) without moving the page
  $('#read').addEventListener('click', e => {
    if (isPhone() || e.target.closest('a,button,.pin')) return;
    const fr = e.target.closest('.frame'); if (fr) select(fr.dataset.id, { zoom: false, user: true });
  });
  $$('.tab').forEach(b => b.onclick = () => setTab(b.dataset.tab));
  $('#readBtn').onclick = () => setRead(!readMode);
  $('#rvCanvas').onclick = () => setRead(false);
  $('#playBtn').onclick = () => present(selected && BY[selected].p ? BY[selected].n - 1 : 0);
  $('#shareBtn').onclick = e => { e.stopPropagation(); toggleShare(); };
  $('#toolMove').onclick = () => setTool('move');
  $('#toolHand').onclick = () => setTool('hand');
  $('#toolComment').onclick = () => setComments(document.body.classList.contains('hide-comments'));
  $('#toolProto').onclick = () => setTab(tab === 'proto' ? 'design' : 'proto');
  const zc = () => { const v = view(); return [v.l + v.w / 2, v.t + v.h / 2]; };
  $('#zoomIn').onclick = () => { const [x, y] = zc(); const z = cam.z; zoomAt(x, y, 1.4); const t = { ...cam }; cam.z = z; zoomAt(x, y, 1); flyTo(t, 220); };
  $('#zoomOut').onclick = () => { const [x, y] = zc(); const z = cam.z, s = { ...cam }; zoomAt(x, y, 1 / 1.4); const t = { ...cam }; Object.assign(cam, s); flyTo(t, 220); };
  $('#zoomFit').onclick = () => fitAll();
  $('#followRing span').onclick = stopFollow;
  $('#shClose').onclick = closeSheet; $('#scrim').onclick = closeSheet;
  $('#layers').addEventListener('mouseover', e => { const b = e.target.closest('[data-sel]'); FRAMES.forEach(f => f.el.classList.toggle('is-hover', !!b && b.dataset.sel === f.id)); });
  $('#layers').addEventListener('mouseleave', () => FRAMES.forEach(f => f.el.classList.remove('is-hover')));
  world.addEventListener('mouseover', e => { const fr = e.target.closest('.frame'); FRAMES.forEach(f => f.el.classList.toggle('is-hover', fr === f.el)); });
  world.addEventListener('mouseleave', () => FRAMES.forEach(f => f.el.classList.remove('is-hover')));
  document.addEventListener('keydown', e => {
    if (e.target.matches('input,textarea')) return;
    if (pl.open) {
      if (e.key === 'Escape') closePlayer();
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); show(pl.i + 1, 1); }
      if (e.key === 'ArrowLeft') show(pl.i - 1, -1);
      if (e.key === 'Tab') { const f = $$('#player a,#player button:not(:disabled)'); const i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
      return;
    }
    if (e.key === 'Escape') { if ($('#sheet').classList.contains('open')) closeSheet(); else if (openPin) closeThread(); else if (following) stopFollow(); else if ($('#sharePop').classList.contains('open')) toggleShare(false); else deselect(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (e.shiftKey && (e.code === 'Digit1')) { e.preventDefault(); if (!readMode) fitAll(); return; }
    if (e.shiftKey && (e.code === 'Digit2')) { e.preventDefault(); if (selected && !readMode) fitFrame(selected); return; }
    if (k === 'v') setTool('move');
    else if (k === 'h') setTool('hand');
    else if (k === 'c') setComments(document.body.classList.contains('hide-comments'));
    else if (k === 'p') present(selected && BY[selected].p ? BY[selected].n - 1 : 0);
    else if (k === 'r') setRead(!readMode);
    else if (!readMode && (k === '+' || k === '=')) $('#zoomIn').click();
    else if (!readMode && (k === '-' || k === '_')) $('#zoomOut').click();
    else if (!readMode && (e.key === 'ArrowRight' || e.key === 'ArrowDown') && !e.target.closest('.layers')) { e.preventDefault(); step(1); }
    else if (!readMode && (e.key === 'ArrowLeft' || e.key === 'ArrowUp') && !e.target.closest('.layers')) { e.preventDefault(); step(-1); }
    if (e.key === ' ' && !readMode && !e.target.closest('button,a')) { space = true; vp.classList.add('space'); e.preventDefault(); }
  });
  document.addEventListener('keyup', e => { if (e.key === ' ') { space = false; vp.classList.remove('space'); } });
  // frame focus via keyboard: tabbing into a frame selects it without moving the camera wildly
  world.addEventListener('focusin', e => {
    const fr = e.target.closest('.frame'); if (!fr || readMode) return;
    if (selected !== fr.dataset.id) select(fr.dataset.id, { user: true });
  });
  let lastW = innerWidth;
  addEventListener('resize', () => {
    if ((lastW <= 820) !== (innerWidth <= 820) && !readMode && isPhone()) setRead(true);
    lastW = innerWidth; render();
  });
}

/* ---------------- Init ---------------- */
fetch('content/portfolio.json').then(r => r.json()).then(data => {
  D = data;
  layout(); buildPins(); build(); buildVisitors(); buildShare(); events();
  renderProps();
  const startRead = params.get('view') === 'read' || isPhone() || RM;
  if (startRead) { setRead(true, true); }
  else {
    fitAll(false);
    setTimeout(() => select('about', { keepTab: true }), RM ? 0 : 700);
    hintTimer = setTimeout(hideHint, 9000);
  }
  if (FOR && !startRead) setTimeout(() => showThread(1), 1500);
}).catch(err => {
  document.body.classList.add('read');
  $('#rvInner').insertAdjacentHTML('beforeend', '<p style="padding:20px">The portfolio content could not be loaded. Please reload the page.</p>');
  console.warn(err);
});
})();
