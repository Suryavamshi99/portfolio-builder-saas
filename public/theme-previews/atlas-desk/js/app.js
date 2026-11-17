/* Dev Oberoi's portfolio as a map app: place card, saved places, reviews, about, place pages, directions and timeline. */
'use strict';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = { get(k, d) { try { const v = localStorage.getItem('gm08.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('gm08.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } } };
const isPhone = () => matchMedia('(max-width: 760px)').matches;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ms = (n, cls = '') => `<span class="ms ${cls}" aria-hidden="true">${n}</span>`;
const fmtKm = km => (Math.round(km / 10) * 10).toLocaleString('en-IN') + ' km';
const media = p => 'media/' + p;
const MV = window.MapView;
let P, M, map, PROJ = {}, PLACE_LL = {};
const ST = { view: null, key: null, filter: null, dest: 'jaipur', mode: 'playbook', alt: 0, step: null, tlYear: 'all', tlActive: null, starred: store.get('starred', []), liked: store.get('liked', []), sheet: 'peek', lastPlan: null, saveMe: store.get('saveMe', false) };

/* ---------- boot ---------- */
Promise.all([fetch('content/portfolio.json').then(r => r.json()), fetch('content/maps.json').then(r => r.json())]).then(([p, m]) => {
  P = p; M = m; P.projects.forEach(x => { PROJ[x.slug] = x; });
  Object.entries(M.places).forEach(([slug, pl]) => { const c = MV.cityById[pl.city]; PLACE_LL[slug] = MV.kmToLL(c, pl.at[0], pl.at[1]); });
  initMap(); initChrome(); initSheet(); route(); addEventListener('hashchange', () => { if (!$('#coach').hidden) endTour(); route(); });
  addEventListener('scroll', () => { if (scrollX || scrollY) scrollTo(0, 0); }); document.body.addEventListener('scroll', () => { document.body.scrollTop = 0; document.body.scrollLeft = 0; });
  setTimeout(maybeTour, 900);
}).catch(err => { $('#panel').innerHTML = `<div class="sec"><p>Could not load the portfolio data. <a href="read.html">Open the résumé view</a>.</p></div>`; console.warn(err); });

/* ---------- map ---------- */
function initMap() {
  map = MV.create($('#map'), $('#overlay'), {
    onCity: id => onCityClick(id),
    onMapClick: () => { closeSugg(); if (isPhone() && ST.sheet === 'full') snap('half'); },
    onDraw: () => { updateScale(); zoneNote(); },
    highlightCities: () => ST.view === 'plan' ? planCitySet() : new Set()
  });
  const pinSvg = '<svg viewBox="0 0 28 42" aria-hidden="true"><path d="M14 1C6.8 1 1 6.7 1 13.9c0 9.7 13 27.1 13 27.1s13-17.4 13-27.1C27 6.7 21.2 1 14 1z" fill="#63ea35" stroke="#46b312" stroke-width="1.2"/></svg>';
  P.projects.forEach((pr, i) => {
    const pl = M.places[pr.slug], [lon, lat] = PLACE_LL[pr.slug];
    const el = document.createElement('button');
    el.className = 'pin drop'; el.style.animationDelay = (i * 60) + 'ms';
    el.setAttribute('aria-label', `${pl.short}, ${pl.category}, ${MV.cityById[pl.city].name}. Open place`);
    el.innerHTML = `<span class="pin-b" style="animation-delay:${300 + i * 70}ms">${pinSvg}${ms(pl.icon, 'pin-ic')}</span><span class="pin-lab">${esc(pl.short)}</span><span class="pin-n"></span>`;
    const m = map.addMarker({ kind: 'pin', lon, lat, el, slug: pr.slug, need: pl.need, short: pl.short, group: pl.city === 'delhi' || pl.city === 'ravenmoor' ? 'Ferrywick and Ravenmoor' : MV.cityById[pl.city].name });
    el.addEventListener('click', e => {
      e.stopPropagation();
      if (m.cluster && m.cluster.length > 1) { map.flyToLL(m.cluster.map(c => [c.lon, c.lat]), Object.assign(padFor(), { l: padFor().l + 80, r: 80, t: padFor().t + 60, b: padFor().b + 60 })); return; }
      go('#/p/' + pr.slug);
    });
    el.addEventListener('mouseenter', () => { const li = $(`.li[data-slug="${pr.slug}"]`); li && li.classList.add('hl'); });
    el.addEventListener('mouseleave', () => $$('.li.hl').forEach(x => x.classList.remove('hl')));
  });
  // where he is now
  const home = MV.kmToLL(MV.cityById.ravenmoor, 6.0, 3.9), me = document.createElement('button');
  me.className = 'me'; me.setAttribute('aria-label', 'Dev is here now: Ravenmoor Institute of Management, Ravenmoor'); me.innerHTML = '<i></i><span class="me-lab">Dev is here · Ravenmoor</span>';
  me.addEventListener('click', () => openContact());
  map.addMarker({ kind: 'me', lon: home[0], lat: home[1], el: me });
  // destination pin for the launch planner
  const dest = document.createElement('div'); dest.className = 'pin dest-pin'; dest.hidden = true;
  dest.innerHTML = `<span class="pin-b"><svg viewBox="0 0 28 42" aria-hidden="true"><path d="M14 1C6.8 1 1 6.7 1 13.9c0 9.7 13 27.1 13 27.1s13-17.4 13-27.1C27 6.7 21.2 1 14 1z" fill="#63ea35" stroke="#46b312" stroke-width="1.2"/><circle cx="14" cy="14" r="5" fill="#46b312"/></svg></span><span class="pin-lab"></span>`;
  ST.destMarker = map.addMarker({ kind: 'dest', lon: 0, lat: 0, el: dest });
  map.setPad(padFor());
  addEventListener('resize', () => { map.setPad(padFor()); if (isPhone()) snap(ST.sheet, true); });
}
function padFor() {
  if (isPhone()) return { l: 24, r: 24, t: 120, b: 92 + visibleSheet() + 16 };
  const side = document.body.classList.contains('collapsed') ? 0 : 408;
  return { l: side + 48, r: 64, t: 72, b: 56 };
}
function zoneNote() {
  const el = $('#zone-note'); if (!el || !map) return;
  let txt = '';
  if (map.layers.zones && map.V.s > 900) {
    const inView = id => { const c = MV.cityById[id], [x, y] = map.project(c.lon, c.lat); return x > -200 && x < map.V.W + 200 && y > -200 && y < map.V.H + 200; };
    if (inView('indore')) txt = '<i style="background:rgba(232,26,184,.25);border-color:#e81ab8"></i>4 districts he picked<i style="border-style:dashed"></i>10 more he mapped (positions illustrative)';
    else if (inView('ravenmoor')) txt = '<i style="background:rgba(86,217,37,.2);border-color:#56d925"></i>2 zones losing money<i style="background:rgba(232,26,184,.12);border-color:#e81ab8"></i>5 zones in profit (shape only)';
  }
  if (el.dataset.t !== txt) { el.dataset.t = txt; el.innerHTML = txt; el.hidden = !txt; }
}
function updateScale() {
  const kpp = map.kmPerPx(), nice = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
  let km = nice[0]; for (const n of nice) if (n / kpp <= 90) km = n;
  $('#scale-bar').style.width = Math.round(km / kpp) + 'px'; $('#scale-t').textContent = km + ' km';
}
function onCityClick(id) {
  const c = MV.cityById[id]; if (!c) return;
  const stops = M.plan.steps.map(s => s.city);
  if (ST.view === 'plan') {
    if (stops.includes(id)) { const i = stops.indexOf(id); selectStep(i); return; }
    go('#/plan/' + id); return;
  }
  const here = Object.entries(M.places).filter(([, p]) => p.city === id);
  if (here.length) { map.flyToLL(here.map(([s]) => PLACE_LL[s]).concat([[c.lon, c.lat]]), { l: padFor().l + 60, r: 120, t: padFor().t + 60, b: padFor().b + 60 }); toast(`${c.name}: ${here.length} of his projects`, 'Plan a launch here', () => go('#/plan/' + id)); return; }
  const P2 = padFor(), sc = 900; map.flyTo({ cx: c.lon - (P2.l - P2.r) / 2 / sc, cy: MV.merc(c.lat) - (P2.b - P2.t) / 2 / sc, s: sc });
  toast(`${c.name}, ${c.state}`, 'Plan a launch here', () => go('#/plan/' + id));
}

/* ---------- chrome: chips, search, controls, menu ---------- */
function initChrome() {
  const chips = [`<button class="chip hero-chip" id="chip-plan" data-go="#/plan">${ms('directions', 'fill')}Plan a city launch</button>`, `<button class="chip" id="chip-tl" data-go="#/timeline">${ms('history')}Timeline</button>`]
    .concat(M.needs.map(n => `<button class="chip" data-need="${n.id}" aria-pressed="false">${ms(n.icon)}${esc(n.label)}</button>`))
    .concat([`<button class="chip" data-go="#/reviews">${ms('rate_review')}Reviews</button>`, `<button class="chip" data-go="#/about">${ms('work')}Experience</button>`]);
  $('#chips').innerHTML = chips.join('');
  $('#chips').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    if (b.dataset.go) return go(b.dataset.go);
    setFilter(ST.filter === b.dataset.need ? null : b.dataset.need, true);
  });
  $('#zin').onclick = () => map.zoomAnimated(2); $('#zout').onclick = () => map.zoomAnimated(0.5);
  $('#me-btn').onclick = () => { const h = MV.kmToLL(MV.cityById.ravenmoor, 6.0, 3.9); map.flyTo({ cx: h[0] - (padFor().l - padFor().r) / 2 / 4200, cy: MV.merc(h[1]) - (padFor().b - padFor().t) / 2 / 4200, s: 4200 }); const me = $('.me'); me.classList.add('show'); setTimeout(() => me.classList.remove('show'), 3500); };
  $('#collapse').onclick = () => { document.body.classList.toggle('collapsed'); const c = document.body.classList.contains('collapsed'); $('#collapse').setAttribute('aria-label', c ? 'Expand side panel' : 'Collapse side panel'); map.setPad(padFor()); setTimeout(() => map.invalidate(), 260); };
  ['#tr-avatar', '#sb-avatar', '#bn-contact'].forEach(s => $(s).onclick = () => openContact());
  $('#sb-dir').onclick = () => go('#/plan'); $('#fab-dir').onclick = () => go('#/plan');
  $('#sb-x').onclick = () => go('#/'); $('#sb-back').onclick = () => back();
  $('#menu-btn').onclick = openDrawer; $('#sb-logo').onclick = openDrawer;
  $('#layers-btn').onclick = toggleLayers;
  $('#scrim').onclick = closeOverlays;
  initSearch();
  document.addEventListener('keydown', onKey);
  document.addEventListener('click', e => { const a = e.target.closest('[data-go]'); if (a && !a.classList.contains('chip')) { e.preventDefault(); go(a.dataset.go); } });
}
function setFilter(need, fromChip) {
  ST.filter = need; map.setFilter(need);
  $$('#chips [data-need]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.need === need)));
  if (fromChip) {
    if (ST.view !== 'home' || ST.tab !== 'saved') go('#/saved'); else renderHome('saved');
    const lls = P.projects.filter(p => !need || M.places[p.slug].need === need).map(p => PLACE_LL[p.slug]);
    map.flyToLL(lls, { t: padFor().t + 60, b: padFor().b + 40, l: padFor().l + 40, r: 120 });
  }
}
function go(h) { if (location.hash === h) route(); else location.hash = h; }
function back() { if (ST.view === 'place' || ST.view === 'plan' || ST.view === 'timeline') { if (history.length > 1 && ST.prevHash !== undefined) history.back(); else go('#/'); } else go('#/'); }

/* search with suggestions */
function searchIndex() {
  const out = [];
  P.projects.forEach(p => { const pl = M.places[p.slug]; out.push({ t: pl.short, s: `${p.title} · ${MV.cityById[pl.city].name}`, ic: pl.icon, pin: true, go: '#/p/' + p.slug, k: [p.title, p.org, p.summary, pl.city, pl.category, ...(p.tags || []), ...(p.tools || []), JSON.stringify(P.project_pages[p.slug] || {})].join(' ') }); });
  M.plan.steps.forEach((st, i) => out.push({ t: st.title, s: `Step ${i + 1} of his launch method · ${M.places[st.place].short}`, ic: st.icon, go: '#/p/' + st.place, k: st.title + ' ' + st.do + ' ' + st.proof.join(' ') }));
  const cityIds = [...new Set(Object.values(M.places).map(p => p.city))];
  cityIds.forEach(id => out.push({ t: MV.cityById[id].name, s: 'Where his work happened', ic: 'location_city', go: null, city: id, k: id }));
  M.plan.cities.forEach(id => out.push({ t: 'Plan a launch in ' + MV.cityById[id].name, s: 'Directions with his method', ic: 'directions', go: '#/plan/' + id, k: MV.cityById[id].name + ' launch plan city' }));
  Object.entries(P.skills).forEach(([g, list]) => list.forEach(sk => out.push({ t: sk, s: g + ' · About', ic: 'check_circle', go: '#/about', k: sk + ' skill' })));
  P.testimonials.forEach(t => out.push({ t: t.name, s: t.role, ic: 'rate_review', go: '#/reviews', k: t.name + ' ' + t.role + ' review' }));
  P.experience.forEach(e => out.push({ t: e.org + ', ' + e.role, s: e.dates, ic: 'work', go: '#/about', k: e.org + ' ' + e.role + ' experience' }));
  [['Timeline', 'His career as a journey', 'history', '#/timeline'], ['Plan a city launch', 'His go-to-market method as a route', 'directions', '#/plan'], ['Reviews', '3 people on working with him', 'rate_review', '#/reviews'], ['Résumé view', 'Plain page, no map', 'description', 'read.html']]
    .forEach(([t, s, ic, g]) => out.push({ t, s, ic, go: g, k: t + ' ' + s }));
  return out;
}
let SIDX = null, sSel = -1, sItems = [];
function initSearch() {
  const q = $('#q');
  q.addEventListener('focus', () => showSugg(q.value));
  q.addEventListener('input', () => showSugg(q.value));
  q.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sSel = Math.max(0, Math.min(sItems.length - 1, sSel + (e.key === 'ArrowDown' ? 1 : -1))); $$('#sugg button').forEach((b, i) => b.classList.toggle('on', i === sSel)); }
    else if (e.key === 'Enter') { e.preventDefault(); pickSugg(sItems[sSel >= 0 ? sSel : 0]); }
    else if (e.key === 'Escape') { closeSugg(); q.blur(); }
  });
  $('#sb-search').onclick = () => { if (sItems.length && !$('#sugg').hidden) pickSugg(sItems[0]); else q.focus(); };
  document.addEventListener('pointerdown', e => { if (!e.target.closest('#searchbox')) closeSugg(); });
}
function showSugg(v) {
  SIDX = SIDX || searchIndex(); const s = v.trim().toLowerCase(), box = $('#sugg');
  if (ST.view !== 'home' && v === $('#q').dataset.title) v = '';
  let items;
  if (!s || v === '') items = SIDX.filter(x => x.pin).concat(SIDX.filter(x => x.t === 'Plan a city launch' || x.t === 'Timeline'));
  else items = SIDX.map(x => { const t = x.t.toLowerCase(), k = x.k.toLowerCase(); const sc = t.startsWith(s) ? 3 : t.includes(s) ? 2 : k.includes(s) ? 1 : 0; return [sc, x]; }).filter(a => a[0]).sort((a, b) => b[0] - a[0]).slice(0, 8).map(a => a[1]);
  sItems = items; sSel = -1;
  const hl = t => { if (!s) return esc(t); const i = t.toLowerCase().indexOf(s); return i < 0 ? esc(t) : esc(t.slice(0, i)) + '<b>' + esc(t.slice(i, i + s.length)) + '</b>' + esc(t.slice(i + s.length)); };
  box.innerHTML = (s ? '' : '<div class="sg-h">Dev\'s saved places</div>') + (items.length ? items.map((x, i) => `<button role="option" data-i="${i}"><span class="sg-ic ${x.pin ? 'pin' : ''}">${ms(x.ic)}</span><span class="sg-t">${hl(x.t)}<br><span class="sg-s">${esc(x.s)}</span></span></button>`).join('') : `<div class="sg-none">No places match "${esc(v)}". Try Indore, OKRs or P&amp;L.</div>`);
  box.hidden = false; $('#q').setAttribute('aria-expanded', 'true');
  $$('button', box).forEach(b => b.onclick = () => pickSugg(items[+b.dataset.i]));
}
function closeSugg() { $('#sugg').hidden = true; $('#q').setAttribute('aria-expanded', 'false'); }
function pickSugg(x) {
  if (!x) return; closeSugg(); $('#q').blur();
  if (x.city) { onCityClick(x.city); return; }
  if (x.go.endsWith('.html')) { location.href = x.go; return; }
  go(x.go);
}

