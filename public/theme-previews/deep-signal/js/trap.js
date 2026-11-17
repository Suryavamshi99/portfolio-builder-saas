// The peeking trap: 40 simulated A/A tests drawn in Stillwater's dot style.
// All data is generated in the browser. Nothing here comes from a company.
const TAU = Math.PI * 2;
const DAYS = 28, SHOWN = 40, RUNS = 1000, Z = 1.96;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function normal(r) { let u = 0, v = 0; while (u === 0) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); }
// running z-statistic of an A/A test with equal daily traffic: z_d = S_d / sqrt(d)
function simulate(r) { const z = new Float32Array(DAYS); let s = 0; for (let d = 0; d < DAYS; d++) { s += normal(r); z[d] = s / Math.sqrt(d + 1); } return z; }

export function mountTrap(root) {
  const canvas = root.querySelector('canvas'), art = root.querySelector('.trap-art');
  const ctx = canvas.getContext('2d');
  const range = root.querySelector('input[type=range]'), dayOut = root.querySelector('[data-day]');
  const btns = Array.from(root.querySelectorAll('[data-mode]')), thumb = root.querySelector('.toggle-thumb');
  const nShown = root.querySelector('[data-shown]'), rOnce = root.querySelector('[data-once]'), rDaily = root.querySelector('[data-daily]');
  const lblShown = root.querySelector('[data-shown-lbl]'), huge = root.querySelector('[data-huge]'), hugeLbl = root.querySelector('[data-huge-lbl]');
  const cs = getComputedStyle(document.documentElement);
  const INK = cs.getPropertyValue('--ink').trim(), AQUA = cs.getPropertyValue('--aqua-deep').trim(), PALE = cs.getPropertyValue('--aqua').trim();

  // 1,000 runs for the rates
  const once = new Float32Array(DAYS), daily = new Float32Array(DAYS);
  {
    const r = rng(2027), hitOnce = new Uint32Array(DAYS), hitDaily = new Uint32Array(DAYS);
    for (let k = 0; k < RUNS; k++) {
      const z = simulate(r); let crossed = false;
      for (let d = 0; d < DAYS; d++) { const out = Math.abs(z[d]) > Z; if (out) hitOnce[d]++; if (out && d >= 2) crossed = true; if (crossed) hitDaily[d]++; }
    }
    for (let d = 0; d < DAYS; d++) { once[d] = hitOnce[d] / RUNS; daily[d] = hitDaily[d] / RUNS; }
  }

  let seed = 11, tests = [], mode = 'once', last = DAYS, w = 1, h = 1, dpr = 1, grow = reduced ? 1 : 0, visible = false, raf = 0, prev = 0, t = 0;
  let growStart = 0;
  const reseed = () => { const r = rng(seed++ * 7919); tests = Array.from({ length: SHOWN }, () => simulate(r)); grow = reduced ? 1 : 0; growStart = 0; };
  reseed();

  const geom = () => { const L = Math.min(56, w * 0.09), R = 18, T = 18, B = 30; return { L, R, T, B, x: d => L + (d / (DAYS - 1)) * (w - L - R), y: z => T + (1 - (Math.max(-3.2, Math.min(3.2, z)) + 3.2) / 6.4) * (h - T - B) }; };

  function verdict(z) {
    // returns the day index the test is called a win, or -1
    if (mode === 'once') return Math.abs(z[last - 1]) > Z ? last - 1 : -1;
    for (let d = 2; d < last; d++) if (Math.abs(z[d]) > Z) return d;
    return -1;
  }

  function draw() {
    const g = geom();
    ctx.clearRect(0, 0, w, h);
    // the "significant" bands
    ctx.fillStyle = PALE; ctx.globalAlpha = 0.11;
    ctx.fillRect(g.L, g.T, w - g.L - g.R, g.y(Z) - g.T);
    ctx.fillRect(g.L, g.y(-Z), w - g.L - g.R, h - g.B - g.y(-Z));
    ctx.globalAlpha = 1;
    // axis dots and labels
    ctx.fillStyle = INK; ctx.globalAlpha = 0.3; ctx.beginPath();
    for (let d = 0; d < DAYS; d++) { const x = g.x(d); ctx.moveTo(x + 1, g.y(0)); ctx.arc(x, g.y(0), 1, 0, TAU); }
    ctx.fill(); ctx.globalAlpha = 0.65;
    ctx.font = '500 10px Inter, system-ui, sans-serif'; ctx.textAlign = 'center';
    [1, 7, 14, 21, 28].forEach(d => ctx.fillText('day ' + d, g.x(d - 1), h - 10));
    ctx.textAlign = 'right';
    ctx.fillText('z +1.96', g.L - 6, g.y(Z) + 3); ctx.fillText('0', g.L - 6, g.y(0) + 3); ctx.fillText('−1.96', g.L - 6, g.y(-Z) + 3);
    // the reading day
    const xr = g.x(last - 1);
    ctx.globalAlpha = 0.8; ctx.fillStyle = AQUA; ctx.beginPath();
    for (let y = g.T; y < h - g.B; y += 6) { ctx.moveTo(xr + 1.1, y); ctx.arc(xr, y, 1.1, 0, TAU); }
    ctx.fill();
    // the tests
    const upto = Math.floor(grow * (DAYS - 1));
    let wins = 0;
    // every path in full, very faint, so the whole month is always visible
    ctx.strokeStyle = INK; ctx.globalAlpha = 0.09; ctx.lineWidth = 1;
    tests.forEach((z) => { ctx.beginPath(); for (let d = 0; d <= upto; d++) { const x = g.x(d), y = g.y(z[d]); d ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); });
    ctx.globalAlpha = 0.55; ctx.fillStyle = AQUA; ctx.font = '600 10px Inter, system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('CALLED A WIN', g.L + 10, g.T + 16); ctx.fillText('CALLED A WIN', g.L + 10, h - g.B - 8);
    tests.forEach((z, i) => {
      const v = verdict(z), stop = mode === 'daily' && v >= 0 ? v : last - 1, end = Math.min(stop, upto);
      ctx.strokeStyle = v >= 0 ? AQUA : INK; ctx.globalAlpha = v >= 0 ? 0.95 : 0.22; ctx.lineWidth = v >= 0 ? 2.2 : 1;
      ctx.shadowColor = AQUA; ctx.shadowBlur = v >= 0 ? 14 : 0;
      ctx.beginPath();
      for (let d = 0; d <= end; d++) { const x = g.x(d), y = g.y(z[d]); d ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = v >= 0 ? AQUA : INK; ctx.globalAlpha = v >= 0 ? 0.9 : 0.35; ctx.beginPath();
      for (let d = 0; d <= end; d++) { const x = g.x(d), y = g.y(z[d]); ctx.moveTo(x + 1.3, y); ctx.arc(x, y, 1.3, 0, TAU); }
      ctx.fill();
      if (v >= 0 && upto >= v) {
        wins++;
        const pulse = reduced ? 1 : 1 + 0.18 * Math.sin(t * 2.4 + i);
        ctx.globalAlpha = 1; ctx.fillStyle = '#ffffff'; ctx.shadowColor = AQUA; ctx.shadowBlur = 18; ctx.beginPath(); ctx.arc(g.x(v), g.y(z[v]), 4.6 * pulse, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
      }
    });
    ctx.globalAlpha = 1;
    nShown.textContent = `${wins} of ${SHOWN}`;
  }

  function readouts() {
    dayOut.textContent = String(last);
    rOnce.textContent = (once[last - 1] * 100).toFixed(1) + '%';
    rDaily.textContent = (daily[last - 1] * 100).toFixed(1) + '%';
    rOnce.closest('div').style.opacity = mode === 'once' ? '1' : '.55';
    rDaily.closest('div').style.opacity = mode === 'daily' ? '1' : '.55';
    const rate = (mode === 'once' ? once : daily)[last - 1] * 100;
    if (huge) huge.textContent = (rate < 10 ? rate.toFixed(1) : Math.round(rate)) + '%';
    if (hugeLbl) hugeLbl.textContent = mode === 'once' ? `of identical tests get called a win when read once, on day ${last}` : `of identical tests get called a win when read every day up to day ${last}`;
    lblShown.textContent = mode === 'once' ? `called a win when read once, on day ${last}` : `called a win when read every day up to day ${last}`;
  }

  function placeThumb() {
    const b = btns.find(x => x.dataset.mode === mode);
    if (b && thumb) { thumb.style.width = b.offsetWidth + 'px'; thumb.style.transform = `translateX(${b.offsetLeft}px)`; }
    btns.forEach(x => x.setAttribute('aria-pressed', String(x.dataset.mode === mode)));
  }

  let idle = 3, auto = 0;
  function autopilot(dt) {
    idle += dt;
    if (idle < 3 || reduced) return;
    auto += dt;
    if (auto < 0.14) return;
    auto = 0;
    if (last >= DAYS) { mode = mode === 'once' ? 'daily' : 'once'; last = 3; placeThumb(); }
    else { last++; if (last >= DAYS) auto = -1.8; }
    range.value = String(last); readouts();
  }
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - prev) / 1000); prev = now; t += dt;
    if (grow >= 1) autopilot(dt);
    if (grow < 1) { if (!growStart) growStart = now; grow = Math.min(1, (now - growStart) / 1200); }
    draw();
    if (visible && !document.hidden) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (reduced) { draw(); return; } if (!raf) { prev = performance.now(); raf = requestAnimationFrame(frame); } };

  function resize() {
    const r = art.getBoundingClientRect();
    w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height)); dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }
  new ResizeObserver(resize).observe(art);
  new IntersectionObserver(e => { visible = e[0].isIntersecting; if (visible) kick(); }, { rootMargin: '60px' }).observe(art);

  btns.forEach(b => b.addEventListener('click', () => { idle = -6; mode = b.dataset.mode; placeThumb(); readouts(); kick(); draw(); }));
  range.addEventListener('input', () => { idle = -6; last = +range.value; readouts(); draw(); });
  root.querySelector('[data-rerun]').addEventListener('click', () => { reseed(); kick(); draw(); });

  // drag across the chart to move the reading day
  const fromPointer = (e) => {
    idle = -3;
    const r = art.getBoundingClientRect(), g = geom();
    const d = Math.round(((e.clientX - r.left - g.L) / (w - g.L - g.R)) * (DAYS - 1)) + 1;
    last = Math.max(3, Math.min(DAYS, d)); range.value = String(last); readouts(); draw();
  };
  let dragging = false;
  art.addEventListener('pointerdown', e => { dragging = true; fromPointer(e); });
  art.addEventListener('pointermove', e => { if (dragging || e.pointerType === 'mouse') fromPointer(e); });
  window.addEventListener('pointerup', () => { dragging = false; });

  document.fonts && document.fonts.ready.then(placeThumb);
  window.addEventListener('resize', placeThumb);
  placeThumb(); readouts();
}
