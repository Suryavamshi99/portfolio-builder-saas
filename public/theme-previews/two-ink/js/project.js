/* project.html?p=<slug> — one template for every entry in project_pages.
   Same immersion as the home page: a riso plate of the case image in the hero
   (still image, breathing zoom, lens = the unprinted image), ink blobs,
   a pinned horizontal rail for the steps, scrubbed reading, flip cards,
   two-pass printed results, loupes, the crosshair cursor and the roller pull. */
(async function () {
  const { esc, $, $$, RM, FINE } = K;
  let D; try { D = await (await fetch('content/portfolio.json')).json(); } catch (e) { console.error(e); return; }
  const pages = D.project_pages || {}; const slugs = Object.keys(pages);
  let slug = new URLSearchParams(location.search).get('p'); if (!pages[slug]) slug = slugs[0];
  const pg = pages[slug], pr = (D.projects || []).find((p) => p.slug === slug) || {};
  const media = (p) => 'media/' + p;
  document.title = `${pr.title || slug} · ${D.person?.first_name} ${D.person?.last_name}`;
  $('meta[name="description"]').content = pr.summary || '';
  if (D.meta?.noindex === false) $('meta[name="robots"]').remove();
  const riso = (src, alt = '') => `<div class="riso ${/^projects\//.test(src) ? 'riso-light' : ''}" data-loupe><span class="ra"><img src="${esc(media(src))}" alt="${esc(alt)}" loading="lazy"></span><span class="rb" aria-hidden="true"><img src="${esc(media(src))}" alt="" loading="lazy"></span><span class="rl" aria-hidden="true"><img src="${esc(media(src))}" alt="" loading="lazy"></span></div>`;

  // ---- hero ----
  $('#pj-no').textContent = String(slugs.indexOf(slug) + 1).padStart(2, '0') + ' / ' + String(slugs.length).padStart(2, '0');
  $('#pj-dates').textContent = `${pr.org || ''} · ${pg.dates || pr.year || ''}`;
  const title = pr.title || slug; const [t1, ...rest] = title.split(':');
  $('#pj-title').innerHTML = `<span class="w-mask"><span class="w">${esc(t1)}</span></span>${rest.length ? `<span class="pj-t2">${esc(rest.join(':').trim())}</span>` : ''}`;
  $('#pj-sum').textContent = pr.summary || '';
  $('#pj-meta').innerHTML = [['Role', pg.my_role], ['Duration', pr.duration], ['Team', pr.team]].filter((x) => x[1]).map(([k, v]) => `<div><dt class="mono">${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
  $('#pj-tags').textContent = (pr.tags || []).map((t) => '#' + t.replace(/\s+/g, '')).join(' ');
  const hero = $('#hero'); const img = (pg.images || [pr.thumbnail])[0];
  $('.plate-fallback').style.backgroundImage = `url(${media(img)})`;
  const portrait = () => innerWidth / innerHeight < 1;
  const plate = Press.RisoPlate($('.plate'), { image: media(img), theme: K.theme, pointerEl: hero, introPass: !RM, focus: [.5, .5], zoom: 1, depth: .012, rest: [.004, -.002],
    fade: () => (portrait() ? { dir: [0, -1], off: 1, a: .25, b: .7, amt: .9 } : { dir: [1, 0], off: 0, a: .22, b: .6, amt: .86 }) });
  if (plate.webgl) plate.onFirstFrame = () => hero.classList.add('ready'); else hero.classList.add('no-gl');
  const ink = Press.InkField($('canvas.ink'), K.theme, () => { const r = hero.getBoundingClientRect(); return r.bottom > 0 ? r : null; });
  const amb = { cx: 0, cy: 0, ax: 0, ay: 0, visible: true, scale: 0 }; Press.Blobs.ambient = amb;
  let drag = null;
  hero.addEventListener('pointerdown', (e) => { if (e.target.closest('a,button')) return; drag = { x: e.clientX, y: e.clientY, ox: plate.off.x, oy: plate.off.y, id: e.pointerId }; try { hero.setPointerCapture(e.pointerId); } catch (er) {} });
  hero.addEventListener('pointermove', (e) => { if (!drag || drag.id !== e.pointerId) return; const r = hero.getBoundingClientRect(); plate.hold(Math.max(-.035, Math.min(.035, drag.ox + (e.clientX - drag.x) / r.width * .11)), Math.max(-.012, Math.min(.012, drag.oy - (e.clientY - drag.y) / r.height * .05))); });
  const end = () => { drag = null; plate.hold(null); }; hero.addEventListener('pointerup', end); hero.addEventListener('pointercancel', end);
  const t0 = performance.now(); const root = document.documentElement.style; const lensTag = $('.lens-tag');
  gsap.ticker.add((tt, dms) => {
    const now = performance.now(), dt = Math.min(.05, dms / 1000), t = (now - t0) / 1000;
    const r = hero.getBoundingClientRect(); amb.visible = r.bottom > 0; amb.cx = r.left + r.width * .66; amb.cy = r.top + r.height * .5; amb.ax = r.width * .22; amb.ay = r.height * .25;
    plate.scroll = Math.max(0, Math.min(1, scrollY / Math.max(1, hero.offsetHeight))); plate.frame(now, dt); if (ink) ink.frame(t, dt);
    root.setProperty('--mx', (plate.off.x * 330).toFixed(2) + 'px'); root.setProperty('--my', (-plate.off.y * 330).toFixed(2) + 'px');
    const B = Press.Blobs; if (B.enabled && amb.visible && (B.active || now - B.lastMove > 3000)) { lensTag.style.opacity = 1; lensTag.style.transform = `translate3d(${(B.hx * innerHeight + 54).toFixed(0)}px,${(B.hy * innerHeight - r.top + 40).toFixed(0)}px,0)`; } else lensTag.style.opacity = 0;
  });
  if (!RM) gsap.timeline({ defaults: { ease: 'power3.out' } }).from('.nav', { yPercent: -120, duration: .8 }, .1).from('.pj-copy .back', { y: 20, opacity: 0, duration: .6 }, .3)
    .from('.pj-title .w', { yPercent: 115, scale: 1.5, rotate: -6, duration: .8, ease: 'back.out(2)' }, .45).from('.pj-t2', { y: 30, opacity: 0, duration: .7 }, .9)
    .from('.pj-sum, .pj-meta > div', { y: 24, opacity: 0, duration: .7, stagger: .08 }, 1.2).from('.hero-foot, .hero-hud', { opacity: 0, duration: .8 }, 1.8).to(amb, { scale: .8, duration: 1.4 }, 2.4);
  else amb.scale = .8;

  // ---- results: split-flap posters ----
  $('#pj-res').innerHTML = (pg.results || []).map((r, i) => `<div class="pj-res r${i % 3}" data-reveal data-reveal-delay="${i * .08}"><b data-flap="${esc(r.value)}"></b><span class="mono">${esc(r.metric)}</span><small>${esc(r.note)}</small></div>`).join('');

  // ---- context and problem: words light up with scroll ----
  $('#pj-context').innerHTML = (pg.context || '').split(' ').map((w) => `<span class="pw">${esc(w)}</span>`).join(' ');
  $('#pj-problem').innerHTML = (pg.problem || '').split(' ').map((w) => `<span class="pw">${esc(w)}</span>`).join(' ');
  if (!RM) gsap.fromTo('.pj-cp .pw', { opacity: .14 }, { opacity: 1, stagger: .04, ease: 'none', scrollTrigger: { trigger: '.pj-cp', start: 'top 75%', end: 'bottom 55%', scrub: .5 } });

  // ---- steps: pinned horizontal rail with progress ----
  const steps = pg.what_i_did || [];
  $('#st-t').textContent = String(steps.length).padStart(2, '0');
  $('#pj-steps').innerHTML = steps.map((s, i) => `<article class="pj-step" data-cursor="view" data-cursor-label="Step ${i + 1}"><span class="pj-step-n">${String(i + 1).padStart(2, '0')}</span><p>${esc(s)}</p></article>`).join('') + `<article class="pj-step pj-step-learn"><span class="mono">Lesson</span><p>${esc(pg.learned || '')}</p></article>`;
  const track = $('#pj-steps'), cards = $$('.pj-step', track);
  gsap.matchMedia().add('(min-width: 821px) and (prefers-reduced-motion: no-preference)', () => {
    gsap.to(track, { x: () => -(track.scrollWidth - innerWidth + 48), ease: 'none', scrollTrigger: { trigger: '#steps', start: 'top top', end: () => '+=' + (track.scrollWidth - innerWidth + 48), pin: '.pj-steps-pin', scrub: .5, anticipatePin: 1, invalidateOnRefresh: true,
      onUpdate: (s) => { $('#st-bar').style.transform = `scaleX(${s.progress})`; const n = Math.min(steps.length, 1 + Math.round(s.progress * steps.length)); $('#st-n').textContent = String(n).padStart(2, '0'); cards.forEach((c, i) => c.classList.toggle('on', i <= Math.round(s.progress * (cards.length - 1)))); } } });
  });
  if (RM || innerWidth <= 820) cards.forEach((c) => c.classList.add('on'));

  // ---- decisions as flip cards ----
  $('#pj-dec').innerHTML = (pg.decisions || []).map((d, i) => `<div class="flip" style="--r:${[-2, 1.6, -1][i % 3]}deg"><button type="button" class="flip-in" aria-label="${esc(d.choice)}: flip to read why" data-cursor="view" data-cursor-label="Why?">
    <span class="flip-f pj-dec-f"><span class="mono">Decision ${i + 1}</span><b>${esc(d.choice)}</b><em class="mono">Tap for the reason</em></span><span class="flip-b" inert><b>Why</b><span>${esc(d.why)}</span></span></button></div>`).join('');
  $$('.flip-in').forEach((b) => { let f = false; b.addEventListener('click', () => { f = !f; const set = () => { $('.flip-f', b).inert = f; $('.flip-b', b).inert = !f; };
    if (RM) { gsap.set(b, { rotationY: f ? 180 : 0 }); set(); return; }
    gsap.timeline({ onComplete: set }).to(b, { keyframes: [{ rotation: -3.2 }, { rotation: 2.8 }, { rotation: -2 }, { rotation: 1.4 }, { rotation: 0 }], duration: .45, ease: 'none' }).to(b, { rotationY: f ? 180 : 0, duration: .75, ease: 'back.out(1.25)' }); }); });

  // ---- gallery with loupes, scroll-expansion on the first image ----
  const imgs = (pg.images || []).slice(1);
  $('#pj-gal').innerHTML = imgs.map((s, i) => `<figure class="pj-fig f${i}" data-cursor="view" data-cursor-label="Loupe">${riso(s, `${pr.title}, image ${i + 2}`)}</figure>`).join('');
  if (!RM) $$('.pj-fig').forEach((f, i) => gsap.fromTo(f, { clipPath: 'inset(12% 18% 12% 18% round 30px)', rotate: i % 2 ? 2 : -2 }, { clipPath: 'inset(0% 0% 0% 0% round 18px)', rotate: 0, ease: 'none', scrollTrigger: { trigger: f, start: 'top 95%', end: 'center 55%', scrub: .6 } }));

  // ---- notes ----
  $('#pj-notes').innerHTML = [['What I learned', pg.learned], ['What I would do next', pg.next]].filter((x) => x[1]).map(([k, v], i) => `<figure class="note n${i}" data-reveal><i class="tape" aria-hidden="true"></i><figcaption><b>${esc(k)}</b></figcaption><blockquote>${esc(v)}</blockquote></figure>`).join('');

  // ---- tools ----
  $('#pj-tools').innerHTML = (pr.tools || []).map((t) => `<span class="dock-i" tabindex="0"><img src="media/logos/skills/${esc(t)}.svg" alt="${esc(t)}" loading="lazy"><em>${esc(t)}</em></span>`).join('');

  // ---- next case ----
  const nx = slugs[(slugs.indexOf(slug) + 1) % slugs.length]; const np = (D.projects || []).find((p) => p.slug === nx) || {};
  const nl = $('#pj-next'); nl.href = `project.html?p=${encodeURIComponent(nx)}`; nl.textContent = (np.title || nx).split(':')[0] + ' →';
  $('#foot-loc').textContent = D.person?.location || ''; if (D.demo) $('#demo-note').textContent = 'Sample persona: a fictional student, for a template.';

  // loupes
  if (FINE && !RM) $$('[data-loupe]').forEach((el) => { el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); el.style.setProperty('--lx', e.clientX - r.left + 'px'); el.style.setProperty('--ly', e.clientY - r.top + 'px'); }); el.addEventListener('pointerenter', () => el.classList.add('looking')); el.addEventListener('pointerleave', () => el.classList.remove('looking')); });
  K.boot(); K.reveals(); K.flapOnView();
  ScrollTrigger.refresh();
})();
