// Re-weight model. Secondary reference: Contour's layer switches and ranked table
// (contour/assets/index-CgPzkEEz.js, Ky() and jy()): role="switch" rows, a "scoring with"
// readout, rows that re-sort with a FLIP slide and score bars that re-grow, top rows pinned.
// Content: the depot-entry scoring sheet from portfolio.json (market_model).
import { gsap, reduced, esc, $, $$ } from './base.js';

export function reweight(root, M) {
  const crit = M.criteria;
  const on = crit.map(() => true);
  let w = M.presets[0].weights.slice();
  let preset = 0;

  $('.crit', root).innerHTML = crit.map((c, i) => `
    <div class="crit-row is-on" data-i="${i}">
      <span class="crit-n">${String(i + 1).padStart(2, '0')}</span>
      <div class="crit-b"><h3>${esc(c.name)}</h3><p>${esc(c.hint)}</p></div>
      <span class="crit-w" aria-live="off"><b>${w[i]}</b>%</span>
      <button class="switch" type="button" role="switch" aria-checked="true" aria-label="Count ${esc(c.name)}"><span class="knob"></span></button>
    </div>`).join('');
  $('.presets', root).innerHTML = M.presets.map((p, i) => `<button type="button" class="preset" aria-pressed="${i === 0}">${esc(p.name)}</button>`).join('');
  const head = $('.rk-head', root);
  head.innerHTML = `<span class="c0">#</span><span class="c1">Option</span>${crit.map((c) => `<span class="cs" title="${esc(c.name)}">${esc(c.short)}</span>`).join('')}<span class="cg">Gap</span><span class="ct">Score</span>`;
  const body = $('.rk-body', root);

  const score = (o) => {
    let sw = 0, s = 0;
    crit.forEach((_, i) => { if (on[i] && w[i] > 0) { sw += w[i]; s += w[i] * o.scores[i]; } });
    return sw ? Math.round((s / sw) * 10) : 0;
  };
  const row = (o, r, top) => `
    <div class="tr${r === 0 && top ? ' is-top' : ''}${o.recommended ? ' is-rec' : ''}" role="row" data-id="${o.id}">
      <span role="cell" class="c0">${String(r + 1).padStart(2, '0')}</span>
      <span role="cell" class="c1"><b>${esc(o.city)}</b><i>${esc(o.segment)}</i></span>
      ${o.scores.map((s, i) => `<span role="cell" class="cs${on[i] && w[i] > 0 ? '' : ' off'}">${s}</span>`).join('')}
      <span role="cell" class="cg">${o.gap}k</span>
      <span role="cell" class="ct"><span class="bar"><i style="width:${o._s}%"></i></span><b>${o._s || '–'}</b></span>
    </div>`;

  const verdict = $('.verdict', root), scoring = $('.scoring', root);
  const render = (anim) => {
    const before = new Map();
    if (anim) $$('.tr', body).forEach((t) => before.set(t.dataset.id, t.getBoundingClientRect().top));
    const list = M.options.map((o) => ({ ...o, _s: score(o) })).sort((a, b) => b._s - a._s || b.gap - a.gap);
    const any = list[0]._s > 0;
    body.innerHTML = list.map((o, r) => row(o, r, any)).join('');
    const names = crit.filter((_, i) => on[i] && w[i] > 0).map((c) => c.short);
    scoring.textContent = names.length ? names.join(' + ') : 'nothing';
    scoring.classList.toggle('empty', !names.length);
    if (!any) verdict.textContent = 'Switch on at least one criterion to rank the six options.';
    else {
      const t = list[0];
      const lead = list[0]._s - list[1]._s;
      verdict.innerHTML = `<b>${esc(t.city)}, ${esc(t.segment.toLowerCase())}</b> ranks first${lead === 0 ? ', tied with the next option' : `, ${lead} point${lead === 1 ? '' : 's'} ahead of ${esc(list[1].city)} (${esc(list[1].segment.toLowerCase())})`}.${t.recommended ? ' This is the option we recommended.' : ' This is not the option we recommended.'}`;
    }
    if (anim && !reduced()) {
      $$('.tr', body).forEach((t, i) => {
        const b = before.get(t.dataset.id); if (b == null) return;
        const dy = b - t.getBoundingClientRect().top;
        if (Math.abs(dy) > 1) gsap.fromTo(t, { y: dy }, { y: 0, duration: 0.7, ease: 'power3.out', delay: i * 0.015, clearProps: 'transform' });
        const bar = $('.bar i', t); if (bar) gsap.from(bar, { width: 0, duration: 0.8, ease: 'power3.out' });
      });
    }
  };

  const sync = () => {
    $$('.crit-row', root).forEach((r, i) => {
      r.classList.toggle('is-on', on[i]);
      $('.switch', r).setAttribute('aria-checked', String(on[i]));
      $('.crit-w b', r).textContent = on[i] ? w[i] : 0;
    });
    $$('.preset', root).forEach((b, i) => b.setAttribute('aria-pressed', String(i === preset)));
  };
  $$('.crit-row .switch', root).forEach((b, i) => b.addEventListener('click', () => { on[i] = !on[i]; preset = -1; sync(); render(true); }));
  $$('.preset', root).forEach((b, i) => b.addEventListener('click', () => {
    preset = i; w = M.presets[i].weights.slice(); for (let k = 0; k < on.length; k++) on[k] = w[k] > 0; sync(); render(true);
  }));
  // hover a row: light up its scores in the criteria list (Contour focuses the parcel on its map)
  body.addEventListener('pointerover', (e) => {
    const t = e.target.closest('.tr'); if (!t) return;
    const o = M.options.find((x) => x.id === t.dataset.id);
    $$('.crit-row', root).forEach((r, i) => r.style.setProperty('--hit', String(o.scores[i] / 10)));
    root.classList.add('peek');
  });
  body.addEventListener('pointerleave', () => root.classList.remove('peek'));
  sync(); render(false);
}
