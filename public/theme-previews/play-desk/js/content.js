/* Loads content/portfolio.json and renders the read-mode page. Every stop body in the world is one of these nodes. */
import { shortOrg } from './island.js';

export async function loadContent() {
  const r = await fetch('content/portfolio.json');
  if (!r.ok) throw new Error('content ' + r.status);
  return r.json();
}
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

export function forCompany() {
  const raw = new URLSearchParams(location.search).get('for');
  if (!raw) return '';
  return raw.replace(/[^\p{L}\p{N} .,&'+-]/gu, '').trim().slice(0, 40);
}
export function forLine(c) {
  const co = forCompany();
  if (!co || !c.pitch || !c.pitch.for_company_template) return '';
  return c.pitch.for_company_template.split('{company}').join(co);
}

export const ICON = {
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M8 7h7M8 11h7"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>',
  car: '<svg viewBox="0 0 54 40" aria-hidden="true"><rect x="6" y="12" width="40" height="16" rx="4" fill="#e83ee5"/><rect x="14" y="5" width="22" height="11" rx="3" fill="#e83ee5"/><rect x="17" y="7.5" width="7" height="6" rx="1" fill="#251f2b"/><rect x="26" y="7.5" width="7" height="6" rx="1" fill="#251f2b"/><circle cx="15" cy="29" r="7" fill="#251f2b"/><circle cx="38" cy="29" r="7" fill="#251f2b"/><circle cx="15" cy="29" r="2.5" fill="#ffbf95"/><circle cx="38" cy="29" r="2.5" fill="#ffbf95"/><rect x="44" y="15" width="4" height="4" rx="1" fill="#ff6b97"/></svg>',
  trophy: '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M12 6h16v8a8 8 0 0 1-16 0z" fill="#ff4d83"/><path d="M12 9H7a5 5 0 0 0 5 6M28 9h5a5 5 0 0 1-5 6" fill="none" stroke="#ff4d83" stroke-width="2.4"/><rect x="18" y="21" width="4" height="7" fill="#e32f6b"/><rect x="12" y="28" width="16" height="5" rx="1" fill="#ffbf95"/></svg>',
  robot: '<svg viewBox="0 0 84 84" aria-hidden="true"><line x1="42" y1="6" x2="42" y2="16" stroke="#ffffff" stroke-width="3"/><circle cx="42" cy="6" r="4.5" fill="#ffbf95"/><rect x="14" y="16" width="56" height="40" rx="9" fill="#eef6fc"/><rect x="20" y="22" width="44" height="28" rx="5" fill="#251f2b"/><g fill="#ffbf95"><rect x="26" y="33" width="4" height="6" rx="2"/><rect x="33" y="28" width="4" height="16" rx="2"/><rect x="40" y="31" width="4" height="10" rx="2"/><rect x="47" y="26" width="4" height="20" rx="2"/><rect x="54" y="32" width="4" height="8" rx="2"/></g><rect x="26" y="60" width="32" height="18" rx="6" fill="#eef6fc"/></svg>',
};

const ticks = (arr) => `<ul class="ticks">${(arr || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
const logoTile = (src, alt) => src ? `<span class="logo-tile"><img src="${esc(src)}" alt="${esc(alt)} logo" loading="lazy"></span>` : `<span class="logo-tile txt" aria-hidden="true">${esc(String(alt).split(/\s+/).map((w) => w[0]).join('').slice(0, 3))}</span>`;

export function renderRead(c, stops, opts = {}) {
  const P = c.person, CT = c.contact, num = Object.fromEntries(stops.map((s) => [s.id, s.n]));
  const sno = (id) => num[id] ? `<span class="stopno">Stop ${num[id]}</span>` : '';
  const fl = forLine(c);
  const exp = (c.experience || []).slice(0, 3);
  const projects = (c.projects || []).slice(0, 9);
  const navs = [['about', 'About'], ['journey', 'Journey'], ['experience', 'Experience'], ['projects', 'Projects'], ['wins', 'Wins'], ['tools', 'Toolbox'], ['contact', 'Contact']];
  const win = (w) => `<li>${ICON.trophy}<div><b>${esc(w.title)}</b><span>${esc(w.detail)}</span></div></li>`;
  const winPhoto = (c.wins || []).find((w) => w.image);
  const tools = (c.tools || []).map((t) => `<li>${t.logo ? `<span class="ic"><img src="${esc(t.logo)}" alt="" loading="lazy"></span>` : `<span class="ic txt" aria-hidden="true">${esc(t.name.split(' ').map((w) => w[0]).join(''))}</span>`}<span>${esc(t.name)}</span></li>`).join('');
  const html = `
  <a class="skip" href="#r-main">Skip to content</a>
  <header class="rnav">
    <a class="nm" href="#top">Yash Trivedi</a>
    <nav class="links" aria-label="Sections" data-qa-scroll>${navs.map(([id, l]) => `<a href="#${id}">${l}</a>`).join('')}</nav>
    ${opts.canDrive ? `<button class="btn primary drive" type="button" data-drive>${ICON.car.replace('<svg', '<svg style="width:26px;height:20px"')}<span class="t">Drive the island</span><span class="t-short">Drive</span></button>` : ''}
  </header>
  <main id="r-main">
  <section class="rsec rhero" id="top" aria-labelledby="r-name">
    <div class="wrap">
      <div class="card">
        <div class="txt">
          <p class="eyebrow">${esc(P.looking_for)}</p>
          <h1 id="r-name">${esc(P.first_name)} ${esc(P.last_name)}</h1>
          <p class="role">${esc(P.current)}</p>
          <p class="headline">${esc(P.headline)}</p>
          ${fl ? `<p class="forline">${esc(fl)}</p>` : ''}
          <p class="pitch">${esc(c.pitch.short)}</p>
          <div class="actions">
            <button class="btn primary" type="button" data-copy="${esc(CT.email)}">${ICON.mail}Copy email</button>
            <a class="btn" href="${esc(CT.resume_pdf)}" target="_blank" rel="noopener">${ICON.file}Resume (PDF)</a>
            <a class="btn" href="${esc(CT.linkedin)}" target="_blank" rel="noopener">${ICON.linkedin}LinkedIn</a>
          </div>
        </div>
        <div class="photo"><img src="${esc(c.media.cutout)}" alt="Yash Trivedi, in a navy overshirt" width="766" height="1059"></div>
      </div>
      ${opts.canDrive ? `<div class="drive-card">${ICON.car.replace('<svg', '<svg class="mini-car"')}<p>This portfolio is also an island you can drive around: ${esc(String(stops.length))} stops, one for each part of the story. ${opts.touch ? 'Drive with the on-screen stick, or tap where you want to go.' : 'Drive with the arrow keys, or click where you want to go.'}</p><button class="btn primary" type="button" data-drive>Drive the island</button></div>` : ''}
    </div>
  </section>

  <section class="rsec" id="about" aria-labelledby="h-about">
    <div class="wrap">
      <h2 id="h-about">About me</h2>
      <p class="sec-sub">${sno('about')}Who I am and how I work</p>
      <div class="stop-body card" id="stop-about" style="padding:clamp(20px,3vw,32px)">
        <div class="two">
          <div>
            <p class="lead">${esc(c.about.intro)}</p>
            <h3>Why hire me</h3>
            ${ticks(c.pitch.why_hire)}
            <h3>How I work</h3>
            ${ticks(c.values)}
            <h3>Now</h3>
            <p>${esc(c.about.now)}</p>
          </div>
          <div><img class="about-photo" src="${esc(c.media.professional_alt)}" alt="Yash planning OKRs at a whiteboard" loading="lazy" width="1154" height="1155"></div>
        </div>
      </div>
    </div>
  </section>

  <section class="rsec" id="journey" aria-labelledby="h-journey">
    <div class="wrap">
      <h2 id="h-journey">Journey</h2>
      <p class="sec-sub">${sno('journey')}From school to the PGP, with education</p>
      <div class="stop-body card" id="stop-journey" style="padding:clamp(20px,3vw,32px)">
        <div class="two">
          <div>
            <h3>Timeline</h3>
            <ol class="timeline">${(c.journey || []).map((j) => `<li><span class="yr">${esc(j.year)}</span><b>${esc(j.title)}</b><span>${esc(j.detail)}</span></li>`).join('')}</ol>
          </div>
          <div>
            <h3>Education</h3>
            <div class="edu">${(c.education || []).map((e) => `<div class="edu-item">${logoTile(e.logo, e.school)}<div><b>${esc(e.school)}</b><span>${esc(e.degree)}, ${esc(e.years)}</span><span>${esc(e.notes)}</span></div></div>`).join('')}</div>
            ${(c.certifications || []).length ? `<h3>Certification</h3><div class="edu">${c.certifications.map((x) => `<div class="edu-item">${logoTile('', x.issuer)}<div><b>${esc(x.name)}</b><span>${esc(x.issuer)}${x.year ? ', ' + esc(x.year) : ''}</span></div></div>`).join('')}</div>` : ''}
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="rsec" id="experience" aria-labelledby="h-exp">
    <div class="wrap">
      <h2 id="h-exp">Experience</h2>
      <p class="sec-sub">${exp.length ? `<span class="stopno">Stops ${num['exp-0']} to ${num['exp-' + (exp.length - 1)]}</span>` : ''}Three roles, latest first</p>
      <div class="exp-list">${exp.map((e, i) => `
        <article class="exp card stop-node" id="exp-${i}">
          <div class="exp-head"><span class="logo-wide"><img src="${esc(e.logo)}" alt="${esc(shortOrg(e.org))} logo" loading="lazy"></span><div><b>${esc(e.role)}</b><span>${esc(e.org)}${e.place ? ', ' + esc(e.place) : ''} · ${esc(e.dates)}</span></div></div>
          ${ticks(e.points)}
        </article>`).join('')}</div>
    </div>
  </section>

  <section class="rsec" id="projects" aria-labelledby="h-proj">
    <div class="wrap">
      <h2 id="h-proj">Projects</h2>
      <p class="sec-sub">${projects.length ? `<span class="stopno">Stops ${num['p-' + projects[0].slug]} to ${num['p-' + projects[projects.length - 1].slug]}</span>` : ''}Nine projects. Each one has a full write-up.</p>
      <div class="proj-grid">${projects.map((p) => `
        <article class="proj card stop-node" id="proj-${esc(p.slug)}">
          <img class="thumb" src="${esc(p.thumbnail)}" alt="Cover for ${esc(p.title)}" loading="lazy" width="1600" height="1000">
          <div class="in stop-body">
            <p class="meta">${esc(p.org)} · ${esc(p.year)}</p>
            <h3>${esc(p.title)}</h3>
            <p>${esc(p.summary)}</p>
            <div class="metrics">${(p.metrics || []).slice(0, 3).map(([v, l]) => `<div class="metric"><b${String(v).length > 7 && !/\s/.test(v) ? ' class="long"' : ''}>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div>
            <a class="btn more" href="project.html?p=${encodeURIComponent(p.slug)}">Read the full write-up ${ICON.right}</a>
          </div>
        </article>`).join('')}</div>
    </div>
  </section>

  <section class="rsec" id="wins" aria-labelledby="h-wins">
    <div class="wrap">
      <h2 id="h-wins">Wins</h2>
      <p class="sec-sub">${sno('wins')}Awards and competitions</p>
      <div class="stop-body card" id="stop-wins" style="padding:clamp(20px,3vw,32px)">
        <div class="wins">
          <ul class="win-list">${(c.wins || []).map(win).join('')}</ul>
          ${winPhoto ? `<figure class="win-photo"><img src="${esc(winPhoto.image)}" alt="Yash presenting the Alderwick readout in a Northmere School of Management class" loading="lazy" width="278" height="735"><figcaption>the Alderwick readout in class, Northmere</figcaption></figure>` : ''}
        </div>
      </div>
    </div>
  </section>

  <section class="rsec" id="tools" aria-labelledby="h-tools">
    <div class="wrap">
      <h2 id="h-tools">Toolbox</h2>
      <p class="sec-sub">${sno('tools')}Skills and the tools I use</p>
      <div class="stop-body card" id="stop-tools" style="padding:clamp(20px,3vw,32px)">
        <div class="skills">${Object.entries(c.skills || {}).map(([g, l]) => `<div><h4>${esc(g)}</h4><ul>${l.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}</div>
        <h3>Tools</h3>
        <ul class="tools">${tools}</ul>
      </div>
    </div>
  </section>


  <section class="rsec" id="contact" aria-labelledby="h-contact">
    <div class="wrap">
      <h2 id="h-contact">Contact</h2>
      <p class="sec-sub">${sno('contact')}Email is the fastest way to reach me</p>
      <div class="stop-body card" id="stop-contact" style="padding:clamp(20px,3vw,32px)">
        <div class="contact-grid">
          <button class="cbtn" type="button" data-copy="${esc(CT.email)}">${ICON.copy}<div><b>Copy email</b><span>${esc(CT.email)}</span></div></button>
          <a class="cbtn" href="mailto:${esc(CT.email)}">${ICON.mail}<div><b>Write an email</b><span>Opens your mail app</span></div></a>
          ${CT.phone ? `<a class="cbtn" href="tel:${esc(CT.phone.replace(/\s/g, ''))}">${ICON.phone}<div><b>Call</b><span>${esc(CT.phone)}</span></div></a>` : ''}
          ${CT.whatsapp ? `<a class="cbtn" href="https://wa.me/${esc(CT.whatsapp.replace(/\D/g, ''))}" target="_blank" rel="noopener">${ICON.chat}<div><b>WhatsApp</b><span>${esc(CT.whatsapp)}</span></div></a>` : ''}
          <a class="cbtn" href="${esc(CT.linkedin)}" target="_blank" rel="noopener">${ICON.linkedin}<div><b>LinkedIn</b><span>linkedin.com/in/example</span></div></a>
          <a class="cbtn" href="${esc(CT.resume_pdf)}" target="_blank" rel="noopener">${ICON.file}<div><b>Resume</b><span>PDF, one page</span></div></a>
          ${CT.calendly ? `<a class="cbtn" href="${esc(CT.calendly)}" target="_blank" rel="noopener">${ICON.cal}<div><b>Book a call</b><span>Pick a time</span></div></a>` : `<div class="cbtn static">${ICON.cal}<div><b>Book a call</b><span>Booking link coming soon. Email me to set a time.</span></div></div>`}
        </div>
      </div>
    </div>
  </section>
  </main>
  <footer class="rfoot"><div class="wrap"><span>Yash Trivedi · ${esc(P.looking_for)}</span><span>The island, cars and signs are drawn in code with three.js.</span></div></footer>`;
  return html;
}

let toastT;
export function hideToast() { const t = document.querySelector('.toast'); if (t) t.classList.remove('show'); clearTimeout(toastT); }
export function toast(title, line = '') {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.append(t); }
  t.innerHTML = `<b>${esc(title)}</b>${line ? `<span>${esc(line)}</span>` : ''}`;
  t.style.setProperty('--p', 0); t.classList.add('show');
  requestAnimationFrame(() => requestAnimationFrame(() => t.style.setProperty('--p', 1)));
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
}
export function wireCopy(root = document) {
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copy]'); if (!b) return;
    const v = b.getAttribute('data-copy');
    try { await navigator.clipboard.writeText(v); toast('Email copied', v); }
    catch { const ta = document.createElement('textarea'); ta.value = v; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.append(ta); ta.select(); try { document.execCommand('copy'); toast('Email copied', v); } catch { toast('Copy this email', v); } ta.remove(); }
  });
}