/* keyboard */
function onKey(e) {
  const tag = (e.target.tagName || '').toLowerCase(), typing = tag === 'input' || tag === 'textarea' || tag === 'select';
  if (e.key === 'Escape') { if (!$('#lightbox').hidden) return closeLightbox(); if (!$('#dialog').hidden || !$('#drawer').hidden || !$('#layers-pop').hidden) return closeOverlays(); if (!$('#coach').hidden) return endTour(); if (!typing && ST.view !== 'home') return go('#/'); }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (!$('#lightbox').hidden) { if (e.key === 'ArrowRight') lbStep(1); if (e.key === 'ArrowLeft') lbStep(-1); return; }
  const k = e.key;
  if (k === '/') { e.preventDefault(); $('#q').focus(); }
  else if (k === '+' || k === '=') map.zoomAnimated(2);
  else if (k === '-' || k === '_') map.zoomAnimated(0.5);
  else if (k === 'ArrowLeft' && e.target === document.body) map.panBy(120, 0);
  else if (k === 'ArrowRight' && e.target === document.body) map.panBy(-120, 0);
  else if (k === 'ArrowUp' && e.target === document.body) map.panBy(0, 120);
  else if (k === 'ArrowDown' && e.target === document.body) map.panBy(0, -120);
  else if (k === 'p') go('#/plan'); else if (k === 't') go('#/timeline'); else if (k === 's') go('#/saved'); else if (k === 'h') go('#/');
  else if (k === '?') openShortcuts();
}

/* ---------- router ---------- */
function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  closeSugg(); closeOverlays(true);
  const prevView = ST.view;
  if (parts[0] === 'p' && PROJ[parts[1]]) renderPlace(parts[1], parts[2] || 'overview');
  else if (parts[0] === 'plan') renderPlan(parts[1]);
  else if (parts[0] === 'timeline') renderTimeline(parts[1]);
  else renderHome(['saved', 'reviews', 'about'].includes(parts[0]) ? parts[0] : 'overview');
  ST.prevHash = prevView ? true : undefined;
  document.body.classList.toggle('inner', ST.view !== 'home');
  $('#sb-x').hidden = ST.view === 'home'; $('#sb-back').hidden = ST.view === 'home' || !isPhone();
  $$('.rail-item').forEach(a => a.classList.toggle('on', (a.dataset.nav === 'saved' && ST.view === 'home' && ST.tab === 'saved') || a.dataset.nav === ST.view));
  $$('.bnav [data-tab]').forEach(a => a.classList.toggle('on', (a.dataset.tab === 'home' && ST.view === 'home' && ST.tab !== 'saved') || (a.dataset.tab === 'saved' && ST.view === 'home' && ST.tab === 'saved') || a.dataset.tab === ST.view));
  if (ST.view !== 'plan') { map.setRoute(null); ST.destMarker.el.hidden = true; }
  if (ST.view !== 'timeline' && !map.layers.timeline) map.setTimeline(null);
  $$('.pin').forEach(p => p.classList.remove('sel'));
}
function setSearchTitle(t) { const q = $('#q'); q.value = t || ''; q.dataset.title = t || ''; }
function setPanel(html, opts = {}) {
  const pn = $('#panel'); pn.innerHTML = html; if (!opts.keepScroll) pn.scrollTop = 0;
  $$('img', pn).forEach(img => img.addEventListener('error', () => { img.style.visibility = 'hidden'; }, { once: true }));
  if (isPhone()) snap(opts.sheet || ST.sheet, true);
}

