// Per-letter weight, ported from Ada Okafor's assets/weight-C9Ulf0Ht.js.
// Each letter's Fraunces "wght" rises with pointer proximity (smoothstep falloff, fast up,
// slow down). With no pointer for 2.4 s a sine wave travels across the letters.
// Added here: touch (pointerdown) counts as a pointer, and the wave has a second, slower
// swell so the idle ripple is less regular.
import { gsap, reduced } from './base.js';

export function weightName(el, words, o = {}) {
  const min = o.min ?? 300, max = o.max ?? 760, radius = o.radius ?? 1.45, up = o.up ?? 14, down = o.down ?? 1.5, soft = o.soft ?? 60;
  el.setAttribute('aria-label', words.join(' '));
  el.innerHTML = '';
  const chars = [];
  words.forEach((w, wi) => {
    const nw = document.createElement('span');
    nw.className = 'nw'; nw.setAttribute('aria-hidden', 'true');
    for (const ch of w) {
      const m = document.createElement('span'); m.className = 'nm';
      const c = document.createElement('span'); c.className = 'ch'; c.textContent = ch;
      m.appendChild(c); nw.appendChild(m); chars.push(c);
    }
    el.appendChild(nw);
    if (wi < words.length - 1) { const sp = document.createElement('span'); sp.className = 'sp'; sp.setAttribute('aria-hidden', 'true'); sp.textContent = ' '; el.appendChild(sp); }
  });
  const cur = chars.map(() => min);
  const paint = (i, v) => { chars[i].style.fontVariationSettings = `"wght" ${Math.round(v)}, "SOFT" ${soft}`; };
  chars.forEach((_, i) => paint(i, min));
  if (reduced()) { chars.forEach((_, i) => paint(i, (min + max) / 2.4)); return { chars, destroy() {} }; }

  let px = -9999, py = -9999, last = -99, t = 0, vis = true;
  const move = (e) => { px = e.clientX; py = e.clientY; last = t; };
  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener('pointerdown', move, { passive: true });
  const io = new IntersectionObserver((es) => { vis = es[0]?.isIntersecting ?? true; });
  io.observe(el);

  const tick = (_, dtMs) => {
    const dt = Math.min(0.05, dtMs / 1000);
    t += dt;
    if (!vis) return;
    const fs = parseFloat(getComputedStyle(el).fontSize) || 100;
    const R = radius * fs;
    const live = t - last < 2.4;
    for (let i = 0; i < chars.length; i++) {
      let g;
      if (live) {
        const r = chars[i].getBoundingClientRect();
        const d = Math.hypot((px - (r.left + r.width / 2)) * 0.9, (py - (r.top + r.height / 2)) * 1.15);
        const k = Math.max(0, 1 - d / R);
        g = k * k * (3 - 2 * k);
      } else {
        const a = Math.sin(t * 0.85 - i * 0.62) * 0.5 + 0.5;
        const swell = 0.75 + 0.25 * Math.sin(t * 0.23);
        g = a * a * 0.62 * swell;
      }
      const target = min + (max - min) * g;
      const rate = target > cur[i] ? up : down;
      const v = cur[i] + (target - cur[i]) * (1 - Math.exp(-rate * dt));
      if (Math.abs(v - cur[i]) > 0.25) { cur[i] = v; paint(i, v); }
    }
  };
  gsap.ticker.add(tick);
  return { chars, destroy() { gsap.ticker.remove(tick); window.removeEventListener('pointermove', move); window.removeEventListener('pointerdown', move); io.disconnect(); } };
}
