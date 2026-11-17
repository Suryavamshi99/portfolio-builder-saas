/* ==========================================================================
   app.js — index.html. Renders every section from content/portfolio.json
   (a section hides itself when its key is missing) and wires the immersion:
   hero plate + ink, live brand word, stickers, film strip, reel rail,
   the Brief-me press, before/after, cases preview, meet, wins, flips, notes.
   ========================================================================== */
(async function () {
  const { esc, $, $$, RM, FINE } = K;
  let D;
  try { D = await (await fetch('content/portfolio.json')).json(); } catch (e) { console.error('content failed', e); return; }
  const P = D.person || {}, C = D.contact || {}, S = D.sections || {};
  const projBySlug = Object.fromEntries((D.projects || []).map((p) => [p.slug, p]));
  const media = (p) => 'media/' + p;
  const hide = (id) => { const el = document.getElementById(id); if (el) el.hidden = true; };

  /* ---------- meta ---------- */
  if (D.meta) {
    document.title = D.meta.site_title || document.title;
    $('meta[name="description"]').content = D.meta.description || '';
    if (D.meta.noindex === false) $('meta[name="robots"]').remove();
  }

  /* ---------- the riso image: two inks, misregistered, with a loupe ---------- */
  const riso = (src, alt = '', cls = '') => `<div class="riso ${cls} ${/^projects\//.test(src) ? 'riso-light' : ''}" data-loupe><span class="ra"><img src="${esc(media(src))}" alt="${esc(alt)}" loading="lazy" decoding="async"></span><span class="rb" aria-hidden="true"><img src="${esc(media(src))}" alt="" loading="lazy" decoding="async"></span><span class="rl" aria-hidden="true"><img src="${esc(media(src))}" alt="" loading="lazy" decoding="async"></span></div>`;
  function loupes(root = document) {
    if (!FINE || RM) return;
    $$('[data-loupe]', root).forEach((el) => {
      let raf = 0;
      el.addEventListener('pointermove', (e) => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const r = el.getBoundingClientRect(); el.style.setProperty('--lx', e.clientX - r.left + 'px'); el.style.setProperty('--ly', e.clientY - r.top + 'px'); }); });
      el.addEventListener('pointerenter', () => el.classList.add('looking'));
      el.addEventListener('pointerleave', () => el.classList.remove('looking'));
    });
  }

  /* ================================ HERO ================================ */
  const H = D.hero || {};
  const params = new URLSearchParams(location.search);
  const forCo = (params.get('for') || '').replace(/[^\p{L}\p{N} &'.\-]/gu, '').trim().slice(0, 24);
  let brand = forCo || H.default_word || 'Your brand';
  $('#hero-role').textContent = (P.first_name ? P.first_name + ' ' + (P.last_name || '') + ' · ' : '') + 'brand & growth';
  $('#hl-before').innerHTML = (H.line_before || '').split(' ').map((w) => `<span class="w-mask"><span class="w">${esc(w)}</span></span>`).join(' ');
  $('#hl-after').innerHTML = (H.line_after || '').split(' ').map((w) => `<span class="w-mask"><span class="w">${esc(w)}</span></span>`).join(' ') + (H.line_accent ? ` <span class="w-mask"><span class="w accent">${esc(H.line_accent)}</span></span>` : '');
  $('#headline').setAttribute('aria-label', `${H.line_before} ${brand} ${H.line_after} ${H.line_accent || ''}`);
  $('#brand-label').textContent = H.input_label || 'Type your brand';
  const input = $('#brand-input'); input.placeholder = H.input_placeholder || ''; input.value = forCo;
  $('#presets').innerHTML = (H.presets || []).map((p) => `<button type="button" class="chip chip-sm" data-word="${esc(p)}">${esc(p)}</button>`).join('');
  if (forCo && D.pitch?.for_company_template) { const f = $('#hero-for'); f.textContent = D.pitch.for_company_template.replaceAll('{company}', forCo); f.hidden = false; }
  const inkName = $('#ink-name'); const paintInk = () => { if (inkName) inkName.textContent = K.theme().name; }; paintInk(); document.addEventListener('theme', paintInk);

  // ---- the live brand word: Roboto Flex, fitted to its box, axes on the pointer ----
  const word = $('#hl-word'), wrap = $('.hl-word-wrap');
  let chars = [], fit = 1;
  const BASE = 200;
  function setWord(w) {
    brand = (w || '').trim() || H.default_word || 'Your brand';
    const parts = brand.toUpperCase().split(' ');
    // Blotter's line solver: one line, or two lines split near the middle, whichever sets bigger
    const box = wrap.getBoundingClientRect();
    let lines = [parts.join(' ')];
    if (parts.length > 1 && box.width / box.height < 3.2) {
      let best = 1, bestD = 1e9; const total = brand.length;
      for (let i = 1; i < parts.length; i++) { const a = parts.slice(0, i).join(' ').length; const d = Math.abs(total / 2 - a); if (d < bestD) { bestD = d; best = i; } }
      lines = [parts.slice(0, best).join(' '), parts.slice(best).join(' ')];
    }
    word.innerHTML = lines.map((l) => `<span class="hw-line">${[...l].map((c) => `<span class="ch">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('')}</span>`).join('');
    chars = $$('.ch', word).map((el, i) => ({ el, i, w: 400, x: 0, y: 0 }));
    $('#headline').setAttribute('aria-label', `${H.line_before} ${brand} ${H.line_after} ${H.line_accent || ''}`);
    measure();
    document.dispatchEvent(new CustomEvent('brand', { detail: brand }));
  }
  function measure() {
    word.style.transform = 'none';
    const box = wrap.getBoundingClientRect(); const r = word.getBoundingClientRect();
    fit = Math.min(box.width / r.width, box.height / r.height);
    word.style.transform = `translate(-50%,-50%) scale(${fit})`;
    chars.forEach((c) => { const q = c.el.getBoundingClientRect(); c.x = q.left + q.width / 2 - box.left; c.y = q.top + q.height / 2 - box.top; });
  }
  setWord(brand);
  document.fonts.ready.then(measure);
  addEventListener('resize', () => setWord(brand));
  input.addEventListener('input', () => setWord(input.value));
  $('#presets').addEventListener('click', (e) => { const b = e.target.closest('[data-word]'); if (!b) return; input.value = b.dataset.word; setWord(b.dataset.word); if (!RM) gsap.fromTo('.ch', { yPercent: -60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .7, ease: 'bounce.out', stagger: .03 }); });

  // pointer drives the axes: wdth from x across the hero, wght per letter by distance (Ada's weight maths)
  const hero = $('#hero'); let hp = { x: -1e4, y: -1e4, nx: .5, ny: .5, last: -1e9 };
  hero.addEventListener('pointermove', (e) => { const b = wrap.getBoundingClientRect(); const hr = hero.getBoundingClientRect(); hp.x = e.clientX - b.left; hp.y = e.clientY - b.top; hp.nx = (e.clientX - hr.left) / hr.width; hp.ny = (e.clientY - hr.top) / hr.height; hp.last = performance.now(); }, { passive: true });
  let wdth = 100;
  function axes(t, dt) {
    if (RM || !chars.length) return;
    const idle = performance.now() - hp.last > 2400;
    const tw = idle ? 100 + 38 * Math.sin(t * .45) : 40 + hp.nx * 110; wdth += (tw - wdth) * (1 - Math.exp(-4 * dt));
    const R = 1.25 * BASE * fit;
    for (const c of chars) {
      let w;
      if (idle) w = .5 + .5 * Math.sin(t * .85 - c.i * .62);
      else { const d = Math.hypot(hp.x - c.x, hp.y - c.y) / R; const s = Math.max(0, 1 - d); w = s * s * (3 - 2 * s); }
      const target = 260 + 740 * w; const rate = target > c.w ? 14 : 2.2;
      c.w += (target - c.w) * (1 - Math.exp(-rate * dt));
      c.el.style.fontVariationSettings = `"wght" ${c.w.toFixed(0)}, "wdth" ${wdth.toFixed(1)}`;
    }
    // keep the word filling its box as the axes change it
    const r = word.offsetWidth, h = word.offsetHeight; const box = wrap.clientWidth, bh = wrap.clientHeight;
    const nf = Math.min(box / r, bh / h); fit += (nf - fit) * .2;
    word.style.transform = `translate(-50%,-50%) scale(${fit.toFixed(4)})`;
  }

  // ---- the plate and the ink ----
  const isPortrait = () => innerWidth / innerHeight < 1;
  const plateCanvas = $('.plate', hero);
  const fb = $('.plate-fallback', hero); fb.style.backgroundImage = `url(media/video/hero-creator-poster.jpg)`;
  let passes = 1;
  // phones: zoom in on Zubin and keep him behind the headline; desktop: he sits right of the copy
  // the shoot clip: Zubin's face sits about x .52–.61, y .2 from the top of the frame
  const frameFor = () => (isPortrait() ? { focus: [.52, .49], zoom: 1 } : { focus: [.45, .5], zoom: 1 });
  const plateOpts = {
    video: 'media/video/hero-creator.mp4', poster: 'media/video/hero-creator-poster.jpg', theme: K.theme, pointerEl: hero, introPass: !RM,
    ...frameFor(), depth: .014, rest: [.0045, -.0022],
    fade: () => (isPortrait() ? { dir: [0, -1], off: 1, a: .02, b: .1, amt: .9 } : { dir: [1, 0], off: 0, a: .18, b: .56, amt: .88 }),
    onPass: () => { passes++; $('#passN').textContent = String(passes).padStart(2, '0'); },
  };
  const plate = Press.RisoPlate(plateCanvas, plateOpts);
  addEventListener('resize', () => Object.assign(plateOpts, frameFor()));
  if (plate.webgl) { plate.onFirstFrame = () => hero.classList.add('ready'); } else hero.classList.add('no-gl');
  const ink = Press.InkField($('canvas.ink'), K.theme, () => { const r = hero.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight ? r : null; });
  // ambient blobs orbit the brand word
  const amb = { cx: 0, cy: 0, ax: 0, ay: 0, visible: true, scale: 0 }; Press.Blobs.ambient = amb;
  const updAmb = () => {
    // phones: Zubin's face is printed above the brand word; the lens rests on it, so he shows in full colour and the word stays clear
    if (isPortrait()) { const hr = hero.getBoundingClientRect(); amb.cx = hr.left + hr.width * .7; amb.cy = hr.top + hr.height * .175; amb.ax = hr.width * .04; amb.ay = hr.height * .01; amb.size = .62; amb.visible = hr.bottom > 0 && hr.top < innerHeight; return; }
    const b = wrap.getBoundingClientRect(); amb.cx = b.left + b.width / 2; amb.cy = b.top + b.height / 2; amb.ax = b.width * (isPortrait() ? .62 : .43); amb.ay = isPortrait() ? b.height * .3 : Math.max(innerHeight * .08, b.height * .45); amb.size = isPortrait() ? .5 : 1; amb.visible = b.bottom > 0 && b.top < innerHeight; };
  // misregistration: drag the print
  let drag = null; const MX = .035, MY = .012;
  hero.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || e.target.closest('a,button,input,.sticker,.tester,label')) return;
    drag = { x: e.clientX, y: e.clientY, ox: plate.off.x, oy: plate.off.y, id: e.pointerId }; hero.classList.add('dragging');
    try { hero.setPointerCapture(e.pointerId); } catch (er) {}
  });
  hero.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return; const r = hero.getBoundingClientRect();
    plate.hold(Math.max(-MX, Math.min(MX, drag.ox + (e.clientX - drag.x) / r.width * .11)), Math.max(-MY, Math.min(MY, drag.oy - (e.clientY - drag.y) / r.height * .05)));
  });
  const endDrag = () => { if (!drag) return; drag = null; hero.classList.remove('dragging'); plate.hold(null); };
  hero.addEventListener('pointerup', endDrag); hero.addEventListener('pointercancel', endDrag);
  // readouts: misregistration in mm, views since arrival, lens tag
  const misRead = $('#mis-read'), root = document.documentElement.style, lensTag = $('.lens-tag'), viewsEl = $('#views-live');
  const t0 = performance.now(); const VPS = 4.8e6 / (28 * 86400); let lastViews = -1;
  const mm = (v) => (v >= 0 ? '+' : '−') + Math.abs(v * 120).toFixed(1);
  let lastMis = '';
  gsap.ticker.add((tt, dms) => {
    const now = performance.now(), dt = Math.min(.05, dms / 1000), t = (now - t0) / 1000;
    if (hero.getBoundingClientRect().bottom > 0) { updAmb(); axes(t, dt); }
    else amb.visible = false;
    plate.scroll = Math.max(0, Math.min(1, scrollY / Math.max(1, hero.offsetHeight)));
    plate.frame(now, dt);
    if (ink) ink.frame(t, dt);
    const s = `↔ ${mm(plate.off.x)}  ↕ ${mm(plate.off.y)} mm`; if (s !== lastMis) { lastMis = s; misRead.textContent = s; root.setProperty('--mx', (plate.off.x * 330).toFixed(2) + 'px'); root.setProperty('--my', (-plate.off.y * 330).toFixed(2) + 'px'); }
    const v = Math.floor(t * VPS); if (v !== lastViews) { lastViews = v; viewsEl.textContent = v.toLocaleString('en-IN'); }
    const B = Press.Blobs;
    if (B.enabled && (B.active || now - B.lastMove > 3000) && amb.visible) { lensTag.style.opacity = '1'; lensTag.style.transform = `translate3d(${(B.hx * innerHeight + 54).toFixed(0)}px, ${(B.hy * innerHeight - hero.getBoundingClientRect().top + 40).toFixed(0)}px,0)`; }
    else lensTag.style.opacity = '0';
  });

  // ---- stickers: throwable, with gravity and spin (Scruff & Co.) ----
  let stT = 0, obsCache = [], obsT = 0;
  const stEl = $('#stickers'); const bodies = [];
  (H.stickers || []).filter((s, i) => i !== 3).slice(0, isPortrait() ? 3 : 4).forEach((s, i) => {
    const b = document.createElement('div'); b.className = `sticker st-${s.shape || 'circle'} st-${i % 3}`; b.tabIndex = 0; b.setAttribute('role', 'button');
    b.setAttribute('aria-label', `${s.big} ${s.small}. Drag to throw, or press Enter to bounce it.`);
    b.innerHTML = `<b>${esc(s.big)}</b><small>${esc(s.small)}</small>`; stEl.appendChild(b);
    bodies.push({ el: b, x: 0, y: -400, vx: 0, vy: 0, a: 0, w: 0, r: 60, live: false, drag: false, hist: [], spawn: 2.1 + i * .17, i });
  });
  function stickerSize() { const hr = hero.getBoundingClientRect(); bodies.forEach((b) => { b.r = b.el.offsetWidth / 2; }); return hr; }
  let hr = stickerSize(); addEventListener('resize', () => { hr = stickerSize(); });
  const floor = () => hero.clientHeight - (isPortrait() ? 54 : 46);
  bodies.forEach((b, i) => { const W = hero.clientWidth; const L = isPortrait() ? 0 : Math.min(W * .6, (obstacles()[0]?.r || W * .5) + 20); b.x = isPortrait() ? W * (.1 + .16 * i) : L + (W - L) * (i + .5) / bodies.length; b.a = (Math.random() - .5) * .8; b.vx = 0; b.w = (i % 2 ? 1 : -1) * (1.2 + (i % 3) * .6); });
  if (isPortrait()) queueMicrotask(() => { const o = obstacles(); const tb = o.length ? Math.max(...o.map((q) => q.b)) : hero.clientHeight * .7; bodies.forEach((b, i) => { b.r = b.el.offsetWidth / 2; b.y = tb + b.r + 4 - i * 6; b.vx = 0; }); });
  function obstacles() {
    const now = performance.now(); if (now - obsT < 250) return obsCache; obsT = now;
    const hr2 = hero.getBoundingClientRect();
    obsCache = $$('.tester, .hero-for:not([hidden])', hero).map((el) => { const r = el.getBoundingClientRect(); return { l: r.left - hr2.left, r: r.right - hr2.left, t: isPortrait() ? r.top - hr2.top : -400, b: isPortrait() ? r.bottom - hr2.top : hero.clientHeight }; });
    // phones: Zubin's face sits in the right of the tray, so stickers keep to the left
    if (isPortrait() && obsCache.length) obsCache.push({ l: hero.clientWidth * .58, r: hero.clientWidth + 200, t: obsCache[0].b + 6, b: hero.clientHeight + 200 });
    return obsCache;
  }
  function stStep(dt) {
    const W = hero.clientWidth, F = floor();
    const obs = obstacles();
    for (const b of bodies) {
      if (!b.live) continue;
      if (b.drag) { b.vx = (b.tx - b.x) * 22; b.vy = (b.ty - b.y) * 22; b.w *= .9; }
      else { b.vy += 2600 * dt; b.vx *= 1 - .05 * dt; b.w *= 1 - .6 * dt; }
      b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.w * dt;
      if (b.y + b.r > F) { b.y = F - b.r; if (b.vy > 0) { b.vy *= -.42; b.w += b.vx * .004; b.vx *= .8; if (Math.abs(b.vy) < 40) b.vy = 0; } b.w *= .9; }
      if (b.x - b.r < 8) { b.x = 8 + b.r; b.vx = Math.abs(b.vx) * .6; }
      if (b.x + b.r > W - 8) { b.x = W - 8 - b.r; b.vx = -Math.abs(b.vx) * .6; }
      // the type field is solid: stickers bounce off it instead of covering it
      for (const o of obs) {
        const cx = Math.max(o.l, Math.min(b.x, o.r)), cy = Math.max(o.t, Math.min(b.y, o.b)); const dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy);
        if (d < b.r * .92) { const nx = d ? dx / d : 0, ny = d ? dy / d : -1; const pen = b.r * .92 - d; b.x += nx * pen; b.y += ny * pen; const vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= 1.45 * vn * nx; b.vy -= 1.45 * vn * ny; } }
      }
    }
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], c = bodies[j]; if (!a.live || !c.live) continue;
      const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy), m = (a.r + c.r) * .9; if (d >= m || d === 0) continue;
      const nx = dx / d, ny = dy / d, o = m - d; const ia = a.drag ? 0 : 1, ic = c.drag ? 0 : 1, s = ia + ic || 1;
      a.x -= nx * o * ia / s; a.y -= ny * o * ia / s; c.x += nx * o * ic / s; c.y += ny * o * ic / s;
      const rv = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny; if (rv < 0) { const j2 = -1.4 * rv / s; a.vx -= j2 * nx * ia; a.vy -= j2 * ny * ia; c.vx += j2 * nx * ic; c.vy += j2 * ny * ic; a.w -= j2 * .004; c.w += j2 * .004; }
    }
  }
  const stDraw = () => bodies.forEach((b) => { if (b.live) b.el.style.transform = `translate3d(${(b.x - b.r).toFixed(1)}px,${(b.y - b.r).toFixed(1)}px,0) rotate(${b.a.toFixed(3)}rad)`; });
  if (RM) {
    bodies.forEach((b, i) => { b.live = true; b.y = floor() - b.r; b.x = hero.clientWidth * (.55 + i * .09); b.a = (i % 2 ? .12 : -.1); b.el.style.opacity = 1; }); stDraw();
  } else {
    gsap.ticker.add((tt, dms) => {
      const dt = Math.min(.033, dms / 1000); stT += dt;
      bodies.forEach((b) => { if (!b.live && stT >= b.spawn) { b.live = true; b.el.style.opacity = 1; } });
      if (hero.getBoundingClientRect().bottom < 0) return;
      for (let k = 0; k < 3; k++) stStep(dt / 3); stDraw();
    });
  }
  let held = null;
  stEl.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.sticker'); if (!el) return; const b = bodies.find((q) => q.el === el); if (!b || !b.live) return;
    e.preventDefault(); e.stopPropagation(); el.setPointerCapture(e.pointerId);
    const r = hero.getBoundingClientRect(); held = { b, ox: b.x - (e.clientX - r.left), oy: b.y - (e.clientY - r.top), id: e.pointerId, moved: 0 };
    b.drag = true; b.tx = b.x; b.ty = b.y; b.hist = [{ x: e.clientX, y: e.clientY, t: performance.now() }]; el.classList.add('held');
  });
  stEl.addEventListener('pointermove', (e) => {
    if (!held || e.pointerId !== held.id) return; const r = hero.getBoundingClientRect(); const b = held.b;
    b.tx = Math.max(b.r, Math.min(hero.clientWidth - b.r, e.clientX - r.left + held.ox)); b.ty = Math.min(floor() - b.r, e.clientY - r.top + held.oy);
    held.moved += Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0); b.hist.push({ x: e.clientX, y: e.clientY, t: performance.now() }); if (b.hist.length > 6) b.hist.shift();
  });
  const release = (e) => {
    if (!held || e.pointerId !== held.id) return; const b = held.b; b.drag = false; b.el.classList.remove('held');
    const now = performance.now(), h = b.hist.filter((q) => now - q.t < 120);
    if (h.length >= 2 && held.moved > 6) { const a = h[0], z = h[h.length - 1], w = Math.max(.016, (z.t - a.t) / 1000); b.vx = Math.max(-3600, Math.min(3600, (z.x - a.x) / w)); b.vy = Math.max(-3600, Math.min(3600, (z.y - a.y) / w)); b.w = b.vx / 900; }
    else { b.vy = -950; b.vx = (Math.random() - .5) * 500; b.w = (Math.random() - .5) * 12; }
    held = null;
  };
  stEl.addEventListener('pointerup', release); stEl.addEventListener('pointercancel', release);
  stEl.addEventListener('keydown', (e) => { if (e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); const b = bodies.find((q) => q.el === e.target); if (!b) return; b.vy = -1100; b.vx = (Math.random() - .5) * 700; b.w = (Math.random() - .5) * 14; if (RM) { b.y = floor() - b.r; stDraw(); } });

  // ---- intro: ink flood (shader) → plate prints → headline slams → stickers drop ----
  document.body.classList.remove('is-loading');
  if (!RM) {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('.nav', { yPercent: -120, duration: .8 }, .1)
      .from('.eyebrow', { y: 20, opacity: 0, duration: .6 }, .3)
      .from('#hl-before .w', { yPercent: 115, scale: 1.6, rotate: () => gsap.utils.random(-8, 8), duration: .7, ease: 'back.out(2.2)', stagger: .08 }, .45)
      .from('.ch', { yPercent: -90, opacity: 0, duration: .9, ease: 'bounce.out', stagger: .045 }, .85)
      .from('#hl-after .w', { yPercent: 115, scale: 1.6, rotate: () => gsap.utils.random(-8, 8), duration: .7, ease: 'back.out(2.2)', stagger: .07 }, 1.3)
      .from('.tester', { y: 26, opacity: 0, duration: .7 }, 1.75)
      .from('.hero-foot, .hero-hud', { opacity: 0, duration: .8 }, 2.0)
      .to(amb, { scale: 1, duration: 1.4, ease: 'power2.out' }, 2.6)
      .from('.accent', { '--u': 0, duration: .9, ease: 'power2.inOut' }, 2.4);
  } else amb.scale = 1;

  /* ============================== MARQUEE ============================== */
  const stats = D.stats_strip || [];
  const brands = ['Pinewick Paper & Print', 'Kettleby Pantry', 'Millbrook School of Management', 'Greenlane Brand Challenge', 'Millrace Awards', 'Shopfront Sundays', 'Copy That'];
  if (stats.length) {
    $('#mq1 .mq-track').innerHTML = stats.map((s) => `<span class="mq-item"><b>${esc(s.value)}</b> ${esc(s.label)}</span><i class="mq-star" aria-hidden="true">✺</i>`).join('');
    $('#mq2 .mq-track').innerHTML = brands.map((b) => `<span class="mq-item mq-brand">${esc(b)}</span><i class="mq-star" aria-hidden="true">●</i>`).join('');
    K.marquee($('#mq1')); K.marquee($('#mq2'), true);
  } else hide('mq1');

  /* =============================== PITCH =============================== */
  if (D.pitch?.short) {
    $('#pitch-text').innerHTML = D.pitch.short.split(' ').map((w) => `<span class="pw">${esc(w)}</span>`).join(' ');
    $('#why').innerHTML = (D.pitch.why_hire || []).map((w, i) => `<li data-reveal data-reveal-delay="${i * .08}"><span class="mono">0${i + 1}</span><p>${esc(w)}</p></li>`).join('');
    if (!RM) {
      gsap.fromTo('.pw', { opacity: .12 }, { opacity: 1, stagger: .05, ease: 'none', scrollTrigger: { trigger: '#pitch', start: 'top 70%', end: 'bottom 75%', scrub: .6 } });
    }
  } else hide('pitch');

  /* ============================= FILM STRIP ============================= */
  const F = D.film; const pp = D.project_pages || {};
  if (F && pp[F.project]) {
    const page = pp[F.project], proj = projBySlug[F.project] || {};
    $('#film-org').textContent = `${proj.org || ''} · ${proj.year || ''}`;
    $('#film-h').textContent = F.title;
    const pick = (path) => { const [k, i] = path.split('.'); const v = page[k]; if (i != null) { const x = v[+i]; return typeof x === 'string' ? x : `${x.choice}. ${x.why}`; } if (k === 'results') return v.map((r) => `${r.value} ${r.metric.toLowerCase()} (${r.note})`).join(' · '); return v; };
    $('#film-strip').innerHTML = F.beats.map((b, i) => `<figure class="frame" data-i="${i}"><div class="frame-in">${b.image ? riso(b.image, b.label) : `<div class="poster"><b>${esc(b.poster[0])}</b><span>${esc(b.poster[1])}</span></div>`}<span class="frame-no mono">${String(i + 1).padStart(2, '0')}</span></div></figure>`).join('');
    $('#film-beats').innerHTML = F.beats.map((b, i) => `<div class="beat" data-i="${i}"><p class="mono">Beat ${String(i + 1).padStart(2, '0')}</p><h3>${esc(b.label)}</h3><p>${esc(pick(b.from))}</p></div>`).join('');
    const frames = $$('.frame'), beats = $$('.beat'), n = frames.length;
    const setFilm = (p) => {
      const f = p * (n - 1); const strip = $('#film-strip'); const fw = frames[0].offsetWidth + parseFloat(getComputedStyle(strip).columnGap || 0);
      strip.style.transform = `translate3d(${-f * fw}px,0,0)`;
      frames.forEach((fr, i) => { const d = Math.abs(i - f); fr.style.setProperty('--d', Math.min(1, d).toFixed(3)); fr.style.setProperty('--fm', (Math.min(2, d) * 10).toFixed(2) + 'px'); });
      const a = Math.round(f); beats.forEach((b, i) => b.classList.toggle('on', i === a));
      $('#film-bar').style.transform = `scaleX(${p})`; $('#film-count').textContent = `${String(a + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
    };
    setFilm(0);
    if (!RM) ScrollTrigger.create({ trigger: '#film', start: 'top top', end: () => '+=' + innerHeight * 3.2, pin: '.film-pin', scrub: .6, anticipatePin: 1, invalidateOnRefresh: true, onUpdate: (s) => setFilm(s.progress) });
    else $('#film').classList.add('static');
  } else hide('film');

  /* ============================== THE REEL ============================== */
  const projects = D.projects || [];
  if (projects.length) {
    $('#reel-h').textContent = S.work || 'Work';
    $('#reel-t').textContent = String(projects.length).padStart(2, '0');
    $('#reel-track').innerHTML = projects.map((p, i) => {
      const href = p.has_page ? `project.html?p=${encodeURIComponent(p.slug)}` : null;
      const tag = href ? 'a' : 'article';
      return `<${tag} class="phone" ${href ? `href="${href}"` : ''} data-cursor="view" data-cursor-label="${href ? 'Watch' : 'Look'}" style="--i:${i}">
        <div class="ph-top"><img class="ph-av" src="${media(D.media?.headshot || 'photos/headshot.jpg')}" alt="" loading="lazy"><span><b>zubin.makes</b><small>${esc(p.org)} · ${esc(p.year)}</small></span><em class="mono">${esc(p.type)}</em></div>
        <div class="ph-media">${riso(p.thumbnail, p.title)}<span class="ph-n mono">${String(i + 1).padStart(2, '0')}</span></div>
        <div class="ph-act" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 21s-7-4.4-9.3-8.6C1 8.9 3 5 6.6 5c2.1 0 3.6 1.2 5.4 3.2C13.8 6.2 15.3 5 17.4 5 21 5 23 8.9 21.3 12.4 19 16.6 12 21 12 21z"/></svg><svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg><svg viewBox="0 0 24 24"><path d="M3 11l18-8-6 18-3-8z"/></svg></div>
        <p class="ph-res"><b data-flap="${esc((p.metrics?.[0]?.[0]) || '')}"></b> ${esc(p.metrics?.[0]?.[1] || '')}</p>
        <p class="ph-cap"><b>${esc(p.title)}</b> ${esc(p.result)}</p>
        <p class="ph-tags">${(p.tags || []).map((t) => '#' + esc(t.replace(/\s+/g, ''))).join(' ')}</p>
        ${href ? '<span class="ph-cta mono">Read the case →</span>' : ''}
      </${tag}>`;
    }).join('');
    const track = $('#reel-track'), phones = $$('.phone', track);
    const mm2 = gsap.matchMedia();
    mm2.add('(min-width: 821px) and (prefers-reduced-motion: no-preference)', () => {
      let lastP = 0, vel = 0;
      const st = gsap.to(track, { x: () => -(track.scrollWidth - innerWidth + 48), ease: 'none', scrollTrigger: { trigger: '#reel', start: 'top top', end: () => '+=' + (track.scrollWidth - innerWidth + 48), pin: '.reel-pin', scrub: .5, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: (s) => { $('#reel-bar').style.transform = `scaleX(${s.progress})`; $('#reel-n').textContent = String(Math.min(phones.length, 1 + Math.round(s.progress * (phones.length - 1)))).padStart(2, '0'); vel = s.getVelocity(); } } });
      // phones lean with scroll velocity
      const lean = () => { const v = Math.max(-1, Math.min(1, vel / 2500)); vel *= .9; phones.forEach((p, i) => p.style.setProperty('--lean', (v * (8 + (i % 3) * 3)).toFixed(2) + 'deg')); };
      gsap.ticker.add(lean);
      return () => gsap.ticker.remove(lean);
    });
    K.flapOnView(track);
  } else hide('reel');

  /* ============================== BRIEF ME ============================== */
  const BM = D.brief_me;
  if (BM) {
    $('#brief-h').textContent = BM.title; $('#brief-intro').textContent = BM.intro; $('#budget-label').textContent = BM.budget.label;
    const st = { goal: BM.goals[1]?.id || BM.goals[0].id, budget: BM.budget.default, ch: new Set([BM.channels[0].id]), printed: 0 };
    $('#goal-chips').innerHTML = BM.goals.map((g) => `<button type="button" class="chip" role="radio" data-goal="${g.id}" aria-checked="${g.id === st.goal}">${esc(g.label)}</button>`).join('');
    $('#chan-chips').innerHTML = BM.channels.map((c) => `<button type="button" class="chip" data-ch="${c.id}" aria-pressed="${st.ch.has(c.id)}">${esc(c.label)}</button>`).join('');
    const rng = $('#budget'); rng.min = BM.budget.min; rng.max = BM.budget.max; rng.value = st.budget;
    const fmtL = (v) => `₹${(+v).toFixed(v < 10 && v % 1 ? 1 : 0)} lakh`;
    const out = $('#budget-out'); out.textContent = fmtL(st.budget);
    const paintRange = () => rng.style.setProperty('--p', ((rng.value - rng.min) / (rng.max - rng.min) * 100) + '%'); paintRange();
    let reTimer = 0;
    const changed = () => { if (st.printed) { clearTimeout(reTimer); reTimer = setTimeout(() => run(true), 650); $('#brief-note').textContent = 'Reprinting with your changes…'; } };
    $('#goal-chips').addEventListener('click', (e) => { const b = e.target.closest('[data-goal]'); if (!b) return; st.goal = b.dataset.goal; $$('[data-goal]').forEach((x) => x.setAttribute('aria-checked', String(x === b))); wiggle(b); changed(); });
    $('#goal-chips').addEventListener('keydown', (e) => { const bs = $$('[data-goal]'); const i = bs.indexOf(document.activeElement); const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d || i < 0) return; e.preventDefault(); const n = bs[(i + d + bs.length) % bs.length]; n.focus(); n.click(); });
    $('#chan-chips').addEventListener('click', (e) => { const b = e.target.closest('[data-ch]'); if (!b) return; const id = b.dataset.ch; if (st.ch.has(id) && st.ch.size > 1) st.ch.delete(id); else st.ch.add(id); $$('[data-ch]').forEach((x) => x.setAttribute('aria-pressed', String(st.ch.has(x.dataset.ch)))); wiggle(b); changed(); });
    rng.addEventListener('input', () => { st.budget = +rng.value; out.textContent = fmtL(st.budget); paintRange(); changed(); });
    function wiggle(el) { if (!RM) gsap.fromTo(el, { rotation: -4 }, { rotation: 0, duration: .5, ease: 'elastic.out(1.2,.35)' }); }

    function plan() {
      const goal = BM.goals.find((g) => g.id === st.goal);
      let best = null, bs = -1e9;
      for (const c of BM.cases) {
        const ov = c.channels.filter((x) => st.ch.has(x)).length;
        const inR = st.budget >= c.budget[0] && st.budget <= c.budget[1];
        const s = (c.goals[st.goal] || 0) * 3 + ov * 2 + (inR ? 2 : -Math.min(Math.abs(st.budget - c.budget[0]), Math.abs(st.budget - c.budget[1])) / 20);
        if (s > bs) { bs = s; best = c; }
      }
      const proj = projBySlug[best.slug] || {}; const band = BM.bands.find((b) => st.budget <= b.max) || BM.bands[BM.bands.length - 1];
      const held = st.budget * BM.holdback.share, live = st.budget - held;
      const chans = BM.channels.filter((c) => st.ch.has(c.id)); const wsum = chans.reduce((a, c) => a + (c.id === 'creators' ? 1.4 : 1), 0);
      const split = chans.map((c) => ({ label: c.label, v: live * (c.id === 'creators' ? 1.4 : 1) / wsum }));
      return { goal, best, proj, band, held, live, split };
    }
    const sheet = $('#sheet'); let no = 0;
    function sheetHTML(p, layer) {
      const L = (v) => `₹${v < 10 ? v.toFixed(1) : Math.round(v)}L`;
      return `<div class="sh-layer sh-${layer}">
        <header class="sh-head"><span class="mono">Campaign sketch No. ${String(no).padStart(3, '0')}</span><span class="mono">${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span></header>
        <h3 class="sh-title"><span class="sh-brand">${esc(brand)}</span> <em>× Zubin</em></h3>
        <p class="sh-goal mono">${esc(p.goal.label)} · ${esc(L(+st.budget))} over eight weeks · ${[...st.ch].length} channel${st.ch.size > 1 ? 's' : ''}</p>
        <div class="sh-grid">
          <div class="sh-cell sh-case"><p class="mono">Closest past case</p><p class="sh-big">${esc(p.proj.title || p.best.slug)}</p><p class="sh-small">${esc(p.proj.result || '')}</p><i class="hi"></i></div>
          <div class="sh-cell"><p class="mono">Format I'd lead with</p><p>${esc(p.best.format)}</p></div>
          <div class="sh-cell sh-metric"><p class="mono">The number I'd watch</p><p class="sh-big">${esc(p.goal.metric)}</p><p class="sh-small">${esc(p.goal.metric_why)}</p><i class="circ"></i></div>
          <div class="sh-cell sh-budget"><p class="mono">Budget split</p>
            <div class="bar"><span class="bar-live" style="flex:${p.live}"><b>${L(p.live)}</b> live now</span><span class="bar-held" style="flex:${p.held}"><b>${L(p.held)}</b> held 72 h</span></div>
            <ul class="split">${p.split.map((s) => `<li><span>${esc(s.label)}</span><b>${L(s.v)}</b></li>`).join('')}</ul>
            <p class="sh-small">${Math.round(BM.holdback.share * 100)}% ${esc(BM.holdback.text)}. ${esc(p.band.plan)}</p></div>
          <div class="sh-cell sh-first"><p class="mono">First step, week one</p><p class="sh-big">${esc(p.best.first_step)}</p></div>
        </div>
        <footer class="sh-foot"><a class="btn btn-ink sh-send" href="#" data-send>Send it to me</a>${p.proj.has_page ? `<a class="sh-link mono" href="project.html?p=${encodeURIComponent(p.best.slug)}">Read that case →</a>` : ''}</footer>
        <div class="stamp"><span>Briefed</span><small>Z.K. · ${new Date().getFullYear()}</small></div>
      </div>`;
    }
    let busy = false;
    function run(quick) {
      if (busy) { clearTimeout(reTimer); reTimer = setTimeout(() => run(quick), 300); return; }
      busy = true; no++; const p = plan();
      const old = sheet.querySelector('.sh-paper');
      const paper = document.createElement('div'); paper.className = 'sh-paper';
      paper.innerHTML = sheetHTML(p, 'a') + sheetHTML(p, 'b');
      $$('.sh-b a', paper).forEach((a) => { a.tabIndex = -1; a.setAttribute('aria-hidden', 'true'); });
      $('.sh-b', paper).setAttribute('aria-hidden', 'true');
      sheet.querySelector('.sheet-empty')?.remove();
      sheet.appendChild(paper);
      $$('[data-send]', paper).forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); location.href = mailto(p); }));
      $('#brief-note').textContent = `Printing sketch No. ${String(no).padStart(3, '0')} for ${brand}…`;
      const drum = $('.press-drum'), light = $('.press-light');
      const done = () => { busy = false; st.printed = 1; $('#brief-note').textContent = `Sketch No. ${String(no).padStart(3, '0')} printed. Change anything and it reprints.`; $('#run-press span').textContent = 'Run it again'; };
      if (RM) { old && old.remove(); paper.style.setProperty('--pa', '100%'); paper.style.setProperty('--pb', '100%'); paper.classList.add('stamped'); done(); return; }
      const s = quick ? .55 : 1; const tl = gsap.timeline({ onComplete: done });
      if (old) tl.to(old, { xPercent: 115, rotation: 7, opacity: 0, duration: .5 * s, ease: 'power2.in', onComplete: () => old.remove() }, 0);
      tl.fromTo(paper, { xPercent: -112, rotation: -4 }, { xPercent: 0, rotation: 0, duration: .55 * s, ease: 'power3.out' }, old ? .2 * s : 0)
        .add(() => light.classList.add('on'))
        .fromTo(paper, { '--pa': '0%' }, { '--pa': '100%', duration: 1.05 * s, ease: 'power1.inOut' })
        .fromTo(drum, { '--dy': '0%' }, { '--dy': '100%', duration: 1.05 * s, ease: 'power1.inOut' }, '<')
        .to(drum, { '--dy': '0%', duration: .35 * s, ease: 'power2.inOut' })
        .fromTo(paper, { '--pb': '0%', '--sx': '14px', '--sy': '-8px' }, { '--pb': '100%', duration: .85 * s, ease: 'power1.inOut' })
        .fromTo(drum, { '--dy': '0%' }, { '--dy': '100%', duration: .85 * s, ease: 'power1.inOut' }, '<')
        .to(paper, { '--sx': '2.5px', '--sy': '-1.5px', duration: 1.1, ease: 'elastic.out(1,.4)' })
        .to(drum, { '--dy': '0%', duration: .35 * s }, '<')
        .add(() => { light.classList.remove('on'); paper.classList.add('stamped'); const r = $('.sh-a .stamp', paper).getBoundingClientRect(); K.burst(r.left + r.width / 2, r.top + r.height / 2, 22, 1.1); }, '<.1')
        .fromTo($$('.stamp', paper), { scale: 2.6, opacity: 0, rotation: -30 }, { scale: 1, opacity: 1, rotation: -12, duration: .5, ease: 'back.out(3)' }, '<');
    }
    function mailto(p) {
      const body = [`Hi Zubin,`, ``, `I ran your press for ${brand}.`, `Goal: ${p.goal.label}`, `Budget: ₹${st.budget} lakh over eight weeks`, `Channels: ${BM.channels.filter((c) => st.ch.has(c.id)).map((c) => c.label).join(', ')}`, ``, `Your sketch:`, `- Closest case: ${p.proj.title}`, `- Lead format: ${p.best.format}`, `- Metric: ${p.goal.metric}`, `- First step: ${p.best.first_step}`, ``, `Can we talk?`].join('\n');
      return `mailto:${C.email}?subject=${encodeURIComponent(`Campaign sketch for ${brand}`)}&body=${encodeURIComponent(body)}`;
    }
    $('#run-press').addEventListener('click', () => run(false));
    document.addEventListener('brand', () => { if (st.printed) { $$('.sh-brand', sheet).forEach((e) => { e.textContent = brand; }); } });
  } else hide('brief');

  /* ============================ BEFORE / AFTER ============================ */
  const RC = D.rebrand_compare;
  if (RC) {
    $('#ba-h').textContent = RC.title; $('#ba-intro').textContent = RC.intro; $('#ba-note').textContent = RC.note;
    const pane = (s, after) => `<div class="lst ${after ? 'lst-after' : 'lst-before'}">
      <div class="lst-top"><span class="lst-logo">${esc(after ? 'Q&C' : 'PS')}</span><div><b class="lst-brand">${esc(s.brand)}</b><small>${esc(s.tagline)}</small></div><span class="lst-tag mono">${esc(s.label)}</span></div>
      <div class="lst-hero">${after ? riso('projects/cloud-kitchen-rebrand/thumb.jpg', 'The rebranded webshop listing') : '<div class="lst-blur" aria-hidden="true"><span>IMG_2041.jpg</span></div>'}</div>
      <ul>${s.items.map((it, i) => `<li><span class="lst-img" aria-hidden="true">${after ? '' : '▢'}</span><span class="lst-name">${esc(it.name)}</span><b>${esc(it.price)}</b><em>ADD</em></li>`).join('')}</ul>
      <p class="lst-conv"><span class="mono">Product-page conversion</span><b data-flap="${esc(s.conversion)}">${esc(s.conversion)}</b></p></div>`;
    $('#ba-before').innerHTML = pane(RC.before, false); $('#ba-after').innerHTML = pane(RC.after, true);
    const fr = $('#ba-frame'), hd = $('#ba-handle'); let pos = 50, vel = 0, last = 50;
    const setPos = (v) => { pos = Math.max(2, Math.min(98, v)); fr.style.setProperty('--pos', pos + '%'); hd.setAttribute('aria-valuenow', Math.round(pos)); };
    setPos(50);
    let dragging = false;
    const at = (e) => { const r = fr.getBoundingClientRect(); setPos((e.clientX - r.left) / r.width * 100); };
    fr.addEventListener('pointerdown', (e) => { dragging = true; fr.setPointerCapture(e.pointerId); at(e); });
    fr.addEventListener('pointermove', (e) => { if (dragging) at(e); });
    fr.addEventListener('pointerup', () => { dragging = false; }); fr.addEventListener('pointercancel', () => { dragging = false; });
    hd.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') { setPos(pos - 5); e.preventDefault(); } if (e.key === 'ArrowRight') { setPos(pos + 5); e.preventDefault(); } });
    // dragging fast misregisters the new listing's second ink
    if (!RM) gsap.ticker.add(() => { vel += ((pos - last) - vel) * .3; last = pos; fr.style.setProperty('--bam', (Math.max(-1, Math.min(1, vel / 3)) * 8).toFixed(2) + 'px'); });
    // nudge once in view so people see it moves
    if (!RM) ScrollTrigger.create({ trigger: fr, start: 'top 70%', once: true, onEnter: () => { const o = { v: 50 }; gsap.timeline().to(o, { v: 28, duration: .7, ease: 'power2.inOut', onUpdate: () => setPos(o.v) }).to(o, { v: 62, duration: .8, ease: 'power2.inOut', onUpdate: () => setPos(o.v) }).to(o, { v: 50, duration: .6, ease: 'power2.out', onUpdate: () => setPos(o.v) }); } });
    K.flapOnView(fr);
  } else hide('compare');

  /* =============================== CASES =============================== */
  const full = projects.filter((p) => p.has_page);
  if (full.length) {
    $('#cases-h').textContent = S.cases || 'Cases';
    $('#case-list').innerHTML = full.map((p, i) => `<a class="case" href="project.html?p=${encodeURIComponent(p.slug)}" data-cursor="view" data-cursor-label="Open" data-img="${esc(media(p.thumbnail))}">
      <span class="case-n mono">0${i + 1}</span><span class="case-t" data-scr>${esc(p.title)}</span><span class="case-r">${esc(p.result)}</span><span class="case-arrow" aria-hidden="true">→</span>
      <img class="case-thumb" src="${esc(media(p.thumbnail))}" alt="" loading="lazy"></a>`).join('');
    if (FINE && !RM) {
      const pv = document.createElement('div'); pv.className = 'case-preview'; pv.innerHTML = '<div class="riso"><span class="ra"><img alt=""></span><span class="rb"><img alt=""></span></div>'; document.body.appendChild(pv);
      const qx = gsap.quickTo(pv, 'x', { duration: .5, ease: 'power3' }), qy = gsap.quickTo(pv, 'y', { duration: .5, ease: 'power3' }), qr = gsap.quickTo(pv, 'rotation', { duration: .6, ease: 'power3' });
      let lx = 0;
      $('#case-list').addEventListener('pointermove', (e) => { qx(e.clientX + 30); qy(e.clientY - 110); qr(Math.max(-12, Math.min(12, (e.clientX - lx) * .6))); lx = e.clientX; });
      $$('.case').forEach((c) => {
        c.addEventListener('pointerenter', () => { $$('img', pv).forEach((im) => { im.src = c.dataset.img; }); pv.classList.add('on'); K.jitter($('[data-scr]', c)); });
        c.addEventListener('pointerleave', () => pv.classList.remove('on'));
      });
    }
  } else hide('cases');

  /* ================================ MEET ================================ */
  $('#mn-1').textContent = (P.first_name || '').toUpperCase(); $('#mn-2').textContent = (P.last_name || '').toUpperCase();
  const cut = $('#meet-cut'); cut.src = media(D.media?.cutout || 'photos/cutout.png'); cut.alt = `${P.first_name} ${P.last_name}`;
  $('#meet-tag').textContent = `${P.location || ''} · ${P.pronouns || ''}`;
  if (D.about) { $('#about-intro').textContent = D.about.intro; $('#about-now').innerHTML = `<b class="mono">Now</b> ${esc(D.about.now)}`; }
  $('#values').innerHTML = (D.values || []).map((v, i) => `<li data-reveal data-reveal-delay="${i * .08}"><span class="mono">Rule ${i + 1}</span>${esc(v)}</li>`).join('');
  $('#journey-h').textContent = S.journey || 'Journey';
  $('#journey').innerHTML = (D.journey || []).map((j) => `<li class="jr"><span class="jr-pin" aria-hidden="true"></span><span class="jr-y mono">${esc(j.year)}</span><h3>${esc(j.title)}</h3><p>${esc(j.detail)}</p></li>`).join('');
  if (!RM) {
    gsap.fromTo('.mn-1', { xPercent: -6 }, { xPercent: 6, ease: 'none', scrollTrigger: { trigger: '.meet-stage', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.fromTo('.mn-2', { xPercent: 8 }, { xPercent: -8, ease: 'none', scrollTrigger: { trigger: '.meet-stage', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.fromTo('.meet-cut', { yPercent: 10 }, { yPercent: -4, ease: 'none', scrollTrigger: { trigger: '.meet-stage', start: 'top bottom', end: 'bottom top', scrub: true } });
    // the journey line draws with scroll; pins pop as it passes them
    const path = $('#jr-path'); const L = 100; path.style.strokeDasharray = L; path.setAttribute('pathLength', L);
    gsap.fromTo(path, { strokeDashoffset: L }, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: '.jr-wrap', start: 'top 70%', end: 'bottom 60%', scrub: .5 } });
    $$('.jr').forEach((li) => ScrollTrigger.create({ trigger: li, start: 'top 68%', end: 'bottom top', toggleClass: 'on' }));
  } else $$('.jr').forEach((li) => li.classList.add('on'));

  /* ============================ EXPERIENCE ============================ */
  $('#exp-h').textContent = S.experience || 'Experience'; $('#edu-h').textContent = S.education || 'Education';
  $('#exp-list').innerHTML = (D.experience || []).map((x) => `<article class="row" data-reveal><img class="logo" src="${esc(media(x.logo))}" alt="${esc(x.org)} logo" loading="lazy"><div><p class="mono">${esc(x.dates)} · ${esc(x.place)}</p><h3>${esc(x.role)}, <em>${esc(x.org)}</em></h3><ul>${(x.points || []).map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div></article>`).join('');
  $('#edu-list').innerHTML = (D.education || []).map((x) => `<article class="row" data-reveal><img class="logo" src="${esc(media(x.logo))}" alt="${esc(x.school)} logo" loading="lazy"><div><p class="mono">${esc(x.years)}</p><h3>${esc(x.degree)}, <em>${esc(x.school)}</em></h3><p>${esc(x.notes)}</p></div></article>`).join('');
  $('#certs').innerHTML = (D.certifications || []).map((c) => `<li><b>${esc(c.name)}</b> <span class="mono">${esc(c.issuer)} · ${esc(c.year)}</span></li>`).join('');

  /* ================================ WINS ================================ */
  if ((D.wins || []).length) {
    $('#wins-h').textContent = S.wins || 'Wins';
    const ws = $('#win-stack');
    ws.innerHTML = D.wins.map((w, i) => `<figure class="poster-w" style="--i:${i};--n:${D.wins.length}">${riso(w.image, w.title)}<figcaption><b>${esc(w.title)}</b><span>${esc(w.detail)}</span></figcaption></figure>`).join('');
    ws.setAttribute('tabindex', '0'); ws.setAttribute('role', 'button'); ws.setAttribute('aria-label', 'Fan out the wins');
    const fan = (on) => ws.classList.toggle('fanned', on ?? !ws.classList.contains('fanned'));
    ws.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') fan(true); }); ws.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') fan(false); });
    ws.addEventListener('click', (e) => { if (e.pointerType !== 'mouse') fan(); }); ws.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fan(); } });
    $('#win-list').innerHTML = D.wins.map((w) => `<li><b>${esc(w.title)}</b> ${esc(w.detail)}</li>`).join('');
    if (!RM) ScrollTrigger.create({ trigger: ws, start: 'top 60%', once: true, onEnter: () => { fan(true); setTimeout(() => fan(false), 1400); } });
  } else hide('wins');

  /* =============================== SKILLS =============================== */
  if (D.skills) {
    $('#skills-h').textContent = S.skills || 'Skills';
    $('#skill-cols').innerHTML = Object.entries(D.skills).map(([k, v]) => `<div class="skill-col" data-reveal><h3>${esc(k)}</h3><ul>${v.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>`).join('');
    $('#dock').innerHTML = (D.tools || []).map((t) => `<span class="dock-i" tabindex="0"><img src="${esc(media(t.logo))}" alt="${esc(t.name)}" loading="lazy"><em>${esc(t.name)}</em></span>`).join('');
    // macOS-style magnification (Magic UI Dock, vanilla)
    const dock = $('#dock'), icons = $$('.dock-i', dock);
    if (FINE && !RM) {
      const qs = icons.map((ic) => { const a = gsap.quickTo(ic, 'scaleX', { duration: .3, ease: 'power3' }), b = gsap.quickTo(ic, 'scaleY', { duration: .3, ease: 'power3' }); return (v) => { a(v); b(v); }; });
      dock.addEventListener('pointermove', (e) => icons.forEach((ic, i) => { const r = ic.getBoundingClientRect(); const d = Math.abs(e.clientX - (r.left + r.width / 2)); qs[i](1 + .7 * Math.max(0, 1 - d / 130)); }));
      dock.addEventListener('pointerleave', () => qs.forEach((q) => q(1)));
    }
  } else hide('skills');

  /* ============================== OUTSIDE ============================== */
  if ((D.outside || []).length) {
    $('#out-h').textContent = S.outside || 'Outside work';
    $('#flip-row').innerHTML = D.outside.map((o, i) => `<div class="flip" style="--r:${[-2.5, 1.8, -1.2][i % 3]}deg"><button type="button" class="flip-in" aria-label="${esc(o.title)}: flip the card" data-cursor="view" data-cursor-label="Flip">
      <span class="flip-f">${riso(o.image, o.title)}<b>${esc(o.title)}</b></span><span class="flip-b" inert><b>${esc(o.title)}</b><span>${esc(o.detail)}</span><em class="mono">Tap to flip back</em></span></button></div>`).join('');
    $$('.flip-in').forEach((b) => {
      let flipped = false;
      b.addEventListener('click', () => {
        flipped = !flipped; const f = $('.flip-f', b), bk = $('.flip-b', b);
        const set = () => { f.inert = flipped; bk.inert = !flipped; };
        if (RM) { gsap.set(b, { rotationY: flipped ? 180 : 0 }); set(); return; }
        gsap.timeline({ onComplete: set }).to(b, { keyframes: [{ rotation: -3.2 }, { rotation: 2.8 }, { rotation: -2 }, { rotation: 1.4 }, { rotation: 0 }], duration: .45, ease: 'none' }).to(b, { rotationY: flipped ? 180 : 0, duration: .75, ease: 'back.out(1.25)' });
      });
    });
  } else hide('outside');

  /* ============================== NOTES ============================== */
  if ((D.testimonials || []).length) {
    $('#notes-h').textContent = S.testimonials || 'What people say';
    $('#note-row').innerHTML = D.testimonials.map((t, i) => `<figure class="note n${i % 3}" data-reveal data-reveal-delay="${i * .1}"><i class="tape" aria-hidden="true"></i><blockquote>“${esc(t.quote)}”</blockquote><figcaption><b>${esc(t.name)}</b><span>${esc(t.role)}</span><em>${esc(t.relation)}</em></figcaption></figure>`).join('');
    $$('.note').forEach((n) => K.tilt(n, 8));
  } else hide('testimonials');

  /* ============================== CONTACT ============================== */
  $('#avail').textContent = P.available_from || '';
  if (C.email) {
    const m = $('#mail'); $('#mail-text').innerHTML = [...C.email].map((c) => `<span class="mc">${esc(c)}</span>`).join('');
    m.setAttribute('aria-label', `Copy email address ${C.email}`);
    m.addEventListener('click', async (e) => {
      try { await navigator.clipboard.writeText(C.email); $('#mail-hint').textContent = 'Copied. Paste it into your mail app.'; } catch (er) { location.href = 'mailto:' + C.email; }
      const r = m.getBoundingClientRect(); for (let i = 0; i < 4; i++) setTimeout(() => K.burst(r.left + Math.random() * r.width, r.top + r.height / 2, 14, 1.3), i * 90);
      Press.splash(e.clientX || r.left + r.width / 2, e.clientY || r.top, 8, .7);
      if (!RM) gsap.fromTo('.mc', { yPercent: 0 }, { yPercent: -30, duration: .18, yoyo: true, repeat: 1, stagger: .015, ease: 'power2.out' });
      setTimeout(() => { $('#mail-hint').textContent = 'Click to copy'; }, 2600);
    });
  }
  const links = [
    C.phone && ['Phone', C.phone, 'tel:' + C.phone.replace(/\s/g, '')],
    C.whatsapp && ['WhatsApp', C.whatsapp, 'https://wa.me/' + C.whatsapp.replace(/\D/g, '')],
    C.linkedin && ['LinkedIn', 'Profile', C.linkedin],
    C.instagram && ['Instagram', 'Shopfront Sundays', C.instagram],
    C.substack && ['Newsletter', 'Copy That', C.substack],
    C.calendly && ['Book 20 minutes', 'Calendly', C.calendly],
    C.resume_pdf && ['Resume', 'PDF, one page', C.resume_pdf.startsWith('http') ? C.resume_pdf : C.resume_pdf],
  ].filter(Boolean);
  $('#contact-grid').innerHTML = links.map(([k, v, h]) => `<a class="ticket" href="${esc(h)}" ${h.startsWith('http') ? 'target="_blank" rel="noopener"' : ''} ${/\.pdf$/.test(h) ? 'download' : ''}><span class="mono">${esc(k)}</span><b>${esc(v)}</b></a>`).join('');
  $('#foot-loc').textContent = `${P.location || ''} · printed in two inks`;
  if (D.demo) $('#demo-note').textContent = 'Sample persona: a fictional student, for a template.';

  /* ============================ PRINT RESUME ============================ */
  const pr = document.createElement('section'); pr.className = 'print-resume';
  pr.innerHTML = `<h1>${esc(P.first_name)} ${esc(P.last_name)}</h1><p>${esc(P.headline)}</p><p>${esc(C.email)} · ${esc(C.phone)} · ${esc(P.location)}</p><p>${esc(D.pitch?.short || '')}</p>
    <h2>Experience</h2>${(D.experience || []).map((x) => `<h3>${esc(x.role)}, ${esc(x.org)} <small>${esc(x.dates)}</small></h3><ul>${x.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`).join('')}
    <h2>Education</h2>${(D.education || []).map((x) => `<p><b>${esc(x.degree)}</b>, ${esc(x.school)} (${esc(x.years)}). ${esc(x.notes)}</p>`).join('')}
    <h2>Selected projects</h2><ul>${projects.slice(0, 5).map((p) => `<li><b>${esc(p.title)}</b>: ${esc(p.result)}</li>`).join('')}</ul>
    <h2>Skills</h2>${Object.entries(D.skills || {}).map(([k, v]) => `<p><b>${esc(k)}:</b> ${v.map(esc).join(', ')}</p>`).join('')}`;
  document.body.appendChild(pr);

  /* ============================== BOOT ============================== */
  K.boot(); K.reveals(); loupes();
  ScrollTrigger.refresh();
})();
