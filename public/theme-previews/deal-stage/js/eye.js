/* The eye cursor, shared by every page.
   Desktop (fine pointer): a code-drawn eye replaces the pointer. It trails the mouse, looks where you move,
   blinks when you stop, dilates over links and morphs into a wordmark tile over anything with [data-mark].
   Touch: the eye lives in the page (absolute), starts at a spot the page chooses, follows taps and morphs on tap.
   Reduced motion: nothing runs and the system cursor stays. */

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- wordmark tiles ---------- */
const DRAW = {
  hospital: (c) => `<svg viewBox="0 0 40 40" fill="${c}"><rect x="14" y="3" width="12" height="34" rx="3"/><rect x="3" y="14" width="34" height="12" rx="3"/></svg>`,
  agri: (c) => `<svg viewBox="0 0 40 48" fill="${c}"><path d="M19 47V10h2v37z"/><ellipse cx="20" cy="6" rx="4" ry="6"/>${[14, 22, 30].map(y => `<ellipse cx="13" cy="${y}" rx="4" ry="7" transform="rotate(-35 13 ${y})"/><ellipse cx="27" cy="${y}" rx="4" ry="7" transform="rotate(35 27 ${y})"/>`).join('')}</svg>`,
  mic: (c) => `<svg viewBox="0 0 40 48" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round"><rect x="13" y="2" width="14" height="26" rx="7" fill="${c}"/><path d="M7 21c0 8 6 13 13 13s13-5 13-13M20 34v10M12 45h16"/></svg>`
};
const ICON = {
  email: '<svg viewBox="0 0 48 48" fill="none" stroke="#141210" stroke-width="4" stroke-linejoin="round"><rect x="5" y="10" width="38" height="28" rx="5"/><path d="M6 13l18 14 18-14"/></svg>',
  linkedin: '<svg viewBox="0 0 48 48"><rect x="3" y="3" width="42" height="42" rx="9" fill="#141210"/><rect x="11" y="20" width="6" height="17" fill="#dcf4f4"/><circle cx="14" cy="13" r="3.6" fill="#dcf4f4"/><path d="M22 20h6v3c1.5-2.4 4-3.6 6.6-3.6 4 0 6.4 2.6 6.4 7.6V37h-6v-9c0-2.6-1-4-3.2-4-2.2 0-3.8 1.6-3.8 4.4V37h-6z" fill="#dcf4f4"/></svg>',
  calendar: '<svg viewBox="0 0 48 48" fill="none" stroke="#141210" stroke-width="4" stroke-linejoin="round"><rect x="5" y="9" width="38" height="34" rx="5"/><path d="M5 19h38M15 4v9M33 4v9"/><circle cx="16" cy="29" r="2.5" fill="#141210"/><circle cx="24" cy="29" r="2.5" fill="#141210"/><circle cx="32" cy="29" r="2.5" fill="#141210"/></svg>',
  resume: '<svg viewBox="0 0 48 48" fill="none" stroke="#141210" stroke-width="4" stroke-linejoin="round"><path d="M11 4h18l9 9v31H11z"/><path d="M29 4v9h9M17 24h15M17 31h15M17 38h9"/></svg>',
  back: '<svg viewBox="0 0 48 48" fill="none" stroke="#141210" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M30 8L14 24l16 16"/></svg>'
};
export function tileHTML(mark, mini = false) {
  if (!mark) return '';
  if (mark.icon) return `<div class="icon-tile">${ICON[mark.icon] || ''}<span>${esc(mark.name)}</span></div>`;
  const glyph = DRAW[mark.draw] ? DRAW[mark.draw](mark.fg) : '';
  if (mini) return `<div class="mk" style="color:${mark.fg}">${glyph || `<b class="ab">${esc(mark.abbr)}</b>`}</div>`;
  const fs = glyph ? '' : `font-size:${mark.name.length > 12 ? 18 : mark.name.length > 9 ? 21 : 26}px`;
  return `<div class="mk${glyph ? '' : ' word'}" style="color:${mark.fg}">${glyph}<b style="${fs}">${esc(mark.name)}</b>${mark.sub ? `<i>${esc(mark.sub)}</i>` : ''}</div>`;
}
export function tagHTML(t) {
  if (!t) return '';
  return `<div class="nm">${esc(t.name)}</div><dl>${t.rows.map(r => `<div><dt>${esc(r[0])}</dt><dd>${esc(r[1])}${r[2] ? `<small>${esc(r[2])}</small>` : ''}</dd></div>`).join('')}</dl>${t.extra ? `<p class="x">${esc(t.extra)}</p>` : ''}`;
}

