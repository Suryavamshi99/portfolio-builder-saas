// Notebook pages. Each project reads like a notebook: numbered input cells, outputs, notes.
// The output chart is a 2D cousin of the home-page cloud: dots pour from noise into the chart,
// swell on the same sampling cycle, and the pointer pushes them like a hand in water.
import { loadContent, esc, forCompany, withFor } from './content.js';
import { cycleAt, newCycle } from './cycle.js';
import { sampleNote } from './sections.js';
import { mountCursor } from './cursor.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ORDER = ['eta-accuracy', 'growly-sip-stops', 'larkspur-air'];
const FILE = (s) => `notebook-${s}.html`;

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* chart targets in a 0..1 box */
function targets(chart, n) {
  const r = rng(77), pts = [], tint = [];
  const push = (x, y, t = 0) => { pts.push(x, y); tint.push(t); };
  if (chart.type === 'slope') {
    const rows = chart.rows, max = Math.max(...rows.map(x => Math.max(x.a, x.b))) * 1.12;
    const y = v => 0.92 - (v / max) * 0.82;
    for (let i = 0; i < n; i++) {
      const k = r();
      if (k < 0.1) { const side = r() < 0.5 ? 0.1 : 0.9; push(side + (r() - 0.5) * 0.004, 0.08 + r() * 0.86, 0); }
      else { const row = rows[i % rows.length], f = r(); push(0.1 + f * 0.8, y(row.a) + (y(row.b) - y(row.a)) * f + (r() - 0.5) * 0.012, i % rows.length === 0 ? 1 : 0); }
    }
  } else if (chart.type === 'bars') {
    const rows = chart.rows, max = chart.max || Math.max(...rows.map(x => x.v)), gap = 0.84 / rows.length;
    for (let i = 0; i < n; i++) {
      const j = i % rows.length, row = rows[j], len = (row.v / max) * 0.8;
      push(0.1 + r() * len, 0.08 + gap * (j + 0.5) + (r() - 0.5) * gap * 0.42, row.hi ? 1 : row.ghost ? 2 : 0);
    }
  } else { // ratio: a unit disc next to a disc whose area is the ratio
    const rows = chart.rows, gap = 0.84 / rows.length;
    for (let i = 0; i < n; i++) {
      const j = i % rows.length, row = rows[j], cy = 0.08 + gap * (j + 0.5), base = Math.min(gap * 0.2, 0.08);
      const unit = r() < 1 / (1 + row.v);
      const R = unit ? base : base * Math.sqrt(row.v), cx = unit ? 0.18 : 0.18 + base + 0.08 + base * Math.sqrt(row.v);
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R;
      push(cx + Math.cos(a) * d * 0.62, cy + Math.sin(a) * d, unit ? 0 : 1);
    }
  }
  return { pts, tint };
}

