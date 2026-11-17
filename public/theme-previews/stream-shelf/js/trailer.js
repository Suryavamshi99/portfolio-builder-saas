/* ARJUN.TV trailer engine.
   Draws a short, looping "trailer" for one campaign on a <canvas>. No video files:
   every frame is drawn from the facts in content/portfolio.json.
   createTrailer(canvas, spec, opts) -> { play, pause, toggle, restart, destroy, playing }
   specFor(slug, data) -> { color, scenes, poster } */

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const seg = (p, a, b) => clamp((p - a) / (b - a));
const E = {
  out: t => 1 - Math.pow(1 - t, 3),
  inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
};
const FD = "'Bebas'", FU = "'Inter'", FM = "'Mono'";
function font(g, w, s, f) { g.font = `${w} ${Math.max(7, s)}px ${f}, system-ui, sans-serif`; }
function spacing(g, px) { if ('letterSpacing' in g) g.letterSpacing = px + 'px'; }
function wrap(g, text, maxW) {
  const words = String(text).split(' '); const lines = []; let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}
function rr(g, x, y, w, h, r) {
  g.beginPath();
  r = Math.min(r, w / 2, h / 2);
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function fitFont(g, text, w, size, maxW, f) { font(g, w, size, f); let s = size; while (g.measureText(text).width > maxW && s > 8) { s *= 0.92; font(g, w, s, f); } return s; }
const TONES = ['#a3a6f1', '#7c84d9', '#606ac1', '#444e9c', '#313c7a', '#8f95e6', '#5058b0', '#b5b7f5'];
const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/* ---------- scenes ---------- */
const S = {
  slate(kicker, line) {
    return { d: 3.6, name: 'Cold open', draw(g, p, b, u, c) {
      const maxW = b.w * 0.94;
      font(g, 800, 6.2 * u, FU); const lines = wrap(g, line, maxW);
      const lh = 7.2 * u, total = lines.length * lh + 6 * u;
      const y0 = b.y + (b.h - total) / 2;
      font(g, 400, 1.9 * u, FM); spacing(g, 0.35 * u); g.fillStyle = c;
      g.globalAlpha *= 1; g.fillText(kicker.toUpperCase(), b.x, y0);
      spacing(g, 0);
      g.fillRect(b.x, y0 + 1.6 * u, maxW * 0.2 * E.out(seg(p, 0.05, 0.4)), 0.35 * u);
      font(g, 800, 6.2 * u, FU); g.fillStyle = '#ffffff';
      lines.forEach((ln, i) => {
        const q = E.out(seg(p, 0.1 + i * 0.08, 0.42 + i * 0.08));
        g.save(); g.globalAlpha *= q; g.fillText(ln, b.x, y0 + 6 * u + (i + 0.8) * lh + (1 - q) * 3 * u); g.restore();
      });
    } };
  },

  grid(n, cols, value, label, opt = {}) {
    return { d: 4.6, name: label.split(',')[0], draw(g, p, b, u, c) {
      const wide = b.w > b.h * 1.2;
      const rW = wide ? b.w * 0.58 : b.w, rH = wide ? b.h : b.h * 0.62;
      const rows = Math.ceil(n / cols);
      const s = Math.min(rW / cols, rH / rows); const gap = s * 0.1;
      const ox = b.x, oy = b.y + (rH - rows * s) / 2;
      for (let i = 0; i < n; i++) {
        const k = (i * 37) % n;
        const q = E.back(seg(p, (k / n) * 0.55, (k / n) * 0.55 + 0.14));
        if (q <= 0) continue;
        const x = ox + (i % cols) * s, y = oy + Math.floor(i / cols) * s, w = s - gap;
        g.save(); g.translate(x + w / 2, y + w / 2); g.scale(q, q); g.translate(-w / 2, -w / 2);
        rr(g, 0, 0, w, w, w * 0.12); g.fillStyle = '#1f1c26'; g.fill(); g.save(); g.clip();
        g.fillStyle = `hsl(${Math.floor(rnd(i) * 360)},45%,38%)`;
        g.beginPath(); g.ellipse(w / 2, w * 1.02, w * 0.36, w * 0.3, 0, 0, 7); g.fill();
        g.fillStyle = TONES[i % TONES.length]; g.beginPath(); g.arc(w / 2, w * 0.45, w * 0.2, 0, 7); g.fill();
        if (opt.pin) { g.fillStyle = c; g.beginPath(); g.arc(w * 0.82, w * 0.18, w * 0.08, 0, 7); g.fill(); }
        g.fillStyle = '#141018'; g.beginPath(); g.ellipse(w / 2, w * 0.3, w * 0.21, w * 0.1, 0, Math.PI, 0); g.fill();
        g.restore(); g.restore();
      }
      const tx = wide ? b.x + b.w * 0.64 : b.x, ty = wide ? b.y + b.h * 0.42 : b.y + rH + 9 * u;
      const cq = E.out(seg(p, 0, 0.62));
      font(g, 400, 18 * u, FD); g.fillStyle = '#ffffff'; g.fillText(String(Math.round(n * cq)), tx, ty);
      font(g, 700, 2.8 * u, FU); g.fillStyle = 'rgba(255,255,255,.85)';
      wrap(g, label, wide ? b.w * 0.34 : b.w).forEach((l, i) => g.fillText(l, tx, ty + 4.4 * u + i * 3.6 * u));
      g.fillStyle = c; g.fillRect(tx, ty + 1.2 * u, 10 * u * cq, 0.4 * u);
    } };
  },

  counter(value, label, note) {
    return { d: 3.3, name: label, draw(g, p, b, u, c) {
      const m = String(value).match(/^([^\d]*)([\d.,]+)(.*)$/);
      const q = E.out(seg(p, 0.04, 0.55));
      let txt = value;
      if (m) {
        const num = parseFloat(m[2].replace(/,/g, '')); const dec = (m[2].split('.')[1] || '').length;
        const v = num * q; let s = dec ? v.toFixed(dec) : Math.round(v).toString();
        if (m[2].includes(',')) s = Number(s).toLocaleString('en-US');
        txt = m[1] + s + m[3];
      }
      const size = fitFont(g, value, 400, 30 * u, b.w * 0.95, FD);
      const y = b.y + b.h * 0.5 + size * 0.2;
      g.save();
      if (p > 0.55) { g.shadowColor = rgba(c, 0.7); g.shadowBlur = 4 * u * (1 - seg(p, 0.55, 0.9)); }
      g.globalAlpha *= m ? 1 : q;
      g.fillStyle = '#ffffff'; g.fillText(txt, b.x, y); g.restore();
      g.fillStyle = c; g.fillRect(b.x, y + 1.8 * u, Math.min(b.w * 0.5, 18 * u) * q, 0.45 * u);
      const lq = E.out(seg(p, 0.25, 0.55));
      g.save(); g.globalAlpha *= lq;
      font(g, 800, 3.6 * u, FU); g.fillStyle = '#ffffff'; g.fillText(label, b.x, y + 7.2 * u);
      font(g, 400, 1.9 * u, FM); g.fillStyle = 'rgba(255,255,255,.62)'; g.fillText(note.toUpperCase(), b.x, y + 11 * u);
      g.restore();
    } };
  },

  bars(kicker, rows, max) {
    return { d: 4.4, name: kicker, draw(g, p, b, u, c) {
      font(g, 400, 1.9 * u, FM); g.fillStyle = c; spacing(g, 0.3 * u);
      const h = rows.length * 13 * u + 4 * u; const y0 = b.y + (b.h - h) / 2;
      g.fillText(kicker.toUpperCase(), b.x, y0); spacing(g, 0);
      const full = b.w * 0.72;
      rows.forEach((r, i) => {
        const [label, val, text, hl] = r; const y = y0 + 5 * u + i * 13 * u;
        const q = E.out(seg(p, 0.12 + i * 0.18, 0.55 + i * 0.18));
        font(g, 600, 2.4 * u, FU); g.fillStyle = 'rgba(255,255,255,.8)'; g.fillText(label, b.x, y + 2 * u);
        rr(g, b.x, y + 3.6 * u, full, 5.4 * u, 0.6 * u); g.fillStyle = 'rgba(255,255,255,.08)'; g.fill();
        if (q > 0) { rr(g, b.x, y + 3.6 * u, Math.max(1, full * (val / max) * q), 5.4 * u, 0.6 * u); g.fillStyle = hl ? c : '#6b6b72'; g.fill(); }
        font(g, 400, 7 * u, FD); g.fillStyle = '#ffffff';
        const dec = (String(val).split('.')[1] || '').length;
        g.fillText((val * q).toFixed(dec) + text.replace(/^[\d.]+/, ''), b.x + full * (val / max) * q + 1.6 * u, y + 8.9 * u);
      });
    } };
  },

  donut(pct, label) {
    return { d: 3.8, name: label, draw(g, p, b, u, c) {
      const wide = b.w > b.h * 1.2;
      const r = wide ? Math.min(b.h * 0.34, b.w * 0.2) : Math.min(b.h * 0.26, b.w * 0.3);
      const cx = b.x + r * 1.1, cy = wide ? b.y + b.h / 2 : b.y + r * 1.2;
      const q = E.out(seg(p, 0.06, 0.62));
      g.lineWidth = r * 0.2; g.lineCap = 'butt';
      g.strokeStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
      g.strokeStyle = c; g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (pct / 100) * q); g.stroke();
      font(g, 400, r * 0.78, FD); g.fillStyle = '#ffffff'; g.textAlign = 'center';
      g.fillText(Math.round(pct * q) + '%', cx, cy + r * 0.27); g.textAlign = 'left';
      const lq = E.out(seg(p, 0.3, 0.6));
      g.save(); g.globalAlpha *= lq; font(g, 800, 3.3 * u, FU); g.fillStyle = '#ffffff';
      const lx = wide ? cx + r * 1.45 : b.x, ly = wide ? cy - 2 * u : cy + r * 1.5 + 3 * u;
      wrap(g, label, wide ? b.x + b.w - lx : b.w).forEach((l, i) => g.fillText(l, lx, ly + i * 4.3 * u));
      g.restore();
    } };
  },

  phone(chips, handle, fk, reels) {
    return { d: 5.6, name: 'One shop a week', draw(g, p, b, u, c, T) {
      const ph = Math.min(b.h * 0.98, b.w * 0.9), pw = ph * 0.5;
      const wide = b.w > b.h * 1.2;
      const px = wide ? b.x + b.w * 0.06 : b.x, py = b.y + (b.h - ph) / 2;
      rr(g, px, py, pw, ph, pw * 0.14); g.fillStyle = '#0c0c0e'; g.fill();
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = Math.max(1, 0.3 * u); g.stroke();
      g.save(); rr(g, px + pw * 0.05, py + pw * 0.05, pw * 0.9, ph - pw * 0.1, pw * 0.1); g.clip();
      const sx = px + pw * 0.05, sy = py + pw * 0.05, sw = pw * 0.9;
      g.fillStyle = '#121212'; g.fillRect(sx, sy, sw, ph);
      // profile header
      g.fillStyle = c; g.beginPath(); g.arc(sx + sw * 0.15, sy + sw * 0.2, sw * 0.09, 0, 7); g.fill();
      font(g, 700, sw * 0.07, FU); g.fillStyle = '#ffffff'; g.fillText(handle, sx + sw * 0.3, sy + sw * 0.18);
      font(g, 400, sw * 0.055, FU); g.fillStyle = 'rgba(255,255,255,.7)';
      const f = Math.round(fk * E.out(seg(p, 0.05, 0.7)));
      g.fillText(f + 'k followers · ' + reels + ' reels', sx + sw * 0.3, sy + sw * 0.27);
      const tile = sw / 3, off = (p * tile * 4) % (tile * 2);
      const pal = ['#621fff', '#1a2cff', '#2e76e8', '#c3b8f5', '#2a49c2', '#5747ff'];
      for (let i = 0; i < 27; i++) {
        const x = sx + (i % 3) * tile, y = sy + sw * 0.4 + Math.floor(i / 3) * tile * 1.3 - off;
        g.fillStyle = pal[(i * 5) % pal.length]; g.fillRect(x + 1, y + 1, tile - 2, tile * 1.3 - 2);
        g.fillStyle = '#665fd9'; g.beginPath(); g.ellipse(x + tile / 2, y + tile * 0.7, tile * 0.28, tile * 0.18, 0, Math.PI, 0); g.fill();
        g.fillStyle = '#141d7a'; g.fillRect(x + tile * 0.24, y + tile * 0.7, tile * 0.52, tile * 0.06);
        g.fillStyle = '#665fd9'; g.fillRect(x + tile * 0.22, y + tile * 0.76, tile * 0.56, tile * 0.08);
      }
      g.restore();
      // floating hearts
      for (let i = 0; i < 5; i++) {
        const t = (T * 0.5 + i / 5) % 1; const hx = px + pw * (0.75 + 0.08 * Math.sin(i * 3 + T * 2)), hy = py + ph * (0.9 - t * 0.7);
        g.save(); g.globalAlpha *= (1 - t) * 0.9; g.fillStyle = '#4dc6ff'; g.font = `${3 * u}px system-ui`; g.fillText('♥', hx, hy); g.restore();
      }
      const cx0 = wide ? px + pw + 6 * u : b.x, cy0 = wide ? b.y + b.h * 0.22 : py + ph + 4 * u;
      if (wide) chips.forEach((t, i) => {
        const q = E.back(seg(p, 0.15 + i * 0.12, 0.35 + i * 0.12)); if (q <= 0) return;
        font(g, 700, 2.4 * u, FU); const w = g.measureText(t).width + 3.6 * u;
        g.save(); g.globalAlpha *= clamp(q); g.translate(cx0, cy0 + i * 6.6 * u); g.scale(clamp(q, 0, 1.2), clamp(q, 0, 1.2));
        rr(g, 0, 0, w, 4.6 * u, 2.3 * u); g.fillStyle = i === chips.length - 1 ? c : 'rgba(255,255,255,.12)'; g.fill();
        g.fillStyle = i === chips.length - 1 ? '#111111' : '#ffffff'; g.fillText(t, 1.8 * u, 3.2 * u); g.restore();
      });
    } };
  },

  voice(line, caption) {
    return { d: 5.6, name: 'The voicemails', draw(g, p, b, u, c, T) {
      const w = Math.min(b.w * 0.8, 70 * u), x = b.x, y = b.y + b.h * 0.18;
      const bubble = (yy, scale, prog, dur) => {
        const bw = w * scale, bh = 9 * u;
        rr(g, x, yy, bw, bh, 2.2 * u); g.fillStyle = '#23262b'; g.fill();
        g.fillStyle = c; g.beginPath(); g.arc(x + 4.5 * u, yy + bh / 2, 2.6 * u, 0, 7); g.fill();
        g.fillStyle = '#111111'; g.beginPath(); g.moveTo(x + 3.8 * u, yy + bh / 2 - 1.2 * u); g.lineTo(x + 5.6 * u, yy + bh / 2); g.lineTo(x + 3.8 * u, yy + bh / 2 + 1.2 * u); g.fill();
        const n = 28, bx = x + 9 * u, span = bw - 17 * u;
        for (let i = 0; i < n; i++) {
          const hgt = (0.25 + 0.75 * rnd(i + scale * 10)) * 5 * u * (i / n < prog ? 0.85 + 0.15 * Math.sin(T * 12 + i) : 1);
          g.fillStyle = i / n < prog ? '#ffffff' : 'rgba(255,255,255,.3)';
          g.fillRect(bx + (span / n) * i, yy + bh / 2 - hgt / 2, Math.max(1, span / n * 0.5), hgt);
        }
        font(g, 400, 1.7 * u, FM); g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText(dur, x + bw - 6.5 * u, yy + bh / 2 + 0.6 * u);
      };
      bubble(y, 1, seg(p, 0.1, 0.62), '0:06');
      const typed = Math.floor(line.length * seg(p, 0.18, 0.62));
      font(g, 800, 4.6 * u, FU); g.fillStyle = '#ffffff';
      wrap(g, line.slice(0, typed), w).forEach((l, i) => g.fillText(l, x, y + 16 * u + i * 5.6 * u));
      const q = E.out(seg(p, 0.62, 0.8));
      if (q > 0) { g.save(); g.globalAlpha *= q; bubble(y + 28 * u + (1 - q) * 3 * u, 0.62, seg(p, 0.7, 1), '0:04'); g.restore(); }
      g.save(); g.globalAlpha *= E.out(seg(p, 0.7, 0.9)); font(g, 400, 1.8 * u, FM); g.fillStyle = c; spacing(g, 0.3 * u);
      g.fillText(caption.toUpperCase(), x, y + 44 * u); spacing(g, 0); g.restore();
    } };
  },

  rename(brand, names, count) {
    return { d: 5.6, name: 'The catalogue', draw(g, p, b, u, c) {
      const w = Math.min(b.w * 0.92, 80 * u), x = b.x, y = b.y + b.h * 0.08, h = b.h * 0.84;
      rr(g, x, y, w, h, 1.6 * u); g.fillStyle = '#e7e4f6'; g.fill();
      font(g, 400, 7 * u, FD); g.fillStyle = '#5a1e26'; g.fillText(brand.toUpperCase(), x + 4 * u, y + 9 * u);
      font(g, 400, 1.6 * u, FM); g.fillStyle = '#8a7a63'; g.fillText('CATALOGUE · ' + count + ' PRODUCTS RENAMED', x + 4 * u, y + 13 * u);
      const rows = 4, rh = (h - 18 * u) / rows;
      for (let i = 0; i < rows; i++) {
        const ry = y + 17 * u + i * rh;
        g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(x + 4 * u, ry + rh - 0.5 * u, w - 8 * u, 1);
        const nm = names[i];
        const t0 = 0.1 + i * 0.18, strike = seg(p, t0, t0 + 0.1), type = seg(p, t0 + 0.12, t0 + 0.3);
        if (nm && type > 0) {
          font(g, 700, 2.6 * u, FU); g.fillStyle = '#1b1b1b';
          g.fillText(nm.slice(0, Math.floor(nm.length * type)), x + 4 * u, ry + rh * 0.55);
        } else {
          g.fillStyle = 'rgba(0,0,0,.18)'; rr(g, x + 4 * u, ry + rh * 0.3, (w - 20 * u) * (0.45 + rnd(i) * 0.4), 2.4 * u, 1.2 * u); g.fill();
          if (nm && strike > 0) { g.fillStyle = '#2b67c0'; g.fillRect(x + 3 * u, ry + rh * 0.3 + 1.1 * u, (w - 16 * u) * strike, 0.35 * u); }
          if (!nm) { font(g, 400, 1.6 * u, FM); g.fillStyle = '#8a7a63'; }
        }
        font(g, 700, 2.2 * u, FU); g.fillStyle = '#5a1e26'; g.textAlign = 'right';
        g.fillText(nm && type > 0 ? 'NEW' : '', x + w - 4 * u, ry + rh * 0.55); g.textAlign = 'left';
      }
    } };
  },

  quote(kicker, text) {
    return { d: 3.6, name: kicker, draw(g, p, b, u, c) {
      font(g, 800, 5.4 * u, FU); const lines = wrap(g, text, b.w * 0.92);
      const lh = 6.4 * u; const y0 = b.y + (b.h - (lines.length * lh + 5 * u)) / 2;
      font(g, 400, 1.9 * u, FM); spacing(g, 0.35 * u); g.fillStyle = c; g.fillText(kicker.toUpperCase(), b.x, y0); spacing(g, 0);
      font(g, 800, 5.4 * u, FU);
      let wi = 0; const total = text.split(' ').length;
      lines.forEach((ln, i) => {
        let xx = b.x;
        ln.split(' ').forEach(word => {
          const q = E.out(seg(p, 0.08 + (wi / total) * 0.45, 0.2 + (wi / total) * 0.45)); wi++;
          g.save(); g.globalAlpha *= q; g.fillStyle = '#ffffff'; g.fillText(word, xx, y0 + 5 * u + (i + 0.8) * lh + (1 - q) * 1.5 * u); g.restore();
          xx += g.measureText(word + ' ').width;
        });
      });
    } };
  },

  flow(steps, note) {
    return { d: 5, name: 'The plan', draw(g, p, b, u, c) {
      const wide = b.w > b.h * 1.2; const n = steps.length;
      const bw = wide ? (b.w - (n - 1) * 5 * u) / n : b.w * 0.8, bh = wide ? 16 * u : 11 * u;
      steps.forEach(([t, s], i) => {
        const q = E.back(seg(p, 0.08 + i * 0.2, 0.3 + i * 0.2)); if (q <= 0) return;
        const x = wide ? b.x + i * (bw + 5 * u) : b.x, y = wide ? b.y + b.h * 0.3 : b.y + i * (bh + 4 * u);
        g.save(); g.globalAlpha *= clamp(q); g.translate(x, y + (1 - clamp(q)) * 2 * u);
        rr(g, 0, 0, bw, bh, 1.4 * u); g.fillStyle = 'rgba(255,255,255,.06)'; g.fill(); g.strokeStyle = c; g.lineWidth = Math.max(1, 0.3 * u); g.stroke();
        font(g, 400, 1.6 * u, FM); g.fillStyle = c; g.fillText('STEP ' + (i + 1), 2 * u, 3.6 * u);
        font(g, 800, 2.6 * u, FU); g.fillStyle = '#ffffff'; g.fillText(t, 2 * u, wide ? 8.6 * u : 7 * u);
        if (wide) { font(g, 400, 1.9 * u, FU); g.fillStyle = 'rgba(255,255,255,.7)'; wrap(g, s, bw - 4 * u).forEach((l, k) => g.fillText(l, 2 * u, 12 * u + k * 2.5 * u)); }
        g.restore();
        if (i < n - 1 && wide) { g.fillStyle = c; g.globalAlpha *= 1; g.fillText('›', x + bw + 1.2 * u, y + bh / 2); }
      });
      const q = E.out(seg(p, 0.7, 0.9));
      g.save(); g.globalAlpha *= q; font(g, 600, 2.3 * u, FU); g.fillStyle = 'rgba(255,255,255,.85)';
      wrap(g, note, b.w).forEach((l, i) => g.fillText(l, b.x, (wide ? b.y + b.h * 0.3 + bh + 7 * u : b.y + n * (bh + 4 * u) + 3 * u) + i * 3.2 * u));
      g.restore();
    } };
  },

  end(title, result) {
    return { d: 4.2, name: 'End card', draw(g, p, b, u, c) {
      const q = E.out(seg(p, 0.02, 0.4));
      font(g, 400, 1.9 * u, FM); spacing(g, 0.4 * u); g.fillStyle = c;
      const size = fitFont(g, title.toUpperCase(), 400, 14 * u, b.w * 0.95, FD);
      const y = b.y + b.h * 0.42;
      font(g, 400, 1.9 * u, FM); spacing(g, 0.4 * u); g.fillText('A ARJUN.TV ORIGINAL', b.x, y - size * 0.95); spacing(g, 0);
      g.save(); g.globalAlpha *= q; font(g, 400, size, FD); g.fillStyle = '#ffffff'; g.fillText(title.toUpperCase(), b.x, y + (1 - q) * 2 * u); g.restore();
      const rq = E.out(seg(p, 0.3, 0.6));
      g.save(); g.globalAlpha *= rq; font(g, 600, 2.7 * u, FU); g.fillStyle = 'rgba(255,255,255,.88)';
      wrap(g, result, b.w * 0.9).slice(0, 3).forEach((l, i) => g.fillText(l, b.x, y + 5 * u + i * 3.6 * u)); g.restore();
    } };
  }
};

