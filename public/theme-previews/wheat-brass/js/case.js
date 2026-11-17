// Case page in Ada Okafor's sub-page form (coaching-COfu0nGw.js): a weighted giant title with a
// photo beside it, alternating photo/text blocks with a big figure, a dark band of numbered
// steps with outcomes under it, an accordion, and a closing pair of cards.
import { gsap, reduced, $, $$, esc, photo, disc, loadData, shell, lines, reveals, parallax, accordion, arrive, forCompany } from './base.js';
import { weightName } from './weight.js';

const ORDER = ['working-capital', 'tile-pricing', 'cold-chain-entry'];
const PAGE = { 'working-capital': 'case-working-capital.html', 'tile-pricing': 'case-tile-pricing.html', 'cold-chain-entry': 'case-cold-chain.html' };
const TITLE = { 'working-capital': ['Fifteen', 'days'], 'tile-pricing': ['3.8', 'points'], 'cold-chain-entry': ['Which', 'town'] };
const CAPS = {
  'working-capital': ['The cash-cycle bridge from the taskforce pack', 'The issue tree we tested, branch by branch', 'Working session with the Pinewick finance team'],
  'tile-pricing': ['Pocket price against retailer volume, 360 retailers (pattern shown, not retailer data)', 'A retailer visit in Harlow Bay with the regional sales manager'],
  'cold-chain-entry': ['Demand and supply sizing for the four towns', 'The team room the night before the readout'],
};

function fitTitle(el) {
  const W = el.parentElement.clientWidth;
  if (!W) return;
  el.style.setProperty('--pt-size', '100px');
  const w = el.getBoundingClientRect().width;
  const fs = Math.max(56, Math.min(220, (W / w) * 100 * 0.96));
  el.style.setProperty('--pt-size', fs.toFixed(1) + 'px');
}

