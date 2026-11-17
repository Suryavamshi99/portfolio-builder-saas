// A crosshair that is easy to see on every background, plus a water ripple on click.
// Only on fine pointers; touch keeps the native behaviour.
export function mountCursor() {
  const el = document.querySelector('.cur');
  if (!el || !window.matchMedia('(pointer:fine)').matches) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.body.classList.add('has-cur');
  let x = -100, y = -100, cx = -100, cy = -100;
  window.addEventListener('pointermove', (e) => {
    x = e.clientX; y = e.clientY; el.classList.add('on');
    el.classList.toggle('hot', !!e.target.closest('a, button, input, textarea, label, .trap-art, canvas'));
  }, { passive: true });
  document.addEventListener('pointerleave', () => el.classList.remove('on'));
  window.addEventListener('pointerdown', (e) => {
    if (reduced) return;
    const r = document.createElement('i'); r.className = 'ripple';
    r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
    document.body.appendChild(r); setTimeout(() => r.remove(), 1000);
  });
  const tick = () => {
    cx += (x - cx) * (reduced ? 1 : 0.35); cy += (y - cy) * (reduced ? 1 : 0.35);
    el.style.transform = `translate3d(${cx}px,${cy}px,0)`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
