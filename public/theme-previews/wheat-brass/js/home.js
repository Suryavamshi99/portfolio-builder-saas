// Home page, in Ada Okafor's section order (main-BbQ27Sor.js): hero sandwich → about with
// principles → dark drag strip with a list under it → 3D book → (Contour re-weight table in
// place of Ada's quotes and podcast) → contact over a photo.
import { gsap, reduced, $, $$, esc, photo, field, disc, loadData, shell, lines, reveals, parallax, form, forCompany, arrive } from './base.js';
import { weightName } from './weight.js';
import { createPlate } from './plate.js';
import { dragStrip, imageTrail } from './strip.js';
import { caseBook } from './book.js';
import { reweight } from './rank.js';

const CASE_PAGE = { 'working-capital': 'case-working-capital.html', 'tile-pricing': 'case-tile-pricing.html', 'cold-chain-entry': 'case-cold-chain.html' };

function heroHTML(d) {
  const h = d.site.hero, co = forCompany();
  const forLine = co ? `<p class="hero-for" data-intro>${esc(d.pitch.for_company_template.replaceAll('{company}', co))}</p>` : '';
  const stats = d.site.hero_stats.map(([n, l]) => `<li><b>${esc(n)}</b><span>${esc(l)}</span></li>`).join('');
  return `
  <section class="hero" id="top" aria-label="Introduction">
    <canvas class="stage" aria-hidden="true"></canvas>
    <h1 class="name" data-name>${esc(d.person.first_name)} ${esc(d.person.last_name)}</h1>
    <canvas class="cutout" aria-hidden="true"></canvas>
    <div class="hero-copy">
      <p class="kicker" data-intro>${esc(d.site.hero_kicker)}</p>
      <p class="hero-line display" data-hero-line>${esc(h.answer)}</p>
      ${forLine}
      <div class="hero-cta" data-intro>
        ${disc('#cases', 'Go to the cases')}
        ${disc('#model', 'Change the weights', { cls: 'hollow' })}
      </div>
    </div>
    <ul class="hero-proof" data-intro aria-label="Selected results">${stats}</ul>
    <p class="hero-cap" data-intro>${esc(h.exhibit0.replace(/^Exhibit 0 · /, ''))}</p>
  </section>`;
}

