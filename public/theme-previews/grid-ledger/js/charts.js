/* SVG charts drawn in the spreadsheet chart style (Roboto, light gridlines). */
'use strict';
const CH = (() => {
  const C = { blue: '#f44267', red: '#35ea61', yellow: '#04fbe5', green: '#6634a8', orange: '#01ff97', teal: '#c646a8', grey: '#9aa0a6', dark: '#3c4043', grid: '#e8eaed', axis: '#5f6368', ink: '#202124' };
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nice = (lo, hi, n = 5) => {
    if (hi === lo) { hi = lo + 1; }
    const span = hi - lo, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0) || mag * 10;
    return { lo: Math.floor(lo / step) * step, hi: Math.ceil(hi / step) * step, step };
  };
  const fmtN = (v, f) => f ? f(v) : (Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en-IN') : (+v.toFixed(1)).toString());
  const wrapLabel = (s, max) => { const w = String(s).split(' '); const lines = []; let cur = ''; for (const x of w) { if ((cur + ' ' + x).trim().length > max && cur) { lines.push(cur); cur = x; } else cur = (cur + ' ' + x).trim(); } if (cur) lines.push(cur); return lines.slice(0, 3); };
  const svg = (w, h, body, label) => `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label)}" class="chart-svg">${body}</svg>`;

  /* yAxis + gridlines */
  function yaxis(x0, x1, y0, y1, sc, fmt) {
    let s = ''; for (let v = sc.lo; v <= sc.hi + 1e-9; v += sc.step) { const y = y1 - (v - sc.lo) / (sc.hi - sc.lo) * (y1 - y0); s += `<line x1="${x0}" x2="${x1}" y1="${y}" y2="${y}" stroke="${v === 0 ? '#bdc1c6' : C.grid}"/><text x="${x0 - 6}" y="${y + 4}" text-anchor="end" class="ax">${esc(fmt ? fmt(v) : fmtN(v))}</text>`; }
    return s;
  }

  function waterfall({ w, h, labels, vals, total = [], fmt, colors = {} }) {
    const L = 44, R = 10, T = 14, B = 46; const n = labels.length; const bw = (w - L - R) / n;
    let run = 0; const bars = [];
    vals.forEach((v, i) => { if (total.includes(i)) { bars.push({ a: 0, b: v, t: 'tot', v }); run = v; } else { const a = run; run += v; bars.push({ a, b: run, t: v >= 0 ? 'up' : 'down', v }); } });
    const all = bars.flatMap(b => [b.a, b.b]); const sc = nice(Math.min(0, ...all), Math.max(...all));
    const Y = v => T + (sc.hi - v) / (sc.hi - sc.lo) * (h - T - B);
    let s = yaxis(L, w - R, T, h - B, sc, fmt);
    bars.forEach((b, i) => {
      const x = L + i * bw + bw * 0.16, ww = bw * 0.68, y = Y(Math.max(b.a, b.b)), hh = Math.max(1, Math.abs(Y(b.a) - Y(b.b)));
      const col = b.t === 'tot' ? (colors.tot || C.blue) : b.t === 'up' ? (colors.up || C.green) : (colors.down || C.red);
      s += `<rect x="${x}" y="${y}" width="${ww}" height="${hh}" fill="${col}"/>`;
      if (i < bars.length - 1) s += `<line x1="${x + ww}" x2="${x + bw}" y1="${Y(b.b)}" y2="${Y(b.b)}" stroke="#9aa0a6" stroke-dasharray="2 2"/>`;
      const lab = b.t === 'tot' ? fmtN(b.v, fmt) : (b.v > 0 ? '+' : b.v < 0 ? '−' : '') + fmtN(Math.abs(b.v), fmt);
      s += `<text x="${x + ww / 2}" y="${y - 4}" text-anchor="middle" class="dl">${esc(lab)}</text>`;
      wrapLabel(labels[i], Math.max(6, Math.floor(bw / 6.2))).forEach((ln, k) => { s += `<text x="${x + ww / 2}" y="${h - B + 14 + k * 12}" text-anchor="middle" class="ax">${esc(ln)}</text>`; });
    });
    return svg(w, h, s, 'Waterfall chart');
  }

  function columns({ w, h, labels, series, stacked = false, ref, fmt, pointColors, labelsOn = true, yfmt }) {
    const L = 44, R = 10, T = series.length > 1 ? 30 : 14, B = 34; const n = labels.length;
    const tots = labels.map((_, i) => stacked ? series.reduce((s, se) => s + (se.vals[i] || 0), 0) : Math.max(...series.map(se => se.vals[i] || 0)));
    const mins = labels.map((_, i) => Math.min(0, ...series.map(se => se.vals[i] || 0)));
    const sc = nice(Math.min(0, ...mins, ref ? ref.v : 0), Math.max(...tots, ref ? ref.v : 0) * 1.08);
    const Y = v => T + (sc.hi - v) / (sc.hi - sc.lo) * (h - T - B);
    let s = yaxis(L, w - R, T, h - B, sc, yfmt || fmt);
    const gw = (w - L - R) / n;
    labels.forEach((lab, i) => {
      let acc = 0;
      series.forEach((se, k) => {
        const v = se.vals[i] || 0; let x, ww, y0, y1;
        if (stacked) { ww = gw * 0.6; x = L + i * gw + gw * 0.2; y0 = Y(acc + v); y1 = Y(acc); acc += v; }
        else { ww = gw * 0.7 / series.length; x = L + i * gw + gw * 0.15 + k * ww; y0 = Y(Math.max(0, v)); y1 = Y(Math.min(0, v)); }
        const col = pointColors ? pointColors[i] : se.color;
        s += `<rect x="${x}" y="${y0}" width="${ww}" height="${Math.max(0.5, y1 - y0)}" fill="${col}"><title>${esc(lab)}: ${esc(fmtN(v, fmt))}</title></rect>`;
        if (labelsOn && !stacked) s += `<text x="${x + ww / 2}" y="${(v >= 0 ? y0 : y1 + 12) - (v >= 0 ? 4 : 0)}" text-anchor="middle" class="dl">${esc(fmtN(v, fmt))}</text>`;
      });
      if (stacked && labelsOn) s += `<text x="${L + i * gw + gw / 2}" y="${Y(acc) - 4}" text-anchor="middle" class="dl">${esc(fmtN(acc, fmt))}</text>`;
      wrapLabel(lab, Math.max(5, Math.floor(gw / 6.4))).slice(0, 2).forEach((ln, k) => { s += `<text x="${L + i * gw + gw / 2}" y="${h - B + 14 + k * 12}" text-anchor="middle" class="ax">${esc(ln)}</text>`; });
    });
    if (ref) { const y = Y(ref.v); s += `<line x1="${L}" x2="${w - R}" y1="${y}" y2="${y}" stroke="${ref.color || C.dark}" stroke-dasharray="5 4" stroke-width="1.2"/><text x="${w - R}" y="${y - 5}" text-anchor="end" class="dl">${esc(ref.label)}</text>`; }
    if (series.length > 1) { let x = L; series.forEach(se => { s += `<rect x="${x}" y="8" width="10" height="10" rx="2" fill="${se.color}"/><text x="${x + 14}" y="17" class="ax">${esc(se.name)}</text>`; x += 22 + se.name.length * 6.4; }); }
    return svg(w, h, s, 'Column chart');
  }

  function hbars({ w, h, labels, series, stacked = true, fmt, labelW = 150 }) {
    const L = labelW, R = 40, T = series.length > 1 ? 28 : 8, B = 8; const n = labels.length;
    const tots = labels.map((_, i) => series.reduce((s, se) => s + (se.vals[i] || 0), 0));
    const max = Math.max(...tots) || 1; const rh = (h - T - B) / n;
    let s = '';
    labels.forEach((lab, i) => {
      let acc = 0; const y = T + i * rh + rh * 0.18, hh = rh * 0.64;
      wrapLabel(lab, Math.floor(labelW / 6.6)).slice(0, 2).forEach((ln, k, arr) => { s += `<text x="${L - 8}" y="${y + hh / 2 + 4 + (k - (arr.length - 1) / 2) * 12}" text-anchor="end" class="ax">${esc(ln)}</text>`; });
      series.forEach(se => { const v = se.vals[i] || 0; const x = L + acc / max * (w - L - R); const ww = v / max * (w - L - R); acc += v; s += `<rect x="${x}" y="${y}" width="${Math.max(0, ww)}" height="${hh}" fill="${se.color}"><title>${esc(lab)} · ${esc(se.name || '')}: ${esc(fmtN(v, fmt))}</title></rect>`; });
      s += `<text x="${L + acc / max * (w - L - R) + 6}" y="${y + hh / 2 + 4}" class="dl">${esc(fmtN(acc, fmt))}</text>`;
    });
    if (series.length > 1) { let x = L; series.forEach(se => { s += `<rect x="${x}" y="6" width="10" height="10" rx="2" fill="${se.color}"/><text x="${x + 14}" y="15" class="ax">${esc(se.name)}</text>`; x += 24 + se.name.length * 6.4; }); }
    return svg(w, h, s, 'Bar chart');
  }

  function football({ w, h, rows, marker, fmt, labelW = 170 }) {
    const L = labelW, R = 16, T = 10, B = 26; const n = rows.length;
    const lo = Math.min(...rows.map(r => r.lo), marker != null ? marker : Infinity), hi = Math.max(...rows.map(r => r.hi), marker != null ? marker : -Infinity);
    const sc = nice(lo - (hi - lo) * 0.08, hi + (hi - lo) * 0.08, 4);
    const X = v => L + (v - sc.lo) / (sc.hi - sc.lo) * (w - L - R); const rh = (h - T - B) / n;
    let s = '';
    for (let v = sc.lo; v <= sc.hi + 1e-9; v += sc.step) { s += `<line x1="${X(v)}" x2="${X(v)}" y1="${T}" y2="${h - B}" stroke="${C.grid}"/><text x="${X(v)}" y="${h - B + 16}" text-anchor="middle" class="ax">${esc(fmtN(v, fmt))}</text>`; }
    const cols = [C.blue, C.red, C.yellow, C.green];
    rows.forEach((r, i) => {
      const y = T + i * rh + rh * 0.22, hh = rh * 0.56;
      wrapLabel(r.label, Math.floor(labelW / 6.4)).slice(0, 3).forEach((ln, k, arr) => { s += `<text x="${L - 8}" y="${y + hh / 2 + 4 + (k - (arr.length - 1) / 2) * 12}" text-anchor="end" class="ax">${esc(ln)}</text>`; });
      s += `<rect x="${X(r.lo)}" y="${y}" width="${Math.max(1, X(r.hi) - X(r.lo))}" height="${hh}" fill="${cols[i % 4]}"><title>${esc(r.label)}: ${esc(fmtN(r.lo, fmt))} to ${esc(fmtN(r.hi, fmt))}</title></rect>`;
      s += `<text x="${X(r.lo) - 4}" y="${y + hh / 2 + 4}" text-anchor="end" class="dl">${esc(fmtN(r.lo, fmt))}</text><text x="${X(r.hi) + 4}" y="${y + hh / 2 + 4}" class="dl">${esc(fmtN(r.hi, fmt))}</text>`;
    });
    if (marker != null && isFinite(marker)) s += `<line x1="${X(marker)}" x2="${X(marker)}" y1="${T - 4}" y2="${h - B}" stroke="${C.dark}" stroke-width="1.5" stroke-dasharray="4 3"/><text x="${X(marker) + 4}" y="${T + 6}" class="dl">${esc(fmtN(marker, fmt))}</text>`;
    return svg(w, h, s, 'Football field chart');
  }

  function line({ w, h, labels, vals, fmt, ref, color = C.blue, points = true }) {
    const L = 46, R = 14, T = 16, B = 30; const n = vals.length;
    const sc = nice(Math.min(...vals, ref ? ref.v : Infinity), Math.max(...vals, ref ? ref.v : -Infinity));
    const X = i => L + (n === 1 ? 0.5 : i / (n - 1)) * (w - L - R), Y = v => T + (sc.hi - v) / (sc.hi - sc.lo) * (h - T - B);
    let s = yaxis(L, w - R, T, h - B, sc, fmt);
    s += `<polyline fill="none" stroke="${color}" stroke-width="2" points="${vals.map((v, i) => X(i) + ',' + Y(v)).join(' ')}"/>`;
    vals.forEach((v, i) => { if (points) s += `<circle cx="${X(i)}" cy="${Y(v)}" r="3" fill="${color}"><title>${esc(labels[i])}: ${esc(fmtN(v, fmt))}</title></circle><text x="${X(i)}" y="${Y(v) - 8}" text-anchor="middle" class="dl">${esc(fmtN(v, fmt))}</text>`; s += `<text x="${X(i)}" y="${h - B + 16}" text-anchor="middle" class="ax">${esc(labels[i])}</text>`; });
    if (ref) { const y = Y(ref.v); s += `<line x1="${L}" x2="${w - R}" y1="${y}" y2="${y}" stroke="${ref.color || C.red}" stroke-dasharray="5 4"/><text x="${w - R}" y="${y - 5}" text-anchor="end" class="dl" fill="${ref.color || C.red}">${esc(ref.label)}</text>`; }
    return svg(w, h, s, 'Line chart');
  }

  function spark(vals, opts, w, h) {
    opts = opts || {}; vals = vals.filter(v => isFinite(v)); if (!vals.length) return '';
    const type = (opts.charttype || 'line').toLowerCase(); const col = opts.color || '#511e8e', neg = opts.negcolor || '#25d94e';
    const min = Math.min(0, ...vals), max = Math.max(0, ...vals) || 1; const pad = 3;
    const Y = v => pad + (max - v) / (max - min || 1) * (h - pad * 2);
    let s = '';
    if (type === 'column' || type === 'bar') { const bw = (w - pad * 2) / vals.length; vals.forEach((v, i) => { const y0 = Y(Math.max(0, v)), y1 = Y(Math.min(0, v)); s += `<rect x="${pad + i * bw + bw * 0.14}" y="${y0}" width="${bw * 0.72}" height="${Math.max(1, y1 - y0)}" fill="${v < 0 ? neg : col}"/>`; }); }
    else { const lo = Math.min(...vals), hi = Math.max(...vals); const YY = v => pad + (hi - v) / ((hi - lo) || 1) * (h - pad * 2); s = `<polyline fill="none" stroke="${col}" stroke-width="1.6" points="${vals.map((v, i) => (pad + i / Math.max(1, vals.length - 1) * (w - pad * 2)) + ',' + YY(v)).join(' ')}"/>`; }
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true" preserveAspectRatio="none">${s}</svg>`;
  }

  return { waterfall, columns, hbars, football, line, spark, C };
})();
