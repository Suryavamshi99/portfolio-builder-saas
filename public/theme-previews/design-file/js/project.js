/* Project write-up page: project.html?p=<slug>. Content from content/portfolio.json. */
(() => {
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = new URLSearchParams(location.search).get('p');
const TESTI = { slotwise: 1, 'uc-reschedules': 2 }; const TC = ['#a3e52d', '#1433ae', '#ff61b0'];

fetch('content/portfolio.json').then(r => r.json()).then(D => {
  $('#mail').href = 'mailto:' + D.contact.email;
  const i = D.projects.findIndex(p => p.slug === slug);
  if (i < 0) { $('#doc').innerHTML = '<p class="missing">That project is not in this portfolio. <a href="index.html">Back to the canvas</a></p>'; return; }
  const p = D.projects[i], g = D.project_pages[p.slug] || {};
  const prev = D.projects[i - 1], next = D.projects[i + 1];
  document.title = `${p.title} · Tara Iyer`;
  $('#crumb').textContent = p.cover_title;
  const steps = g.what_i_did || [];
  const t = TESTI[p.slug] !== undefined ? D.testimonials[TESTI[p.slug]] : null;
  const imgs = (g.images || []);
  $('#doc').innerHTML = `
  <div class="dlabel"><span># ${esc(p.cover_title)} / Write-up</span><span>Project ${i + 1} of ${D.projects.length}</span></div>
  <article class="sheet">
    <section class="hero">
      <div>
        <p class="eyebrow">/ ${esc((new RegExp('\\b' + p.type + '\\b', 'i').test(p.org) ? [p.org, p.year] : [p.type, p.org, p.year]).join(' · '))}</p>
        <h1>${esc(p.title)}</h1>
        <p class="lede">${esc(p.summary)}</p>
        <dl class="facts">
          <div><dt>Role</dt><dd>${esc(g.my_role || p.role)}</dd></div>
          <div><dt>Dates</dt><dd>${esc(g.dates || p.year)}</dd></div>
          <div><dt>Team</dt><dd>${esc(p.team)}</dd></div>
          <div><dt>Duration</dt><dd>${esc(p.duration)}</dd></div>
        </dl>
      </div>
      <img src="media/${esc(p.cover)}" alt="${esc(p.cover_title)}: ${esc(p.result)}">
    </section>
    <section>
      <p class="eyebrow">/ Results</p><h2 class="sh">${esc(p.result)}</h2>
      <div class="results">${(g.results || []).map(r => `<div><b>${esc(r.value)}</b><span>${esc(r.metric)}</span><small>${esc(r.note)}</small></div>`).join('')}</div>
    </section>
    <section>
      <div class="two">
        <div><p class="eyebrow">/ Context</p><h2 class="sh">Where this started</h2><p>${esc(g.context)}</p></div>
        ${g.problem ? `<div><p class="eyebrow">/ Problem</p><h2 class="sh">What was going wrong</h2><p>${esc(g.problem)}</p></div>` : `<div><p class="eyebrow">/ My part</p><h2 class="sh">${esc(g.my_role || p.role)}</h2><p>${esc(p.summary)}</p></div>`}
      </div>
    </section>
    <section>
      <p class="eyebrow">/ What I did</p><h2 class="sh">The steps, in order</h2>
      <ol class="flow" style="--n:${Math.min(steps.length, 5)}">${steps.map(s => `<li><p>${esc(s)}</p><i></i><b></b></li>`).join('')}</ol>
    </section>
    ${g.decisions ? `<section><p class="eyebrow">/ Decisions</p><h2 class="sh">${['', 'One call', 'Two calls', 'Three calls', 'Four calls'][g.decisions.length] || 'Calls'} I made</h2>
      <div class="decs" style="--n:${Math.min(g.decisions.length, 3)}">${g.decisions.map((d, k) => `<div class="dec"><p class="eyebrow">Decision ${k + 1}</p><h3>${esc(d.choice)}</h3><p>${esc(d.why)}</p></div>`).join('')}</div></section>` : ''}
    ${imgs.length ? `<section><p class="eyebrow">/ Evidence</p><h2 class="sh">From the work</h2>
      <div class="gallery" style="--n:${Math.min(imgs.length, 2)}">${imgs.map(s => `<img src="media/${esc(s)}" alt="${esc(p.cover_title)}, supporting image" loading="lazy">`).join('')}</div></section>` : ''}
    <section>
      <p class="eyebrow">/ Comments</p><h2 class="sh">What I learned</h2>
      <div class="note"><span class="cav">TI</span><div><b>Tara Iyer</b><small>Author</small><p>${esc(g.learned)}</p>${g.next ? `<p><b>Next:</b> ${esc(g.next)}</p>` : ''}</div></div>
      ${t ? `<div class="note"><span class="cav" style="background:${TC[TESTI[p.slug]]}">${esc(t.name.replace(/^Dr\. /, '').split(' ').map(w => w[0]).join(''))}</span><div><b>${esc(t.name)}</b><small>${esc(t.role)}</small><p>“${esc(t.quote)}”</p></div></div>` : ''}
    </section>
  </article>
  <nav class="pn" aria-label="More projects">
    ${prev ? `<a class="prev" href="project.html?p=${esc(prev.slug)}"><small>← Previous</small><b>${esc(prev.title)}</b></a>` : `<a class="prev" href="index.html"><small>← Back</small><b>The canvas</b></a>`}
    ${next ? `<a class="next" href="project.html?p=${esc(next.slug)}"><small>Next →</small><b>${esc(next.title)}</b></a>` : `<a class="next" href="index.html?view=read"><small>Next →</small><b>Everything on one page</b></a>`}
  </nav>`;
});
})();