function mainHTML(d) {
  const S = d.site.sections, P = d.projects;
  const principles = d.site.pillars.map((p, i) => `
    <li class="principle" data-reveal data-reveal-delay="${i * 0.08}">
      <span class="pn">${String(i + 1).padStart(2, '0')}</span>
      <h3>${esc(p.name)}</h3>
      <p class="pp"><b>${esc(p.proof)}</b> ${esc(p.proof_label)}</p>
      <p>${esc(p.text)}</p>
    </li>`).join('');
  const heights = [1, 0.84, 1, 0.9, 0.96, 0.8, 1, 0.88];
  const cards = P.map((p, i) => {
    const href = CASE_PAGE[p.slug];
    const inner = `
      ${photo(p.thumbnail, '', { ratio: i % 3 === 1 ? '1/1.1' : i % 3 === 2 ? '4/5' : '5/6', par: false, pos: '50% 40%' })}
      <figcaption><span class="sk">${esc(p.org)} · ${esc(p.year)}</span><b>${esc(p.title)}</b><span class="sr">${esc(p.result)}</span>${href ? '<span class="sm">Case write-up <i aria-hidden="true">→</i></span>' : ''}</figcaption>`;
    return `<figure class="scard${href ? ' has-page' : ''}" style="--h:${heights[i % 8]}">${href ? `<a href="${href}" draggable="false">${inner}</a>` : inner}</figure>`;
  }).join('');
  const journey = d.journey.map((j, i) => `
    <li class="topic" data-reveal data-reveal-delay="${(i % 3) * 0.07}"><span class="tn">${esc(j.year)}</span><h3>${esc(j.title)}</h3><p>${esc(j.detail)}</p></li>`).join('');
  const book = P.find((p) => p.slug === 'casebook');
  const tree = d.site.issue_tree;
  const quote = d.testimonials[2];
  const C = d.contact;
  return `
  ${heroHTML(d)}

  <section class="sec about" id="field">
    <div class="container about-grid">
      <div class="about-text">
        <p class="lbl" data-reveal>Field notes</p>
        <h2 class="statement" data-lines>${esc(d.pitch.short.split('. ')[0])}.</h2>
        <p class="lede" data-reveal>${esc(d.about.intro)}</p>
        <p class="lede" data-reveal>${esc(d.about.now)}</p>
        <p class="trail-hint" data-reveal aria-hidden="true">Sweep the pointer over this section and photos from the warehouse floor follow it.</p>
      </div>
      <div class="about-photo" data-reveal>
        ${photo(d.media.professional, 'Nisha Bhandari, half-length portrait with arms folded', { ratio: '4/5', pos: '50% 28%' })}
        <p class="caption">Fenwater, 2026. ${esc(d.person.current)}.</p>
      </div>
    </div>
    <div class="container">
      <p class="lbl sub" data-reveal>${esc(S.method.headline)}</p>
      <ul class="principles">${principles}</ul>
    </div>
  </section>

  <section class="sec speak dark" id="cases">
    <div class="container speak-head">
      <div><p class="lbl" data-reveal>Cases</p><h2 class="h2" data-lines>${esc(S.exhibits.headline)}</h2></div>
      <div class="speak-side"><p class="lede" data-reveal>${esc(S.exhibits.note)} Pull the row sideways, or focus it and press the arrow keys.</p></div>
    </div>
    <div class="strip" data-strip tabindex="0" role="region" aria-label="Eight pieces of work. Drag or use the arrow keys."><div class="strip-track">${cards}</div></div>
    <div class="container"><div class="strip-progress" aria-hidden="true"><i></i></div></div>
    <div class="container">
      <h3 class="list-h" data-reveal>${esc(S.journey.headline)}</h3>
      <ol class="topics">${journey}</ol>
    </div>
  </section>

  <section class="sec book" id="casebook">
    <div class="container book-grid">
      <div class="book-stage" data-book-stage>
        <div class="book-shadow" aria-hidden="true"></div>
        <div class="book-rig" data-book-rig>
          <div class="book3d" role="img" aria-label="${esc(book.title)}, co-edited by Nisha Bhandari">
            <div class="bk bk-back"></div><div class="bk bk-pages-r"></div><div class="bk bk-pages-t"></div><div class="bk bk-pages-b"></div>
            <div class="bk bk-spine"><span>Casebook 2026</span></div>
            <div class="bk bk-front">
              <div class="cloth"></div><div class="hinge"></div>
              <div class="cover-type">
                <span class="ck">Consulting Club · Whitlock School of Management</span>
                <svg class="tree-mark" viewBox="0 0 60 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="8" cy="32" r="4"/><path d="M12 32h10M22 12v40M22 12h12M22 32h12M22 52h12"/><rect x="34" y="7" width="18" height="10" rx="1.5"/><rect x="34" y="27" width="18" height="10" rx="1.5"/><rect x="34" y="47" width="18" height="10" rx="1.5"/></svg>
                <span class="ct">Casebook<br>2026</span>
                <span class="cs">${esc(book.metrics[0][0])} practice ${esc(book.metrics[0][1])} from regional industries</span>
                <span class="ca">Co-edited by R. Bhandari</span>
              </div>
              <div class="gloss"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="book-copy">
        <p class="lbl" data-reveal>Case book</p>
        <h2 class="h2" data-lines>${esc(book.title)}</h2>
        <p class="lede" data-reveal>${esc(book.summary)} ${esc(book.result)}.</p>
        <ul class="facts" data-reveal>${book.metrics.map(([n, l]) => `<li>${esc(n)} ${esc(l)}</li>`).join('')}<li>${esc(book.team)}</li></ul>
        <blockquote class="pull" data-reveal><p>${esc(quote.quote)}</p><cite>${esc(quote.name)}, ${esc(quote.role)}</cite></blockquote>
        <div class="opened" data-reveal>
          <p class="opened-h">One case, opened: ${esc(tree.question)}</p>
          <ul>${tree.branches.map((b) => `<li><b>${esc(b.name)}</b><span>${b.leaves.map((l) => `<em class="${l.status}">${esc(l.t)}: ${esc(l.v)}</em>`).join('')}</span></li>`).join('')}</ul>
          <p class="opened-a">${esc(tree.answer)}. ${esc(tree.after)}.</p>
          ${disc('case-working-capital.html', 'Open the working-capital write-up')}
        </div>
      </div>
    </div>
  </section>

  <section class="sec model" id="model">
    <div class="container">
      <div class="sec-head"><div><p class="lbl" data-reveal>Re-weight the market</p><h2 class="h2" data-lines>${esc(S.model.headline)}</h2></div><p class="lede" data-reveal>Scores out of 10 from the Pinewick depot project. Turn a criterion off or choose a different weight set and the six options change places.</p></div>
      <div class="model-grid">
        <div class="model-l">
          <div class="crit" data-reveal></div>
          <p class="mini" data-reveal>Weight sets</p>
          <div class="presets" data-reveal></div>
        </div>
        <div class="model-r" data-reveal>
          <div class="rank">
            <div class="rank-bar"><span>${esc(d.market_model.title)}</span><span>Counting: <b class="scoring"></b></span></div>
            <div class="rk-table" role="table" aria-label="Six options ranked by weighted score">
              <div class="tr th rk-head" role="row"></div>
              <div class="rk-body" role="rowgroup"></div>
            </div>
          </div>
          <p class="verdict" aria-live="polite"></p>
          <p class="small">${esc(d.market_model.source)} Gap is the unserved depot demand by 2028.</p>
        </div>
      </div>
      <p class="rec" data-reveal>${esc(d.market_model.recommendation)}</p>
      ${disc('case-cold-chain.html', 'The depot write-up in full')}
    </div>
  </section>

  <section class="sec contact" id="contact">
    <div class="contact-bg" aria-hidden="true">${photo('media/photos/candid-war-room.jpg', '', { pos: '50% 50%' })}</div>
    <div class="container contact-grid">
      <div class="contact-copy">
        <p class="lbl" data-reveal>${esc(S.contact.label)}</p>
        <h2 class="h1" data-lines>${esc(S.contact.headline)}</h2>
        <p class="lede" data-reveal>${esc(d.person.looking_for)}. Based in ${esc(d.person.location)}.</p>
        <dl class="reach" data-reveal>
          <div><dt>Email</dt><dd><a href="mailto:${esc(C.email)}">${esc(C.email)}</a></dd></div>
          <div><dt>Phone</dt><dd><a href="tel:${esc(C.phone.replace(/\s/g, ''))}">${esc(C.phone)}</a></dd></div>
          <div><dt>LinkedIn</dt><dd><a href="${esc(C.linkedin)}" rel="noopener">linkedin.com/in/example</a></dd></div>
          <div><dt>Résumé</dt><dd><a href="resume.html">Print view</a> · <a href="${esc(C.resume_pdf)}" download>PDF</a></dd></div>
        </dl>
        <p class="small on-dark">Placeholder contact details on a fictional sample site.</p>
      </div>
      <div class="card form-card" data-reveal>
        <form id="contact-form" novalidate aria-label="Write to Nisha">
          ${field('c-topic', 'About', '<select id="c-topic" name="topic"><option>An Associate or Consultant role</option><option>A case or project question</option><option>The casebook</option><option>Something else</option></select>')}
          <div class="two">
            ${field('c-name', 'Your name', '<input id="c-name" name="name" autocomplete="name">')}
            ${field('c-email', 'Your email', '<input id="c-email" name="email" type="email" autocomplete="email">')}
          </div>
          ${field('c-msg', 'Message', '<textarea id="c-msg" name="message" rows="4"></textarea>')}
          <button class="send" type="submit"><span>Send to Nisha</span><i aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M4 10h11M10.5 5.5 15 10l-4.5 4.5"/></svg></i></button>
        </form>
        <p class="form-ok" tabindex="-1" role="status" hidden></p>
      </div>
    </div>
  </section>`;
}

