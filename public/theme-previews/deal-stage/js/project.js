/* One write-up from content/portfolio.json: project.html?p=<slug> */
import { startEye, tileHTML } from './eye.js';
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const D = await fetch('content/portfolio.json').then(r => r.json());
const A = D.site.accounts, L = D.site.labels;
const slug = new URLSearchParams(location.search).get('p');
const k = Math.max(0, A.findIndex(a => a.slug === slug));
const a = A[k], p = D.projects.find(x => x.slug === a.slug), pg = D.project_pages[a.slug] || {}, lb = L[a.kind];
const m = (src) => 'media/' + src;
document.title = `${a.short} · ${D.person.first_name} ${D.person.last_name}`;
document.getElementById('back').href = 'index.html#deals';
const main = document.getElementById('main');
main.style.setProperty('--bg', a.color);
const caption = (src) => (pg.captions && pg.captions[src]) || '';
const toolName = (t) => (D.tools.find(x => x.logo.endsWith('/' + t + '.svg')) || { name: t }).name;

function chart(c) {
  const narrow = innerWidth < 700, W = narrow ? 360 : 640, x0 = narrow ? 0 : 200, rh = narrow ? 78 : 60, ty = narrow ? 22 : 29, by = narrow ? 30 : 0;
  const max = Math.max(...c.bars.map(b => b[1])) * 1.2;
  const rows = c.bars.map((b, i) => { const y = 10 + i * rh, w = (W - x0 - (narrow ? 110 : 120)) * b[1] / max;
    return `<text x="0" y="${y + ty}" font-size="21" font-weight="900" font-family="Big Shoulders" fill="#dcf4f4">${esc(b[0].toUpperCase())}</text><rect x="${x0}" y="${y + by}" width="${w.toFixed(1)}" height="40" rx="12" fill="${i === c.bars.length - 1 ? '#41d9d7' : '#dcf4f4'}"/><text x="${(x0 + w + 12).toFixed(1)}" y="${y + by + 29}" font-size="24" font-weight="900" font-family="Big Shoulders" fill="#dcf4f4">${esc(b[2])}</text>`; }).join('');
  return `<div class="chart card-ink"><h3>${esc(c.title)}</h3><svg viewBox="0 0 ${W} ${14 + c.bars.length * rh}" role="img" aria-label="${esc(c.title)}: ${c.bars.map(b => b[0] + ' ' + b[2]).join(', ')}">${rows}</svg></div>`;
}
const imgs = (pg.images || [p.thumbnail]).filter(Boolean), extra = imgs.slice(1);
main.innerHTML = `<article class="sheet">
  <header class="ph">
    <div class="ph-mark" data-mark="0" style="background:${a.mark.bg}">${tileHTML(a.mark)}</div>
    <div><p class="kicker">${esc(p.type)} · ${esc(p.org)} · ${esc(p.year)}</p><h1 class="cut">${esc(a.short)}</h1><p class="lede">${esc(p.title)}</p></div>
  </header>
  <dl class="facts-big"><div><dt>${esc(lb[0])}</dt><dd>${esc(a.size[0])}<small>${esc(a.size[1])}</small></dd></div><div><dt>${esc(lb[1])}</dt><dd>${esc(a.cycle)}</dd></div><div><dt>My role</dt><dd class="sm">${esc(pg.my_role || p.role)}<small>${esc(pg.dates || p.year)} · ${esc(p.team)}</small></dd></div></dl>
  <figure class="window hero-img"><img src="${m(imgs[0])}" alt="${esc(p.title)}" width="1400" height="875"></figure>
  <div class="res">${(pg.results || []).map(r => `<div><b>${esc(r.value)}</b><span>${esc(r.metric)}</span><small>${esc(r.note)}</small></div>`).join('')}</div>
  <div class="two"><section class="sec"><h2>The context</h2><p>${esc(pg.context)}</p></section><section class="sec"><h2>The problem</h2><p>${esc(pg.problem)}</p></section></div>
  <section class="sec"><h2>What I did</h2><ol class="steps">${(pg.what_i_did || []).map(s => `<li>${esc(s)}</li>`).join('')}</ol></section>
  ${pg.chart ? chart(pg.chart) : ''}
  ${pg.flow ? `<div class="chart card-ink"><h3>${esc(pg.flow.title)}</h3><ol class="flow">${pg.flow.steps.map(st => `<li><b>${esc(st[0])}</b><span>${esc(st[1])}</span></li>`).join('')}</ol></div>` : ''}
  ${pg.decisions && pg.decisions.length ? `<section class="sec"><h2>Two decisions and why</h2><div class="decs">${pg.decisions.map(d => `<div class="dec"><b>${esc(d.choice)}</b><p>${esc(d.why)}</p></div>`).join('')}</div></section>` : ''}
  ${extra.length ? `<div class="gallery">${extra.map((s, i) => `<figure class="gi"><div class="window ${i % 2 ? 'tilt-r' : 'tilt-l'}"><img src="${m(s)}" alt="${esc(caption(s) || p.title)}" loading="lazy"></div>${caption(s) ? `<figcaption>${esc(caption(s))}</figcaption>` : ''}</figure>`).join('')}</div>` : ''}
  <div class="two">${pg.learned ? `<section class="sec"><h2>What I learned</h2><p>${esc(pg.learned)}</p></section>` : ''}${pg.next ? `<section class="sec"><h2>What I would do next</h2><p>${esc(pg.next)}</p></section>` : ''}</div>
  <p class="tools"><span>Tools</span>${p.tools.map(t => `<img src="media/logos/skills/${esc(t)}.svg" alt="${esc(toolName(t))}" title="${esc(toolName(t))}" width="28" height="28">`).join('')}</p>
</article>`;
const prev = A[(k - 1 + A.length) % A.length], next = A[(k + 1) % A.length];
document.getElementById('foot').innerHTML = `<a class="pn prev" href="project.html?p=${prev.slug}"><small>Previous</small><b>${esc(prev.short)}</b></a><a class="pn next" href="project.html?p=${next.slug}"><small>Next</small><b>${esc(next.short)}</b></a>`;
if (D.demo) { const n = document.createElement('p'); n.className = 'sample-note'; n.textContent = 'Sample persona. Everything shown on this page is made up.'; document.body.appendChild(n); }
const c = document.createElement('canvas'); c.width = c.height = 180; const x = c.getContext('2d'), im = x.createImageData(180, 180);
for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
x.putImageData(im, 0, 0); document.querySelector('.grain').style.backgroundImage = `url(${c.toDataURL()})`;
startEye({ ring: 'READ', marks: () => ({ mark: a.mark, tag: { name: a.mark.name, rows: [[lb[0], a.size[0], a.size[1]], [lb[1], a.cycle]], extra: a.extra } }),
  start: () => { const r = document.querySelector('.ph-mark').getBoundingClientRect(); return { x: r.right + 40 + scrollX, y: r.top + scrollY + 20 }; } });
