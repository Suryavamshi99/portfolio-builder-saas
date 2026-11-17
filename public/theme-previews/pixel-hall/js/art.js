// Code-drawn pixel art. Everything here paints onto small 2D canvases that the
// game turns into nearest-filtered Three.js textures. No image files.

export function cv(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  return { c, x };
}

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

const R = (x, X, Y, W, H, col) => { x.fillStyle = col; x.fillRect(Math.round(X), Math.round(Y), Math.round(W), Math.round(H)); };

/* ---------- crisp pixel text (font rendered, then alpha-thresholded) ---------- */
export function pixelText(text, { font = '8px Silkscreen', color = '#ffffff', glow = null, blur = 6, pad = 0, outline = null } = {}) {
  // Render the pixel font k times larger, then sample each cell centre. Glyph pixels in
  // Silkscreen are exactly 1/8 em, so this lands every font pixel on one screen pixel.
  const size = parseInt(font.match(/(\d+)px/)[1], 10);
  const k = Math.max(1, Math.round(32 / size));
  const bigFont = font.replace(/(\d+)px/, size * k + 'px');
  const m = cv(4, 4).x; m.font = bigFont;
  const asc = Math.ceil(size * 1.05);
  const w = Math.ceil(m.measureText(text).width / k) + 2, h = Math.ceil(size * 1.6) + 2;
  const big = cv(w * k, h * k); big.x.font = bigFont; big.x.textBaseline = 'alphabetic'; big.x.fillStyle = '#ffffff'; big.x.fillText(text, k, (1 + asc) * k);
  const bd = big.x.getImageData(0, 0, w * k, h * k).data;
  const t = cv(w, h); const id = t.x.createImageData(w, h), d = id.data;
  const n = parseInt(color.slice(1), 16), cr = (n >> 16) & 255, cg = (n >> 8) & 255, cb = n & 255;
  const half = Math.floor(k / 2);
  for (let y = 0; y < h; y++) for (let x0 = 0; x0 < w; x0++) {
    const on = bd[((y * k + half) * w * k + (x0 * k + half)) * 4 + 3] > 127;
    const i = (y * w + x0) * 4; d[i] = cr; d[i + 1] = cg; d[i + 2] = cb; d[i + 3] = on ? 255 : 0;
  }
  t.x.putImageData(id, 0, 0);
  // trim vertical empty rows
  let top = h, bot = 0;
  for (let y = 0; y < h; y++) for (let x0 = 0; x0 < w; x0++) if (d[(y * w + x0) * 4 + 3]) { top = Math.min(top, y); bot = Math.max(bot, y); }
  if (top > bot) { top = 0; bot = h - 1; }
  const th = bot - top + 1;
  const o = cv(w + pad * 2 + (outline ? 2 : 0), th + pad * 2 + (outline ? 2 : 0));
  const ox = pad + (outline ? 1 : 0), oy = pad + (outline ? 1 : 0);
  if (outline) {
    const oc = recolor(t.c, outline);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) o.x.drawImage(oc, 0, top, w, th, ox + dx, oy + dy, w, th);
  }
  if (glow) { o.x.shadowColor = glow; o.x.shadowBlur = blur; o.x.drawImage(t.c, 0, top, w, th, ox, oy, w, th); o.x.drawImage(t.c, 0, top, w, th, ox, oy, w, th); o.x.shadowBlur = 0; }
  o.x.drawImage(t.c, 0, top, w, th, ox, oy, w, th);
  return o.c;
}

function recolor(src, col) {
  const { c, x } = cv(src.width, src.height); x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); return c;
}