async function main() {
  const d = await loadData();
  const slug = document.body.dataset.case;
  const p = d.projects.find((x) => x.slug === slug), c = d.project_pages[slug];
  const nextSlug = ORDER[(ORDER.indexOf(slug) + 1) % ORDER.length];
  const next = d.projects.find((x) => x.slug === nextSlug);
  const imgs = c.images, caps = CAPS[slug];
  const co = forCompany();
  const steps = c.what_i_did.map((s, i) => `<li class="step" data-reveal data-reveal-delay="${(i % 3) * 0.08}"><span class="tn">Step ${i + 1}</span><p>${esc(s)}</p></li>`).join('');
  const outs = c.results.map((r) => `<div class="stat" data-reveal><b>${esc(r.value)}</b><span class="sl">${esc(r.metric)}</span><span class="sn">${esc(r.note)}</span></div>`).join('');
  const acc = c.decisions.map((x, i) => `<div class="acc-row"><h3 style="margin:0"><button class="acc-btn" aria-expanded="false" aria-controls="dq-${i}" id="dq-b-${i}">${esc(x.choice)}<i aria-hidden="true"></i></button></h3><div class="acc-panel" id="dq-${i}" role="region" aria-labelledby="dq-b-${i}"><p>${esc(x.why)}</p></div></div>`).join('');
  const quote = slug === 'cold-chain-entry' ? d.testimonials[1] : slug === 'tile-pricing' ? d.testimonials[2] : d.testimonials[0];
  const chartBlock = (src, cap) => `<figure class="chart" data-reveal><img src="${esc(src)}" alt="${esc(cap)}" loading="lazy" decoding="async"><figcaption>${esc(cap)}</figcaption></figure>`;

  $('main').innerHTML = `
  <section class="chero">
    <div class="container chero-top">
      <p class="lbl" data-intro>${esc(p.type)} · ${esc(p.org)} · ${esc(c.dates)}</p>
      <h1 class="ptitle" data-ptitle></h1>
      <div class="chero-grid">
        <div>
          <p class="case-h" data-intro>${esc(p.title)}</p>
          <p class="lede" data-intro>${esc(p.summary)}</p>
          <ul class="meta" data-intro><li><b>Role</b> ${esc(c.my_role)}</li><li><b>Length</b> ${esc(p.duration)}</li><li><b>Team</b> ${esc(p.team)}</li></ul>
          ${co ? `<p class="hero-for case-for" data-intro>Written up for ${esc(co)}: this is how I would approach ${esc(co)}'s operations and pricing questions.</p>` : ''}
          <div data-intro>${disc('#results', 'Skip to the results')}</div>
        </div>
        <div data-intro>${photo(imgs[0], p.title, { ratio: '4/3', eager: true })}</div>
      </div>
    </div>
  </section>

  <section class="prog">
    <div class="container prog-grid">
      <div class="prog-photo">${chartBlock(imgs[1], caps[0])}</div>
      <div>
        <p class="lbl" data-reveal>The situation</p>
        <h2 class="h2" data-lines>${esc(p.insight)}</h2>
        <div class="figure-row" data-reveal><b>${esc(p.metrics[0][0])}</b><span>${esc(p.metrics[0][1])}</span></div>
        <p class="lede" data-reveal>${esc(c.context)}</p>
      </div>
    </div>
  </section>

  <section class="prog flip">
    <div class="container prog-grid">
      <div class="prog-photo">${imgs[3] ? chartBlock(imgs[2], caps[1]) : photo(imgs[2], caps[1], { ratio: '4/3' })}</div>
      <div>
        <p class="lbl" data-reveal>The question</p>
        <h2 class="h2" data-lines>What the client asked</h2>
        <div class="figure-row" data-reveal><b>${esc(p.metrics[1][0])}</b><span>${esc(p.metrics[1][1])}</span></div>
        <p class="lede" data-reveal>${esc(c.problem)}</p>
      </div>
    </div>
  </section>

  <section class="sec dark" id="method" style="overflow:hidden">
    <div class="container">
      <p class="lbl" data-reveal>What I did</p>
      <h2 class="h2" data-lines>${c.what_i_did.length} steps, in the order I did them</h2>
      <ol class="steps">${steps}</ol>
      <div class="outcomes" id="results">${outs}</div>
    </div>
  </section>

  <section class="sec" style="padding-bottom:0">
    <div class="container" style="max-width:980px">
      <p class="lbl" data-reveal>Decisions, and why</p>
      <div class="acc" data-reveal>${acc}</div>
    </div>
  </section>

  <section class="sec">
    <div class="container">
      <div class="close-grid">
        <div class="close-card" data-reveal><h3>What I learned</h3><p>${esc(c.learned)}</p>${imgs[3] ? photo(imgs[3], caps[2], { ratio: '16/10' }) : ''}</div>
        <div class="close-card" data-reveal><h3>What I would do next</h3><p>${esc(c.next)}</p>
          <blockquote class="pull"><p>${esc(quote.quote)}</p><cite>${esc(quote.name)}, ${esc(quote.role)}</cite></blockquote>
          ${disc('index.html#contact', 'Discuss this case with Nisha')}</div>
      </div>
      <div class="next-case" data-reveal><span>Next write-up</span><a href="${PAGE[nextSlug]}">${esc(next.title)} <i aria-hidden="true">→</i></a></div>
    </div>
  </section>`;

  shell(d, 'case');
  const t = $('[data-ptitle]');
  const wn = weightName(t, TITLE[slug], { min: 300, max: 760, radius: 1.1 });
  fitTitle(t);
  document.fonts?.ready.then(() => fitTitle(t));
  new ResizeObserver(() => fitTitle(t)).observe(t.parentElement);
  lines(); reveals(); parallax(); accordion();
  await arrive();
  if (reduced()) return;
  const intro = $$('[data-intro]');
  gsap.set(wn.chars, { yPercent: 115 });
  gsap.set(intro, { opacity: 0, y: 16 });
  gsap.to(wn.chars, { yPercent: 0, duration: 1.2, stagger: 0.06, ease: 'expo.out' });
  gsap.to(intro, { opacity: 1, y: 0, duration: 0.9, stagger: 0.1, delay: 0.25, ease: 'power3.out' });
}
main();
