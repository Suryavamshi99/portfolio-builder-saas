/* Home page: renders content/portfolio.json into the scenes, runs the scroll playhead and the eye. */
import { startEye, tileHTML } from './eye.js';

const D = await fetch('content/portfolio.json').then(r => r.json());
const S = D.site;
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const m = (src) => 'media/' + src;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const P = Object.fromEntries(D.projects.map(p => [p.slug, p]));

/* ---------- grain texture, drawn once ---------- */
(() => {
  const c = document.createElement('canvas'); c.width = c.height = 180;
  const x = c.getContext('2d'), img = x.createImageData(180, 180);
  for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  x.putImageData(img, 0, 0);
  document.querySelector('.grain').style.backgroundImage = `url(${c.toDataURL()})`;
})();

/* ---------- curtain ---------- */
const curtain = $('curtain');
function openCurtain() { curtain.classList.remove('gone'); requestAnimationFrame(() => curtain.classList.add('open')); setTimeout(() => curtain.classList.add('gone'), 1700); }
if (!reduce) setTimeout(openCurtain, 250);

/* ---------- hero ---------- */
$('headline').textContent = D.person.headline;
$('avail').textContent = `Diploma at Ashgrove Institute of Commerce, Dunmore Heights. Open to enterprise sales roles from ${D.person.available_from}.`;
const company = new URLSearchParams(location.search).get('for');
if (company) {
  const c = company.trim().slice(0, 40);
  $('why').hidden = false; $('why').textContent = D.pitch.for_company_template.replaceAll('{company}', c);
  $('kicker').textContent = `For ${c}: the account book of`;
}
$('heroMail').href = `mailto:${D.contact.email}`;
const hq = S.quota.years;
$('heroFacts').innerHTML = [
  [`${hq[2][1]}%`, `average quota attainment over three AE years`],
  ['$186K', 'biggest deal, a 7-month cycle'],
  ['240', 'account visits booked on the inside desk'],
].map(f => `<li><b>${esc(f[0])}</b><span>${esc(f[1])}</span></li>`).join('');

// code-drawn Harleen: hands up like binoculars, pupils follow the pointer
const EYES = [[249, 292], [351, 292]];
$('who').innerHTML = `<svg viewBox="0 0 600 560" role="img">
  <style>.sk{fill:color-mix(in srgb,var(--bg) 82%,#000000)}.sk2{fill:color-mix(in srgb,var(--bg) 70%,#000000)}.sk3{fill:color-mix(in srgb,var(--bg) 45%,#000000)}.hr{fill:color-mix(in srgb,var(--bg) 28%,#000000)}</style>
  <path d="M300 150C205 150 172 232 178 322C183 402 168 470 146 560H454C432 470 417 402 422 322C428 232 395 150 300 150Z" class="hr"/>
  <rect x="266" y="372" width="68" height="80" class="sk"/>
  <path d="M30 560C46 474 140 438 220 430H380C460 438 554 474 570 560Z" fill="#141210"/>
  <ellipse cx="300" cy="292" rx="94" ry="112" class="sk"/>
  <path d="M206 262C210 190 258 162 302 165C352 168 394 200 396 264C372 222 334 204 298 208C258 212 228 232 206 262Z" class="hr"/>
  <circle cx="207" cy="338" r="9" fill="none" stroke="#141210" stroke-width="4"/><circle cx="393" cy="338" r="9" fill="none" stroke="#141210" stroke-width="4"/>
  <path d="M248 366Q300 420 352 366Q300 392 248 366Z" class="sk3"/>
  <path d="M112 560C88 470 118 398 196 334" stroke="#141210" stroke-width="80" stroke-linecap="round" fill="none"/>
  <path d="M488 560C512 470 482 398 404 334" stroke="#141210" stroke-width="80" stroke-linecap="round" fill="none"/>
  ${EYES.map(([x, y], i) => { const s = i ? 1 : -1; return `
  <ellipse cx="${x + s * 22}" cy="${y + 40}" rx="22" ry="15" class="sk2" transform="rotate(${s * 30} ${x + s * 22} ${y + 40})"/>
  <circle cx="${x}" cy="${y}" r="52" class="sk2"/>
  <ellipse cx="${x - s * 6}" cy="${y - 54}" rx="13" ry="27" class="sk2" transform="rotate(${s * 16} ${x - s * 6} ${y - 54})"/>
  <ellipse cx="${x + s * 20}" cy="${y - 48}" rx="13" ry="25" class="sk2" transform="rotate(${s * 30} ${x + s * 20} ${y - 48})"/>
  <circle cx="${x}" cy="${y}" r="30" fill="#dcf4f4" stroke="#141210" stroke-width="5"/>
  <rect class="cp" x="${x - 5.5}" y="${y - 17}" width="11" height="34" rx="5.5" fill="#141210"/>
  <circle class="clid" cx="${x}" cy="${y}" r="32" fill="#141210" style="transform-box:fill-box;transform-origin:center;transform:scaleY(0);transition:transform .09s"/>`; }).join('')}
</svg>`;
const pupils = [...document.querySelectorAll('#who .cp')], lids = [...document.querySelectorAll('#who .clid')];
function look(cx, cy) {
  const svg = $('who').firstElementChild; const r = svg.getBoundingClientRect(); const k = r.width / 600;
  pupils.forEach((p, i) => {
    const ex = r.left + EYES[i][0] * k, ey = r.top + EYES[i][1] * k; const a = Math.atan2(cy - ey, cx - ex);
    const d = Math.min(10, Math.hypot(cx - ex, cy - ey) / 30);
    p.setAttribute('transform', `translate(${(Math.cos(a) * d).toFixed(1)} ${(Math.sin(a) * d * .55).toFixed(1)})`);
  });
}
look.blink = () => { lids.forEach(l => l.style.transform = 'scaleY(1)'); setTimeout(() => lids.forEach(l => l.style.transform = 'scaleY(0)'), 140); };
if (!reduce) setInterval(() => { if (Math.random() < .5) look.blink(); }, 3200);

