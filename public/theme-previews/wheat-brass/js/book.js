// 3D case book, ported from Ada Okafor's assets/main-BbQ27Sor.js (book rig @6k).
// The rig follows the pointer through quickTo (±34° Y, ±16° X, 0.9 s power3.out), a gloss
// spot moves with it and the floor shadow slides the other way. After 2.5 s with no pointer
// it sways on its own. Added: on touch, dragging across the stage turns the book the same way.
import { gsap, reduced, $ } from './base.js';

export function caseBook(section) {
  const stage = $('[data-book-stage]', section), rig = $('[data-book-rig]', section);
  const shadow = $('.book-shadow', section), gloss = $('.gloss', section);
  const rest = { ry: -26, rx: 7 };
  gsap.set(rig, { rotationY: rest.ry, rotationX: rest.rx });
  if (reduced()) return;
  const ry = gsap.quickTo(rig, 'rotationY', { duration: 0.9, ease: 'power3.out' });
  const rx = gsap.quickTo(rig, 'rotationX', { duration: 0.9, ease: 'power3.out' });
  const sh = gsap.quickTo(shadow, 'x', { duration: 0.9, ease: 'power3.out' });
  let last = -99, t = 0, vis = true;
  new IntersectionObserver((es) => { vis = es[0]?.isIntersecting ?? true; }).observe(section);
  const aim = (nx, ny) => {
    ry(rest.ry + nx * 34); rx(rest.rx - ny * 16); sh(-nx * 30);
    gloss.style.setProperty('--gx', (50 + nx * 45).toFixed(1) + '%');
    gloss.style.setProperty('--gy', (40 - ny * 35).toFixed(1) + '%');
  };
  const move = (e) => {
    const r = stage.getBoundingClientRect();
    const nx = Math.max(-1.3, Math.min(1.3, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
    const ny = Math.max(-1.3, Math.min(1.3, -((e.clientY - (r.top + r.height / 2)) / (r.height / 2))));
    last = t; aim(nx, ny);
  };
  section.addEventListener('pointermove', move, { passive: true });
  section.addEventListener('pointerdown', move, { passive: true });
  gsap.ticker.add((_, dt) => {
    t += dt / 1000;
    if (!vis || t - last < 2.5) return;
    aim(Math.sin(t * 0.55) * 0.7, Math.sin(t * 0.37 + 1) * 0.4);
  });
}
