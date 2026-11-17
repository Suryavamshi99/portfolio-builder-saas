/* ==========================================================================
   core.js — shared engine for every page
   Lenis + GSAP on one clock, the Kai Moreno ring-and-dot cursor, magnetic
   buttons, glyph decode / scramble, page wipe with a session flag, split-flap
   numbers, click bursts, a scroll-velocity marquee and small helpers.
   Lifted and cleaned up from kai-moreno/assets/sections-BaDaZOlX.js
   (decode, scramble, magnetic, cursor, wipe) and the shared Lenis core.
   ========================================================================== */
(function () {
  const K = (window.K = {});
  const mm = (q) => matchMedia(q).matches;
  K.reduce = mm('(prefers-reduced-motion: reduce)');
  K.fine = mm('(hover: hover) and (pointer: fine)');
  K.$ = (s, r = document) => r.querySelector(s);
  K.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- text helpers ---------- */
  K.esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  // ==phrase== -> highlighter mark, *word* -> italic accent
  K.md = (s) => K.esc(s).replace(/==([^=]+)==/g, '<mark>$1</mark>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
  K.plain = (s) => String(s ?? '').replace(/==/g, '').replace(/\*/g, '');
  K.has = (v) => v != null && !(Array.isArray(v) && !v.length) && !(typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length) && v !== '';

  K.load = async () => {
    const r = await fetch('content/portfolio.json', { cache: 'no-cache' });
    const d = await r.json();
    K.data = d;
    if (d.meta && d.meta.noindex && !K.$('meta[name="robots"]')) {
      const m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex'; document.head.appendChild(m);
    }
    return d;
  };

  /** ?for=Company — escaped and capped, letters, digits, spaces and . & - only */
  K.forCompany = () => {
    const raw = new URLSearchParams(location.search).get('for');
    if (!raw) return null;
    const v = raw.replace(/[^\p{L}\p{N} .&'-]/gu, '').trim().slice(0, 32);
    return v || null;
  };

  /* ---------- Lenis on the GSAP ticker (one clock for everything) ---------- */
  K.initScroll = () => {
    gsap.registerPlugin(ScrollTrigger);
    if (K.reduce || !window.Lenis) return null;
    const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    K.lenis = lenis;
    return lenis;
  };
  K.scrollTo = (target, opts = {}) => {
    if (K.lenis) K.lenis.scrollTo(target, Object.assign({ offset: -10, duration: 1.3 }, opts));
    else {
      const el = typeof target === 'string' ? K.$(target) : target;
      if (typeof target === 'number') scrollTo({ top: target, behavior: K.reduce ? 'auto' : 'smooth' });
      else el && el.scrollIntoView({ behavior: K.reduce ? 'auto' : 'smooth' });
    }
  };

  /* ---------- decode / scramble (Kai: [data-decode], [data-scramble]) ---------- */
  const GLYPHS = '01<>/\\[]{}()=+*#%&$@!?;:~^';
  const store = new WeakMap();
  function split(el) {
    if (store.get(el)) return store.get(el);
    const chars = [];
    const label = el.textContent || '';
    const walk = (node, into) => {
      node.childNodes.forEach((n) => {
        if (n.nodeType === 3) {
          (n.textContent || '').split(/(\s+)/).forEach((w) => {
            if (!w) return;
            if (/^\s+$/.test(w)) { into.appendChild(document.createTextNode(' ')); return; }
            const word = document.createElement('span'); word.className = 'dw';
            for (const ch of w) { const c = document.createElement('span'); c.className = 'dc'; c.textContent = ch; word.appendChild(c); chars.push({ ch }); }
            into.appendChild(word);
          });
        } else if (n.nodeName === 'BR') into.appendChild(n.cloneNode());
        else if (n.nodeType === 1) { const c = n.cloneNode(false); into.appendChild(c); walk(n, c); }
      });
    };
    const tmp = document.createElement('div'); walk(el, tmp);
    el.setAttribute('aria-label', label.trim());
    el.innerHTML = tmp.innerHTML;
    K.$$('.dc', el).forEach((c, i) => { chars[i].el = c; c.setAttribute('aria-hidden', 'true'); });
    const st = { chars, done: true };
    store.set(el, st);
    return st;
  }
  const settle = (st) => { st.chars.forEach((c) => { c.el.textContent = c.ch; c.el.className = 'dc'; c.el.style.width = ''; }); st.done = true; };
  const hide = (st) => { st.tween && st.tween.kill(); st.chars.forEach((c) => { c.el.className = 'dc dc-off'; }); st.done = false; };
  K.hideDecode = (el) => hide(split(el));
  /** force the final text now (a timer guarantee in case rAF is throttled) */
  K.settleDecode = (el) => { const st = split(el); st.tween && st.tween.kill(); settle(st); };
  K.decode = (el, o = {}) => {
    const st = split(el);
    if (K.reduce) { settle(st); return; }
    st.tween && st.tween.kill();
    const n = st.chars.length;
    st.chars.forEach((c) => { c.el.className = 'dc'; c.el.textContent = c.ch; c.el.style.width = ''; });
    st.chars.forEach((c) => { c.w = c.el.getBoundingClientRect().width; });
    st.chars.forEach((c, i) => { c.at = (i / Math.max(1, n - 1)) * 0.78 + Math.random() * 0.14; });
    st.chars.forEach((c) => { c.el.className = 'dc dc-off'; });
    st.done = false;
    const p = { v: 0 }; let f = 0;
    st.tween = gsap.to(p, {
      v: 1, duration: o.duration ?? 1.15, delay: o.delay ?? 0, ease: 'none',
      onUpdate: () => {
        f++; const flip = f % 2 === 0;
        for (const c of st.chars) {
          const l = p.v - c.at;
          if (l < -0.2) { if (c.el.className !== 'dc dc-off') c.el.className = 'dc dc-off'; }
          else if (l < 0.08) {
            if (c.el.className !== 'dc dc-g') { c.el.className = 'dc dc-g'; c.el.style.width = c.w + 'px'; }
            if (flip || !c.el.textContent) c.el.textContent = GLYPHS[(Math.random() * GLYPHS.length) | 0];
          } else if (c.el.className !== 'dc') { c.el.className = 'dc'; c.el.textContent = c.ch; c.el.style.width = ''; }
        }
      },
      onComplete: () => settle(st),
    });
  };
  K.initDecode = (root = document) => {
    const els = K.$$('[data-decode]', root);
    if (!els.length) return;
    if (K.reduce) { els.forEach((e) => settle(split(e))); return; }
    els.forEach((e) => hide(split(e)));
    const io = new IntersectionObserver((es) => es.forEach((en) => {
      const st = split(en.target);
      if (en.isIntersecting) { if (!st.done) K.decode(en.target, { delay: parseFloat(en.target.dataset.decodeDelay || '0') }); }
      else if (en.boundingClientRect.top > 0) hide(st);
    }), { threshold: 0.2, rootMargin: '0px 0px -6% 0px' });
    els.forEach((e) => io.observe(e));
  };
  K.initScramble = (root = document) => {
    if (!K.fine || K.reduce) return;
    K.$$('[data-scramble]', root).forEach((el) => {
      if (el.dataset.scrReady) return; el.dataset.scrReady = '1';
      const host = el.closest('a, button, [data-row]') || el;
      let lock = false;
      host.addEventListener('pointerenter', () => {
        if (lock) return; lock = true;
        K.decode(el, { duration: 0.55 });
        gsap.delayedCall(0.6, () => { lock = false; });
      });
    });
  };

  /* ---------- magnetic (Kai [data-magnetic]) ---------- */
  K.initMagnetic = (root = document) => {
    if (!K.fine || K.reduce) return;
    K.$$('[data-magnetic]', root).forEach((el) => {
      if (el.dataset.magReady) return; el.dataset.magReady = '1';
      const qx = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.5)' });
      const qy = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.5)' });
      const s = parseFloat(el.dataset.magnetic) || 0.35;
      let inside = false;
      addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        if (Math.hypot(dx, dy) < Math.max(r.width, r.height) * 0.75 + 36) { inside = true; qx(dx * s); qy(dy * s); }
        else if (inside) { inside = false; qx(0); qy(0); }
      }, { passive: true });
    });
  };

  /* ---------- cursor: ring + dot with view / link / text / lens states (Kai) ---------- */
  K.initCursor = () => {
    if (!K.fine || K.reduce) return;
    const ring = document.createElement('div'); ring.className = 'cur-ring'; ring.setAttribute('aria-hidden', 'true');
    ring.innerHTML = '<span class="cur-label"></span>';
    const dot = document.createElement('div'); dot.className = 'cur-dot'; dot.setAttribute('aria-hidden', 'true');
    document.body.append(ring, dot);
    document.documentElement.classList.add('has-cursor');
    gsap.set([ring, dot], { xPercent: -50, yPercent: -50, x: -100, y: -100 });
    const rx = gsap.quickTo(ring, 'x', { duration: 0.42, ease: 'power3' }), ry = gsap.quickTo(ring, 'y', { duration: 0.42, ease: 'power3' });
    const dx = gsap.quickTo(dot, 'x', { duration: 0.06, ease: 'none' }), dy = gsap.quickTo(dot, 'y', { duration: 0.06, ease: 'none' });
    const label = ring.querySelector('.cur-label');
    let state = '';
    const set = (s, text) => {
      if (s === state && (s !== 'view' || label.textContent === text)) return;
      state = s; ring.dataset.state = s; label.textContent = s === 'view' ? text || 'View' : '';
      gsap.to(ring, { scale: s === 'view' ? 2.6 : s === 'link' ? 1.9 : s === 'text' ? 0.5 : s === 'lens' ? 0.001 : s === 'drag' ? 2.1 : 1, duration: 0.4, ease: 'power3.out', overwrite: 'auto' });
      gsap.to(dot, { scale: s === 'view' || s === 'link' ? 0 : s === 'lens' ? 1.6 : 1, duration: 0.25, overwrite: 'auto' });
    };
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      rx(e.clientX); ry(e.clientY); dx(e.clientX); dy(e.clientY);
      const t = e.target; if (!t || !t.closest) return;
      const v = t.closest('[data-cursor]');
      if (v && v.dataset.cursor === 'lens') set('lens');
      else if (v && v.dataset.cursor === 'drag') set('drag');
      else if (v) set('view', v.dataset.cursorLabel || 'View');
      else if (t.closest('a, button, summary, [data-magnetic], label, [role="button"], input[type="range"]')) set('link');
      else if (t.closest('input, textarea, select')) set('text');
      else set('');
    }, { passive: true });
    document.addEventListener('pointerleave', () => gsap.to([ring, dot], { opacity: 0, duration: 0.2 }));
    document.addEventListener('pointerenter', () => gsap.to([ring, dot], { opacity: 1, duration: 0.2 }));
    addEventListener('pointerdown', () => gsap.to(ring, { scale: '*=0.8', duration: 0.12, yoyo: true, repeat: 1 }));
  };

  /* ---------- page wipe (Kai/Ada): cover -> navigate -> next page uncovers ---------- */
  const WIPE = 'km-wipe';
  K.initWipe = () => {
    const w = K.$('.wipe'); if (!w) return;
    let flag = false;
    try { flag = sessionStorage.getItem(WIPE) === '1'; sessionStorage.removeItem(WIPE); } catch (e) {}
    if (flag && !K.reduce) {
      gsap.set(w, { y: 0, yPercent: 0 });
      document.documentElement.classList.remove('wipe-in');
      gsap.to(w, { yPercent: 101, duration: 0.8, ease: 'power3.inOut', delay: 0.12, onComplete: () => gsap.set(w, { y: 0, yPercent: -101 }) });
    } else { document.documentElement.classList.remove('wipe-in'); gsap.set(w, { y: 0, yPercent: -101 }); }
    addEventListener('pageshow', (e) => { if (e.persisted) gsap.set(w, { y: 0, yPercent: -101 }); });
    document.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest('a[href]');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      const same = url.pathname.replace(/\/$/, '/index.html') === location.pathname.replace(/\/$/, '/index.html');
      if (same && url.hash) {
        e.preventDefault();
        const t = url.hash === '#top' ? 0 : K.$(url.hash);
        if (t !== null) K.scrollTo(t);
        return;
      }
      if (same && url.search === location.search) { e.preventDefault(); return; }
      if (/\.(pdf|jpg|png|mp4)$/i.test(url.pathname)) return;
      e.preventDefault();
      if (K.reduce) { location.href = a.href; return; }
      try { sessionStorage.setItem(WIPE, '1'); } catch (er) {}
      const lab = K.$('.wipe-label', w); if (lab) lab.textContent = a.dataset.wipe || a.textContent.trim().slice(0, 48);
      gsap.set(w, { y: 0, yPercent: -101 });
      gsap.to(w, { yPercent: 0, duration: 0.6, ease: 'power3.inOut', onComplete: () => { location.href = a.href; } });
    });
  };

  /* ---------- split-flap text (Kokonut "split flap" port) ---------- */
  const FLAP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789%−+→';
  K.flap = (el, text, o = {}) => {
    text = String(text);
    if (K.reduce || o.instant) { el.innerHTML = [...text].map((c) => `<span class="fl${c === ' ' ? ' sp' : ''}"><i>${K.esc(c)}</i></span>`).join(''); el.setAttribute('aria-label', text); return; }
    el.setAttribute('aria-label', text);
    const chars = [...text];
    el.innerHTML = chars.map((c) => `<span class="fl${c === ' ' ? ' sp' : ''}" aria-hidden="true"><i>${c === ' ' ? ' ' : K.esc(FLAP[(Math.random() * FLAP.length) | 0])}</i></span>`).join('');
    K.$$('.fl', el).forEach((cell, i) => {
      const c = chars[i]; if (c === ' ') return;
      const inner = cell.firstChild;
      const flips = (o.flips || 5) + ((Math.random() * 3) | 0);
      const tl = gsap.timeline({ delay: (o.delay || 0) + i * (o.stagger ?? 0.045) });
      for (let k = 0; k < flips; k++) {
        const last = k === flips - 1;
        tl.to(inner, { rotateX: -90, duration: 0.05, ease: 'power1.in' })
          .call(() => { inner.textContent = last ? c : FLAP[(Math.random() * FLAP.length) | 0]; })
          .fromTo(inner, { rotateX: 90 }, { rotateX: 0, duration: last ? 0.14 : 0.05, ease: last ? 'back.out(2.2)' : 'power1.out' });
      }
    });
  };
  /** flap when scrolled into view (re-arms when it leaves below) */
  K.initFlaps = (root = document) => {
    const els = K.$$('[data-flap]', root);
    const io = new IntersectionObserver((es) => es.forEach((en) => {
      const el = en.target;
      if (en.isIntersecting && !el._flapped) { el._flapped = true; K.flap(el, el.dataset.flap, { delay: parseFloat(el.dataset.flapDelay || 0) }); }
      else if (!en.isIntersecting && en.boundingClientRect.top > 0 && el._flapped) { el._flapped = false; }
    }), { threshold: 0.4 });
    els.forEach((el) => { K.flap(el, el.dataset.flap, { instant: true }); io.observe(el); });
  };

  /* ---------- click burst in the site's motif: drafting crosses and highlighter chips ---------- */
  K.initBurst = () => {
    if (K.reduce) return;
    addEventListener('pointerdown', (e) => {
      if (e.target.closest('input, textarea, select, [data-noburst], .rice-card, .lens-zone')) return;
      K.burst(e.clientX, e.clientY);
    });
  };
  K.burst = (x, y, o = {}) => {
    if (K.reduce) return;
    const n = o.n || 12;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      const kind = i % 3;
      p.className = 'burst ' + (o.dust ? 'b-dust' : kind === 0 ? 'b-cross' : kind === 1 ? 'b-chip' : 'b-tick');
      p.style.left = x + 'px'; p.style.top = y + 'px';
      document.body.appendChild(p);
      const a = Math.random() * Math.PI * 2, d = (o.spread || 70) + Math.random() * (o.spread || 70);
      gsap.fromTo(p, { x: 0, y: 0, rotation: Math.random() * 90, scale: 0.4 + Math.random() * 0.8, opacity: 1 }, {
        x: Math.cos(a) * d, y: Math.sin(a) * d + (o.dust ? 40 : 26), rotation: '+=' + (Math.random() * 360 - 180),
        opacity: 0, duration: 0.8 + Math.random() * 0.7, ease: 'power3.out', onComplete: () => p.remove(),
      });
    }
  };

  /* ---------- velocity marquee (Pulp Parade: speed and direction follow the scroll) ---------- */
  K.initMarquee = (el) => {
    const track = K.$('.mq-track', el); if (!track) return;
    const run = track.innerHTML; track.innerHTML = run + run + run + run;
    if (K.reduce) return;
    let x = 0, v = 0, dir = 1, lastY = scrollY;
    gsap.ticker.add((t, dt) => {
      const y = scrollY, d = y - lastY; lastY = y;
      if (Math.abs(d) > 0.5) dir = d > 0 ? 1 : -1;
      v += (Math.abs(d) - v) * 0.12;
      const speed = (1.1 + v * 0.35) * dir * (el.dataset.reverse ? -1 : 1);
      const q = track.scrollWidth / 4;
      x -= speed * (dt / 16.7);
      if (x <= -q) x += q; if (x > 0) x -= q;
      track.style.transform = `translate3d(${x}px,0,0) skewX(${gsap.utils.clamp(-8, 8, -d * 0.25 * dir * dir)}deg)`;
    });
  };

  /* ---------- reveal (the floor: fade-up, re-arms when scrolled back) ---------- */
  K.initReveal = (root = document) => {
    const els = K.$$('[data-reveal]', root);
    if (K.reduce) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((es) => es.forEach((en) => {
      if (en.isIntersecting) en.target.classList.add('in');
      else if (en.boundingClientRect.top > 0) en.target.classList.remove('in');
    }), { threshold: 0.12 });
    els.forEach((e) => io.observe(e));
  };

  /* ---------- word-mask rise (shared kit headline intro) ---------- */
  K.words = (el) => {
    const txt = el.innerHTML;
    el.setAttribute('aria-label', el.textContent.trim());
    const tmp = document.createElement('div'); tmp.innerHTML = txt;
    const out = [];
    const walk = (node, wrapStart, wrapEnd) => {
      node.childNodes.forEach((n) => {
        if (n.nodeType === 3) n.textContent.split(/(\s+)/).forEach((w) => { if (!w) return; out.push(/^\s+$/.test(w) ? ' ' : `<span class="w-mask" aria-hidden="true"><span class="w">${wrapStart}${K.esc(w)}${wrapEnd}</span></span>`); });
        else if (n.nodeType === 1) { const tag = n.tagName.toLowerCase(); walk(n, wrapStart + `<${tag}>`, `</${tag}>` + wrapEnd); }
      });
    };
    walk(tmp, '', '');
    el.innerHTML = out.join('');
    return K.$$('.w', el);
  };

  /* ---------- fit giant type to a width (measures the widest line) ---------- */
  K.fit = (el, frac, max) => {
    const run = () => {
      const lines = el.querySelectorAll('.nl, .fit-line'); const host = el.parentElement;
      const target = host.clientWidth * frac;
      el.style.fontSize = '100px';
      let w = 0; (lines.length ? lines : [el]).forEach((l) => { w = Math.max(w, l.scrollWidth); });
      let fs = 100 * target / Math.max(1, w);
      if (max) fs = Math.min(fs, max * innerWidth);
      el.style.fontSize = fs.toFixed(2) + 'px';
    };
    run(); addEventListener('resize', run); document.fonts && document.fonts.ready.then(run);
    return run;
  };

  /* ---------- live clock ---------- */
  K.initClock = (tz) => {
    const f = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: tz || 'America/New_York' });
    const f2 = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz || 'America/New_York' });
    const tick = () => {
      const d = new Date();
      K.$$('[data-clock]').forEach((e) => { e.textContent = f.format(d); });
      K.$$('[data-clock-short]').forEach((e) => { e.textContent = f2.format(d); });
    };
    tick(); setInterval(tick, 1000);
  };

  /* ---------- copy to clipboard ---------- */
  K.copy = async (s) => {
    try { await navigator.clipboard.writeText(s); return true; } catch (e) {}
    try {
      const t = document.createElement('textarea'); t.value = s; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return ok;
    } catch (e) { return false; }
  };

  /* ---------- spotlight cards (Magic UI / 21st.dev port): one listener per grid ---------- */
  K.initSpotlight = (grid) => {
    grid.addEventListener('pointermove', (e) => {
      K.$$('.spot', grid).forEach((c) => {
        const r = c.getBoundingClientRect();
        c.style.setProperty('--x', (e.clientX - r.left) + 'px');
        c.style.setProperty('--y', (e.clientY - r.top) + 'px');
      });
    }, { passive: true });
  };

  /* ---------- 3D tilt with glare (Skerry [data-tilt]) ---------- */
  K.initTilt = (root = document) => {
    if (!K.fine || K.reduce) return;
    K.$$('[data-tilt]', root).forEach((el) => {
      gsap.set(el, { transformPerspective: 900 });
      const rx = gsap.quickTo(el, 'rotationX', { duration: 0.5, ease: 'power3' }), ry = gsap.quickTo(el, 'rotationY', { duration: 0.5, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect(), nx = (e.clientX - r.left) / r.width, ny = (e.clientY - r.top) / r.height;
        rx((0.5 - ny) * 16); ry((nx - 0.5) * 18);
        el.style.setProperty('--gx', nx * 100 + '%'); el.style.setProperty('--gy', ny * 100 + '%');
      });
      el.addEventListener('pointerleave', () => { rx(0); ry(0); });
    });
  };

  /* ---------- typewriter ---------- */
  K.type = (el, text, o = {}) => {
    el._typeTl && el._typeTl.kill();
    if (K.reduce) { el.textContent = text; return; }
    const p = { n: 0 };
    el._typeTl = gsap.to(p, { n: text.length, duration: Math.min(3.2, text.length * (o.cps || 0.014)), ease: 'none', delay: o.delay || 0,
      onUpdate: () => { el.textContent = text.slice(0, Math.round(p.n)); }, onComplete: () => { el.textContent = text; } });
  };

  /* ---------- nav + footer chrome shared by both pages ---------- */
  K.chrome = (d, page) => {
    const p = d.person, s = d.site || {};
    const nav = K.$('#nav');
    if (nav) {
      const links = (s.nav || []).map(([id, label]) => `<li><a href="${page === 'home' ? '#' + id : 'index.html#' + id}"><span data-scramble>${K.esc(label)}</span></a></li>`).join('');
      nav.innerHTML = `
        <a class="brand" href="index.html" data-wipe="Home"><i class="brand-mark" aria-hidden="true">AR</i><span>${K.esc(p.first_name)} ${K.esc(p.last_name)}</span></a>
        <ul class="nav-links">${links}</ul>
        <div class="nav-r mono">
          <span class="avail"><i class="dot-live" aria-hidden="true"></i>${K.esc(s.status_prefix || 'Available from')} ${K.esc(p.available_from)}</span>
          <span class="nav-clock">${K.esc((s.city || '').toUpperCase())} <b data-clock-short>--:--</b> ET</span>
          <span data-magnetic class="mag"><a class="pill pill-solid sm" href="${page === 'home' ? '#contact' : 'index.html#contact'}" aria-label="Get in touch"><span class="pill-full">Get in touch</span><span class="pill-short">Contact</span></a></span>
        </div>`;
      const onS = () => nav.classList.toggle('is-scrolled', scrollY > 40);
      addEventListener('scroll', onS, { passive: true }); onS();
    }
  };

  K.footer = (d) => {
    const f = K.$('#foot'); if (!f) return;
    const p = d.person, c = d.contact;
    f.innerHTML = `
      <div class="foot-word" aria-hidden="true"><span class="fit-line"><span>${K.esc(p.first_name)}</span> <em>${K.esc(p.last_name)}</em></span></div>
      <div class="wrap foot-in mono">
        <span>© ${new Date().getFullYear()} ${K.esc(p.first_name)} ${K.esc(p.last_name)}</span>
        <span>${K.esc((d.site && d.site.city) || '')} <b data-clock>--:--:--</b> ET</span>
        <a href="mailto:${K.esc(c.email)}">${K.esc(c.email)}</a>
        <a href="#top">Back to top ↑</a>
      </div>
      ${d.demo ? `<p class="wrap demo-note mono">Sample persona. ${K.esc(d.person.first_name)} is a fictional person; the employers, schools and colleagues are invented, and everything in her story, from projects to numbers to quotes, is made up.</p>` : ''}`;
  };

  K.boot = (d, page) => {
    K.chrome(d, page);
    K.footer(d);
    const fw = K.$('.foot-word'); fw && K.fit(fw, 0.97);
    K.initScroll();
    K.initWipe();
    K.initCursor();
    K.initMagnetic();
    K.initScramble();
    K.initBurst();
    K.initClock((d.site && d.site.timezone) || 'America/New_York');
  };
})();
