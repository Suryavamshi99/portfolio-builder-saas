/* ==========================================================================
   home.js — renders index.html from content/portfolio.json and wires every
   section: hero plate + blueprint lens tour, pinned word reveal, pinned case
   rail, tilting device with an X-ray screen, SQL lens on the headline number,
   night-graph chart, backlog board, work index with cursor preview, scroll-
   drawn journey, tilt wins, magnifying dock, spotlight cards and contact.
   ========================================================================== */
(async function () {
  const d = await K.load();
  const { $, $$, esc, md, has } = K;
  const p = d.person, s = d.site || {}, S = s.sections || {};
  const company = K.forCompany();
  const pages = d.project_pages || {};
  const fullCases = (d.projects || []).filter((x) => x.has_page && pages[x.slug]);
  document.title = d.meta.site_title;
  if (K.reduce) document.documentElement.classList.add('reduced');
  K.boot(d, 'home');

  /* ======================= HERO ======================= */
  const hero = $('.hero');
  const nCases = fullCases.length, nProjects = (d.projects || []).length;
  $('.hero-in', hero).innerHTML = `
    <div class="hero-copy">
      <span class="eyebrow mono hero-eye">${esc(d.meta.domain.replace('-', ' '))} · ${esc(s.hero_note || '')}</span>
      <p class="hero-sub">${esc(p.headline)}.</p>
      ${company && d.pitch.for_company_template ? `<p class="hero-for">${esc(d.pitch.for_company_template.replaceAll('{company}', company))}</p>` : ''}
      <div class="hero-cta">
        <span class="mag" data-magnetic><a class="pill pill-solid" href="#work">${esc(s.hero_cta_primary || 'See the work')} <span class="arr">→</span></a></span>
        <a class="pill pill-ghost" href="#backlog">${esc(s.hero_cta_secondary || 'Prioritise my backlog')}</a>
      </div>
    </div>
    <div class="hud mono" aria-hidden="true">
      <div><span class="hud-k">Lens</span><b data-lens-xy>X 0000 Y 0000</b></div>
      <div><span class="hud-k">Layer</span><b data-lens-layer>surface</b></div>
      <div><span class="hud-k">${esc((s.city || '').toUpperCase())}</span><b data-clock>--:--:--</b> ET</div>
    </div>
    <h1 class="hero-name" aria-label="${esc(p.first_name)} ${esc(p.last_name)}"><span class="nl" data-hero-name>${esc(p.first_name)}</span><span class="nl"><em data-hero-name>${esc(p.last_name)}</em></span></h1>
    <div class="hero-strip mono">
      <span><i class="dot-live" aria-hidden="true"></i>Available ${esc(p.available_from.replace('January', 'Jan'))}</span>
      <span>${esc(s.city || '')} <b data-clock-short>--:--</b> ET</span>
      <span class="hide-s">${nProjects} projects · ${nCases} cases</span>
      <span class="hint">${K.fine ? 'Move across the frame to see underneath it' : 'Drag across the frame to see underneath it'}</span>
    </div>`;

  // Waypoints in video space (0..1, top-left). Inside the lens each becomes a labelled drawing.
  const WP = [
    { at: [0.47, 0.29], layer: 'Anika', t: 'Pilot readout', n: 'one page · one recommendation' },
    { at: [0.11, 0.25], layer: 'slide', t: 'Slide 4', n: 'pilot: failed drops 12.0% → 9.4%' },
    { at: [0.445, 0.69], layer: 'clicker', t: 'Clicker', n: 'next: roll out at the 5 pm send' },
    { at: [0.6, 0.92], layer: 'laptops', t: 'Classmates', n: 'notes: matched control zones' },
  ];
  $('.lens-notes', hero).innerHTML = WP.map((w) => `<div class="ln"><span><b>${esc(w.t)}</b>${esc(w.n)}</span></div>`).join('');

  const plateCfg = {
    src: K.reduce ? 'media/hero-classroom-poster.jpg' : 'media/hero-classroom.mp4', poster: 'media/hero-classroom-poster.jpg', breathe: !K.reduce,
    focus: [0.5, 0.5], zoom: 1, playbackRate: 0.9, crossfade: 'tail',
    // cool ink grade in the site palette; highlighter halation on the whiteboard
    contrast: 1.08, saturation: 0.74, gain: [0.9, 0.9, 0.94], lift: [0.0, 0.004, 0.012], gamma: [1.02, 1, 0.98],
    map: { shadow: '#15171c', mid: '#59606f', high: '#dcecef', amount: 0.42 },
    halation: 0.28, halationColor: '#4dc4ff', grain: 0.075, grainSize: 1.7, aberration: 0.0018, vignette: 0.5, depth: 0.016,
    lens: 'blueprint', lensRadius: 0.15, holdPoster: 3.0,
  };
  const phone = innerWidth < 720;
  const focusFor = () => (innerWidth < 720 ? [0.47, 0.5] : [0.5, 0.5]);
  if (phone) Object.assign(plateCfg, { gain: [1, 1, 1.03], contrast: 1.04, saturation: .82, map: { shadow: '#15171c', mid: '#6b7282', high: '#e4f1f4', amount: .3 }, vignette: .3, lensRadius: .12, holdPoster: 3.4 });
  plateCfg.focus = focusFor();
  let plate = null;
  const canvas = $('.plate', hero);
  const startPlate = () => {
    try {
      plate = Plate.create(canvas, Object.assign(plateCfg, { onFirstFrame: () => hero.classList.add('ready') }));
      if (!plate.webgl) document.documentElement.classList.add('no-webgl');
    } catch (e) { document.documentElement.classList.add('no-webgl'); }
  };
  // load the 11 MB plate after the first paint
  startPlate();

  // ---- lens controller (Halden: user drives fast, autopilot tours waypoints slowly) ----
  const ring = $('.lens-ring', hero), layer = $('.lens-layer', hero);
  const notes = $$('.ln', hero);
  const xy = $('[data-lens-xy]', hero), lay = $('[data-lens-layer]', hero), tag = $('.lens-tag', hero);
  const L = { x: 0, y: 0, tx: 0, ty: 0, scale: 0, tscale: 0, press: 0, lastUser: -99, wp: 0, wpT: 0, started: false };
  let W = 1, H = 1, pts = [];
  const lensPx = () => (innerWidth < 720 ? 190 : 280);
  const layout = () => {
    const r = hero.getBoundingClientRect(); W = r.width; H = r.height;
    plateCfg.focus = focusFor(); plate && plate.set({ focus: plateCfg.focus });
    pts = WP.map((w) => Plate.mapCover(w.at[0], w.at[1], W, H, 1280, 854, plateCfg.focus, 1));
    notes.forEach((n, i) => { n.style.left = pts[i][0] + 'px'; n.style.top = pts[i][1] + 'px'; });
    ring.style.setProperty('--lens', lensPx() + 'px');
  };
  new ResizeObserver(layout).observe(hero); layout();
  const usable = () => pts.map((pt, i) => [pt, i]).filter(([pt]) => pt[0] > 60 && pt[0] < W - 60 && pt[1] > 90 && pt[1] < H - 40);
  { const u = usable()[0] || [[W * .5, H * .4], 0]; L.x = L.tx = u[0][0]; L.y = L.ty = u[0][1]; }
  const onPtr = (e) => { const r = hero.getBoundingClientRect(); L.tx = e.clientX - r.left; L.ty = e.clientY - r.top; L.lastUser = performance.now() / 1000; L.tscale = 1; L.started = true; };
  hero.addEventListener('pointermove', onPtr, { passive: true });
  hero.addEventListener('pointerdown', (e) => { onPtr(e); L.press = 1; }, { passive: true });
  addEventListener('pointerup', () => { L.press = 0; }, { passive: true });
  let heroVis = true;
  new IntersectionObserver((es) => { heroVis = es[0].isIntersecting; }).observe(hero);
  const pad = (n) => String(Math.max(0, Math.round(n))).padStart(4, '0');
  let hudT = 0, lastT = performance.now(), curWp = 0;
  gsap.ticker.add(() => {
    const now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    if (!heroVis) return;
    const t = now / 1000;
    const userActive = t - L.lastUser < 3.2;
    if (!userActive && L.started && !K.reduce) {
      const u = usable();
      if (u.length) {
        if (t - L.wpT > 3.6) { L.wpT = t; L.wp = (L.wp + 1) % u.length; }
        const [pt, idx] = u[L.wp % u.length]; L.tx = pt[0]; L.ty = pt[1]; curWp = idx;
      }
    }
    const k = 1 - Math.exp(-(userActive ? 14 : 1.7) * dt);
    L.x += (L.tx - L.x) * k; L.y += (L.ty - L.y) * k;
    L.scale += (L.tscale * (1 + L.press * 0.12) - L.scale) * (1 - Math.exp(-9 * dt));
    const size = lensPx(), r = (size / 2) * L.scale;
    ring.style.transform = `translate3d(${(L.x - size / 2).toFixed(1)}px,${(L.y - size / 2).toFixed(1)}px,0) scale(${L.scale.toFixed(3)})`;
    ring.style.opacity = Math.min(1, L.scale * 1.4);
    layer.style.clipPath = `circle(${r.toFixed(1)}px at ${L.x.toFixed(1)}px ${L.y.toFixed(1)}px)`;
    if (plate) { plate.pointer((L.x / W) * 2 - 1, -((L.y / H) * 2 - 1), L.scale > 0.02 ? 1 : 0, 60); plate.set({ lensRadius: r / H }); }
    if (t - hudT > 0.1) {
      hudT = t;
      // nearest waypoint names the layer under the lens
      let best = -1, bd = 1e9; pts.forEach((pt, i) => { const dd = Math.hypot(pt[0] - L.x, pt[1] - L.y); if (dd < bd) { bd = dd; best = i; } });
      const name = bd < size * 0.6 ? WP[best].layer : 'surface';
      const txt = `X ${pad((L.x / W) * 1280)} Y ${pad((L.y / H) * 854)}`;
      xy.textContent = txt; lay.textContent = L.scale > .5 ? 'wireframe · ' + name : 'surface';
      tag.textContent = 'Underneath · ' + name;
    }
  });

  K.fit($('.hero-name', hero), innerWidth < 720 ? 0.88 : 0.9, innerWidth < 720 ? 0.3 : 0.24);

  // ---- intro choreography (~4 s, never blocks) ----
  const nameEls = $$('[data-hero-name]', hero);
  let nameDone = false;
  const subWords = K.words($('.hero-sub', hero));
  if (K.reduce) { nameEls.forEach((e) => K.decode(e)); L.started = true; L.tscale = 1; L.scale = 1; }
  else {
    nameEls.forEach((e) => K.hideDecode(e));
    const tl = gsap.timeline({ delay: 0.1 });
    tl.from('#nav', { y: -30, opacity: 0, duration: .8, ease: 'power3.out' }, 0)
      .from('.hero-eye', { y: 16, opacity: 0, duration: .7, ease: 'power3.out' }, .3)
      .from(subWords, { yPercent: 110, duration: .9, stagger: .05, ease: 'power3.out' }, .45)
      .call(() => !nameDone && K.decode(nameEls[0], { duration: phone ? 1.0 : 1.3 }), null, phone ? .2 : .4)
      .call(() => !nameDone && K.decode(nameEls[1], { duration: phone ? 1.0 : 1.2 }), null, phone ? .4 : .7)
      .from('.hero-cta > *', { y: 20, opacity: 0, duration: .7, stagger: .08, ease: 'power3.out', clearProps: 'transform' }, 1.3)
      .from('.hud > div', { x: 20, opacity: 0, duration: .6, stagger: .08 }, 1.5)
      .from('.hero-strip > span', { y: 10, opacity: 0, duration: .6, stagger: .06 }, 1.6)
      .from('.hero-reticle i', { scale: 0, opacity: 0, duration: .6, stagger: .05, ease: 'back.out(2)' }, 1.0);
    // hero beat: the blueprint scan sweeps the frame, then the lens opens on her face
    const sc = { x: -0.05 };
    tl.to(sc, { x: 1.4, duration: 2.1, ease: 'power2.inOut', onUpdate: () => plate && plate.scan(sc.x), onComplete: () => plate && plate.scan(-1) }, 1.35)
      .call(() => { L.started = true; L.tscale = 1; L.wpT = performance.now() / 1000; }, null, 2.6);
    // guarantees that do not depend on the animation clock: the name reads by 2.4 s, the lens is open by 2.8 s
    setTimeout(() => { nameDone = true; nameEls.forEach((e) => K.settleDecode(e)); }, 2400);
    setTimeout(() => { if (!L.started) { L.started = true; L.tscale = 1; L.wpT = performance.now() / 1000; } L.scale = Math.max(L.scale, .85); }, 2800);
  }

  /* ======================= MARQUEE ======================= */
  const mq = [`${p.first_name} ${p.last_name}`, ...(d.highlights || []).map((h) => `${h[0]} <em>${esc(h[1].split(' ').slice(0, 4).join(' '))}</em>`), ...((d.skills && d.skills.Product) || []).slice(0, 3)];
  $('.mq-track').innerHTML = mq.map((x) => `<span>${x.includes('<em>') ? x : esc(x)}</span>`).join('');
  K.initMarquee($('.marquee'));

  /* ======================= HOW I WORK (pinned word reveal) ======================= */
  const how = $('#how');
  if (has(d.pitch)) {
    how.innerHTML = `
      <div class="how-pin"><div class="wrap how-grid">
        <div class="how-top"><span class="eyebrow"><b>01</b> ${esc(S.how || 'How I work')}</span><div class="how-prog"><i></i></div></div>
        <div class="how-notes"></div>
        <p class="how-txt" id="how-h">${md(d.pitch.short)}</p>
      </div></div>
      <div class="wrap">
        <div class="how-why">${(d.pitch.why_hire || []).map((w, i) => `<div class="why" data-reveal><span class="mono">0${i + 1} · Why hire</span><p class="redact">${esc(w)}</p></div>`).join('')}</div>
        ${has(d.highlights) ? `<div class="stats">${d.highlights.map((h, i) => `<div class="stat"><span class="flap" data-flap="${esc(h[0])}" data-flap-delay="${i * .12}"></span><p>${esc(h[1])}</p></div>`).join('')}</div>` : ''}
      </div>`;
    // split into words (keep <mark>)
    const txt = $('.how-txt', how);
    const words = [];
    const wrap = (node) => [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((w) => { if (!w) return; if (/^\s+$/.test(w)) frag.appendChild(document.createTextNode(' ')); else { const sp = document.createElement('span'); sp.className = 'tw'; sp.textContent = w; frag.appendChild(sp); words.push(sp); } });
        n.replaceWith(frag);
      } else wrap(n);
    });
    wrap(txt);
    // margin notes anchored to their words (persona values)
    const keys = ['building', 'users', 'SQL'];
    const vals = d.values || [];
    const anchors = vals.slice(0, 3).map((v, i) => {
      const k = keys[i]; let idx = words.findIndex((w) => w.textContent.toLowerCase().includes(k.toLowerCase()));
      if (idx < 0) idx = Math.round(((i + 1) / (vals.length + 1)) * (words.length - 1));
      return idx;
    });
    const notesWrap = document.createElement('span'); notesWrap.className = 'notes-m';
    const mnotes = vals.slice(0, 3).map((v, i) => { const n = document.createElement('span'); n.className = 'mnote'; n.innerHTML = `<b>Rule ${i + 1}</b>${esc(v)}`; notesWrap.appendChild(n); return n; });
    const notesCol = $('.how-notes', how);
    const placeNotes = () => {
      if (innerWidth <= 820) { txt.appendChild(notesWrap); mnotes.forEach((n) => { n.style.top = ''; }); return; }
      notesCol.appendChild(notesWrap);
      const tr = notesCol.getBoundingClientRect();
      let prev = -999;
      mnotes.forEach((n, i) => {
        const w = words[anchors[i]].getBoundingClientRect();
        const top = Math.max(prev + 8, w.top - tr.top + 6);
        n.style.top = top + 'px'; prev = top + n.offsetHeight;
      });
    };
    // notes go in the gaps: place below the text block on the line of the anchor word
    txt.style.paddingBottom = '0';
    const marks = $$('mark', txt);
    const setP = (pr) => {
      const n = Math.round(pr * words.length * 1.08);
      words.forEach((w, i) => w.classList.toggle('on', i < n));
      marks.forEach((m) => { const first = m.querySelector('.tw'); m.classList.toggle('on', first && first.classList.contains('on')); });
      mnotes.forEach((m, i) => m.classList.toggle('on', anchors[i] < n));
      $('.how-prog i', how).style.transform = `scaleX(${pr})`;
    };
    if (K.reduce) setP(1);
    else {
      ScrollTrigger.create({ trigger: $('.how-pin', how), start: 'top top', end: '+=140%', pin: innerWidth > 820, scrub: true, onUpdate: (st) => setP(st.progress), onRefresh: placeNotes });
      if (innerWidth <= 820) ScrollTrigger.create({ trigger: txt, start: 'top 80%', end: 'bottom 35%', scrub: true, onUpdate: (st) => setP(st.progress) });
    }
    placeNotes(); addEventListener('resize', placeNotes);
    // redaction wipes on the why-hire rows (Dunefold ledger)
    $$('.redact', how).forEach((r) => new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) r.classList.add('in'); else if (e.boundingClientRect.top > 0) r.classList.remove('in'); }), { threshold: .6 }).observe(r));
  } else how.remove();

  /* ======================= CASES: pinned horizontal rail ======================= */
  const cases = $('#work');
  if (fullCases.length) {
    const builders = { 'suggested-routing-rules': Mockups.routing, slotwise: Mockups.slotwise, 'uc-reschedules': Mockups.tomorrow };
    const short = (t, n = 150) => (t.length > n ? t.slice(0, t.lastIndexOf(' ', n)) + '…' : t);
    cases.innerHTML = `
      <div class="rail">
        <div class="wrap rail-top">
          <div><span class="eyebrow"><b>02</b> Case studies · scroll to play</span><h2 class="h2" id="cases-h" data-decode>${esc(S.rail || 'Three projects')}</h2></div>
          <div class="counter" aria-hidden="true"><div class="roll"><div class="roll-in">${fullCases.map((_, i) => `<span>${String(i + 1).padStart(2, '0')}</span>`).join('')}</div></div><span class="of">/ ${String(fullCases.length).padStart(2, '0')}</span></div>
        </div>
        <div class="rail-view"><div class="track">
          ${fullCases.map((c, i) => { const pg = pages[c.slug]; const r0 = (pg.results || [])[0] || {}; const dc = (pg.decisions || [])[0] || {}; return `
          <a class="case" href="project.html?p=${c.slug}" data-cursor="view" data-cursor-label="Read case" data-wipe="${esc(c.title)}">
            <div class="case-l">
              <div class="case-meta mono"><b>${String(i + 1).padStart(2, '0')}</b><span>${esc(c.org)}</span><span>${esc(c.year)}</span><span>${esc(c.role)}</span></div>
              <h3>${esc(c.title)}</h3>
              <ol class="seq">
                <li><span class="mono">Problem</span><p>${esc(short(pg.problem))}</p></li>
                <li><span class="mono">Evidence</span><p>${esc(short((pg.what_i_did || [])[0] || ''))}</p></li>
                <li><span class="mono">Decision</span><p>${esc(dc.choice || '')}. ${esc(short(dc.why || '', 90))}</p></li>
                <li class="res"><span class="mono">Result</span><p>${esc(r0.value || '')} ${esc((r0.metric || '').toLowerCase())}</p></li>
              </ol>
              <span class="case-open mono">Read the case <span aria-hidden="true">→</span></span>
            </div>
            <div class="case-r" data-mock="${c.slug}"></div>
          </a>`; }).join('')}
          <a class="case-end" href="#index"><span class="eyebrow">${nProjects} projects in all</span><span class="h2">All the <em>work</em> ↓</span><span class="lede">Case competitions, dashboards, pricing, operations and writing.</span></a>
        </div></div>
        <div class="rail-bar"><i></i></div>
      </div>`;
    const tls = $$('.case-r', cases).map((h) => (builders[h.dataset.mock] || Mockups.routing)(h));
    const caseEls = $$('.case', cases);
    const track = $('.track', cases), view = $('.rail-view', cases), bar = $('.rail-bar i', cases), roll = $('.roll-in', cases);
    let cur = -1;
    const setCur = (i) => { if (i === cur) return; cur = i; gsap.to(roll, { yPercent: -(100 / fullCases.length) * i, duration: .7, ease: 'power3.out', overwrite: 'auto' }); };
    const local = (x) => {
      const vw = view.clientWidth;
      let best = 0, bd = 1e9;
      caseEls.forEach((c, i) => {
        const left = c.offsetLeft - x, pr = gsap.utils.clamp(0, 1, (vw * 0.92 - left) / (c.offsetWidth * 0.95));
        tls[i].progress(pr);
        $$('.seq li', c).forEach((li, k) => li.classList.toggle('on', pr > 0.12 + k * 0.2));
        const dd = Math.abs(left + c.offsetWidth / 2 - vw * .45); if (dd < bd) { bd = dd; best = i; }
      });
      setCur(best);
    };
    const dist = () => Math.max(0, track.scrollWidth - view.clientWidth);
    const mmq = gsap.matchMedia();
    mmq.add('(min-width: 821px) and (prefers-reduced-motion: no-preference)', () => {
      local(0);
      const tw = gsap.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: cases, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: .5, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: (st) => { bar.style.transform = `scaleX(${st.progress.toFixed(4)})`; local(st.progress * dist()); } } });
      return () => tw.scrollTrigger && tw.scrollTrigger.kill();
    });
    mmq.add('(max-width: 820px), (prefers-reduced-motion: reduce)', () => {
      // native overflow scroll; mockups play when a card scrolls into view
      const upd = () => { const sl = view.scrollLeft; bar.style.transform = `scaleX(${dist() ? sl / dist() : 1})`; caseEls.forEach((c, i) => { const left = c.offsetLeft - sl, vw = view.clientWidth; setCur(Math.abs(left) < vw / 2 ? i : cur); }); };
      view.addEventListener('scroll', upd, { passive: true });
      const io = new IntersectionObserver((es) => es.forEach((e) => { const i = caseEls.indexOf(e.target); if (e.isIntersecting) { K.reduce ? tls[i].progress(1) : gsap.to(tls[i], { progress: 1, duration: 3, ease: 'none' }); $$('.seq li', e.target).forEach((li) => li.classList.add('on')); } }), { threshold: .45 });
      caseEls.forEach((c) => io.observe(c));
      return () => io.disconnect();
    });
  } else cases.remove();

  /* ======================= DEVICE: container scroll + X-ray screen ======================= */
  const dev = $('#device');
  const rr = pages['suggested-routing-rules'];
  if (rr) {
    dev.innerHTML = `
      <div class="wrap device-head">
        <span class="eyebrow"><b>03</b> What customers see, and what sits behind it</span>
        <h2 class="h2" id="device-h" data-decode>Suggested <em>orders</em></h2>
        <p class="lede">${esc(rr.context)}</p>
      </div>
      <div class="device-stage">
        <div class="laptop"><div class="lt-lid"><div class="lt-scr" data-cursor="lens"></div></div><div class="lt-base"></div></div>
      </div>
      <div class="wrap device-cap mono"><span>${esc(rr.captions ? rr.captions[0] : '')}</span><span>${K.fine ? 'Sweep over the screen to reveal the query and logic behind it' : 'Drag over the screen to reveal the query'}</span></div>`;
    const scr = $('.lt-scr', dev);
    Mockups.screen(scr);
    if (!K.reduce) {
      gsap.fromTo($('.laptop', dev), { rotateX: 28, scale: .86, y: 40 }, { rotateX: 0, scale: 1, y: 0, ease: 'none', scrollTrigger: { trigger: dev, start: 'top 85%', end: 'center 55%', scrub: true } });
    }
    xray(scr, $('.scr-under', scr), $('.scr-ring', scr), [[0.62, 0.72], [0.55, 0.42], [0.3, 0.18], [0.12, 0.45]], () => (scr.clientWidth < 500 ? 70 : 120));
  } else dev.remove();

  /** DOM X-ray lens: a registered second layer seen through a circle (Halden lens, Presswork loupe) */
  function xray(host, under, ringEl, waypoints, radius) {
    const X = { x: 0, y: 0, tx: 0, ty: 0, r: 0, tr: 0, last: -99, wp: 0, wpT: 0 };
    let vis = false;
    new IntersectionObserver((es) => { vis = es[0].isIntersecting; if (vis) X.tr = 1; }, { threshold: .35 }).observe(host);
    const ptr = (e) => { const b = host.getBoundingClientRect(); X.tx = e.clientX - b.left; X.ty = e.clientY - b.top; X.last = performance.now() / 1000; X.tr = 1; };
    host.addEventListener('pointermove', ptr, { passive: true });
    host.addEventListener('pointerdown', ptr, { passive: true });
    let lt = performance.now();
    gsap.ticker.add(() => {
      const now = performance.now(), dt = Math.min(.05, (now - lt) / 1000); lt = now;
      if (!vis) return;
      const t = now / 1000, user = t - X.last < 2.6;
      const w = host.clientWidth, h = host.clientHeight;
      if (!user) {
        if (t - X.wpT > 3) { X.wpT = t; X.wp = (X.wp + 1) % waypoints.length; }
        const wp = waypoints[X.wp]; X.tx = wp[0] * w + Math.sin(t * .9) * 10; X.ty = wp[1] * h + Math.cos(t * .7) * 8;
      }
      const k = 1 - Math.exp(-(user ? 14 : 2) * dt);
      X.x += (X.tx - X.x) * k; X.y += (X.ty - X.y) * k; X.r += (X.tr - X.r) * (1 - Math.exp(-6 * dt));
      const R = radius() * X.r;
      under.style.clipPath = `circle(${R.toFixed(1)}px at ${X.x.toFixed(1)}px ${X.y.toFixed(1)}px)`;
      if (ringEl) { ringEl.style.setProperty('--r', R.toFixed(1) + 'px'); ringEl.style.transform = `translate(${X.x.toFixed(1)}px,${X.y.toFixed(1)}px)`; ringEl.style.opacity = X.r; }
    });
    if (K.reduce) { X.tr = 1; }
  }

  /* ======================= UNDER THE NUMBER: SQL lens + night graph ======================= */
  const num = $('#number');
  const ch = rr && rr.chart;
  if (rr && ch) {
    const r0 = rr.results[0];
    num.innerHTML = `
      <div class="wrap num-grid">
        <div>
          <div class="big-num" data-cursor="lens" aria-label="${esc(r0.value)} ${esc(r0.metric)}">
            <div class="bn-top" aria-hidden="true">${esc(r0.value)}</div>
            <div class="bn-under" aria-hidden="true">-- ${esc(r0.metric.toLowerCase())}, beta vs control
SELECT c.cohort,
  100 * avg(o.is_rush::int)
    FILTER (WHERE o.week &lt;= 8)  AS before_pct,
  100 * avg(o.is_rush::int)
    FILTER (WHERE o.week &gt;= 13) AS after_pct
FROM   orders o
JOIN   cohorts c USING (account_id)
GROUP  BY c.cohort;
-- beta  27.0% → 21.3%   <b>−21%</b>
-- ctrl  27.0% → 26.9%</div>
          </div>
          <p class="bn-hint mono"><i aria-hidden="true"></i>${K.fine ? 'Hover over the number to reveal its query' : 'Touch the number to reveal its query'}</p>
        </div>
        <div class="num-copy">
          <span class="eyebrow"><b>${esc(r0.metric)}</b> ${esc(r0.note)}</span>
          <h2 class="h2" id="number-h">${esc(ch.title)}</h2>
          <p class="lede">${md(rr.learned)}</p>
          <div class="graph"><svg viewBox="0 0 960 300" role="img" aria-label="${esc(ch.title)}"></svg>
            <div class="legend mono">${ch.series.map((se, i) => `<span><i class="${i ? 'c' : ''}"></i>${esc(se.name)}</span>`).join('')}</div>
            <p class="readout mono" aria-live="polite"></p></div>
          <p class="mono" style="color:var(--muted-d);margin-top:10px;text-transform:none">${esc(ch.note)}</p>
        </div>
      </div>`;
    const big = $('.big-num', num);
    xrayNumber(big, $('.bn-under', num));
    K.nightGraph($('.graph svg', num), $('.readout', num), ch);
  } else num.remove();

  function xrayNumber(host, under) {
    const X = { x: 0, y: 0, tx: 0, ty: 0, r: 0, last: -99 };
    let vis = false; new IntersectionObserver((es) => { vis = es[0].isIntersecting; }).observe(host);
    const ptr = (e) => { const b = host.getBoundingClientRect(); X.tx = e.clientX - b.left; X.ty = e.clientY - b.top; X.last = performance.now() / 1000; };
    host.addEventListener('pointermove', ptr, { passive: true }); host.addEventListener('pointerdown', ptr, { passive: true });
    let lt = performance.now();
    gsap.ticker.add(() => {
      const now = performance.now(), dt = Math.min(.05, (now - lt) / 1000); lt = now; if (!vis) return;
      const t = now / 1000, user = t - X.last < 2.4, w = host.clientWidth, h = host.clientHeight;
      if (!user) { if (K.reduce) { X.tx = X.x = w * .62; X.ty = X.y = h * .5; } else { X.tx = w * (.5 + Math.sin(t / 2.6) * .32); X.ty = h * (.5 + Math.sin(t / 3.7 + 1.2) * .28); } }
      const k = 1 - Math.exp(-(user ? 12 : 2.2) * dt);
      X.x += (X.tx - X.x) * k; X.y += (X.ty - X.y) * k;
      X.r += ((user ? 1 : .8) - X.r) * (1 - Math.exp(-5 * dt));
      under.style.clipPath = `circle(${(Math.min(w, 520) * .27 * X.r).toFixed(1)}px at ${X.x.toFixed(1)}px ${X.y.toFixed(1)}px)`;
    });
  }

  /* ======================= BACKLOG (signature) ======================= */
  if (has(d.backlog)) Backlog($('#backlog'), d.backlog); else $('#backlog').remove();

  /* ======================= WORK INDEX ======================= */
  const idx = $('#index');
  if (has(d.projects)) {
    idx.innerHTML = `
      <div class="wrap">
        <div class="sec-head"><div><span class="eyebrow"><b>05</b> Index</span><h2 class="h2" id="index-h" data-decode>${esc(S.index || 'All projects')}</h2></div><p class="lede">${esc(S.index_hint || '')}</p></div>
        <div class="rows">${d.projects.map((x, i) => {
          const head = `<span class="row-n mono">${String(i + 1).padStart(2, '0')}</span><span class="row-t" data-scramble>${esc(x.title)}</span><span class="row-k mono">${esc(x.org)}${x.has_page ? '<b>Case</b>' : ''}</span><span class="row-y mono">${esc(x.year)}</span><span class="row-ic" aria-hidden="true">${x.has_page ? '→' : '+'}</span>`;
          return `<div class="row" data-row="${i}" ${x.has_page ? '' : 'aria-expanded="false"'}>
            ${x.has_page ? `<a class="row-h" href="project.html?p=${x.slug}" data-cursor="view" data-cursor-label="Read case" data-wipe="${esc(x.title)}">${head}</a>`
              : `<button class="row-h" type="button" aria-expanded="false" aria-controls="rb-${i}" data-cursor="view" data-cursor-label="Open">${head}</button>`}
            ${x.has_page ? '' : `<div class="row-b" id="rb-${i}"><div class="row-pad"><p>${esc(x.summary)}</p><p class="res">${esc(x.result)}</p>
              <div class="row-mets">${(x.metrics || []).map((m) => `<div><b>${esc(m[0])}</b><span>${esc(m[1])}</span></div>`).join('')}</div></div>
              <div class="row-pad"><img src="${esc(x.thumbnail)}" alt="${esc(x.title)}" loading="lazy" /></div></div>`}
          </div>`; }).join('')}</div>
      </div>`;
    // accordion for rows without a full page
    $$('button.row-h', idx).forEach((b) => b.addEventListener('click', () => {
      const row = b.closest('.row'), body = $('.row-b', row), open = b.getAttribute('aria-expanded') !== 'true';
      b.setAttribute('aria-expanded', String(open)); row.setAttribute('aria-expanded', String(open));
      gsap.to(body, { height: open ? 'auto' : 0, duration: K.reduce ? 0 : .7, ease: 'expo.out', onComplete: () => ScrollTrigger.refresh() });
    }));
    // cursor-following preview with lerp and velocity tilt (Kai work index)
    if (K.fine && !K.reduce) {
      const pv = $('.index-preview'), pin = $('.ip-in', pv);
      pin.innerHTML = d.projects.map((x) => `<img src="${esc(x.thumbnail)}" alt="" loading="lazy" />`).join('');
      const imgs = $$('img', pin);
      const P = { x: innerWidth / 2, y: innerHeight / 2, tx: 0, ty: 0, vx: 0, on: 0, ton: 0 };
      addEventListener('pointermove', (e) => { P.tx = e.clientX; P.ty = e.clientY; }, { passive: true });
      $$('.row', idx).forEach((row) => {
        row.addEventListener('pointerenter', () => { P.ton = 1; imgs.forEach((im, i) => im.classList.toggle('on', i === +row.dataset.row)); });
        row.addEventListener('pointerleave', () => { P.ton = 0; });
      });
      gsap.ticker.add(() => {
        const px = P.x; P.x += (P.tx - P.x) * .14; P.y += (P.ty - P.y) * .14; P.vx += ((P.x - px) - P.vx) * .2;
        P.on += (P.ton - P.on) * .15;
        if (P.on < .005 && !P.ton) { pv.style.opacity = 0; return; }
        pv.style.opacity = P.on;
        pv.style.transform = `translate(${P.x + 40}px, ${P.y - 120}px) translate(0,0) rotate(${gsap.utils.clamp(-12, 12, P.vx * .6)}deg) scale(${.6 + P.on * .4})`;
      });
    }
  } else idx.remove();

  /* ======================= JOURNEY: scroll-drawn path ======================= */
  const jr = $('#journey');
  if (has(d.journey) || has(d.about)) {
    jr.innerHTML = `
      <div class="wrap jr-grid">
        <div class="jr-photo">
          <div class="shutter"><img src="${esc(s.about_photo || d.media.candids[0])}" alt="${esc((d.media.gallery.find((g) => g.src === s.about_photo) || {}).caption || p.first_name)}" loading="lazy" /><div class="slats" aria-hidden="true">${'<i></i>'.repeat(6)}</div></div>
          <p class="jr-cap mono"><span>${esc(s.photo_note || '')}</span><span>Fig. 02</span></p>
        </div>
        <div>
          <span class="eyebrow"><b>06</b> ${esc(S.journey || 'About')}</span>
          <h2 class="h2" id="journey-h" data-decode>From Dunmore Heath to <em>product</em></h2>
          <p class="jr-intro">${esc(d.about.intro)}</p>
          <p class="jr-now">${esc(d.about.now)}</p>
          <div class="path"><svg aria-hidden="true" preserveAspectRatio="none"><line class="bg" x1="7" x2="7" y1="0" y2="100%"/><line class="fg" x1="7" x2="7" y1="0" y2="100%"/></svg>
            ${(d.journey || []).map((j) => `<div class="stop"><span class="mono">${esc(j.year)}</span><h3>${esc(j.title)}</h3><p>${esc(j.detail)}</p></div>`).join('')}
          </div>
        </div>
      </div>`;
    const path = $('.path', jr), fg = $('.fg', jr), stops = $$('.stop', jr);
    const setPath = (pr) => {
      const hgt = path.clientHeight; fg.setAttribute('y2', (pr * hgt).toFixed(1));
      stops.forEach((st) => st.classList.toggle('on', st.offsetTop <= pr * hgt + 8));
    };
    if (K.reduce) setPath(1);
    else ScrollTrigger.create({ trigger: path, start: 'top 70%', end: 'bottom 60%', scrub: .4, onUpdate: (st) => setPath(st.progress) });
    K.shutter($('.shutter', jr));
  } else jr.remove();

  /* ======================= EXPERIENCE + EDUCATION ======================= */
  const cv = $('#cv');
  if (has(d.experience) || has(d.education)) {
    cv.innerHTML = `<div class="wrap cv-grid">
      ${has(d.experience) ? `<div><h2>${esc(S.experience || 'Experience')}</h2>${d.experience.map((x) => `<div class="spec" data-reveal><span class="logo"><img src="${esc(x.logo)}" alt="${esc(x.org)} logo" loading="lazy" /></span><div><h3>${esc(x.role)}</h3><span class="mono">${esc(x.org)} · ${esc(x.place)} · ${esc(x.dates)}</span><ul>${(x.points || []).map((pt) => `<li>${esc(pt)}</li>`).join('')}</ul></div></div>`).join('')}</div>` : ''}
      ${has(d.education) ? `<div><h2>${esc(S.education || 'Education')}</h2>${d.education.map((x) => `<div class="spec edu" data-reveal data-yr="${esc(String(x.years).split(/[–-]/).pop().trim())}"><span class="logo"><img src="${esc(x.logo)}" alt="${esc(x.school)} logo" loading="lazy" /></span><div><h3>${esc(x.school)}</h3><span class="mono">${esc(x.degree)}</span><dl><dt>Years</dt><dt>Result</dt><dt></dt><dd>${esc(x.years)}</dd><dd>${esc(x.notes)}</dd><dd></dd></dl></div></div>`).join('')}</div>` : ''}
    </div>`;
  } else cv.remove();

  /* ======================= WINS: tilt + glare ======================= */
  const wins = $('#wins');
  if (has(d.wins)) {
    wins.innerHTML = `<div class="wrap"><div class="sec-head"><div><span class="eyebrow"><b>07</b> ${esc(S.wins || 'Wins')}</span><h2 class="h2" id="wins-h" data-decode>On the <em>record</em></h2></div></div>
      <div class="win-grid">${d.wins.map((w) => `<figure class="win" data-tilt data-reveal><img src="${esc(w.image)}" alt="${esc(w.title)}" loading="lazy" /><span class="glare" aria-hidden="true"></span><figcaption><h3>${esc(w.title)}</h3><p>${esc(w.detail)}</p></figcaption></figure>`).join('')}</div></div>`;
    K.initTilt(wins);
  } else wins.remove();

  /* ======================= SKILLS: magnifying dock ======================= */
  const sk = $('#skills');
  if (has(d.skills) || has(d.tools)) {
    sk.innerHTML = `<div class="wrap">
      <div class="sec-head"><div><span class="eyebrow"><b>08</b> ${esc(S.skills || 'Skills and tools')}</span><h2 class="h2" id="skills-h" data-decode>The <em>toolkit</em></h2></div></div>
      ${has(d.tools) ? `<div class="dock" role="list">${d.tools.map((t) => `<span class="dock-i" role="listitem" tabindex="0"><img src="${esc(t.logo)}" alt="${esc(t.name)}" loading="lazy" /><span>${esc(t.name)}</span></span>`).join('')}</div>` : ''}
      <div class="sheet">
      <div class="sheet-tb mono" aria-hidden="true"><span>Sheet 08</span><span>Toolkit · ${esc(p.first_name)} ${esc(p.last_name)}</span><span>Drawn ${new Date().getFullYear()}</span><span>Scale 1:1</span></div>
      <div class="sk-grid">
        ${Object.entries(d.skills || {}).map(([g, list]) => `<div class="sk" data-reveal><h3>${esc(g)}</h3><ul>${list.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}
        ${has(d.certifications) ? `<div class="sk cert" data-reveal><h3>Certifications</h3><ul>${d.certifications.map((c) => `<li>${esc(c.name)}<span>${esc(c.issuer)} · ${esc(c.year)}</span></li>`).join('')}</ul></div>` : ''}
      </div></div></div>`;
    const dock = $('.dock', sk);
    if (dock && K.fine && !K.reduce) {
      const icons = $$('.dock-i', dock);
      const qs = icons.map((ic) => gsap.quickTo(ic, 'scale', { duration: .3, ease: 'power3' }));
      dock.addEventListener('pointermove', (e) => icons.forEach((ic, i) => { const r = ic.getBoundingClientRect(); const dd = Math.abs(e.clientX - (r.left + r.width / 2)); qs[i](1 + .7 * Math.max(0, 1 - dd / 130)); }));
      dock.addEventListener('pointerleave', () => qs.forEach((q) => q(1)));
    }
  } else sk.remove();

  /* ======================= PEOPLE: outside work + testimonials ======================= */
  const ppl = $('#people');
  if (has(d.outside) || has(d.testimonials)) {
    ppl.innerHTML = `<div class="wrap">
      ${has(d.outside) ? `<div class="sec-head"><div><span class="eyebrow"><b>09</b> ${esc(S.outside || 'Outside work')}</span><h2 class="h2" data-decode>Mornings and <em>Sundays</em></h2></div></div>
      <div class="out-grid">${d.outside.map((o) => `<article class="spot out" data-reveal><img src="${esc(o.image)}" alt="${esc(o.title)}" loading="lazy" /><div><h3>${esc(o.title)}</h3><p>${esc(o.detail)}</p></div></article>`).join('')}</div>` : ''}
      ${has(d.testimonials) ? `<div class="sec-head"><div><span class="eyebrow"><b>10</b> ${esc(S.testimonials || 'What people say')}</span><h2 class="h2" data-decode>In their <em>words</em></h2></div></div>
      <figure class="spot tq" data-reveal>
        <span class="tq-mark" aria-hidden="true">“</span>
        <blockquote class="tq-q" aria-live="polite"></blockquote>
        <figcaption class="tq-who"></figcaption>
        <div class="tq-tabs" role="tablist" aria-label="Choose a testimonial">${d.testimonials.map((t, k) => `<button type="button" role="tab" aria-selected="${k === 0}" data-t="${k}"><b>${esc(t.name)}</b><span>${esc(t.relation)}</span><i aria-hidden="true"></i></button>`).join('')}</div>
      </figure>` : ''}
    </div>`;
    $$('.out-grid, .tq', ppl).forEach(K.initSpotlight);
    const tq = $('.tq', ppl);
    if (tq) {
      // one large quote, switched by name, auto-advancing every 7 s
      let cur = -1, timer = null; const T = d.testimonials, tabs = $$('.tq-tabs button', tq);
      const show = (k) => {
        if (k === cur) return; cur = k;
        const q = $('.tq-q', tq); q.textContent = T[k].quote; const ws = K.words(q);
        $('.tq-who', tq).innerHTML = `<b>${esc(T[k].name)}</b> · ${esc(T[k].role)}`;
        tabs.forEach((b, i) => b.setAttribute('aria-selected', String(i === k)));
        if (!K.reduce) {
          gsap.from(ws, { yPercent: 110, duration: .8, stagger: .025, ease: 'power3.out' });
          gsap.fromTo(tabs[k].querySelector('i'), { scaleX: 0 }, { scaleX: 1, duration: 7, ease: 'none' });
        }
      };
      const auto = () => { clearInterval(timer); if (!K.reduce) timer = setInterval(() => show((cur + 1) % T.length), 7000); };
      tabs.forEach((b, i) => b.addEventListener('click', () => { show(i); auto(); }));
      show(0); auto();
    }
  } else ppl.remove();

  /* ======================= CONTACT ======================= */
  const ct = $('#contact'), c = d.contact;
  const [user, dom] = c.email.split('@');
  ct.innerHTML = `<div class="wrap">
    <span class="eyebrow"><b>11</b> ${esc(S.contact || 'Get in touch')}</span>
    <h2 class="ct-title" id="contact-h">${esc(s.contact_title || 'Get in touch').replace(/(PM)/, '<em>$1</em>')}</h2>
    ${company ? `<p class="ct-for">${esc(d.pitch.for_company_template.replaceAll('{company}', company))}</p>` : `<p class="ct-for">${esc(s.contact_line || '')}</p>`}
    <span class="mag" data-magnetic="0.18" style="display:block"><button type="button" class="email" data-copy="${esc(c.email)}" data-cursor="view" data-cursor-label="Copy">${esc(user)}<span class="at">@</span><wbr>${esc(dom)}</button></span>
    <p class="copy-st mono"><span class="flap" data-copy-state></span></p>
    <div class="ct-grid">
      <ul class="ct-list">
        <li><span class="mono">Phone</span><a href="tel:${esc(c.phone.replace(/\s/g, ''))}">${esc(c.phone)}</a></li>
        ${c.whatsapp ? `<li><span class="mono">WhatsApp</span><a href="https://wa.me/${esc(c.whatsapp.replace(/\D/g, ''))}" target="_blank" rel="noopener">${esc(c.whatsapp)}</a></li>` : ''}
        <li><span class="mono">LinkedIn</span><a href="${esc(c.linkedin)}" target="_blank" rel="noopener">linkedin.com/in/…</a></li>
        ${c.substack ? `<li><span class="mono">Newsletter</span><a href="${esc(c.substack)}" target="_blank" rel="noopener">Sunday Teardowns</a></li>` : ''}
        <li><span class="mono">Resume</span><a href="${esc(c.resume_pdf)}" target="_blank" rel="noopener">Download PDF ↓</a></li>
        <li><span class="mono">Based in</span><span>${esc(p.location)}</span></li>
      </ul>
      <div class="book">
        <h3>${esc(s.booking_title || 'Book a call')}</h3>
        <p>${esc(s.booking_detail || '')}</p>
        <div class="days" role="group" aria-label="Pick a day"></div>
        <div class="slots" role="group" aria-label="Pick a time (ET)"></div>
        <div class="book-go"><a class="pill pill-solid sm" href="${esc(c.calendly)}" target="_blank" rel="noopener" data-book>Open my calendar <span class="arr">→</span></a><span class="mono" data-pick></span></div>
      </div>
    </div></div>`;
  const stEl = $('[data-copy-state]', ct);
  K.flap(stEl, K.fine ? 'CLICK TO COPY' : 'TAP TO COPY', { instant: true });
  $('.email', ct).addEventListener('click', async (e) => {
    const ok = await K.copy(c.email);
    K.flap(stEl, ok ? 'COPIED' : 'COPY FAILED', { flips: 4 });
    K.burst(e.clientX || innerWidth / 2, e.clientY || innerHeight / 2, { n: 16 });
    setTimeout(() => K.flap(stEl, K.fine ? 'CLICK TO COPY' : 'TAP TO COPY', { flips: 3 }), 2600);
  });
  // slot picker: next five weekdays in ET
  const days = [], now = new Date();
  for (let i = 1; days.length < 5 && i < 12; i++) { const dt = new Date(now.getTime() + i * 864e5); const wd = dt.getDay(); if (wd && wd < 6) days.push(dt); }
  const fmtD = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/New_York' });
  const SLOTS = ['10:30', '14:00', '17:30'];
  let pickD = 0, pickS = null;
  const dWrap = $('.days', ct), sWrap = $('.slots', ct), pickOut = $('[data-pick]', ct);
  const drawBook = () => {
    dWrap.innerHTML = days.map((dt, i) => { const [wd, dd] = fmtD.format(dt).split(' '); return `<button type="button" aria-pressed="${i === pickD}" data-d="${i}"><span>${esc(wd.replace(',', ''))}</span><b>${esc(dd)}</b></button>`; }).join('');
    sWrap.innerHTML = SLOTS.map((t) => `<button type="button" aria-pressed="${t === pickS}" data-s="${t}">${t} ET</button>`).join('');
    pickOut.textContent = pickS ? `${fmtD.format(days[pickD])} · ${pickS} ET · 20 min` : 'Pick a day and a time';
  };
  drawBook();
  dWrap.addEventListener('click', (e) => { const b = e.target.closest('[data-d]'); if (!b) return; pickD = +b.dataset.d; drawBook(); gsap.from(sWrap.children, { y: 10, opacity: 0, stagger: .05, duration: .4 }); });
  sWrap.addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (!b) return; pickS = b.dataset.s; drawBook(); const r = b.getBoundingClientRect(); K.burst(r.left + r.width / 2, r.top, { n: 10, spread: 40 }); });

  /* ======================= PRINT RESUME ======================= */
  const pr = $('#print-resume');
  pr.innerHTML = `<h1>${esc(p.first_name)} ${esc(p.last_name)}</h1>
    <p class="pr-contact">${esc(c.email)} · ${esc(c.phone)} · ${esc(p.location)} · ${esc(c.linkedin)}</p>
    <p>${esc(K.plain(d.pitch.short))}</p>
    <h2>Experience</h2>${d.experience.map((x) => `<div class="pr-item"><b>${esc(x.role)}</b>, ${esc(x.org)}, ${esc(x.place)} (${esc(x.dates)})<ul>${x.points.map((pt) => `<li>${esc(pt)}</li>`).join('')}</ul></div>`).join('')}
    <h2>Education</h2>${d.education.map((x) => `<div class="pr-item"><b>${esc(x.school)}</b>, ${esc(x.degree)} (${esc(x.years)}). ${esc(x.notes)}</div>`).join('')}
    <h2>Selected projects</h2>${fullCases.map((x) => `<div class="pr-item"><b>${esc(x.title)}</b> (${esc(x.org)}, ${esc(x.year)}). ${esc(x.result)}.</div>`).join('')}
    <h2>Skills</h2>${Object.entries(d.skills).map(([g, l]) => `<div class="pr-item"><b>${esc(g)}:</b> ${l.map(esc).join(', ')}</div>`).join('')}`;

  /* ======================= BOOT ======================= */
  K.initDecode(document.querySelector('main'));
  K.initScramble(document);
  K.initMagnetic(document);
  K.initReveal();
  K.initFlaps();
  // deep link (e.g. index.html#backlog from a project page)
  if (location.hash && location.hash.length > 1) { const tg = $(location.hash); tg && setTimeout(() => K.scrollTo(tg, { immediate: true }), 300); }
  addEventListener('load', () => ScrollTrigger.refresh());
  document.fonts && document.fonts.ready.then(() => ScrollTrigger.refresh());
})();
