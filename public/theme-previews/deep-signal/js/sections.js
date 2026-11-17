// Renders the page below the hero, in Stillwater's section order (its sections.ts, Dy and Py in the bundle).
import { esc, rich, forCompany, withFor } from './content.js';
import { dotAvatar } from './dots.js';

const PAGES = { 'eta-accuracy': 'notebook-eta-accuracy.html', 'growly-sip-stops': 'notebook-growly-sip-stops.html', 'larkspur-air': 'notebook-larkspur-air.html' };
const CARD_KIND = { slope: 'slope', bars: 'bars', ratio: 'ratio', dots: 'dots', converge: 'bars' };

export function renderNav(d) {
  const el = document.querySelector('header.top');
  el.innerHTML = `
    <div class="container nav-inner">
      <a class="wordmark" href="#top" aria-label="${esc(d.person.first_name)} ${esc(d.person.last_name)}, back to the top"><span class="wm-dot" aria-hidden="true"></span><span>${esc(d.person.first_name)} ${esc(d.person.last_name)}</span></a>
      <nav class="nav-links" aria-label="Primary" id="primary-nav">
        <a href="#trap">The peeking trap</a><a href="#questions">Questions</a><a href="#people">People</a>
      </nav>
      <div class="nav-right">
        <a class="link-rule" href="#contact">Write to me</a>
        <button class="menu-btn" type="button" aria-expanded="false" aria-controls="primary-nav" aria-label="Menu"><span></span><span></span></button>
      </div>
    </div>`;
}

export function fillHero(d) {
  const p = d.person, steps = d.site.signal_steps, co = forCompany();
  const set = (k, html) => { const n = document.querySelector(`[data-k="${k}"]`); if (n) n.innerHTML = html; };
  set('eyebrow', co ? `${esc(p.first_name)} ${esc(p.last_name)} · written for ${esc(co)}` : esc(d.meta.site_title));
  set('headline', rich(p.headline.replace('what the numbers at a paper company actually count', '*what the numbers at a paper company actually count*')));
  set('pitch', esc(d.pitch.short));
  if (co) { const n = document.querySelector('[data-k="forline"]'); n.textContent = d.pitch.for_company_template.replaceAll('{company}', co); n.hidden = false; }
  set('b0tag', 'The scatter · ' + esc(steps[0].label));
  set('b0title', esc(steps[0].title));
  set('b0text', esc(steps[0].detail));
  set('b1tag', 'The fitted line · ' + esc(steps[2].label));
  set('b1title', esc(steps[2].title));
  set('b1text', esc(steps[2].detail));
  set('b2tag', `${esc(p.first_name)} ${esc(p.last_name)}`);
  set('b2text', `${esc(p.current)}. Looking for ${esc(p.looking_for.charAt(0).toLowerCase() + p.looking_for.slice(1))}.`);
  set('place', esc(p.location));
  set('mega', `${esc(p.first_name)} <em>${esc(p.last_name)}</em>`);
}

