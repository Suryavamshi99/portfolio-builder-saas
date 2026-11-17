/* ARJUN.TV app: profile picker (recruiter lens), billboard trailer, rows, hover previews, detail modal.
   All person content comes from content/portfolio.json. */
import { createTrailer, specFor } from './trailer.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const M = p => 'media/' + p;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } }
};

const ICONS = {
  spark: '<path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" fill="#ffffff"/>',
  chart: '<path d="M4 20V13M10 20V9M16 20V5" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/><path d="M3 9l6-4 5 3 7-5" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>',
  reel: '<rect x="3" y="4" width="18" height="16" rx="3" fill="none" stroke="#ffffff" stroke-width="2.4"/><path d="M10 9l6 3-6 3z" fill="#ffffff"/>',
  rocket: '<path d="M12 2c4 3 5 8 3 13H9C7 10 8 5 12 2z" fill="#ffffff"/><circle cx="12" cy="9" r="2" fill="#000000" opacity=".35"/><path d="M9 15l-3 4 4-1M15 15l3 4-4-1" fill="#ffffff"/>',
  book: '<path d="M4 5h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6v14h-6a2 2 0 0 0-2 1 2 2 0 0 0-2-1H4z" fill="none" stroke="#ffffff" stroke-width="2"/>'
};
const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
const I = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16l13-8z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="3"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18v12H3z" fill="none" stroke="currentColor" stroke-width="2"/><path d="m3 7 9 6 9-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round"/></svg>',
  right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round"/></svg>'
};

let D, ST, lens, bbTrailer, popTrailer, modalTrailer, lastFocus;
const params = new URLSearchParams(location.search);
const company = (params.get('for') || '').trim().slice(0, 40);

const proj = slug => D.projects.find(p => p.slug === slug);
const short = slug => ST.short_titles[slug] || proj(slug).title;
const color = slug => ST.colors[slug] || '#1a2cff';
const pageOf = slug => D.project_pages[slug] || {};
const list = () => store.get('ktv-list', []);