/* ---------- neon sign: text on a dark backing panel with a neon frame ---------- */
export function neonSign(text, { font = '8px Silkscreen', color = '#ad3eff', frame = null, back = '#2a0a12', padX = 5, padY = 4, lines = null, gap = 3, stripes = false } = {}) {
  const parts = (lines || [text]).map((t) => pixelText(t, { font, color }));
  const tw = Math.max(...parts.map((p) => p.width)), th = parts.reduce((s, p) => s + p.height, 0) + gap * (parts.length - 1);
  const W = tw + padX * 2 + 4, H = th + padY * 2 + 4, G = 6;
  const { c, x } = cv(W + G * 2, H + G * 2);
  // glow halo
  x.shadowColor = frame || color; x.shadowBlur = 8;
  R(x, G, G, W, H, back); x.shadowBlur = 0;
  if (stripes) for (let y = G + 2; y < G + H - 2; y += 3) R(x, G + 2, y, W - 4, 1, shade(back, -0.25));
  if (frame) { x.strokeStyle = frame; x.lineWidth = 1; x.strokeRect(G + 1.5, G + 1.5, W - 3, H - 3); R(x, G, G, W, 1, shade(frame, 0.4)); }
  let y = G + 2 + padY;
  x.shadowColor = color; x.shadowBlur = 5;
  for (const p of parts) { x.drawImage(p, G + 2 + padX + Math.round((tw - p.width) / 2), y); y += p.height + gap; }
  x.shadowBlur = 0;
  for (const p of parts) { /* crisp pass */ }
  y = G + 2 + padY;
  for (const p of parts) { x.drawImage(p, G + 2 + padX + Math.round((tw - p.width) / 2), y); y += p.height + gap; }
  return c;
}

/* ---------- building facade ---------- */
export function facade(w, h, o) {
  const { c, x } = cv(w, h);
  const r = rng(o.seed || 7);
  const base = o.base, dark = shade(base, -0.38), light = shade(base, 0.16), shopH = o.shopH ?? 40;
  R(x, 0, 0, w, h, base);
  // vertical panel seams and bricks
  if (o.brick) {
    for (let y = 0; y < h - shopH; y += 4) for (let i = (y / 4) % 2 ? 0 : 4; i < w; i += 8) R(x, i, y, 1, 4, shade(base, -0.12));
    for (let y = 0; y < h - shopH; y += 4) R(x, 0, y, w, 1, shade(base, -0.1));
  } else {
    for (let i = 0; i < w; i += o.panel || 22) R(x, i, 0, 1, h, shade(base, -0.18));
  }
  R(x, 0, 0, 3, h, light); R(x, w - 3, 0, 3, h, dark);
  // floors
  const fh = o.floorH || 30;
  const floors = [];
  for (let y = h - shopH; y > 14; y -= fh) floors.push(y);
  const masked = (X, Y, W, H) => (o.masks || []).some(([mx, my, mw, mh]) => X < mx + mw && X + W > mx && Y < my + mh && Y + H > my);
  for (const y of floors) {
    R(x, 0, y - 2, w, 3, dark); R(x, 0, y - 3, w, 1, light);
    const ww = o.winW || 10, wh = o.winH || 13, step = o.winStep || 18;
    for (let X = 8; X + ww < w - 6; X += step) {
      const Y = y - fh + 8;
      if (Y < 10 || masked(X - 2, Y - 2, ww + 4, wh + 4)) continue;
      const lit = r();
      const glass = lit < 0.32 ? (o.warm || '#6bff85') : lit < 0.55 ? (o.cool || '#bc5eff') : lit < 0.62 ? (o.accent || '#ffce4f') : '#381823';
      R(x, X - 1, Y - 1, ww + 2, wh + 2, dark);
      R(x, X, Y, ww, wh, glass);
      if (glass !== '#381823') { R(x, X, Y, ww, 2, shade(glass, 0.35)); for (let b = Y + 4; b < Y + wh; b += 3) R(x, X, b, ww, 1, shade(glass, -0.25)); }
      else { R(x, X + 1, Y + 1, 2, wh - 2, '#502434'); }
      R(x, X - 1, Y + wh + 1, ww + 2, 1, light);
      if (r() < 0.18 && !masked(X, Y + wh + 2, 10, 7)) { R(x, X, Y + wh + 2, 10, 7, '#8d93a8'); R(x, X + 1, Y + wh + 3, 8, 1, '#5b6178'); R(x, X + 1, Y + wh + 5, 8, 1, '#5b6178'); }
    }
  }
  // pipes
  if (o.pipe) { const px = o.pipe; R(x, px, 6, 3, h - shopH, '#1a1a2e'); R(x, px, 6, 1, h - shopH, '#46466a'); }
  // parapet + roof clutter
  R(x, 0, 0, w, 5, dark); R(x, 0, 5, w, 1, light);
  // storefront
  const sy = h - shopH;
  R(x, 0, sy, w, shopH, shade(base, -0.28));
  R(x, 0, sy, w, 3, shade(base, -0.5));
  if (o.shop !== false) {
    const gx = o.glassX ?? 10, gw = o.glassW ?? Math.min(80, w - 70);
    const gcol = o.glow || '#ad3eff';
    R(x, gx - 2, sy + 7, gw + 4, shopH - 7, '#1e0a11');
    const g = x.createLinearGradient(0, sy + 9, 0, h);
    g.addColorStop(0, shade(gcol, -0.15)); g.addColorStop(1, shade(gcol, -0.7));
    x.fillStyle = g; x.fillRect(gx, sy + 9, gw, shopH - 9);
    for (let i = gx + 18; i < gx + gw; i += 20) R(x, i, sy + 9, 2, shopH - 9, '#1e0a11');
    R(x, gx, sy + 9, gw, 2, shade(gcol, 0.5));
  }
  if (o.door != null) {
    const dx = o.door, dw = o.doorW || 18;
    R(x, dx - 2, sy + 4, dw + 4, shopH - 4, '#1e0a11');
    const dg = x.createLinearGradient(0, sy + 6, 0, h);
    dg.addColorStop(0, o.doorCol || '#ffce4f'); dg.addColorStop(1, shade(o.doorCol || '#ffce4f', -0.6));
    x.fillStyle = dg; x.fillRect(dx, sy + 6, dw, shopH - 6);
    R(x, dx + dw / 2 - 1, sy + 6, 1, shopH - 6, '#1e0a11');
  }
  if (o.extra) o.extra(x, { w, h, sy, R: (...a) => R(x, ...a), r });
  return c;
}