/* ---------- dive ---------- */
$('dive').classList.add('dark-scene');
let rings = '';
for (let r = 300, i = 0; r > 40; r -= 13, i++) rings += `<circle r="${r}" fill="${i % 2 ? '#2d5c2b' : '#275426'}" stroke="#182d15" stroke-width="${i % 3 ? 1.5 : 3}"/>`;
$('rings').innerHTML = rings + `<g id="dEye"><circle r="38" fill="#6ae471" stroke="#141210" stroke-width="5"/><circle r="24" fill="#dcf4f4"/><rect x="-6" y="-20" width="12" height="40" rx="6" fill="#141210"/></g>`;
$('diveLines').innerHTML = S.dive.map(l => `<li${reduce ? ' class="on"' : ''}>${esc(l[0])}<small>${esc(l[1])}</small></li>`).join('');

/* ---------- hi ---------- */
const word = "Hi, I'm Harleen";
const rnd = (i) => ((Math.sin(i * 91.7) + 1) / 2);
$('hiWord').innerHTML = word.split(' ').map((w, wi) => `<span class="w" aria-hidden="true">${[...w].map((ch, i) => `<span class="ch" style="--r:${((rnd(i + wi * 7) - .5) * 12).toFixed(1)}deg;--y:${((rnd(i * 3 + wi) - .5) * 18).toFixed(0)}px">${esc(ch)}</span>`).join('')}</span>`).join(' ');
$('hiPhoto').src = m(D.media.professional); $('hiPhoto').alt = `${D.person.first_name} ${D.person.last_name}, arms folded, in a navy blazer`;
$('intro').textContent = D.about.intro;
$('now').textContent = 'Right now: ' + D.about.now.charAt(0).toLowerCase() + D.about.now.slice(1);
$('where').textContent = `${D.person.pronouns} · ${D.person.location}`;
$('values').innerHTML = D.values.map(v => `<li>${esc(v)}</li>`).join('');

/* ---------- the account book ---------- */
const A = S.accounts, L = S.labels;
const touch = !matchMedia('(hover: hover) and (pointer: fine)').matches;
$('dealHint').textContent = reduce ? 'Every row gives the size and the cycle. Open one for the full write-up.'
  : touch ? 'Tap an account and the eye becomes the client while the row shows its size and cycle.'
  : 'Hover over an account and the eye becomes the client, showing the deal size and how long it took. Click a row for the write-up.';