/* ---------- per-campaign scripts ---------- */
export function specFor(slug, d) {
  const P = d.projects.find(x => x.slug === slug); const pg = d.project_pages[slug] || {}; const st = d.streaming;
  const title = st.short_titles[slug] || P.title; const color = st.colors[slug] || '#1a2cff';
  const kick = `${P.org} · ${P.year}`.replace('–', ' to ');
  const dec = pg.decisions || [];
  const end = S.end(title, P.result);
  let scenes, poster;
  switch (slug) {
    case 'glow-creators':
      scenes = [S.slate(kick, 'Recycled paper ads all show a tree and a white stack.'),
        S.grid(48, 8, '48', 'independent stationers in five towns, each with its own order code', { pin: true }),
        S.quote('Decision 3', dec[2].choice), S.counter('4.2M', 'impressions', 'organic and boosted, first four weeks'),
        S.counter('9,000', 'cartons sold', 'in the first 19 days'), S.donut(31, 'of first-month trade orders used a stationer code'), end];
      poster = 1; break;
    case 'twt-creator-test':
      scenes = [S.slate(kick, 'Selling well in the shops. Slowly online.'),
        S.quote('The hook came from buyers', '“Finally, a notebook that lies flat.”'),
        S.bars('Reorder rate, 3 weeks', [['Branded email', 1.9, '1.9%'], ['Handwritten postcards', 3.1, '3.1%', 1]], 4),
        S.counter('−22%', 'cost per reorder', 'online reorders, test towns'),
        S.counter('1 in 4', 'postcard-led buyers reordered', 'within 30 days'), end];
      poster = 2; break;
    case 'pav-patrol':
      scenes = [S.slate('Own initiative · 2022 to now', 'One local shop a week, filmed on a phone in under an hour.'),
        S.phone(['Under 40 seconds', "Owner's name in the first frame", 'One line from the owner', 'No star ratings'], 'Larchmont Lunchbreak', 38, 121),
        S.quote('Decision 2', 'Lead with the owner, not the dish.'),
        S.counter('38,000', 'followers', 'since March 2022, no paid promotion'),
        S.counter('2.2M', 'views on the top reel', 'a corner café on Mill Lane, Larchmont Falls'), end];
      poster = 1; break;
    case 'dabba-film':
      scenes = [S.slate(kick, 'A back-to-school film where the father is never on screen.'),
        S.voice('“The green one, with the lines. She\'ll know.”', 'Shop answering machine · 90 seconds'),
        S.quote('Decision 1', dec[0].choice + '.'), S.counter('1.9M', 'YouTube views', 'on the 90-second film'),
        S.counter('Shortlist', 'Larchmont Regional Ad Awards', '2023, with the Pinewick team'), end];
      poster = 1; break;
    case 'cloud-kitchen-rebrand':
      scenes = [S.slate(kick, 'Product names like NB-A5-R80-T3 and photos taken on a phone.'),
        S.rename('Sharp & Square', ['Sunday Planner Pad, one page per week', 'Ledger Book, the one accountants argue about'], 38),
        S.bars('Product-page conversion, online store', [['Before the rebrand', 2.9, '2.9%'], ['Six weeks after', 4.1, '4.1%', 1]], 5),
        S.counter('4', 'shops', 'one identity across all of them'), end];
      poster = 2; break;
    case 'brandstorm':
      scenes = [S.slate(kick, 'Ink refills, poured at neighbourhood stationers.'),
        S.flow(pg.visual.steps, pg.visual.note), S.counter('36', 'shopkeeper interviews', 'Larchmont Falls and Ironby'),
        S.counter('Top 8', 'national finalist', 'Halden Cup 2026'), end];
      poster = 1; break;
    case 'copy-that':
      scenes = [S.slate('LinkedIn newsletter · 2024 to now', 'One regional print ad, taken apart every week.'),
        S.quote('Every issue has three parts', 'The headline, who it was meant for, and the one change I would test.'),
        S.counter('64', 'issues', 'weekly since 2024'), S.counter('12.8k', 'subscribers', 'on LinkedIn'), end];
      poster = 2; break;
    case 'mu-fest':
      scenes = [S.slate(kick, 'Five weeks and $4,800 to fill a two-day trade fair.'),
        S.grid(40, 8, '40', 'schools and offices, each with its own referral code', { pin: true }),
        S.donut(46, 'of 2,300 registrations came through referral codes'),
        S.counter('2,300', 'registrations', 'from 40 schools and offices'), end];
      poster = 2; break;
    default:
      scenes = [S.slate(kick, P.summary.split('.')[0] + '.'), end]; poster = 1;
  }
  return { color, scenes, poster, title };
}

