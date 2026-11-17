/* kit.js: shared pieces adapted from Skerry's boot bundle (nav, compass, tilt, letters, reveal, map). */
(function () {
  const K = (window.K = {});
  const $ = (K.$ = (s, r = document) => r.querySelector(s));
  K.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  K.esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  K.reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  K.fine = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
  K.pad2 = (n) => String(n).padStart(2, '0');

  /* ?for=Company, kept across internal links */
  const raw = new URLSearchParams(location.search).get('for') || '';
  K.forCo = raw.replace(/[<>"]/g, '').trim().slice(0, 40);
  K.link = (href) => {
    if (!K.forCo || /^(mailto:|tel:|https?:|#)/.test(href)) return href;
    const [path, hash] = href.split('#');
    return path + (path.includes('?') ? '&' : '?') + 'for=' + encodeURIComponent(K.forCo) + (hash ? '#' + hash : '');
  };

  /* coordinates: 18°32'N 073°52'E (Skerry's formatter) */
  K.coords = (lat, lon) => {
    const f = (v, p, n, w) => { const m = Math.round(Math.abs(v) * 60); return `${String(Math.floor(m / 60)).padStart(w, '0')}°${K.pad2(m % 60)}'${v >= 0 ? p : n}`; };
    return `${f(lat, 'N', 'S', 2)} ${f(lon, 'E', 'W', 3)}`;
  };
  K.parseLL = (s) => { const m = String(s).match(/([\d.]+)°N\s+([\d.]+)°E/); return m ? { lat: +m[1], lon: +m[2] } : { lat: 0, lon: 0 }; };

  K.load = async () => { const r = await fetch('content/portfolio.json'); if (!r.ok) throw new Error('content'); return r.json(); };
  K.media = (p) => (p ? 'media/' + p : '');

  /* one clock: GSAP ticker drives Lenis */
  K.lenis = null;
  K.initScroll = () => {
    gsap.registerPlugin(ScrollTrigger);
    if (K.reduced() || typeof Lenis === 'undefined') return null;
    const l = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
    l.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => l.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    K.lenis = l;
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const t = document.querySelector(a.getAttribute('href'));
      if (t) { e.preventDefault(); l.scrollTo(t, { offset: a.dataset.offset ? +a.dataset.offset : -60 }); }
    });
    return l;
  };

  K.mark = (stroke = 'currentColor') =>
    `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><circle cx="12" cy="12" r="10.4" fill="none" stroke="${stroke}" stroke-width="1.3"/><path d="M12 3.4l2.7 8.6H9.3z" fill="#1fe9ff"/><path d="M12 20.6l-2.7-8.6h5.4z" fill="${stroke}" opacity=".5"/></svg>`;

  /* nav + footer (Skerry Fc) */
  K.chrome = (d, page) => {
    const p = d.person, c = d.contact;
    const links = [['#trip', 'Route'], ['#work', 'Work orders'], ['#plan', 'Plan your route'], ['#faq', 'Questions']];
    const home = page === 'home';
    const href = (h) => K.link(home ? h : 'index.html' + h);
    const navRoot = $('#nav-root');
    navRoot.innerHTML = `<header class="nav" data-intro="nav">
  <a class="logo" href="${K.link('index.html')}" aria-label="${K.esc(p.first_name + ' ' + p.last_name)}, home">${K.mark()}<span class="logo-w">${K.esc(p.first_name)} ${K.esc(p.last_name)}</span><span class="logo-s lab">Supply &amp; ops</span></a>
  <nav class="nav-links" aria-label="Main">${links.map(([h, l]) => `<a href="${href(h)}">${l}</a>`).join('')}</nav>
  <div class="nav-end"><span class="nav-meta lab" data-lat>18°32'N</span><a class="nav-cta" href="${href('#book')}">Book this trip<span aria-hidden="true">&rarr;</span></a>
  <button class="nav-burger" aria-label="Open menu" aria-expanded="false" aria-controls="nav-panel"><span></span><span></span></button></div>
</header>
<div class="nav-panel" id="nav-panel" hidden><nav aria-label="Mobile">${links.concat([['#book', 'Book this trip']]).map(([h, l], i) => `<a href="${href(h)}"><i class="lab">0${i + 1}</i>${l}</a>`).join('')}</nav><p class="nav-panel-foot lab">${K.esc(c.email)}<br>${K.esc(c.phone)}</p></div>`;
    const burger = $('.nav-burger'), panel = $('#nav-panel');
    const setMenu = (o) => { burger.setAttribute('aria-expanded', String(o)); panel.hidden = !o; document.body.classList.toggle('menu-open', o); K.lenis && (o ? K.lenis.stop() : K.lenis.start()); };
    burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
    panel.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
    addEventListener('keydown', (e) => e.key === 'Escape' && setMenu(false));
    const nav = $('.nav');
    const trip = $('.trip');
    const solid = () => nav.classList.toggle('is-solid', trip ? trip.getBoundingClientRect().bottom < 70 : scrollY > 60);
    K.navSolid = solid;
    solid(); addEventListener('scroll', solid, { passive: true });

    const pages = d.projects.filter((x) => x.has_page);
    $('#foot-root').innerHTML = `<footer class="foot">
  <div class="container foot-grid">
    <div class="foot-brand"><a class="logo" href="${K.link('index.html')}">${K.mark('#ffffff')}<span class="logo-w">${K.esc(p.first_name)} ${K.esc(p.last_name)}</span></a><p>${K.esc(p.headline)}. ${K.esc(p.current)}.</p></div>
    <div><h4>Route</h4><ul>${links.map(([h, l]) => `<li><a href="${href(h)}">${l}</a></li>`).join('')}</ul></div>
    <div><h4>Order pages</h4><ul>${pages.map((x) => `<li><a href="${K.link('order-' + x.slug + '.html')}">${K.esc(x.org)}, ${K.esc(x.year)}</a></li>`).join('')}</ul></div>
    <div><h4>Contact</h4><ul><li><a href="mailto:${K.esc(c.email)}">${K.esc(c.email)}</a></li><li><a href="tel:${K.esc(c.phone.replace(/\s/g, ''))}">${K.esc(c.phone)}</a></li><li><a href="${K.esc(c.linkedin)}" rel="noopener">LinkedIn</a></li><li><a href="${K.media(c.resume_pdf.replace(/^media\//, ''))}">Résumé PDF</a></li></ul></div>
  </div>
  <div class="container foot-legal lab"><span class="sample">${d.demo ? 'Sample persona: employers, schools and colleagues are fictional, and so is everything else.' : ''}</span><span>${K.esc(p.location)} &middot; 28°28'N 077°04'E</span></div>
</footer>`;
  };

  /* compass cursor (Skerry zc): needle turns to the direction of travel */
  K.compass = () => {
    if (!K.fine()) return;
    const s = document.createElement('div');
    s.className = 'compass';
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = `<svg viewBox="-30 -30 60 60" width="60" height="60"><circle class="c-ring" r="22" fill="rgba(248,247,243,.6)" stroke="currentColor" stroke-width="1.3"/>
  <g stroke="currentColor" stroke-width="1.3" opacity=".75"><path d="M0-22v-4M0 22v4M-22 0h-4M22 0h4"/></g>
  <g class="c-needle"><path d="M0-17l4.4 17h-8.8z" fill="#1fe9ff"/><path d="M0 17l4.4-17h-8.8z" fill="currentColor" opacity=".55"/><circle r="2.2" fill="#ffffff" stroke="currentColor" stroke-width="1"/></g></svg>`;
    const dot = document.createElement('div');
    dot.className = 'compass-dot';
    document.body.append(s, dot);
    document.body.classList.add('has-compass');
    const needle = s.querySelector('.c-needle');
    let tx = innerWidth / 2, ty = innerHeight / 2, x = tx, y = ty, a = 0, seen = false;
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      tx = e.clientX; ty = e.clientY;
      if (!seen) { seen = true; x = tx; y = ty; document.body.classList.add('compass-on'); }
      const t = e.target;
      s.classList.toggle('is-link', !!(t && t.closest && t.closest('a, button, [data-tilt], summary, label, .pin, select')));
      s.classList.toggle('on-dark', !!(t && t.closest && t.closest('.trip, .plan, .book, .banner, .foot, .nav:not(.is-solid), .sheet-metric, .wid')));
      document.body.classList.toggle('compass-form', !!(t && t.closest && t.closest('input, textarea')));
    }, { passive: true });
    document.addEventListener('pointerleave', () => document.body.classList.remove('compass-on'));
    document.addEventListener('pointerenter', () => seen && document.body.classList.add('compass-on'));
    gsap.ticker.add((_, dt) => {
      const k = 1 - Math.exp(-(dt / 1000) * 9);
      x += (tx - x) * k; y += (ty - y) * k;
      const dx = tx - x, dy = ty - y;
      if (Math.hypot(dx, dy) > 3) { const d = ((Math.atan2(dy, dx) * 180) / Math.PI + 90 - a + 540) % 360 - 180; a += d * 0.35; }
      gsap.set(s, { x, y }); gsap.set(dot, { x: tx, y: ty });
      needle.setAttribute('transform', `rotate(${a.toFixed(1)})`);
    });
  };

  /* tilt with glare (Skerry Lc) */
  K.tilt = (root = document) => {
    if (!K.fine() || K.reduced()) return;
    root.querySelectorAll('[data-tilt]').forEach((el) => {
      if (el._tilt) return;
      el._tilt = true;
      const g = el.querySelector('.glare');
      const rx = gsap.quickTo(el, 'rotationX', { duration: 0.5, ease: 'power3.out' });
      const ry = gsap.quickTo(el, 'rotationY', { duration: 0.5, ease: 'power3.out' });
      gsap.set(el, { transformPerspective: 900, transformOrigin: '50% 50%' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        ry((px - 0.5) * 14); rx(-(py - 0.5) * 12);
        if (g) { g.style.setProperty('--gx', px * 100 + '%'); g.style.setProperty('--gy', py * 100 + '%'); g.style.opacity = '1'; }
      });
      el.addEventListener('pointerleave', () => { rx(0); ry(0); if (g) g.style.opacity = '0'; });
    });
  };

  K.photos = (root = document) => {
    root.querySelectorAll('.ph img').forEach((im) => { if (im.complete && im.naturalWidth) im.classList.add('ld'); else im.addEventListener('load', () => im.classList.add('ld'), { once: true }); });
    if (K.reduced()) return;
    root.querySelectorAll('.ph[data-par] img').forEach((im) => {
      if (im._par) return; im._par = true;
      gsap.fromTo(im, { yPercent: -5 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: im.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  };

  /* letters fly in with skew (Skerry Ic/Zc) */
  K.letters = (el, delay = 0.4) => {
    if (!el) return;
    const out = document.createElement('div');
    const walk = (src, dst) => src.childNodes.forEach((n) => {
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach((w) => {
          if (!w) return;
          if (/^\s+$/.test(w)) { dst.appendChild(document.createTextNode(' ')); return; }
          const lw = document.createElement('span'); lw.className = 'lw';
          for (const ch of w) { const l = document.createElement('span'); l.className = 'l'; l.textContent = ch; lw.appendChild(l); }
          dst.appendChild(lw);
        });
      } else if (n.nodeName === 'BR') dst.appendChild(n.cloneNode());
      else if (n.nodeType === 1) { const c = n.cloneNode(false); dst.appendChild(c); walk(n, c); }
    });
    walk(el, out);
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    el.innerHTML = out.innerHTML;
    el.querySelectorAll('.lw').forEach((w) => w.setAttribute('aria-hidden', 'true'));
    if (K.reduced()) return;
    const ls = el.querySelectorAll('.l');
    gsap.fromTo(ls, { x: 90, y: 46, opacity: 0, skewX: -14 }, { x: 0, y: 0, opacity: 1, skewX: 0, duration: 1.25, ease: 'expo.out', stagger: { each: 0.03 }, delay });
  };

  K.intro = () => {
    if (K.reduced()) return;
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('[data-intro="nav"]', { y: -20, opacity: 0, duration: 0.8 }, 0.1)
      .from('[data-intro="eyebrow"]', { y: 16, opacity: 0, duration: 0.8 }, 0.3)
      .from('[data-intro="sub"]', { y: 20, opacity: 0, duration: 0.9 }, 1.05)
      .from('[data-intro="cta"]', { y: 24, opacity: 0, duration: 0.9 }, 1.3)
      .from('[data-intro="proof"]', { y: 20, opacity: 0, duration: 0.9 }, 1.6);
    return tl;
  };

  /* reveal, re-arming when the element leaves past the top */
  K.reveal = (root = document) => {
    const els = root.querySelectorAll('[data-reveal]');
    if (K.reduced() || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) e.target.classList.add('in');
      else if (e.boundingClientRect.top > 0) e.target.classList.remove('in');
    }), { threshold: 0.12 });
    els.forEach((e) => { if (e.dataset.rd) e.style.setProperty('--rd', e.dataset.rd + 's'); io.observe(e); });
  };

  K.count = (root = document) => {
    root.querySelectorAll('[data-count]').forEach((el) => {
      const to = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0);
      const set = (v) => (el.textContent = v.toFixed(dec));
      if (K.reduced()) { set(to); return; }
      const o = { v: 0 }; set(0);
      ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => gsap.to(o, { v: to, duration: 1.7, ease: 'power2.out', onUpdate: () => set(o.v) }) });
    });
  };

  /* ---------- the abstract map, drawn in code ---------- */
  const NS = 'http://www.w3.org/2000/svg';
  K.NS = NS;
  // two layouts, like Skerry's wide/tall path data
  K.LAYOUT = {
    wide: { w: 1600, h: 900, pune: [800, 772], ggn: [1182, 168] },
    tall: { w: 800, h: 1300, pune: [330, 1110], ggn: [520, 292] },
  };
  const PUNE = { lat: 18.52, lon: 73.86 }, GGN = { lat: 28.46, lon: 77.03 };
  K.proj = (L) => {
    const bx = (L.ggn[0] - L.pune[0]) / (GGN.lon - PUNE.lon), by = (L.pune[1] - L.ggn[1]) / (GGN.lat - PUNE.lat);
    return (lon, lat) => [L.pune[0] + (lon - PUNE.lon) * bx, L.pune[1] - (lat - PUNE.lat) * by];
  };
  // small seeded noise for hand-drawn contour lines
  const rnd = (s) => () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const blob = (cx, cy, rx, ry, rot, seed, n = 28) => {
    const r = rnd(seed), ph = [r() * 6, r() * 6, r() * 6];
    let d = '';
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * Math.PI * 2;
      const k = 1 + 0.12 * Math.sin(t * 3 + ph[0]) + 0.07 * Math.sin(t * 5 + ph[1]) + 0.04 * Math.sin(t * 9 + ph[2]);
      const x0 = Math.cos(t) * rx * k, y0 = Math.sin(t) * ry * k;
      const x = cx + x0 * Math.cos(rot) - y0 * Math.sin(rot), y = cy + x0 * Math.sin(rot) + y0 * Math.cos(rot);
      d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    return d + 'Z';
  };
  const smooth = (pts) => { // Catmull-Rom to cubic
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d;
  };
  K.smooth = smooth;

  K.drawBase = (svg, mode) => {
    const L = K.LAYOUT[mode], P = K.proj(L);
    svg.setAttribute('viewBox', `0 0 ${L.w} ${L.h}`);
    const pt = (a) => a.map(([lo, la]) => P(lo, la));
    const line = (a) => pt(a).map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
    let g = '';
    // graticule every 2 degrees
    for (let lon = 60; lon <= 90; lon += 2) { const [x] = P(lon, 20); if (x > -10 && x < L.w + 10) g += `<path class="grat" d="M${x.toFixed(1)} 0V${L.h}"/><text class="grat-t" x="${(x + 6).toFixed(1)}" y="${L.h - 70}">${lon}°E</text>`; }
    for (let lat = 10; lat <= 36; lat += 2) { const [, y] = P(75, lat); if (y > -10 && y < L.h + 10) g += `<path class="grat" d="M0 ${y.toFixed(1)}H${L.w}"/><text class="grat-t" x="${L.w - 64}" y="${(y - 6).toFixed(1)}">${lat}°N</text>`; }
    // coast and sea (abstract, hand-placed)
    const coast = [[74.4, 14.5], [73.9, 15.6], [73.4, 16.8], [73.1, 17.9], [72.85, 18.9], [72.8, 19.6], [72.75, 20.4], [72.9, 21.0], [72.6, 21.7], [72.4, 22.3], [71.9, 21.6], [71.2, 21.0], [70.4, 21.0], [69.4, 21.9], [69.0, 22.4], [69.8, 22.9], [70.5, 23.1], [69.6, 23.5], [68.5, 23.6], [67.6, 24.4], [66.9, 25.1], [66.2, 25.4], [64.5, 25.3], [60, 25.2]];
    const cp = pt(coast);
    const seaD = 'M' + cp.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + `L-200 ${cp[cp.length - 1][1].toFixed(1)}L-200 ${L.h + 200}L${cp[0][0].toFixed(1)} ${L.h + 200}Z`;
    g += `<defs><clipPath id="sea-${mode}"><path d="${seaD}"/></clipPath></defs><path class="sea" d="${seaD}"/>`;
    let h = '';
    for (let i = -L.h; i < L.w + L.h; i += 14) h += `M${i} 0L${i - L.h} ${L.h}`;
    g += `<path class="hatch" clip-path="url(#sea-${mode})" d="${h}"/><path class="coast" d="${line(coast)}"/>`;
    // contour blobs: old ridge and plateau ranges
    const hills = [[73.75, 17.4, 0.45, 2.6, 0.08, 11, 4], [73.9, 20.2, 0.6, 1.3, 0.2, 23, 3], [76.3, 21.8, 2.3, 0.45, -0.05, 31, 4], [78.6, 23.6, 2.2, 0.5, -0.1, 37, 3], [74.7, 25.3, 0.7, 2.6, -0.62, 41, 4], [76.1, 27.6, 0.45, 1.3, -0.6, 47, 3], [76.2, 23.6, 1.3, 0.8, 0.1, 53, 3], [79.5, 19.5, 1.8, 1.2, 0.3, 59, 3]];
    const [ax, ay] = P(74, 20), [bx2, by2] = P(75, 21); const sx = Math.abs(bx2 - ax), sy = Math.abs(by2 - ay);
    hills.forEach(([lo, la, rx, ry, rot, seed, rings]) => {
      const [cx, cy] = P(lo, la);
      for (let k = 0; k < rings; k++) { const f = 1 - k * 0.24; g += `<path class="ctr${k === rings - 1 ? ' hi' : ''}" d="${blob(cx, cy, rx * sx * f, ry * sy * f, rot, seed + k * 7)}"/>`; }
    });
    // rivers
    const rivers = [[[81.6, 22.7], [80, 23], [78.3, 22.7], [76.6, 22.3], [75.1, 22.1], [73.8, 21.8], [72.8, 21.65]], [[78.2, 21.7], [76.6, 21.3], [75, 21.2], [73.9, 21.2], [72.85, 21.1]], [[73.55, 19.95], [74.9, 19.55], [76.4, 19.3], [78, 18.9], [80, 18.7], [82, 17.6]], [[77.6, 30.6], [77.3, 29.4], [77.25, 28.6], [77.9, 27.3], [79.2, 26.4], [80.8, 25.6], [82.5, 25.3]], [[75.5, 22.6], [75.6, 24.2], [75.9, 25.3], [76.9, 26.4], [78.4, 26.6], [79.2, 26.3]], [[73.6, 18.75], [74.5, 18.45], [75.6, 18.2], [76.6, 17.9]]];
    rivers.forEach((r) => (g += `<path class="river" d="${smooth(pt(r))}"/>`));
    // regions and reference towns
    const regions = mode === 'wide' ? [['Gull Sound', 69.2, 18.4], ['Tamber Plateau', 76.6, 18.6], ['Birchlands', 76.9, 23.3], ['Saltpan Flats', 71.4, 27.4], ['Old Ridge', 73.8, 25.6]] : [['Gull Sound', 71.2, 17.6], ['Tamber Plateau', 76.0, 17.2], ['Birchlands', 76.4, 23.5], ['Saltpan Flats', 72.6, 27.6]];
    regions.forEach(([t, lo, la]) => { const [x, y] = P(lo, la); g += `<text class="region" x="${x.toFixed(0)}" y="${y.toFixed(0)}" text-anchor="middle">${t.toUpperCase()}</text>`; });
    const towns = [['Ostrander', 75.86, 22.72, 1], ['Pellham', 72.57, 23.02, -1], ['Quillby', 75.79, 26.91, 1], ['Brindle Cross', 75.83, 25.18, 1], ['Tarrow', 77.21, 28.61, -1]];
    towns.forEach(([t, lo, la, side]) => { const [x, y] = P(lo, la); g += `<g class="city"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4"/><text x="${(x + side * 10).toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="${side > 0 ? 'start' : 'end'}">${t}</text></g>`; });
    const base = document.createElementNS(NS, 'g');
    base.setAttribute('class', 'map-base');
    base.innerHTML = g;
    svg.querySelector('.map-base')?.remove();
    svg.insertBefore(base, svg.firstChild);
    return { L, P };
  };

  /* route geometry: stops are pulled apart around Larchmont Falls and around Marlowe Heights (not to scale), the long haul follows the map */
  K.routePoints = (mode) => {
    const L = K.LAYOUT[mode], P = K.proj(L);
    const [px, py] = L.pune, [gx, gy] = L.ggn;
    if (mode === 'wide') {
      return {
        stops: [[px - 6, py + 34], [px - 92, py - 62], [px + 70, py - 104], [gx, gy], [gx + 86, gy + 48]],
        via: [[px - 6, py + 34], [px - 92, py - 62], [px + 70, py - 104], P(75.0, 21.4), P(75.86, 22.9), P(75.6, 25.0), P(76.0, 26.9), [gx, gy], [gx + 86, gy + 48]],
        next: [[gx + 86, gy + 48], [gx + 160, gy + 20], [gx + 236, gy - 40]],
      };
    }
    return {
      stops: [[px - 4, py + 34], [px - 96, py - 70], [px + 66, py - 120], [gx, gy], [gx + 92, gy + 54]],
      via: [[px - 4, py + 34], [px - 96, py - 70], [px + 66, py - 120], P(75.2, 21.6), P(75.7, 23.4), P(75.5, 25.3), P(76.1, 27.0), [gx, gy], [gx + 92, gy + 54]],
      next: [[gx + 92, gy + 54], [gx + 150, gy - 10], [gx + 170, gy - 96]],
    };
  };

  /* the print résumé */
  K.printResume = (d) => {
    const el = $('#print-resume'); if (!el) return;
    const p = d.person, c = d.contact;
    el.innerHTML = `<h1>${K.esc(p.first_name)} ${K.esc(p.last_name)}</h1>
<p>${K.esc(p.headline)}. ${K.esc(p.location)}. ${K.esc(c.email)} · ${K.esc(c.phone)} · ${K.esc(c.linkedin)}</p>
<p>${K.esc(d.pitch.short)}</p>
<h2>Experience</h2>${d.experience.map((x) => `<h3>${K.esc(x.role)}, ${K.esc(x.org)} · ${K.esc(x.place)} · ${K.esc(x.dates)}</h3><ul>${x.points.map((q) => `<li>${K.esc(q)}</li>`).join('')}</ul>`).join('')}
<h2>Selected projects</h2><ul>${d.projects.map((x) => `<li><b>${K.esc(x.title)}</b> (${K.esc(x.org)}, ${K.esc(x.year)}): ${K.esc(x.result)}</li>`).join('')}</ul>
<h2>Education</h2>${d.education.map((x) => `<p><b>${K.esc(x.degree)}</b>, ${K.esc(x.school)} · ${K.esc(x.years)}. ${K.esc(x.notes)}</p>`).join('')}
<h2>Skills</h2>${Object.entries(d.skills).map(([k, v]) => `<p><b>${K.esc(k)}:</b> ${v.map(K.esc).join(', ')}</p>`).join('')}
<h2>Certifications</h2><ul>${d.certifications.map((x) => `<li>${K.esc(x.name)}, ${K.esc(x.issuer)}, ${K.esc(x.year)}</li>`).join('')}</ul>
${d.demo ? '<p><i>Sample persona for a template. Replace before use.</i></p>' : ''}`;
  };

  /* a work-order card (Skerry tour card form) */
  K.orderCard = (x, i, opts = {}) => {
    const n = 'Order ' + K.pad2(i + 1);
    const m = (x.metrics && x.metrics[0]) || ['', ''];
    const inner = `
    <div class="wcard-media">
      <div class="ph"><img src="${K.media(x.thumbnail)}" alt="" loading="lazy" /></div>
      <span class="badge lab"><i></i>${K.esc(x.type)}</span>
      <span class="wcard-org lab">${K.esc(x.org)}</span>
      <span class="glare" aria-hidden="true"></span>
    </div>
    <div class="wcard-body">
      <div class="wcard-top lab"><span>${n}</span><span>${K.esc(x.year)} &middot; ${K.esc(x.duration)}</span></div>
      <h3>${K.esc(x.title)}</h3>
      <p>${K.esc(x.summary)}</p>
      <ul class="wcard-meta lab">${x.tags.slice(0, 3).map((t) => `<li>${K.esc(t)}</li>`).join('')}</ul>
      <div class="wcard-res"><b>${K.esc(m[0])}</b><span>${K.esc(m[1])}</span>${x.has_page ? '<span class="wcard-go" aria-hidden="true"><svg viewBox="0 0 20 12" width="18" height="11"><path d="M0 6h18M13 1l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></span>' : ''}</div>
    </div>`;
    const cls = 'wcard' + (opts.wide ? ' is-wide' : '');
    return x.has_page
      ? `<article class="${cls}" data-reveal data-rd="${opts.delay || 0}"><a class="wcard-in" href="${K.link('order-' + x.slug + '.html')}" data-tilt aria-label="${K.esc(x.title)}: open the order page">${inner}</a></article>`
      : `<article class="${cls}" data-reveal data-rd="${opts.delay || 0}"><div class="wcard-in" data-tilt>${inner}</div></article>`;
  };
})();
