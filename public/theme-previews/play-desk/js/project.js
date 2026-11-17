/* Renders one project write-up from content/portfolio.json: project.html?p=<slug>. */
import { loadContent, esc, wireCopy, ICON } from './content.js';
import { buildStops, layout, paintMapBase, paintMapStops } from './island.js';
import { mountPortfolioAgent } from '../agent/portfolio-agent.js';

const $ = (s) => document.querySelector(s);
const ok = (v) => v && String(v).trim();

(async () => {
  const C = await loadContent();
  const slug = new URLSearchParams(location.search).get('p');
  const list = C.projects || [];
  let i = list.findIndex((p) => p.slug === slug); if (i < 0) i = 0;
  const p = list[i], pg = (C.project_pages || {})[p.slug] || {};
  const stops = buildStops(C), stop = stops.find((s) => s.slug === p.slug);
  document.title = `${p.title} · Yash Trivedi`;
  $('#back').href = `index.html?stop=${encodeURIComponent(p.slug)}`;

  const imgs = (pg.images || [p.thumbnail]).filter((src, k, a) => a.indexOf(src) === k && !/event-/.test(src));
  const caption = (src) => /thumb|cover/.test(src) ? `Cover for ${p.title}` : /photos\//.test(src) ? 'Yash Trivedi' : `Chart for ${p.title}`;
  const fig = (src) => `<figure><img src="${esc(src)}" alt="${esc(caption(src))}" loading="lazy" width="1600" height="1000"${/photos\//.test(src) ? ' style="max-width:420px;background:none"' : ''}></figure>`;
  const facts = [['Organisation', p.org], ['Role', pg.my_role || p.role], ['When', pg.dates || p.year], ['Team', p.team], ['Type', p.type]].filter(([, v]) => ok(v));
  const prev = list[(i - 1 + list.length) % list.length], next = list[(i + 1) % list.length];

  $('#pp').innerHTML = `
    <p class="eyebrow">Stop ${stop ? stop.n : ''} · Project ${i + 1} of ${list.length} · ${esc(p.org)}</p>
    <h1>${esc(p.title)}</h1>
    <p class="summary">${esc(p.summary)}</p>
    <div class="metrics">${(p.metrics || []).map(([v, l]) => `<div class="metric"><b${String(v).length > 7 && !/\s/.test(v) ? ' class="long"' : ''}>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div>
    <dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    ${imgs[0] ? fig(imgs[0]) : ''}
    ${ok(pg.context) ? `<h2>Context</h2><p>${esc(pg.context)}</p>` : ''}
    ${ok(pg.problem) && pg.problem !== pg.context ? `<h2>The problem</h2><p>${esc(pg.problem)}</p>` : ''}
    ${(pg.what_i_did || []).length ? `<h2>What I did</h2><ol class="steps">${pg.what_i_did.map((x) => `<li><span>${esc(x)}</span></li>`).join('')}</ol>` : ''}
    ${imgs[1] ? fig(imgs[1]) : ''}
    ${(pg.decisions || []).length ? `<h2>Decisions</h2>${pg.decisions.map((d) => `<div class="decision"><b>${esc(d.choice)}</b><span>${esc(d.why)}</span></div>`).join('')}` : ''}
    ${(pg.results || []).length ? `<h2>Results</h2><div class="results">${pg.results.map((r) => `<div class="result"><b>${esc(r.value)}</b><span>${esc(r.metric)}</span>${ok(r.note) ? `<span class="pill">${esc(r.note)}</span>` : ''}</div>`).join('')}</div>` : ''}
    ${ok(pg.learned) ? `<h2>What I learned</h2><p class="learned">${esc(pg.learned)}</p>` : ''}
    ${ok(pg.next) ? `<h2>Next</h2><p>${esc(pg.next)}</p>` : ''}
    ${imgs.slice(2).map(fig).join('')}
    <div class="where"><canvas width="400" height="400" aria-label="Map of the island with this project's billboard marked"></canvas><div><p class="eyebrow">On the island</p><p>This project has its own billboard in the project gallery, stop ${stop ? stop.n : ''} of ${stops.length}.</p><a class="btn primary" href="index.html?stop=${encodeURIComponent(p.slug)}&mode=drive">Drive to this billboard</a></div></div>
    <nav class="pp-nav" aria-label="More projects">
      <a href="project.html?p=${encodeURIComponent(prev.slug)}"><small>Previous project</small><span>${esc(prev.title)}</span></a>
      <a href="project.html?p=${encodeURIComponent(next.slug)}"><small>Next project</small><span>${esc(next.title)}</span></a>
    </nav>`;
  $('.pp-contact').innerHTML = `<p>Talk to Yash</p><div style="display:flex;flex-wrap:wrap;gap:8px"><button class="btn primary" type="button" data-copy="${esc(C.contact.email)}">${ICON.copy}Copy email</button><a class="btn" href="${esc(C.contact.linkedin)}" target="_blank" rel="noopener">${ICON.linkedin}LinkedIn</a><a class="btn" href="${esc(C.contact.resume_pdf)}" target="_blank" rel="noopener">${ICON.file}Resume</a></div>`;
  wireCopy(document);

  const cv = $('.where canvas'); const g = cv.getContext('2d');
  paintMapBase(g, 400, stops, layout(stops)); paintMapStops(g, 400, stops, { highlight: stop && stop.id });

  mountPortfolioAgent();
  
})();