/* ---------- skyline layers (tileable) ---------- */
export function skyline(w, h, { seed, col, winCol, density = 0.5, minH, maxH, neon = [] }) {
  const { c, x } = cv(w, h);
  const r = rng(seed);
  let X = -10;
  while (X < w) {
    const bw = 18 + Math.floor(r() * 40), bh = minH + Math.floor(r() * (maxH - minH));
    const top = h - bh;
    const tone = shade(col, (r() - 0.5) * 0.16);
    R(x, X, top, bw, bh, tone);
    R(x, X, top, bw, 1, shade(tone, 0.2));
    R(x, X + bw - 2, top, 2, bh, shade(tone, -0.2));
    if (r() < 0.35) { R(x, X + bw / 2 - 1, top - 8 - r() * 10, 1, 18, tone); }
    if (r() < 0.25) { R(x, X + 3, top - 5, bw - 6, 5, shade(tone, -0.1)); }
    for (let yy = top + 5; yy < h - 4; yy += 6) for (let xx = X + 3; xx < X + bw - 4; xx += 5) if (r() < density) R(x, xx, yy, 2, 2, r() < 0.8 ? winCol : shade(winCol, 0.4));
    if (neon.length && r() < 0.22) { const nc = neon[Math.floor(r() * neon.length)]; R(x, X + 2, top + 8 + r() * 30, bw - 4, 3, nc); }
    X += bw + Math.floor(r() * 3);
  }
  // make the tile seamless: copy the left edge over the right edge
  const strip = x.getImageData(0, 0, 40, h); x.putImageData(strip, w - 40, 0);
  return c;
}

export function skyGradient(h) {
  const { c, x } = cv(4, h);
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#501124'); g.addColorStop(0.45, '#b0335a'); g.addColorStop(0.8, '#ea6792'); g.addColorStop(1, '#ff8cac');
  x.fillStyle = g; x.fillRect(0, 0, 4, h);
  // dither bands for a pixel look
  for (let y = 0; y < h; y += 2) if (y % 6 === 0) R(x, 0, y, 4, 1, 'rgba(0,0,0,.05)');
  return c;
}

export function moon() {
  const { c, x } = cv(28, 28);
  x.fillStyle = '#b0ffc2'; x.beginPath(); x.arc(14, 14, 11, 0, Math.PI * 2); x.fill();
  R(x, 8, 9, 3, 3, '#86f19a'); R(x, 16, 15, 4, 3, '#86f19a'); R(x, 12, 19, 2, 2, '#86f19a');
  return c;
}