/* ---------- controller ---------- */
export function startEye({ marks, start, ring = 'SCROLL', onLook } = {}) {
  const eye = document.getElementById('eye');
  if (!eye || reduce) return null;
  const root = document.documentElement;
  const touchMode = !fine;
  root.classList.add(touchMode ? 'touch-eye' : 'has-eye');
  const lens = eye.querySelector('.lens'), tile = eye.querySelector('.tile'), tag = eye.querySelector('.tag');
  const ringText = eye.querySelector('textPath'), pupil = eye.querySelector('.pupil');
  const pos = { x: innerWidth / 2, y: innerHeight / 2 }, target = { ...pos };
  let last = performance.now(), lastMove = performance.now(), nextBlink = 2500, cur = null, ringNow = '';
  const setRing = (w) => { if (w === ringNow) return; ringNow = w; ringText.textContent = Array(5).fill(w).join(' · ') + ' ·'; };
  setRing(ring);

  function place() {
    if (touchMode && start) { const p = start(); pos.x = target.x = p.x; pos.y = target.y = p.y; }
  }
  place(); addEventListener('load', place);

  function morph(el) {
    const key = el.dataset.mark; const m = marks && marks(key);
    if (!m) return;
    if (cur !== el) {
      tile.innerHTML = tileHTML(m.mark); lens.style.background = m.mark.bg || '#ffffff';
      tag.innerHTML = touchMode ? '' : tagHTML(m.tag); tag.style.display = (touchMode || !m.tag) ? 'none' : '';
    }
    cur = el; eye.classList.add('morph'); eye.classList.remove('wide');
  }
  function unmorph() { if (!cur) return; cur = null; eye.classList.remove('morph'); lens.style.background = ''; }
  function hoverTarget(t) {
    const m = t && t.closest && t.closest('[data-mark]');
    if (m) return morph(m);
    unmorph();
    eye.classList.toggle('light', !!(t && t.closest && t.closest('.dark-scene')));
    const l = t && t.closest && t.closest('a,button,[data-ring]');
    eye.classList.toggle('wide', !!l);
    setRing(l ? (l.dataset.ring || 'OPEN') : ((t && t.closest && t.closest('[data-ring-scene]')) ? t.closest('[data-ring-scene]').dataset.ringScene : ring));
  }

  if (!touchMode) {
    let kbd = null, lx = -1, ly = -1;   // kbd: element that owns the eye after keyboard focus, until the mouse really moves
    addEventListener('mousemove', (e) => {
      if (e.clientX === lx && e.clientY === ly) return;   // Chrome fires a synthetic move after scrolling; ignore it
      lx = e.clientX; ly = e.clientY; kbd = null;
      target.x = e.clientX; target.y = e.clientY; lastMove = performance.now(); eye.style.opacity = 1; onLook && onLook(e.clientX, e.clientY);
    }, { passive: true });
    document.addEventListener('mouseover', (e) => { if (!kbd) hoverTarget(e.target); });
    document.addEventListener('mouseleave', () => { eye.style.opacity = 0; });
    const aim = (m) => { const r = m.getBoundingClientRect(); target.x = Math.max(80, Math.min(r.right - 90, innerWidth - 90)); target.y = Math.max(80, Math.min(innerHeight - 80, r.top + r.height / 2)); };
    addEventListener('scroll', () => { if (kbd) return aim(kbd); const t = document.elementFromPoint(target.x, target.y); hoverTarget(t); }, { passive: true });
    document.addEventListener('focusin', (e) => {
      const m = e.target.closest('[data-mark]'); if (!m || e.target.matches(':hover')) return;
      kbd = m; eye.style.opacity = 1; morph(m); aim(m);
      pos.x = target.x; pos.y = target.y;             // jump, do not fly in from off screen
      const settle = () => { if (kbd === m) { aim(m); morph(m); } };
      addEventListener('scrollend', settle, { once: true }); setTimeout(settle, 450);
    });
    document.addEventListener('focusout', (e) => { if (kbd && !kbd.contains(e.relatedTarget)) { kbd = null; unmorph(); } });
  } else {
    // touch: follow taps in page coordinates
    document.addEventListener('click', (e) => {
      const m = e.target.closest('[data-mark]');
      const dock = m && m.querySelector('.dock');
      lastMove = performance.now();
      if (dock && m.classList.contains('on')) {
        const r = dock.getBoundingClientRect(); target.x = r.left + r.width / 2 + scrollX; target.y = r.top + r.height / 2 + scrollY;
      } else {
        target.x = Math.max(72, Math.min(innerWidth - 72, e.pageX)); target.y = e.pageY;
      }
      onLook && onLook(e.clientX, e.clientY);
      if (m) { morph(m); clearTimeout(morph.t); if (!dock) morph.t = setTimeout(unmorph, 2600); } else unmorph();
    });
  }

  function blink() { eye.classList.add('blink'); onLook && onLook.blink && onLook.blink(); setTimeout(() => eye.classList.remove('blink'), 150); }
  function tick(now) {
    const dt = Math.min(64, now - last); last = now;
    const k = 1 - Math.pow(touchMode ? 0.86 : 0.7, dt / 16);
    const vx = (target.x - pos.x), vy = (target.y - pos.y);
    pos.x += vx * k; pos.y += vy * k;
    eye.style.transform = `translate3d(${pos.x.toFixed(1)}px,${pos.y.toFixed(1)}px,0)`;
    const sp = Math.hypot(vx, vy) || 1, look = Math.min(8, sp / 6);
    pupil.style.setProperty('--px', (vx / sp * look).toFixed(1) + 'px');
    pupil.style.setProperty('--py', (vy / sp * look * .5).toFixed(1) + 'px');
    if (!touchMode) eye.classList.toggle('flip', pos.x > innerWidth - 380);
    if (now - lastMove > 1400 && !cur) { nextBlink -= dt; if (nextBlink <= 0) { blink(); nextBlink = 2200 + Math.random() * 2600; } }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  return { unmorph, place, setRing };
}
