// Home page. Wiring follows Stillwater's main entry (bottom of index-hDvjrczZ.js): render, Lenis on the GSAP
// ticker, anchor scrolling, header state, the cloud and its hero copy, the opt-in drone, intro and reveals.
import { loadContent, printResume } from './content.js';
import { renderNav, fillHero, renderSections, wireTerms, wireForm, cardData } from './sections.js';
import { mountDots } from './dots.js';
import { mountTrap } from './trap.js';
import { hasWebGL, makeCloud, SLOPE } from './cloud.js';
import { mountCursor } from './cursor.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ss = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const waitFor = (name) => new Promise((res) => { const t = () => (window[name] ? res(window[name]) : setTimeout(t, 20)); t(); });

/* Lenis on the GSAP ticker (Stillwater rg) */
function initLenis() {
  if (reduced || !window.Lenis) return null;
  const lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 1 });
  lenis.on('scroll', window.ScrollTrigger.update);
  window.gsap.ticker.add((t) => lenis.raf(t * 1000));
  window.gsap.ticker.lagSmoothing(0);
  return lenis;
}

/* split the headline into masked words (Stillwater sg) */
function splitWords(el) {
  const out = document.createElement('div');
  const walk = (node, into) => node.childNodes.forEach((n) => {
    if (n.nodeType === 3) {
      n.textContent.split(/(\s+)/).forEach((w) => {
        if (!w) return;
        if (/^\s+$/.test(w)) { into.appendChild(document.createTextNode(' ')); return; }
        const m = document.createElement('span'); m.className = 'w-mask';
        m.style.cssText = 'display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:.12em;margin-bottom:-.12em';
        const s = document.createElement('span'); s.className = 'w'; s.style.display = 'inline-block'; s.textContent = w;
        m.appendChild(s); into.appendChild(m);
      });
    } else if (n.nodeType === 1) { const c = n.cloneNode(false); into.appendChild(c); walk(n, c); }
  });
  walk(el, out);
  el.setAttribute('aria-label', el.textContent || '');
  el.innerHTML = out.innerHTML;
  return Array.from(el.querySelectorAll('.w'));
}

function intro() {
  const gsap = window.gsap, words = splitWords(document.querySelector('[data-hero-headline]'));
  if (reduced) return;
  const all = (s) => Array.from(document.querySelectorAll(s));
  gsap.set('[data-intro]', { opacity: 0, y: 14 });
  gsap.set(words, { yPercent: 110, opacity: 0 });
  gsap.timeline({ defaults: { ease: 'power3.out' } })
    .to(all('[data-intro="nav"]'), { opacity: 1, y: 0, duration: 0.9 }, 0.1)
    .to(all('[data-intro="eyebrow"]'), { opacity: 1, y: 0, duration: 0.8 }, 0.3)
    .to(words, { yPercent: 0, opacity: 1, duration: 1, stagger: 0.06 }, 0.45)
    .to(all('[data-intro="sub"]'), { opacity: 1, y: 0, duration: 0.9 }, 1.05)
    .to(all('[data-intro="cta"]'), { opacity: 1, y: 0, duration: 0.8 }, 1.3)
    .to(all('[data-intro="proof"]'), { opacity: 1, y: 0, duration: 0.9 }, 1.6);
}

/* fade up on entry, re-arm when it leaves past the top (Stillwater og) */
function reveals() {
  const els = Array.from(document.querySelectorAll('[data-reveal]'));
  if (reduced) return;
  const gsap = window.gsap;
  gsap.set(els, { opacity: 0, y: 28 });
  const io = new IntersectionObserver((list) => list.forEach((e) => {
    const el = e.target, delay = parseFloat(el.dataset.revealDelay || '0');
    if (e.isIntersecting) gsap.to(el, { opacity: 1, y: 0, duration: 0.9, delay, ease: 'power3.out', overwrite: 'auto' });
    else if (e.boundingClientRect.top > 0) gsap.set(el, { opacity: 0, y: 28 });
  }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  els.forEach((el) => io.observe(el));
}

/* the opt-in drone (Stillwater by), its gain and filter follow the sampling cycle */
function makeDrone() {
  let ctx = null, gain = null, lp = null, on = false, level = 0;
  const build = () => {
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return false;
    ctx = new A(); gain = ctx.createGain(); gain.gain.value = 0;
    lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.4;
    lp.connect(gain).connect(ctx.destination);
    [[110, 0.5], [164.8, 0.3], [220.4, 0.16]].forEach(([f, g], i) => {
      const o = ctx.createOscillator(), v = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f; o.detune.value = i * 3; v.gain.value = g;
      o.connect(v).connect(lp); o.start();
    });
    return true;
  };
  return {
    toggle() {
      if (!ctx && !build()) return false;
      on = !on; ctx.resume();
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setTargetAtTime(on ? 0.05 + 0.05 * level : 0, t, on ? 0.9 : 0.5);
      return on;
    },
    set(v) {
      level = v;
      if (!on || !ctx) return;
      const t = ctx.currentTime;
      gain.gain.setTargetAtTime(0.04 + 0.07 * v, t, 0.25);
      lp.frequency.setTargetAtTime(280 + 600 * v, t, 0.25);
    },
  };
}

/* static fallback when there is no WebGL: the fitted line, drawn once in SVG */
function fallback(canvas) {
  let dots = '';
  let s = 7;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 260; i++) {
    const x = 20 + r() * 560, n = (r() + r() + r() - 1.5) * 90;
    const y = 300 - SLOPE * (x - 20) * 0.62 + n;
    dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1.6 + r() * 1.6).toFixed(1)}"/>`;
  }
  const div = document.createElement('div');
  div.className = 'stage-fallback';
  div.setAttribute('aria-hidden', 'true');
  div.innerHTML = `<svg viewBox="0 0 600 400"><g fill="var(--ink)" opacity=".75">${dots}</g><line x1="20" y1="300" x2="580" y2="${(300 - SLOPE * 560 * 0.62).toFixed(1)}" stroke="var(--aqua-deep)" stroke-width="2"/></svg>`;
  canvas.replaceWith(div);
  document.documentElement.classList.add('static-hero');
}