/* ---------- ground: sidewalk + road ---------- */
export function ground(w, h, reflections) {
  const { c, x } = cv(w, h);
  R(x, 0, 0, w, h, '#33121b');
  R(x, 0, 0, w, 2, '#8f4b5e'); R(x, 0, 2, w, 7, '#6b2f41');
  for (let i = 0; i < w; i += 16) R(x, i, 2, 1, 7, '#572334');
  R(x, 0, 9, w, 2, '#260c13');
  for (let i = 0; i < w; i += 40) R(x, i, 24, 18, 2, '#7e3e51');
  for (const [rx, rw, col] of reflections) {
    for (let y = 12; y < h; y += 2) {
      if ((y / 2) % 2) continue;
      const a = 0.32 * (1 - (y - 12) / (h - 12));
      const j = ((y * 13) % 9) - 4;
      x.globalAlpha = a; R(x, rx + j + 6, y, rw - 12 - Math.abs(j) * 2, 1, col);
    }
    x.globalAlpha = 1;
  }
  const r = rng(3);
  for (let i = 0; i < w / 6; i++) R(x, r() * w, 12 + r() * (h - 12), 1 + r() * 3, 1, 'rgba(255,140,177,.18)');
  return c;
}

/* ---------- props ---------- */
export function lamp() {
  const { c, x } = cv(30, 110);
  R(x, 3, 14, 3, 96, '#20203a'); R(x, 3, 14, 1, 96, '#4a4a70');
  R(x, 1, 104, 7, 6, '#20203a');
  R(x, 4, 12, 18, 3, '#20203a'); R(x, 18, 10, 10, 4, '#2c2c4a');
  R(x, 19, 14, 8, 2, '#b0ffca');
  return c;
}
export function lampCone() {
  const { c, x } = cv(60, 96);
  const g = x.createLinearGradient(0, 0, 0, 96);
  g.addColorStop(0, 'rgba(160,255,188,.55)'); g.addColorStop(1, 'rgba(160,255,188,0)');
  x.fillStyle = g; x.beginPath(); x.moveTo(26, 0); x.lineTo(34, 0); x.lineTo(60, 96); x.lineTo(0, 96); x.fill();
  return c;
}
export function glowBlob(col, r = 16) {
  const { c, x } = cv(r * 2, r * 2);
  const g = x.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2);
  return c;
}
export function bench() {
  const { c, x } = cv(30, 12);
  R(x, 0, 0, 30, 3, '#47a83a'); R(x, 0, 4, 30, 3, '#388b2c'); R(x, 0, 0, 30, 1, '#5dcf55');
  R(x, 2, 7, 2, 5, '#2a2a40'); R(x, 26, 7, 2, 5, '#2a2a40');
  return c;
}
export function hydrant() {
  const { c, x } = cv(8, 12);
  R(x, 2, 0, 4, 2, '#8ed14a'); R(x, 1, 2, 6, 9, '#79b83a'); R(x, 0, 4, 8, 2, '#8ed14a'); R(x, 1, 11, 6, 1, '#466b20'); R(x, 2, 3, 1, 7, '#ace870');
  return c;
}
export function bin() {
  const { c, x } = cv(12, 15);
  R(x, 0, 0, 12, 3, '#5d6a80'); R(x, 1, 3, 10, 12, '#3f4a5e'); for (let i = 2; i < 11; i += 3) R(x, i, 4, 1, 10, '#56637a');
  return c;
}
export function plant() {
  const { c, x } = cv(14, 20);
  R(x, 3, 13, 8, 7, '#327a2a'); R(x, 2, 12, 10, 2, '#3f9a36');
  const g = ['#2f35bf', '#1f218f', '#4b55e0'];
  [[6, 0], [3, 3], [8, 2], [1, 6], [10, 6], [5, 5], [7, 8], [3, 9], [9, 10]].forEach(([a, b], i) => R(x, a, b, 3, 4, g[i % 3]));
  return c;
}
export function scooter(col = '#51ff3d') {
  const { c, x } = cv(26, 16);
  R(x, 4, 4, 12, 7, col); R(x, 2, 2, 8, 3, '#1b1b2c'); R(x, 18, 0, 2, 9, '#2a2a40'); R(x, 16, 0, 6, 2, '#2a2a40');
  R(x, 6, 0, 10, 4, shade(col, -0.2)); R(x, 7, 1, 8, 2, '#bcffb8');
  x.fillStyle = '#111111'; x.beginPath(); x.arc(5, 12, 3.5, 0, 7); x.arc(21, 12, 3.5, 0, 7); x.fill();
  R(x, 4, 11, 2, 2, '#888888'); R(x, 20, 11, 2, 2, '#888888');
  return c;
}
export function bus(label) {
  const W = 96, H = 38, { c, x } = cv(W, H);
  R(x, 0, 2, W, 28, '#32f256'); R(x, 0, 2, W, 2, '#6bff8e'); R(x, 0, 24, W, 6, '#14c930');
  for (let i = 6; i < W - 14; i += 14) { R(x, i, 7, 11, 9, '#6b2a5f'); R(x, i, 7, 11, 2, '#ff6ff0'); }
  R(x, W - 12, 7, 9, 18, '#6b2a5f'); R(x, W - 3, 18, 3, 4, '#c0ffd7');
  const t = pixelText(label, { font: '8px Silkscreen', color: '#003a00' }); x.drawImage(t, 8, 17);
  x.fillStyle = '#111111'; x.beginPath(); x.arc(18, 31, 6, 0, 7); x.arc(W - 22, 31, 6, 0, 7); x.fill();
  R(x, 16, 29, 4, 4, '#999999'); R(x, W - 24, 29, 4, 4, '#999999');
  return c;
}
export function crate(w, h, col = '#3eb041') {
  const { c, x } = cv(w, h);
  R(x, 0, 0, w, h, col); R(x, 0, 0, w, 1, shade(col, 0.3)); R(x, 0, h - 1, w, 1, shade(col, -0.4));
  R(x, 0, 0, 1, h, shade(col, -0.3)); R(x, w - 1, 0, 1, h, shade(col, -0.4));
  for (let y = 4; y < h; y += 5) R(x, 1, y, w - 2, 1, shade(col, -0.2));
  x.strokeStyle = shade(col, -0.35); x.beginPath(); x.moveTo(1, 1); x.lineTo(w - 1, h - 1); x.stroke();
  return c;
}
export function ledge(w, col = '#5c6688', label = null, labelCol = '#4affdd') {
  const { c, x } = cv(w, label ? 14 : 6);
  R(x, 0, 0, w, 3, shade(col, 0.25)); R(x, 0, 3, w, 2, col); R(x, 0, 5, w, 1, shade(col, -0.4));
  R(x, 2, 5, 2, label ? 9 : 1, shade(col, -0.3)); R(x, w - 4, 5, 2, label ? 9 : 1, shade(col, -0.3));
  if (label) { const t = pixelText(label, { font: '8px Silkscreen', color: labelCol, glow: labelCol, blur: 3 }); x.drawImage(t, Math.round(w / 2 - t.width / 2), 6); }
  return c;
}
export function awning(w, a = '#ffce4f', b = '#401617') {
  const { c, x } = cv(w, 8);
  for (let i = 0; i < w; i += 6) R(x, i, 0, 3, 5, a), R(x, i + 3, 0, 3, 5, b);
  R(x, 0, 0, w, 1, shade(a, 0.4));
  for (let i = 0; i < w; i += 6) R(x, i, 5, 3, 2, a);
  return c;
}
export function acUnit() {
  const { c, x } = cv(22, 14);
  R(x, 0, 0, 22, 12, '#9aa1b8'); R(x, 0, 0, 22, 2, '#c3c8d8'); for (let i = 3; i < 11; i += 2) R(x, 2, i, 11, 1, '#6c7290');
  x.fillStyle = '#4a5068'; x.beginPath(); x.arc(17, 6, 3.5, 0, 7); x.fill(); R(x, 2, 12, 2, 2, '#3a3f55'); R(x, 18, 12, 2, 2, '#3a3f55');
  return c;
}
export function terminal(active, num) {
  const { c, x } = cv(14, 34);
  R(x, 5, 14, 4, 18, '#2a2a44'); R(x, 5, 14, 1, 18, '#4f4f78'); R(x, 2, 31, 10, 3, '#2a2a44');
  R(x, 0, 0, 14, 14, '#30151d'); R(x, 0, 0, 14, 1, '#5d5590');
  const s = active ? '#4558ff' : '#ffce4f';
  R(x, 2, 2, 10, 10, shade(s, -0.55));
  const t = pixelText(String(num), { font: '8px Silkscreen', color: s }); x.drawImage(t, 7 - Math.floor(t.width / 2), 3);
  if (active) R(x, 2, 2, 10, 1, shade(s, 0.4));
  return c;
}
export function folder() {
  const { c, x } = cv(14, 12);
  R(x, 1, 1, 6, 3, '#00e82e'); R(x, 0, 3, 14, 9, '#00a816');
  R(x, 1, 4, 12, 7, '#3fff72'); R(x, 1, 4, 12, 1, '#a6ffc6'); R(x, 2, 6, 6, 1, '#00e82e'); R(x, 2, 8, 8, 1, '#00e82e');
  R(x, 11, 5, 1, 1, '#ffffff');
  return c;
}
export function kiosk() {
  const { c, x } = cv(56, 54);
  R(x, 0, 0, 56, 6, '#ad3eff'); R(x, 0, 0, 56, 1, '#e8c9ff'); for (let i = 0; i < 56; i += 8) R(x, i, 6, 4, 3, '#ad3eff');
  R(x, 3, 9, 50, 45, '#50202e'); R(x, 6, 12, 44, 22, '#220b12');
  const cols = ['#e6f3e8', '#3fff72', '#51ff3d', '#c9d0f7', '#ffce4f'];
  for (let i = 0; i < 6; i++) { R(x, 8 + i * 7, 16 + (i % 2) * 2, 6, 14, cols[i % 5]); R(x, 9 + i * 7, 19 + (i % 2) * 2, 4, 1, '#555555'); R(x, 9 + i * 7, 22 + (i % 2) * 2, 4, 1, '#555555'); }
  R(x, 4, 36, 48, 3, '#8f4b5e'); for (let i = 0; i < 4; i++) R(x, 8 + i * 11, 40, 9, 12, cols[(i + 2) % 5]);
  return c;
}
export function phoneBooth() {
  const { c, x } = cv(24, 56);
  R(x, 0, 0, 24, 56, '#b0c218'); R(x, 0, 0, 24, 2, '#f0ff6f'); R(x, 2, 6, 20, 2, '#1a150b');
  const t = pixelText('CALL', { font: '8px Silkscreen', color: '#ffffff', glow: '#ffce4f', blur: 3 }); x.drawImage(t, 12 - t.width / 2, 8);
  R(x, 3, 16, 18, 36, '#d67fff'); for (let y = 16; y < 52; y += 6) R(x, 3, y, 18, 1, '#b0c218'); R(x, 12, 16, 1, 36, '#b0c218');
  R(x, 7, 26, 6, 9, '#1a1a2a');
  return c;
}
export function arcade(col) {
  const { c, x } = cv(18, 40);
  R(x, 0, 0, 18, 40, '#401624'); R(x, 0, 0, 18, 6, col); R(x, 2, 8, 14, 12, '#180a10');
  R(x, 4, 10, 10, 8, shade(col, -0.4)); R(x, 6, 12, 2, 2, '#ffffff'); R(x, 10, 14, 3, 2, col);
  R(x, 0, 22, 18, 4, '#60243a'); R(x, 4, 23, 2, 2, '#ffce4f'); R(x, 10, 23, 2, 2, '#ad3eff'); R(x, 13, 23, 2, 2, '#4affdd');
  return c;
}
export function trophy() {
  const { c, x } = cv(16, 18);
  R(x, 3, 0, 10, 8, '#3fff72'); R(x, 0, 1, 3, 4, '#3fff72'); R(x, 13, 1, 3, 4, '#3fff72'); R(x, 4, 1, 2, 5, '#a6ffc6');
  R(x, 6, 8, 4, 4, '#00e82e'); R(x, 3, 12, 10, 3, '#00a816'); R(x, 2, 15, 12, 3, '#204a25');
  return c;
}
export function heatmap(w, h) {
  const { c, x } = cv(w, h);
  R(x, 0, 0, w, h, '#180a10'); R(x, 0, 0, w, 1, '#ad3eff');
  const r = rng(11), cols = ['#2f35bf', '#64dbe5', '#3fff72', '#51ff3d', '#c5ff4f'];
  for (let yy = 3; yy < h - 3; yy += 5) for (let xx = 3; xx < w - 3; xx += 6) R(x, xx, yy, 5, 4, cols[Math.floor(r() * cols.length)]);
  return c;
}
export function screenChart(w, h) {
  const { c, x } = cv(w, h);
  R(x, 0, 0, w, h, '#180a10'); x.strokeStyle = '#ad3eff'; x.strokeRect(0.5, 0.5, w - 1, h - 1);
  for (let k = 0; k < 3; k++) {
    const col = ['#4affdd', '#ad3eff', '#ffce4f'][k];
    let y = 4 + k * 2;
    for (let i = 3; i < w - 3; i += 2) { R(x, i, Math.round(y), 2, 1, col); y += 0.18 + k * 0.04; }
  }
  return c;
}
export function poster(lines, col, bg) {
  const ps = lines.map((t) => pixelText(t, { font: '8px Silkscreen', color: col }));
  const w = Math.max(...ps.map((p) => p.width)) + 8, h = ps.reduce((s, p) => s + p.height + 2, 0) + 8;
  const { c, x } = cv(w, h); R(x, 0, 0, w, h, bg); R(x, 1, 1, w - 2, h - 2, shade(bg, -0.2));
  let y = 4; for (const p of ps) { x.drawImage(p, Math.round(w / 2 - p.width / 2), y); y += p.height + 2; }
  return c;
}
export function heroPortrait(img, w, h) {
  // Pixelate a real photo into a billboard (nearest-neighbour downsample + limited palette).
  const { c, x } = cv(w, h);
  x.imageSmoothingEnabled = true;
  const s = Math.max(w / img.width, h / img.height);
  x.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s);
  const id = x.getImageData(0, 0, w, h), d = id.data;
  for (let i = 0; i < d.length; i += 4) { d[i] = Math.round(d[i] / 24) * 24; d[i + 1] = Math.round(d[i + 1] / 24) * 24; d[i + 2] = Math.round(d[i + 2] / 20) * 20 + 10; }
  x.putImageData(id, 0, 0);
  for (let y = 0; y < h; y += 2) { x.fillStyle = 'rgba(60,10,15,.18)'; x.fillRect(0, y, w, 1); }
  return c;
}