/* ---------- home: the place card for Dev ---------- */
function headerHome() {
  const p = P.person;
  return `
  <div class="hero grid"><img src="media/photos/professional-arms.jpg" alt="Dev Oberoi, arms folded" style="object-position:50% 22%"><img src="media/photos/candid-launch-market.jpg" alt="Launch week on Mill Street, Thistledown"><img src="media/photos/candid-founder-whiteboard.jpg" alt="Planning OKRs at Tallowfield Freight">
    <button class="see" data-lb="gallery">${ms('photo_library')}See photos</button></div>
  <div class="ph" id="ph-home">
    <h1>${esc(p.first_name)} ${esc(p.last_name)}</h1>
    <div class="sub-h">${esc(p.headline)}</div>
    <div class="rating"><b>4 yrs</b><span>at Pinewick</span><span class="dot">·</span><b>${P.projects.length}</b><span>projects</span><span class="dot">·</span><a href="#/reviews">(${P.testimonials.length} reviews)</a></div>
    <div class="cat">Chief of staff · Founder's office · Operations & strategy</div>
    <div class="status"><span class="open">Open to roles</span> · From ${esc(p.available_from)}</div>
  </div>`;
}
function tabsHtml(list, cur, base) { return `<div class="ptabs" role="tablist">${list.map(([id, label]) => `<button role="tab" aria-selected="${id === cur}" data-go="${base}${id === 'overview' ? '' : (base.endsWith('/') ? '' : '/') + id}">${esc(label)}</button>`).join('')}</div>`; }
function renderHome(tab) {
  const first = ST.view !== 'home';
  ST.view = 'home'; ST.tab = tab; setSearchTitle('');
  const acts = `<div class="actions">
    <button class="act pri" data-go="#/plan"><span class="c">${ms('directions', 'fill')}</span>Plan launch</button>
    <button class="act" id="act-contact"><span class="c">${ms('send')}</span>Contact</button>
    <button class="act ${ST.saveMe ? 'on' : ''}" id="act-save" aria-pressed="${ST.saveMe}"><span class="c">${ms('bookmark')}</span>${ST.saveMe ? 'Saved' : 'Save'}</button>
    <button class="act" id="act-share"><span class="c">${ms('share')}</span>Share</button>
    <a class="act" href="read.html"><span class="c">${ms('description')}</span>Résumé</a></div>`;
  let body = '';
  if (tab === 'overview') body = homeOverview(); else if (tab === 'saved') body = homeSaved(); else if (tab === 'reviews') body = homeReviews(); else body = homeAbout();
  const html = headerHome() + tabsHtml([['overview', 'Overview'], ['saved', 'Saved places'], ['reviews', 'Reviews'], ['about', 'About']], tab, '#/') + acts + `<div class="pbody">${body}</div>`;
  setPanel(html, { keepScroll: !first, sheet: first ? 'peek' : ST.sheet });
  { const t = $('.ptabs'), pn = $('#panel'); if (first && tab !== 'overview' && !isPhone()) pn.scrollTop = t.offsetTop; else if (!first && pn.scrollTop > t.offsetTop) pn.scrollTop = t.offsetTop; }
  bindHome();
  document.title = 'Dev Oberoi - Atlas Desk';
  if (first || ST.key !== 'home') { ST.key = 'home'; fitAll(); }
}
function fitAll(dur) { const lls = Object.values(PLACE_LL); map.setPad(padFor()); map.flyToLL(lls, { t: padFor().t + 40, b: padFor().b + 30, l: padFor().l + 20, r: 110 }, dur); }
function bindHome() {
  const c = $('#act-contact'); c && (c.onclick = () => openContact());
  const sh = $('#act-share'); sh && (sh.onclick = () => openShare());
  const sv = $('#act-save'); sv && (sv.onclick = () => { ST.saveMe = !ST.saveMe; store.set('saveMe', ST.saveMe); sv.classList.toggle('on', ST.saveMe); sv.setAttribute('aria-pressed', ST.saveMe); sv.lastChild.textContent = ST.saveMe ? 'Saved' : 'Save'; toast(ST.saveMe ? 'Saved Dev Oberoi to Starred places' : 'Removed from Starred places', 'Undo', () => sv.click()); });
  bindCommon();
}
function bindCommon() {
  $$('#panel [data-lb]').forEach(b => b.onclick = () => openLightbox(b.dataset.lb, +(b.dataset.i || 0)));
  $$('#panel .li[data-slug]').forEach(li => { li.onmouseenter = () => pinHl(li.dataset.slug, true); li.onmouseleave = () => pinHl(li.dataset.slug, false); });
  $$('#panel [data-copy]').forEach(b => b.onclick = e => { e.preventDefault(); e.stopPropagation(); copy(b.dataset.copy, 'Copied to clipboard'); });
  $$('#panel [data-need-f]').forEach(b => b.onclick = () => setFilter(b.dataset.needF || null, false) || renderHome('saved'));
  $$('#panel [data-like]').forEach(b => b.onclick = () => { const n = b.dataset.like, on = !ST.liked.includes(n); ST.liked = on ? ST.liked.concat(n) : ST.liked.filter(x => x !== n); store.set('liked', ST.liked); b.setAttribute('aria-pressed', on); b.querySelector('.ms').classList.toggle('fill', on); });
  const sort = $('#sort'); sort && (sort.onchange = () => { ST.sort = sort.value; renderHome('saved'); });
  $$('#panel .pt-sel').forEach(sel => sel.onchange = () => { const box = sel.closest('.sec'); box.querySelector('.pt-wrap').innerHTML = popularChart(M.places[sel.dataset.slug].popular[+sel.value]); });
  $$('#panel [data-rvf]').forEach(b => b.onclick = () => { ST.rvf = ST.rvf === b.dataset.rvf ? null : b.dataset.rvf; renderHome('reviews'); });
}
function pinHl(slug, on) { const m = map.markers.find(m => m.slug === slug); m && m.el.classList.toggle('hl', on); }
function rowsHome() {
  const p = P.person, c = P.contact;
  return `<div class="rows">
    <div class="row">${ms('location_on')}<span class="rt">${esc(p.location)}</span><button class="copy" data-copy="${esc(p.location)}" aria-label="Copy location">${ms('content_copy')}</button></div>
    <div class="row">${ms('schedule')}<span class="rt"><span style="color:var(--green);font-weight:500">Open to roles</span> from ${esc(p.available_from)}</span><span></span></div>
    <div class="row">${ms('work')}<span class="rt">${esc(p.looking_for)}<span class="rs">Looking for</span></span><span></span></div>
    <div class="row">${ms('school')}<span class="rt">${esc(p.current)}<span class="rs">Now</span></span><span></span></div>
    <button class="row" id="row-mail">${ms('mail')}<span class="rt">${esc(c.email)}<span class="rs">Email</span></span><span class="copy" data-copy="${esc(c.email)}" role="button" aria-label="Copy email">${ms('content_copy')}</span></button>
    <a class="row" href="${esc(c.linkedin)}" target="_blank" rel="noopener">${ms('public')}<span class="rt">LinkedIn profile</span>${ms('open_in_new', 'copy')}</a>
    <a class="row" href="${esc(c.substack)}" target="_blank" rel="noopener">${ms('edit_note')}<span class="rt">The Back Office Bulletin<span class="rs">His fortnightly newsletter</span></span>${ms('open_in_new', 'copy')}</a>
    <a class="row" href="media/resume.pdf" download>${ms('description')}<span class="rt">Résumé (PDF)</span>${ms('download', 'copy')}</a>
  </div>`;
}
const HL = [['thistledown-launch', 0], ['threadly-operating-cadence', 0], ['second-sem', 0], ['activation-tracker', 1], ['market-khata', 1], ['cloud-kitchen-pnl', 2], ['monday-review', 1]];
function homeOverview() {
  const g = P.media.gallery.filter(x => !x.src.endsWith('.png'));
  const t = P.testimonials[0];
  return `<div class="sec"><div class="owner"><img src="media/photos/avatar.jpg" alt="">From Dev</div><p class="lead">${esc(P.pitch.short)}</p></div>
  ${rowsHome()}
  <div class="sec"><h2>Highlights</h2><div class="hscroll" data-qa-scroll>${HL.map(([s, i]) => { const pr = PROJ[s], m = pr.metrics[i], pl = M.places[s]; return `<button class="hcard" data-go="#/p/${s}"><img src="${media(pr.thumbnail)}" alt="" loading="lazy"><span class="hc-b"><span class="hc-n">${esc(m[0])}</span><span class="hc-t">${esc(m[1])}</span><span class="hc-s">${esc(pl.short)} · ${esc(MV.cityById[pl.city].name)}</span></span></button>`; }).join('')}</div></div>
  <div class="sec"><h2>${ms('directions', 'fill')}Plan a city launch</h2><p>How he opens a new town, drawn as a route across India: scout the districts, choose where to start, price each channel, then run launch week. Every stop is a project from his story.</p><button class="btn btn-pri" data-go="#/plan">${ms('directions')}Get directions</button></div>
  <div class="sec"><h2>Why hire Dev</h2><div class="attr"><ul>${P.pitch.why_hire.map(w => `<li>${ms('check')}<span>${esc(w)}</span></li>`).join('')}</ul></div></div>
  <div class="sec"><h2><span class="grow">Photos</span><button class="link-btn" data-lb="gallery">See all</button></h2><div class="pstrip" data-qa-scroll>${g.slice(0, 8).map((x, i) => `<button data-lb="gallery" data-i="${i}" aria-label="${esc(x.caption)}"><img src="media/${esc(x.src)}" alt="${esc(x.caption)}" loading="lazy"></button>`).join('')}</div></div>
  <div class="sec"><h2><span class="grow">Reviews</span><button class="link-btn" data-go="#/reviews">More reviews (${P.testimonials.length})</button></h2>${reviewCard(t, true)}</div>
  <div class="sec" style="border-bottom:0"><h2><span class="grow">Saved places</span><button class="link-btn" data-go="#/saved">See all ${P.projects.length}</button></h2></div>
  ${P.projects.slice(0, 3).map(listItem).join('')}`;
}
function listItem(pr) {
  const pl = M.places[pr.slug], city = MV.cityById[pl.city];
  return `<button class="li" data-slug="${pr.slug}" data-go="#/p/${pr.slug}"><span><span class="li-t"><span class="li-ic">${ms(pl.icon)}</span>${esc(pl.short)}</span>
    <div class="li-r"><b>${esc(pr.metrics[0][0])}</b> ${esc(pr.metrics[0][1])} · <b>${esc(pr.metrics[1][0])}</b> ${esc(pr.metrics[1][1])}</div>
    <div class="li-c">${esc(pl.category)} · ${esc(pr.year)} · ${esc(city.name)}</div>
    <div class="li-res">${esc(pr.result)}</div>
    <span class="li-pill">${ms('menu_book')}Case study</span></span><img src="${media(pr.thumbnail)}" alt="" loading="lazy"></button>`;
}
function homeSaved() {
  let list = P.projects.filter(p => !ST.filter || M.places[p.slug].need === ST.filter);
  if (ST.sort === 'city') list = list.slice().sort((a, b) => M.places[a.slug].city.localeCompare(M.places[b.slug].city));
  if (ST.sort === 'old') list = list.slice().reverse();
  return `<div class="lhead"><h2>Dev's projects</h2><select id="sort" aria-label="Sort"><option value="recent" ${!ST.sort || ST.sort === 'recent' ? 'selected' : ''}>Most recent</option><option value="old" ${ST.sort === 'old' ? 'selected' : ''}>Oldest</option><option value="city" ${ST.sort === 'city' ? 'selected' : ''}>By city</option></select></div>
  <div class="lsub">${ms('lock', '')} Saved list · ${list.length} of ${P.projects.length} places · tap one for the full case study</div>
  <div class="fchips" data-qa-scroll><button class="fchip" data-need-f="" aria-pressed="${!ST.filter}">All</button>${M.needs.map(n => `<button class="fchip" data-need-f="${n.id}" aria-pressed="${ST.filter === n.id}">${ms(n.icon)}${esc(n.label)}</button>`).join('')}</div>
  ${list.map(listItem).join('')}`;
}
const AV_COL = ['#e81ab8', '#181b80', '#00e328', '#ce4f30', '#56d925'];
function reviewCard(t, short) {
  const slug = M.reviews[t.name], pl = slug && M.places[slug], i = P.testimonials.indexOf(t), on = ST.liked.includes(t.name);
  return `<div class="review${short ? '' : ''}" ${short ? 'style="padding:0;border:0"' : ''}><div class="who"><span class="av" style="background:${AV_COL[i % 5]}">${esc(t.name[0])}</span><span><div class="nm">${esc(t.name)}</div><div class="rl">${esc(t.role)} · ${esc(t.relation)}</div></span></div>
    ${pl ? `<a class="tag" href="#/p/${slug}">${ms('location_on', 'fill')}Reviewed: ${esc(pl.short)}</a>` : ''}
    <q>"${esc(t.quote)}"</q>${short ? '' : `<div class="rf"><button data-like="${esc(t.name)}" aria-pressed="${on}">${ms('thumb_up', on ? 'fill' : '')}Helpful</button>${slug ? `<button data-go="#/p/${slug}">${ms('location_on')}Open place</button>` : ''}</div>`}</div>`;
}
function homeReviews() {
  const list = P.testimonials.filter(t => !ST.rvf || M.reviews[t.name] === ST.rvf);
  return `<div class="rv-sum"><span class="big">${P.testimonials.length}</span><span>reviews from his regional manager and a friendly rival at Pinewick, and the chief of staff at Tallowfield Freight. These are quotes, not star scores.</span></div>
  <div class="fchips" data-qa-scroll><button class="fchip" data-rvf="" aria-pressed="${!ST.rvf}">All</button>${Object.entries(M.reviews).map(([n, s]) => `<button class="fchip" data-rvf="${s}" aria-pressed="${ST.rvf === s}">${esc(M.places[s].short)}</button>`).join('')}</div>
  ${list.map(t => reviewCard(t, false)).join('')}`;
}
function homeAbout() {
  const logo = l => l ? `<img src="media/${esc(l)}" alt="" loading="lazy">` : ms('work');
  return `<div class="sec"><h2>Experience</h2>${P.experience.map(e => `<div class="job"><span class="lg">${logo(e.logo)}</span><span><b>${esc(e.role)}</b><span class="jm">${esc(e.org)} · ${esc(e.place)} · ${esc(e.dates)}</span><ul>${e.points.map(x => `<li>${esc(x)}</li>`).join('')}</ul></span></div>`).join('')}
    <div class="job"><span class="lg">${ms('storefront')}</span><span><b>Co-founder</b><span class="jm">Bindwell · Fernhollow · Aug 2019 – Jun 2021</span><ul><li>2,400 jobs across three campuses; closed in June 2021 with a published post-mortem.</li></ul></span></div></div>
  <div class="sec"><h2>Education</h2>${P.education.map(e => `<div class="job"><span class="lg">${logo(e.logo)}</span><span><b>${esc(e.degree)}</b><span class="jm">${esc(e.school)} · ${esc(e.years)}</span><ul><li>${esc(e.notes)}</li></ul></span></div>`).join('')}</div>
  <div class="sec attr"><h2>Skills</h2>${Object.entries(P.skills).map(([g, l]) => `<h3>${esc(g)}</h3><ul>${l.map(x => `<li>${ms('check')}<span>${esc(x)}</span></li>`).join('')}</ul>`).join('')}</div>
  <div class="sec"><h2>Tools</h2><div class="tools">${P.tools.map(t => `<span class="tool"><img src="media/${esc(t.logo)}" alt="" loading="lazy">${esc(t.name)}</span>`).join('')}</div></div>
  <div class="sec attr"><h2>Awards and certifications</h2><ul>${P.wins.map(w => `<li>${ms('emoji_events')}<span><b style="font-weight:500;color:var(--ink)">${esc(w.title)}</b>. ${esc(w.detail)}</span></li>`).join('')}${P.certifications.map(c => `<li>${ms('verified')}<span>${esc(c.name)}, ${esc(c.issuer)}, ${esc(c.year)}</span></li>`).join('')}</ul></div>
  <div class="sec attr"><h2>How he works</h2><ul>${P.values.map(v => `<li>${ms('check')}<span>${esc(v)}</span></li>`).join('')}</ul></div>
  <div class="sec"><h2>Outside work</h2>${P.outside.map(o => `<div class="job"><span class="lg" style="width:56px;height:56px"><img src="media/${esc(o.image)}" alt="" style="width:56px;height:56px;object-fit:cover"></span><span><b>${esc(o.title)}</b><span class="jm" style="display:block;line-height:19px">${esc(o.detail)}</span></span></div>`).join('')}</div>
  <div class="sec"><p style="font-size:13px">${esc(P.about.intro)}</p><a class="btn btn-out" href="read.html">${ms('description')}Read the résumé view</a></div>`;
}

