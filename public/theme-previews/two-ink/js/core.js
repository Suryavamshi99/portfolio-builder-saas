/* ==========================================================================
   core.js — shared by index.html and project.html.
   One clock (gsap.ticker) drives Lenis, the cursor, the WebGL layers and the
   marquee, as in every reference (teardown 1.1).
   Ported pieces:
   - Lenis + ticker setup: the references' shared core (dunefold common @127k).
   - Step 5 (2026-11-13), the press's own pieces: a two-ink registration
     crosshair cursor whose second ink lags behind (a misregistered trail),
     sticker-press squash on buttons, a print-roller ink pull between pages,
     two-pass printed numbers and a misregistration jitter on case titles.
   - Velocity marquee: Pulp Parade (speed 1.2 + |Δscroll|·.35, direction
     follows scroll) with Scruff's --sk skew.
   - Click bursts: Daimyo's petal burst, redrawn as riso ink drops.
   ========================================================================== */
(function () {
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
  gsap.registerPlugin(ScrollTrigger);
  const K = { RM, FINE };

  /* ---------- themes: three ink pairs on paper (DESIGN-PROMPT-v2) ---------- */
  K.THEMES = {
    masala: { name: 'Masala', paper: '#e7f6f1', a: '#7ae200', b: '#1aff7a', ink: '#1a0f14' },
    monsoon: { name: 'Monsoon', paper: '#eff2ee', a: '#2a0c1a', b: '#9a00a1', ink: '#2a0c1a' },
    night: { name: 'Night market', paper: '#f7f3f0', a: '#ff6a2c', b: '#3dc6ff', ink: '#2e140a' },
  };
  let themeKey = 'masala';
  try { const s = localStorage.getItem('zubin-theme'); if (s && K.THEMES[s]) themeKey = s; } catch (e) {}
  K.theme = () => K.THEMES[themeKey];
  K.themeKey = () => themeKey;
  function paintTheme() {
    const t = K.theme(), r = document.documentElement.style;
    r.setProperty('--paper', t.paper); r.setProperty('--a', t.a); r.setProperty('--b', t.b); r.setProperty('--ink', t.ink);
    document.documentElement.dataset.theme = themeKey;
    document.querySelectorAll('[data-theme-pick]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.themePick === themeKey)));
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = t.paper;
  }
  paintTheme();
  // circular wipe from the swatch that was clicked (View Transitions where available)
  K.setTheme = (key, x, y) => {
    if (!K.THEMES[key] || key === themeKey) return;
    const apply = () => { themeKey = key; try { localStorage.setItem('zubin-theme', key); } catch (e) {} paintTheme(); document.dispatchEvent(new CustomEvent('theme')); };
    if (RM || !document.startViewTransition) return apply();
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const vt = document.startViewTransition(apply);
    vt.ready.then(() => document.documentElement.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] }, { duration: 900, easing: 'cubic-bezier(.7,0,.2,1)', pseudoElement: '::view-transition-new(root)' })).catch(() => {});
  };
  K.bindThemePicker = (root = document) => {
    const btns = [...root.querySelectorAll('[data-theme-pick]')];
    btns.forEach((b, i) => {
      b.addEventListener('click', (e) => { const r = b.getBoundingClientRect(); K.setTheme(b.dataset.themePick, r.left + r.width / 2, r.top + r.height / 2); });
      b.addEventListener('keydown', (e) => { const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0; if (!d) return; e.preventDefault(); const n = btns[(i + d + btns.length) % btns.length]; n.focus(); n.click(); });
    });
    paintTheme();
  };

  /* ---------- smooth scroll on the one clock ---------- */
  K.lenis = null;
  if (!RM && window.Lenis) {
    K.lenis = new Lenis({ lerp: .1, wheelMultiplier: 1 });
    K.lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => K.lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  K.scrollTo = (target) => { const el = typeof target === 'string' ? document.querySelector(target) : target; if (!el) return; K.lenis ? K.lenis.scrollTo(el, { offset: -10, duration: 1.2 }) : el.scrollIntoView({ behavior: RM ? 'auto' : 'smooth' }); };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]'); if (!a) return; const h = a.getAttribute('href'); if (h.length < 2) return;
    const t = document.querySelector(h); if (!t) return; e.preventDefault(); K.scrollTo(t);
  });

  /* ---------- escape + helpers ---------- */
  K.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  K.$ = (s, r = document) => r.querySelector(s);
  K.$$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- cursor: a registration crosshair printed in two inks.
     Ink A sits on the pointer; ink B lags and lands a few px off, like a
     misregistered pass. Links turn it 45 degrees, view targets stamp a label ---------- */
  const REG = '<svg viewBox="-20 -20 40 40" aria-hidden="true"><circle r="6"/><path d="M-18 0H-9M9 0H18M0 -18V-9M0 9V18"/></svg>';
  K.initCursor = () => {
    if (!FINE || RM) return;
    document.documentElement.classList.add('has-cursor');
    const a = document.createElement('div'); a.className = 'reg reg-a'; a.innerHTML = REG + '<span class="reg-label"></span>';
    const b = document.createElement('div'); b.className = 'reg reg-b'; b.innerHTML = REG;
    document.body.append(b, a);
    const lab = a.querySelector('.reg-label');
    const ax = gsap.quickTo(a, 'x', { duration: .05, ease: 'none' }), ay = gsap.quickTo(a, 'y', { duration: .05, ease: 'none' });
    const bx = gsap.quickTo(b, 'x', { duration: .38, ease: 'power3' }), by = gsap.quickTo(b, 'y', { duration: .38, ease: 'power3' });
    let state = '';
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      ax(e.clientX); ay(e.clientY); bx(e.clientX + 3); by(e.clientY + 2);
      a.classList.add('on'); b.classList.add('on');
      const t = e.target;
      const v = t.closest('[data-cursor]'); let s = '', l = '';
      if (v) { s = 'view'; l = v.dataset.cursorLabel || ''; }
      else if (t.closest('input[type=text],input:not([type]),textarea,[contenteditable]')) s = 'text';
      else if (t.closest('a,button,label,[role=button],input,summary,select')) s = 'link';
      else if (t.closest('[data-ink]')) s = 'ink';
      const key = s + l;
      if (key !== state) { state = key; a.dataset.state = b.dataset.state = s; lab.textContent = l; }
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => { a.classList.remove('on'); b.classList.remove('on'); });
    addEventListener('pointerdown', () => { a.classList.add('down'); b.classList.add('down'); }); addEventListener('pointerup', () => { a.classList.remove('down'); b.classList.remove('down'); });
  };

  /* ---------- sticker press: buttons squash flat when pressed, then spring back ---------- */
  K.press = (root = document) => {
    if (RM) return;
    K.$$('[data-press]', root).forEach((el) => {
      el.addEventListener('pointerdown', () => {
        gsap.fromTo(el, { scaleX: 1.08, scaleY: .82, rotation: (Math.random() - .5) * 5 }, { scaleX: 1, scaleY: 1, rotation: 0, duration: .75, ease: 'elastic.out(1,.35)', overwrite: true });
      });
    });
  };

  /* ---------- click bursts: riso ink drops in both inks ---------- */
  K.burst = (x, y, n = 14, scale = 1) => {
    if (RM) return;
    const t = K.theme();
    for (let i = 0; i < n; i++) {
      const d = document.createElement('i'); d.className = 'drop';
      const s = (6 + Math.random() * 14) * scale; const c = Math.random() > .5 ? t.a : t.b;
      d.style.cssText = `left:${x}px;top:${y}px;width:${s}px;height:${s}px;background:${c}`;
      document.body.appendChild(d);
      const a = Math.random() * Math.PI * 2, v = (60 + Math.random() * 160) * scale;
      gsap.timeline({ onComplete: () => d.remove() })
        .to(d, { x: Math.cos(a) * v, y: Math.sin(a) * v - 40 * scale, rotation: Math.random() * 360, duration: .45, ease: 'power3.out' })
        .to(d, { y: '+=' + (120 + Math.random() * 160), opacity: 0, scale: .4, duration: .9, ease: 'power2.in' }, '>-0.05');
    }
  };
  K.initBursts = () => {
    if (RM) return;
    addEventListener('pointerdown', (e) => {
      if (e.button > 0 || e.target.closest('input,textarea,select,.sticker,[data-noburst],.ba-handle,.hero-sheet')) return;
      K.burst(e.clientX, e.clientY, 9, .8);
    }, { passive: true });
  };

  /* ---------- page change: a print roller pulls a sheet of ink A (with ink B
     off-register under it) across the screen, left to right ---------- */
  K.initWipe = () => {
    const w = document.createElement('div'); w.className = 'pull'; w.setAttribute('aria-hidden', 'true');
    w.innerHTML = '<div class="pull-sheet"><div class="pull-b"></div><div class="pull-a"><span class="mono">Pulling the next proof</span></div><div class="pull-roller"></div></div>';
    document.body.appendChild(w);
    const sheet = w.firstChild;
    let flagged = false; try { flagged = sessionStorage.getItem('zubin-pull') === '1'; sessionStorage.removeItem('zubin-pull'); } catch (e) {}
    if (flagged && !RM) { gsap.set(sheet, { xPercent: 0 }); gsap.to(sheet, { xPercent: 110, duration: .85, ease: 'power2.inOut', delay: .1 }); }
    else gsap.set(sheet, { xPercent: 110 });
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]'); if (!a) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank' || a.hasAttribute('download')) return;
      const href = a.getAttribute('href'); if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      const url = new URL(a.href, location.href); if (url.origin !== location.origin || /\.(pdf|jpg|png|mp4)$/i.test(url.pathname)) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      e.preventDefault();
      try { sessionStorage.setItem('zubin-pull', '1'); } catch (er) {}
      if (RM) { location.href = a.href; return; }
      gsap.fromTo(sheet, { xPercent: -110 }, { xPercent: 0, duration: .7, ease: 'power2.inOut', onComplete: () => { location.href = a.href; } });
    });
    addEventListener('pageshow', (e) => { if (e.persisted) gsap.set(sheet, { xPercent: 110 }); });
  };

  /* ---------- numbers print in two passes: ink B lands off-register, ink A
     stamps on top, then B springs into register ---------- */
  K.flap = (el, text) => {
    text = String(text ?? el.dataset.flap ?? el.textContent);
    el.setAttribute('aria-label', text);
    if (RM) { el.textContent = text; return; }
    el.innerHTML = `<span class="pp" aria-hidden="true"><span class="pp-b">${K.esc(text)}</span><span class="pp-a">${K.esc(text)}</span></span>`;
    const b = el.querySelector('.pp-b'), a = el.querySelector('.pp-a');
    gsap.timeline()
      .fromTo(b, { x: 14, y: 9, opacity: 0 }, { opacity: 1, duration: .16, ease: 'none' })
      .fromTo(a, { opacity: 0, scale: 1.3 }, { opacity: 1, scale: 1, duration: .32, ease: 'back.out(2.4)' }, '+=.14')
      .to(b, { x: 2, y: 1.5, duration: .9, ease: 'elastic.out(1,.4)' }, '<.05');
  };
  K.flapOnView = (root = document) => {
    K.$$('[data-flap]', root).forEach((el) => {
      el.textContent = el.dataset.flap;
      ScrollTrigger.create({ trigger: el, start: 'top 88%', onEnter: () => K.flap(el), onEnterBack: () => K.flap(el) });
    });
  };

  /* ---------- misregistration jitter: ink B shakes off-register, then settles ---------- */
  K.jitter = (el) => {
    if (RM || !el || el._jit) return; el._jit = true;
    const tl = gsap.timeline({ onComplete: () => { el._jit = false; } });
    for (let i = 0; i < 5; i++) tl.to(el, { '--jx': (Math.random() - .5) * 16 + 'px', '--jy': (Math.random() - .5) * 10 + 'px', duration: .05, ease: 'none' });
    tl.to(el, { '--jx': '3px', '--jy': '2px', duration: .7, ease: 'elastic.out(1,.35)' });
  };

  /* ---------- velocity marquee (Pulp Parade + Scruff skew) ---------- */
  K.marquee = (row, reverse = false) => {
    const track = row.querySelector('.mq-track'); if (!track) return;
    const html = track.innerHTML; track.innerHTML = html + html + html + html;
    if (RM) return;
    let x = 0, speed = 1.2, dir = reverse ? -1 : 1, last = scrollY, vis = true, sk = 0;
    new IntersectionObserver((e) => { vis = e[0].isIntersecting; }).observe(row);
    gsap.ticker.add((t, dms) => {
      const dy = scrollY - last; last = scrollY;
      if (!vis) return;
      const target = 1.2 + Math.min(40, Math.abs(dy)) * .35; speed += (target - speed) * .12;
      if (Math.abs(dy) > 1) dir = (dy > 0 ? 1 : -1) * (reverse ? -1 : 1);
      sk += (Math.max(-8, Math.min(8, dy * .25)) - sk) * .15;
      const q = track.scrollWidth / 4; x -= speed * dir * (dms / 16.7);
      if (x <= -q) x += q; if (x > 0) x -= q;
      track.style.transform = `translate3d(${x}px,0,0) skewX(${(-sk).toFixed(2)}deg)`;
    });
  };

  /* ---------- reveals (the floor): fade up, replays on re-entry ---------- */
  K.reveals = (root = document) => {
    if (RM) return;
    K.$$('[data-reveal]', root).forEach((el) => {
      gsap.fromTo(el, { y: 34, opacity: 0 }, { y: 0, opacity: 1, duration: .9, ease: 'power3.out', delay: +(el.dataset.revealDelay || 0), scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none reset' } });
    });
  };

  /* ---------- 3D tilt with glare (Skerry) ---------- */
  K.tilt = (el, max = 10) => {
    if (!FINE || RM) return;
    const rx = gsap.quickTo(el, 'rotationX', { duration: .5, ease: 'power3' }), ry = gsap.quickTo(el, 'rotationY', { duration: .5, ease: 'power3' });
    gsap.set(el, { transformPerspective: 900 });
    el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; rx((.5 - y) * max); ry((x - .5) * max * 1.15); el.style.setProperty('--gx', x * 100 + '%'); el.style.setProperty('--gy', y * 100 + '%'); });
    el.addEventListener('pointerleave', () => { rx(0); ry(0); });
  };

  K.boot = () => { K.initCursor(); K.initBursts(); K.initWipe(); K.press(); K.bindThemePicker(); };
  window.K = K;
})();