/* ---------- the player: 16x24 pixel woman with glasses, braid and blazer ---------- */
const PAL = { h: '#17121a', H: '#3b2c44', s: '#57b94c', S: '#48943a', g: '#0d0d12', l: '#fbbfff', o: '#42f56c', m: '#4f7a33', w: '#e6f3e8', b: '#782a61', B: '#521c42', p: '#2e2c3c', k: '#0f0f14', r: '#b4d948' };
const HEAD = ['......hhhhh.....', '....hhhhhhhhh...', '...hhhHHhhhhhh..', '...hhhhhhhhhsh..', '..hhhhhhhssssss.', '..hhhhhhsggsggs.', '..hhhhhosglsgls.', '..hhhhhhsssssSs.', '..hhh.hhSssmms..', '..hhh...SSss....'];
const BODY = {
  idle0: ['..hh...bbwwbb...', '..hh..bbbwwbbb..', '..ro..bbbwwbbb..', '......bBbwwbBb..', '......bBbbbbBs..', '......sbbbbbb...', '.......bbbbbb...', '.......pppppp...', '.......ppp.pp...', '.......ppp.pp...', '.......pp..pp...', '.......pp..pp...', '......kkk..kkk..', '................'],
  idle1: ['..hh............', '..hh...bbwwbb...', '..ro..bbbwwbbb..', '......bbbwwbbb..', '......bBbwwbBb..', '......bBbbbbBs..', '......sbbbbbb...', '.......pppppp...', '.......ppp.pp...', '.......pp..pp...', '.......pp..pp...', '.......pp..pp...', '......kkk..kkk..', '................'],
  run0: ['.hh....bbwwbb...', 'hh....bbbwwbbb..', 'ro...bbbbwwbbbs.', '....sbBbbwwbb...', '......bBbbbbb...', '.......bbbbbb...', '.......bbbbbb...', '.......pppppp...', '......ppp..ppp..', '.....ppp....pp..', '....pp.......pp.', '...kpp.......kkk', '...kk...........', '................'],
  run1: ['.hh....bbwwbb...', '.hh...bbbwwbbb..', '.ro...bbbwwbbb..', '......bBbwwbBb..', '......sBbbbbBs..', '.......bbbbbb...', '.......bbbbbb...', '.......pppppp...', '.......pp.ppp...', '......ppp..pp...', '......pp...ppk..', '.....kkk...kk...', '................', '................'],
  run2: ['..hh...bbwwbb...', '..hh..bbbwwbbb..', '..ro..bbbwwbbb..', '......bBbwwbBb..', '......bBbbbbBs..', '......sbbbbbb...', '.......bbbbbb...', '.......pppppp...', '........pppp....', '........ppp.....', '........ppp.....', '.......ppkk.....', '.......kk.......', '................'],
  jump: ['.hh....bbwwbb.s.', 'hh....bbbwwbbbs.', 'ro....bbbwwbbb..', '......bBbwwbb...', '.....sbBbbbbb...', '.......bbbbbb...', '.......bbbbbb...', '.......pppppp...', '......ppp.ppp...', '......pp..pp....', '.....kkk..pp....', '..........kkk...', '................', '................'],
  fall: ['...hh..bbwwbb.s.', '...hh.bbbwwbbbs.', '...ro.bbbwwbbb..', '......bBbwwbb...', '......bBbbbbb...', '.....sbbbbbbb...', '.......bbbbbb...', '.......pppppp...', '.......ppp.ppp..', '......pp....pp..', '......pp....kkk.', '.....kkk........', '................', '................'],
};
// run cycle uses run0, run1, run2, then mirrored-leg variants built from them
export const FRAMES = ['idle0', 'idle1', 'run0', 'run1', 'run2', 'run1b', 'jump', 'fall'];
export function playerSheet() {
  const { c, x } = cv(16 * FRAMES.length, 24);
  FRAMES.forEach((f, i) => {
    const body = BODY[f] || BODY.run1;
    const rows = HEAD.concat(body);
    rows.forEach((row, y) => [...row.padEnd(16, '.')].slice(0, 16).forEach((ch, xx) => { if (PAL[ch]) R(x, i * 16 + xx, y, 1, 1, PAL[ch]); }));
    if (f === 'run1b') { // bob down 1px variant for the cycle
      const id = x.getImageData(i * 16, 0, 16, 24); x.clearRect(i * 16, 0, 16, 24); x.putImageData(id, i * 16, 1);
    }
  });
  return c;
}