/* ---------- place page for a project ---------- */
function renderPlace(slug, tab) {
  const pr = PROJ[slug], pg = P.project_pages[slug] || {}, pl = M.places[slug], city = MV.cityById[pl.city];
  const firstHere = ST.key !== 'p:' + slug; ST.view = 'place'; ST.slug = slug; ST.key = 'p:' + slug; setSearchTitle(pl.short);
  const imgs = (pg.images || [pr.thumbnail]);
  const hero = imgs.length >= 3 ? `<div class="hero grid">${imgs.slice(0, 3).map((s, i) => `<img src="${media(s)}" alt="">`).join('')}<button class="see" data-lb="p:${slug}">${ms('photo_library')}${imgs.length} photos</button></div>`
    : `<div class="hero"><img src="${media(imgs[0])}" alt=""><button class="see" data-lb="p:${slug}">${ms('photo_library')}${imgs.length === 1 ? 'See photo' : imgs.length + ' photos'}</button></div>`;
  const status = pl.closed ? `<span class="closed">${esc(pl.closed.split(' · ')[0])}</span> · ${esc(pl.closed.split(' · ')[1] || '')}` : pl.open ? `<span class="open">${esc(pl.open.split(' · ')[0])}</span> · ${esc(pl.open.split(' · ')[1] || '')}` : `<span style="color:var(--ink-2);font-weight:500">Completed</span> · ${esc(pg.dates || pr.year)}`;
  const reviews = P.testimonials.filter(t => M.reviews[t.name] === slug);
  const step = M.plan.steps.findIndex(s => s.place === slug);
  const tabs = [['overview', 'Overview'], ['case', 'Case study']].concat(reviews.length ? [['reviews', 'Reviews']] : []).concat([['photos', 'Photos']]);
  const html = hero + `<div class="ph"><h1>${esc(pr.title)}</h1>
    <div class="rating">${pr.metrics.slice(0, 2).map(m => `<b>${esc(m[0])}</b><span>${esc(m[1])}</span>`).join('<span class="dot">·</span>')}${reviews.length ? `<span class="dot">·</span><a href="#/p/${slug}/reviews">(${reviews.length} review)</a>` : ''}</div>
    <div class="cat">${esc(pl.category)} · ${esc(pr.year)}</div><div class="status">${status}</div></div>`
    + tabsHtml(tabs, tab, '#/p/' + slug)
    + `<div class="actions">
      <button class="act pri" data-go="#/p/${slug}/case"><span class="c">${ms('menu_book', 'fill')}</span>Case study</button>
      ${step >= 0 ? `<button class="act" data-go="#/plan" data-step="${step}" id="act-route"><span class="c">${ms('directions')}</span>On the route</button>` : `<button class="act" id="act-near"><span class="c">${ms('near_me')}</span>Nearby</button>`}
      <button class="act ${ST.starred.includes(slug) ? 'on' : ''}" id="act-star" aria-pressed="${ST.starred.includes(slug)}"><span class="c">${ms('star')}</span>${ST.starred.includes(slug) ? 'Starred' : 'Star'}</button>
      <button class="act" id="act-share"><span class="c">${ms('share')}</span>Share</button>
      <button class="act" id="act-contact"><span class="c">${ms('send')}</span>Contact</button></div>`
    + `<div class="pbody">${tab === 'case' ? caseStudy(slug) : tab === 'reviews' ? reviews.map(t => reviewCard(t, false)).join('') : tab === 'photos' ? photosTab(slug) : placeOverview(slug)}</div>`;
  setPanel(html, { keepScroll: !firstHere, sheet: firstHere ? 'half' : ST.sheet });
  if (!firstHere) { const t = $('.ptabs'), pn = $('#panel'); if (pn.scrollTop > t.offsetTop) pn.scrollTop = t.offsetTop; }
  // bind
  $('#act-share').onclick = () => openShare(slug); $('#act-contact').onclick = () => openContact();
  const r = $('#act-route'); r && (r.onclick = e => { e.stopPropagation(); ST.step = step; go('#/plan'); });
  const nb = $('#act-near'); nb && (nb.onclick = () => { const lls = Object.entries(M.places).filter(([, p]) => p.city === pl.city).map(([s]) => PLACE_LL[s]).concat([[city.lon, city.lat]]); map.flyToLL(lls, { l: padFor().l + 60, r: 120, t: padFor().t + 80, b: padFor().b + 60 }); toast(`Showing ${city.name}`); });
  $('#act-star').onclick = () => { const on = !ST.starred.includes(slug); ST.starred = on ? ST.starred.concat(slug) : ST.starred.filter(x => x !== slug); store.set('starred', ST.starred); renderPlace(slug, tab); toast(on ? `Starred ${pl.short}` : `Removed star from ${pl.short}`, 'Undo', () => $('#act-star').click()); };
  bindCommon();
  document.title = `${pl.short} - Atlas Desk`;
  const m = map.markers.find(m => m.slug === slug); m && m.el.classList.add('sel');
  if (firstHere) { const [lon, lat] = PLACE_LL[slug], P2 = padFor(), s = isPhone() ? 1500 : 3600; map.setPad(P2); map.flyTo({ cx: lon - (P2.l - P2.r) / 2 / s, cy: MV.merc(lat) - (P2.b - P2.t) / 2 / s, s }); }
}
function placeOverview(slug) {
  const pr = PROJ[slug], pg = P.project_pages[slug] || {}, pl = M.places[slug];
  const reviews = P.testimonials.filter(t => M.reviews[t.name] === slug);
  const toolNames = (pr.tools || []).map(t => (P.tools.find(x => x.logo.includes(t)) || { name: t }).name);
  const similar = P.projects.filter(p => p.slug !== slug && (M.places[p.slug].need === pl.need || M.places[p.slug].city === pl.city));
  return `<div class="sec"><p class="lead">${esc(pr.summary)}</p><p style="color:var(--green);font-weight:500;margin:0">${esc(pr.result)}</p></div>
  <div class="rows">
    <div class="row">${ms('location_on')}<span class="rt">${esc(pl.address)}</span><span></span></div>
    <div class="row">${ms('schedule')}<span class="rt">${esc(pg.dates || pr.year)}<span class="rs">${esc(pr.duration)}</span></span><span></span></div>
    <div class="row">${ms('person')}<span class="rt">${esc(pg.my_role || pr.role)}<span class="rs">His role</span></span><span></span></div>
    <div class="row">${ms('groups')}<span class="rt">${esc(pr.team)}<span class="rs">Team</span></span><span></span></div>
    <div class="row">${ms('build')}<span class="rt">${esc(toolNames.join(', '))}<span class="rs">Tools</span></span><span></span></div>
  </div>
  ${pl.popular && pl.popular.length ? `<div class="sec"><div class="pt-head"><h2>Popular times</h2>${pl.popular.length > 1 ? `<select class="pt-sel" data-slug="${slug}" aria-label="Choose a measure">${pl.popular.map((p, i) => `<option value="${i}">${esc(p.label)}</option>`).join('')}</select>` : ''}</div><div class="pt-wrap">${popularChart(pl.popular[0])}</div></div>` : ''}
  <div class="sec"><h2>Read the case study</h2><p>The setting, the problem, his actions, key decisions, outcomes and lessons.</p><button class="btn btn-pri" data-go="#/p/${slug}/case">${ms('menu_book')}Open case study</button></div>
  ${reviews.length ? `<div class="sec"><h2>Review</h2>${reviews.map(t => reviewCard(t, true)).join('')}</div>` : ''}
  <div class="sec" style="border:0"><h2>People also search for</h2><div class="hscroll" data-qa-scroll>${similar.map(p => { const q = M.places[p.slug]; return `<button class="hcard" style="flex-basis:180px" data-go="#/p/${p.slug}"><img src="${media(p.thumbnail)}" alt="" loading="lazy" style="height:96px"><span class="hc-b"><span class="hc-t" style="font-weight:500;color:var(--ink)">${esc(q.short)}</span><span class="hc-s">${esc(p.metrics[0][0])} ${esc(p.metrics[0][1])}</span></span></button>`; }).join('')}</div></div>`;
}
function fmtVal(pt, v) {
  if (pt.prefix) return (v < 0 ? '−' : '+') + '₹' + Math.abs(v);
  if (pt.shape) return '';
  return (Number.isInteger(v) ? v.toLocaleString('en-IN') : v) + (pt.unit || '');
}
function popularChart(pt) {
  if (pt.issues) return `<div class="pt-live"><span class="lv"></span><b>Live:</b> issue ${pt.issues} is out</div><div class="pt-issues">${Array.from({ length: pt.issues }, () => '<i></i>').join('')}</div><div class="pt-labels"><span style="text-align:left">Aug 2025</span><span style="text-align:right">Now</span></div><p class="pt-cap">${esc(pt.caption)}</p>`;
  const live = pt.bars.find(b => b[2] === 'live'), neg = pt.bars.some(b => b[1] < 0);
  const head = live ? `<div class="pt-live"><span class="lv"></span><b>Live:</b> ${esc(live[0])}${pt.shape ? ' is below zero' : ', ' + esc(fmtVal(pt, live[1]))}</div>` : '';
  let chart;
  if (!neg) {
    const max = Math.max(...pt.bars.map(b => b[1]));
    chart = `<div class="pt-chart">${pt.bars.map(b => `<div class="pt-bar ${b[2] || ''}"><span class="v">${esc(fmtVal(pt, b[1]))}</span><i style="height:${Math.max(3, b[1] / max * 82)}%"></i></div>`).join('')}</div>`;
  } else {
    const pos = Math.max(0.01, ...pt.bars.map(b => b[1])), negm = Math.max(...pt.bars.map(b => -b[1])), zero = pos / (pos + negm) * 100;
    chart = `<div class="pt-neg"><span class="pt-zero" style="top:${zero}%"></span>${pt.bars.map(b => { const h = Math.abs(b[1]) / (pos + negm) * 100 * 0.86; const top = b[1] >= 0 ? zero - h : zero; return `<div class="pt-bar ${b[2] || ''}" style="position:relative"><i style="position:absolute;top:${top}%;height:${h}%;border-radius:${b[1] >= 0 ? '4px 4px 0 0' : '0 0 4px 4px'};${b[1] < 0 ? 'background:#9ef282' : ''}"></i>${pt.shape ? '' : `<span class="v" style="position:absolute;top:calc(${b[1] >= 0 ? top : top + h}% ${b[1] >= 0 ? '- 18px' : '+ 4px'})">${esc(fmtVal(pt, b[1]))}</span>`}</div>`; }).join('')}</div>`;
  }
  return head + chart + `<div class="pt-labels">${pt.bars.map(b => `<span>${esc(b[0])}</span>`).join('')}</div>` + `<p class="pt-cap">${esc(pt.caption)}</p>` + (pt.shape ? `<span class="shape-note">${ms('info')}Shape only, not to scale</span>` : '');
}
function caseStudy(slug) {
  const pr = PROJ[slug], pg = P.project_pages[slug] || {}, idx = P.projects.indexOf(pr), next = P.projects[(idx + 1) % P.projects.length];
  const imgs = (pg.images || []).slice(1);
  return `<article class="case">
    <dl class="meta"><dt>Role</dt><dd>${esc(pg.my_role || pr.role)}</dd><dt>When</dt><dd>${esc(pg.dates || pr.year)} · ${esc(pr.duration)}</dd><dt>Team</dt><dd>${esc(pr.team)}</dd><dt>Where</dt><dd>${esc(M.places[slug].address)}</dd></dl>
    <h3>Context</h3><p>${esc(pg.context)}</p>
    <h3>Problem</h3><p>${esc(pg.problem)}</p>
    <h3>What he did</h3><ol>${(pg.what_i_did || []).map(x => `<li>${esc(x)}</li>`).join('')}</ol>
    ${imgs[0] ? `<figure><img src="${media(imgs[0])}" alt="" loading="lazy"><figcaption>${esc(captionFor(imgs[0]))}</figcaption></figure>` : ''}
    ${(pg.decisions || []).length ? `<h3>Decisions</h3>${pg.decisions.map(d => `<div class="dec"><b>${esc(d.choice)}</b><span>${esc(d.why)}</span></div>`).join('')}` : ''}
    <h3>Results</h3>${(pg.results || []).map(r => `<div class="res"><span>${esc(r.metric)}</span><span class="rv">${esc(r.value)}</span><span class="rn">${esc(r.note)}</span></div>`).join('')}
    ${imgs[1] ? `<figure><img src="${media(imgs[1])}" alt="" loading="lazy"><figcaption>${esc(captionFor(imgs[1]))}</figcaption></figure>` : ''}
    ${pg.learned ? `<h3>What he learned</h3><p class="learn">${esc(pg.learned)}</p>` : ''}
    ${pg.next ? `<h3>What he would do next</h3><p>${esc(pg.next)}</p>` : ''}
    <div class="btn-row" style="margin-top:20px"><button class="btn btn-ton" data-go="#/p/${next.slug}">${ms('arrow_forward')}Next place: ${esc(M.places[next.slug].short)}</button><button class="btn btn-out" id="cs-contact">${ms('send')}Contact</button></div>
  </article>`;
}
function captionFor(src) { const g = P.media.gallery.find(x => src.endsWith(x.src)); if (g) return g.caption; if (src.includes('cohort')) return 'Day-30 reorders by cohort, Thistledown launch'; if (src.includes('unit-economics')) return 'Margin per job by type, Bindwell'; if (src.includes('review-time')) return 'Weekly review length, Tallowfield Freight'; return ''; }
document.addEventListener('click', e => { if (e.target.closest('#cs-contact')) openContact(); if (e.target.closest('#row-mail') && !e.target.closest('[data-copy]')) openContact(); });
function photosTab(slug) {
  const imgs = (P.project_pages[slug] || {}).images || [PROJ[slug].thumbnail];
  return `<div class="pgrid" style="padding-top:16px">${imgs.map((s, i) => `<button data-lb="p:${slug}" data-i="${i}"><img src="${media(s)}" alt="" loading="lazy">${captionFor(s) ? `<span class="cap">${esc(captionFor(s))}</span>` : ''}</button>`).join('')}</div>`;
}

