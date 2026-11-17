/* ==========================================================================
   parts.js — pieces shared by the home and project pages:
   the Emberrest night-graph (draw-in + hover-to-read) and Halden's shutter
   image reveal.
   ========================================================================== */
(function () {
  const { $, $$, esc } = K;
  /** Emberrest night-graph pattern: line draws in, hover or touch reads any week */
  K.nightGraph = function (svg, out, c) {
    const Wd = 960, Hd = 300, l = 46, r = 16, t = 20, b = 40;
    const all = c.series.flatMap((s) => s.values), lo = Math.floor(Math.min(...all) - 1), hi = Math.ceil(Math.max(...all) + 1);
    const n = c.series[0].values.length;
    const X = (i) => l + (i / (n - 1)) * (Wd - l - r), Y = (v) => t + (1 - (v - lo) / (hi - lo)) * (Hd - t - b);
    const path = (vals) => vals.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
    const grid = [lo, (lo + hi) / 2, hi].map((v) => `<line x1="${l}" x2="${Wd - r}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${l - 8}" y="${Y(v) + 3}" text-anchor="end">${v.toFixed(0)}${c.unit}</text>`).join('');
    const xl = [0, 4, 8, 12, n - 1].map((i) => `<text x="${X(i)}" y="${Hd - 14}" text-anchor="middle">${esc(c.x_prefix)}${i + 1}</text>`).join('');
    const mi = c.marker_index;
    svg.innerHTML = `<defs><linearGradient id="gf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4dc4ff" stop-opacity=".26"/><stop offset="1" stop-color="#4dc4ff" stop-opacity="0"/></linearGradient></defs>
      <g class="gl">${grid}${xl}</g>
      <g class="marker"><line x1="${X(mi)}" x2="${X(mi)}" y1="${t}" y2="${Hd - b}"/><text x="${X(mi) + 8}" y="${t + 10}">${esc(c.marker_label)}</text></g>
      <path class="fill" d="${path(c.series[0].values)} L${X(n - 1)} ${Hd - b} L${X(0)} ${Hd - b}Z" fill="url(#gf)"/>
      <path class="ln-c" d="${path(c.series[1].values)}"/>
      <path class="ln-b" d="${path(c.series[0].values)}" pathLength="1"/>
      <line class="cur" y1="${t}" y2="${Hd - b}"/><circle class="dot" r="6"/><circle class="dot2" r="4"/>`;
    const ln = svg.querySelector('.ln-b'), fill = svg.querySelector('.fill');
    if (!K.reduce) {
      gsap.set(ln, { strokeDasharray: 1, strokeDashoffset: 1 }); gsap.set(fill, { opacity: 0 });
      new IntersectionObserver((es) => es.forEach((e) => {
        if (e.isIntersecting) { gsap.to(ln, { strokeDashoffset: 0, duration: 2.6, ease: 'power2.inOut', overwrite: 'auto' }); gsap.to(fill, { opacity: 1, duration: 1.6, delay: 1.2 }); }
        else if (e.boundingClientRect.top > 0) { gsap.set(ln, { strokeDashoffset: 1 }); gsap.set(fill, { opacity: 0 }); }
      }), { threshold: .3 }).observe(svg);
    }
    const cur = svg.querySelector('.cur'), dot = svg.querySelector('.dot'), dot2 = svg.querySelector('.dot2');
    const read = (cx) => {
      const bb = svg.getBoundingClientRect();
      const x = gsap.utils.clamp(l, Wd - r, ((cx - bb.left) / bb.width) * Wd);
      const i = Math.round(((x - l) / (Wd - l - r)) * (n - 1));
      const a = c.series[0].values[i], b2 = c.series[1].values[i];
      [cur].forEach((e) => { e.setAttribute('x1', X(i)); e.setAttribute('x2', X(i)); e.style.opacity = 1; });
      dot.setAttribute('cx', X(i)); dot.setAttribute('cy', Y(a)); dot.style.opacity = 1;
      dot2.setAttribute('cx', X(i)); dot2.setAttribute('cy', Y(b2)); dot2.style.opacity = 1;
      out.textContent = `${c.x_prefix}${i + 1} · ${c.series[0].name.toLowerCase()} ${a}${c.unit} · ${c.series[1].name.toLowerCase()} ${b2}${c.unit}${i >= mi ? ' · suggestions live' : ' · before the beta'}`;
    };
    svg.addEventListener('pointermove', (e) => read(e.clientX));
    svg.addEventListener('pointerdown', (e) => read(e.clientX));
    svg.addEventListener('pointerleave', () => { cur.style.opacity = 0; dot.style.opacity = 0; dot2.style.opacity = 0; out.textContent = ''; });
  };

  K.shutter = function (el) {
    const slats = $$('.slats i', el), img = $('img', el);
    if (K.reduce) return;
    gsap.to(img, { yPercent: -12, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
    const play = () => { gsap.fromTo(slats, { scaleX: 1 }, { scaleX: 0, duration: 1, stagger: .09, ease: 'power3.inOut', overwrite: true }); gsap.fromTo(img, { scale: 1.25 }, { scale: 1, duration: 1.9, ease: 'power3.out', overwrite: 'auto' }); };
    new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) play(); else if (e.boundingClientRect.top > 0) gsap.set(slats, { scaleX: 1 }); }), { threshold: .18 }).observe(el);
  }

})();