/* hero copy and readouts that follow the cloud (Stillwater Ty, plus the Contour-form HUD) */
function heroDriver(hero) {
  const copy = hero.querySelector('[data-hero-copy]'), mega = hero.querySelector('[data-mega]'), beats = Array.from(hero.querySelectorAll('[data-beat]'));
  const right = hero.querySelector('[data-foot-right]'), guide = hero.querySelector('[data-guide]');
  const phases = guide ? Array.from(guide.querySelectorAll('[data-phase]')) : [], bar = guide && guide.querySelector('[data-bar]');
  const dotsCyc = Array.from(document.querySelectorAll('.wm-dot, .kicker'));
  const hud = { n: document.getElementById('c-n'), r2: document.getElementById('c-r2'), cyc: document.getElementById('c-cycle'), shape: document.getElementById('c-shape') };
  const NAMES = ['SAMPLE', 'FIT', 'RESET'];
  let ems = [], lastPhase = -1, hudClock = 0;
  const cache = new Map();
  const put = (el, o, y) => {
    if (!el) return;
    const key = o.toFixed(3) + y.toFixed(1);
    if (cache.get(el) === key) return;
    cache.set(el, key);
    el.style.opacity = o.toFixed(3); el.style.transform = `translate3d(0,${y.toFixed(1)}px,0)`; el.style.visibility = o < 0.02 ? 'hidden' : 'visible';
  };
  return (s) => {
    const g = s.morph, cy = s.cycle;
    if (!reduced) {
      const a = 1 - ss((g - 0.08) / 0.4); put(copy, a, -(1 - a) * 22);
      { const m = 1 - ss((g - 0.15) / 0.45); put(mega, m, (1 - m) * 60); }
      { const i = ss((g - 0.5) / 0.35), o = ss((g - 1.3) / 0.3); put(beats[0], i * (1 - o), o > 0 ? -o * 22 : (1 - i) * 22); }
      { const i = ss((g - 1.55) / 0.3), o = ss((g - 2.3) / 0.3); put(beats[1], i * (1 - o), o > 0 ? -o * 22 : (1 - i) * 22); }
      { const i = ss((g - 2.6) / 0.3); put(beats[2], i, (1 - i) * 22); }
      if (right) right.style.opacity = (1 - ss((g - 0.05) / 0.25)).toFixed(3);
    }
    if (!ems.length) ems = Array.from(hero.querySelectorAll('h1 em'));
    const v = (0.45 + 0.55 * cy.v).toFixed(3);
    ems.forEach((e) => { e.style.opacity = v; });
    const sc = (0.7 + 0.5 * cy.v).toFixed(3);
    dotsCyc.forEach((e) => e.style.setProperty('--cyc', sc));
    if (cy.phase !== lastPhase) { lastPhase = cy.phase; phases.forEach((p, i) => p.classList.toggle('on', i === cy.phase)); }
    if (bar) bar.style.transform = `scaleX(${(cy.phase === 0 ? cy.f : cy.phase === 1 ? 1 : 1 - cy.f).toFixed(3)})`;
    hudClock += s.dt;
    if (hudClock > 0.12 || s.dt === 0) {
      hudClock = 0;
      hud.n.textContent = s.drawn.toLocaleString('en-IN');
      hud.r2.textContent = s.r2.toFixed(2);
      hud.cyc.textContent = `${NAMES[cy.phase]} ${cy.left}`;
      hud.shape.textContent = g < 0.5 ? 'PORTRAIT' : g < 1.5 ? 'SCATTER' : g < 2.5 ? 'FITTED LINE' : 'NAME';
    }
  };
}