/* ---------- rooftop clutter: water tank, antennas, vents ---------- */
export function roof(w, seed) {
  const { c, x } = cv(w, 30);
  const r = rng(seed * 31 + 5);
  const dark = '#30101c', mid = '#4a1d2c', hi = '#703046';
  let X = 6 + Math.floor(r() * 20);
  while (X < w - 20) {
    const k = r();
    if (k < 0.3) { // water tank
      R(x, X, 10, 18, 14, mid); R(x, X, 10, 18, 2, hi); R(x, X + 2, 24, 2, 6, dark); R(x, X + 14, 24, 2, 6, dark); R(x, X + 6, 6, 6, 4, mid); X += 30;
    } else if (k < 0.55) { // antenna with red light
      R(x, X, 2, 1, 28, hi); R(x, X - 3, 8, 7, 1, hi); R(x, X - 2, 14, 5, 1, hi); R(x, X - 1, 0, 3, 2, '#beff3b'); X += 16;
    } else if (k < 0.8) { // vents
      R(x, X, 22, 14, 8, mid); R(x, X, 22, 14, 1, hi); R(x, X + 3, 18, 3, 4, dark); R(x, X + 8, 16, 3, 6, dark); X += 22;
    } else { // dish
      x.fillStyle = hi; x.beginPath(); x.arc(X + 6, 20, 6, Math.PI, 0); x.fill(); R(x, X + 5, 20, 2, 10, dark); X += 18;
    }
    X += Math.floor(r() * 24);
  }
  return c;
}