/* ---------- directions: plan a city launch ---------- */
function planCitySet() { return new Set(M.plan.steps.map(s => s.city).concat([ST.dest])); }
function computePlan(dest, alt) {
  const stops = M.plan.steps.map(s => s.city), legs = [];
  for (let i = 0; i < stops.length - 1; i++) legs.push(MV.route(stops[i], stops[i + 1]));
  const best = MV.route('indore', dest);
  // alternatives: drop one edge of the best path at a time, keep the shortest different one
  let altR = null;
  best.eis.forEach(ei => { const r = MV.route('indore', dest, new Set([ei])); if (r && r.km < best.km * 1.7 && (!altR || r.km < altR.km)) altR = r; });
  const finals = altR ? [best, altR] : [best];
  const fin = finals[Math.min(alt, finals.length - 1)], other = finals.length > 1 ? finals[1 - Math.min(alt, finals.length - 1)] : null;
  legs.push(fin);
  const km = legs.reduce((a, l) => a + l.km, 0);
  return { stops, legs, finals, fin, other, km };
}
function renderPlan(destArg) {
  if (destArg && MV.cityById[destArg] && !M.plan.steps.some(s => s.city === destArg)) ST.dest = destArg;
  const firstHere = ST.view !== 'plan'; ST.view = 'plan'; ST.key = 'plan';
  if (ST.lastDest !== ST.dest) { ST.alt = 0; ST.lastDest = ST.dest; }
  const destC = MV.cityById[ST.dest], plan = computePlan(ST.dest, ST.alt); ST.lastPlan = plan;
  setSearchTitle('Plan a city launch' + (ST.dest !== 'jaipur' ? ': ' + destC.name : ''));
  const S = M.plan.steps, D = M.plan.destination, R = M.plan.routes, mode = R.find(r => r.id === ST.mode);
  const cities = [...new Set([ST.dest].concat(M.plan.cities))].filter(id => !S.some(s => s.city === id)).sort((a, b) => MV.cityById[a].name.localeCompare(MV.cityById[b].name));
  const via = r => r.via.length ? 'via ' + r.via.slice(0, 3).join(', ') : 'direct';
  const etaNote = ST.dest === 'jaipur' ? (ST.mode === 'playbook' ? 'Ashgrove, with the playbook' : 'If run like Thistledown') : (ST.mode === 'playbook' ? 'Ashgrove took 9 wk with it' : 'Thistledown took 16 wk');
  const html = `<div class="dir"><div class="dir-top">
    <div class="dir-title"><h1>Plan a city launch</h1></div>
    <div class="modes" role="group" aria-label="Launch mode">${R.map(r => `<button class="mode" data-mode="${r.id}" aria-pressed="${r.id === ST.mode}" title="${esc(r.note)}">${ms(r.id === 'playbook' ? 'menu_book' : 'flag')}<span class="mt">${r.weeks} wk</span><span>${r.id === 'playbook' ? 'Playbook' : 'First city'}</span></button>`).join('')}</div>
    <div class="wps">${S.map((s, i) => `<div class="wp ${ST.step === i ? 'on' : ''}">${i ? '<span class="conn"></span>' : ''}<span class="dot n">${'ABCD'[i]}</span><button class="box" data-step="${i}"><b>${esc(s.title)}</b><span>${esc(M.places[s.place].address.split(',').slice(-2).join(',').trim())} · ${esc(M.places[s.place].short)}</span></button><button class="go" data-go="#/p/${s.place}/case" aria-label="Open the ${esc(M.places[s.place].short)} case study">${ms('chevron_right')}</button></div>`).join('')}
      <div class="wp ${ST.step === 4 ? 'on' : ''}"><span class="conn"></span>${ms('location_on', 'fill pin')}<select id="dest" aria-label="Your launch city">${cities.map(id => `<option value="${id}" ${id === ST.dest ? 'selected' : ''}>${esc(MV.cityById[id].name)}${id === 'jaipur' ? ' (his playbook city)' : ''}</option>`).join('')}</select><button class="go" data-step="4" aria-label="Show the destination step">${ms('chevron_right')}</button></div></div>
    <div class="dir-hint">${ms('touch_app')}Choose a destination from the list, or tap any town on the map</div></div>
    ${plan.finals.map((r, i) => { const sel = i === Math.min(ST.alt, plan.finals.length - 1); const total = plan.legs.slice(0, 3).reduce((a, l) => a + l.km, 0) + r.km; return `<button class="rcard ${sel ? 'sel' : ''}" data-alt="${i}">${ms(i ? 'alt_route' : 'route')}<span><div class="rn">${i ? 'Alternative' : 'Best route'}: Thistledown to ${esc(destC.name)} ${esc(via(r))}</div><div class="rd">4 stops, then ${esc(destC.name)}${r.names.length ? ' · ' + esc(r.names.join(', ')) : ''}</div></span><span><div class="eta ${ST.mode === 'first' ? 'slow' : ''}">${mode.weeks} wk</div><div class="km">${fmtKm(total)}</div>${i ? `<div class="km">${r.km - plan.finals[0].km >= 10 ? '+' + fmtKm(r.km - plan.finals[0].km) : 'similar distance'}</div>` : ''}</span></button>`; }).join('')}
    <p class="dir-note" style="padding-top:12px">The weeks come from his story: the first town, Thistledown, needed 16 with no playbook, and Ashgrove needed 9 once it had one. For any other town treat them as a guide, not a guarantee. Distances are approximate road kilometres along the highways on the map.</p>
    <div class="steps" id="steps">
      ${S.map((s, i) => stepHtml(s, i, plan) + legHtml(plan.legs[i], i, i === S.length - 1 ? destC.name : MV.cityById[S[i + 1].city].name)).join('')}
      ${destStepHtml(D, destC, mode)}
    </div>
    <div class="dir-foot"><button class="btn btn-pri" id="send-plan">${ms('send')}Send this plan to Dev</button><button class="btn btn-out" id="copy-plan">${ms('content_copy')}Copy the plan</button></div></div>`;
  setPanel(html, { keepScroll: !firstHere, sheet: firstHere ? 'half' : ST.sheet });
  $$('#panel .mode').forEach(b => b.onclick = () => { ST.mode = b.dataset.mode; renderPlan(); });
  $('#dest').onchange = e => go('#/plan/' + e.target.value);
  $$('#panel [data-alt]').forEach(b => b.onclick = () => { ST.alt = +b.dataset.alt; renderPlan(); });
  $$('#panel [data-step]').forEach(b => b.onclick = e => { const g = e.target.closest('[data-go]'); if (g && g !== b && b.contains(g)) { e.stopPropagation(); go(g.dataset.go); return; } e.stopPropagation(); selectStep(+b.dataset.step, true); });
  $('#send-plan').onclick = () => openContact(planText(plan));
  $('#copy-plan').onclick = () => copy(planText(plan), 'Plan copied');
  bindCommon();
  document.title = 'Plan a city launch - Atlas Desk';
  // map
  const all = plan.legs.flatMap((l, i) => i ? l.ll.slice(1) : l.ll);
  const cum = []; let acc = 0; plan.legs.forEach(l => { cum.push(acc / plan.km); acc += l.km; });
  const destLL = [destC.lon, destC.lat];
  const changed = ST.fitPlan !== ST.dest + ST.alt;
  map.setRoute({ ll: all, alts: plan.other ? [plan.other.ll] : [], animate: firstHere || changed, stops: plan.stops.map((c, i) => ({ ll: [MV.cityById[c].lon, MV.cityById[c].lat], at: cum[i] })),
    bubbles: [{ ll: plan.fin.ll[Math.floor(plan.fin.ll.length * 0.55)] || destLL, t: `${mode.weeks} wk`, sub: etaNote, main: true }].concat(plan.other ? [{ ll: plan.other.ll[Math.floor(plan.other.ll.length / 2)], t: fmtKm(plan.legs.slice(0, 3).reduce((a, l) => a + l.km, 0) + plan.other.km), sub: 'alternative', main: false }] : []) });
  ST.redraw = false;
  map.extraCity(ST.dest);
  const dm = ST.destMarker; dm.lon = destLL[0]; dm.lat = destLL[1]; dm.el.hidden = false; dm.el.querySelector('.pin-lab').textContent = destC.name; map.invalidate();
  if (ST.step != null) selectStep(ST.step, false, firstHere);
  else if (firstHere || ST.fitPlan !== ST.dest + ST.alt) { map.setPad(padFor()); map.flyToLL(all, { t: padFor().t + 50, b: padFor().b + 30, l: padFor().l + 40, r: 100 }); }
  ST.fitPlan = ST.dest + ST.alt;
}
function stepHtml(s, i, plan) {
  const pl = M.places[s.place];
  return `<button class="step ${ST.step === i ? 'on' : ''}" data-step="${i}" id="step-${i}"><span class="si">${ms(s.icon)}</span><span><span class="sk">Step ${i + 1} · ${esc(MV.cityById[s.city].name)}</span><span class="st" style="display:block">${esc(s.title)}</span>
    <span class="sd" style="display:block">${esc(s.do)}</span><ul>${s.proof.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <span class="facts">${s.facts.map(f => `<span><b>${esc(f[0])}</b>${esc(f[1])}</span>`).join('')}</span>
    <span class="sl" data-go="#/p/${s.place}/case">${ms('menu_book')}Proof: ${esc(pl.short)} case study</span></span></button>`;
}
function legHtml(l, i, toName) { return `<div class="leg">${ms(i === 3 ? 'flag' : 'south')}<span>${fmtKm(l.km)} to ${esc(toName)}${l.via.length ? ' via ' + esc(l.via.join(', ')) : ''}${l.names.length ? ' · ' + esc(l.names.join(', ')) : ''}</span></div>`; }
function destStepHtml(D, destC, mode) {
  const isJ = ST.dest === 'jaipur';
  const title = ST.mode === 'playbook' ? (isJ ? D.title + ' in Ashgrove' : `Launch ${destC.name} with the playbook`) : `Launch ${destC.name} like Thistledown`;
  const doTxt = ST.mode === 'playbook' ? D.do : 'No playbook yet: the same four steps, learned as you go. This is how Thistledown ran, in 16 weeks.';
  return `<button class="step ${ST.step === 4 ? 'on' : ''}" data-step="4" id="step-4"><span class="si" style="background:#ebfce6;color:#53c51f">${ms('location_on', 'fill')}</span><span><span class="sk">Destination · ${esc(destC.name)}, ${esc(destC.state)}</span><span class="st" style="display:block">${esc(title)}</span>
    <span class="sd" style="display:block">${esc(doTxt)}</span><ul>${D.proof.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <span class="facts">${D.facts.map(f => `<span><b>${esc(f[0])}</b>${esc(f[1])}</span>`).join('')}</span>
    <span class="sl" data-go="#/p/thistledown-launch/case">${ms('menu_book')}Proof: Thistledown launch case study</span></span></button>`;
}
function selectStep(i, fromPanel, quiet) {
  ST.step = i; const plan = ST.lastPlan; if (!plan) return;
  $$('#panel .step').forEach(s => s.classList.toggle('on', s.id === 'step-' + i));
  $$('#panel .wp').forEach((w, k) => w.classList.toggle('on', k === i));
  const leg = i === 0 ? null : plan.legs[i - 1]; map.focusRoute(leg ? leg.ll : null);
  const cityId = i === 4 ? ST.dest : M.plan.steps[i].city, c = MV.cityById[cityId];
  const at = i < 4 ? PLACE_LL[M.plan.steps[i].place] : [c.lon, c.lat];
  const s = i < 4 ? 1900 : 900, P2 = padFor(); map.setPad(P2);
  map.flyTo({ cx: (at[0] + c.lon) / 2 - (P2.l - P2.r) / 2 / s, cy: MV.merc((at[1] + c.lat) / 2) - (P2.b - P2.t) / 2 / s, s });
  if (fromPanel || !quiet) { const el = $('#step-' + i); if (el && !fromPanel) el.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }); }
  if (!fromPanel && isPhone() && ST.sheet === 'peek') snap('half');
}
function planText(plan) {
  const D = MV.cityById[ST.dest], mode = M.plan.routes.find(r => r.id === ST.mode);
  return `City launch plan for ${D.name}, built on Dev Oberoi's map portfolio\n\n` + M.plan.steps.map((s, i) => `${i + 1}. ${s.title} (${M.places[s.place].short}, ${MV.cityById[s.city].name}): ${s.do}`).join('\n')
    + `\n5. ${ST.mode === 'playbook' ? 'Repeat with the playbook' : 'Launch like Thistledown'} in ${D.name}.\n\nReference time: ${mode.weeks} weeks (${mode.note}). Route about ${fmtKm(plan.km)}.`;
}