init();
async function init() {
  D = await (await fetch('content/portfolio.json')).json();
  ST = D.streaming;
  buildPicker();
  fillStatic();
  const want = params.get('lens');
  const hashTitle = (location.hash.match(/^#title=([\w-]+)/) || [])[1];
  const found = ST.lenses.find(l => l.id === want);
  if (found || hashTitle) {
    choose(found || ST.lenses[0], false);
    if (hashTitle && proj(hashTitle)) openTitle(hashTitle);
  } else {
    setTimeout(() => $('#profiles .profile')?.focus({ preventScroll: true }), 50);
  }
  addEventListener('scroll', () => { $('#top').classList.toggle('solid', scrollY > 40); hidePop(); }, { passive: true });
  addEventListener('keydown', onKey);
}

/* ---------- Who's watching? ---------- */
function buildPicker() {
  if (company) $('#picker-title').textContent = `Who's watching at ${company}?`;
  const ul = $('#profiles');
  ul.innerHTML = ST.lenses.map(l => `
    <li><button class="profile" data-lens="${l.id}">
      <span class="av" style="background:linear-gradient(140deg, ${l.color}, ${l.color}99 70%, #00000055)">${svg(l.icon)}</span>
      <span class="lbl">${esc(l.name)}</span></button></li>`).join('') +
    `<li><a class="profile read" href="read.html"><span class="av">${svg('book')}</span><span class="lbl">Just read it</span></a></li>`;
  ul.addEventListener('click', e => {
    const b = e.target.closest('[data-lens]'); if (!b) return;
    choose(ST.lenses.find(l => l.id === b.dataset.lens), true);
  });
  $('#who').addEventListener('click', () => {
    if (bbTrailer) bbTrailer.pause();
    document.body.classList.add('is-picking'); $('#picker').hidden = false;
    setTimeout(() => $(`#profiles [data-lens="${lens.id}"]`)?.focus(), 30);
  });
}

function choose(l, fromPicker) {
  lens = l;
  document.documentElement.style.setProperty('--lens', l.color);
  $('#who-av').style.background = l.color; $('#who-av').innerHTML = svg(l.icon);
  $('#who-name').textContent = l.name;
  store.set('ktv-lens', l.id);
  renderBillboard();
  renderRows();
  document.body.classList.remove('is-picking');
  setTimeout(() => { $('#picker').hidden = true; }, reduced ? 0 : 520);
  if (fromPicker) { scrollTo({ top: 0 }); $('#bb-read').focus({ preventScroll: true }); }
  const u = new URL(location); u.searchParams.set('lens', l.id); history.replaceState(null, '', u);
}

/* ---------- static bits: meet card, footer ---------- */
function fillStatic() {
  const P = D.person, C = D.contact;
  $('#meet-name').textContent = `${P.first_name} ${P.last_name}`;
  $('#meet-line').textContent = `Campaign marketer from a paper company. Postgraduate diploma at Halden School of Management, free from ${P.available_from}.`;
  $('#meet-photo').src = M(D.media.headshot);
  const mail = `mailto:${C.email}?subject=${encodeURIComponent('Saw your portfolio' + (company ? ' (' + company + ')' : ''))}`;
  $('#meet-email').href = mail; $('#top-mail').href = mail; $('#top-li').href = C.linkedin;
  $('#meet-about').addEventListener('click', openAbout);
  if (company) {
    const f = $('#meet-for'); f.hidden = false;
    f.textContent = D.pitch.for_company_template.replaceAll('{company}', company);
  }
  $('#foot-looking').textContent = `${P.looking_for}. Available from ${P.available_from}. Based in ${P.location}.`;
  $('#foot-actions').innerHTML = `
    <a class="btn btn-white" href="${esc(mail)}">${I.mail}${esc(C.email)}</a>
    <a class="btn btn-grey" href="${esc(C.linkedin)}" target="_blank" rel="noopener">LinkedIn</a>
    <a class="btn btn-grey" href="${esc(C.calendly)}" target="_blank" rel="noopener">Book 20 minutes</a>
    <a class="btn btn-grey" href="media/resume.pdf" target="_blank" rel="noopener">CV (PDF)</a>`;
  $('#foot-small').textContent = 'ARJUN.TV is a portfolio, not a streaming service. Arjun Mistry is a sample persona; every employer, school and brand on it is fictional.';
  $('#home-link').addEventListener('click', e => { e.preventDefault(); scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); });
  $('#bb-pause').addEventListener('click', () => bbTrailer && bbTrailer.toggle());
  $('#bb-replay').addEventListener('click', () => bbTrailer && bbTrailer.restart());
  document.addEventListener('visibilitychange', () => { if (document.hidden && bbTrailer) bbTrailer.pause(); });
}

/* ---------- billboard ---------- */
function renderBillboard() {
  const slug = lens.order[0], P = proj(slug), pg = pageOf(slug);
  $('#bb-title').textContent = short(slug);
  $('#bb-type').textContent = ST.rating[slug].toUpperCase();
  $('#bb-meta').innerHTML = metaLine(slug);
  $('#bb-blurb').textContent = P.summary;
  $('#bb-fit').innerHTML = `<b>Why it fits a ${esc(lens.name.toLowerCase())}:</b> ${esc(lens.fit[slug])}`;
  $('#bb-rating').textContent = P.org;
  $('#bb-read').onclick = () => openTitle(slug, { scrollTo: 'eps' });
  $('#bb-info').onclick = () => openTitle(slug, { scrollTo: 'eps' });
  if (bbTrailer) bbTrailer.destroy();
  const canvas = $('#bb-canvas');
  bbTrailer = createTrailer(canvas, specFor(slug, D), {
    layout: 'billboard', still: reduced,
    limit: () => { const m = $('#meet'), cr = canvas.getBoundingClientRect(); return m ? m.getBoundingClientRect().top - cr.top : cr.height * 0.6; },
    onFrame: (f, i, n, name) => { $('#bb-prog').style.width = (f * 100).toFixed(2) + '%'; $('#bb-scene').textContent = `Trailer · ${i + 1}/${n} · ${name}`; },
    onState: on => { $('#bb-pause').innerHTML = on ? I.pause : I.play; $('#bb-pause').setAttribute('aria-label', on ? 'Pause trailer' : 'Play trailer'); }
  });
  canvas.setAttribute('aria-label', `Trailer for ${short(slug)}`);
  $('.bb-progress').style.display = 'block';
  if (!reduced) bbTrailer.play(); else { $('#bb-pause').innerHTML = I.play; $('#bb-scene').textContent = 'Trailer paused · press play'; }
}

function metaLine(slug, compact) {
  const P = proj(slug);
  return `<span class="m">${lens.match[slug]}% match</span><span>${esc(P.year).replace('–', ' to ')}</span>${compact ? '' : `<span>${esc(P.duration)}</span>`}<span class="chip">${esc(ST.rating[slug])}</span><span class="chip solid">HD</span>`;
}

/* ---------- rows ---------- */
function renderRows() {
  const rows = $('#rows');
  const L = list();
  rows.innerHTML = [
    row('campaigns', 'Campaigns', `Top 8 for ${lens.name.toLowerCase()}s`, lens.order.map((s, i) => topItem(s, i)).join('')),
    L.length ? row('list', 'My list', `${L.length} saved`, L.map(s => `<button class="card list-card" data-title="${s}" aria-label="${esc(short(s))}"><img src="${M(proj(s).thumbnail)}" alt="" loading="lazy"></button>`).join('') +
      `<a class="list-cta" href="${esc(listMail(L))}"><b>Send Arjun this list</b><span>Opens an email with these ${L.length === 1 ? 'title' : L.length + ' titles'} so he knows what to talk about.</span></a>`) : '',
    row('brands', 'Brands', 'Where the work was made', ST.brands.map(brandCard).join('')),
    row('wins', 'Wins', 'Awards and shortlists', D.wins.map(winCard).join('')),
    row('skills', 'Skills', 'What he brings to a team', Object.keys(D.skills).map(skillCard).join('') + toolCard()),
    row('offair', 'Off air', 'Weekends and evenings', D.outside.map(o => `<div class="card poster"><img src="${M(o.image)}" alt="${esc(o.title)}" loading="lazy"><div class="cap"><b>${esc(o.title)}</b><span>${esc(o.detail)}</span></div></div>`).join(''))
  ].join('');
  rows.querySelectorAll('.row').forEach(wireRow);
}
function row(id, title, sub, inner) {
  return `<section class="row" id="row-${id}" aria-labelledby="h-${id}">
    <div class="row-head"><h2 id="h-${id}">${esc(title)}</h2><span class="sub">${esc(sub)}</span></div>
    <button class="arrow prev" aria-label="Scroll ${esc(title)} left">${I.left}</button>
    <div class="track" data-qa-scroll>${inner}</div>
    <button class="arrow next" aria-label="Scroll ${esc(title)} right">${I.right}</button></section>`;
}
function topItem(slug, i) {
  return `<button class="top-item" data-title="${slug}" aria-label="${i + 1}. ${esc(short(slug))}, ${lens.match[slug]}% match">
    <span class="num" aria-hidden="true">${i + 1}</span>
    <span class="card"><img src="${M(proj(slug).thumbnail)}" alt="" loading="${i < 4 ? 'eager' : 'lazy'}"></span></button>`;
}
function brandCard(b) {
  const inner = b.logo ? `<img src="${M(b.logo)}" alt="">` : `<span class="mark" style="color:${b.fg}">${esc(b.mark)}</span>`;
  return `<button class="card brand-card" data-brand="${b.id}" style="background:${b.bg};color:${b.fg || (b.bg === '#1c1a22' ? '#ffffff' : '#111111')}" aria-label="${esc(b.name)}">${inner}<span class="bname">${esc(b.name)} · ${esc(b.years)}</span></button>`;
}
function winCard(w, i) {
  return `<button class="card win-card" data-win="${i}" aria-label="${esc(w.title)}"><span class="ph" style="display:block"><img src="${M(w.image)}" alt="" loading="lazy"><span class="ribbon">${esc(w.tag)}</span></span><span class="cap"><b>${esc(w.title)}</b><span>${esc(w.detail)}</span></span></button>`;
}
const SKC = { Brand: '#1a2cff', Growth: '#d22f35', Make: '#8aff7c' };
function skillCard(k) {
  return `<button class="card skill-card" data-skill="${k}" style="--c:${SKC[k]}" aria-label="${k} skills"><h3>${k}</h3><p>${esc(ST.skill_lines[k])}</p><ul>${D.skills[k].slice(0, 4).map(s => `<li>${esc(s)}</li>`).join('')}</ul></button>`;
}
function toolCard() {
  return `<button class="card skill-card tool-card" data-skill="Tools" style="--c:#fffc3a" aria-label="Toolkit"><h3>Toolkit</h3><p>${D.tools.length} tools he uses every week</p><span class="tool-grid">${D.tools.slice(0, 12).map(t => `<img src="${M(t.logo)}" alt="" loading="lazy">`).join('')}</span></button>`;
}
function listMail(L) {
  const body = 'Hi Arjun,\n\nI looked at your portfolio and would like to talk about:\n' + L.map(s => '- ' + short(s) + ' (' + proj(s).org + ')').join('\n') + '\n\n';
  return `mailto:${D.contact.email}?subject=${encodeURIComponent('About your work' + (company ? ' (' + company + ')' : ''))}&body=${encodeURIComponent(body)}`;
}

function wireRow(r) {
  const tr = $('.track', r);
  $('.prev', r).onclick = () => tr.scrollBy({ left: -tr.clientWidth * 0.85, behavior: reduced ? 'auto' : 'smooth' });
  $('.next', r).onclick = () => tr.scrollBy({ left: tr.clientWidth * 0.85, behavior: reduced ? 'auto' : 'smooth' });
  tr.addEventListener('scroll', hidePop, { passive: true });
  tr.addEventListener('click', e => {
    const el = e.target.closest('[data-title],[data-brand],[data-win],[data-skill]'); if (!el) return;
    hidePop();
    if (el.dataset.title) openTitle(el.dataset.title);
    else if (el.dataset.brand) openBrand(el.dataset.brand);
    else if (el.dataset.win) openWin(+el.dataset.win);
    else openSkill(el.dataset.skill);
  });
  if (canHover) {
    tr.addEventListener('mouseover', e => {
      const el = e.target.closest('[data-title]'); if (!el || el === popFor) return;
      clearTimeout(popTimer); popTimer = setTimeout(() => showPop(el), 480);
    });
    tr.addEventListener('mouseleave', () => clearTimeout(popTimer));
  }
}

/* ---------- hover preview ---------- */
let popTimer, popFor = null, trailerTimer;
function showPop(el) {
  const slug = el.dataset.title, P = proj(slug);
  const card = el.querySelector('.card') || el;
  const r = card.getBoundingClientRect();
  const w = Math.min(Math.max(r.width * 1.45, 340), 460);
  let left = r.left + r.width / 2 - w / 2;
  left = Math.max(12, Math.min(innerWidth - w - 12, left));
  const pop = $('#pop'); popFor = el;
  const inList = list().includes(slug);
  pop.innerHTML = `
    <div class="pop-media" data-open><img src="${M(P.thumbnail)}" alt=""><canvas aria-hidden="true"></canvas></div>
    <div class="pop-body">
      <div class="pop-ctrls">
        <button class="cbtn play" data-act="play" aria-label="Play trailer and open ${esc(short(slug))}">${I.play}</button>
        <button class="cbtn" data-act="list" aria-pressed="${inList}" aria-label="${inList ? 'Remove from' : 'Add to'} my list">${inList ? I.check : I.plus}</button>
        <button class="cbtn more" data-act="open" aria-label="More about ${esc(short(slug))}">${I.down}</button>
      </div>
      <div class="pop-meta">${metaLine(slug, true)}</div>
      <p class="pop-title">${esc(short(slug))}</p>
      <p class="pop-fit">${esc(lens.fit[slug])}</p>
      <ul class="tags">${P.tags.slice(0, 3).map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    </div>`;
  pop.hidden = false;
  pop.style.width = w + 'px'; pop.style.left = left + scrollX + 'px';
  pop.style.top = (r.top + scrollY - (w * 9 / 16 - r.height) / 2) + 'px';
  pop.onmouseleave = hidePop;
  pop.onclick = e => {
    const a = e.target.closest('[data-act],[data-open]'); if (!a) return;
    if (a.dataset.act === 'list') { toggleList(slug); hidePop(); return; }
    hidePop(); openTitle(slug, { autoplay: a.dataset.act === 'play' });
  };
  clearTimeout(trailerTimer);
  if (!reduced) trailerTimer = setTimeout(() => {
    const cv = $('canvas', pop); if (!cv || popFor !== el) return;
    popTrailer = createTrailer(cv, specFor(slug, D), { layout: 'mini' });
    popTrailer.play(); cv.classList.add('on');
  }, 900);
}
function hidePop() {
  clearTimeout(popTimer); clearTimeout(trailerTimer);
  if (popTrailer) { popTrailer.destroy(); popTrailer = null; }
  const pop = $('#pop'); if (pop && !pop.hidden) { pop.hidden = true; pop.innerHTML = ''; }
  popFor = null;
}
function toggleList(slug) {
  const L = list(); const i = L.indexOf(slug);
  if (i >= 0) L.splice(i, 1); else L.push(slug);
  store.set('ktv-list', L);
  const y = scrollY; renderRows(); scrollTo({ top: y });
  return L.includes(slug);
}

/* ---------- modal shell ---------- */
function openModal(html, label) {
  hidePop();
  lastFocus = document.activeElement;
  if (bbTrailer && bbTrailer.playing) { bbTrailer.pause(); bbTrailer._resume = true; }
  stopModalTrailer();
  const wrap = $('#modal'); $('#modal-body').innerHTML = html;
  wrap.hidden = false; document.body.classList.add('modal-open');
  $('.modal', wrap).setAttribute('aria-label', label);
  wrap.scrollTop = 0;
  $('.modal', wrap).focus({ preventScroll: true });
  wrap.onclick = e => {
    if (e.target.closest('[data-close]')) return closeModal();
    const t = e.target.closest('[data-title]'); if (t) return openTitle(t.dataset.title);
  };
}
function closeModal() {
  stopModalTrailer();
  const wrap = $('#modal'); wrap.hidden = true; $('#modal-body').innerHTML = '';
  document.body.classList.remove('modal-open');
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  if (bbTrailer && bbTrailer._resume) { bbTrailer._resume = false; bbTrailer.play(); }
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
}
function stopModalTrailer() { if (modalTrailer) { modalTrailer.destroy(); modalTrailer = null; } }
function onKey(e) {
  const wrap = $('#modal');
  if (e.key === 'Escape') { if (!wrap.hidden) closeModal(); else hidePop(); }
  if (e.key === 'Tab' && !wrap.hidden) {
    const f = [...wrap.querySelectorAll('button, a[href], [tabindex="0"]')].filter(x => x.offsetParent !== null);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
}

/* ---------- title detail ---------- */
function openTitle(slug, opt = {}) {
  const P = proj(slug), pg = pageOf(slug), c = color(slug);
  const inList = list().includes(slug);
  const eps = episodes(slug);
  const extras = (pg.images || []).filter(s => s.startsWith('projects/') && !s.endsWith('thumb.jpg'));
  const viz = vizFor(slug);
  const more = moreLike(slug);
  const html = `
    <div class="m-top"><div class="m-hero">
      <img src="${M(P.thumbnail)}" alt="Key art for ${esc(short(slug))}">
      <canvas aria-hidden="true"></canvas>
      <div class="fade"></div>
    </div>
      <div class="m-hero-text">
        <h2 class="m-title" id="modal-title">${esc(short(slug))}</h2>
        <div class="m-actions">
          <button class="btn btn-white" id="m-play">${I.play}Play trailer</button>
          <button class="cbtn" id="m-list" aria-pressed="${inList}" aria-label="${inList ? 'Remove from' : 'Add to'} my list">${inList ? I.check : I.plus}</button>
        </div>
      </div>
    </div>
    <div class="m-body">
      <div class="m-grid">
        <div>
          <p class="m-meta">${metaLine(slug)}</p>
          <p class="m-fit"><b>For a ${esc(lens.name.toLowerCase())}:</b> ${esc(lens.fit[slug])}</p>
          <h3 class="m-summary" style="font-weight:400">${esc(P.title)}</h3>
          <p class="m-summary">${esc(P.summary)}</p>
          <p class="m-result">${esc(P.result)}</p>
        </div>
        <div class="m-side">
          <p><span>Role: </span>${esc(pg.my_role || P.role)}</p>
          <p><span>Made at: </span>${esc(P.org)}, ${esc(pg.dates || P.year)}</p>
          <p><span>Team: </span>${esc(P.team)}</p>
          <p><span>Genres: </span>${P.tags.map(esc).join(', ')}</p>
        </div>
      </div>
      <h3 class="m-h" id="eps">Episodes <small>How it was made · ${eps.length} episodes</small></h3>
      <ol class="eps">${eps.map((e, i) => `
        <li class="ep">
          <span class="ep-n">${i + 1}</span>
          <span class="ep-th" style="--c:linear-gradient(135deg, ${c}, ${c}66 60%, #111111)"><span class="k">A</span><span class="t">${esc(e.thumb)}</span></span>
          <div><div class="ep-top"><b>${esc(e.title)}</b><span>${esc(e.kind)}</span></div>${e.body}</div>
        </li>`).join('')}</ol>
      ${(extras.length || viz) ? `<h3 class="m-h">Extras <small>Behind the scenes</small></h3><div class="extras">${viz ? `<figure class="viz">${viz}</figure>` : ''}${extras.map(s => `<figure><img src="${M(s)}" alt="" loading="lazy"><figcaption>${esc(extraCaption(s))}</figcaption></figure>`).join('')}</div>` : ''}
      <h3 class="m-h">More like this</h3>
      <div class="more">${more.map(s => `<button class="more-card" data-title="${s}"><img src="${M(proj(s).thumbnail)}" alt="" loading="lazy"><div><span class="m">${lens.match[s]}% match</span><b>${esc(short(s))}</b><p>${esc(lens.fit[s])}</p></div></button>`).join('')}</div>
      <div class="m-about">
        <h3 class="m-h" style="margin-top:0">About ${esc(short(slug))}</h3>
        <p><span>Made by: </span>Arjun Mistry, ${esc(pg.my_role || P.role)}</p>
        <p><span>Tools: </span>${P.tools.map(t => (D.tools.find(x => x.logo.includes('/' + t + '.')) || { name: t }).name).map(esc).join(', ')}</p>
        <p><span>This campaign is: </span>${esc(ST.rating[slug])}, ${esc(P.duration)}</p>
        <div class="contact-row"><a class="pill pill-white" href="mailto:${esc(D.contact.email)}?subject=${encodeURIComponent('About ' + short(slug))}">Ask Arjun about this</a><a class="pill pill-dark" href="read.html#${slug}">Read as plain text</a></div>
      </div>
    </div>`;
  openModal(html, short(slug));
  if (location.hash !== '#title=' + slug) history.replaceState(null, '', '#title=' + slug);
  const cv = $('.m-hero canvas');
  modalTrailer = createTrailer(cv, specFor(slug, D), {
    layout: 'full', loop: false,
    onState: on => { const b = $('#m-play'); if (b) { b.innerHTML = (on ? I.pause + 'Pause trailer' : I.play + 'Play trailer'); b.setAttribute('aria-pressed', on); } },
    onEnd: () => { if (modalTrailer) modalTrailer._ended = true; const b = $('#m-play'); if (b) b.innerHTML = I.play + 'Replay trailer'; }
  });
  let started = false;
  const start = () => { started = true; modalTrailer._ended = false; cv.classList.add('on'); modalTrailer.restart(); };
  $('#m-play').onclick = () => { if (!started) start(); else if (!modalTrailer.playing) { if (modalTrailer._ended) start(); else modalTrailer.play(); } else modalTrailer.pause(); };
  $('#m-list').onclick = () => { const on = toggleList(slug); const b = $('#m-list'); b.setAttribute('aria-pressed', on); b.innerHTML = on ? I.check : I.plus; b.setAttribute('aria-label', (on ? 'Remove from' : 'Add to') + ' my list'); };
  if (opt.autoplay || (!reduced && !opt.scrollTo)) setTimeout(() => { if (modalTrailer && !started) start(); }, opt.autoplay ? 50 : 900);
  if (opt.scrollTo) setTimeout(() => { const t = $('#' + opt.scrollTo); if (t) $('#modal').scrollTo({ top: t.offsetTop - 10, behavior: reduced ? 'auto' : 'smooth' }); }, 60);
}

function episodes(slug) {
  const P = proj(slug), pg = pageOf(slug);
  const eps = [{ title: 'The brief', kind: pg.dates || P.year, thumb: 'Brief', body: `<p>${esc(pg.context)}</p><p>${esc(pg.problem)}</p>` }];
  (pg.decisions || []).forEach((d, i) => eps.push({ title: d.choice, kind: `Decision ${i + 1}`, thumb: `Decision ${i + 1}`, body: `<p>${esc(d.why)}</p>` }));
  eps.push({ title: 'What I did', kind: `${(pg.what_i_did || []).length} steps`, thumb: 'The work', body: `<ul>${(pg.what_i_did || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>` });
  eps.push({ title: 'Results', kind: 'Finale', thumb: (pg.results && pg.results[0].value) || 'Results',
    body: `<div class="res">${(pg.results || []).map(r => `<div><b>${esc(r.value)}</b><span>${esc(r.metric)}</span><em>${esc(r.note)}</em></div>`).join('')}</div><p><strong>What I learned:</strong> ${esc(pg.learned)}</p>` });
  if (pg.next) eps.push({ title: 'Next season', kind: 'Coming next', thumb: 'Next', body: `<p>${esc(pg.next)}</p>` });
  return eps;
}
function extraCaption(s) {
  const m = { 'tiers.jpg': 'How the 48 stationers were picked and briefed', 'shares.jpg': 'Owner-first openings against shop-front openings', 'ab-test.jpg': 'The postcards against email test, three weeks' };
  return m[s.split('/').pop()] || 'From the project';
}
function moreLike(slug) {
  const tags = new Set(proj(slug).tags);
  return D.projects.filter(p => p.slug !== slug)
    .map(p => ({ s: p.slug, k: p.tags.filter(t => tags.has(t)).length * 10 + lens.match[p.slug] / 10 }))
    .sort((a, b) => b.k - a.k).slice(0, 3).map(x => x.s);
}

/* Code-drawn extra per project (from the "visual" field in the content file). */
function vizFor(slug) {
  const v = pageOf(slug).visual; const c = color(slug);
  if (!v) return '';
  if (v.kind === 'bars') {
    const rows = v.rows.map((r, i) => `<text x="0" y="${30 + i * 64}" fill="#bbbbbb" font-size="14" font-family="Inter">${esc(r[0])}</text>
      <rect x="0" y="${40 + i * 64}" width="${(r[1] / v.max) * 300}" height="22" rx="3" fill="${i ? c : '#666666'}"/>
      <text x="${(r[1] / v.max) * 300 + 10}" y="${57 + i * 64}" fill="#ffffff" font-size="22" font-family="Bebas">${esc(r[2])}</text>`).join('');
    return `<svg viewBox="0 0 400 160" role="img" aria-label="${esc(v.title)}"><text x="0" y="10" fill="${c}" font-size="11" font-family="Mono" letter-spacing="2">${esc(v.title.toUpperCase())}</text>${rows}</svg>`;
  }
  if (v.kind === 'donut') {
    const r = 54, C = 2 * Math.PI * r;
    return `<svg viewBox="0 0 400 160" role="img" aria-label="${v.value}% ${esc(v.label)}"><circle cx="80" cy="80" r="${r}" fill="none" stroke="#333333" stroke-width="18"/><circle cx="80" cy="80" r="${r}" fill="none" stroke="${c}" stroke-width="18" stroke-dasharray="${C * v.value / 100} ${C}" transform="rotate(-90 80 80)"/><text x="80" y="92" text-anchor="middle" fill="#ffffff" font-size="38" font-family="Bebas">${v.value}%</text>
      <foreignObject x="160" y="40" width="230" height="90"><p xmlns="http://www.w3.org/1999/xhtml" style="margin:0;color:#dddddd;font:600 15px Inter;line-height:1.4">${esc(v.label)}</p></foreignObject></svg>`;
  }
  if (v.kind === 'flow') {
    return `<svg viewBox="0 0 400 170" role="img" aria-label="${esc(v.note)}">${v.steps.map((s, i) => `<rect x="${i * 134}" y="10" width="124" height="86" rx="6" fill="#262626" stroke="${c}"/><text x="${i * 134 + 10}" y="32" fill="${c}" font-size="10" font-family="Mono">STEP ${i + 1}</text>
      <foreignObject x="${i * 134 + 8}" y="38" width="110" height="56"><p xmlns="http://www.w3.org/1999/xhtml" style="margin:0;color:#ffffff;font:700 12.5px Inter;line-height:1.25">${esc(s[0])}<br><span style="font-weight:400;color:#bbbbbb">${esc(s[1])}</span></p></foreignObject>`).join('')}
      <foreignObject x="0" y="108" width="400" height="60"><p xmlns="http://www.w3.org/1999/xhtml" style="margin:0;color:#cccccc;font:13px Inter;line-height:1.4">${esc(v.note)}</p></foreignObject></svg>`;
  }
  if (v.kind === 'script') {
    return `<svg viewBox="0 0 400 170" role="img" aria-label="Script excerpt"><rect width="400" height="170" rx="6" fill="#e7e4f4"/><text x="20" y="32" fill="#111111" font-size="12" font-family="Mono">INT. STATIONERY SHOP, CLOSED. NIGHT.</text><text x="20" y="58" fill="#555555" font-size="11" font-family="Mono">A phone rings behind the counter. The machine picks up.</text><text x="200" y="90" text-anchor="middle" fill="#111111" font-size="12" font-family="Mono">FATHER (V.O., VOICEMAIL)</text><text x="200" y="112" text-anchor="middle" fill="#111111" font-size="12" font-family="Mono">The green one, with the lines. She'll know.</text><text x="20" y="150" fill="#888888" font-size="10" font-family="Mono">'OUT OF STOCK' · 90 SECONDS · WRITTEN BY ARJUN MISTRY</text></svg>`;
  }
  if (v.kind === 'post') {
    return `<svg viewBox="0 0 400 170" role="img" aria-label="The three parts of every Line Break issue"><rect width="400" height="170" rx="8" fill="#ffffff"/><circle cx="30" cy="30" r="14" fill="${c}"/><text x="52" y="27" fill="#111111" font-size="13" font-weight="700" font-family="Inter">Line Break</text><text x="52" y="42" fill="#777777" font-size="11" font-family="Inter">One regional print ad, every week</text>
      ${['1  The headline', '2  Who it was meant for', '3  The change I would test'].map((t, i) => `<rect x="20" y="${62 + i * 34}" width="360" height="26" rx="4" fill="${i === 2 ? c : '#f0f0f0'}"/><text x="32" y="${80 + i * 34}" fill="${i === 2 ? '#ffffff' : '#222222'}" font-size="13" font-weight="600" font-family="Inter">${t}</text>`).join('')}</svg>`;
  }
  return '';
}

/* ---------- brand, win, skill, about ---------- */
function titleCards(slugs) {
  if (!slugs.length) return '';
  return `<h3 class="m-h">Titles from here</h3><div class="more">${slugs.map(s => `<button class="more-card" data-title="${s}"><img src="${M(proj(s).thumbnail)}" alt="" loading="lazy"><div><span class="m">${lens.match[s]}% match</span><b>${esc(short(s))}</b><p>${esc(lens.fit[s])}</p></div></button>`).join('')}</div>`;
}
function openBrand(id) {
  const b = ST.brands.find(x => x.id === id);
  const xp = (b.exp || []).map(i => D.experience[i]);
  const ed = b.edu != null ? D.education[b.edu] : null;
  const hero = b.logo ? `<img src="${M(b.logo)}" alt="${esc(b.name)} logo">` : `<span class="mark" style="color:${b.fg}">${esc(b.mark)}</span>`;
  openModal(`
    <div class="brand-hero" style="background:${b.bg}">${hero}</div>
    <div class="m-body" style="padding-top:28px">
      <h2 class="m-title" id="modal-title" style="font-size:52px">${esc(b.name)}</h2>
      <p class="m-meta"><span class="m">${esc(b.years)}</span></p>
      <p class="m-summary">${esc(b.line)}</p>
      ${xp.map(x => `<div class="xp"><b>${esc(x.role)}</b><span class="d">${esc(x.org)}, ${esc(x.place)} · ${esc(x.dates).replace('–', 'to')}</span><ul>${x.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>`).join('')}
      ${ed ? `<div class="xp"><b>${esc(ed.degree)}</b><span class="d">${esc(ed.school)} · ${esc(ed.years).replace('–', ' to ')}</span><ul><li>${esc(ed.notes)}</li></ul></div>` : ''}
      ${titleCards(b.projects)}
    </div>`, b.name);
}
function openWin(i) {
  const w = D.wins[i]; const s = ST.win_titles[w.title];
  openModal(`
    <div class="m-top"><div class="m-hero"><img src="${M(w.image)}" alt="${esc(w.title)}"><div class="fade"></div></div>
      <div class="m-hero-text"><p class="badge"><span class="k">A</span> ${esc(w.tag.toUpperCase())}</p><h2 class="m-title" id="modal-title" style="font-size:clamp(36px,5vw,60px)">${esc(w.title)}</h2></div></div>
    <div class="m-body"><p class="m-summary">${esc(w.detail)}</p>${s ? titleCards([s]) : ''}</div>`, w.title);
}
function openSkill(k) {
  const isTools = k === 'Tools';
  const body = isTools
    ? `<div class="tool-grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px">${D.tools.map(t => `<span style="display:flex;align-items:center;gap:10px;font-size:14px"><img src="${M(t.logo)}" alt="" style="width:34px;height:34px">${esc(t.name)}</span>`).join('')}</div>`
    : `<ul class="why">${D.skills[k].map(s => `<li>${esc(s)}</li>`).join('')}</ul>${titleCards(ST.skill_titles[k])}`;
  const certs = isTools ? `<h3 class="m-h">Certificates</h3><ul class="why">${D.certifications.map(c => `<li>${esc(c.name)}, ${esc(c.issuer)}, ${esc(c.year)}</li>`).join('')}</ul>` : '';
  openModal(`<div class="m-body" style="padding-top:56px"><p class="badge"><span class="k">A</span> SKILLS</p><h2 class="m-title" id="modal-title">${isTools ? 'Toolkit' : esc(k)}</h2><p class="m-summary">${isTools ? 'The tools Arjun uses for planning, buying media, shooting and editing.' : esc(ST.skill_lines[k])}</p>${body}${certs}</div>`, k);
}
function openAbout() {
  const P = D.person, A = D.about;
  openModal(`
    <div class="about-top">
      <img src="${M(D.media.professional)}" alt="Arjun Mistry, half-length portrait">
      <div>
        <p class="badge"><span class="k">A</span> MEET ARJUN</p>
        <h2 id="modal-title">${esc(P.first_name)} ${esc(P.last_name)}</h2>
        <p style="color:#ffffff;font-weight:600">${esc(P.headline)}.</p>
        <p>${esc(A.intro)}</p>
        <p>${esc(A.now)}</p>
        <div class="contact-row"><a class="pill pill-white" href="mailto:${esc(D.contact.email)}">Email</a><a class="pill pill-dark" href="${esc(D.contact.linkedin)}" target="_blank" rel="noopener">LinkedIn</a><a class="pill pill-dark" href="media/resume.pdf" target="_blank" rel="noopener">CV</a></div>
      </div>
    </div>
    <div class="m-body">
      <h3 class="m-h">Why hire him</h3>
      <ul class="why">${D.pitch.why_hire.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <h3 class="m-h">Seasons <small>${D.journey.length} so far</small></h3>
      <ul class="seasons">${D.journey.map(j => `<li><span>${esc(j.year).replace('–', ' to ')}</span><div><b>${esc(j.title)}</b><p>${esc(j.detail)}</p></div></li>`).join('')}</ul>
      <h3 class="m-h">Reviews</h3>
      <div class="reviews">${D.testimonials.map(t => `<blockquote>${esc(t.quote)}<cite><b>${esc(t.name)}</b>${esc(t.role)}. ${esc(t.relation).replace('–', ' to ')}</cite></blockquote>`).join('')}</div>
      <h3 class="m-h">How he works</h3>
      <ul class="why">${D.values.map(v => `<li>${esc(v)}</li>`).join('')}</ul>
    </div>`, 'About Arjun Mistry');
}