// Hero layout. Landscape: Nisha at about 38% across, frame scaled so her helmet tops the
// lower half of the name. Portrait: the frame sits low, the name stacks above her head.
function layoutFor(W, H) {
  const SW = 1280, SH = 960, portrait = W / H < 0.95;
  const gut = Math.max(16, Math.min(56, W * 0.04));
  let s, x, y;
  if (!portrait) {
    s = Math.max(W / SW, H / SH) * 1.06;
    const w = SW * s, h = SH * s;
    x = Math.min(0, Math.max(W - w, W * 0.35 - 0.52 * w));
    y = Math.max(H - h, Math.min(H * 0.2, 0.16 * H));
    return { x, y, w, h, portrait, gut, shade: [0.62, 0.18, 0.45, 0.42] };
  }
  const h = H * 0.72; s = h / SH; const w = SW * s;
  x = Math.min(0, Math.max(W - w, W * 0.6 - 0.52 * w));
  y = H - h;
  return { x, y, w, h, portrait, gut, shade: [0.1, 0.1, 0.8, 0.62] };
}

function placeName(hero, nameEl, L) {
  const W = hero.clientWidth;
  hero.dataset.mode = L.portrait ? 'portrait' : 'landscape';
  nameEl.style.setProperty('--name-size', '100px');
  nameEl.style.left = L.gut + 'px'; nameEl.style.top = '0px';
  const w100 = nameEl.getBoundingClientRect().width;
  const avail = (W - L.gut * 2) * (L.portrait ? 0.98 : 0.94);
  const fs = Math.max(48, Math.min(L.portrait ? 140 : 300, (avail / w100) * 100));
  nameEl.style.setProperty('--name-size', fs.toFixed(1) + 'px');
  const helmetTop = L.y + 0.03 * L.h;
  const r = nameEl.getBoundingClientRect(), hr = hero.getBoundingClientRect();
  // the name's last line: put its baseline about a third of the font size below the helmet top
  const baseFromTop = r.height - fs * 0.2;
  let top = helmetTop + fs * (L.portrait ? 0.14 : 0.2) - baseFromTop;
  top = Math.max(L.portrait ? 74 : 86, top);
  nameEl.style.top = top.toFixed(1) + 'px';
  void hr;
}

