// Small Canvas2D dot drawings. Adapted from Stillwater's practice illustrations (cm / Ry / um) and its
// dot-sphere avatar (Cy): one shared loop, each canvas animates only while it is on screen.
const TAU = Math.PI * 2;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const items = [];
let raf = 0, clock = 0, last = 0, INK = '#1d292c', AQUA = '#3f7f2a', PALE = '#b1dc9f';

function dot(ctx, x, y, r) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }

function draw(it, t) {
  const { ctx, w, h, kind, data } = it;
  ctx.clearRect(0, 0, w, h);
  const pad = Math.min(w, h) * 0.14, X0 = pad, X1 = w - pad, Y0 = pad, Y1 = h - pad;
  const ph = t + it.phase;
  if (kind === 'slope') {
    const rows = data.rows || [];
    const max = Math.max(...rows.map(r => Math.max(r.a, r.b))) * 1.1;
    const yOf = v => Y1 - (v / max) * (Y1 - Y0);
    // two axes of dots
    ctx.fillStyle = INK; ctx.globalAlpha = 0.25; ctx.beginPath();
    for (let k = 0; k <= 24; k++) { const y = Y0 + (k / 24) * (Y1 - Y0); dot(ctx, X0, y, 1); dot(ctx, X1, y, 1); }
    ctx.fill();
    rows.forEach((r, i) => {
      const ya = yOf(r.a), yb = yOf(r.b), n = 34;
      ctx.globalAlpha = 0.85 - i * 0.3; ctx.fillStyle = INK; ctx.beginPath();
      for (let k = 0; k <= n; k++) { const f = k / n; dot(ctx, X0 + f * (X1 - X0), ya + (yb - ya) * f, 1.4); }
      ctx.fill();
      ctx.globalAlpha = 1; ctx.beginPath(); dot(ctx, X0, ya, 3.2); dot(ctx, X1, yb, 3.2); ctx.fill();
      const f = ((ph / 6) + i * 0.5) % 1;
      ctx.fillStyle = AQUA; ctx.beginPath(); dot(ctx, X0 + f * (X1 - X0), ya + (yb - ya) * f, 4); ctx.fill();
    });
  } else if (kind === 'bars') {
    const rows = data.rows || [], max = data.max || Math.max(...rows.map(r => r.v));
    const gap = (Y1 - Y0) / Math.max(rows.length, 1);
    rows.forEach((r, i) => {
      const y = Y0 + gap * (i + 0.5), len = (r.v / max) * (X1 - X0);
      const grow = reduced ? 1 : Math.min(1, ((ph % 9) / 2.2));
      const n = Math.max(2, Math.floor(len / 6));
      ctx.fillStyle = r.hi ? AQUA : INK; ctx.globalAlpha = r.ghost ? 0.22 : 0.9;
      ctx.beginPath();
      for (let k = 0; k < n * grow; k++) for (let j = -1; j <= 1; j++) dot(ctx, X0 + k * 6, y + j * 6, r.hi ? 1.9 : 1.5);
      ctx.fill();
    });
  } else if (kind === 'ratio') {
    const rows = data.rows || [];
    const gap = (Y1 - Y0) / Math.max(rows.length, 1);
    rows.forEach((r, i) => {
      const cy = Y0 + gap * (i + 0.5), base = Math.min(gap * 0.32, (X1 - X0) * 0.12);
      const pulse = 0.5 + 0.5 * Math.sin(ph * 0.8 + i);
      ctx.fillStyle = INK; ctx.globalAlpha = 0.35; ctx.beginPath();
      for (let k = 0; k < 18; k++) { const a = k / 18 * TAU; dot(ctx, X0 + base + Math.cos(a) * base, cy + Math.sin(a) * base, 1.3); }
      ctx.fill();
      const big = base * Math.sqrt(r.v) * (0.96 + 0.06 * pulse), cx = X0 + base * 2 + 18 + big;
      ctx.fillStyle = AQUA; ctx.globalAlpha = 0.9; ctx.beginPath();
      const n = Math.floor(18 * Math.sqrt(r.v) * 1.5);
      for (let ring = 0; ring < 3; ring++) for (let k = 0; k < n; k++) {
        const a = k / n * TAU + ring * 0.2 + ph * 0.05 * (ring % 2 ? 1 : -1), rr = big * (1 - ring * 0.3);
        dot(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 1.5);
      }
      ctx.fill();
    });
  } else if (kind === 'dots') {
    const total = data.total || 64, cols = 8, rows = Math.ceil(total / cols);
    const cw = (X1 - X0) / (cols - 1), rh = (Y1 - Y0) / (rows - 1);
    const groups = data.groups || [];
    const scan = reduced ? total : ((ph * 6) % (total + 20));
    for (let k = 0; k < total; k++) {
      const x = X0 + (k % cols) * cw, y = Y0 + Math.floor(k / cols) * rh;
      // mark a fixed, spread-out set of indices for each group
      let g = -1, acc = 0;
      groups.forEach((gr, gi) => { for (let m = 0; m < gr.n; m++) if ((acc + m) * 37 % total === k) g = gi; acc += gr.n; });
      const seen = k < scan;
      ctx.globalAlpha = seen ? 1 : 0.35;
      ctx.beginPath();
      if (g === 0 && seen) { ctx.fillStyle = AQUA; dot(ctx, x, y, 5); ctx.fill(); }
      else if (g === 1 && seen) { ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.arc(x, y, 5, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.fillStyle = INK; dot(ctx, x, y, 1.6); ctx.fill(); }
      else { ctx.fillStyle = INK; dot(ctx, x, y, 2.2); ctx.fill(); }
    }
  } else { // ripple, for the contact band
    const R = Math.min(w, h) * 0.5;
    const tx = it.canvas.dataset.x ? +it.canvas.dataset.x * w : w / 2, ty = it.canvas.dataset.y ? +it.canvas.dataset.y * h : h / 2;
    it.cx = it.cx == null ? tx : it.cx + (tx - it.cx) * 0.06; it.cy = it.cy == null ? ty : it.cy + (ty - it.cy) * 0.06;
    for (let u = 0; u < 7; u++) {
      const f = (ph * 0.07 + u / 7) % 1, rr = f * R * 1.02, n = 10 + Math.floor(rr * 0.7);
      ctx.globalAlpha = Math.pow(1 - f, 1.4) * 0.9; ctx.fillStyle = u % 3 === 0 ? AQUA : INK; ctx.beginPath();
      for (let k = 0; k < n; k++) { const a = u * 1.3 + k / n * TAU; dot(ctx, it.cx + Math.cos(a) * rr, it.cy + Math.sin(a) * rr, 1.2 + (1 - f)); }
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function size(it) {
  const r = it.canvas.getBoundingClientRect();
  it.w = Math.max(1, Math.round(r.width)); it.h = Math.max(1, Math.round(r.height));
  it.dpr = Math.min(window.devicePixelRatio || 1, 2);
  it.canvas.width = Math.round(it.w * it.dpr); it.canvas.height = Math.round(it.h * it.dpr);
  it.ctx.setTransform(it.dpr, 0, 0, it.dpr, 0, 0);
  draw(it, reduced ? 6 : clock);
}
function loop(now) {
  raf = 0;
  const dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
  let any = false;
  for (const it of items) if (it.visible) { draw(it, clock); any = true; }
  if (any && !document.hidden) raf = requestAnimationFrame(loop);
}
function kick() { if (reduced || raf) return; last = performance.now(); raf = requestAnimationFrame(loop); }

export function mountDots(canvas, kind, data = {}, phase = 0) {
  const cs = getComputedStyle(document.documentElement);
  INK = cs.getPropertyValue('--ink').trim() || INK;
  AQUA = cs.getPropertyValue('--aqua-deep').trim() || AQUA;
  PALE = cs.getPropertyValue('--aqua').trim() || PALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const it = { canvas, ctx, kind, data, phase, w: 1, h: 1, dpr: 1, visible: false };
  items.push(it);
  new ResizeObserver(() => size(it)).observe(canvas);
  new IntersectionObserver(e => { it.visible = e[0].isIntersecting; if (it.visible) kick(); }, { rootMargin: '80px' }).observe(canvas);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
}

// Stillwater's dot-sphere avatar: a lit head and shoulders drawn in dots, varied by seed
export function dotAvatar(seed) {
  const L = [Math.cos(seed * 1.7), -Math.abs(Math.sin(seed * 1.1)) - 0.2], ln = Math.hypot(L[0], L[1]);
  let out = '';
  for (let j = 0; j < 21; j++) for (let i = 0; i < 21; i++) {
    const x = (i + 0.5) / 21, y = (j + 0.5) / 21;
    const hx = (x - 0.5) / 0.26, hy = (y - 0.4) / 0.28, bx = (x - 0.5) / 0.46, by = (y - 1.08) / 0.46;
    let v = -1;
    if (hx * hx + hy * hy < 1) { const z = Math.sqrt(Math.max(0, 1 - hx * hx - hy * hy)); v = 0.25 + 0.75 * Math.max(0, (hx * L[0] + hy * L[1]) / ln * 0.7 + z * 0.55); }
    else if (bx * bx + by * by < 1) { const z = Math.sqrt(Math.max(0, 1 - bx * bx - by * by)); v = 0.12 + 0.55 * Math.max(0, (bx * L[0] + by * L[1]) / ln * 0.5 + z * 0.5); }
    if (v < 0) continue;
    const r = Math.max(0.06, Math.min(0.46, v * 0.5));
    out += `<circle cx="${(i + 0.5).toFixed(2)}" cy="${(j + 0.5).toFixed(2)}" r="${r.toFixed(2)}"/>`;
  }
  return `<svg viewBox="0 0 21 21" aria-hidden="true" focusable="false" fill="currentColor">${out}</svg>`;
}
