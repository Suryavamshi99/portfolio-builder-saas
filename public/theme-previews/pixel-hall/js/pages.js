// resume.html (read it all) and project.html?p=slug
import { loadContent, esc, media, projectBodyHTML, forCompanyLine, PHOTO_ALT } from './render.js';

const $ = (s) => document.querySelector(s);
const ORDER = ['new-hire-orientation', 'depot-first-month', 'staff-survey-readout', 'autumn-rush-hiring', 'job-grades-pay-bands', 'plain-english-handbook', 'case-challenge', 'third-drawer'];

// little pixel skyline strip for the page header
function street() {
  let s = '<svg viewBox="0 0 600 64" preserveAspectRatio="xMidYMax slice" aria-hidden="true" shape-rendering="crispEdges">';
  let x = 0, k = 7;
  const r = () => ((k = (k * 9301 + 49297) % 233280) / 233280);
  while (x < 600) {
    const w = 14 + Math.floor(r() * 30), h = 18 + Math.floor(r() * 40);
    s += `<rect x="${x}" y="${64 - h}" width="${w}" height="${h}" fill="${r() < 0.5 ? '#6b1d37' : '#962c50'}"/>`;
    for (let yy = 64 - h + 4; yy < 60; yy += 6) for (let xx = x + 3; xx < x + w - 3; xx += 5) if (r() < 0.3) s += `<rect x="${xx}" y="${yy}" width="2" height="2" fill="${r() < 0.85 ? '#6bff85' : '#ffce4f'}"/>`;
    x += w + 1;
  }
  return s + '<rect x="0" y="61" width="600" height="3" fill="#401220"/></svg>';
}

function role(e) {
  return `<article class="role"><img src="${media(e.logo)}" alt="${esc(e.org)} logo"><div><h3>${esc(e.role)}</h3><p class="kicker">${esc(e.org)} · ${esc(e.place)} · ${esc(e.dates)}</p><ul>${e.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></article>`;
}