/* ---------- timeline ---------- */
function renderTimeline(year) {
  const firstHere = ST.view !== 'timeline'; ST.view = 'timeline'; ST.key = 'timeline'; ST.tlYear = year || 'all'; setSearchTitle('Timeline');
  const T = M.timeline.map((t, i) => ({ ...t, idx: i }));
  const years = [...new Set(T.map(t => t.year))];
  const shown = T.filter(t => ST.tlYear === 'all' || String(t.year) === ST.tlYear);
  const cityOf = t => t.city || t.to, citiesAll = new Set(T.filter(t => t.kind !== 'playbook').flatMap(t => t.city ? [t.city] : [t.from, t.to]));
  const kmMoves = T.filter(t => t.kind === 'move' || t.kind === 'trip').reduce((a, t) => a + MV.haversine([MV.cityById[t.from].lon, MV.cityById[t.from].lat], [MV.cityById[t.to].lon, MV.cityById[t.to].lat]), 0);
  let lastY = null;
  const items = shown.map(t => {
    const yh = t.year !== lastY ? `<div class="tl-year">${t.year}</div>` : ''; lastY = t.year;
    const icon = t.kind === 'move' ? 'flight' : t.kind === 'trip' ? 'commute' : t.kind === 'playbook' ? 'menu_book' : t.icon;
    const title = t.kind === 'move' ? `${MV.cityById[t.from].name} to ${MV.cityById[t.to].name}` : t.kind === 'trip' ? `${t.place}: ${MV.cityById[t.from].name} to ${MV.cityById[t.to].name}` : t.kind === 'playbook' ? t.place : t.place;
    const sub = t.kind === 'move' || t.kind === 'trip' ? `${t.when} · ${fmtKm(MV.haversine([MV.cityById[t.from].lon, MV.cityById[t.from].lat], [MV.cityById[t.to].lon, MV.cityById[t.to].lat]))} straight line` : `${t.when} · ${MV.cityById[cityOf(t)].name}`;
    return yh + `<button class="tl-item ${t.kind} ${ST.tlActive === t.idx ? 'on' : ''}" data-tl="${t.idx}"><span class="tl-rail"><span class="tl-ic">${ms(icon)}</span></span><span class="tl-body"><b>${esc(title)}</b><span class="tw">${esc(sub)}</span><p>${esc(t.what)}</p>${t.project ? `<span class="tl-open" data-go="#/p/${t.project}">${ms('location_on')}Open place</span>` : ''}</span></button>`;
  }).join('');
  const html = `<div class="tl-head"><h1>Timeline</h1><div class="cat">Where Dev lived and worked, 2016 to now</div></div>
    <div class="fchips" data-qa-scroll><button class="fchip" data-tly="all" aria-pressed="${ST.tlYear === 'all'}">All years</button>${years.map(y => `<button class="fchip" data-tly="${y}" aria-pressed="${ST.tlYear === String(y)}">${y}</button>`).join('')}</div>
    <div class="tl-stats"><div><b>${citiesAll.size}</b><span>cities</span></div><div><b>${T.filter(t => t.kind === 'move' || t.kind === 'trip').length}</b><span>moves and trips</span></div><div><b>${(Math.round(kmMoves / 100) * 100).toLocaleString('en-IN')}</b><span>km, straight line</span></div></div>
    <div class="tl">${items}</div>
    <div class="sec" style="border:0"><button class="btn btn-out" data-go="#/about">${ms('work')}Experience and education</button></div>`;
  setPanel(html, { keepScroll: !firstHere, sheet: firstHere ? 'half' : ST.sheet });
  $$('#panel [data-tly]').forEach(b => b.onclick = () => go(b.dataset.tly === 'all' ? '#/timeline' : '#/timeline/' + b.dataset.tly));
  $$('#panel [data-tl]').forEach(b => b.onclick = e => { if (e.target.closest('[data-go]')) return; tlFocus(+b.dataset.tl); });
  bindCommon();
  document.title = 'Timeline - Atlas Desk';
  // map path
  const segs = [], visits = [];
  shown.forEach(t => {
    if (t.kind === 'visit') { const c = MV.cityById[t.city]; visits.push({ idx: t.idx, ll: MV.kmToLL(c, t.at[0], t.at[1]) }); }
    else { const a = MV.cityById[t.from], b = MV.cityById[t.to]; const ll = t.kind === 'playbook' ? [[a.lon, a.lat], [b.lon, b.lat]] : MV.route(t.from, t.to).ll; segs.push({ idx: t.idx, kind: t.kind, ll }); visits.push({ idx: t.idx, ll: [b.lon, b.lat] }); }
  });
  map.setTimeline({ segs, visits, animate: true });
  ST.tlActive = null;
  const lls = segs.flatMap(s => s.ll).concat(visits.map(v => v.ll));
  map.setPad(padFor()); if (lls.length) map.flyToLL(lls, { t: padFor().t + 50, b: padFor().b + 30, l: padFor().l + 40, r: 100 });
}
function tlFocus(i) {
  ST.tlActive = i; map.timelineActive(i);
  $$('#panel .tl-item').forEach(b => b.classList.toggle('on', +b.dataset.tl === i));
  const t = M.timeline[i];
  if (t.kind === 'visit') { const c = MV.cityById[t.city], ll = MV.kmToLL(c, t.at[0], t.at[1]), s = 2600, P2 = padFor(); map.flyTo({ cx: ll[0] - (P2.l - P2.r) / 2 / s, cy: MV.merc(ll[1]) - (P2.b - P2.t) / 2 / s, s }); }
  else { const a = MV.cityById[t.from], b = MV.cityById[t.to]; map.flyToLL([[a.lon, a.lat], [b.lon, b.lat]], { t: padFor().t + 60, b: padFor().b + 40, l: padFor().l + 60, r: 120 }); }
  if (isPhone() && ST.sheet === 'full') snap('half');
}