/* Contour's HUD swap: plain under the nav, then a compact boxed readout after 55% of the first screen */
function hudSwap() {
  const el = document.getElementById('coords'), track = document.querySelector('.hero-track');
  if (!el) return;
  let boxed = false, timer = 0;
  const check = () => {
    const want = window.scrollY > window.innerHeight * 0.55;
    if (want !== boxed) {
      boxed = want; el.classList.add('swap'); clearTimeout(timer);
      timer = setTimeout(() => { el.classList.toggle('hud', boxed); el.classList.remove('swap'); }, 260);
    }
    const end = track ? track.getBoundingClientRect().bottom : 0;
    el.classList.toggle('gone', end < window.innerHeight * 0.6);
  };
  window.addEventListener('scroll', check, { passive: true });
  check();
}

/* photo wall: one photo at a time comes into full colour on the sampling rhythm; hover does the same */
function wall() {
  const items = Array.from(document.querySelectorAll('.wall li'));
  if (!items.length || reduced) { items.forEach(li => li.classList.add('lit')); return; }
  let i = 0, on = false;
  new IntersectionObserver(e => { on = e[0].isIntersecting; }).observe(items[0].parentElement);
  const step = () => { if (on) { items.forEach(li => li.classList.remove('lit')); items[i % items.length].classList.add('lit'); i++; } };
  step(); setInterval(step, 1800);
}

/* contact band: the ripple drawing follows the pointer (the dots module reads data-x / data-y) */
function bandRipples() {
  const art = document.querySelector('.band-art'), cv = art && art.querySelector('canvas');
  const band = document.querySelector('.band');
  if (!band || !cv) return;
  band.addEventListener('pointermove', (e) => {
    const r = cv.getBoundingClientRect();
    cv.dataset.x = ((e.clientX - r.left) / r.width).toFixed(3); cv.dataset.y = ((e.clientY - r.top) / r.height).toFixed(3);
  }, { passive: true });
  band.addEventListener('pointerleave', () => { delete cv.dataset.x; delete cv.dataset.y; });
}

async function main() {
  const d = await loadContent();
  document.title = d.meta.site_title;
  document.querySelector('meta[name="description"]').setAttribute('content', d.meta.description);
  renderNav(d);
  fillHero(d);
  renderSections(d);
  printResume(d);
  wireTerms(d);
  wireForm(d);
  document.querySelectorAll('[data-print]').forEach((b) => b.addEventListener('click', () => window.print()));

  await waitFor('gsap'); await waitFor('ScrollTrigger'); await waitFor('Lenis');
  window.gsap.registerPlugin(window.ScrollTrigger);
  const lenis = initLenis();

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href'), target = id === '#top' ? document.body : document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    lenis ? lenis.scrollTo(id === '#top' ? 0 : target, { duration: 1.8, offset: -12 }) : target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    history.replaceState(null, '', location.pathname + location.search + id);
  });
  const header = document.querySelector('header.top');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const menu = header.querySelector('.menu-btn');
  const setMenu = (open) => { header.classList.toggle('menu-open', open); menu.setAttribute('aria-expanded', String(open)); };
  menu.addEventListener('click', () => setMenu(!header.classList.contains('menu-open')));
  header.querySelectorAll('.nav-links a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  // dot drawings and the trap
  document.querySelectorAll('canvas[data-dots]').forEach((c) => mountDots(c, c.dataset.dots, c.dataset.q ? cardData(d, c.dataset.q) : {}, parseFloat(c.dataset.phase || '0')));
  const trap = document.querySelector('[data-trap]');
  if (trap) mountTrap(trap.closest('section'));

  // framed clip: plays only while on screen, never under reduced motion
  const vid = document.querySelector('.frame video');
  if (vid && !reduced) new IntersectionObserver((e) => { if (e[0].isIntersecting) { vid.play().catch(() => {}); } else vid.pause(); }, { threshold: 0.25 }).observe(vid);

  mountCursor();
  wall();
  bandRipples();
  intro();
  reveals();
  hudSwap();

  const drone = makeDrone(), hearBtn = document.querySelector('[data-hear]'), hearLbl = document.querySelector('[data-hear-label]');
  hearBtn.addEventListener('click', () => {
    const on = drone.toggle();
    hearBtn.setAttribute('aria-pressed', String(on)); hearBtn.classList.toggle('playing', on);
    hearLbl.textContent = on ? 'Sound off' : 'Sound on';
  });

  const canvas = document.querySelector('canvas.stage'), hero = document.querySelector('.hero');
  if (canvas && hasWebGL()) {
    try {
      const cs = getComputedStyle(document.documentElement);
      const cloud = await makeCloud(canvas, {
        name: d.person.first_name,
        photo: 'media/' + d.media.cutout,
        colors: { hi: '#daffc4', low: '#67d92f', spark: '#ffffff', deep: cs.getPropertyValue('--bg').trim() },
      });
      const drive = heroDriver(hero);
      cloud.onTick((s) => { drive(s); drone.set(s.cycle.v); });
      window.__cloud = cloud;
      window.ScrollTrigger.refresh();
    } catch (err) { fallback(canvas); }
  } else if (canvas) {
    fallback(canvas);
    document.getElementById('coords').style.display = 'none';
  }
}
main();
