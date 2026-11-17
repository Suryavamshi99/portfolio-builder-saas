/* order.js: one work-order page, in the form of Skerry's tour.html (map banner, step-by-step list, side card, other orders). */
(async function () {
  const { $, esc } = K;
  const slug = document.body.dataset.slug;
  let d;
  try { d = await K.load(); } catch (e) { return; }
  const x = d.projects.find((p) => p.slug === slug), pg = d.project_pages[slug];
  if (!x || !pg) return;
  const idx = d.projects.indexOf(x);
  K.chrome(d, 'order');
  K.initScroll();
  K.compass();
  document.title = `${x.title} · ${d.person.first_name} ${d.person.last_name}`;

  /* banner map: the whole route, faint, with this order's stop lit */
  const svg = $('#map');
  const mode = matchMedia('(max-width: 900px)').matches ? 'tall' : 'wide';
  K.drawBase(svg, mode);
  const g = K.routePoints(mode);
  const stopI = Math.max(0, d.route.stops.findIndex((s) => s.projects.includes(slug)));
  const route = svg.querySelector('.map-route');
  const path = K.smooth(g.via);
  route.innerHTML = `<path class="r-base" d="${path}"/><path class="r-line" id="o-line" d="${path}"/>` + g.stops.map(([sx, sy], i) => `<g class="pin${i === stopI ? ' is-on' : ''}" transform="translate(${sx} ${sy})" style="pointer-events:none">${i === stopI ? '<circle class="p-pulse" r="24"/>' : ''}<circle class="p-dot" r="${i === stopI ? 15 : 9}"/>${i === stopI ? `<text class="p-n" y="4.5" text-anchor="middle">${K.pad2(i)}</text><text class="p-l" x="26" y="5">${esc(d.route.stops[i].place)}</text>` : ''}</g>`).join('');
  const ol = $('#o-line'), L = ol.getTotalLength();
  // the line is drawn up to this order's stop
  const N = 600; let f = 1, bd = 1e12;
  for (let i = 0; i <= N; i++) { const q = ol.getPointAtLength((L * i) / N), [sx, sy] = g.stops[stopI], dd = (q.x - sx) ** 2 + (q.y - sy) ** 2; if (dd < bd) { bd = dd; f = i / N; } }
  ol.style.strokeDasharray = L;
  ol.style.strokeDashoffset = K.reduced() ? L * (1 - f) : L;
  if (!K.reduced()) gsap.to(ol, { strokeDashoffset: L * (1 - f), duration: 2, delay: 0.5, ease: 'power3.inOut' });
  // map follows the pointer a little
  if (K.fine() && !K.reduced()) {
    const base = svg.querySelector('.map-base'), m = { x: 0, y: 0 }, t = { x: 0, y: 0 };
    $('.banner').addEventListener('pointermove', (e) => { t.x = (e.clientX / innerWidth - 0.5) * -16; t.y = (e.clientY / innerHeight - 0.5) * -10; });
    gsap.ticker.add(() => { m.x += (t.x - m.x) * 0.06; m.y += (t.y - m.y) * 0.06; base.setAttribute('transform', `translate(${m.x.toFixed(2)} ${m.y.toFixed(2)})`); });
  }

  /* banner copy */
  const stop = d.route.stops[stopI];
  $('#crumbs').innerHTML = `<a href="${K.link('index.html#work')}">Work orders</a><span>/</span><span>Order ${K.pad2(idx + 1)}</span><span>/</span><span>${esc(stop.place)}, ${esc(stop.coords)}</span>`;
  $('#o-title').textContent = x.title;
  $('#o-lead').textContent = x.summary;
  $('#o-facts').innerHTML = [['Role', pg.my_role], ['When', pg.dates], ['Length', x.duration], ['Team', x.team]].map(([k, v]) => `<li><span class="lab">${k}</span><b>${esc(v)}</b></li>`).join('');
  $('#o-img').src = K.media(pg.images[0]);
  $('#o-img').alt = x.title;
  $('#o-cap').textContent = `${x.org} · ${x.year}`;
  K.letters($('#o-title'), 0.35);
  K.intro();

  /* detail */
  $('#o-context').textContent = pg.context;
  $('#o-problem').textContent = pg.problem;
  $('#o-steps').innerHTML = pg.what_i_did.map((s, i) => `<li data-reveal><span class="lab">Step ${K.pad2(i + 1)}</span><p>${esc(s)}</p></li>`).join('');
  $('#o-dec').innerHTML = pg.decisions.map((c) => `<li><b>${esc(c.choice)}</b><p>${esc(c.why)}</p></li>`).join('');
  $('#o-learn').innerHTML = `<li><b>What I learned</b><p>${esc(pg.learned)}</p></li><li><b>What I would do next</b><p>${esc(pg.next)}</p></li>`;
  $('#o-res').innerHTML = pg.results.map((r) => `<div class="wid" data-reveal><span class="lab">${esc(r.metric)}</span><b>${esc(r.value)}</b><small>${esc(r.note)}</small></div>`).join('');
  $('#o-gal').innerHTML = pg.images.slice(1).map((src) => `<div class="ph" data-par><img src="${K.media(src)}" alt="${esc(((d.media.gallery.find((g) => g.src === src) || {}).caption) || x.title)}" loading="lazy" /></div>`).join('');

  /* station load chart for the trim line (kaizen data) */
  const kz = d.kaizen;
  const load = $('#o-load');
  if (kz && kz.project === slug && load) {
    load.hidden = false;
    $('#load-intro').textContent = `Takt is ${kz.takt} s. ${kz.moves}`;
    const W = 720, H = 300, pl = 40, pb = 30, max = 240, n = kz.stations.length, bw = (W - pl - 10) / n;
    const yv = (v) => H - pb - (v / max) * (H - pb - 16);
    const svgL = $('#load-svg');
    svgL.setAttribute('viewBox', `0 0 ${W} ${H}`);
    let s = `<line class="takt" x1="${pl}" x2="${W - 6}" y1="${yv(kz.takt)}" y2="${yv(kz.takt)}"/><text class="takt-t" x="${W - 8}" y="${yv(kz.takt) - 6}" text-anchor="end">TAKT ${kz.takt} S</text>`;
    [0, 60, 120, 180, 240].forEach((v) => (s += `<text x="${pl - 8}" y="${yv(v) + 4}" text-anchor="end">${v}</text>`));
    kz.stations.forEach((st, i) => { const x0 = pl + i * bw + bw * 0.18; s += `<rect class="bar" data-i="${i}" x="${x0}" width="${bw * 0.64}"/><text x="${x0 + bw * 0.32}" y="${H - 10}" text-anchor="middle">${esc(st)}</text><text class="val" data-v="${i}" x="${x0 + bw * 0.32}" text-anchor="middle"></text>`; });
    svgL.innerHTML = s;
    const show = (which) => {
      const arr = kz[which];
      svgL.querySelectorAll('.bar').forEach((b) => { const i = +b.dataset.i, v = arr[i]; b.setAttribute('y', yv(v)); b.setAttribute('height', H - pb - yv(v)); b.classList.toggle('over', v > kz.takt); });
      svgL.querySelectorAll('.val').forEach((t) => { const i = +t.dataset.v; t.setAttribute('y', yv(arr[i]) - 6); t.textContent = arr[i]; });
      $('#load-seg').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.w === which)));
    };
    $('#load-seg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) show(b.dataset.w); });
    show('before');
    if (!K.reduced()) ScrollTrigger.create({ trigger: load, start: 'top 60%', once: true, onEnter: () => setTimeout(() => show('after'), 500) });
    else show('after');
  }

  /* side card */
  $('#c-val').textContent = pg.results[0].value;
  $('#c-metric').textContent = `${pg.results[0].metric}, ${pg.results[0].note}`;
  $('#c-dl').innerHTML = [['Order', `${K.pad2(idx + 1)} of ${d.projects.length}`], ['Client', x.org], ['Type', x.type], ['Year', x.year]].map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
  const toolName = (id) => (d.tools.find((t) => t.logo.includes('/' + id + '.')) || { name: id }).name;
  $('#c-tools').innerHTML = x.tools.map((t) => `<li><img src="${K.media('logos/skills/' + t + '.svg')}" alt="" />${esc(toolName(t))}</li>`).join('');
  $('#c-book').href = K.link('index.html#book');
  $('#c-route').href = K.link('index.html#trip');

  /* more orders */
  const others = d.projects.filter((p) => p.has_page && p.slug !== slug);
  $('#more-grid').innerHTML = others.map((p) => K.orderCard(p, d.projects.indexOf(p))).join('');

  K.photos();
  K.tilt();
  K.reveal();
  ScrollTrigger.refresh();
})();