const groups = [...new Set(A.map(a => a.group))];
$('ledger').innerHTML = groups.map(g => `<div class="group"><h3 class="group-h">${esc(g)}</h3>${A.map((a, i) => a.group !== g ? '' : (() => {
  const p = P[a.slug]; const lb = L[a.kind];
  return `<div class="row" data-mark="${i}" style="--c:${a.color}">
    <span class="mini" style="background:${a.mark.bg}" aria-hidden="true">${tileHTML(a.mark, true)}</span>
    <span class="txt"><a class="t" href="project.html?p=${a.slug}" data-ring="OPEN">${esc(a.short)}</a><span class="o">${esc(a.mark.name)} · ${esc(p.year)}</span></span>
    <span class="go" aria-hidden="true">Open</span>
    <span class="facts"><span>${esc(a.size[0])}<small>${esc(lb[0])}: ${esc(a.size[1])}</small></span><span>${esc(a.cycle)}<small>${esc(lb[1].toLowerCase())}</small></span></span>
    <div class="more"><p>${esc(p.result)}.</p><figure class="window"><img src="${m(p.thumbnail)}" alt="${esc(p.title)}" loading="lazy" width="1400" height="875"></figure><a class="pill" href="project.html?p=${a.slug}">Read the write-up</a></div>
  </div>`; })()).join('')}</div>`).join('');