async function heroIntro(hero) {
  const chars = $$('.name .ch', hero), intro = $$('[data-intro]', hero), line = $$('[data-hero-line]', hero), mast = $$('.mast');
  if (reduced()) return;
  gsap.set([...intro, ...line], { opacity: 0, y: 16 });
  gsap.set(chars, { yPercent: 115 });
  gsap.set(mast, { opacity: 0, y: -10 });
  gsap.timeline({ defaults: { ease: 'power3.out' } })
    .to(mast, { opacity: 1, y: 0, duration: 0.9 }, 0)
    .to(chars, { yPercent: 0, duration: 1.25, stagger: 0.05, ease: 'expo.out' }, 0.05)
    .to(intro[0], { opacity: 1, y: 0, duration: 0.9 }, 0.5)
    .to(line, { opacity: 1, y: 0, duration: 1 }, 0.7)
    .to(intro.slice(1), { opacity: 1, y: 0, duration: 0.9, stagger: 0.12 }, 0.95);
}

async function main() {
  const d = await loadData();
  document.title = `${d.person.first_name} ${d.person.last_name} · management consulting portfolio`;
  $('main').innerHTML = mainHTML(d);
  shell(d, 'home');

  const hero = $('.hero'), nameEl = $('.name', hero);
  weightName(nameEl, [d.person.first_name, d.person.last_name], { min: 300, max: 780, radius: 1.35 });
  let L = layoutFor(hero.clientWidth, hero.clientHeight);
  const plate = createPlate($('canvas.stage', hero), $('canvas.cutout', hero), {
    video: 'media/video/hero-pingpong.mp4',
    frames: { dir: 'media/cutout', count: 61, fps: 12, crop: CROP, src: [1280, 960] },
    playbackRate: 0.85,
    pointerTarget: hero,
    grade: {
      lift: [0.014, 0.01, 0.004], gamma: [1, 1, 1], gain: [1.03, 1, 0.93], contrast: 1.06, saturation: 0.86,
      map: { shadow: '#17182b', mid: '#6a6ab3', high: '#ddddf3', amount: 0.2 },
      halation: 0.22, halationColor: '#a0a6ff', grain: 0.07, vignette: 0.32, parallax: 0.006, fill: '#17182b',
    },
    layout: (W, H) => (L = layoutFor(W, H)),
    onLayout: () => placeName(hero, nameEl, L),
  });
  if (!plate.webgl) {
    hero.classList.add('no-gl');
    const c = document.createElement('img');
    c.className = 'cut-still'; c.alt = ''; c.src = 'media/cutout/c030.webp';
    hero.insertBefore(c, $('.hero-copy', hero));
    const lay = () => { L = layoutFor(hero.clientWidth, hero.clientHeight); placeName(hero, nameEl, L);
      Object.assign(c.style, { left: L.x + (CROP[0] / 1280) * L.w + 'px', top: L.y + (CROP[1] / 960) * L.h + 'px', width: (CROP[2] / 1280) * L.w + 'px' }); };
    new ResizeObserver(lay).observe(hero); lay();
  }
  document.fonts?.ready.then(() => placeName(hero, nameEl, L));

  lines(); reveals(); parallax();
  imageTrail($('#field'), d.media.gallery.filter((g) => !['profile'].includes(g.kind)).map((g) => ({ src: g.src, cap: esc(g.caption) })));
  dragStrip($('[data-strip]'), $('.strip-progress i'));
  caseBook($('#casebook'));
  reweight($('#model'), d.market_model);
  form($('#contact-form'), [
    { name: 'name', msg: 'Please add your name.' },
    { name: 'email', type: 'email', msg: 'Please add an email address I can reply to.' },
    { name: 'message', msg: 'Please write a line or two.' },
  ], 'Thank you. This is a sample portfolio, so the message was not sent anywhere. Replace the form endpoint before publishing.');

  await Promise.race([plate.ready, new Promise((r) => setTimeout(r, 1400))]);
  await arrive();
  heroIntro(hero);
}

const CROP = [345, 0, 658, 960];
main();