async function resume() {
  const d = await loadContent();
  const fc = forCompanyLine(d);
  const projects = ORDER.map((s) => d.projects.find((p) => p.slug === s));
  const sections = [['about', 'About'], ['experience', 'Experience'], ['cases', 'Case files'], ['education', 'Education'], ['wins', 'Wins'], ['skills', 'Skills'], ['outside', 'Outside work'], ['references', 'References'], ['contact', 'Contact']];
  $('#nav').innerHTML = sections.map(([id, t]) => `<a href="#${id}">${t}</a>`).join('');
  const c = d.contact;
  let n = 0; const H = (id, t) => `<h2 id="${id}-h"><span class="n">${++n}</span>${esc(t)}</h2>`;
  $('#main').innerHTML = `
  <section class="hero" id="about">
    <img src="${media(d.media.headshot)}" alt="Lakshmi Naidu, headshot" width="600" height="600">
    <div>
      <p class="kicker">HR Business Partner · ${esc(d.person.pronouns)}</p>
      <h1>${esc(d.person.first_name)} ${esc(d.person.last_name)}</h1>
      <p class="lede">${esc(d.person.headline)}.</p>
      ${fc ? `<p class="forco">${esc(fc)}</p>` : ''}
      <p>${esc(d.pitch.short)}</p>
      <p>${esc(d.about.intro)}</p>
      <dl class="facts">
        <div><dt>Now</dt><dd>${esc(d.person.current)}</dd></div>
        <div><dt>Looking for</dt><dd>${esc(d.person.looking_for)}</dd></div>
        <div><dt>Based in</dt><dd>${esc(d.person.location)}</dd></div>
        <div><dt>Available from</dt><dd>${esc(d.person.available_from)}</dd></div>
      </dl>
      <div class="btns"><a class="pbtn" href="mailto:${esc(c.email)}">Email Lakshmi</a><a class="pbtn ghost" href="index.html${location.search}">Play the resume instead</a></div>
    </div>
  </section>
  <section class="blk"><h2><span class="n">★</span>Why hire me</h2><ol class="why">${d.pitch.why_hire.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></section>

  <section class="blk" id="experience">${H('experience', 'Experience')}
    ${d.experience.map(role).join('')}
    <h3 class="kicker" style="margin-top:22px">Timeline</h3>
    <ol class="timeline">${d.journey.map((j) => `<li><b>${esc(j.year)}</b><span>${esc(j.title)}</span><em>${esc(j.detail)}</em></li>`).join('')}</ol>
  </section>

  <section class="blk" id="cases">${H('cases', 'Case files: every project in full')}
    ${projects.map((p) => `<article class="case" id="${p.slug}">
      <header><div><p class="kicker">${esc(p.type)} · ${esc(p.org)} · ${esc(p.year)}</p><h3>${esc(p.title)}</h3><p>${esc(p.summary)}</p></div><a class="pbtn ghost" href="project.html?p=${p.slug}">Open page</a></header>
      <div class="cbody">${projectBodyHTML(d, p.slug)}</div></article>`).join('')}
  </section>

  <section class="blk" id="education">${H('education', 'Education and certifications')}
    ${d.education.map((e) => `<article class="role"><img src="${media(e.logo)}" alt="${esc(e.school)} logo"><div><h3>${esc(e.degree)}</h3><p class="kicker">${esc(e.school)} · ${esc(e.years)}</p><p>${esc(e.notes)}</p></div></article>`).join('')}
    <div class="card"><h4>Certifications</h4><ul>${d.certifications.map((x) => `<li><b>${esc(x.name)}</b>, ${esc(x.issuer)}, ${esc(x.year)}</li>`).join('')}</ul></div>
  </section>

  <section class="blk" id="wins">${H('wins', 'Wins')}
    <div class="grid2 wins-row"><figure class="ph-card" style="margin:0"><img src="${media('photos/achievement-award.jpg')}" alt="${esc(PHOTO_ALT(d, 'photos/achievement-award.jpg'))}" loading="lazy"><div><p>${esc(PHOTO_ALT(d, 'photos/achievement-award.jpg'))}</p></div></figure>
    <ol class="winlist">${d.wins.map((w) => `<li><h4>${esc(w.title)}</h4><p>${esc(w.detail)}</p></li>`).join('')}</ol></div>
  </section>

  <section class="blk" id="skills">${H('skills', 'Skills and tools')}
    <div class="grid3">${Object.entries(d.skills).map(([k, v]) => `<div class="card"><h4>${esc(k)}</h4><ul>${v.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}</div>
    <div class="tools" style="margin-top:14px">${d.tools.map((t) => `<span><img src="${media(t.logo)}" alt="" width="16" height="16">${esc(t.name)}</span>`).join('')}</div>
    <div class="card" style="margin-top:14px"><h4>How I work</h4><ul>${d.values.map((v) => `<li>${esc(v)}</li>`).join('')}</ul></div>
  </section>

  <section class="blk" id="outside">${H('outside', 'Outside work')}
    <p style="font-size:16px;line-height:1.6;max-width:760px">${esc(d.about.now)}</p>
    <div class="grid2">${d.outside.filter((o) => o.title !== 'Mock interviews').map((o) => `<article class="ph-card"><img src="${media(o.image)}" alt="${esc(PHOTO_ALT(d, o.image))}" loading="lazy"><div><h4>${esc(o.title)}</h4><p>${esc(o.detail)}</p></div></article>`).join('')}</div>
    ${d.outside.filter((o) => o.title === 'Mock interviews').map((o) => `<div class="card" style="margin-top:14px"><h4>${esc(o.title)}</h4><p>${esc(o.detail)}</p></div>`).join('')}
  </section>

  <section class="blk" id="references">${H('references', 'References')}
    <div class="grid3">${d.testimonials.map((q) => `<blockquote class="quote" style="margin:0"><p>“${esc(q.quote)}”</p><cite>${esc(q.name)}, ${esc(q.role)}. ${esc(q.relation)}</cite></blockquote>`).join('')}</div>
  </section>

  <section class="blk" id="contact">${H('contact', 'Contact')}
    <p style="font-size:17px;line-height:1.6;max-width:760px">Looking for ${esc(d.person.looking_for.charAt(0).toLowerCase() + d.person.looking_for.slice(1))}. Available from ${esc(d.person.available_from)}.</p>
    <ul class="contact-list">
      <li><span>Email</span><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li>
      <li><span>Phone</span><a href="tel:${esc(c.phone.replace(/\s/g, ''))}">${esc(c.phone)}</a></li>
      <li><span>LinkedIn</span><a href="${esc(c.linkedin)}" rel="noopener">linkedin.com/in/example</a></li>
      <li><span>Book a call</span><a href="${esc(c.calendly)}" rel="noopener">calendly.com/example</a></li>
      <li><span>Newsletter</span><a href="${esc(c.newsletter)}" rel="noopener">The Third Drawer on LinkedIn</a></li>
    </ul>
  </section>`;
  // nav highlight
  const links = [...document.querySelectorAll('#nav a')];
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) links.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-40% 0px -55% 0px' });
  sections.forEach(([id]) => { const el = document.getElementById(id); if (el) io.observe(el); });
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}

async function project() {
  const d = await loadContent();
  const slug = new URLSearchParams(location.search).get('p');
  const i = ORDER.indexOf(slug);
  const p = d.projects.find((x) => x.slug === slug);
  if (!p) { $('#main').innerHTML = '<p style="padding:40px 0">That case file does not exist. <a href="resume.html#cases">See all case files</a>.</p>'; return; }
  document.title = `${p.title} · Lakshmi Naidu`;
  const prev = d.projects.find((x) => x.slug === ORDER[(i + ORDER.length - 1) % ORDER.length]);
  const next = d.projects.find((x) => x.slug === ORDER[(i + 1) % ORDER.length]);
  $('#main').innerHTML = `
    <header class="p-head"><p class="crumb kicker">Case file ${i + 1} of 8 · ${esc(p.type)} · ${esc(p.org)} · ${esc(p.year)}</p>
      <h1>${esc(p.title)}</h1><p class="sum">${esc(p.summary)}</p></header>
    <div class="p-body">${projectBodyHTML(d, slug)}
    <nav class="pn" aria-label="More case files">
      <a class="prev" href="project.html?p=${prev.slug}"><small>Previous case file</small><b>${esc(prev.title)}</b></a>
      <a class="next" href="project.html?p=${next.slug}"><small>Next case file</small><b>${esc(next.title)}</b></a>
    </nav></div>`;
}

$('#street').innerHTML = street();
(document.body.dataset.page === 'project' ? project() : resume()).catch((e) => { console.warn(e); });
