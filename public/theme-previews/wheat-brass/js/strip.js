// Drag strip and image trail, ported from Ada Okafor's assets/strip-DZznrBt_.js.
// Strip: pointer capture, release velocity ×14, ±80 px rubber band, horizontal wheel,
// arrow keys, click suppressed after 6 px of travel, cards lean with drag velocity.
// Trail: a pool of photos spawned every 120 px of pointer travel with a set of tilts,
// scaling in, drifting along the motion and fading. Here the trail runs over the
// field-notes section with Nisha's own field photos; each photo carries a short caption.
import { gsap, reduced, $, $$ } from './base.js';

export function dragStrip(el, bar) {
  const track = $('.strip-track', el);
  let x = 0, tx = 0, minX = 0, down = false, sx = 0, s0 = 0, lx = 0, vel = 0, moved = 0, vis = true;
  const bounds = () => { minX = Math.min(0, el.clientWidth - track.scrollWidth); tx = Math.max(minX, Math.min(0, tx)); };
  bounds();
  new ResizeObserver(bounds).observe(track);
  new ResizeObserver(bounds).observe(el);
  new IntersectionObserver((es) => { vis = es[0]?.isIntersecting ?? true; }).observe(el);
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    down = true; moved = 0; sx = lx = e.clientX; s0 = tx; vel = 0;
    el.classList.add('dragging');
  });
  el.addEventListener('pointermove', (e) => {
    if (!down) return;
    const d = e.clientX - lx; lx = e.clientX; moved += Math.abs(d);
    if (moved > 6 && !el.hasPointerCapture?.(e.pointerId)) el.setPointerCapture?.(e.pointerId);
    vel = vel * 0.7 + d * 0.3;
    tx = Math.max(minX - 80, Math.min(80, s0 + (e.clientX - sx)));
  });
  const up = () => { if (!down) return; down = false; el.classList.remove('dragging'); tx = Math.max(minX, Math.min(0, tx + vel * 14)); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
  el.addEventListener('click', (e) => { if (moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
  el.addEventListener('wheel', (e) => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { e.preventDefault(); tx = Math.max(minX, Math.min(0, tx - e.deltaX)); } }, { passive: false });
  el.addEventListener('keydown', (e) => {
    const step = el.clientWidth * 0.4;
    if (e.key === 'ArrowRight') { tx = Math.max(minX, tx - step); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { tx = Math.min(0, tx + step); e.preventDefault(); }
  });
  // keyboard focus on a card brings it into view
  track.addEventListener('focusin', (e) => {
    const c = e.target.closest('.scard'); if (!c) return;
    const l = c.offsetLeft, w = c.offsetWidth;
    if (l + tx < 0 || l + w + tx > el.clientWidth) tx = Math.max(minX, Math.min(0, -(l - 40)));
  });
  const cards = $$('.scard', track);
  gsap.ticker.add((_, dt) => {
    if (!vis) return;
    const k = 1 - Math.exp(-(reduced() ? 60 : 9) * Math.min(0.05, dt / 1000));
    x += (tx - x) * k;
    track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
    if (bar) bar.style.transform = `scaleX(${minX === 0 ? 1 : (0.12 + 0.88 * (x / minX)).toFixed(4)})`;
    const lean = reduced() ? 0 : Math.max(-3, Math.min(3, (tx - x) * 0.04));
    cards.forEach((c, i) => c.style.setProperty('--lean', (lean * (i % 2 ? 1 : -1)).toFixed(2) + 'deg'));
  });
}

export function imageTrail(section, items) {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches || reduced()) return;
  const layer = document.createElement('div');
  layer.className = 'trail'; layer.setAttribute('aria-hidden', 'true');
  const pool = items.concat(items).slice(0, 10).map((it) => {
    const d = document.createElement('figure');
    d.className = 'trail-img';
    d.innerHTML = `<img src="${it.src}" alt="" decoding="async"><figcaption>${it.cap}</figcaption>`;
    layer.appendChild(d);
    return d;
  });
  section.appendChild(layer);
  const tilts = [-7, 5, -3, 8, -5, 3];
  let n = 0, lx = -999, ly = -999;
  section.addEventListener('pointerleave', () => { lx = ly = -999; });
  section.addEventListener('pointermove', (e) => {
    if (e.target.closest('a,button,input,textarea,select')) return;
    const r = section.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (Math.hypot(x - lx, y - ly) < 120) return;
    const dx = x - lx, dy = y - ly; lx = x; ly = y;
    const el = pool[n % pool.length]; n++;
    gsap.killTweensOf(el);
    gsap.set(el, { x, y, xPercent: -50, yPercent: -50, rotate: tilts[n % tilts.length], scale: 0.7, opacity: 0, zIndex: n });
    gsap.timeline()
      .to(el, { opacity: 1, scale: 1, duration: 0.35, ease: 'power3.out' })
      .to(el, { x: x + Math.max(-60, Math.min(60, dx * 0.4)), y: y + Math.max(-60, Math.min(60, dy * 0.4)), duration: 0.9, ease: 'power2.out' }, 0)
      .to(el, { opacity: 0, scale: 0.86, duration: 0.5, ease: 'power2.in' }, 0.6);
  });
}
