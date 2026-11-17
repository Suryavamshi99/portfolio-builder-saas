// Print résumé: one plain page built from portfolio.json, styled for A4 in css/site.css.
import { $, esc, loadData, shell, arrive, forCompany } from './base.js';

async function main() {
  const d = await loadData();
  const co = forCompany();
  const exp = d.experience.map((e) => `<div class="r-item"><div class="r-top"><b>${esc(e.role)}, ${esc(e.org)}</b><span>${esc(e.dates)} · ${esc(e.place)}</span></div><ul>${e.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('');
  const edu = d.education.map((e) => `<div class="r-item"><div class="r-top"><b>${esc(e.degree)}, ${esc(e.school)}</b><span>${esc(e.years)}</span></div><p>${esc(e.notes)}</p></div>`).join('');
  const prj = d.projects.slice(0, 6).map((p) => `<li><b>${esc(p.title)}</b> (${esc(p.org)}, ${esc(p.year)}). ${esc(p.result)}.</li>`).join('');
  const sk = Object.entries(d.skills).map(([k, v]) => `<p><b>${esc(k)}:</b> ${v.map(esc).join(', ')}</p>`).join('');
  $('main').innerHTML = `
  <article class="resume">
    <div class="r-bar"><a class="disc hollow" href="index.html"><i class="disc-o" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M16 10H5M9.5 5.5 5 10l4.5 4.5"/></svg></i><span>Back to the site</span></a><button class="disc" type="button" onclick="print()"><i class="disc-o" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M10 3v10M5.5 8.5 10 13l4.5-4.5M4 17h12"/></svg></i><span>Print or save as PDF</span></button></div>
    <header class="r-head"><h1>${esc(d.person.first_name)} ${esc(d.person.last_name)}</h1><p>${esc(d.person.headline)}</p>
      <p class="r-contact">${esc(d.contact.email)} · ${esc(d.contact.phone)} · ${esc(d.person.location)} · Available ${esc(d.person.available_from)}</p>
      ${co ? `<p class="r-for">Prepared for ${esc(co)}.</p>` : ''}</header>
    <section><h2>Experience</h2>${exp}</section>
    <section><h2>Selected work</h2><ul class="r-list">${prj}</ul></section>
    <section><h2>Education</h2>${edu}</section>
    <section><h2>Skills</h2>${sk}<p><b>Certifications:</b> ${d.certifications.map((c) => `${esc(c.name)} (${esc(c.year)})`).join(', ')}</p></section>
    <p class="r-note">Sample résumé. ${esc(d._note)}</p>
  </article>`;
  shell(d, 'resume');
  await arrive();
}
main();
