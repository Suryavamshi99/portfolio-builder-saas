/* Vector map drawn on canvas: coast, borders, rivers, highways, city streets, labels, route and timeline lines.
   Pins and the location dot are HTML buttons laid over the canvas. Web Mercator, no tiles, no network. */
'use strict';
window.MapView = (() => {
  const G = window.GEO, CD = window.CITYDETAIL;
  const RAD = Math.PI / 180;
  const merc = lat => Math.log(Math.tan(Math.PI / 4 + lat * RAD / 2)) / RAD;
  const imerc = y => (2 * Math.atan(Math.exp(y * RAD)) - Math.PI / 2) / RAD;
  const C = {
    land: '#f4f2ee', urban: '#ebe8e3', water: '#f49fec', waterLabel: '#b53a9f', park: '#bdcfe5', forest: '#d6e4ed',
    hwy: '#84fdb4', hwyCase: '#47ea7d', art: '#ffffff', artCase: '#d6d3cd', minor: '#ffffff', border: '#9a9ea3', borderHalo: '#e7e4df',
    label: '#3c4043', label2: '#5f6368', halo: 'rgba(255,255,255,.92)', route: '#f442c0', routeCase: '#d61a9a', alt: '#f4b4de', altCase: '#de8ac3',
    tl: '#f442c0'
  };
  const MUTED = { land: '#f1f1f1', urban: '#e6e6e6', water: '#e4c4e1', park: '#dbe7d8', forest: '#e7ede4', hwy: '#e9e9e9', hwyCase: '#cfcfcf' };
  const cityById = Object.fromEntries(G.cities.map(c => [c.id, c]));
  const kmToLL = (city, x, y) => [city.lon + x / (111.32 * Math.cos(city.lat * RAD)), city.lat + y / 110.57];
  const hash = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const toW = ([lon, lat]) => [lon, merc(lat)];
  const haversine = (a, b) => { const dLat = (b[1] - a[1]) * RAD, dLon = (b[0] - a[0]) * RAD; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dLon / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };

  /* ---------- static geometry in world coords ---------- */
  const W_sea = G.sea.map(toW), W_islands = G.islands.map(p => p.map(toW)), W_borders = G.borders.map(p => p.map(toW));
  const W_rivers = G.rivers.map(([n, w, p]) => ({ n, w, p: p.map(toW) })), W_greens = G.greens.map(p => p.map(toW));
  // highways with a gentle deterministic wobble; each edge keeps its lon/lat points for routing distance
  const edges = G.roads.map(([a, b, name]) => {
    const A = cityById[a], B = cityById[b], r = rng(hash(a + b)), n = 7, pts = [];
    const dx = B.lon - A.lon, dy = B.lat - A.lat, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
    const amp = Math.min(0.35, len * 0.06), ph = r() * 6.28;
    for (let i = 0; i <= n; i++) { const t = i / n, w = (i === 0 || i === n) ? 0 : Math.sin(t * Math.PI) * (Math.sin(t * 9 + ph) * 0.5 + (r() - 0.5) * 0.6) * amp; pts.push([A.lon + dx * t + nx * w, A.lat + dy * t + ny * w]); }
    let km = 0; for (let i = 1; i < pts.length; i++) km += haversine(pts[i - 1], pts[i]);
    return { a, b, name, ll: pts, w: pts.map(toW), km: km * 1.12 };
  });
  const adj = {}; edges.forEach((e, i) => { (adj[e.a] = adj[e.a] || []).push(i); (adj[e.b] = adj[e.b] || []).push(i); });
  function route(from, to, ban) {
    if (from === to) return { km: 0, ll: [[cityById[from].lon, cityById[from].lat]], via: [], names: [], eis: [] };
    const dist = { [from]: 0 }, prev = {}, done = new Set(), q = [from];
    while (q.length) {
      q.sort((x, y) => dist[x] - dist[y]); const u = q.shift(); if (done.has(u)) continue; done.add(u); if (u === to) break;
      for (const ei of adj[u] || []) { if (ban && ban.has(ei)) continue; const e = edges[ei], v = e.a === u ? e.b : e.a, d = dist[u] + e.km; if (dist[v] === undefined || d < dist[v]) { dist[v] = d; prev[v] = [u, ei]; q.push(v); } }
    }
    if (dist[to] === undefined) return null;
    const chain = []; let v = to; while (v !== from) { const [u, ei] = prev[v]; chain.unshift([u, v, ei]); v = u; }
    let ll = [], names = []; const via = [];
    chain.forEach(([u, v, ei], k) => { const e = edges[ei]; const pts = e.a === u ? e.ll : e.ll.slice().reverse(); ll = ll.concat(k ? pts.slice(1) : pts); if (e.name && !names.includes(e.name)) names.push(e.name); if (k < chain.length - 1) via.push(cityById[v].name); });
    return { km: dist[to], ll, via, names, eis: chain.map(c => c[2]) };
  }

  /* ---------- city detail (built lazily) ---------- */
  const built = {};
  function blob(city, R, seed, k = 0.18) { const r = rng(seed), pts = [], ph = [r() * 6, r() * 6, r() * 6]; for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, rr = R * (1 + k * Math.sin(a * 2 + ph[0]) + k * 0.6 * Math.sin(a * 3 + ph[1]) + k * 0.4 * Math.sin(a * 5 + ph[2])); pts.push(toW(kmToLL(city, Math.cos(a) * rr, Math.sin(a) * rr))); } return pts; }
  function buildCity(id) {
    if (built[id]) return built[id];
    const city = cityById[id]; const def = CD[id] || { r: city.rank === 1 ? 12 : city.rank === 2 ? 8 : 5, rot: (hash(id) % 100) / 100 - 0.5, water: [], lakes: [], parks: [], arterials: [], labels: [] };
    const r = rng(hash(id + 'grid')), R = def.r, L = (x, y) => toW(kmToLL(city, x, y));
    const urban = blob(city, R * 0.95, hash(id), 0.26);
    const edgeR = a => R * 0.9 * (1 + 0.24 * Math.sin(a * 2 + 1.3) + 0.12 * Math.sin(a * 5 + 0.4) + 0.06 * Math.sin(a * 9));
    const minor = [];
    // districts: each patch of the city has its own street angle and block size, like real Indian cities
    const nD = Math.max(6, Math.round(R * 1.1)), D = [];
    for (let k = 0; k < nD; k++) { const a = r() * 6.283, d = Math.sqrt(r()) * R * 0.85; D.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, rot: def.rot + (r() - 0.5) * 1.1, sp: 0.26 + r() * 0.22 }); }
    D.push({ x: 0, y: 0, rot: def.rot + 0.62, sp: 0.16 });
    const owner = (x, y) => { let b = 0, bd = 1e9; D.forEach((d, i) => { const w = i === D.length - 1 ? 0.55 : 1; const dd = Math.hypot(x - d.x, y - d.y) * w; if (dd < bd) { bd = dd; b = i; } }); return b; };
    D.forEach((d, di) => {
      const ux = Math.cos(d.rot), uy = Math.sin(d.rot), vx = -uy, vy = ux, ext = R * 0.75, N = Math.ceil(ext / d.sp);
      for (const dir of [0, 1]) for (let i = -N; i <= N; i++) {
        const off = i * d.sp + (r() - 0.5) * d.sp * 0.35; let cur = [];
        const ax = dir ? vx : ux, ay = dir ? vy : uy, bx = dir ? ux : vx, by = dir ? uy : vy;
        for (let t = -ext; t <= ext; t += d.sp * 0.5) {
          const x = d.x + ax * t + bx * off + Math.sin(t * 1.3 + i) * 0.05, y = d.y + ay * t + by * off + Math.cos(t * 1.1 + i) * 0.05;
          const inside = Math.hypot(x, y) < edgeR(Math.atan2(y, x)) && owner(x, y) === di && !(r() < 0.06);
          if (inside) cur.push(L(x, y)); else { if (cur.length > 1) minor.push(cur); cur = []; }
        }
        if (cur.length > 1) minor.push(cur);
      }
    });
    const radial = []; // generic arterials for cities without hand-drawn ones
    if (!def.arterials.length) for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + def.rot; radial.push(['', [[0, 0], [Math.cos(a + 0.1) * R * 0.5, Math.sin(a + 0.1) * R * 0.5], [Math.cos(a) * R, Math.sin(a) * R]]]); }
    const art = def.arterials.concat(radial).map(([n, p]) => ({ n, p: p.map(([x, y]) => L(x, y)) }));
    if (!def.arterials.length) { const ring = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2; ring.push(L(Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.5)); } art.push({ n: '', p: ring }); }
    const out = {
      city, def, urban, minor, art,
      water: def.water.map(w => ({ n: w.name, w: w.w, p: w.pts.map(([x, y]) => L(x, y)) })),
      lakes: def.lakes.map(([x, y, rx, ry, n]) => { const pts = []; for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2, j = 1 + 0.12 * Math.sin(a * 3 + x); pts.push(L(x + Math.cos(a) * rx * j, y + Math.sin(a) * ry * j)); } return { n, pts, c: L(x, y) }; }),
      parks: def.parks.map(p => p.map(([x, y]) => L(x, y))),
      labels: def.labels.map(([n, x, y, w]) => ({ n, w, p: L(x, y) })),
      zones: null
    };
    if (def.zones && def.zones.kind === 'markets') out.zones = { kind: 'markets', picked: def.zones.picked.map(([n, x, y]) => ({ n, p: L(x, y) })), others: def.zones.others.map(([x, y]) => L(x, y)) };
    if (def.zones && def.zones.kind === 'zones') {
      // seven delivery zones as hexagon-like cells around the Ravenmoor pin; shape only
      const cells = [[0.9, -2.2], [3.4, -1.0], [-1.6, -0.9], [-1.4, -3.6], [1.2, -4.8], [3.6, -3.7], [0.9, 0.3]];
      out.zones = { kind: 'zones', cells: cells.map(([x, y], i) => { const pts = []; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + 0.3; pts.push(L(x + Math.cos(a) * 1.45, y + Math.sin(a) * 1.3)); } return { pts, c: L(x, y), losing: i === 5 || i === 6, n: 'Zone ' + (i + 1) }; }) };
    }
    built[id] = out; return out;
  }

  /* ---------- the view ---------- */
  function create(canvas, overlay, opts = {}) {
    const ctx = canvas.getContext('2d');
    const V = { cx: 78.5, cy: merc(21), s: 40, W: 0, H: 0, dpr: 1, pad: { l: 0, r: 0, t: 0, b: 0 } };
    const layers = { pins: true, zones: true, timeline: false, muted: false, highways: true };
    let routeState = null, tlState = null, extraCities = new Set(), labelBoxes = [], dirty = true, anim = null, raf = 0, filterNeed = null;
    const markers = [];
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const SMIN = 12, SMAX = 26000;
    const col = k => (layers.muted && MUTED[k]) || C[k];

    function resize() {
      const r = canvas.parentElement.getBoundingClientRect(); V.W = r.width; V.H = r.height; V.dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.round(V.W * V.dpr); canvas.height = Math.round(V.H * V.dpr); canvas.style.width = V.W + 'px'; canvas.style.height = V.H + 'px'; invalidate();
    }
    const sx = X => (X - V.cx) * V.s + V.W / 2, sy = Y => (V.cy - Y) * V.s + V.H / 2;
    const project = (lon, lat) => [sx(lon), sy(merc(lat))];
    const unproject = (x, y) => [V.cx + (x - V.W / 2) / V.s, imerc(V.cy - (y - V.H / 2) / V.s)];
    function clamp() { V.s = Math.max(SMIN, Math.min(SMAX, V.s)); V.cx = Math.max(60, Math.min(98, V.cx)); V.cy = Math.max(merc(3), Math.min(merc(33), V.cy)); }
    function invalidate() { dirty = true; if (!raf) raf = requestAnimationFrame(frame); }
    function frame(t) {
      raf = 0;
      if (anim) { const k = Math.min(1, (t - anim.t0) / anim.dur); anim.step(k); dirty = true; if (k >= 1) { const a = anim; anim = null; a.done && a.done(); } }
      if (routeState && routeState.p < 1) { routeState.p = reduced ? 1 : Math.min(1, (t - (routeState.t0 || (routeState.t0 = t))) / 2400); dirty = true; }
      if (tlState && tlState.p < 1) { tlState.p = reduced ? 1 : Math.min(1, (t - (tlState.t0 || (tlState.t0 = t))) / 2600); dirty = true; }
      if (dirty) { dirty = false; draw(); }
      if (anim || (routeState && routeState.p < 1) || (tlState && tlState.p < 1)) raf = requestAnimationFrame(frame);
    }

    /* drawing helpers */
    function path(pts, close) { ctx.beginPath(); for (let i = 0; i < pts.length; i++) { const x = sx(pts[i][0]), y = sy(pts[i][1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } if (close) ctx.closePath(); }
    function poly(pts, fill) { path(pts, true); ctx.fillStyle = fill; ctx.fill(); }
    function line(pts, w, color, dash) { path(pts); ctx.lineWidth = w; ctx.strokeStyle = color; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]); }
    function onScreen(pts, m = 60) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of pts) { const x = sx(p[0]), y = sy(p[1]); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return x1 > -m && x0 < V.W + m && y1 > -m && y0 < V.H + m; }
    function text(str, x, y, o = {}) {
      ctx.font = o.font || '400 12px Roboto, sans-serif'; ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
      const w = ctx.measureText(str).width + (o.ls ? o.ls * str.length : 0), h = parseInt((o.font || '12px').match(/(\d+)px/)[1], 10) + 4;
      const bx = o.align === 'left' ? x : x - w / 2, box = [bx - 3, y - h / 2, bx + w + 3, y + h / 2];
      if (!o.force && labelBoxes.some(b => b[0] < box[2] && b[2] > box[0] && b[1] < box[3] && b[3] > box[1])) return false;
      if (box[2] < 0 || box[0] > V.W || box[3] < 0 || box[1] > V.H) return false;
      if (o.ls) ctx.letterSpacing = o.ls + 'px';
      ctx.lineJoin = 'round'; ctx.lineWidth = o.halo || 3; ctx.strokeStyle = C.halo; ctx.strokeText(str, x, y); ctx.fillStyle = o.color || C.label; ctx.fillText(str, x, y);
      if (o.ls) ctx.letterSpacing = '0px';
      box.push(o.id || null); labelBoxes.push(box); return true;
    }
    function polylineLength(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(sx(pts[i][0]) - sx(pts[i - 1][0]), sy(pts[i][1]) - sy(pts[i - 1][1])); return L; }
    function partial(pts, frac) { // screen-space prefix of a world polyline
      const total = polylineLength(pts), want = total * frac, out = []; let acc = 0;
      for (let i = 0; i < pts.length; i++) { const x = sx(pts[i][0]), y = sy(pts[i][1]); if (!i) { out.push([x, y]); continue; } const px = out[out.length - 1]; const seg = Math.hypot(x - sx(pts[i - 1][0]), y - sy(pts[i - 1][1])); if (acc + seg >= want) { const k = seg ? (want - acc) / seg : 0; out.push([sx(pts[i - 1][0]) + (x - sx(pts[i - 1][0])) * k, sy(pts[i - 1][1]) + (y - sy(pts[i - 1][1])) * k]); return out; } acc += seg; out.push([x, y]); }
      return out;
    }
    function sline(pts, w, color, dash) { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.lineWidth = w; ctx.strokeStyle = color; ctx.setLineDash(dash || []); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.setLineDash([]); }

    function draw() {
      const s = V.s, d = V.dpr; ctx.setTransform(d, 0, 0, d, 0, 0); labelBoxes = [];
      ctx.fillStyle = col('land'); ctx.fillRect(0, 0, V.W, V.H); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      // country-scale land cover
      if (s < 900) W_greens.forEach(p => { if (onScreen(p)) poly(p, col('forest')); });
      // urban areas
      const detailIds = new Set();
      G.cities.forEach(c => {
        const [x, y] = project(c.lon, c.lat), rKm = c.rank === 1 ? 14 : c.rank === 2 ? 9 : 5, rPx = rKm / 111 * s;
        if (x < -rPx * 2 - 50 || x > V.W + rPx * 2 + 50 || y < -rPx * 2 - 50 || y > V.H + rPx * 2 + 50) return;
        if (s > 70 && (CD[c.id] || extraCities.has(c.id) || s > 600)) { const b = buildCity(c.id); poly(b.urban, col('urban')); detailIds.add(c.id); }
        else if (s > 45 && rPx > 2) { ctx.beginPath(); ctx.arc(x, y, Math.max(2, rPx), 0, Math.PI * 2); ctx.fillStyle = col('urban'); ctx.fill(); }
      });
      // city-scale parks and water under the sea pass
      if (s > 350) detailIds.forEach(id => { const b = buildCity(id); b.parks.forEach(p => poly(p, col('park'))); });
      // sea
      poly(W_sea, col('water')); W_islands.forEach(p => poly(p, col('land')));
      // rivers
      const cityRiv = new Set(); if (s > 350) detailIds.forEach(id => buildCity(id).water.forEach(w => cityRiv.add(w.n.split(' ')[0])));
      W_rivers.forEach(r => { if (!onScreen(r.p) || cityRiv.has(r.n)) return; line(r.p, Math.min(5, r.w * (0.5 + s / 90)), col('water')); });
      if (s > 350) detailIds.forEach(id => { const b = buildCity(id); b.water.forEach(w => line(w.p, Math.max(2, w.w / 111 * s), col('water'))); b.lakes.forEach(l => poly(l.pts, col('water'))); });
      // borders
      W_borders.forEach(b => { if (!onScreen(b)) return; line(b, 5, C.borderHalo); line(b, 1.3, C.border, s > 200 ? [6, 4] : []); });
      // minor streets and arterials
      if (s > 1700) { const a = Math.min(1, (s - 1700) / 1500); ctx.globalAlpha = a; detailIds.forEach(id => buildCity(id).minor.forEach(p => { if (onScreen(p, 0)) line(p, s > 9000 ? 3.2 : s > 5000 ? 2 : 1.2, C.minor); })); ctx.globalAlpha = 1; }
      if (s > 300) { const w = s > 4000 ? 6 : s > 1500 ? 4.2 : 2.6; detailIds.forEach(id => { const b = buildCity(id); b.art.forEach(r => line(r.p, w + 1.6, col('urban') === MUTED.urban ? '#d5d5d5' : C.artCase)); b.art.forEach(r => line(r.p, w, C.art)); }); }
      // highways
      if (layers.highways) {
        const hw = s < 45 ? 0.9 : s < 120 ? 1.6 : s < 600 ? 3 : s < 3000 ? 4.6 : 6.5;
        edges.forEach(e => { if (onScreen(e.w)) line(e.w, hw + (s < 45 ? 0.8 : 1.6), col('hwyCase')); });
        edges.forEach(e => { if (onScreen(e.w)) line(e.w, hw, col('hwy')); });
      }
      // zones layer: Thistledown markets and Ravenmoor delivery zones
      if (layers.zones && s > 900) detailIds.forEach(id => {
        const z = buildCity(id).zones; if (!z) return;
        if (z.kind === 'markets') {
          z.others.forEach(p => { ctx.beginPath(); ctx.arc(sx(p[0]), sy(p[1]), Math.max(5, 0.45 / 111 * s), 0, 7); ctx.fillStyle = 'rgba(95,99,104,.10)'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(95,99,104,.45)'; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]); });
          z.picked.forEach(m => { ctx.beginPath(); ctx.arc(sx(m.p[0]), sy(m.p[1]), Math.max(8, 0.55 / 111 * s), 0, 7); ctx.fillStyle = 'rgba(232,26,184,.16)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(232,26,184,.75)'; ctx.stroke(); });
        } else z.cells.forEach(c => { poly(c.pts, c.losing ? 'rgba(86,217,37,.16)' : 'rgba(232,26,184,.10)'); line(c.pts.concat([c.pts[0]]), 1.6, c.losing ? 'rgba(86,217,37,.8)' : 'rgba(232,26,184,.55)'); });
      });
      // timeline path
      if (tlState) drawTimeline();
      // route
      if (routeState) drawRoute();
      // labels
      drawLabels(detailIds);
      updateMarkers();
      opts.onDraw && opts.onDraw(V);
    }
    function drawRoute() {
      const R = routeState;
      R.alts.forEach(a => { const pts = a.w.map(p => [sx(p[0]), sy(p[1])]); sline(pts, 9, C.altCase); sline(pts, 6, C.alt); });
      const pts = partial(R.w, R.p);
      sline(pts, 10, C.routeCase); sline(pts, 6.5, C.route);
      if (R.focus) { const f = R.focus.map(p => [sx(p[0]), sy(p[1])]); sline(f, 10, '#910b6a'); sline(f, 6.5, '#e81ab8'); }
      // stop markers: white circles with dark ring, like waypoints
      R.stops.forEach((st, i) => { if (R.p < st.at - 0.001 && !reduced) return; const x = sx(st.w[0]), y = sy(st.w[1]); ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#1f1f1f'; ctx.stroke(); });
      if (R.p < 1) { const h = pts[pts.length - 1]; ctx.beginPath(); ctx.arc(h[0], h[1], 7, 0, 7); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = C.route; ctx.stroke(); }
      // ETA bubbles
      if (R.p >= 1) R.bubbles.forEach(b => bubble(sx(b.w[0]), sy(b.w[1]), b.t, b.sub, b.main));
    }
    function bubble(x, y, t, sub, main) {
      ctx.font = '500 13px "Atlas Sans", Roboto, sans-serif'; const w1 = ctx.measureText(t).width; ctx.font = '400 11px Roboto, sans-serif'; const w2 = sub ? ctx.measureText(sub).width : 0;
      const w = Math.max(w1, w2) + 20, h = sub ? 38 : 26, bx = x - w / 2, by = y - h - 12;
      if (!main && labelBoxes.some(q => q[0] < bx + w && q[2] > bx && q[1] < by + h + 8 && q[3] > by)) return;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 1;
      ctx.beginPath(); ctx.roundRect(bx, by, w, h, 8); ctx.moveTo(x - 7, by + h); ctx.lineTo(x, by + h + 8); ctx.lineTo(x + 7, by + h); ctx.fillStyle = main ? '#ffffff' : '#ffffff'; ctx.fill(); ctx.restore();
      if (main) { ctx.lineWidth = 2; ctx.strokeStyle = C.route; ctx.beginPath(); ctx.roundRect(bx, by, w, h, 8); ctx.stroke(); }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = main ? '#181b80' : '#444746'; ctx.font = '500 13px "Atlas Sans", Roboto, sans-serif'; ctx.fillText(t, x, by + (sub ? 13 : h / 2));
      if (sub) { ctx.fillStyle = '#5f6368'; ctx.font = '400 11px Roboto, sans-serif'; ctx.fillText(sub, x, by + 27); }
      labelBoxes.push([bx, by, bx + w, by + h + 8, null]);
    }
    function drawTimeline() {
      const T = tlState; let budget = T.p * T.segs.length;
      T.segs.forEach((sg, i) => {
        if (budget <= 0) return; const frac = Math.min(1, budget); budget -= 1;
        const pts = partial(sg.w, frac), on = T.active == null || T.active === sg.idx;
        ctx.globalAlpha = on ? 1 : 0.35;
        if (sg.kind === 'playbook') sline(pts, 3, '#ff4d59', [2, 7]);
        else { sline(pts, 7, '#c01590'); sline(pts, 4.5, sg.kind === 'move' ? '#f442c0' : '#343ca8'); }
        ctx.globalAlpha = 1;
      });
      T.visits.forEach(v => { const on = T.active == null || T.active === v.idx; const x = sx(v.w[0]), y = sy(v.w[1]); ctx.beginPath(); ctx.arc(x, y, on ? 7 : 5, 0, 7); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = on ? '#e81ab8' : '#9aa0a6'; ctx.stroke(); });
    }
    function drawLabels(detailIds) {
      const s = V.s;
      // pin labels first so they win collisions (they are HTML, so reserve their boxes)
      markers.forEach(m => { if (m.box) labelBoxes.push(m.box); });
      if (s < 150) G.countryLabels.forEach(([n, lon, lat, k]) => {
        const [x, y] = project(lon, lat);
        if (k === 'country') text(n === 'India' ? 'INDIA' : n, x, y, { font: n === 'India' ? '500 17px "Atlas Sans", Roboto, sans-serif' : '500 13px Roboto, sans-serif', color: n === 'India' ? '#5f6368' : '#70757a', ls: n === 'India' ? 4 : 0 });
        else text(n, x, y, { font: 'italic 400 14px Roboto, sans-serif', color: C.waterLabel, halo: 2 });
      });
      // road shields
      if (layers.highways && s > 55 && s < 1600) { const seen = {}; edges.forEach(e => { if (!e.name || seen[e.name + Math.round(e.ll[3][0])]) return; const m = e.w[3], x = sx(m[0]), y = sy(m[1]); if (x < 0 || x > V.W || y < 0 || y > V.H) return; seen[e.name + Math.round(e.ll[3][0])] = 1; shield(x, y, e.name.replace('NH', '')); }); }
      // neighbourhoods, lakes and road names inside detailed cities
      if (s > 1100) detailIds.forEach(id => {
        const b = buildCity(id);
        b.labels.forEach(l => { const big = l.w >= 3; if (s < 2600 && l.w < 2) return; text(big ? l.n : l.n.toUpperCase(), sx(l.p[0]), sy(l.p[1]), { font: big ? '500 13px Roboto, sans-serif' : '500 10.5px Roboto, sans-serif', color: big ? '#3c4043' : '#70757a', ls: big ? 0 : 0.8 }); });
        b.lakes.forEach(l => l.n && s > 2200 && text(l.n, sx(l.c[0]), sy(l.c[1]), { font: 'italic 400 11px Roboto, sans-serif', color: C.waterLabel, halo: 2 }));
        b.water.forEach(w => { if (s < 2000) return; const m = w.p[Math.floor(w.p.length / 2)]; text(w.n, sx(m[0]) + 8, sy(m[1]), { font: 'italic 400 11px Roboto, sans-serif', color: C.waterLabel, halo: 2 }); });
        if (s > 3000) b.art.forEach(r => { if (!r.n) return; roadName(r.n, r.p); });
        if (layers.zones && b.zones && s > 1400) {
          if (b.zones.kind === 'markets') b.zones.picked.forEach((m, i) => text(`${i + 1}`, sx(m.p[0]), sy(m.p[1]), { font: '700 11px Roboto, sans-serif', color: '#e81ab8', force: true, halo: 3 }));
          else b.zones.cells.forEach(c => text(c.n, sx(c.c[0]), sy(c.c[1]) + 16, { font: '500 10px Roboto, sans-serif', color: c.losing ? '#53c51f' : '#d219a5', halo: 2 }));
        }
      });
      // cities, biggest first
      const minRank = s < 30 ? 1 : s < 48 ? 2 : s < 110 ? 3 : 4;
      G.cities.slice().sort((a, b) => a.rank - b.rank).forEach(c => {
        if (c.rank > minRank) return; const [x, y] = project(c.lon, c.lat);
        const big = c.rank === 1, hl = opts.highlightCities && opts.highlightCities().has(c.id);
        if (s < 900) { ctx.beginPath(); ctx.arc(x, y, big ? 3.4 : 2.6, 0, 7); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = hl ? '#e81ab8' : '#80868b'; ctx.stroke(); }
        const yOff = s < 900 ? -11 : 0;
        text(c.name, x, y + yOff, { font: `${big || hl ? 500 : 400} ${big ? 14 : s > 900 ? 15 : 12.5}px Roboto, sans-serif`, color: hl ? '#d219a5' : big ? '#202124' : '#3c4043', id: c.id, force: hl });
      });
      if (s > 40 && s < 600) G.foreign.forEach(([n, lon, lat]) => { const [x, y] = project(lon, lat); text(n, x, y - 10, { font: '400 11.5px Roboto, sans-serif', color: '#70757a' }); });
    }
    function shield(x, y, n) {
      ctx.font = '700 10px Roboto, sans-serif'; const w = ctx.measureText(n).width + 10, box = [x - w / 2, y - 8, x + w / 2, y + 8];
      if (labelBoxes.some(b => b[0] < box[2] && b[2] > box[0] && b[1] < box[3] && b[3] > box[1])) return;
      ctx.beginPath(); ctx.roundRect(x - w / 2, y - 8, w, 16, 3); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = '#2ec966'; ctx.stroke();
      ctx.fillStyle = '#165f32'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(n, x, y + 0.5); labelBoxes.push(box.concat(null));
    }
    function roadName(n, pts) {
      // place along the longest on-screen segment, rotated to the road
      let best = null, bl = 0; for (let i = 1; i < pts.length; i++) { const a = [sx(pts[i - 1][0]), sy(pts[i - 1][1])], b = [sx(pts[i][0]), sy(pts[i][1])]; const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; if (mx < 30 || mx > V.W - 30 || my < 30 || my > V.H - 30) continue; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l > bl) { bl = l; best = [a, b]; } }
      if (!best) return; ctx.font = '400 11px Roboto, sans-serif'; const tw = ctx.measureText(n).width; if (bl < tw + 20) return;
      const [a, b] = best; let ang = Math.atan2(b[1] - a[1], b[0] - a[0]); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, box = [mx - tw / 2 - 4, my - 9, mx + tw / 2 + 4, my + 9];
      if (labelBoxes.some(q => q[0] < box[2] && q[2] > box[0] && q[1] < box[3] && q[3] > box[1])) return;
      ctx.save(); ctx.translate(mx, my); ctx.rotate(ang); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = C.halo; ctx.strokeText(n, 0, 0); ctx.fillStyle = '#5f6368'; ctx.fillText(n, 0, 0); ctx.restore();
      labelBoxes.push(box.concat(null));
    }

    /* ---------- markers (HTML) ---------- */
    function addMarker(m) { markers.push(m); overlay.appendChild(m.el); invalidate(); return m; }
    function updateMarkers() {
      const pts = markers.filter(m => m.kind === 'pin').map(m => { const [x, y] = project(m.lon, m.lat); return { m, x, y }; });
      // cluster pins closer than 34px
      const used = new Set(), groups = [];
      pts.forEach(p => { if (used.has(p)) return; const g = [p]; used.add(p); pts.forEach(q => { if (!used.has(q) && Math.hypot(q.x - p.x, q.y - p.y) < 34) { g.push(q); used.add(q); } }); groups.push(g); });
      groups.forEach(g => {
        const visible = g.filter(p => layers.pins && (!filterNeed || p.m.need === filterNeed));
        g.forEach((p, i) => { const show = visible.includes(p) && (visible.length === 1 || p === visible[0]); p.m.el.style.transform = `translate(${p.x}px, ${p.y}px)`; p.m.el.hidden = !show; p.m.el.classList.toggle('cluster', show && visible.length > 1); p.m.el.querySelector('.pin-n').textContent = visible.length; p.m.cluster = visible.length > 1 ? visible.map(v => v.m) : null; const lab = visible.length > 1 ? (p.m.group || '') : p.m.short; if (show && p.m._lab !== lab) { p.m.el.querySelector('.pin-lab').textContent = lab; p.m._lab = lab; } p.m.box = show ? [p.x - 14, p.y - 40, p.x + 22 + lab.length * 7.4, p.y, null] : null; });
      });
      // separate overlapping pin labels: flip a label to the left of its pin, else hide it (the pin stays)
      const shown = pts.filter(p => !p.m.el.hidden).sort((a, b) => a.x - b.x);
      const hit = (b, list) => list.some(q => q[0] < b[2] && q[2] > b[0] && q[1] < b[3] && q[3] > b[1]);
      const pinBoxes = shown.map(p => [p.x - 14, p.y - 42, p.x + 14, p.y, p]);
      const placed = [];
      shown.forEach(p => {
        const lab = p.m.el.querySelector('.pin-lab'); if (p.m._wl !== p.m._lab) { p.m._w = lab.offsetWidth || (p.m._lab || '').length * 7.4; p.m._wl = p.m._lab; }
        const w = p.m._w, others = pinBoxes.filter(b => b[4] !== p);
        const R = [p.x + 14, p.y - 31, p.x + 18 + w, p.y - 13], Lf = [p.x - 18 - w, p.y - 31, p.x - 14, p.y - 13];
        let side = 'r';
        if (hit(R, placed) || hit(R, others)) side = !hit(Lf, placed) && !hit(Lf, others) ? 'l' : 'none';
        p.m.el.classList.toggle('lab-l', side === 'l'); p.m.el.classList.toggle('nolabel', side === 'none');
        if (side !== 'none') placed.push(side === 'l' ? Lf : R);
        p.m.box = side === 'l' ? [Lf[0], p.y - 40, p.x + 14, p.y, null] : side === 'none' ? [p.x - 14, p.y - 40, p.x + 14, p.y, null] : p.m.box;
      });
      markers.filter(m => m.kind !== 'pin').forEach(m => { const [x, y] = project(m.lon, m.lat); m.el.style.transform = `translate(${x}px, ${y}px)`; });
    }

    /* ---------- camera ---------- */
    function setView(lon, lat, s) { V.cx = lon; V.cy = merc(lat); V.s = s; clamp(); invalidate(); }
    function boundsView(lls, pad) {
      const P = Object.assign({ l: 40, r: 40, t: 90, b: 60 }, V.pad, pad || {});
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; lls.forEach(([lon, lat]) => { const y = merc(lat); x0 = Math.min(x0, lon); x1 = Math.max(x1, lon); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
      const w = Math.max(V.W - P.l - P.r, 80), h = Math.max(V.H - P.t - P.b, 80);
      const s = Math.min(SMAX * 0.5, w / Math.max(x1 - x0, 0.02), h / Math.max(y1 - y0, 0.02));
      const cx = (x0 + x1) / 2 - (P.l - P.r) / 2 / s, cy = (y0 + y1) / 2 + (P.t - P.b) / 2 / s;
      return { cx, cy, s };
    }
    function flyTo(target, dur) {
      const from = { cx: V.cx, cy: V.cy, s: V.s }, to = target;
      if (reduced || dur === 0) { V.cx = to.cx; V.cy = to.cy; V.s = to.s; clamp(); invalidate(); return Promise.resolve(); }
      const d = Math.hypot(to.cx - from.cx, to.cy - from.cy), sFit = (V.W * 0.7) / Math.max(d, 1e-6);
      const l0 = Math.log(from.s), l1 = Math.log(to.s), lm = Math.min(l0, l1, Math.log(Math.max(sFit, SMIN)));
      const bump = Math.max(0, Math.min(l0, l1) - lm);
      const D = dur || Math.min(1800, 700 + bump * 260);
      return new Promise(res => {
        anim = { t0: performance.now(), dur: D, done: res, step: k => {
          const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
          V.s = Math.exp(l0 + (l1 - l0) * e - bump * Math.sin(Math.PI * e));
          // move centre in step with zoom so the target slides in smoothly
          V.cx = from.cx + (to.cx - from.cx) * e; V.cy = from.cy + (to.cy - from.cy) * e; clamp();
        } };
        invalidate();
      });
    }
    const flyToLL = (lls, pad, dur) => flyTo(boundsView(lls, pad), dur);
    function zoomBy(f, ax, ay) {
      ax = ax ?? (V.W + V.pad.l - V.pad.r) / 2; ay = ay ?? V.H / 2;
      const [lon, lat] = unproject(ax, ay), Y = merc(lat), ns = Math.max(SMIN, Math.min(SMAX, V.s * f));
      V.cx = lon - (ax - V.W / 2) / ns; V.cy = Y + (ay - V.H / 2) / ns; V.s = ns; clamp(); invalidate();
    }
    function zoomAnimated(f) { if (reduced) return zoomBy(f); const ax = (V.W + V.pad.l - V.pad.r) / 2, ay = V.H / 2, [lon, lat] = unproject(ax, ay); const ns = Math.max(SMIN, Math.min(SMAX, V.s * f)); flyTo({ cx: lon - (ax - V.W / 2) / ns, cy: merc(lat) + (ay - V.H / 2) / ns, s: ns }, 320); }
    function panBy(dx, dy) { V.cx -= dx / V.s; V.cy += dy / V.s; clamp(); invalidate(); }

    /* ---------- input ---------- */
    const ptrs = new Map(); let drag = null, moved = 0, lastTap = 0;
    canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.offsetX, e.offsetY]); anim = null; moved = 0; drag = { x: e.offsetX, y: e.offsetY }; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; drag.pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } canvas.classList.add('grabbing'); });
    canvas.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId)) { hover(e); return; }
      ptrs.set(e.pointerId, [e.offsetX, e.offsetY]);
      if (ptrs.size === 2 && drag && drag.pinch) { const [a, b] = [...ptrs.values()]; const dd = Math.hypot(a[0] - b[0], a[1] - b[1]); zoomBy(dd / drag.pinch, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); drag.pinch = dd; moved += 10; return; }
      if (ptrs.size === 1 && drag) { const dx = e.offsetX - drag.x, dy = e.offsetY - drag.y; moved += Math.abs(dx) + Math.abs(dy); panBy(dx, dy); drag.x = e.offsetX; drag.y = e.offsetY; }
    });
    const up = e => {
      ptrs.delete(e.pointerId); canvas.classList.remove('grabbing');
      if (!ptrs.size) { if (moved < 6 && drag) click(e.offsetX, e.offsetY, e.pointerType); drag = null; }
      else { const [p] = [...ptrs.values()]; drag = { x: p[0], y: p[1] }; }
    };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); drag = null; canvas.classList.remove('grabbing'); });
    canvas.addEventListener('wheel', e => { e.preventDefault(); anim = null; const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022)); zoomBy(f, e.offsetX, e.offsetY); }, { passive: false });
    canvas.addEventListener('dblclick', e => { e.preventDefault(); });
    function hitCity(x, y) { const b = labelBoxes.find(b => b[4] && x >= b[0] - 6 && x <= b[2] + 6 && y >= b[1] - 10 && y <= b[3] + 6); return b ? b[4] : null; }
    function hover(e) { const id = hitCity(e.offsetX, e.offsetY); canvas.classList.toggle('pointing', !!id); }
    function click(x, y, type) {
      const now = performance.now();
      if (now - lastTap < 300) { lastTap = 0; zoomBy(2, x, y); return; }
      lastTap = now;
      const id = hitCity(x, y); if (id && opts.onCity) { opts.onCity(id); return; }
      opts.onMapClick && opts.onMapClick(unproject(x, y));
    }

    /* ---------- route + timeline API ---------- */
    function setRoute(r) {
      if (!r) { routeState = null; invalidate(); return; }
      routeState = { w: r.ll.map(toW), alts: (r.alts || []).map(a => ({ w: a.map(toW) })), p: r.animate === false ? 1 : 0, stops: r.stops.map(s => ({ w: toW(s.ll), at: s.at })), bubbles: (r.bubbles || []).map(b => ({ w: toW(b.ll), t: b.t, sub: b.sub, main: b.main })), focus: null };
      invalidate(); if (!raf) raf = requestAnimationFrame(frame);
    }
    function focusRoute(ll) { if (routeState) { routeState.focus = ll ? ll.map(toW) : null; invalidate(); } }
    function setTimeline(t) { tlState = t ? { segs: t.segs.map(s => ({ ...s, w: s.ll.map(toW) })), visits: t.visits.map(v => ({ ...v, w: toW(v.ll) })), p: t.animate === false ? 1 : 0, active: null } : null; invalidate(); }
    function timelineActive(i) { if (tlState) { tlState.active = i; invalidate(); } }

    addEventListener('resize', resize); resize();
    if (document.fonts) document.fonts.ready.then(invalidate);
    return {
      V, layers, project, unproject, setView, flyTo, flyToLL, boundsView, zoomBy, zoomAnimated, panBy, invalidate, addMarker, setRoute, focusRoute, setTimeline, timelineActive,
      setPad(p) { V.pad = Object.assign({ l: 0, r: 0, t: 0, b: 0 }, p); },
      setFilter(n) { filterNeed = n; invalidate(); }, extraCity(id) { extraCities.add(id); invalidate(); }, markers,
      kmPerPx() { const lat = imerc(V.cy); return 111.32 * Math.cos(lat * RAD) / V.s; }
    };
  }
  return { create, merc, imerc, route, haversine, kmToLL, cityById, edges };
})();
