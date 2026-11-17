/* ==========================================================================
   project.js — renders project.html?p=<slug> from content/portfolio.json
   Same immersion as the home page: a treated image plate with the blueprint
   lens in the hero, decoded title, split-flap metrics, a scroll-lit problem
   statement, a scroll-drawn method path, redaction-wiped decisions, shutter
   image reveals, the night-graph chart and a wipe to the next case.
   ========================================================================== */
(async function () {
  const d = await K.load();
  const { $, $$, esc, md } = K;
  const slug = new URLSearchParams(location.search).get('p');
  const cases = (d.projects || []).filter((x) => x.has_page && d.project_pages && d.project_pages[x.slug]);
  const meta = cases.find((x) => x.slug === slug) || cases[0];
  const pg = d.project_pages[meta.slug];
  const i = cases.indexOf(meta), next = cases[(i + 1) % cases.length];
  document.title = `${meta.title} · ${d.person.first_name} ${d.person.last_name}`;
  K.boot(d, 'project');

  /* ---------- hero ---------- */
  const hero = $('.pj-hero');
  $('.pj-hero-in', hero).innerHTML = `
    <a class="pj-back mono" href="index.html#work" data-wipe="All work">← All work</a>
    <div class="pj-meta mono"><b>Case ${String(i + 1).padStart(2, '0')} / ${String(cases.length).padStart(2, '0')}</b><span>${esc(meta.org)}</span><span>${esc(pg.dates || meta.year)}</span><span>${esc(pg.my_role || meta.role)}</span></div>
    <h1 class="pj-title" data-pj-title>${esc(meta.title)}</h1>
    <div class="pj-mets">${(meta.metrics || []).map((m, k) => `<div><span class="flap" data-flap="${esc(m[0])}" data-flap-delay="${1.2 + k * .15}"></span><p>${esc(m[1])}</p></div>`).join('')}</div>
    <p class="pj-hint mono">${K.fine ? 'Sweep over the image to reveal its line drawing' : 'Drag over the image to reveal its line drawing'}</p>`;
  let plate = null;
  try {
    plate = Plate.create($('.plate', hero), {
      src: (pg.images && pg.images[0]) || meta.thumbnail, contrast: 1.06, saturation: .8, gain: [.6, .6, .64], zoom: 1.18, focus: [.58, .6],
      map: { shadow: '#15171c', mid: '#59606f', high: '#dcecef', amount: .38 }, halation: .22, grain: .07, grainSize: 1.6,
      aberration: .0016, vignette: .55, depth: .014, lens: 'blueprint', lensRadius: .16,
      onFirstFrame: () => hero.classList.add('ready'),
    });
  } catch (e) { document.documentElement.classList.add('no-webgl'); }
  // lens: user drives it, Lissajous drift after 3 s idle
  const P = { x: .3, y: .1, tx: .3, ty: .1, last: -99, on: 0 };
  hero.addEventListener('pointermove', (e) => { const r = hero.getBoundingClientRect(); P.tx = ((e.clientX - r.left) / r.width) * 2 - 1; P.ty = -(((e.clientY - r.top) / r.height) * 2 - 1); P.last = performance.now() / 1000; }, { passive: true });
  hero.addEventListener('pointerdown', (e) => { const r = hero.getBoundingClientRect(); P.tx = ((e.clientX - r.left) / r.width) * 2 - 1; P.ty = -(((e.clientY - r.top) / r.height) * 2 - 1); P.last = performance.now() / 1000; }, { passive: true });
  let lt = performance.now();
  gsap.ticker.add(() => {
    const now = performance.now(), dt = Math.min(.05, (now - lt) / 1000); lt = now; const t = now / 1000;
    if (t - P.last > 3 && !K.reduce) { P.tx = Math.sin(t / 2.6) * .55 + .2; P.ty = Math.sin(t / 3.7 + 1.2) * .4 + .1; }
    const k = 1 - Math.exp(-(t - P.last < 3 ? 12 : 2) * dt);
    P.x += (P.tx - P.x) * k; P.y += (P.ty - P.y) * k;
    plate && plate.pointer(P.x, P.y, t > 1.6 ? 1 : 0, 60);
  });
  const title = $('[data-pj-title]', hero);
  if (!K.reduce) {
    K.hideDecode(title);
    gsap.timeline({ delay: .3 })
      .call(() => K.decode(title, { duration: 1.4 }), null, .15)
      .from('.pj-meta > *, .pj-back', { y: 14, opacity: 0, stagger: .06, duration: .6 }, 0)
      .from('.pj-mets > div p', { opacity: 0, y: 10, stagger: .1, duration: .6 }, 1.3)
      .from('.hero-reticle i', { scale: 0, opacity: 0, stagger: .05, duration: .6, ease: 'back.out(2)' }, .8);
    const sc = { x: -.05 };
    gsap.to(sc, { x: 1.4, duration: 2, ease: 'power2.inOut', delay: 1.2, onUpdate: () => plate && plate.scan(sc.x), onComplete: () => plate && plate.scan(-1) });
  }

  /* ---------- body ---------- */
  const imgs = pg.images || [], caps = pg.captions || [];
  const fig = (k, cls = '') => imgs[k] ? `<figure class="pj-fig ${cls}"><div class="shutter wide"><img src="${esc(imgs[k])}" alt="${esc(caps[k] || meta.title)}" loading="lazy" /><div class="slats" aria-hidden="true">${'<i></i>'.repeat(6)}</div></div><figcaption class="mono">Fig. ${k + 1} · ${esc(caps[k] || '')}</figcaption></figure>` : '';
  $('#pj-body').innerHTML = `
    <section class="pj-sec pj-ctx"><div class="wrap pj-two">
      <div><span class="eyebrow"><b>01</b> Context</span><p class="lede pj-ctx-t">${esc(pg.context)}</p>
        <dl class="pj-spec">${[['Role', pg.my_role], ['Dates', pg.dates], ['Team', meta.team], ['Duration', meta.duration]].filter((r) => r[1]).map(([a, b]) => `<div><dt class="mono">${a}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl></div>
      <div><span class="eyebrow"><b>02</b> Problem</span><p class="pj-problem">${esc(pg.problem)}</p></div>
    </div></section>
    ${fig(0, 'pj-fig-lg')}
    <section class="pj-sec"><div class="wrap pj-two">
      <div class="pj-stick"><span class="eyebrow"><b>03</b> What I did</span><h2 class="h2" data-decode>The <em>method</em></h2></div>
      <div class="path pj-path"><svg aria-hidden="true" preserveAspectRatio="none"><line class="bg" x1="7" x2="7" y1="0" y2="100%"/><line class="fg" x1="7" x2="7" y1="0" y2="100%"/></svg>
        ${(pg.what_i_did || []).map((w, k) => `<div class="stop"><span class="mono">Step ${k + 1}</span><p class="pj-step">${esc(w)}</p></div>`).join('')}</div>
    </div></section>
    <section class="pj-sec dark pj-dec"><div class="wrap">
      <span class="eyebrow"><b>04</b> Decisions</span><h2 class="h2" data-decode>Calls I <em>made</em></h2>
      <div class="decs">${(pg.decisions || []).map((x, k) => `<div class="dec"><span class="mono">0${k + 1}</span><h3>${esc(x.choice)}</h3><p class="redact">${esc(x.why)}</p></div>`).join('')}</div>
    </div></section>
    <div class="wrap pj-figs">${fig(1)}${fig(2)}</div>
    ${pg.chart ? `<section class="pj-sec dark pj-chart"><div class="wrap"><span class="eyebrow"><b>05</b> The data</span><h2 class="h2">${esc(pg.chart.title)}</h2>
      <div class="graph"><svg viewBox="0 0 960 300" role="img" aria-label="${esc(pg.chart.title)}"></svg><div class="legend mono">${pg.chart.series.map((se, k) => `<span><i class="${k ? 'c' : ''}"></i>${esc(se.name)}</span>`).join('')}</div><p class="readout mono" aria-live="polite"></p></div>
      <p class="mono" style="color:var(--muted-d);text-transform:none">${esc(pg.chart.note)}</p></div></section>` : ''}
    <section class="pj-sec pj-res"><div class="wrap">
      <span class="eyebrow"><b>06</b> Results</span>
      <div class="res-grid">${(pg.results || []).map((r, k) => `<div class="res"><span class="flap" data-flap="${esc(r.value)}" data-flap-delay="${k * .15}"></span><h3>${esc(r.metric)}</h3><p>${esc(r.note)}</p></div>`).join('')}</div>
    </div></section>
    <section class="pj-sec pj-learn"><div class="wrap">
      <span class="eyebrow"><b>07</b> What I learned</span><p class="pj-quote">${md(pg.learned)}</p>
      ${pg.next ? `<p class="pj-next-t"><span class="mono">Next</span>${esc(pg.next)}</p>` : ''}
    </div></section>
    <a class="pj-nextcase dark" href="project.html?p=${next.slug}" data-cursor="view" data-cursor-label="Next" data-wipe="${esc(next.title)}">
      <div class="wrap"><span class="eyebrow">Next case · ${esc(next.org)}</span><span class="pj-next-title">${esc(next.title)} <span aria-hidden="true">→</span></span></div>
    </a>`;

  // scroll-lit problem statement (word by word)
  const prob = $('.pj-problem');
  const ws = prob.textContent.split(/\s+/);
  prob.innerHTML = ws.map((w) => `<span class="tw">${esc(w)}</span>`).join(' ');
  const tws = $$('.tw', prob);
  if (K.reduce) tws.forEach((w) => w.classList.add('on'));
  else ScrollTrigger.create({ trigger: prob, start: 'top 80%', end: 'bottom 45%', scrub: true, onUpdate: (st) => { const n = Math.round(st.progress * tws.length * 1.05); tws.forEach((w, k) => w.classList.toggle('on', k < n)); } });
  // method path
  const path = $('.pj-path'), fg = $('.fg', path), stops = $$('.stop', path);
  const setPath = (pr) => { const h = path.clientHeight; fg.setAttribute('y2', (pr * h).toFixed(1)); stops.forEach((st) => st.classList.toggle('on', st.offsetTop <= pr * h + 8)); };
  if (K.reduce) setPath(1); else ScrollTrigger.create({ trigger: path, start: 'top 70%', end: 'bottom 55%', scrub: .4, onUpdate: (st) => setPath(st.progress) });
  $$('.redact').forEach((r) => new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) r.classList.add('in'); else if (e.boundingClientRect.top > 0) r.classList.remove('in'); }), { threshold: .6 }).observe(r));
  $$('.shutter').forEach(K.shutter);
  pg.chart && K.nightGraph($('.pj-chart svg'), $('.pj-chart .readout'), pg.chart);
  K.initDecode($('#pj-body'));
  K.initFlaps();
  K.initMagnetic();
  addEventListener('load', () => ScrollTrigger.refresh());
})();