function peek(i) {
  const a = A[i], p = P[a.slug];
  $('peek').innerHTML = `<figure class="window"><img src="${m(p.thumbnail)}" alt="${esc(p.title)}" width="1400" height="875"></figure><h3>${esc(a.short)}</h3><p>${esc(p.result)}.</p><a class="pill" href="project.html?p=${a.slug}">Read the write-up</a>`;
  if (!reduce) $('peek').querySelector('.window').animate([{ transform: 'translateX(60%) rotate(8deg)', opacity: 0 }, { transform: 'rotate(1.5deg)', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.3,1.4,.5,1)' });
}
peek(0); let peeked = 0;
const rows = [...document.querySelectorAll('.row')];
rows.forEach(r => {
  const i = +r.dataset.mark;
  const show = () => { if (peeked !== i) { peeked = i; peek(i); } };
  r.addEventListener('mouseenter', show); r.addEventListener('focusin', show);
  if (touch && !reduce) r.querySelector('a.t').addEventListener('click', (e) => {
    if (r.classList.contains('on')) return;               // second tap opens the write-up
    e.preventDefault(); rows.forEach(o => o !== r && o.classList.remove('on')); r.classList.add('on');
  });
});
// rows need a slot for the eye to land in on touch
if (touch && !reduce) rows.forEach(r => { const d = document.createElement('div'); d.className = 'dock'; r.querySelector('.more').prepend(d); });

/* ---------- record ---------- */
const qmax = 130, W = 560, x0 = 150;
const qx = (v) => x0 + (W - x0 - 20) * v / qmax;
$('quota').innerHTML = `<h3>Quota, as an Account Executive</h3><p class="sub">Against a ${esc(S.quota.base)}, Pinewick Paper & Print, schools, offices and print shops</p>
<svg viewBox="0 0 ${W} 250" role="img" aria-label="${hq.map(y => `${y[0]} ${y[1]}%`).join(', ')}">
  ${hq.map((y, i) => { const yy = 20 + i * 70; return `<text x="0" y="${yy + 30}" fill="#dcf4f4" font-family="Big Shoulders" font-weight="900" font-size="24">${esc(y[0].toUpperCase())}</text><text x="0" y="${yy + 50}" fill="#dcf4f4" opacity=".75" font-size="12.5" font-family="Bricolage">${esc(y[2])}</text><rect x="${x0}" y="${yy}" width="${(qx(y[1]) - x0).toFixed(1)}" height="46" rx="12" fill="${i === 2 ? '#41d9d7' : '#dcf4f4'}"/><text x="${(qx(y[1]) - 12).toFixed(1)}" y="${yy + 33}" text-anchor="end" fill="#141210" font-family="Big Shoulders" font-weight="900" font-size="28">${y[1]}%</text>`; }).join('')}
  <line x1="${qx(100)}" x2="${qx(100)}" y1="8" y2="232" stroke="#6dde77" stroke-width="3" stroke-dasharray="6 6"/>
  <text x="${qx(100)}" y="248" text-anchor="middle" fill="#dcf4f4" font-family="Big Shoulders" font-weight="800" font-size="14" letter-spacing="2">QUOTA 100%</text>
</svg>`;
const expTag = (e) => ({ name: e.org, rows: [['Role', e.role], ['When', e.dates, e.place]] });
const EXTRA = [];   // marks for non-ledger items (employers, contact links)
$('exp').innerHTML = D.experience.map(e => {
  const mk = S.orgs[e.org]; const k = 'x' + EXTRA.push({ mark: mk, tag: expTag(e) });
  return `<div class="job" data-mark="${k}"><span class="lg" style="background:${mk.bg}" aria-hidden="true">${tileHTML(mk, true)}</span><div><b>${esc(e.role)}</b><span class="m">${esc(e.org)} · ${esc(e.place)} · ${esc(e.dates)}</span><ul>${e.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div></div>`;
}).join('');
$('edu').innerHTML = D.education.map(e => `<li><b>${esc(e.degree)}</b>${esc(e.school)}, ${esc(e.years)}. ${esc(e.notes)}</li>`).join('');
$('skills').innerHTML = Object.values(D.skills).flat().slice(0, 12).map(s => `<span>${esc(s)}</span>`).join('');
$('certs').innerHTML = D.certifications.map(c => `<li><b>${esc(c.name)}</b>${esc(c.issuer)}, ${esc(c.year)}</li>`).join('');

/* ---------- journey train ---------- */
const engine = `<div class="engine" aria-hidden="true"><svg viewBox="0 0 250 330"><rect x="40" y="130" width="210" height="160" rx="22" fill="#141210"/><rect x="150" y="40" width="100" height="110" rx="16" fill="#141210"/><rect x="170" y="62" width="60" height="50" rx="10" fill="#dcf4f4"/><rect x="62" y="70" width="38" height="70" rx="6" fill="#141210"/><rect x="54" y="60" width="54" height="16" rx="6" fill="#141210"/><circle cx="58" cy="200" r="30" fill="#dcf4f4" stroke="#141210" stroke-width="6"/><rect x="52" y="182" width="12" height="36" rx="6" fill="#141210"/><path d="M40 250L0 300H40Z" fill="#141210"/><circle cx="96" cy="300" r="26" fill="#141210" stroke="#952788" stroke-width="8"/><circle cx="196" cy="300" r="26" fill="#141210" stroke="#952788" stroke-width="8"/></svg></div>`;
$('train').innerHTML = engine + D.journey.map(j => `<article class="car"><div class="win"><span class="yr">${esc(j.year)}</span><h3>${esc(j.title)}</h3><p>${esc(j.detail)}</p></div></article>`).join('');

/* ---------- wins, references, outside ---------- */
$('winGrid').innerHTML = D.wins.map((w, i) => `<article class="win"><figure class="window ${i % 2 ? 'tilt-r' : 'tilt-l'}"><img src="${m(w.image)}" alt="${esc(w.title)}" loading="lazy"></figure><h3>${esc(w.title)}</h3><p>${esc(w.detail)}</p></article>`).join('');
$('quotes').innerHTML = D.testimonials.map(t => `<figure class="bubble"><blockquote>${esc(t.quote)}</blockquote><figcaption><b>${esc(t.name)}</b><span>${esc(t.role)}. ${esc(t.relation)}.</span></figcaption></figure>`).join('');
$('outGrid').innerHTML = D.outside.map((o, i) => `<article class="out"><figure class="window ${i % 2 ? 'tilt-r' : 'tilt-l'}"><img src="${m(o.image)}" alt="${esc(o.title)}" loading="lazy"></figure><h3>${esc(o.title)}</h3><p>${esc(o.detail)}</p></article>`).join('');

/* ---------- contact ---------- */
$('headshot').src = m(D.media.headshot); $('headshot').alt = `${D.person.first_name} ${D.person.last_name}`;
$('contactLine').textContent = `Looking for ${D.person.looking_for.charAt(0).toLowerCase() + D.person.looking_for.slice(1)}. Free from ${D.person.available_from}.`;
const links = [
  ['email', 'Email', `mailto:${D.contact.email}`, D.contact.email],
  ['linkedin', 'LinkedIn', D.contact.linkedin, 'Profile'],
  ['calendar', 'Book a call', D.contact.calendly, '20 minutes'],
  ['resume', 'Resume', D.contact.resume_pdf, 'One-page PDF'],
];
$('links').innerHTML = links.map(l => { const k = 'x' + EXTRA.push({ mark: { icon: l[0], name: l[1], bg: '#dcf4f4' } }); return `<li><a href="${esc(l[2])}" data-mark="${k}"${l[2].startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${esc(l[1])}</a></li>`; }).join('');
$('fine').textContent = D.demo ? 'Sample persona. All people, figures and quotes here are made up; tool logos belong to their owners.' : '';

/* ---------- menu ---------- */
$('menuBtn').addEventListener('click', () => { const o = $('nav').classList.toggle('open'); $('menuBtn').setAttribute('aria-expanded', o); $('menuBtn').textContent = o ? 'Close' : 'Menu'; });
$('nav').addEventListener('click', (e) => { if (e.target.closest('a')) { $('nav').classList.remove('open'); $('menuBtn').setAttribute('aria-expanded', false); $('menuBtn').textContent = 'Menu'; } });

/* ---------- rope: close the curtain, back to the start ---------- */
$('rope').dataset.ring = 'PULL';
$('rope').addEventListener('click', () => {
  const r = $('rope'); r.classList.add('pulled'); setTimeout(() => r.classList.remove('pulled'), 400);
  curtain.classList.remove('gone', 'open');
  setTimeout(() => { scrollTo({ top: 0, behavior: 'instant' }); openCurtain(); }, 1600);
});

/* ---------- the eye ---------- */
startEye({
  marks: (k) => {
    if (k[0] === 'x') return EXTRA[+k.slice(1) - 1];
    const a = A[+k]; if (!a) return null; const lb = L[a.kind];
    return { mark: a.mark, tag: { name: a.mark.name, rows: [[lb[0], a.size[0], a.size[1]], [lb[1], a.cycle]], extra: a.extra } };
  },
  start: () => { const r = $('who').getBoundingClientRect(); return { x: Math.min(innerWidth - 70, r.right - 40 + scrollX), y: r.top + scrollY + r.height * .22 }; },
  onLook: look,
});

/* ---------- scroll playhead ---------- */
if (!reduce) {
  const dive = $('dive'), ringsEl = $('rings'), lines = [...$('diveLines').children], dEye = $('dEye');
  const hi = $('about'), hiWord = $('hiWord'), jr = $('journey'), train = $('train');
  const clamp = (v) => Math.max(0, Math.min(1, v));
  let ticking = false;
  function frame() {
    ticking = false; const vh = innerHeight, vw = innerWidth;
    let r = dive.getBoundingClientRect(); const p = clamp(-r.top / (r.height - vh));
    ringsEl.style.setProperty('--s', (1 + p * p * 5).toFixed(3));
    dEye.style.opacity = (1 - p * 4).toFixed(2);
    const idx = p < .1 ? -1 : p < .4 ? 0 : p < .7 ? 1 : 2;
    lines.forEach((l, i) => l.classList.toggle('on', i === idx));
    r = hi.getBoundingClientRect(); const q = clamp((vh - r.top) / (vh + r.height));
    hiWord.style.setProperty('--x', ((.35 - q * .9) * (vw > 700 ? vw * .5 : 0)).toFixed(1) + 'px');
    if (vw > 700) {
      r = jr.getBoundingClientRect(); const t = clamp(-r.top / (r.height - vh));
      const tw = train.scrollWidth; train.style.setProperty('--tx', ((vw * .55) * (1 - t) - (tw - vw * .9) * t).toFixed(1) + 'px');
    }
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }, { passive: true });
  addEventListener('resize', frame); frame();
}
if (location.hash) { const t = document.querySelector(location.hash); if (t) setTimeout(() => t.scrollIntoView(), 50); }
if (D.demo) { const n = document.createElement('p'); n.className = 'sample-note'; n.textContent = 'Sample persona. Harleen Bedi is fictional; every employer, school and colleague here is invented.'; document.body.appendChild(n); }