/* ---------- engine ---------- */
let NOISE = null;
function noise() {
  if (NOISE) return NOISE;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const im = x.createImageData(128, 128);
  for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 22; }
  x.putImageData(im, 0, 0); NOISE = c; return c;
}

export function createTrailer(canvas, spec, opts = {}) {
  const g = canvas.getContext('2d');
  const total = spec.scenes.reduce((a, s) => a + s.d, 0);
  let W = 0, H = 0, dpr = 1, t = 0, last = null, playing = false, raf = 0, dead = false, visible = true;
  const layout = opts.layout || 'full';
  function resize() {
    const r = canvas.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    if (!playing) drawNow();
  }
  function box() {
    if (layout === 'billboard') {
      if (W > 900) {
        const lim = opts.limit ? opts.limit() : H * 0.6; const y = H * 0.14;
        return { x: W * 0.47, y, w: W * 0.47, h: Math.max(H * 0.18, Math.min(H * 0.34, lim - y - 24)) };
      }
      return { x: W * 0.07, y: H * 0.13, w: W * 0.86, h: H * 0.48 };
    }
    if (layout === 'mini') return { x: W * 0.07, y: H * 0.1, w: W * 0.86, h: H * 0.8 };
    if (W > 700) return { x: W * 0.36, y: H * 0.1, w: W * 0.58, h: H * 0.62 };
    return { x: W * 0.07, y: H * 0.1, w: W * 0.86, h: H * 0.8 };
  }
  function bg(T) {
    const c = spec.color;
    g.fillStyle = '#0b0a0d'; g.fillRect(0, 0, W, H);
    const b = box();
    const rg = g.createRadialGradient(b.x + b.w * 0.5, b.y + b.h * 0.45, 0, b.x + b.w * 0.5, b.y + b.h * 0.45, Math.max(W, H) * 0.7);
    rg.addColorStop(0, rgba(c, 0.55)); rg.addColorStop(0.5, rgba(c, 0.16)); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
    // drifting bokeh
    for (let i = 0; i < 7; i++) {
      const r = Math.max(W, H) * (0.05 + 0.06 * rnd(i + 3));
      const x = W * (0.35 + 0.65 * rnd(i + 11)) + Math.sin(T * 0.25 + i) * W * 0.03;
      const y = H * (0.1 + 0.8 * rnd(i + 21)) + Math.cos(T * 0.2 + i * 2) * H * 0.03;
      const bg2 = g.createRadialGradient(x, y, 0, x, y, r);
      bg2.addColorStop(0, rgba(i % 3 ? c : '#ffffff', i % 3 ? 0.24 : 0.06)); bg2.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = bg2; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    // giant outlined title treatment drifting behind the scenes
    if (spec.title && layout !== 'mini') {
      const fs = H * 0.62; font(g, 400, fs, FD); g.lineWidth = Math.max(1, H / 500);
      g.strokeStyle = 'rgba(255,255,255,.06)'; g.textBaseline = 'alphabetic';
      const tw = g.measureText(spec.title.toUpperCase()).width;
      const x = W - ((T * 14) % (tw + W)); g.strokeText(spec.title.toUpperCase(), x, H * 0.62 + fs * 0.35);
    }
    // faint frame lines, like a contact sheet
    g.strokeStyle = 'rgba(255,255,255,.035)'; g.lineWidth = 1;
    const step = Math.max(60, W / 14), shift = (T * 12) % step;
    for (let x = -shift; x < W; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    // slow light beams
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const x = ((T * 18 * (i + 1) + i * W * 0.4) % (W * 1.6)) - W * 0.3;
      const lg = g.createLinearGradient(x, 0, x + W * 0.18, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, rgba(c, 0.07)); lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lg; g.save(); g.translate(x, 0); g.transform(1, 0, -0.35, 1, 0, 0); g.fillRect(0, 0, W * 0.18, H); g.restore();
    }
    g.restore();
  }
  function drawScene(i, p, T) {
    const s = spec.scenes[i]; const b = box(); const u = Math.min(b.w * (W < 700 ? 1.3 : 1), b.h * 1.6) / 100;
    const env = Math.min(seg(p, 0, 0.1), 1 - seg(p, 0.9, 1));
    g.save(); g.globalAlpha = (opts.still || !playing) ? Math.max(env, 1) : env;
    const z = 1.03 - 0.03 * E.out(p); const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    g.translate(cx, cy); g.scale(z, z); g.translate(-cx, -cy);
    g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    s.draw(g, p, b, u, spec.color, T);
    g.restore();
  }
  function grain() {
    const n = noise(); g.save(); g.globalAlpha = 0.5;
    const pat = g.createPattern(n, 'repeat'); g.translate(Math.random() * 128, Math.random() * 128);
    g.fillStyle = pat; g.fillRect(-128, -128, W + 256, H + 256); g.restore();
  }
  function locate(tt) { let a = 0; for (let i = 0; i < spec.scenes.length; i++) { const d = spec.scenes[i].d; if (tt < a + d) return [i, (tt - a) / d]; a += d; } return [spec.scenes.length - 1, 0.999]; }
  function drawNow() {
    if (!W) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    let i, p;
    if (opts.still && !playing && t === 0) { i = spec.poster; p = 0.85; } else [i, p] = locate(t);
    bg(t); drawScene(i, p, t); grain();
    opts.onFrame && opts.onFrame(t / total, i, spec.scenes.length, spec.scenes[i].name);
  }
  function loop(now) {
    if (dead) return;
    if (last == null) last = now;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (playing && visible) {
      t += dt;
      if (t >= total) { if (opts.loop === false) { t = total - 0.001; playing = false; opts.onEnd && opts.onEnd(); } else t = 0; }
      drawNow();
    }
    raf = requestAnimationFrame(loop);
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas);
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0.05 }); io.observe(canvas);
  resize();
  const api = {
    play() { if (dead) return; playing = true; last = null; if (!raf) raf = requestAnimationFrame(loop); opts.onState && opts.onState(true); },
    pause() { playing = false; opts.onState && opts.onState(false); },
    toggle() { playing ? api.pause() : api.play(); },
    restart() { t = 0; api.play(); },
    destroy() { dead = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); },
    get playing() { return playing; },
    total
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!playing) drawNow(); });
  return api;
}