/* ---------- dialogs: contact (Directions to Dev), share, shortcuts ---------- */
function openDialog(html, onBind) {
  const d = $('#dialog'); d.innerHTML = `<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-t">${html}</div>`; d.hidden = false;
  d.onclick = e => { if (e.target === d) closeOverlays(); };
  $$('[data-close]', d).forEach(b => b.onclick = closeOverlays);
  onBind && onBind(d); setTimeout(() => { const f = $('.dialog button, .dialog a', d); f && f.focus(); }, 30);
}
function openContact(planMsg) {
  const c = P.contact;
  const msg = planMsg ? `Hi Dev,\n\nI used your map portfolio to plan a city launch. Here is the plan:\n\n${planMsg}\n\nCould we talk about a founder's office role?` : `Hi Dev,\n\nI went through your map portfolio and would like to talk about a founder's office role. Are you free for a call this week?`;
  openDialog(`<div class="dlg-h"><h2 id="dlg-t">Directions to Dev</h2><button class="x" data-close aria-label="Close">${ms('close')}</button></div>
    <div class="dirhead"><span class="dot"></span><span>You</span><span class="conn"></span><span></span>${ms('location_on', 'fill')}<span><b style="font-weight:500">Dev Oberoi</b> · Ravenmoor · open to roles from ${esc(P.person.available_from)}</span></div>
    <div class="dmodes">
      <a class="dmode" id="dm-mail" href="#">${ms('mail')}<span><b>Email</b><span class="d">${esc(c.email)} · opens your mail app with the note below</span></span>${ms('chevron_right', 'chev')}</a>
      <a class="dmode" href="${esc(c.calendly)}" target="_blank" rel="noopener">${ms('event')}<span><b>Book a call</b><span class="d">Pick a 30-minute slot on his calendar</span></span>${ms('open_in_new', 'chev')}</a>
      <a class="dmode" href="${esc(c.linkedin)}" target="_blank" rel="noopener">${ms('public')}<span><b>LinkedIn</b><span class="d">Message him on LinkedIn</span></span>${ms('open_in_new', 'chev')}</a>
      <a class="dmode" href="media/resume.pdf" download>${ms('description')}<span><b>Résumé</b><span class="d">Download the PDF</span></span>${ms('download', 'chev')}</a>
      <button class="dmode" id="dm-copy">${ms('content_copy')}<span><b>Copy email address</b><span class="d">${esc(c.email)}</span></span><span></span></button>
    </div>
    <div class="field"><label for="dm-msg">Your note</label><textarea id="dm-msg" rows="${planMsg ? 8 : 4}">${esc(msg)}</textarea></div>
    <div class="btn-row"><button class="btn btn-pri" id="dm-send">${ms('send')}Email this note</button><button class="btn btn-out" id="dm-copymsg">${ms('content_copy')}Copy note</button></div>`, d => {
    const mailto = () => `mailto:${c.email}?subject=${encodeURIComponent(planMsg ? 'A city launch plan from your map portfolio' : 'Founder\'s office role')}&body=${encodeURIComponent($('#dm-msg').value)}`;
    $('#dm-mail', d).onclick = e => { e.preventDefault(); location.href = mailto(); };
    $('#dm-send', d).onclick = () => { location.href = mailto(); toast('Opening your mail app'); };
    $('#dm-copy', d).onclick = () => copy(c.email, 'Email address copied');
    $('#dm-copymsg', d).onclick = () => copy($('#dm-msg').value, 'Note copied');
  });
}
function openShare(slug) {
  const pr = slug && PROJ[slug], pl = slug && M.places[slug];
  const url = location.href.split('#')[0] + (slug ? '#/p/' + slug : '#/');
  const title = pr ? pl.short : 'Dev Oberoi', sub = pr ? pl.address : P.person.headline, img = pr ? media(pr.thumbnail) : 'media/photos/avatar.jpg';
  const embed = s => `<iframe src="${url}" width="${s[0]}" height="${s[1]}" style="border:0" loading="lazy" title="${title} on Dev's map"></iframe>`;
  const body = tab => tab === 'link' ? `<div class="share-card"><img src="${img}" alt=""><span><b>${esc(title)}</b><span>${esc(sub)}</span></span></div>
      <div class="copyrow"><input id="sh-url" value="${esc(url)}" readonly aria-label="Link"><button class="btn btn-ton" id="sh-copy">Copy link</button></div>
      <div class="targets"><a href="mailto:?subject=${encodeURIComponent(title + ' on Dev Oberoi\'s map')}&body=${encodeURIComponent(url)}"><span class="tc">${ms('mail')}</span>Email</a>
      <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}" target="_blank" rel="noopener"><span class="tc">${ms('public')}</span>LinkedIn</a>
      <a href="https://wa.me/?text=${encodeURIComponent(url)}" target="_blank" rel="noopener"><span class="tc">${ms('chat')}</span>WhatsApp</a></div>`
    : `<div class="field"><label for="sh-size">Size</label><select id="sh-size" style="height:40px;border:1px solid var(--line-2);border-radius:8px;padding:0 10px"><option value="600,450">Medium (600 × 450)</option><option value="800,600">Large (800 × 600)</option><option value="400,300">Small (400 × 300)</option></select></div>
      <div class="copyrow"><textarea id="sh-code" rows="3" readonly aria-label="Embed code">${esc(embed([600, 450]))}</textarea><button class="btn btn-ton" id="sh-copycode">Copy HTML</button></div>`;
  const draw = tab => openDialog(`<div class="dlg-h"><h2 id="dlg-t">Share</h2><button class="x" data-close aria-label="Close">${ms('close')}</button></div>
    <div class="dlg-tabs" role="tablist"><button role="tab" aria-selected="${tab === 'link'}" data-st="link">Send a link</button><button role="tab" aria-selected="${tab === 'embed'}" data-st="embed">Embed a map</button></div>${body(tab)}`, d => {
    $$('[data-st]', d).forEach(b => b.onclick = () => draw(b.dataset.st));
    const cp = $('#sh-copy', d); cp && (cp.onclick = () => copy(url, 'Link copied'));
    const sz = $('#sh-size', d); sz && (sz.onchange = () => { $('#sh-code', d).value = embed(sz.value.split(',')); });
    const cc = $('#sh-copycode', d); cc && (cc.onclick = () => copy($('#sh-code', d).value, 'Embed code copied'));
  });
  draw('link');
}
function openShortcuts() {
  const k = [['/', 'Search the map'], ['+ / −', 'Zoom in or out'], ['Arrow keys', 'Move the map'], ['P', 'Plan a city launch'], ['T', 'Timeline'], ['S', 'Saved places'], ['H', 'Back to his place card'], ['Esc', 'Close or go back'], ['?', 'This list']];
  openDialog(`<div class="dlg-h"><h2 id="dlg-t">Keyboard shortcuts</h2><button class="x" data-close aria-label="Close">${ms('close')}</button></div><div class="kbd-list">${k.map(([a, b]) => `<kbd>${esc(a)}</kbd><span>${esc(b)}</span>`).join('')}</div>`);
}
function openDrawer() {
  const d = $('#drawer');
  d.innerHTML = `<div class="dr-head"><img src="media/maps-icon.svg" alt="" width="20" height="28"><span class="wm"><b>Atlas</b> Desk</span></div>
    <a href="#/">${ms('person')}Dev's place card</a><a href="#/saved">${ms('bookmark')}Saved places (projects)</a><a href="#/timeline">${ms('history')}Timeline</a><a href="#/plan">${ms('directions')}Plan a city launch</a>
    <a href="#/reviews">${ms('rate_review')}Reviews</a><a href="#/about">${ms('work')}Experience and education</a><hr>
    <button class="di" id="dr-share">${ms('share')}Share or embed the map</button><button class="di" id="dr-contact">${ms('send')}Contact Dev</button>
    <a href="read.html">${ms('description')}Résumé view</a><a href="media/resume.pdf" download>${ms('download')}Download résumé (PDF)</a><hr>
    <button class="di" id="dr-layers">${ms('layers')}Layers</button><button class="di" id="dr-kbd">${ms('keyboard')}Keyboard shortcuts</button><button class="di" id="dr-tour">${ms('tour')}Take the tour again</button><hr>
    <p class="dr-legal">A portfolio by Dev Oberoi, built as a map app. Sample persona: the company, people and numbers are invented. The map is drawn in code and positions are approximate.</p>`;
  d.hidden = false; $('#scrim').hidden = false;
  $$('a', d).forEach(a => a.addEventListener('click', () => closeOverlays()));
  $('#dr-share').onclick = () => { closeOverlays(); openShare(); }; $('#dr-contact').onclick = () => { closeOverlays(); openContact(); };
  $('#dr-kbd').onclick = () => { closeOverlays(); openShortcuts(); }; $('#dr-layers').onclick = () => { closeOverlays(); toggleLayers(); };
  $('#dr-tour').onclick = () => { closeOverlays(); store.set('tour', 0); if (ST.view !== 'home') go('#/'); setTimeout(() => showCoach(0), 500); };
  setTimeout(() => $('a', d).focus(), 30);
}
function toggleLayers() {
  const pop = $('#layers-pop'), open = pop.hidden;
  if (!open) { pop.hidden = true; $('#layers-btn').setAttribute('aria-expanded', 'false'); return; }
  const L = map.layers, sw = (id, ic, label, on) => `<button data-layer="${id}" aria-pressed="${on}"><span class="sw">${ms(ic)}</span>${label}</button>`;
  pop.innerHTML = `<h3>Map type</h3><div class="lp-grid">${sw('default', 'map', 'Default', !L.muted)}${sw('muted', 'contrast', 'Muted', L.muted)}</div>
    <h3>Map details</h3><div class="lp-grid">${sw('pins', 'location_on', 'Projects', L.pins)}${sw('zones', 'select_all', 'Launch zones', L.zones)}${sw('timeline', 'history', 'Timeline', L.timeline)}${sw('highways', 'add_road', 'Highways', L.highways)}</div>
    <p style="font-size:12px;color:var(--mute);margin:4px 0 0;line-height:17px">Launch zones show his 4 picked Thistledown districts (of 14 mapped) and the 7 Ravenmoor delivery zones. Zoom in to see them.</p>`;
  pop.hidden = false; $('#layers-btn').setAttribute('aria-expanded', 'true');
  $$('[data-layer]', pop).forEach(b => b.onclick = () => {
    const id = b.dataset.layer;
    if (id === 'default' || id === 'muted') L.muted = id === 'muted';
    else L[id] = !L[id];
    if (id === 'timeline') { if (L.timeline && ST.view !== 'timeline') { const segs = M.timeline.filter(t => t.kind !== 'visit').map((t, i) => ({ idx: i, kind: t.kind, ll: t.kind === 'playbook' ? [[MV.cityById[t.from].lon, MV.cityById[t.from].lat], [MV.cityById[t.to].lon, MV.cityById[t.to].lat]] : MV.route(t.from, t.to).ll })); map.setTimeline({ segs, visits: [], animate: true }); } else if (!L.timeline && ST.view !== 'timeline') map.setTimeline(null); }
    if (id === 'zones' && L.zones) toast('Zoom into Thistledown or Ravenmoor to see the launch zones', 'Show Thistledown', () => { const c = MV.cityById.thistledown, s = 2200, P2 = padFor(); map.flyTo({ cx: c.lon + 0.02 - (P2.l - P2.r) / 2 / s, cy: MV.merc(c.lat + 0.02) - (P2.b - P2.t) / 2 / s, s }); });
    map.invalidate(); pop.hidden = true; toggleLayers();
  });
}
function closeOverlays(soft) {
  $('#dialog').hidden = true; $('#drawer').hidden = true; $('#scrim').hidden = true;
  if (!soft) { $('#layers-pop').hidden = true; $('#layers-btn').setAttribute('aria-expanded', 'false'); }
}

