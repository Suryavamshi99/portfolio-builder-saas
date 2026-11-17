// Content helpers. Everything on the site comes from content/portfolio.json.
export async function loadContent() {
  const res = await fetch('content/portfolio.json', { cache: 'no-cache' });
  return res.json();
}
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// *word* becomes an italic accent, as in Stillwater's constants
export const rich = (s) => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');

// ?for=Company, cleaned to plain text
export function forCompany() {
  const raw = new URLSearchParams(location.search).get('for');
  if (!raw) return '';
  return raw.replace(/[^\p{L}\p{N} &.,'’-]/gu, '').trim().slice(0, 48);
}
export const withFor = (href) => {
  const c = forCompany();
  return c ? `${href}${href.includes('?') ? '&' : '?'}for=${encodeURIComponent(c)}` : href;
};

export function printResume(d) {
  const p = d.person, c = d.contact;
  const el = document.querySelector('.resume-print');
  if (!el) return;
  el.innerHTML = `
    <h1>${esc(p.first_name)} ${esc(p.last_name)}</h1>
    <p>${esc(p.headline)}</p>
    <p class="muted">${esc(p.location)} · ${esc(c.email)} · ${esc(c.phone)} · ${esc(c.linkedin)}</p>
    <p class="muted">Sample persona: an invented person used to demonstrate this template.</p>
    <h2>Summary</h2><p>${esc(d.pitch.short)}</p>
    <h2>Experience</h2>
    ${d.experience.map(x => `<div class="row"><span>${esc(x.role)}, ${esc(x.org)}, ${esc(x.place)}</span><span>${esc(x.dates)}</span></div><ul>${x.points.map(q => `<li>${esc(q)}</li>`).join('')}</ul>`).join('')}
    <h2>Selected work</h2>
    <ul>${d.projects.slice(0, 6).map(x => `<li><b>${esc(x.title)}</b> (${esc(x.org)}, ${esc(x.year)}): ${esc(x.result)}</li>`).join('')}</ul>
    <h2>Education</h2>
    ${d.education.map(x => `<div class="row"><span>${esc(x.degree)}, ${esc(x.school)}</span><span>${esc(x.years)}</span></div><p class="muted">${esc(x.notes)}</p>`).join('')}
    <h2>Skills</h2>
    ${Object.entries(d.skills).map(([k, v]) => `<p><b>${esc(k)}:</b> ${v.map(esc).join(', ')}</p>`).join('')}
    <h2>Certifications</h2>
    <p>${d.certifications.map(x => `${esc(x.name)} (${esc(x.issuer)}, ${esc(x.year)})`).join('; ')}</p>`;
}
