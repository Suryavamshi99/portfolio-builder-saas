// Shared page shell, adapted from Ada Okafor's shared bundle (nav, menu, Lenis on the
// GSAP ticker, [data-lines], [data-reveal], [data-count], parallax photos, accordion, forms).
// Changed for this site: a centred masthead instead of Ada's pill nav, and a short cream
// veil with a brass rule instead of Ada's wipe.
const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let DATA = null;
export async function loadData() {
  if (DATA) return DATA;
  const r = await fetch('content/portfolio.json', { cache: 'no-cache' });
  DATA = await r.json();
  return DATA;
}

// ?for=Company — read once, kept on internal links
export function forCompany() {
  const v = new URLSearchParams(location.search).get('for');
  if (!v) return '';
  return v.replace(/[^\p{L}\p{N} &.,'’()-]/gu, '').trim().slice(0, 48);
}
function carryFor(href) {
  const f = forCompany();
  if (!f || !href || /^(https?:|mailto:|tel:|#)/.test(href)) return href;
  const [path, hash] = href.split('#');
  if (!/\.html$/.test(path) && path !== '' && path !== './') return href;
  const u = new URL(path || './', location.href);
  u.searchParams.set('for', f);
  return u.pathname.split('/').pop() + u.search + (hash ? '#' + hash : '');
}

export const photo = (src, alt, o = {}) =>
  `<figure class="photo ${o.cls || ''}" ${o.par === false ? '' : 'data-par'} style="${o.ratio ? `aspect-ratio:${o.ratio};` : ''}"><div class="ph-in"><img src="${esc(src)}" alt="${esc(alt)}" loading="${o.eager ? 'eager' : 'lazy'}" decoding="async" style="object-position:${o.pos || '50% 50%'}"></div></figure>`;

export const field = (id, label, control) =>
  `<div class="field"><label for="${id}">${esc(label)}</label>${control}<p class="err" role="alert"></p></div>`;

export const disc = (href, label, o = {}) =>
  `<a class="disc${o.cls ? ' ' + o.cls : ''}" href="${esc(href)}"${o.attrs || ''}><i class="disc-o" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M4 10h11M10.5 5.5 15 10l-4.5 4.5"/></svg></i><span>${esc(label)}</span></a>`;

const NAV = {
  left: [['index.html#field', 'Field notes'], ['index.html#cases', 'Cases'], ['index.html#casebook', 'Case book']],
  right: [['index.html#model', 'Re-weight'], ['index.html#contact', 'Contact'], ['resume.html', 'Résumé']],
};

function navHTML(d, page) {
  const li = ([h, l]) => `<li><a href="${h}"${page === 'resume' && h === 'resume.html' ? ' aria-current="page"' : ''}>${l}</a></li>`;
  const all = [...NAV.left, ...NAV.right];
  return `
  <header class="mast" data-tone="${page === 'home' ? 'light' : 'dark'}">
    <nav class="mast-l" aria-label="Sections"><ul>${NAV.left.map(li).join('')}</ul></nav>
    <a class="mark" href="index.html" aria-label="${esc(d.person.first_name)} ${esc(d.person.last_name)}, home"><span class="mark-n">${esc(d.person.first_name)} <em>${esc(d.person.last_name)}</em></span><span class="mark-s">Management consulting</span></a>
    <nav class="mast-r" aria-label="More"><ul>${NAV.right.map(li).join('')}</ul></nav>
    <button class="menu-btn" aria-expanded="false" aria-controls="menu"><span class="mb-t">Menu</span><span class="mb-x" aria-hidden="true"></span></button>
  </header>
  <div class="menu" id="menu" aria-hidden="true">
    ${all.map(([h, l], i) => `<a href="${h}" style="--i:${i}" tabindex="-1"><span>${l}</span></a>`).join('')}
    <p class="menu-foot">${esc(d.contact.email)} · sample contact</p>
  </div>`;
}

function footerHTML(d) {
  const year = new Date().getFullYear();
  return `
  <footer class="foot">
    <div class="container">
      <div class="foot-top">
        <div>
          <p class="foot-line display">Nisha Bhandari, ${esc(d.site.city)}. Taking Associate and Consultant conversations from ${esc(d.person.available_from)}.</p>
          <svg class="sig" viewBox="0 0 300 96" role="img" aria-label="Nisha Bhandari, signature" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
            <path pathLength="1" d="M14 80 C 22 58 30 30 34 14 C 46 10 64 14 62 30 C 60 44 42 46 34 44 C 46 54 56 66 70 78 M84 76 C 88 74 90 72 92 70 M110 80 C 116 54 120 34 124 22 C 130 44 134 58 138 64 C 144 48 152 30 160 20 C 160 42 160 62 164 80 C 172 70 178 58 186 60 C 194 62 186 78 196 76 C 206 74 210 50 214 34 C 214 54 214 70 220 78 C 228 66 236 58 246 62 C 256 66 248 80 260 76 C 272 72 282 64 292 56"/>
          </svg>
        </div>
        <div class="fcols">
          <div class="fcol"><h3 class="lbl">On this site</h3><ul>
            <li><a href="index.html#field">Field notes</a></li><li><a href="index.html#cases">Cases</a></li><li><a href="index.html#model">Re-weight the market</a></li><li><a href="resume.html">Printable résumé</a></li></ul></div>
          <div class="fcol"><h3 class="lbl">Case write-ups</h3><ul>
            <li><a href="case-working-capital.html">Working capital</a></li><li><a href="case-tile-pricing.html">Retailer pricing</a></li><li><a href="case-cold-chain.html">Depot entry</a></li></ul></div>
          <div class="fcol"><h3 class="lbl">Elsewhere</h3><ul>
            <li><a href="${esc(d.contact.linkedin)}" rel="noopener">LinkedIn (placeholder)</a></li><li><a href="${esc(d.contact.substack)}" rel="noopener">Substack (placeholder)</a></li><li><a href="mailto:${esc(d.contact.email)}">${esc(d.contact.email)}</a></li></ul></div>
        </div>
      </div>
      <p class="sample-note"><b>Sample portfolio.</b> ${esc(d._note)}</p>
      <div class="foot-bot"><span>&copy; ${year} Nisha Bhandari</span><span>${esc(d.person.location)}</span><span>Not indexed by search engines</span></div>
    </div>
  </footer>`;
}

let lenis = null;
export function scrollToEl(el) {
  if (lenis) lenis.scrollTo(el, { offset: -70, duration: 1.2 });
  else el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
}

function initLenis() {
  if (reduced() || !window.Lenis) return null;
  const l = new window.Lenis({ lerp: 0.1, wheelMultiplier: 1 });
  l.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => l.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  return l;
}

// Page change: a cream veil fades up while a brass rule draws across it, then we leave.
function veil() {
  let v = $('.veil');
  if (!v) {
    v = document.createElement('div');
    v.className = 'veil';
    v.setAttribute('aria-hidden', 'true');
    v.innerHTML = '<i></i>';
    document.body.appendChild(v);
  }
  return v;
}
function leave(href) {
  const v = veil();
  if (reduced()) { location.href = href; return; }
  gsap.set(v, { autoAlpha: 0 });
  gsap.set(v.firstElementChild, { scaleX: 0 });
  gsap.timeline({ onComplete: () => { location.href = href; } })
    .to(v, { autoAlpha: 1, duration: 0.32, ease: 'power2.out' })
    .to(v.firstElementChild, { scaleX: 1, duration: 0.42, ease: 'power3.inOut' }, 0.05);
}
export function arrive() {
  const v = veil();
  if (reduced()) { gsap.set(v, { autoAlpha: 0 }); return Promise.resolve(); }
  gsap.set(v, { autoAlpha: 1 });
  gsap.set(v.firstElementChild, { scaleX: 1, transformOrigin: '100% 50%' });
  return new Promise((res) => {
    gsap.timeline({ onComplete: res })
      .to(v.firstElementChild, { scaleX: 0, duration: 0.45, ease: 'power3.inOut' })
      .to(v, { autoAlpha: 0, duration: 0.45, ease: 'power2.out' }, 0.15);
    setTimeout(res, 900);
  });
}

export function shell(d, page) {
  document.documentElement.dataset.page = page;
  const tmp = document.createElement('div');
  tmp.innerHTML = navHTML(d, page);
  while (tmp.lastChild) document.body.prepend(tmp.lastChild);
  $('main').insertAdjacentHTML('afterend', footerHTML(d));
  veil();

  const mast = $('.mast');
  const solid = () => mast.classList.toggle('solid', window.scrollY > 40);
  solid();
  window.addEventListener('scroll', solid, { passive: true });

  const btn = $('.menu-btn'), menu = $('.menu');
  const setMenu = (on) => {
    btn.setAttribute('aria-expanded', String(on));
    menu.setAttribute('aria-hidden', String(!on));
    $$('a', menu).forEach((a) => a.setAttribute('tabindex', on ? '0' : '-1'));
    document.documentElement.classList.toggle('menu-open', on);
    on ? lenis?.stop() : lenis?.start();
  };
  btn.addEventListener('click', () => setMenu(btn.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  // keep ?for on internal links
  if (forCompany()) $$('a[href]').forEach((a) => a.setAttribute('href', carryFor(a.getAttribute('href'))));

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank' || a.hasAttribute('download')) return;
    const href = a.getAttribute('href') || '';
    if (!href || /^(mailto:|tel:|https?:)/.test(href) || href === '#') return;
    const u = new URL(href, location.href);
    if (u.origin !== location.origin) return;
    if (u.pathname === location.pathname) {
      if (u.hash) {
        const t = document.querySelector(u.hash);
        if (t) { e.preventDefault(); scrollToEl(t); history.replaceState(null, '', u.hash + ''); }
      }
      return;
    }
    e.preventDefault();
    leave(u.href);
  });
  window.addEventListener('pageshow', (e) => { if (e.persisted) gsap.set(veil(), { autoAlpha: 0 }); });

  lenis = initLenis();
  if (location.hash.length > 1) {
    const t = document.querySelector(location.hash);
    if (t) setTimeout(() => scrollToEl(t), 400);
  }
  return { mast, lenis };
}

// [data-lines]: words rise through masks (Ada's split)
function splitWords(el) {
  const walk = (src, dst) => {
    src.childNodes.forEach((n) => {
      if (n.nodeType === 3) {
        (n.textContent || '').split(/(\s+)/).forEach((w) => {
          if (!w) return;
          if (/^\s+$/.test(w)) { dst.appendChild(document.createTextNode(' ')); return; }
          const m = document.createElement('span'); m.className = 'w-mask';
          const s = document.createElement('span'); s.className = 'w'; s.textContent = w;
          m.appendChild(s); dst.appendChild(m);
        });
      } else if (n.nodeName === 'BR') dst.appendChild(n.cloneNode());
      else if (n.nodeType === 1) { const c = n.cloneNode(false); dst.appendChild(c); walk(n, c); }
    });
  };
  const box = document.createElement('div');
  walk(el, box);
  el.setAttribute('aria-label', el.textContent.trim());
  el.innerHTML = box.innerHTML;
  $$('.w-mask', el).forEach((m) => m.setAttribute('aria-hidden', 'true'));
  return $$('.w', el);
}
export function lines(root = document) {
  $$('[data-lines]', root).forEach((el) => {
    const ws = splitWords(el);
    if (reduced()) return;
    gsap.set(ws, { yPercent: 112, opacity: 0 });
    new IntersectionObserver((es) => es.forEach((en) => {
      if (en.isIntersecting) gsap.to(ws, { yPercent: 0, opacity: 1, duration: 1, stagger: 0.045, ease: 'power3.out', overwrite: 'auto' });
      else if (en.boundingClientRect.top > 0) gsap.set(ws, { yPercent: 112, opacity: 0 });
    }), { threshold: 0.2, rootMargin: '0px 0px -5% 0px' }).observe(el);
  });
}

export function reveals(root = document) {
  const els = $$('[data-reveal]', root);
  if (!reduced()) {
    gsap.set(els, { opacity: 0, y: 28 });
    const io = new IntersectionObserver((es) => es.forEach((en) => {
      const el = en.target, dl = parseFloat(el.dataset.revealDelay || '0');
      if (en.isIntersecting) gsap.to(el, { opacity: 1, y: 0, duration: 1, delay: dl, ease: 'power3.out', overwrite: 'auto' });
      else if (en.boundingClientRect.top > 0) gsap.set(el, { opacity: 0, y: 28 });
    }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach((el) => io.observe(el));
  }
  $$('.sig', root).forEach((s) => {
    if (reduced()) { s.classList.add('in'); return; }
    const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { s.classList.add('in'); io.disconnect(); } }), { threshold: 0.5 });
    io.observe(s);
  });
  // [data-count] keeps the text around the number ($6.3M, 83→75 stays as text)
  const fmt = (n, dp) => n.toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const cio = new IntersectionObserver((es) => es.forEach((en) => {
    if (!en.isIntersecting) return;
    const el = en.target; cio.unobserve(el);
    const to = parseFloat(el.dataset.count), dp = parseInt(el.dataset.dp || '0', 10);
    const pre = el.dataset.pre || '', suf = el.dataset.suf || '';
    if (reduced()) { el.textContent = pre + fmt(to, dp) + suf; return; }
    const o = { v: 0 };
    gsap.to(o, { v: to, duration: 1.6, ease: 'power2.out', onUpdate: () => { el.textContent = pre + fmt(o.v, dp) + suf; } });
  }), { threshold: 0.5 });
  $$('[data-count]', root).forEach((el) => cio.observe(el));
}

export function parallax(root = document) {
  if (reduced()) return;
  $$('.photo[data-par]', root).forEach((f) => {
    const i = $('.ph-in', f);
    if (i) gsap.fromTo(i, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: f, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
}

export function accordion(root = document) {
  $$('.acc', root).forEach((acc) => {
    $$('.acc-row', acc).forEach((row) => {
      const b = $('.acc-btn', row);
      b.addEventListener('click', () => {
        const open = b.getAttribute('aria-expanded') !== 'true';
        $$('.acc-row', acc).forEach((r) => {
          const rb = $('.acc-btn', r), p = $('.acc-panel', r), me = r === row;
          rb.setAttribute('aria-expanded', String(me && open));
          gsap.to(p, { height: me && open ? 'auto' : 0, duration: reduced() ? 0 : 0.5, ease: 'power3.out' });
        });
      });
    });
  });
}

// Ada's form handler: inline errors, no backend. This is a sample site.
export function form(f, rules, okText) {
  const ok = $('.form-ok', f.parentElement);
  const btn = $('button[type="submit"]', f);
  const set = (name, msg) => {
    const el = f.elements.namedItem(name), fld = el?.closest('.field'), err = fld && $('.err', fld);
    if (err) err.textContent = msg;
    fld?.classList.toggle('bad', !!msg);
    el?.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };
  const check = (r) => {
    const v = String(f.elements.namedItem(r.name)?.value || '').trim();
    const bad = !v || (r.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v));
    set(r.name, bad ? r.msg : '');
    return !bad;
  };
  rules.forEach((r) => {
    const el = f.elements.namedItem(r.name);
    el?.addEventListener('blur', () => check(r));
    el?.addEventListener('input', () => { if (el.closest('.field')?.classList.contains('bad')) check(r); });
  });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!rules.map(check).every(Boolean)) { f.querySelector('.bad input, .bad textarea, .bad select')?.focus(); return; }
    btn.disabled = true;
    await new Promise((r) => setTimeout(r, 600));
    gsap.to(f, { opacity: 0, y: -10, duration: reduced() ? 0 : 0.35, onComplete: () => {
      f.hidden = true; ok.hidden = false; ok.textContent = okText;
      gsap.fromTo(ok, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: reduced() ? 0 : 0.7 });
      ok.focus();
    } });
  });
}

export function nameOf(d) { return `${d.person.first_name} ${d.person.last_name}`; }