/* ---------- lightbox ---------- */
let LB = { list: [], i: 0 };
function openLightbox(key, i) {
  let list;
  if (key === 'gallery') list = P.media.gallery.filter(x => !x.src.endsWith('.png')).map(x => ({ src: 'media/' + x.src, cap: x.caption }));
  else { const slug = key.slice(2), pg = P.project_pages[slug] || {}; list = (pg.images || [PROJ[slug].thumbnail]).map(s => ({ src: media(s), cap: captionFor(s) || M.places[slug].short })); }
  LB = { list, i: i || 0 }; drawLb(); $('#lightbox').hidden = false;
}
function drawLb() {
  const x = LB.list[LB.i], lb = $('#lightbox');
  lb.innerHTML = `<div class="lb-top"><b>${LB.i + 1} of ${LB.list.length}</b><button id="lb-x" aria-label="Close photos">${ms('close')}</button></div>
    <div class="lb-main"><button class="lb-nav" id="lb-p" aria-label="Previous photo">${ms('chevron_left')}</button><img src="${esc(x.src)}" alt="${esc(x.cap)}"><button class="lb-nav" id="lb-n" aria-label="Next photo">${ms('chevron_right')}</button></div><div class="lb-cap">${esc(x.cap)}</div>`;
  $('#lb-x').onclick = closeLightbox; $('#lb-p').onclick = () => lbStep(-1); $('#lb-n').onclick = () => lbStep(1);
  let sx0 = null; const img = $('.lb-main img', lb); img.addEventListener('pointerdown', e => { sx0 = e.clientX; }); img.addEventListener('pointerup', e => { if (sx0 != null && Math.abs(e.clientX - sx0) > 40) lbStep(e.clientX < sx0 ? 1 : -1); sx0 = null; });
  $('#lb-x').focus();
}
function lbStep(d) { LB.i = (LB.i + d + LB.list.length) % LB.list.length; drawLb(); }
function closeLightbox() { $('#lightbox').hidden = true; }

/* ---------- utilities ---------- */
let toastT;
function toast(msg, action, fn) {
  const t = $('#toast'); t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button>${esc(action)}</button>` : ''}`; t.classList.add('on');
  if (action) t.querySelector('button').onclick = () => { t.classList.remove('on'); fn(); };
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), action ? 5000 : 2600);
}
function copy(text, msg) {
  const done = () => toast(msg || 'Copied');
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  function fallback() { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) { /* ignore */ } ta.remove(); done(); }
}

/* ---------- phone bottom sheet with snap points ---------- */
function sheetH() { return $('#sheet').offsetHeight; }
function peekH() { const ph = $('#panel .ph') || $('#panel .dir-title') || $('#panel .tl-head'); const acts = !document.body.classList.contains('touring') && $('#panel .actions'); const base = ph ? ph.offsetHeight + (acts ? acts.offsetHeight : 0) + (ST.view === 'home' || ST.view === 'place' ? 0 : 70) : 160; return Math.max(150, Math.min(380, 22 + base + 6)); }
function visibleSheet() { if (!isPhone()) return 0; const H = sheetH() || innerHeight * 0.7; return ST.sheet === 'full' ? H : ST.sheet === 'half' ? Math.round(H * 0.48) : peekH(); }
function snap(state, quiet) {
  if (!isPhone()) return; ST.sheet = state; const H = sheetH(), vis = Math.min(H, visibleSheet());
  document.documentElement.style.setProperty('--sheet-y', (H - vis) + 'px'); document.documentElement.style.setProperty('--sheet-vis', vis + 'px');
  $('#sheet').classList.toggle('full', state === 'full'); document.body.classList.toggle('sheet-full', state === 'full');
  map && map.setPad(padFor());
}
function initSheet() {
  const sh = $('#sheet'), pn = $('#panel'); let st = null;
  const states = () => [['peek', peekH()], ['half', Math.round(sheetH() * 0.48)], ['full', sheetH()]];
  sh.addEventListener('pointerdown', e => {
    if (!isPhone() || e.button > 0) return;
    const onGrab = !!e.target.closest('#grab'), full = ST.sheet === 'full';
    if (full && !onGrab && !(pn.scrollTop <= 0 && e.target.closest('.ph, .dir-title, .tl-head'))) return;
    st = { y: e.clientY, vis: visibleSheet(), t: performance.now(), drag: false, id: e.pointerId, onGrab };
  });
  sh.addEventListener('pointermove', e => {
    if (!st || e.pointerId !== st.id) return; const dy = e.clientY - st.y;
    if (!st.drag && Math.abs(dy) > 8) { st.drag = true; sh.classList.add('dragging'); try { sh.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ } }
    if (st.drag) { const H = sheetH(), vis = Math.max(110, Math.min(H, st.vis - dy)); document.documentElement.style.setProperty('--sheet-y', (H - vis) + 'px'); }
  });
  const end = e => {
    if (!st || e.pointerId !== st.id) return;
    sh.classList.remove('dragging');
    if (st.drag) {
      const dy = e.clientY - st.y, v = dy / Math.max(1, performance.now() - st.t), vis = st.vis - dy, S = states();
      let target = S.reduce((a, b) => Math.abs(b[1] - vis) < Math.abs(a[1] - vis) ? b : a)[0];
      if (Math.abs(v) > 0.6) { const i = S.findIndex(s => s[0] === ST.sheet), n = S.findIndex(s => s[0] === target); target = S[v < 0 ? Math.max(n, Math.min(2, i + 1)) : Math.min(n, Math.max(0, i - 1))][0]; }
      snap(target); e.preventDefault();
      const block = ev => { ev.stopPropagation(); ev.preventDefault(); }; sh.addEventListener('click', block, { capture: true, once: true }); setTimeout(() => sh.removeEventListener('click', block, { capture: true }), 50);
    } else if (st.onGrab) snap(ST.sheet === 'peek' ? 'half' : ST.sheet === 'half' ? 'full' : 'peek');
    st = null;
  };
  sh.addEventListener('pointerup', end); sh.addEventListener('pointercancel', e => { if (st) { sh.classList.remove('dragging'); snap(ST.sheet); st = null; } });
  // tapping a tab or action at peek opens the sheet further
  sh.addEventListener('click', e => { if (isPhone() && ST.sheet === 'peek' && e.target.closest('.ptabs, .ph')) snap('half'); });
  if (isPhone()) snap('peek', true);
  matchMedia('(max-width: 760px)').addEventListener('change', () => { if (!isPhone()) { document.documentElement.style.setProperty('--sheet-y', '0px'); } else snap(ST.sheet); map.setPad(padFor()); });
}

/* ---------- first-visit guided tour (coachmarks) ---------- */
const TOUR = [
  { t: 'This is Dev\'s place card', p: 'His portfolio, laid out like a place card on a map. Tabs hold his projects, reviews and experience.', el: () => $('#ph-home') },
  { t: 'Each red pin is a project', p: 'Click a pin for the case study. Results show as popular-times bars.', el: () => pinsBox() },
  { t: 'Plan a city launch', p: 'Runs his go-to-market method as a route across India, with a real project at every stop.', el: () => isPhone() ? $('#fab-dir') : $('#chip-plan') },
  { t: 'His career as a Timeline', p: 'Fernhollow, Larchmont Falls, Thistledown, Ravenmoor: every move on the map.', el: () => isPhone() ? $('.bnav [data-tab="timeline"]') : $('.rail-item[data-nav="timeline"]') }
];
function pinsBox() { const r = $$('.pin:not([hidden]):not(.dest-pin)').map(p => p.querySelector('.pin-b').getBoundingClientRect()).filter(r => r.width); if (!r.length) return null; return { getBoundingClientRect: () => { const x0 = Math.min(...r.map(a => a.left)), y0 = Math.min(...r.map(a => a.top)), x1 = Math.max(...r.map(a => a.right)), y1 = Math.max(...r.map(a => a.bottom)); return { left: x0, top: y0, right: x1, bottom: y1, width: x1 - x0, height: y1 - y0 }; } }; }
function maybeTour() { if (store.get('tour', 0) || ST.view !== 'home' || location.hash.length > 2) return; showCoach(0); }
function endTour() { store.set('tour', 1); $('#coach').hidden = true; const r = $('.coach-ring'); r && r.remove(); document.body.classList.remove('touring'); document.documentElement.style.setProperty('--tour-h', '0px'); if (isPhone()) snap(ST.sheet); }
function showCoach(i) {
  const st = TOUR[i], coach = $('#coach'); if (!st) return endTour();
  const target = st.el(); if (!target) return showCoach(i + 1);
  coach.innerHTML = `<b>${esc(st.t)}</b><p>${esc(st.p)}</p><div class="c-f"><span>${i + 1} of ${TOUR.length}</span><button data-skip>Dismiss</button><button class="c-next" data-next>${i === TOUR.length - 1 ? 'Got it' : 'Next'}</button></div>`;
  coach.className = 'coach'; coach.hidden = false; document.body.classList.add('touring');
  let ring = $('.coach-ring'); if (!ring) { ring = document.createElement('div'); ring.className = 'coach-ring'; document.body.appendChild(ring); }
  const place = () => {
    const r = target.getBoundingClientRect(), pad = 6;
    Object.assign(ring.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
    if (isPhone()) { coach.style.left = ''; coach.style.top = ''; return; }
    const cw = coach.offsetWidth, ch = coach.offsetHeight;
    if (r.right + cw + 24 < innerWidth && r.width < 460) { coach.classList.add('left'); coach.style.left = r.right + 18 + 'px'; coach.style.top = Math.min(innerHeight - ch - 16, Math.max(72, r.top)) + 'px'; }
    else if (r.bottom + ch + 20 < innerHeight) { coach.classList.add('up'); coach.style.left = Math.min(Math.max(16, r.left), innerWidth - cw - 16) + 'px'; coach.style.top = r.bottom + 16 + 'px'; }
    else { coach.classList.add('down'); coach.style.left = Math.min(Math.max(16, r.left), innerWidth - cw - 16) + 'px'; coach.style.top = Math.max(8, r.top - ch - 16) + 'px'; }
  };
  if (isPhone()) { document.documentElement.style.setProperty('--tour-h', (coach.offsetHeight + 14) + 'px'); snap('peek'); setTimeout(place, 380); setTimeout(place, 800); } else place();
  $('[data-next]', coach).onclick = () => showCoach(i + 1);
  $('[data-skip]', coach).onclick = endTour;
  $('[data-next]', coach).focus({ preventScroll: true });
}