function mountOut(canvas, chart) {
  const ctx = canvas.getContext('2d');
  const cs = getComputedStyle(document.documentElement);
  const INK = cs.getPropertyValue('--ink').trim(), AQUA = cs.getPropertyValue('--aqua-deep').trim(), SOFT = cs.getPropertyValue('--soft').trim();
  const n = window.innerWidth < 720 ? 700 : 1500;
  const T = targets(chart, n), r = rng(5);
  const P = new Float32Array(n * 2), V = new Float32Array(n * 2), S = new Float32Array(n);
  const scatterAll = () => { for (let i = 0; i < n; i++) { P[i * 2] = 0.5 + (r() - 0.5) * 0.9; P[i * 2 + 1] = 0.5 + (r() - 0.5) * 0.9; V[i * 2] = V[i * 2 + 1] = 0; } };
  for (let i = 0; i < n; i++) S[i] = r();
  if (reduced) for (let i = 0; i < n * 2; i++) P[i] = T.pts[i]; else scatterAll();
  let w = 1, h = 1, dpr = 1, raf = 0, last = 0, clock = 0, visible = false, idle = 9;
  const ptr = { x: -1, y: -1, tx: 0.5, ty: 0.5, on: false };
  const cyc = newCycle();
  const size = () => {
    const b = canvas.getBoundingClientRect();
    w = Math.max(1, Math.round(b.width)); h = Math.max(1, Math.round(b.height)); dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
  };
  function step(dt) {
    clock += dt; idle += dt; cycleAt(clock, cyc);
    if (idle > 2.5) { ptr.tx = 0.5 + Math.sin(clock * 0.45) * 0.38; ptr.ty = 0.5 + Math.sin(clock * 0.31 + 1.3) * 0.32; ptr.on = true; }
    const k = 1 - Math.exp(-5 * dt);
    ptr.x = ptr.x < 0 ? ptr.tx : ptr.x + (ptr.tx - ptr.x) * k; ptr.y = ptr.y < 0 ? ptr.ty : ptr.y + (ptr.ty - ptr.y) * k;
    const swell = 0.97 + 0.05 * cyc.v, ar = w / h;
    for (let i = 0; i < n; i++) {
      const i2 = i * 2;
      const tx = 0.5 + (T.pts[i2] - 0.5) * swell, ty = 0.5 + (T.pts[i2 + 1] - 0.5) * swell;
      let fx = (tx - P[i2]) * (2.2 + S[i] * 2.4), fy = (ty - P[i2 + 1]) * (2.2 + S[i] * 2.4);
      if (ptr.on) {
        const dx = (P[i2] - ptr.x) * ar, dy = P[i2 + 1] - ptr.y, d2 = dx * dx + dy * dy, f = Math.exp(-d2 / 0.006) * (idle > 2.5 ? 0.5 : 1);
        const inv = 1 / Math.sqrt(d2 + 1e-4);
        fx += (dx / ar) * inv * f * 0.9; fy += dy * inv * f * 0.9;
      }
      V[i2] = (V[i2] + fx * dt) * Math.exp(-4.2 * dt); V[i2 + 1] = (V[i2 + 1] + fy * dt) * Math.exp(-4.2 * dt);
      P[i2] += V[i2] * dt * 2.2; P[i2 + 1] += V[i2 + 1] * dt * 2.2;
    }
  }
  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (const pass of [0, 2, 1]) {
      ctx.fillStyle = pass === 1 ? AQUA : pass === 2 ? SOFT : INK; ctx.globalAlpha = pass === 2 ? 0.5 : 0.85; ctx.beginPath();
      for (let i = 0; i < n; i++) {
        if (T.tint[i] !== pass) continue;
        const x = P[i * 2] * w, y = P[i * 2 + 1] * h, rad = 1.1 + S[i] * 1.1;
        ctx.moveTo(x + rad, y); ctx.arc(x, y, rad, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function loop(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    step(dt); draw();
    if (visible && !document.hidden) raf = requestAnimationFrame(loop);
  }
  const kick = () => { if (reduced) { draw(); return; } if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  new ResizeObserver(size).observe(canvas);
  new IntersectionObserver(e => { visible = e[0].isIntersecting; if (visible) kick(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  const move = (e) => { const b = canvas.getBoundingClientRect(); ptr.tx = (e.clientX - b.left) / b.width; ptr.ty = (e.clientY - b.top) / b.height; ptr.on = true; idle = 0; };
  canvas.addEventListener('pointermove', move, { passive: true });
  canvas.addEventListener('pointerdown', move, { passive: true });
  canvas.addEventListener('pointerleave', () => { idle = 2.4; });
  return { rerun() { if (!reduced) { scatterAll(); kick(); } } };
}

function legend(chart) {
  if (chart.type === 'slope') return chart.rows.map(r => `<li><span>${esc(r.label)}</span><b>${esc(r.a)} → ${esc(r.b)}</b></li>`).join('') + `<li class="k"><span>${esc(chart.a_label)} → ${esc(chart.b_label)}</span><b>left → right</b></li>`;
  if (chart.type === 'bars') return chart.rows.map(r => `<li class="${r.hi ? 'hi' : ''}${r.ghost ? ' ghost' : ''}"><span>${esc(r.label)}</span><b>${esc(r.fmt)}</b></li>`).join('');
  return chart.rows.map(r => `<li class="hi"><span>${esc(r.label)}</span><b>${esc(r.v)}×</b></li>`).join('');
}

async function main() {
  const d = await loadContent();
  const slug = document.body.dataset.slug, pr = d.projects.find(x => x.slug === slug), pg = d.project_pages[slug], q = d.site.questions[slug];
  const co = forCompany();
  document.title = `${pr.title} · Notebook · ${d.person.first_name} ${d.person.last_name}`;
  document.querySelector('header.top').innerHTML = `
    <div class="container nav-inner">
      <a class="wordmark" href="${esc(withFor('index.html'))}"><span class="wm-dot" aria-hidden="true"></span><span>${esc(d.person.first_name)} ${esc(d.person.last_name)}</span></a>
      <span class="nb-file" aria-hidden="true">${esc({ 'eta-accuracy': 'delivery-promise', 'growly-sip-stops': 'standing-order-lapses', 'larkspur-air': 'larchmont-river-gauges' }[slug] || slug)}.ipynb</span>
      <a class="link-rule" href="${esc(withFor('index.html#questions'))}">All questions</a>
    </div>`;

  let c = 0;
  const cell = (kind, body, label) => { if (kind === 'in') c++; const lab = label || (kind === 'in' ? `In [${c}]` : kind === 'out' ? `Out [${c}]` : kind === 'note' ? 'Note' : ''); return `<section class="cell ${kind}" data-reveal><div class="gut" aria-hidden="true">${lab}</div><div class="body">${body}</div></section>`; };
  const code = q.sql.split('\n').map((l, i) => `<span class="ln">${String(i + 1).padStart(2, ' ')}</span>${esc(l)}`).join('\n');
  const idx = ORDER.indexOf(slug), next = ORDER[(idx + 1) % ORDER.length], nextP = d.projects.find(x => x.slug === next);
  const imgs = pg.images.filter(s => !s.endsWith('thumb.jpg')).slice(0, 2);
  const capFor = (src) => { const g = d.media.gallery.find(x => x.src === src); if (g) return g.caption; const f = src.split('/').pop().replace(/\.\w+$/, '').replace(/-/g, ' '); return f.charAt(0).toUpperCase() + f.slice(1); };

  const html = `
    <div class="container nb-wrap" id="cells">
      <div class="nb-head" data-reveal>
        <p class="eyebrow">${esc(pr.org)} · ${esc(pr.year)} · ${esc(pr.type)}</p>
        <h1>${esc(pr.title)}</h1>
        ${co ? `<p class="for-line">Shared with ${esc(co)}. ${esc(d.pitch.for_company_template.replaceAll('{company}', co))}</p>` : ''}
        <dl class="nb-meta">
          <div><dt>Role</dt><dd>${esc(pg.my_role)}</dd></div>
          <div><dt>When</dt><dd>${esc(pg.dates)} · ${esc(pr.duration)}</dd></div>
          <div><dt>Team</dt><dd>${esc(pr.team)}</dd></div>
        </dl>
      </div>
      ${cell('md', `<h2 class="q">${esc(q.q)}</h2><p>${esc(pr.summary)}</p>`, '#')}
      ${cell('md', `<h3>Context</h3><p>${esc(pg.context)}</p><h3>The problem</h3><p>${esc(pg.problem)}</p>`, '#')}
      ${cell('in', `<pre class="code"><code>${code}</code></pre>`)}
      ${cell('out', `<div class="out-chart"><canvas aria-label="Dot chart of the result" role="img"></canvas><button class="rerun" type="button">Run the cell again</button></div><ul class="legend" role="list">${legend(q.chart)}</ul>`)}
      ${pg.what_i_did.map(step => cell('in', `<p class="step">${esc(step)}</p>`)).join('')}
      ${pg.decisions.map(x => cell('note', `<p class="choice">${esc(x.choice)}</p><p>${esc(x.why)}</p>`)).join('')}
      ${cell('out', `<table class="results"><thead><tr><th>Metric</th><th>Result</th><th>Measured on</th></tr></thead><tbody>${pg.results.map(x => `<tr><td>${esc(x.metric)}</td><td class="val">${esc(x.value)}</td><td>${esc(x.note)}</td></tr>`).join('')}</tbody></table>`, `Out [${c}]`)}
      ${imgs.length ? cell('out', `<div class="figs">${imgs.map(s => `<figure class="${s.startsWith('projects/') ? 'chart-img' : ''}"><img src="media/${esc(s)}" alt="${esc(capFor(s))}" loading="lazy" /><figcaption>${esc(capFor(s))}</figcaption></figure>`).join('')}</div>`, `Out [${c}]`) : ''}
      ${cell('md', `<h3>What I learned</h3><p>${esc(pg.learned)}</p><h3>What I would do next</h3><p>${esc(pg.next)}</p>`, '#')}
      <nav class="nb-next" data-reveal aria-label="Next notebook">
        <span class="eyebrow">Next notebook</span>
        <a href="${esc(withFor(FILE(next)))}"><span class="nx-title">${esc(nextP.title)}</span><span class="link-rule">Open</span></a>
      </nav>
      <p class="legal nb-legal">${esc(sampleNote(d))}</p>
    </div>`;
  document.querySelector('main').innerHTML = html;

  mountCursor();
  const out = mountOut(document.querySelector('.out-chart canvas'), q.chart);
  document.querySelector('.rerun').addEventListener('click', () => out.rerun());

  // wordmark dot follows the same sampling cycle
  if (!reduced) {
    const dot = document.querySelector('.wm-dot'), cy = newCycle(), t0 = performance.now();
    const tick = (now) => { cycleAt((now - t0) / 1000, cy); dot.style.setProperty('--cyc', (0.7 + 0.5 * cy.v).toFixed(3)); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    const els = Array.from(document.querySelectorAll('[data-reveal]'));
    els.forEach(el => { el.style.opacity = '0'; el.style.transform = 'translateY(24px)'; el.style.transition = 'opacity .9s cubic-bezier(.22,.61,.36,1), transform .9s cubic-bezier(.22,.61,.36,1)'; });
    const io = new IntersectionObserver(list => list.forEach(e => { if (e.isIntersecting) { e.target.style.opacity = '1'; e.target.style.transform = 'none'; io.unobserve(e.target); } }), { threshold: 0.1 });
    els.forEach(el => io.observe(el));
  }
}
main();
