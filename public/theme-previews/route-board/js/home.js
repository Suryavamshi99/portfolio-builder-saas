/* home.js: the home page. Route logic follows Skerry's main-*.js (line drawn by scroll, pins at path fractions, coordinates interpolated along the journey). */
(async function () {
  const { $, $$, esc } = K;
  let d;
  try { d = await K.load(); } catch (e) { document.body.insertAdjacentHTML('afterbegin', '<p style="padding:20px">Content could not be loaded.</p>'); return; }
  const P = d.person, C = d.contact, R = d.route;
  K.chrome(d, 'home');
  K.initScroll();
  K.compass();
  K.printResume(d);
  const co = K.forCo;
  const fine = K.fine(), reduced = K.reduced();

  /* ---------- hero copy ---------- */
  $('#k-t').textContent = `${P.first_name} ${P.last_name} · supply chain and operations`;
  const h = $('#hero-h');
  h.innerHTML = esc(R.title).replace(/pick room$/i, '<em>pick room</em>');
  $('#hero-sub').textContent = d.pitch.short;
  $('#route-h').textContent = `${R.stops.length} stops, ${R.stops[R.stops.length - 1].km.toLocaleString('en-IN')} km`;
  $('#route-p').textContent = R.intro;
  $('#t-to').textContent = co ? `For ${co}` : `From ${P.available_from}`;

  // roles and cities come from person.looking_for
  const [rolePart, cityPart = ''] = P.looking_for.split(';');
  const roles = rolePart.replace(/ roles.*$/, '').split(/,\s*|\s+and\s+/).map((s) => s.trim()).filter(Boolean).map((s) => s[0].toUpperCase() + s.slice(1));
  const cities = cityPart.split(/,\s*|\s+or\s+/).map((s) => s.trim()).filter(Boolean);
  $('#t-role').innerHTML = roles.map((r) => `<option>${esc(r)}</option>`).join('');
  $('#t-city').innerHTML = cities.map((c) => `<option>${esc(c)}</option>`).join('');

  /* stop 01 card holds the clip */
  const s1 = R.stops[1];
  $('#s1-place').textContent = s1.place;
  $('#s1-where').textContent = s1.where;
  const ll1 = K.parseLL(s1.coords);
  $('#s1-ll').textContent = K.coords(ll1.lat, ll1.lon);

  /* strip: three results from the route, plus distance, shift start and start date */
  const pick = [1, 2, 4].map((i) => R.stops[i]);
  $('#proof').innerHTML = pick.map((s) => `<li><b>${esc(s.metric[0])}</b><span class="lab">${esc(s.place)}</span></li>`).join('');
  $('#widgets').innerHTML = `<span><em>Distance</em><b>${R.stops[R.stops.length - 1].km.toLocaleString('en-IN')} km</b></span><span><em>Shift start</em><b>${esc(d.site.shift_start)}</b></span><span><em>Free from</em><b>${esc(P.available_from)}</b></span>`;

  K.letters(h, 0.45);
  K.intro();

  /* ---------- the map and the route ---------- */
  const svg = $('#map');
  const base = $('#r-base'), flow = $('#r-flow'), prev = $('#r-preview'), glow = $('#r-glow'), line = $('#r-line'), next = $('#r-next');
  const pinsG = $('#r-pins'), truck = $('#r-truck'), bar = $('#route-bar');
  const stops = R.stops.map((s) => ({ ...s, ll: K.parseLL(s.coords) }));
  const origin = stops[0].ll;
  let mode = '', L = 1, at = [], pins = [], nextPin = null, prog = 0;

  const cards = $('#rcards');
  cards.innerHTML = stops.map((s, i) => `<li class="rcard" data-i="${i}"><button type="button" aria-haspopup="dialog">
  ${s.image ? `<div class="ph rthumb"><img src="${K.media(s.image)}" alt="" loading="lazy" /></div>` : `<div class="rthumb logo-thumb"><img src="${K.media(s.logo)}" alt="" loading="lazy" /></div>`}
  <div class="rtext"><span class="lab">${K.pad2(i)} &middot; ${esc(K.coords(s.ll.lat, s.ll.lon))}</span><b>${esc(s.place)}</b><small>${esc(s.years)} &middot; ${esc(s.metric[0])}</small></div><span class="rgo" aria-hidden="true">&rarr;</span></button></li>`).join('');
  const cardEls = $$('.rcard', cards);
  cardEls.forEach((c, i) => c.querySelector('button').addEventListener('click', () => openSheet(i)));
  if (!reduced) gsap.set(cardEls, { opacity: 0, x: -26 });

  function build() {
    const m = matchMedia('(max-width: 900px)').matches ? 'tall' : 'wide';
    if (m === mode) { layoutLeader(); return; }
    mode = m;
    K.drawBase(svg, mode);
    const g = K.routePoints(mode);
    const dPath = K.smooth(g.via);
    [base, flow, prev, glow, line].forEach((p) => p.setAttribute('d', dPath));
    next.setAttribute('d', K.smooth(g.next));
    L = line.getTotalLength();
    // stop fractions: nearest sample on the path
    const N = 900, samples = [];
    for (let i = 0; i <= N; i++) { const q = line.getPointAtLength((L * i) / N); samples.push([q.x, q.y, i / N]); }
    at = g.stops.map(([x, y]) => { let best = 0, bd = 1e12; samples.forEach(([sx, sy, f]) => { const dd = (sx - x) ** 2 + (sy - y) ** 2; if (dd < bd) { bd = dd; best = f; } }); return best; });
    at[0] = 0; at[at.length - 1] = 1;
    [line, glow].forEach((p) => (p.style.strokeDasharray = `${L}`));
    prev.style.strokeDasharray = `${L}`;
    // pins
    pinsG.innerHTML = '';
    pins = stops.map((s, i) => {
      const q = line.getPointAtLength(L * at[i]);
      const el = document.createElementNS(K.NS, 'g');
      el.setAttribute('class', 'pin');
      el.setAttribute('transform', `translate(${q.x.toFixed(1)} ${q.y.toFixed(1)})`);
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `Stop ${K.pad2(i)}, ${s.place}: open details`);
      const left = mode === 'tall' && i === 1;
      el.innerHTML = `<g class="pin-in"><circle class="p-pulse" r="22"/><circle class="p-dot" r="15"/><text class="p-n" y="4.5" text-anchor="middle">${K.pad2(i)}</text><text class="p-l" x="${left ? -26 : 26}" y="5" text-anchor="${left ? 'end' : 'start'}">${esc(s.place)}</text></g>`;
      el.addEventListener('click', () => openSheet(i));
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSheet(i); } });
      pinsG.appendChild(el);
      const inner = el.firstElementChild;
      return { el, inner, shown: null };
    });
    const end = g.next[g.next.length - 1];
    nextPin = document.createElementNS(K.NS, 'g');
    nextPin.setAttribute('class', 'next-pin');
    nextPin.setAttribute('transform', `translate(${end[0]} ${end[1]})`);
    nextPin.innerHTML = `<circle r="16"/><text x="${mode === 'wide' ? 26 : -24}" y="5" text-anchor="${mode === 'wide' ? 'start' : 'end'}">${esc(R.next.label)}: ${esc(co || R.next.default_company)}</text>`;
    pinsG.appendChild(nextPin);
    pins.forEach((p) => gsap.set(p.inner, { scale: 0, transformOrigin: '50% 50%' }));
    gsap.set(nextPin, { opacity: 0 });
    paint(prog, true);
    layoutLeader();
  }

  /* intro: a thin preview line runs the whole way, then the thick line reaches stop 01 */
  const intro = { pre: reduced ? 1 : 0, r: reduced ? 1 : 0 };
  const startR = () => at[1] || 0.1;

  function lerpLL(r) {
    let k = at.findIndex((f) => f > r);
    if (k < 0) return stops[stops.length - 1].ll;
    if (k === 0) return origin;
    const a = at[k - 1], b = at[k], t = (r - a) / Math.max(1e-6, b - a);
    const A = stops[k - 1].ll, B = stops[k].ll;
    return { lat: A.lat + (B.lat - A.lat) * t, lon: A.lon + (B.lon - A.lon) * t };
  }
  const coordEls = $$('[data-coords]'), latEl = $('[data-lat]'), posName = $('#pos-name');
  function setCoords(ll, name) {
    const s = K.coords(ll.lat, ll.lon);
    coordEls.forEach((e) => (e.textContent = s));
    if (latEl) latEl.textContent = s.split(' ')[0];
    if (name && posName) posName.textContent = name;
  }

  const heroIn = $('#hero-in'), stop1 = $('#stop1'), strip = $('#strip'), routeIn = $('#route-in'), hud = $('#hud'), leader = $('#leader');
  const clamp = (v) => Math.max(0, Math.min(1, v));
  let active = -1;

  function paint(p, force) {
    prog = p;
    const heroOut = clamp(p / 0.07), rIn = clamp((p - 0.05) / 0.06);
    heroIn.style.opacity = String(1 - heroOut);
    heroIn.style.transform = `translateY(${-60 * heroOut}px)`;
    heroIn.style.visibility = heroOut >= 1 ? 'hidden' : 'visible';
    stop1.style.opacity = String(1 - heroOut);
    stop1.style.transform = `translateY(${40 * heroOut}px)`;
    stop1.style.visibility = heroOut >= 1 ? 'hidden' : 'visible';
    strip.style.opacity = String(1 - heroOut);
    strip.style.visibility = heroOut >= 1 ? 'hidden' : 'visible';
    leader.style.opacity = String(1 - Math.min(1, heroOut * 2));
    routeIn.style.opacity = String(rIn);
    routeIn.style.visibility = rIn > 0 ? 'visible' : 'hidden';
    hud.style.opacity = String(rIn);
    if (!L) return;
    const sr = startR();
    const routeR = sr + (1 - sr) * clamp((p - 0.11) / 0.8);
    const r = p <= 0.11 ? Math.min(intro.r, sr) : routeR;
    line.style.strokeDashoffset = String(L * (1 - r));
    glow.style.strokeDashoffset = String(L * (1 - r));
    prev.style.strokeDashoffset = String(L * (1 - intro.pre));
    const q = line.getPointAtLength(L * r);
    truck.setAttribute('transform', `translate(${q.x.toFixed(1)} ${q.y.toFixed(1)})`);
    truck.style.opacity = p > 0.11 && r < 0.999 ? '1' : '0';
    bar.style.transform = `scaleX(${clamp((p - 0.11) / 0.8)})`;
    let last = -1;
    pins.forEach((pn, i) => {
      const on = r >= at[i] - 0.012;
      if (on) last = i;
      if (on !== pn.shown || force) {
        pn.shown = on;
        if (reduced) gsap.set(pn.inner, { scale: on ? 1 : 0 });
        else gsap.to(pn.inner, { scale: on ? 1 : 0, duration: on ? 0.55 : 0.25, ease: on ? 'back.out(2.6)' : 'power2.in', overwrite: 'auto' });
        if (cardEls[i] && !reduced) gsap.to(cardEls[i], { opacity: on ? 1 : 0.25, x: on ? 0 : -26, duration: on ? 0.6 : 0.25, ease: 'power3.out', overwrite: 'auto' });
        else if (cardEls[i]) cardEls[i].style.opacity = on ? '1' : '.35';
      }
    });
    const nOn = r >= 0.999;
    if (nextPin && nOn !== nextPin._on) { nextPin._on = nOn; gsap.to(nextPin, { opacity: nOn ? 1 : 0, duration: 0.4 }); next.style.opacity = nOn ? '.85' : '0'; }
    if (last !== active) {
      active = last;
      cardEls.forEach((c, i) => c.classList.toggle('is-active', i === last));
      pins.forEach((pn, i) => pn.el.classList.toggle('is-on', i === last));
    }
    if (p > 0.004 || scrolled) { scrolled = true; const ll = p <= 0.11 ? stops[Math.min(1, last < 0 ? 0 : last)].ll : lerpLL(r); setCoords(ll, stops[Math.max(0, last)].place + (last >= 0 ? ', ' + stops[last].where.split(',')[0] : '')); }
  }
  let scrolled = false;

  build();
  addEventListener('resize', () => { build(); });
  next.style.opacity = '0';

  if (!reduced) {
    const o = { lat: 0, lon: 0 };
    setCoords(o);
    gsap.to(o, { lat: origin.lat, lon: origin.lon, duration: 2.2, delay: 0.7, ease: 'power3.out', onUpdate: () => { if (!scrolled) setCoords(o); } });
    gsap.to(intro, { pre: 1, duration: 2.4, delay: 0.6, ease: 'power2.inOut', onUpdate: () => paint(prog) });
    gsap.to(intro, { r: 1, duration: 1.6, delay: 1.6, ease: 'power3.out', onUpdate: () => paint(prog) });
  } else setCoords(origin, `${stops[0].place}, ${stops[0].where}`);
  $('#pos-name').textContent = `${stops[0].place}, ${stops[0].where.split(',')[0]}`;

  ScrollTrigger.create({ trigger: '#trip', start: 'top top', end: 'bottom bottom', onUpdate: (st) => { paint(st.progress); K.navSolid && K.navSolid(); } });

  /* pointer moves the map a little: parallax by layer */
  if (fine && !reduced) {
    const mb = () => svg.querySelector('.map-base');
    const mx = { x: 0, y: 0 }, tgt = { x: 0, y: 0 };
    $('.trip-stage').addEventListener('pointermove', (e) => { tgt.x = (e.clientX / innerWidth - 0.5) * -18; tgt.y = (e.clientY / innerHeight - 0.5) * -12; });
    gsap.ticker.add(() => { mx.x += (tgt.x - mx.x) * 0.06; mx.y += (tgt.y - mx.y) * 0.06; const b = mb(); if (b) b.setAttribute('transform', `translate(${mx.x.toFixed(2)} ${mx.y.toFixed(2)})`); });
  }

  /* leader line from the stop 01 card to its pin */
  function layoutLeader() {
    const pin = pins[1];
    if (!pin || mode !== 'wide') return;
    const st = $('.trip-stage').getBoundingClientRect();
    leader.setAttribute('viewBox', `0 0 ${st.width} ${st.height}`);
    const pr = pin.el.getBoundingClientRect(), cr = stop1.getBoundingClientRect();
    const pxp = pr.left + pr.width / 2 - st.left, pyp = pr.top + pr.height / 2 - st.top;
    const sx = cr.left - st.left, sy = cr.top - st.top + 42;
    $('#leader-p').setAttribute('d', `M${sx} ${sy}H${pxp + 60}L${pxp + 18} ${pyp}`);
    $('#leader-c').setAttribute('cx', sx); $('#leader-c').setAttribute('cy', sy);
  }
  setTimeout(layoutLeader, 400);
  if (document.fonts) document.fonts.ready.then(layoutLeader);

  /* the clip: plays while the hero is on screen; a hairline shows its time */
  const clip = $('#clip'), clipBar = $('#clip-bar');
  if (!reduced) {
    new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting && prog < 0.08) clip.play().catch(() => {}); else clip.pause(); }), { threshold: 0.2 }).observe(stop1);
    gsap.ticker.add(() => { if (clip.duration) clipBar.style.transform = `scaleX(${clip.currentTime / clip.duration})`; });
    ScrollTrigger.create({ trigger: '#trip', start: 'top top', end: 'bottom bottom', onUpdate: (st) => { if (st.progress > 0.08) clip.pause(); else if (clip.paused) clip.play().catch(() => {}); } });
  }

  /* ---------- stop sheet (tour-style card) ---------- */
  const sheet = $('#sheet');
  const journeyByYear = (ys) => d.journey.filter((j) => ys.includes(j.year));
  const projBySlug = Object.fromEntries(d.projects.map((x) => [x.slug, x]));
  function openSheet(i) {
    const s = stops[i];
    const ps = s.projects.map((sl) => projBySlug[sl]).filter(Boolean);
    const otif = s.id === 'bhosari' && d.progress ? (() => {
      const g = d.progress, sc = (v) => ((v - g.scale_min) / (g.scale_max - g.scale_min)) * 100;
      return `<div class="otif"><span class="lab">${esc(g.title)}</span><div class="otif-bar"><i style="left:${sc(g.from)}%;width:${sc(g.to) - sc(g.from)}%"></i>${g.milestones.map((m) => `<span style="left:${sc(m.at)}%">${m.at}${esc(g.unit)}</span>`).join('')}</div><div class="otif-scale lab">${g.milestones.map((m) => `<span>${esc(m.label)}: ${esc(m.note)}</span>`).join('')}</div></div>`;
    })() : '';
    sheet.innerHTML = `<button class="sheet-close" type="button" aria-label="Close">&times;</button><div class="sheet-grid">
  <figure class="sheet-media" style="margin:0">${s.image ? `<div class="ph"><img src="${K.media(s.image)}" alt="${esc(s.caption || '')}" /></div><figcaption>${esc(s.caption || '')}</figcaption>` : `<div class="logo-only"><img src="${K.media(s.logo)}" alt="${esc(s.where)} logo" /></div>`}<span class="sheet-badge lab">Stop ${K.pad2(i)}</span></figure>
  <div class="sheet-body">
    <p class="crumbs lab"><span>Route</span><span>/</span><span>${esc(s.place)}</span><span>/</span><span>${esc(K.coords(s.ll.lat, s.ll.lon))}</span></p>
    <h3 id="sheet-h">${esc(s.where)}</h3>
    <ul class="facts"><li><span class="lab">Years</span><b>${esc(s.years)}</b></li><li><span class="lab">From Larchmont Falls</span><b>${s.km.toLocaleString('en-IN')} km</b></li></ul>
    <p>${esc(s.role)}</p>
    <div class="sheet-metric"><b>${esc(s.metric[0])}</b><span>${esc(s.metric[1])}</span></div>
    ${otif}
    ${journeyByYear(s.journey).length ? `<ol class="itin">${journeyByYear(s.journey).map((j) => `<li><span class="lab">${esc(j.year)}</span><div><h4>${esc(j.title)}</h4><p>${esc(j.detail)}</p></div></li>`).join('')}</ol>` : ''}
    ${s.sheet ? `<p class="lab" style="color:var(--ink-mute)">${esc(s.sheet)}</p>` : ''}
    ${ps.length ? `<ol class="itin">${ps.map((x) => `<li><span class="lab">${esc(x.year)}</span><div><h4>${esc(x.title)}</h4><p>${esc(x.result)}</p></div></li>`).join('')}</ol>` : ''}
    <div class="sheet-links">${ps.filter((x) => x.has_page).map((x) => `<a class="btn or" href="${K.link('order-' + x.slug + '.html')}">Open the order page<span class="arrow" aria-hidden="true">&rarr;</span></a>`).join('')}<button class="btn line" type="button" data-close>Back to the map</button></div>
  </div></div>`;
    K.photos(sheet);
    sheet.querySelectorAll('.sheet-close,[data-close]').forEach((b) => b.addEventListener('click', () => sheet.close()));
    K.lenis && K.lenis.stop();
    sheet.showModal();
    if (!reduced) gsap.fromTo(sheet, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' });
  }
  sheet.addEventListener('close', () => K.lenis && K.lenis.start());
  sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.close(); });

  /* ---------- 02 work orders ---------- */
  $('#wgrid').innerHTML = d.projects.map((x, i) => K.orderCard(x, i, { wide: i === 0, delay: (i % 4) * 0.08 })).join('');

  /* ---------- 03 why ---------- */
  const why = [
    { n: 2, u: 'yrs', h: 'In supply planning at Pinewick', t: d.pitch.why_hire[0] },
    { n: 30, u: 's', h: 'Off the bottleneck station', t: d.pitch.why_hire[1] },
    { n: 20, u: '%', h: 'Less time per pick', t: d.pitch.why_hire[2] },
  ];
  $('#why-p').textContent = d.values.join(' ');
  $('#why-list').innerHTML = why.map((w, i) => `<li data-reveal data-rd="${i * 0.06}"><b class="why-n"><span data-count="${w.n}">${w.n}</span><small>${w.u}</small></b><div><h3>${esc(w.h)}</h3><p>${esc(w.t)}</p></div></li>`).join('');

  /* ---------- 04 plan your route ---------- */
  if (d.picker) {
    $('#plan-intro').textContent = d.picker.intro;
    Picker.init(d.picker, { svg: $('#floor'), items: $('#pl-items'), layout: $('#pl-layout'), batch: $('#pl-batch'), batchL: $('#pl-batch-l'), count: $('#pl-count'), m: $('#o-m'), t: $('#o-t'), alt: $('#o-alt'), altLabel: $('#o-alt-l'), note: $('#pl-note'), how: $('#plan-how'), legend: $('#floor-legend'), floorT: $('#floor-t') });
  } else $('#plan').remove();

  /* ---------- 05 people on the route: loading-dock shutter swap ---------- */
  const shots = ['photos/candid-shopfloor.jpg', 'photos/candid-supplier-yard.jpg', 'photos/candid-darkstore.jpg'];
  const capOf = (src) => (d.media.gallery.find((g) => g.src === src) || {}).caption || '';
  const plist = $('#plist');
  plist.innerHTML = d.testimonials.map((t, i) => `<button type="button" class="prow" data-i="${i}" aria-pressed="${i === 0}"><span class="pi lab">${K.pad2(i + 1)}</span><span class="pn">${esc(t.name)}</span><span class="pr">${esc(t.role)} <em>&middot; ${esc(t.relation)}</em></span></button>`).join('');
  const pimg = $('#pimg'), slats = $$('#shutter i');
  let cur = -1;
  function person(i, now) {
    if (i === cur) return; cur = i;
    const t = d.testimonials[i], src = shots[i % shots.length];
    $$('.prow', plist).forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    const swap = () => { pimg.src = K.media(src); pimg.alt = capOf(src); $('#pq').textContent = t.quote; $('#pwho').textContent = `${t.name}, ${t.role}`; $('#pwhere').textContent = `Photo: ${capOf(src)}`; };
    if (now || reduced) { swap(); return; }
    gsap.timeline({ overwrite: true })
      .set(slats, { transformOrigin: '50% 0%' })
      .to(slats, { scaleY: 1, duration: 0.22, ease: 'power2.in', stagger: 0.035 })
      .add(swap)
      .set(slats, { transformOrigin: '50% 100%' })
      .to(slats, { scaleY: 0, duration: 0.32, ease: 'power3.out', stagger: { each: 0.035, from: 'end' } })
      .fromTo('.pfig figcaption', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.45 }, '<0.1');
  }
  person(0, true);
  $$('.prow', plist).forEach((b) => { const i = +b.dataset.i; b.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && person(i)); b.addEventListener('focus', () => person(i)); b.addEventListener('click', () => person(i)); });

  /* ---------- 06 kit ---------- */
  $('#stamp').textContent = `Shift starts ${d.site.shift_start}`;
  $('#kit-p').textContent = 'Now: ' + d.about.now;
  const tags = (a) => `<ul class="tags">${a.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  const kit = [
    ['Operations', tags(d.skills.Operations)],
    ['Planning and analysis', tags(d.skills['Planning and analysis'])],
    ['Tools', `<ul class="tools">${d.tools.map((t) => `<li><img src="${K.media(t.logo)}" alt="" loading="lazy" />${esc(t.name)}</li>`).join('')}</ul>`],
    ['Certificates and awards', `<ul class="rows">${d.certifications.map((c) => `<li><b>${esc(c.name)}</b><span>${esc(c.issuer)}, ${esc(c.year)}</span></li>`).join('')}${d.wins.map((w) => `<li><b>${esc(w.title)}</b><span>${esc(w.detail.split('.')[0])}</span></li>`).join('')}</ul>`],
    ['Education', `<ul class="rows">${d.education.map((e) => `<li><b>${esc(e.degree)}, ${esc(e.school.split(' (')[0])}</b><span>${esc(e.years)}</span></li>`).join('')}</ul>`],
    ['Off shift', `<ul class="rows">${d.outside.map((o) => `<li><div><b>${esc(o.title)}</b><p>${esc(o.detail)}</p></div></li>`).join('')}</ul>`],
  ];
  $('#kit-list').innerHTML = kit.map(([t, body], i) => `<li data-reveal data-rd="${(i % 3) * 0.06}"><span class="lab">${K.pad2(i + 1)}</span><div><h3>${t}</h3>${body}</div></li>`).join('');

  /* ---------- 07 questions ---------- */
  const faqs = [
    ['When can you start?', `<p>${esc(R.next.detail)}</p>`],
    ['Which roles and cities?', `<p>${esc(P.looking_for)}.</p>`],
    ['How do you begin on a floor you do not know?', `<ul>${d.values.map((v) => `<li>${esc(v)}</li>`).join('')}</ul>`],
    ['What are you working on now?', `<p>${esc(d.about.now)}</p>`],
    ['Where did the route start?', `<p>${esc(d.about.intro)}</p>`],
  ];
  if (d.demo) faqs.push(['Is Rohan a real person?', `<p>${esc(d._note)}</p>`]);
  $('#faq-list').innerHTML = faqs.map(([q, a], i) => `<details name="faq" data-reveal${i === 0 ? ' open' : ''}><summary><span>${esc(q)}</span><i aria-hidden="true"></i></summary>${a}</details>`).join('');

  /* ---------- 08 book this trip ---------- */
  $('#b-date').textContent = P.available_from;
  $('#book-sub').textContent = `${P.current}. Looking for ${P.looking_for.charAt(0).toLowerCase() + P.looking_for.slice(1)}.`;
  if (co) { const f = $('#book-for'); f.hidden = false; f.textContent = d.pitch.for_company_template.replace(/\{company\}/g, co); $('#b-co').value = co; }
  const wa = C.whatsapp.replace(/\D/g, '');
  const direct = [
    ['Email', C.email, `mailto:${C.email}`], ['Phone', C.phone, `tel:${C.phone.replace(/\s/g, '')}`], ['WhatsApp', C.whatsapp, `https://wa.me/${wa}`],
    ['LinkedIn', C.linkedin.replace(/^https?:\/\/(www\.)?/, ''), C.linkedin], ['Calendar', C.calendly.replace(/^https?:\/\//, ''), C.calendly],
    ['Newsletter', C.substack.replace(/^https?:\/\//, ''), C.substack], ['Résumé', 'Download the PDF', C.resume_pdf],
  ];
  $('#direct').innerHTML = '<li class="wb-head lab"><span>Waybill</span><span>Consignee: '+esc(P.first_name)+' '+esc(P.last_name)+'</span></li>' + direct.map(([k, v, href]) => `<li><a href="${esc(href)}"${/^https?:/.test(href) ? ' rel="noopener" target="_blank"' : ''}><span class="lab">${k}</span><b>${esc(v)}</b><span aria-hidden="true">&rarr;</span></a></li>`).join('') + `<li><button type="button" id="print-btn"><span class="lab">Paper</span><b>Print a résumé copy</b><span aria-hidden="true">&rarr;</span></button></li>`;
  $('#print-btn').addEventListener('click', () => print());

  const chipGroup = (el, list) => {
    el.innerHTML = list.map((x, i) => `<button type="button" class="chip" aria-pressed="${i === 0}">${esc(x)}</button>`).join('');
    el.addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (!c) return; el.querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', String(b === c))); });
    return { get: () => (el.querySelector('[aria-pressed="true"]') || {}).textContent || '', set: (v) => el.querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', String(b.textContent === v))) };
  };
  const roleC = chipGroup($('#b-role'), roles), cityC = chipGroup($('#b-city'), cities);

  $('#ticket').addEventListener('submit', (e) => {
    e.preventDefault();
    roleC.set($('#t-role').value); cityC.set($('#t-city').value);
    const t = $('#book');
    if (K.lenis) K.lenis.scrollTo(t, { offset: 0 }); else t.scrollIntoView();
  });

  const form = $('#bform'), ok = $('#bok');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#b-name').value.trim(), email = $('#b-email').value.trim();
    const errs = { name: name ? '' : 'Add your name.', email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? '' : 'Add an email address that works.' };
    $$('.err', form).forEach((x) => (x.textContent = errs[x.dataset.for] || ''));
    if (errs.name || errs.email) { form.querySelector(errs.name ? '#b-name' : '#b-email').focus(); return; }
    const company = $('#b-co').value.trim();
    const subject = `Trip request: ${roleC.get()} role in ${cityC.get()}${company ? ' at ' + company : ''}`;
    const body = [`Role: ${roleC.get()}`, `City: ${cityC.get()}`, `Company: ${company || '-'}`, `From: ${name} <${email}>`, '', $('#b-note').value.trim()].join('\n');
    const ref = 'Request ' + new Date().toISOString().slice(0, 10);
    $('#b-ref').textContent = ref;
    $('#b-sum').textContent = `${roleC.get()}, ${cityC.get()}${company ? ', ' + company : ''}. Address: ${C.email}`;
    form.hidden = true; ok.hidden = false; ok.focus();
    if (!reduced) { const tick = $('#ok-tick'), l = tick.getTotalLength(); gsap.fromTo(tick, { strokeDasharray: l, strokeDashoffset: l }, { strokeDashoffset: 0, duration: 0.7, ease: 'power2.out', delay: 0.15 }); }
    location.href = `mailto:${C.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
  $('#b-again').addEventListener('click', () => { ok.hidden = true; form.hidden = false; });

  /* ---------- finish ---------- */
  K.photos();
  K.tilt();
  K.reveal();
  K.count();
  ScrollTrigger.refresh();
  if (location.hash) { const t = document.querySelector(location.hash); if (t) setTimeout(() => (K.lenis ? K.lenis.scrollTo(t, { immediate: true }) : t.scrollIntoView()), 300); }
})();