export function renderSections(d) {
  const q = d.site.questions, co = forCompany();
  const cardSlugs = ['eta-accuracy', 'growly-sip-stops', 'larkspur-air', 'experiment-review'];
  const shelfSlugs = ['datathon', 'active-subscriber', 'home-credit-dataarena', 'small-samples'];
  const proj = Object.fromEntries(d.projects.map(x => [x.slug, x]));

  const cards = cardSlugs.map((s, i) => {
    const pr = proj[s], qq = q[s], kind = CARD_KIND[qq.chart.type] || 'bars';
    const go = PAGES[s]
      ? `<a class="link-rule" href="${esc(withFor(PAGES[s]))}">Open the notebook</a>`
      : `<span class="plain">Result only, no notebook</span>`;
    return `
      <li class="card-wrap" data-reveal data-reveal-delay="${(i * 0.08).toFixed(2)}">
        <article class="card">
          <div class="card-top"><span class="micro">${esc(pr.org)}</span><span class="micro">${esc(pr.year)}</span></div>
          <div class="card-art"><img src="media/${esc(pr.thumbnail)}" alt="" loading="lazy" /><canvas data-dots="${kind}" data-q="${esc(s)}" data-phase="${(i * 2.7).toFixed(1)}" aria-hidden="true"></canvas></div>
          <h3>${esc(qq.q)}</h3>
          <p>${esc(pr.result)}</p>
          <div class="card-go">${go}</div>
        </article>
      </li>`;
  }).join('');

  const shelf = shelfSlugs.map(s => { const pr = proj[s]; return `<li><img src="media/${esc(pr.thumbnail)}" alt="" loading="lazy" /><b>${esc(pr.title)}</b><span>${esc(pr.result)}</span><i>${esc(pr.org)} · ${esc(pr.year)}</i></li>`; }).join('');
  const terms = d.site.glossary.map((g, i) => `<li><button type="button" data-term="${i}" aria-pressed="false">${esc(g.term)}</button></li>`).join('');
  const quotes = d.testimonials.map((t, i) => `
      <li data-reveal data-reveal-delay="${(i * 0.1).toFixed(2)}">
        <figure class="quote">
          <blockquote><p>“${esc(t.quote)}”</p></blockquote>
          <figcaption><span class="avatar">${dotAvatar([2, 5, 9][i % 3])}</span>
            <span><strong>${esc(t.name)}</strong><span class="micro-sm">${esc(t.role)}</span><span class="micro-sm">${esc(t.relation)}</span></span></figcaption>
        </figure>
      </li>`).join('');
  const wallIdx = [8, 4, 7, 6, 9, 3, 5];
  const wall = wallIdx.map(i => d.media.gallery[i]).filter(Boolean).map(g => `<li><img src="media/${esc(g.src)}" alt="${esc(g.caption)}" loading="lazy" /><span>${esc(g.caption)}</span></li>`).join('');
  const path = d.journey.map(j => `<li><span>${esc(j.year)}</span><b>${esc(j.title)}</b></li>`).join('');
  const c = d.contact;
  const html = `
  <section class="section" id="trap" aria-labelledby="trap-title">
    <div class="container">
      <div class="section-head split" data-reveal>
        <div>
          <p class="eyebrow">The peeking trap</p>
          <h2 id="trap-title" class="section-title">What happens when you read an A/B test <em>early</em></h2>
          <p class="section-sub">Each line is a simulated test of two identical versions, so there is no real difference to find. Read once at the end and about one test in twenty still shows a "win" by chance. Read it every day and stop on the first good-looking day, and that share climbs much higher. This is why the test review I set up at Pinewick asked sales pods to pre-register each test before launch, whatever the whiteboard acronym said.</p>
        </div>
        <div class="toggle" role="group" aria-label="How often the result is read">
          <button type="button" data-mode="once" aria-pressed="true">Read once</button>
          <button type="button" data-mode="daily" aria-pressed="false">Read every day</button>
          <span class="toggle-thumb" aria-hidden="true"></span>
        </div>
      </div>
      <div class="trap-panel" data-trap data-reveal>
        <div class="trap-top">
          <span class="sim-tag">Simulation · random data made in your browser</span>
          <label class="micro" for="peek-day">Reading day <b data-day>28</b></label>
        </div>
        <div class="trap-art"><canvas aria-label="Forty simulated A/A tests: running z-score by day, with the significance band shaded" role="img"></canvas></div>
        <input class="sr" id="peek-day" type="range" min="3" max="28" value="28" step="1" />
        <div class="trap-big" aria-live="polite">
          <p class="huge" data-huge>5%</p>
          <p class="huge-lbl"><span data-huge-lbl>of identical tests get called a win</span><small>Live, from 1,000 simulated tests at the reading day and reading rule above. Leave it alone and it sweeps through the days by itself.</small></p>
        </div>
        <div class="trap-read">
          <div><p class="num" data-shown>0 of 40</p><p class="lbl" data-shown-lbl></p></div>
          <div><p class="num" data-once>5%</p><p class="lbl">of 1,000 simulated tests look like a win when read once, on that day</p></div>
          <div><p class="num" data-daily>25%</p><p class="lbl">of the same 1,000 look like a win at some point when read every day up to it</p></div>
        </div>
        <div class="trap-actions">
          <button class="act" type="button" data-rerun><i class="act-fill" aria-hidden="true"></i><span>Run 40 new tests</span></button>
          <span class="micro">Drag across the chart to move the reading day</span>
        </div>
        <p class="trap-note">How it is made: two identical versions, equal traffic each day, a z-test on the running totals, a win at |z| above 1.96 (5% significance). Daily reading starts on day 3. None of this is Pinewick or Brightfold data.</p>
      </div>
      <div class="terms" data-reveal>
        <div>
          <p class="eyebrow">Terms</p>
          <h3 class="terms-title">The words I write down before a test starts</h3>
        </div>
        <div>
          <ul class="tags" role="list">${terms}</ul>
          <p class="term-def" data-term-def aria-live="polite">Pick a term to read its definition.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="questions" aria-labelledby="questions-title">
    <div class="container">
      <div class="section-head" data-reveal>
        <p class="eyebrow">Questions answered</p>
        <h2 id="questions-title" class="section-title">Four questions I was asked, and <em>what the data said</em></h2>
        <p class="section-sub">Three of them have a notebook with the query, the chart, the choices I made and what I would do next.</p>
      </div>
      <ul class="cards" role="list">${cards}</ul>
      <div class="shelf" data-reveal>
        <div>
          <p class="eyebrow">Also done</p>
          <h3 class="terms-title">Smaller pieces of work, with their results</h3>
        </div>
        <ul class="shelf-list" role="list">${shelf}</ul>
      </div>
    </div>
  </section>

  <section class="section" id="people" aria-labelledby="people-title">
    <div class="container">
      <div class="about-row">
        <figure class="frame" data-reveal>
          <video muted loop playsinline preload="none" poster="media/hero-poster.jpg" aria-label="Mitali at a whiteboard, sketching the parts of a delivery promise">
            <source src="media/hero.mp4" type="video/mp4" />
          </video>
          <figcaption>${esc(d.media.gallery[4].caption)}</figcaption>
        </figure>
        <div class="about-copy" data-reveal>
          <p class="eyebrow">People</p>
          <h2 id="people-title" class="section-title">About me, and the people <em>I have worked with</em></h2>
          <p>${esc(d.about.intro)}</p>
          <p>${esc(d.about.now)}</p>
          <ul class="path" role="list">${path}</ul>
        </div>
      </div>
      <ul class="wall" role="list" data-reveal>${wall}</ul>
      <ul class="quotes" role="list">${quotes}</ul>
    </div>
  </section>

  <section class="band-wrap" id="contact" aria-labelledby="contact-title">
    <div class="container">
      <div class="band" data-reveal>
        <div class="band-art"><canvas data-dots="ripple" aria-hidden="true"></canvas></div>
        <figure class="band-photo"><img src="media/${esc(d.media.professional)}" alt="${esc(d.person.first_name)} holding a laptop" loading="lazy" /></figure>
        <div class="band-copy">
          <p class="eyebrow">Contact</p>
          <h2 id="contact-title" class="band-title">Tell me about the <em>role</em></h2>
          <p class="section-sub">${esc(d.person.looking_for)}.</p>
          ${co ? `<p class="for-line">${esc(d.pitch.for_company_template.replaceAll('{company}', co))}</p>` : ''}
          <form class="note-form" novalidate>
            <label for="n-who">Your name and company</label>
            <input id="n-who" name="who" type="text" autocomplete="organization" value="${co ? esc(co) : ''}" />
            <label for="n-role">The role, in a line or two</label>
            <textarea id="n-role" name="role"></textarea>
            <button class="act" type="submit"><i class="act-fill" aria-hidden="true"></i><span>Open it in my email app</span></button>
            <p class="note-msg" role="status" aria-live="polite">Your note lands as a draft in whichever mail program you use; you press send there.</p>
          </form>
          <ul class="lines" role="list">
            <li><span>Email</span><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li>
            <li><span>Phone</span><a href="tel:${esc(c.phone.replace(/\s/g, ''))}">${esc(c.phone)}</a></li>
            <li><span>LinkedIn</span><a href="${esc(c.linkedin)}" rel="noopener">Profile</a></li>
            <li><span>Calendar</span><a href="${esc(c.calendly)}" rel="noopener">Pick a time</a></li>
            <li><span>GitHub</span><a href="${esc(c.github)}" rel="noopener">Repositories</a></li>
            <li><span>Résumé</span><button type="button" class="link-rule" data-print>Print it</button></li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <footer class="footer">
    <div class="container foot-inner">
      <div>
        <a class="wordmark" href="#top"><span class="wm-dot" aria-hidden="true"></span><span>${esc(d.person.first_name)} ${esc(d.person.last_name)}</span></a>
        <p class="foot-line">${esc(d.values[2])}</p>
      </div>
      <nav class="foot-links" aria-label="Footer">
        <a href="#trap">The peeking trap</a><a href="#questions">Questions</a><a href="#people">People</a><a href="#contact">Contact</a>
        <button type="button" data-print>Résumé, printable</button><a href="${esc(c.dataarena)}" rel="noopener">DataArena</a><a href="${esc(c.substack)}" rel="noopener">Small Samples</a>
      </nav>
    </div>
    <div class="container"><p class="legal">${esc(sampleNote(d))} ${esc(d.logo_note || '')}</p></div>
  </footer>`;
  document.querySelector('main').insertAdjacentHTML('beforeend', html);
}

export function sampleNote(d) {
  return 'Sample persona: ' + String(d._note || '').replace(/^SAMPLE PERSONA\.\s*/, '').replace(/\s*Replace everything[^.]*\.[^.]*\.?$/, '').trim();
}

export function wireTerms(d) {
  const out = document.querySelector('[data-term-def]');
  const btns = Array.from(document.querySelectorAll('[data-term]'));
  btns.forEach(b => b.addEventListener('click', () => {
    btns.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    out.textContent = d.site.glossary[+b.dataset.term].def;
  }));
}

export function wireForm(d) {
  const f = document.querySelector('.note-form');
  if (!f) return;
  const msg = f.querySelector('.note-msg');
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const who = f.who.value.trim(), role = f.role.value.trim();
    if (!who) { msg.textContent = 'Add your name and company first.'; f.who.focus(); return; }
    const subject = `A role for ${d.person.first_name}${who ? ' · ' + who : ''}`;
    const body = `${role || '(role details)'}\n\n${who}`;
    location.href = `mailto:${d.contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    msg.textContent = 'Your email app should open now. If it does not, write to ' + d.contact.email + '.';
  });
}

export function cardData(d, slug) { return d.site.questions[slug] ? d.site.questions[slug].chart : {}; }
