/* Spreadsheet shell: grid, formula bar, name box, tabs, menus, panels, share card, tour. */
'use strict';
const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = { get(k, d) { try { const v = localStorage.getItem('gs10.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('gs10.' + k, JSON.stringify(v)); } catch (e) { } } };
const isPhone = () => window.matchMedia('(max-width: 760px)').matches;
const { addr: A, parseAddr: PA, numToCol: NC, fmtValue, isErr } = ENG;

let P, WB, byId = {}, byName = {}, cur, phone = isPhone();
const OV = {}, FOV = {}; // input overrides, local format overrides
const undoS = [], redoS = [];
const st = { sel: { r: 0, c: 0, r2: 0, c2: 0 }, zoom: 1, showF: false, grid: true, freeze: {}, filters: {}, panel: null, panelPref: store.get('panel', 1), sumStat: 'Sum', selChart: null };
const ROW_H = 22, HDR_W = () => phone ? 32 : 46, HDR_H = () => phone ? 22 : 24;

/* ---------- evaluation ---------- */
let cache = new Map(); const busy = new Set(); const astCache = new Map();
const ast = f => { if (!astCache.has(f)) { try { astCache.set(f, ENG.parse(f.replace(/^=/, ''))); } catch (e) { astCache.set(f, null); } } return astCache.get(f); };
const spec = (sh, r, c) => sh.cells[A(r, c)];
function rawInput(sh, a) { const o = OV[sh.id]; return o && a in o ? o[a] : sh.cells[a].v; }
function val(sh, r, c) {
  if (!sh) return ENG.ERR('#REF!');
  const s = spec(sh, r, c); if (!s) return null;
  if (s.in || s.chk) return rawInput(sh, A(r, c));
  if (!s.f) return s.v;
  const k = sh.id + '!' + r + ',' + c; if (cache.has(k)) return cache.get(k);
  if (busy.has(k)) return ENG.ERR('#REF!'); busy.add(k);
  const t = ast(s.f); const v = t ? ENG.run(t, ctxFor(sh)) : ENG.ERR('#ERROR!');
  busy.delete(k); cache.set(k, v); return v;
}
const ctxs = {};
function ctxFor(sh) {
  return ctxs[sh.id] || (ctxs[sh.id] = { sheet: sh.name, get: (nm, r, c) => val(byName[nm], r, c), name: n => { const x = WB.names[n]; if (!x) return null; const a = PA(x.a); return { t: 'ref', sheet: x.sheet, r: a.r, c: a.c }; } });
}
const g = sh => a => { const p = PA(a); return val(sh, p.r, p.c); };
const recalc = () => { cache = new Map(); };

/* ---------- display ---------- */
function fmtOf(sh, a) { const s = sh.cells[a] || {}; const o = (FOV[sh.id] || {})[a] || {}; return { fmt: o.fmt || s.fmt, d: o.d || 0, o }; }
function display(sh, r, c) {
  const a = A(r, c), s = sh.cells[a]; if (!s) return '';
  if (st.showF && s.f) return s.f;
  const v = val(sh, r, c); const { fmt, d } = fmtOf(sh, a);
  if (v && typeof v === 'object' && !isErr(v)) return v.label != null ? String(v.label) : '';
  return fmtValue(v, fmt, d) + (s.suffix && typeof v === 'number' ? s.suffix : '');
}
function rawText(sh, r, c) {
  const s = spec(sh, r, c); if (!s) return '';
  if (s.f) return s.f;
  const v = s.in || s.chk ? rawInput(sh, A(r, c)) : s.v;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') { if (/^(pct|spct)/.test(s.fmt)) return +(v * 100).toFixed(4) + '%'; return String(+v.toFixed(6)); }
  return v == null ? '' : String(v);
}

/* ---------- merges, sizes ---------- */
function prep(sh) {
  sh.mAt = {}; sh.cov = {};
  [...sh.charts, ...sh.images].forEach(o => { const p = PA(o.anchor); sh.rows = Math.max(sh.rows, p.r + Math.ceil((o.h || o.w * 0.7) / ROW_H) + 6); });
  sh.merges.forEach(m => { const [a, b] = m.split(':').map(PA); const M = { r1: a.r, c1: a.c, r2: b.r, c2: b.c }; sh.mAt[a.r + ',' + a.c] = M; for (let r = a.r; r <= b.r; r++) for (let c = a.c; c <= b.c; c++) if (r !== a.r || c !== a.c) sh.cov[r + ',' + c] = M; });
}
const mergeOf = (sh, r, c) => sh.mAt[r + ',' + c] || sh.cov[r + ',' + c] || null;
const colW = c => ((cur.cols[c] != null ? cur.cols[c] : (phone ? 80 : 100))) * st.zoom;
const rowH = r => ((cur.rowH[r] != null ? cur.rowH[r] : ROW_H)) * st.zoom;
const nCols = () => { let n = cur.cols.length; let w = cur.cols.reduce((s, x) => s + x, 0) * st.zoom; const need = (window.innerWidth + 200); while (w < need || n < (phone ? 6 : 12)) { w += (phone ? 80 : 100) * st.zoom; n++; } return Math.min(n, 40); };
const nRows = () => Math.max(cur.rows, Math.ceil(window.innerHeight / (ROW_H * st.zoom)) + 8);
const freezeOf = sh => st.freeze[sh.id] || sh.freeze || { r: 0, c: 0 };

/* ---------- conditional formatting ---------- */
function cfClass(sh, r, c, v) {
  let cls = '', style = '';
  for (const rule of sh.cf) {
    const [a, b] = rule.range.split(':').map(PA); const bb = b || a;
    if (r < a.r || r > bb.r || c < a.c || c > bb.c) continue;
    const res = rule.rule(v);
    if (res === 'scale' && typeof v === 'number') { const [lo, hi] = rule.scale; const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo))); const [R, G, Bc] = rule.color; style += `background:rgba(${R},${G},${Bc},${0.12 + t * 0.5});`; }
    else if (res) cls += ' cf-' + res;
  }
  return { cls, style };
}

/* ---------- grid render ---------- */
function filteredOut(sh, r) {
  const f = st.filters[sh.id]; if (!f || !sh.filter || r <= sh.filter.row - 1 || r > (sh.lastRow || 999) - 1) return false;
  for (const [c, hidden] of Object.entries(f)) { if (hidden.size && hidden.has(display(sh, r, +c))) return true; }
  return false;
}
function cellHTML(sh, r, c, M) {
  const a = A(r, c), s = sh.cells[a];
  const comment = sh.comments[a], note = s && s.note;
  const tri = (note ? '<i class="tri-note" aria-hidden="true"></i>' : '') + (comment ? '<i class="tri-cmt" aria-hidden="true"></i>' : '');
  if (!s) return { html: tri, cls: '', style: '' };
  const v = val(sh, r, c); let cls = ' ' + (s.s || ''); let style = '';
  if (s.in && !s.chk) cls += ' input'; if (s.f) cls += ' fx';
  const fo = (FOV[sh.id] || {})[a] || {}; if (fo.b) cls += ' fb'; if (fo.i) cls += ' fi'; if (fo.st) cls += ' fs';
  const cf = cfClass(sh, r, c, v); cls += cf.cls; style += cf.style;
  if (s.f && /'[^']+'!|\b[A-Z][a-z]+!/.test(s.f) && !/HYPERLINK|SPARKLINE|IMAGE/.test(s.f)) cls += ' xlink';
  let html;
  if (st.showF && s.f) { html = esc(s.f); cls += ' showf'; }
  else if (s.chk) { html = `<span class="ms chk${v ? ' on' : ''}" aria-label="${v ? 'Checked' : 'Unchecked'}">${v ? 'check_box' : 'check_box_outline_blank'}</span>`; cls += ' c'; }
  else if (v && typeof v === 'object' && v.image) html = `<img class="cimg" src="${esc(v.image)}" alt="Photo of Pranav Shah">`;
  else if (v && typeof v === 'object' && v.spark) {
    const w = (M ? sumW(M.c1, M.c2) : colW(c)) - 10, h = (M ? sumH(M.r1, M.r2) : rowH(r)) - 8; const o = {}; const opt = v.opts; if (Array.isArray(opt)) { const fl = opt.flat(); for (let i = 0; i < fl.length; i += 2) o[fl[i]] = fl[i + 1]; }
    html = CH.spark(v.spark, o, Math.max(20, w), Math.max(10, h));
  } else if (v && typeof v === 'object' && v.link) {
    const ext = !/^#/.test(v.link) && !/^(read\.html|media\/)/.test(v.link);
    html = `<a class="hl" href="${esc(v.link)}"${ext ? ' target="_blank" rel="noopener"' : ''} data-link="${esc(v.link)}">${esc(v.label)}</a>`;
  } else {
    const t = display(sh, r, c);
    if (s.chip) html = t ? `<span class="chipv chip-${esc(String(t).toLowerCase().replace(/[^a-z]+/g, '-'))}">${esc(t)}<span class="ms">arrow_drop_down</span></span>` : '';
    else if (/basis/.test(s.s || '')) html = `<span class="bchip">${esc(t)}</span>`;
    else if (s.logo) html = `<img class="logo" src="${esc(s.logo)}" alt="">${esc(t)}`;
    else html = esc(t);
    if (isErr(v)) cls += ' err';
    if (typeof v === 'number' && !/\b(c|lab)\b/.test(s.s || '')) cls += ' num';
    if (typeof v === 'number' && v < 0 && !/neg/.test(cls)) cls += ' negv';
  }
  return { html: html + tri, cls, style };
}
function sumW(c1, c2) { let w = 0; for (let c = c1; c <= c2; c++) w += colW(c); return w; }
function sumH(r1, r2) { let h = 0; for (let r = r1; r <= r2; r++) h += rowH(r); return h; }

let cellEl = {};
function renderGrid(keepScroll = true) {
  const wrap = $('#gridwrap'); const sx = wrap.scrollLeft, sy = wrap.scrollTop;
  const before = new Map(); if (renderGrid.last === cur.id) $$('#grid td[data-a]').forEach(td => before.set(td.dataset.a, td.textContent));
  const nc = nCols(), nr = nRows(); const fz = freezeOf(cur);
  let h = `<table id="grid" class="g${st.grid ? '' : ' nogrid'}${cur.vtop ? ' vtop' : ''}" style="width:${HDR_W() + sumW(0, nc - 1)}px;font-size:${13 * st.zoom}px" role="grid" aria-label="${esc(cur.name)}"><colgroup><col style="width:${HDR_W()}px">`;
  for (let c = 0; c < nc; c++) h += `<col style="width:${colW(c)}px">`;
  h += `</colgroup><thead><tr style="height:${HDR_H()}px"><th class="corner"></th>`;
  for (let c = 0; c < nc; c++) { const filt = cur.filter && cur.filter.row && c >= cur.filter.c1 && c <= cur.filter.c2; h += `<th class="ch" data-c="${c}">${NC(c)}</th>`; void filt; }
  h += '</tr></thead><tbody>';
  cellEl = {};
  for (let r = 0; r < nr; r++) {
    const hide = filteredOut(cur, r);
    h += `<tr data-r="${r}" style="height:${rowH(r)}px${hide ? ';display:none' : ''}"${r === fz.r - 1 ? ' class="fz-r"' : ''}><th class="rh" data-r="${r}">${r + 1}</th>`;
    for (let c = 0; c < nc; c++) {
      if (cur.cov[r + ',' + c]) continue;
      const M = cur.mAt[r + ',' + c]; const { html, cls, style } = cellHTML(cur, r, c, M);
      let span = M ? ` colspan="${M.c2 - M.c1 + 1}" rowspan="${M.r2 - M.r1 + 1}"` : '';
      let k = cls;
      if (!M && html && !/wrap|chipv|cimg|spark|chk/.test(cls + html)) { const nx = cur.cells[A(r, c + 1)]; if (nx || cur.cov[r + ',' + (c + 1)] || cur.mAt[r + ',' + (c + 1)]) k += ' clip'; else k += ' ovf'; }
      if (c === fz.c - 1) k += ' fz-c';
      if (cur.filter && r === cur.filter.row - 1 && c >= cur.filter.c1 && c <= cur.filter.c2) { const on = st.filters[cur.id] && st.filters[cur.id][c] && st.filters[cur.id][c].size; k += ' fhdr'; span += ''; h += `<td data-a="${A(r, c)}" data-r="${r}" data-c="${c}" class="${k}" style="${style}"${span}>${html}<button class="fbtn${on ? ' on' : ''}" data-filter="${c}" aria-label="Filter column ${NC(c)}"><span class="ms">${on ? 'filter_alt' : 'filter_list'}</span></button></td>`; continue; }
      h += `<td data-a="${A(r, c)}" data-r="${r}" data-c="${c}" class="${k.trim()}" style="${style}"${span}>${html}</td>`;
    }
    h += '</tr>';
  }
  h += '</tbody></table>';
  $('#gin').innerHTML = h + '<div id="ovl"></div>';
  $$('#grid td[data-a]').forEach(td => { const r = +td.dataset.r, c = +td.dataset.c; const M = cur.mAt[r + ',' + c]; if (M) { for (let rr = M.r1; rr <= M.r2; rr++) for (let cc = M.c1; cc <= M.c2; cc++) cellEl[rr + ',' + cc] = td; } else cellEl[r + ',' + c] = td; });
  renderGrid.last = cur.id;
  applyFreeze();
  renderObjects();
  if (before.size) $$('#grid td[data-a]').forEach(td => { const b = before.get(td.dataset.a); if (b !== undefined && b !== td.textContent && td.textContent) { td.classList.add('chg'); setTimeout(() => td.classList.remove('chg'), 1300); } });
  if (keepScroll) { wrap.scrollLeft = sx; wrap.scrollTop = sy; }
  drawSel();
}
function applyFreeze() {
  const fz = freezeOf(cur); const tb = $('#grid');
  if (fz.r > 0) { let top = HDR_H(); for (let r = 0; r < fz.r; r++) { const tr = $(`#grid tr[data-r="${r}"]`); if (!tr) continue; $$('td,th', tr).forEach(el => { el.style.position = 'sticky'; el.style.top = top + 'px'; el.style.zIndex = el.tagName === 'TH' ? 6 : 4; }); top += tr.offsetHeight; } }
  if (fz.c > 0) { $$('#grid td[data-a]').forEach(td => { const c = +td.dataset.c; if (c < fz.c) { let left = HDR_W(); for (let k = 0; k < c; k++) left += colW(k); td.style.position = 'sticky'; td.style.left = left + 'px'; td.style.zIndex = Math.max(+td.style.zIndex || 0, 3); if (!td.style.background) td.classList.add('fzbg'); } }); }
  tb.classList.toggle('has-fz-r', fz.r > 0); tb.classList.toggle('has-fz-c', fz.c > 0);
}
function anchorXY(a) { const p = PA(a); const td = cellEl[p.r + ',' + p.c]; if (!td) return { x: 0, y: 0 }; return { x: td.offsetLeft, y: td.offsetTop }; }
function renderObjects() {
  const ovl = $('#ovl'); let h = '';
  const G = g(cur);
  (cur.images || []).forEach((im, i) => { const p = anchorXY(im.anchor); const w = Math.min(im.w * st.zoom, phone ? window.innerWidth - 50 : 9999); h += `<figure class="obj img" style="left:${p.x}px;top:${p.y}px;width:${w}px" data-obj="img${i}"><img src="${esc(im.src)}" alt="${esc(im.alt)}" loading="lazy"><figcaption>Image over cells · ${esc(im.alt)}</figcaption></figure>`; });
  (cur.charts || []).forEach((ch, i) => {
    const p = anchorXY(ch.anchor); const w = Math.min(ch.w, phone ? window.innerWidth - 50 : 9999) * st.zoom, hh = ch.h * st.zoom; let svg = '';
    try { const d = ch.data(G); d.w = w - 2; d.h = hh - 40; svg = CH[ch.type](d); } catch (e) { svg = '<p class="cherr">#REF! Chart data is not numeric.</p>'; }
    h += `<div class="obj chart${st.selChart === i ? ' on' : ''}" style="left:${p.x}px;top:${p.y}px;width:${w}px;height:${hh}px" data-chart="${i}" tabindex="0" aria-label="Chart: ${esc(ch.title)}"><div class="ch-t">${esc(ch.title)}</div>${svg}<span class="ch-h tl"></span><span class="ch-h tr"></span><span class="ch-h bl"></span><span class="ch-h br"></span></div>`;
  });
  ovl.innerHTML = h + '<div id="refs"></div><div id="rangebox" hidden></div><div id="selbox"><i class="handle"></i></div>';
  // make sure the grid is tall/wide enough to show objects
  let maxB = 0; $$('.obj', ovl).forEach(o => { maxB = Math.max(maxB, o.offsetTop + o.offsetHeight); });
  const tb = $('#grid'); if (maxB > tb.offsetHeight - 40) { cur.rows += Math.ceil((maxB - tb.offsetHeight + 120) / ROW_H); renderGrid(); }
}

/* ---------- selection ---------- */
function rectOf(r1, c1, r2, c2) {
  const a = cellEl[r1 + ',' + c1], b = cellEl[r2 + ',' + c2]; if (!a || !b) return null;
  const x = Math.min(a.offsetLeft, b.offsetLeft), y = Math.min(a.offsetTop, b.offsetTop);
  return { x, y, w: Math.max(a.offsetLeft + a.offsetWidth, b.offsetLeft + b.offsetWidth) - x, h: Math.max(a.offsetTop + a.offsetHeight, b.offsetTop + b.offsetHeight) - y };
}
const REFC = ['#e81a51', '#25d94e', '#e6b134', '#491880', '#00e39a', '#af1284'];
function drawSel() {
  const s = st.sel; const box = $('#selbox'), rb = $('#rangebox'); if (!box) return;
  const M = mergeOf(cur, s.r, s.c); const rc = M ? rectOf(M.r1, M.c1, M.r2, M.c2) : rectOf(s.r, s.c, s.r, s.c);
  if (rc) Object.assign(box.style, { left: rc.x - 1 + 'px', top: rc.y - 1 + 'px', width: rc.w + 1 + 'px', height: rc.h + 1 + 'px', display: '' });
  const r1 = Math.min(s.r, s.r2), r2 = Math.max(s.r, s.r2), c1 = Math.min(s.c, s.c2), c2 = Math.max(s.c, s.c2);
  if (r1 !== r2 || c1 !== c2) { const R = rectOf(r1, c1, r2, c2); if (R) { Object.assign(rb.style, { left: R.x - 1 + 'px', top: R.y - 1 + 'px', width: R.w + 1 + 'px', height: R.h + 1 + 'px' }); rb.hidden = false; } } else rb.hidden = true;
  $$('#grid .ch.on, #grid .rh.on').forEach(e => e.classList.remove('on'));
  for (let c = c1; c <= c2; c++) { const e = $(`#grid .ch[data-c="${c}"]`); e && e.classList.add('on'); }
  for (let r = r1; r <= r2; r++) { const e = $(`#grid .rh[data-r="${r}"]`); e && e.classList.add('on'); }
  // formula reference boxes
  const sp = spec(cur, s.r, s.c); let rh = '';
  if (sp && sp.f && !/^=(HYPERLINK|IMAGE)/.test(sp.f)) {
    ENG.refsOf(sp.f).forEach((rf, i) => {
      let t = rf; if (rf.name) { const n = WB.names[rf.name]; if (!n) return; const p = PA(n.a); t = { sheet: n.sheet, r1: p.r, c1: p.c, r2: p.r, c2: p.c }; }
      if (t.sheet && t.sheet !== cur.name) return; const R = rectOf(t.r1, t.c1, t.r2, t.c2); if (!R) return; const col = REFC[i % REFC.length];
      rh += `<div class="refbox" style="left:${R.x - 1}px;top:${R.y - 1}px;width:${R.w + 1}px;height:${R.h + 1}px;border-color:${col};background:${col}14"></div>`;
    });
  }
  $('#refs').innerHTML = rh;
  updateBars();
}
function updateBars() {
  const s = st.sel; const r1 = Math.min(s.r, s.r2), r2 = Math.max(s.r, s.r2), c1 = Math.min(s.c, s.c2), c2 = Math.max(s.c, s.c2);
  let nm = r1 === r2 && c1 === c2 ? A(s.r, s.c) : A(r1, c1) + ':' + A(r2, c2);
  const named = Object.entries(WB.names).find(([k, v]) => v.id === cur.id && v.a === nm); if (named) nm = named[0];
  $('#namebox').value = nm;
  const sp = spec(cur, s.r, s.c); const raw = rawText(cur, s.r, s.c);
  const fx = $('#fx-view');
  if (sp && sp.f) { let out = '', last = 0; ENG.refsOf(sp.f).forEach((rf, i) => { out += esc(sp.f.slice(last, rf.p)) + `<span class="fref" style="color:${REFC[i % REFC.length]}" data-ref="${esc(JSON.stringify(rf))}">${esc(sp.f.slice(rf.p, rf.e))}</span>`; last = rf.e; }); out += esc(sp.f.slice(last)); fx.innerHTML = out; }
  else fx.textContent = raw;
  const isIn = sp && sp.in && !sp.chk; $('#fbar').classList.toggle('is-input', !!isIn);
  $('#fx-hint').textContent = sp ? (isIn ? 'Input · press Enter to edit' : sp.chk ? 'Checkbox · Space to toggle' : sp.f ? 'Formula' : '') : '';
  $('#fx-fmt').textContent = sp && sp.fmt && sp.fmt !== 'blank' ? ENG.fmtLabel[fmtOf(cur, A(s.r, s.c)).fmt] || '' : '';
  // sum chip
  const chip = $('#sumchip');
  if (r1 !== r2 || c1 !== c2) {
    const nums = []; let cnt = 0;
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) { if (cur.cov[r + ',' + c]) continue; const v = val(cur, r, c); if (v !== null && v !== '') cnt++; if (typeof v === 'number') nums.push(v); }
    if (nums.length) { const f = { Sum: nums.reduce((a, b) => a + b, 0), Average: nums.reduce((a, b) => a + b, 0) / nums.length, Min: Math.min(...nums), Max: Math.max(...nums), Count: cnt }; const fmt = (spec(cur, r1, c1) || {}).fmt; chip.innerHTML = `${st.sumStat}: ${esc(st.sumStat === 'Count' ? f.Count : fmtValue(f[st.sumStat], /pct|x|n|acc|lakh|inr|cr|sgn/.test(fmt || '') ? fmt : 'n2'))}<span class="ms">arrow_drop_down</span>`; chip.hidden = false; chip._f = f; }
    else chip.hidden = true;
  } else chip.hidden = true;
  // mobile fx
  const mfx = $('#mfx'); if (phone) { $('#mfx-name').textContent = A(s.r, s.c); const inp = $('#mfx-in'); inp.value = raw; inp.readOnly = !isIn; mfx.classList.toggle('is-input', !!isIn); }
  showCellCard();
}
function select(r, c, r2, c2, scroll = true) {
  r = Math.max(0, r); c = Math.max(0, c);
  const M = mergeOf(cur, r, c); if (M && r2 === undefined) { r = M.r1; c = M.c1; }
  st.sel = { r, c, r2: r2 ?? r, c2: c2 ?? c }; st.selChart = null; $$('.obj.chart.on').forEach(e => e.classList.remove('on'));
  drawSel(); if (scroll) scrollTo(st.sel.r2, st.sel.c2);
}
function scrollTo(r, c) {
  const td = cellEl[r + ',' + c]; if (!td) return; const w = $('#gridwrap'); const fz = freezeOf(cur);
  let topFix = HDR_H(), leftFix = HDR_W(); for (let i = 0; i < fz.r; i++) { const tr = $(`#grid tr[data-r="${i}"]`); topFix += tr ? tr.offsetHeight : 0; } for (let i = 0; i < fz.c; i++) leftFix += colW(i);
  if (r >= fz.r) { if (td.offsetTop - topFix < w.scrollTop) w.scrollTop = td.offsetTop - topFix; else if (td.offsetTop + td.offsetHeight > w.scrollTop + w.clientHeight) w.scrollTop = td.offsetTop + td.offsetHeight - w.clientHeight + 4; }
  if (c >= fz.c) { if (td.offsetLeft - leftFix < w.scrollLeft) w.scrollLeft = td.offsetLeft - leftFix; else if (td.offsetLeft + Math.min(td.offsetWidth, w.clientWidth - leftFix) > w.scrollLeft + w.clientWidth) w.scrollLeft = td.offsetLeft + Math.min(td.offsetWidth, w.clientWidth - leftFix) - w.clientWidth + 4; }
}
function move(dr, dc, extend) {
  const s = st.sel; let r = extend ? s.r2 : s.r, c = extend ? s.c2 : s.c;
  const M = !extend && mergeOf(cur, r, c); if (M) { if (dr > 0) r = M.r2; if (dc > 0) c = M.c2; if (dr < 0) r = M.r1; if (dc < 0) c = M.c1; }
  r += dr; c += dc; r = Math.max(0, Math.min(nRows() - 1, r)); c = Math.max(0, Math.min(nCols() - 1, c));
  while (dr && r > 0 && r < nRows() - 1 && filteredOut(cur, r)) r += dr;
  if (extend) select(s.r, s.c, r, c); else select(r, c);
}
function jumpEdge(dr, dc, extend) {
  const s = st.sel; let r = extend ? s.r2 : s.r, c = extend ? s.c2 : s.c; const has = (rr, cc) => !!spec(cur, rr, cc);
  const maxR = nRows() - 1, maxC = nCols() - 1; const nx = () => [r + dr, c + dc]; const inb = (rr, cc) => rr >= 0 && cc >= 0 && rr <= maxR && cc <= maxC;
  let [nr, nc] = nx(); if (!inb(nr, nc)) return;
  if (has(r, c) && has(nr, nc)) { while (inb(r + dr, c + dc) && has(r + dr, c + dc)) { r += dr; c += dc; } }
  else { r = nr; c = nc; while (inb(r + dr, c + dc) && !has(r, c)) { r += dr; c += dc; } }
  if (extend) select(s.r, s.c, r, c); else select(r, c);
}

/* ---------- editing ---------- */
function parseInput(text, s) {
  const t = String(text).trim(); if (t === '') return { v: null };
  if (/^(true|false)$/i.test(t)) return { v: /^true$/i.test(t) };
  const pct = /%$/.test(t); const n = parseFloat(t.replace(/[₹,%x\s]|cr|lakh/gi, '').replace(/^\((.*)\)$/, '-$1').replace('−', '-'));
  if (!isNaN(n) && /^[-−(+]?[₹\s]*[\d,]*\.?\d+/.test(t.replace(/^\(/, ''))) { let v = pct ? n / 100 : n; if (!pct && /^(pct|spct)/.test(s.fmt || '') && Math.abs(n) >= 1) v = n / 100; if (/^\(.*\)$/.test(t)) v = -Math.abs(v); return { v }; }
  if (typeof s.v === 'number') return { err: 'This input expects a number.' };
  return { v: t };
}
function setInput(sh, a, v, rec = true) {
  OV[sh.id] = OV[sh.id] || {}; const old = rawInput(sh, a);
  if (old === v) return; OV[sh.id][a] = v; if (rec) { undoS.push({ sh: sh.id, a, old, v }); redoS.length = 0; }
  recalc(); if (sh === cur) renderGrid(); updateDirty();
}
function commitEdit(text, s, a) {
  const res = parseInput(text, s); if (res.err) { toast(res.err); return false; }
  setInput(cur, a, res.v); return true;
}
let editing = null;
function startEdit(initial) {
  const s = st.sel; const sp = spec(cur, s.r, s.c);
  if (!sp) { toast('Only the blue input cells can be changed in this portfolio.'); return; }
  if (sp.chk) { if (sp.in) setInput(cur, A(s.r, s.c), !rawInput(cur, A(s.r, s.c))); else toast('This checkbox is part of the write-up and stays as it is.'); return; }
  if (!sp.in) { protectedWarn(sp); return; }
  if (phone) { const i = $('#mfx-in'); i.focus(); i.select(); return; }
  const td = cellEl[s.r + ',' + s.c]; const ed = document.createElement('input'); ed.className = 'cell-ed'; ed.id = 'cell-ed';
  ed.value = initial !== undefined ? initial : rawText(cur, s.r, s.c); ed.setAttribute('aria-label', 'Edit ' + A(s.r, s.c));
  Object.assign(ed.style, { left: td.offsetLeft + 'px', top: td.offsetTop + 'px', minWidth: td.offsetWidth + 'px', height: td.offsetHeight + 'px', fontSize: 13 * st.zoom + 'px' });
  $('#ovl').appendChild(ed); ed.focus(); if (initial === undefined) ed.select(); else ed.setSelectionRange(ed.value.length, ed.value.length);
  editing = { ed, a: A(s.r, s.c), sp };
  $('#fx-view').textContent = ed.value; ed.addEventListener('input', () => { $('#fx-view').textContent = ed.value; });
  ed.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (finishEdit(true)) { e.key === 'Tab' ? move(0, e.shiftKey ? -1 : 1) : move(e.shiftKey ? -1 : 1, 0); } }
    else if (e.key === 'Escape') { e.preventDefault(); finishEdit(false); }
    e.stopPropagation();
  });
  ed.addEventListener('blur', () => { if (editing && editing.ed === ed) finishEdit(true); });
}
function finishEdit(commit) {
  if (!editing) return true; const { ed, a, sp } = editing; editing = null;
  let ok = true; if (commit) ok = commitEdit(ed.value, sp, a);
  ed.remove(); if (!ok) return false; drawSel(); $('#gridwrap').focus({ preventScroll: true }); return true;
}
function protectedWarn(sp) {
  const firstIn = Object.entries(cur.cells).find(([, x]) => x.in && !x.chk);
  dialog(`<h2>This cell is a formula</h2><p>${sp.f ? 'It holds <code>' + esc(sp.f) + '</code>, so it recalculates by itself.' : 'It is part of the write-up.'} Change a blue input cell instead and everything that depends on it will update, including the charts and the Cover tab.</p>`,
    [firstIn ? { t: 'Go to the first input', primary: true, act: () => { const p = PA(firstIn[0]); select(p.r, p.c); } } : null, { t: 'OK' }].filter(Boolean));
}
function undo() { const x = undoS.pop(); if (!x) return toast('Nothing to undo'); const sh = byId[x.sh]; OV[sh.id][x.a] = x.old; redoS.push(x); recalc(); if (sh !== cur) go(sh.id, x.a); else { renderGrid(); const p = PA(x.a); select(p.r, p.c); } updateDirty(); toast('Undone: ' + sh.name + '!' + x.a); }
function redo() { const x = redoS.pop(); if (!x) return toast('Nothing to redo'); const sh = byId[x.sh]; OV[sh.id][x.a] = x.v; undoS.push(x); recalc(); if (sh !== cur) go(sh.id, x.a); else { renderGrid(); const p = PA(x.a); select(p.r, p.c); } updateDirty(); }
function resetInputs() { Object.keys(OV).forEach(k => delete OV[k]); undoS.length = 0; redoS.length = 0; recalc(); renderGrid(); updateDirty(); toast('All inputs are back to his figures.'); }
function updateDirty() { const n = Object.values(OV).reduce((s, o) => s + Object.keys(o).length, 0); $('#savestate').innerHTML = n ? `<span class="ms">edit</span>${n} input${n > 1 ? 's' : ''} changed · <button class="lnk" id="reset-btn">Reset to his figures</button>` : '<span class="ms">cloud_done</span>His figures'; const b = $('#reset-btn'); b && (b.onclick = resetInputs); }

/* ---------- cell cards: notes and comments ---------- */
let hoverA = null;
function cardHTML(sh, a) {
  const s = sh.cells[a] || {}, cmt = sh.comments[a]; let h = '';
  if (cmt) { const ini = cmt.who.split(' ').map(x => x[0]).join(''); h += `<div class="cmt"><div class="cmt-h"><span class="av" style="background:${avCol(cmt.who)}">${esc(ini)}</span><div><b>${esc(cmt.who)}</b><small>${esc(cmt.role)}</small></div></div><p>${esc(cmt.text)}</p><small class="mute">${esc(cmt.rel)}</small><button class="lnk" data-open-comments>All comments</button></div>`; }
  if (s.note) h += `<div class="note"><p>${esc(s.note)}</p></div>`;
  return h;
}
const avCol = n => ['#511e8e', '#e81a51', '#00e39a', '#e6b134'][n.length % 4];
function showCellCard(a) {
  const card = $('#cellcard'); const s = st.sel; a = a || (hoverA || A(s.r, s.c));
  const h = cardHTML(cur, a); if (!h || editing) { card.hidden = true; return; }
  const p = PA(a); const td = cellEl[p.r + ',' + p.c]; if (!td) { card.hidden = true; return; }
  card.innerHTML = h; card.hidden = false;
  const r = td.getBoundingClientRect(); const cw = card.offsetWidth, ch = card.offsetHeight;
  let x = r.right + 6, y = r.top; if (x + cw > innerWidth - 8) x = Math.max(8, r.left - cw - 6); if (phone) { x = 8; y = r.bottom + 6; }
  if (y + ch > innerHeight - 70) y = Math.max(60, innerHeight - 70 - ch);
  card.style.left = x + 'px'; card.style.top = y + 'px';
}

/* ---------- side panel ---------- */
function projectTabs() { return WB.sheets.filter(s => s.project); }
function caseHTML(sh) {
  const slug = sh.project; const pr = P.projects.find(x => x.slug === slug) || {}, pg = P.project_pages[slug] || {};
  const idx = projectTabs().indexOf(sh), nxt = projectTabs()[idx + 1], prv = projectTabs()[idx - 1];
  const img = (pg.images || []).filter(x => !/thumb/.test(x)).slice(0, 2);
  return `<div class="cs">
    <div class="cs-meta"><span class="pill">${esc(pr.type)}</span>${esc(pr.org)} · ${esc(pg.dates || pr.year)}</div>
    <h3>${esc(pr.title)}</h3>
    <p class="cs-sum">${esc(pr.summary)}</p>
    <div class="cs-res">${(pg.results || []).map(r => `<div><b>${esc(r.value)}</b><span>${esc(r.metric)}</span><small>${esc(r.note)}</small></div>`).join('')}</div>
    <dl class="cs-dl"><dt>Role</dt><dd>${esc(pg.my_role || pr.role)}</dd><dt>Team</dt><dd>${esc(pr.team)}</dd><dt>Duration</dt><dd>${esc(pr.duration)}</dd></dl>
    <h4>Context</h4><p>${esc(pg.context)}</p>
    <h4>Problem</h4><p>${esc(pg.problem)}</p>
    <h4>What he did</h4><ol>${(pg.what_i_did || []).map(x => `<li>${esc(x)}</li>`).join('')}</ol>
    <h4>Decisions</h4>${(pg.decisions || []).map(d => `<div class="dec"><b>${esc(d.choice)}</b><p>${esc(d.why)}</p></div>`).join('')}
    ${pg.outcome ? `<h4>Outcome</h4><p>${esc(pg.outcome)}</p>` : ''}
    <h4>What he learned</h4><p>${esc(pg.learned)}</p>
    <h4>What he would do next</h4><p>${esc(pg.next)}</p>
    ${img.length ? `<h4>From his files</h4>${img.map(x => `<img src="media/${esc(x)}" alt="${esc(pr.title)}: ${esc(x.split('/').pop().replace('.jpg', ''))}" loading="lazy">`).join('')}` : ''}
    <div class="cs-nav">${prv ? `<a href="#gid=${prv.id}" class="btn-t"><span class="ms">chevron_left</span>${esc(prv.name)}</a>` : '<span></span>'}${nxt ? `<a href="#gid=${nxt.id}" class="btn-t">${esc(nxt.name)}<span class="ms">chevron_right</span></a>` : `<a href="#gid=exp" class="btn-t">Experience<span class="ms">chevron_right</span></a>`}</div>
  </div>`;
}
function aboutHTML() {
  return `<div class="cs"><img class="cs-photo" src="media/photos/professional-arms.jpg" alt="Pranav Shah, arms folded"><h3>${esc(P.person.first_name)} ${esc(P.person.last_name)}</h3><p class="cs-sum">${esc(P.person.headline)}</p>
  <h4>About</h4><p>${esc(P.about.intro)}</p><p>${esc(P.about.now)}</p>
  <h4>Looking for</h4><p>${esc(P.person.looking_for)}. Available from ${esc(P.person.available_from)}.</p>
  <h4>Why hire him</h4><ul>${P.pitch.why_hire.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
  <h4>Outside work</h4>${P.outside.map(o => `<p><b>${esc(o.title)}.</b> ${esc(o.detail)}</p>`).join('')}
  <div class="cs-nav"><span></span><a href="#gid=qoe" class="btn-t">First project: QoE bridge<span class="ms">chevron_right</span></a></div></div>`;
}
function commentsHTML() {
  const all = []; WB.sheets.forEach(sh => Object.entries(sh.comments).forEach(([a, c]) => all.push({ sh, a, c })));
  return `<p class="mute pad">${all.length} comment threads. Each is a testimonial left on the cell it talks about.</p>` + all.map(({ sh, a, c }) => `<div class="thread"><div class="cmt-h"><span class="av" style="background:${avCol(c.who)}">${esc(c.who.split(' ').map(x => x[0]).join(''))}</span><div><b>${esc(c.who)}</b><small>${esc(c.role)} · ${esc(c.rel)}</small></div></div><p>${esc(c.text)}</p><a class="lnk" href="#gid=${sh.id}&range=${a}">${esc(sh.name)}!${a}</a></div>`).join('');
}
function historyHTML() {
  return `<p class="mute pad">His career, shown as the workbook's versions. Select one to open it on the Experience tab.</p>` + [...P.journey].reverse().map((j, i) => `<a class="ver" href="#gid=exp&range=C${6 + P.journey.length - 1 - i}"><b>${esc(j.year)}</b><span>${esc(j.title)}</span><small><i class="dotp"></i>Pranav Shah${i === 0 ? ' · Current version' : ''}</small></a>`).join('');
}
function namesHTML() { return Object.entries(WB.names).map(([n, x]) => `<a class="ver" href="#gid=${x.id}&range=${x.a}"><b>${esc(n)}</b><small>'${esc(x.sheet)}'!${x.a} · ${esc(display(byId[x.id], PA(x.a).r, PA(x.a).c))}</small></a>`).join(''); }
function openPanel(mode, user = true) {
  st.panel = mode; if (user && mode === 'case') { st.panelPref = 1; store.set('panel', 1); }
  const t = { case: cur.project ? 'Case notes' : 'About Pranav', comments: 'Comments', history: 'Version history', names: 'Named ranges' }[mode];
  const sub = mode === 'case' ? (cur.project ? cur.name : 'Cover') : '';
  const body = mode === 'case' ? (cur.project ? caseHTML(cur) : aboutHTML()) : mode === 'comments' ? commentsHTML() : mode === 'history' ? historyHTML() : namesHTML();
  const side = $('#side'); side.innerHTML = `<div class="side-h"><span class="ms side-ic">${{ case: 'sticky_note_2', comments: 'comment', history: 'history', names: 'view_list' }[mode]}</span><div><h2 id="side-t">${esc(t)}</h2>${sub ? `<small>${esc(sub)}</small>` : ''}</div><button class="icon-btn" id="side-x" aria-label="Close panel"><span class="ms">close</span></button></div><div class="side-b">${body}</div>`;
  side.hidden = false; document.body.classList.add('side-open'); $('#side-x').onclick = () => closePanel(true);
  $$('.rail button').forEach(b => b.classList.toggle('on', b.dataset.panel === mode)); $('#explore').classList.toggle('on', mode === 'case');
  if (phone) { $('#scrim').hidden = false; side.classList.add('sheet'); }
  side.scrollTop = 0; $('.side-b', side).scrollTop = 0;
  setTimeout(() => { if (!phone) renderObjects(); drawSel(); }, 0);
}
function closePanel(user) { if (user && st.panel === 'case') { st.panelPref = 0; store.set('panel', 0); } st.panel = null; $('#side').hidden = true; document.body.classList.remove('side-open'); $$('.rail button').forEach(b => b.classList.remove('on')); $('#explore').classList.remove('on'); if (phone) $('#scrim').hidden = true; }

/* ---------- tabs ---------- */
function renderTabs() {
  $('#tabs').innerHTML = WB.sheets.map(sh => `<button class="tab${sh === cur ? ' on' : ''}" data-tab="${sh.id}" role="tab" aria-selected="${sh === cur}" style="--tc:${sh.color || 'transparent'}">${esc(sh.name)}<span class="ms tab-dd">arrow_drop_down</span></button>`).join('');
  const on = $('#tabs .tab.on'); on && on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

/* ---------- routing ---------- */
function parseHash() { const h = location.hash.replace(/^#/, ''); const o = {}; h.split('&').forEach(kv => { const [k, v] = kv.split('='); if (k) o[k] = decodeURIComponent(v || ''); }); return o; }
function go(id, range) { const h = '#gid=' + id + (range ? '&range=' + range : ''); if (location.hash === h) applyRoute(); else location.hash = h; }
function applyRoute() {
  closeTransient();
  const o = parseHash(); const sh = byId[o.gid] || byId.cover; const changed = sh !== cur;
  if (changed) {
    cur = sh; st.selChart = null; renderTabs(); $('#gridwrap').scrollTo(0, 0); renderGrid(false);
    document.title = `${cur.name} - Pranav Shah – Portfolio - Workbook`;
    if (!phone) {
      if (st.panel === 'case' || st.panel === null) { if (cur.project && st.panelPref && innerWidth >= 1180) openPanel('case', false); else if (st.panel === 'case') { if (cur.project) openPanel('case', false); else closePanel(false); } }
      else openPanel(st.panel, false);
    } else closePanel(false);
    $('#mcase').hidden = !cur.project;
  }
  if (o.range) { const [a, b] = o.range.split(':'); const p = PA(a); if (p) { const q = b ? PA(b) : p; select(p.r, p.c, q.r, q.c); } }
  else if (changed) { const first = cur.id === 'cover' ? 'B2' : (Object.entries(cur.cells).find(([, x]) => x.in && !x.chk) || ['A1'])[0]; const p = PA(first); select(p.r, p.c, undefined, undefined, false); $('#gridwrap').scrollTo(0, 0); }
}
function closeTransient() { closeMenus(); $('#dialog').hidden = true; $('#dialog').innerHTML = ''; $('#cellcard').hidden = true; if (phone && st.panel) closePanel(false); $('#scrim').hidden = true; if (editing) finishEdit(false); }

/* ---------- dialogs, toast ---------- */
function dialog(html, btns = [{ t: 'Close', primary: true }], cls = '') {
  const d = $('#dialog'); d.innerHTML = `<div class="dlg ${cls}" role="dialog" aria-modal="true" aria-labelledby="dlg-t">${html.replace('<h2>', '<h2 id="dlg-t">')}<div class="dlg-f">${btns.map((b, i) => `<button class="${b.primary ? 'btn-p' : 'btn-o'}${b.left ? ' left' : ''}" data-b="${i}">${b.icon ? `<span class="ms">${b.icon}</span>` : ''}${esc(b.t)}</button>`).join('')}</div></div>`;
  d.hidden = false; $$('[data-b]', d).forEach(el => el.onclick = () => { const b = btns[+el.dataset.b]; if (!b.keep) { d.hidden = true; d.innerHTML = ''; } b.act && b.act(); });
  const f = $('.btn-p', d) || $('button', d); f && f.focus();
  d.onclick = e => { if (e.target === d) { d.hidden = true; d.innerHTML = ''; } };
}
let toastT; function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200); }
async function copy(text, done) { try { await navigator.clipboard.writeText(text); toast(done); } catch (e) { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast(done); } catch (_) { toast(text); } ta.remove(); } }

function share() {
  const c = P.contact;
  dialog(`<h2>Share "Pranav Shah – Portfolio"</h2>
  <p class="mute sm">This is Pranav's contact card, laid out like the share dialog. Nothing is sent from here.</p>
  <div class="sh-sec">People with access</div>
  <div class="sh-row"><img src="media/photos/headshot.jpg" alt="" width="36" height="36"><div class="grow"><b>Pranav Shah</b><small>${esc(c.email)}</small></div><span class="mute sm">Owner</span></div>
  <div class="sh-acts"><button class="btn-o" data-copy-email><span class="ms">content_copy</span>Copy email</button><a class="btn-o" href="${esc(c.linkedin)}" target="_blank" rel="noopener"><span class="ms">open_in_new</span>LinkedIn</a><a class="btn-o" href="media/resume.pdf" download><span class="ms">download</span>Résumé (PDF)</a></div>
  <div class="sh-sec">General access</div>
  <div class="sh-row"><span class="ms sh-globe">public</span><div class="grow"><b>Anyone with the link</b><small>Can open and try every model. Changes stay in your browser.</small></div><span class="mute sm">Viewer</span></div>
  <p class="sm">Looking for: ${esc(P.person.looking_for)}. Available from ${esc(P.person.available_from)}.</p>`,
    [{ t: 'Copy link', icon: 'link', left: true, keep: true, act: () => copy(location.href, 'Link to this tab copied') }, { t: 'Done', primary: true }], 'dlg-share');
  $('[data-copy-email]').onclick = () => copy(c.email, 'Email copied: ' + c.email);
}
function shortcuts() {
  const k = [['Arrow keys', 'Move between cells'], ['Shift + arrows', 'Select a range (Sum appears bottom right)'], ['Ctrl/⌘ + arrows', 'Jump to the edge of the data'], ['Enter or F2', 'Edit a blue input cell'], ['Space', 'Toggle a checkbox'], ['Esc', 'Cancel an edit'], ['Ctrl/⌘ + Z / Y', 'Undo and redo input changes'], ['Ctrl + `', 'Show formulas'], ['Ctrl/⌘ + F', 'Find in the workbook'], ['Alt + ↓ / ↑', 'Next and previous tab'], ['Ctrl/⌘ + Alt + M', 'Open comments'], ['Ctrl/⌘ + /', 'This list']];
  dialog(`<h2>Keyboard shortcuts</h2><table class="kb">${k.map(([a, b]) => `<tr><td><kbd>${esc(a)}</kbd></td><td>${esc(b)}</td></tr>`).join('')}</table>`);
}

/* ---------- find ---------- */
let findHits = [], findI = 0;
function openFind() { const f = $('#findbox'); f.hidden = false; const i = $('#find-in'); i.focus(); i.select(); }
function runFind(q) {
  findHits = []; findI = 0; q = q.trim().toLowerCase(); if (!q) { $('#find-n').textContent = ''; return; }
  WB.sheets.forEach(sh => Object.keys(sh.cells).forEach(a => { const p = PA(a); const t = (display(sh, p.r, p.c) + ' ' + (sh.cells[a].note || '')).toLowerCase(); if (t.includes(q)) findHits.push({ sh, a }); }));
  $('#find-n').textContent = findHits.length ? `1 of ${findHits.length}` : 'No results'; if (findHits.length) gotoHit();
}
function gotoHit() { const h = findHits[findI]; $('#find-n').textContent = `${findI + 1} of ${findHits.length}`; const keep = $('#find-in').value; go(h.sh.id, h.a); $('#findbox').hidden = false; $('#find-in').value = keep; }

/* ---------- menus ---------- */
const MENUS = () => ({
  File: [{ t: 'Share', ic: 'person_add', act: share }, { t: 'Download résumé (PDF)', ic: 'download', act: () => { location.href = 'media/resume.pdf'; } }, { t: 'Plain résumé view', ic: 'description', act: () => { location.href = 'read.html'; } }, '-', { t: 'Version history (career)', ic: 'history', act: () => openPanel('history') }, { t: 'Print', ic: 'print', k: '⌘P', act: () => print() }, '-', { t: 'Make a copy', dis: 1 }, { t: 'Move to trash', dis: 1 }],
  Edit: [{ t: 'Undo', ic: 'undo', k: '⌘Z', act: undo }, { t: 'Redo', ic: 'redo', k: '⌘Y', act: redo }, '-', { t: 'Find in workbook', ic: 'search', k: '⌘F', act: openFind }, { t: 'Reset all inputs to his figures', ic: 'history', act: resetInputs }, '-', { t: 'Cut', dis: 1 }, { t: 'Paste', dis: 1 }],
  View: [{ t: 'Freeze', ic: 'grid_on', sub: [{ t: 'No rows', act: () => setFreeze('r', 0) }, { t: '1 row', act: () => setFreeze('r', 1) }, { t: '2 rows', act: () => setFreeze('r', 2) }, { t: `Up to row ${st.sel.r + 1}`, act: () => setFreeze('r', st.sel.r + 1) }, '-', { t: 'No columns', act: () => setFreeze('c', 0) }, { t: '1 column', act: () => setFreeze('c', 1) }, { t: '2 columns', act: () => setFreeze('c', 2) }, { t: `Up to column ${NC(st.sel.c)}`, act: () => setFreeze('c', st.sel.c + 1) }] },
    { t: 'Show', ic: 'visibility', sub: [{ t: 'Gridlines', chk: st.grid, act: () => { st.grid = !st.grid; renderGrid(); } }, { t: 'Formulas', k: 'Ctrl+`', chk: st.showF, act: toggleF }, { t: 'Formula bar', chk: !$('#fbar').hidden, act: () => { $('#fbar').hidden = !$('#fbar').hidden; } }] },
    { t: 'Zoom', ic: 'zoom_in', sub: [50, 75, 90, 100, 125, 150, 200].map(z => ({ t: z + '%', chk: Math.round(st.zoom * 100) === z, act: () => setZoom(z / 100) })) }, '-', { t: 'Case notes', ic: 'sticky_note_2', act: () => openPanel('case') }, { t: 'Comments', ic: 'comment', act: () => openPanel('comments') }],
  Insert: [{ t: 'Comment', ic: 'add_comment', k: '⌘⌥M', act: () => openPanel('comments') }, { t: 'Note', dis: 1 }, { t: 'Chart', dis: 1 }, { t: 'Checkbox', dis: 1 }, { t: 'Dropdown', dis: 1 }],
  Format: [{ t: 'Number', ic: 'percent', sub: [{ t: 'Automatic', act: () => setFmt('auto') }, { t: 'Number', act: () => setFmt('n2') }, { t: 'Percent', act: () => setFmt('pct1') }, { t: 'Currency (₹ cr)', act: () => setFmt('cr1') }, { t: 'Multiple (0.0x)', act: () => setFmt('x1') }] }, { t: 'Bold', ic: 'format_bold', k: '⌘B', act: () => toggleStyle('b') }, { t: 'Italic', ic: 'format_italic', k: '⌘I', act: () => toggleStyle('i') }, { t: 'Clear formatting changes', act: () => { delete FOV[cur.id]; renderGrid(); } }],
  Data: [{ t: cur.filter ? 'Remove filter' : 'Create a filter', ic: 'filter_alt', dis: !cur.filter, act: () => { st.filters[cur.id] = {}; renderGrid(); } }, { t: 'Named ranges', ic: 'view_list', act: () => openPanel('names') }, { t: 'Data validation', dis: 1 }, { t: 'Protect sheets and ranges', dis: 1 }],
  Tools: [{ t: 'Spelling', dis: 1 }, { t: 'Notification settings', dis: 1 }],
  Extensions: [{ t: 'Add-ons', dis: 1 }, { t: 'Apps Script', dis: 1 }],
  Help: [{ t: 'Keyboard shortcuts', ic: 'keyboard', k: '⌘/', act: shortcuts }, { t: 'Take the tour again', ic: 'info', act: () => { store.set('tour', 0); tour.start(true); } }, { t: 'Plain résumé view', ic: 'description', act: () => { location.href = 'read.html'; } }, '-', { t: 'About this portfolio', ic: 'help', act: () => dialog(`<h2>About this workbook</h2><p>A portfolio by Pranav Shah, built as a working spreadsheet workbook. Not affiliated with any spreadsheet product.</p><p>Fictional persona: every person, deal and number here is made up. Each tab is one part of his portfolio. Blue cells are inputs; every other number is a formula you can inspect in the formula bar.</p>`) }]
});
function menuHTML(items) { return items.map((it, i) => it === '-' ? '<hr>' : `<button class="mi${it.dis ? ' dis' : ''}" data-i="${i}" ${it.dis ? 'aria-disabled="true"' : ''}><span class="ms mi-ic">${it.chk ? 'check' : (it.ic || '')}</span><span class="mi-t">${esc(it.t)}</span>${it.k ? `<span class="mi-k">${esc(it.k)}</span>` : ''}${it.sub ? '<span class="ms mi-k">arrow_right</span>' : ''}</button>`).join(''); }
function openMenu(btn, items) {
  closeMenus(); const m = document.createElement('div'); m.className = 'menu'; m.setAttribute('role', 'menu'); m.innerHTML = menuHTML(items); document.body.appendChild(m);
  const r = btn.getBoundingClientRect(); m.style.left = Math.min(r.left, innerWidth - m.offsetWidth - 8) + 'px'; m.style.top = r.bottom + 2 + 'px';
  btn.classList.add('open');
  m.addEventListener('click', e => { const b = e.target.closest('.mi'); if (!b) return; const it = items[+b.dataset.i]; if (it.dis) return; if (it.sub) { openSub(b, it.sub); return; } closeMenus(); it.act && it.act(); });
  m.addEventListener('mouseover', e => { const b = e.target.closest('.mi'); if (!b) return; const it = items[+b.dataset.i]; if (it.sub) openSub(b, it.sub); else $$('.menu.sub').forEach(x => x.remove()); });
  const f = $('.mi:not(.dis)', m); f && f.focus();
}
function openSub(b, items) {
  $$('.menu.sub').forEach(x => x.remove()); const m = document.createElement('div'); m.className = 'menu sub'; m.innerHTML = menuHTML(items); document.body.appendChild(m);
  const r = b.getBoundingClientRect(); m.style.left = (r.right + m.offsetWidth > innerWidth ? r.left - m.offsetWidth : r.right) + 'px'; m.style.top = r.top + 'px';
  m.addEventListener('click', e => { const x = e.target.closest('.mi'); if (!x) return; const it = items[+x.dataset.i]; if (it.dis) return; closeMenus(); it.act && it.act(); });
}
function closeMenus() { $$('.menu').forEach(m => m.remove()); $$('.mb.open, .tbb.open').forEach(b => b.classList.remove('open')); }
function setFreeze(k, n) { const f = Object.assign({}, freezeOf(cur)); f[k] = n; st.freeze[cur.id] = f; renderGrid(); toast(n ? `Frozen ${n} ${k === 'r' ? 'row' : 'column'}${n > 1 ? 's' : ''}` : 'Unfrozen'); }
function setZoom(z) { st.zoom = z; $('#zoom-l').textContent = Math.round(z * 100) + '%'; renderGrid(); }
function toggleF() { st.showF = !st.showF; renderGrid(); toast(st.showF ? 'Showing formulas. Press Ctrl + ` to hide them.' : 'Showing values'); }
function selCells(fn) { const s = st.sel; for (let r = Math.min(s.r, s.r2); r <= Math.max(s.r, s.r2); r++) for (let c = Math.min(s.c, s.c2); c <= Math.max(s.c, s.c2); c++) { const a = A(r, c); if (cur.cells[a]) { FOV[cur.id] = FOV[cur.id] || {}; FOV[cur.id][a] = FOV[cur.id][a] || {}; fn(FOV[cur.id][a], cur.cells[a]); } } renderGrid(); }
const setFmt = f => selCells(o => { o.fmt = f; o.d = 0; });
const toggleStyle = k => selCells(o => { o[k] = !o[k]; });

/* ---------- filter menu ---------- */
function openFilter(btn, c) {
  closeMenus(); const sh = cur; const vals = new Set(); for (let r = sh.filter.row; r < sh.lastRow; r++) vals.add(display(sh, r, c));
  const hidden = (st.filters[sh.id] || {})[c] || new Set(); const m = document.createElement('div'); m.className = 'menu filt';
  m.innerHTML = `<div class="ft">Filter by values</div><div class="fa"><button class="lnk" data-all>Select all</button> · <button class="lnk" data-none>Clear</button></div><div class="fl">${[...vals].sort().map(v => `<label><input type="checkbox" value="${esc(v)}" ${hidden.has(v) ? '' : 'checked'}> ${esc(v)}</label>`).join('')}</div><div class="dlg-f"><button class="btn-o" data-cancel>Cancel</button><button class="btn-p" data-ok>OK</button></div>`;
  document.body.appendChild(m); const r = btn.getBoundingClientRect(); m.style.left = Math.min(r.left, innerWidth - m.offsetWidth - 8) + 'px'; m.style.top = Math.min(r.bottom + 2, innerHeight - m.offsetHeight - 8) + 'px';
  $('[data-all]', m).onclick = () => $$('input', m).forEach(i => i.checked = true); $('[data-none]', m).onclick = () => $$('input', m).forEach(i => i.checked = false);
  $('[data-cancel]', m).onclick = closeMenus;
  $('[data-ok]', m).onclick = () => { const hid = new Set($$('input', m).filter(i => !i.checked).map(i => i.value)); st.filters[sh.id] = st.filters[sh.id] || {}; st.filters[sh.id][c] = hid; closeMenus(); renderGrid(); const shown = []; for (let rr = sh.filter.row; rr < sh.lastRow; rr++) if (!filteredOut(sh, rr)) shown.push(rr); toast(`${shown.length} of ${sh.lastRow - sh.filter.row} rows shown`); };
}

/* ---------- tour ---------- */
const tour = {
  steps: () => [
    { el: '#tabs', t: 'Each tab holds one piece of his portfolio', p: 'Cover gives the summary. Each project then has a working model of its own, followed by Experience, Skills and Testimonials.' },
    { el: '#fbar', t: 'Click a number to see its formula', p: 'Blue numbers are inputs. Change one and the model, its chart and the Cover recalculate.' },
    { el: phone ? '#mcase' : '#rail-case', t: 'Case notes', p: 'The write-up for the tab you are on: context, problem, what he did, decisions, results and what he learned.' },
    { el: phone ? '#m-share' : '#share-btn', t: 'Share is how you contact him', p: 'It opens his contact card: copy his email, open LinkedIn or download the résumé.' }
  ],
  i: 0,
  start(force) {
    if (!force && store.get('tour', 0)) return;
    if (phone && !force) { const w = $('#gridwrap'); const h = () => { w.removeEventListener('scroll', h); setTimeout(() => this.show(0), 400); }; w.addEventListener('scroll', h, { passive: true }); return; }
    setTimeout(() => this.show(0), force ? 50 : 900);
  },
  show(i) {
    const steps = this.steps(); const s = steps[i]; const c = $('#coach'); if (!s) return this.end();
    this.i = i; const el = $(s.el); if (!el || el.hidden || !el.offsetParent) { return this.show(i + 1); }
    c.innerHTML = `<b>${esc(s.t)}</b><p>${esc(s.p)}</p><div class="c-f"><span>${i + 1} of ${steps.length}</span><button class="c-skip">Dismiss</button><button class="c-next">${i === steps.length - 1 ? 'Got it' : 'Next'}</button></div>`;
    c.hidden = false; c.className = 'coach' + (phone ? ' m' : '');
    let ring = $('.coach-ring'); if (!ring) { ring = document.createElement('div'); ring.className = 'coach-ring'; document.body.appendChild(ring); }
    const r = el.getBoundingClientRect(); Object.assign(ring.style, { left: r.left - 3 + 'px', top: r.top - 3 + 'px', width: r.width + 6 + 'px', height: r.height + 6 + 'px' });
    if (!phone) {
      // keep the card in the empty area to the right of the Cover content, never over the photo or KPIs
      const cw = c.offsetWidth, ch = c.offsetHeight; const gridR = $('#gridwrap').getBoundingClientRect(); const right = (st.panel ? $('#side').getBoundingClientRect().left : gridR.right) - 16;
      let x = Math.max(gridR.left + 16, right - cw), y;
      if (s.el === '#tabs') y = r.top - ch - 14; else if (s.el === '#fbar') y = r.bottom + 12; else if (s.el === '#share-btn') { y = r.bottom + 12; x = Math.min(x, r.right - cw); } else { y = Math.max(r.top, gridR.top + 12); x = r.left - cw - 14; }
      const cover = cur.id === 'cover' ? sumW(0, cur.cols.length - 1) + HDR_W() + gridR.left : 0;
      if (cover && x < cover && s.el !== '#share-btn') { c.classList.add('slim'); }
      c.style.left = x + 'px'; c.style.top = y + 'px';
    } else { c.style.left = ''; c.style.top = ''; }
    $('.c-next', c).onclick = () => this.show(i + 1); $('.c-skip', c).onclick = () => this.end();
  },
  end() { store.set('tour', 1); $('#coach').hidden = true; const r = $('.coach-ring'); r && r.remove(); }
};

/* ---------- events ---------- */
function bind() {
  const wrap = $('#gridwrap');
  let dragging = false;
  wrap.addEventListener('mousedown', e => {
    if (e.target.closest('.obj.chart')) { const i = +e.target.closest('.obj.chart').dataset.chart; st.selChart = i; $$('.obj.chart').forEach(x => x.classList.toggle('on', +x.dataset.chart === i)); return; }
    if (e.target.closest('.fbtn')) return; if (e.target.closest('a.hl')) return; if (e.target.closest('.cell-ed')) return;
    const td = e.target.closest('td[data-a]'); const ch = e.target.closest('th.ch'), rh = e.target.closest('th.rh');
    if (editing) finishEdit(true);
    if (ch) { const c = +ch.dataset.c; select(0, c, nRows() - 1, c, false); return; }
    if (rh) { const r = +rh.dataset.r; select(r, 0, r, nCols() - 1, false); return; }
    if (!td) return; const r = +td.dataset.r, c = +td.dataset.c;
    if (e.shiftKey) select(st.sel.r, st.sel.c, r, c, false); else { select(r, c, undefined, undefined, false); dragging = true; }
    wrap.focus({ preventScroll: true });
  });
  wrap.addEventListener('mousemove', e => {
    const td = e.target.closest('td[data-a]');
    if (dragging && td && e.buttons) { const r = +td.dataset.r, c = +td.dataset.c; if (r !== st.sel.r2 || c !== st.sel.c2) { st.sel.r2 = r; st.sel.c2 = c; drawSel(); } }
    if (!phone) { const a = td && (cur.comments[td.dataset.a] || (cur.cells[td.dataset.a] || {}).note) ? td.dataset.a : null; if (a !== hoverA) { hoverA = a; showCellCard(); } }
  });
  document.addEventListener('mouseup', () => { dragging = false; });
  wrap.addEventListener('click', e => {
    const fb = e.target.closest('.fbtn'); if (fb) { openFilter(fb, +fb.dataset.filter); return; }
    const a = e.target.closest('a.hl'); if (a) { const l = a.dataset.link; if (l === '#share') { e.preventDefault(); share(); } else if (/^#gid=/.test(l)) { e.preventDefault(); location.hash = l; } return; }
    const chk = e.target.closest('.chk'); if (chk) { const td = chk.closest('td'); const sp = cur.cells[td.dataset.a]; if (sp && sp.in) setInput(cur, td.dataset.a, !rawInput(cur, td.dataset.a)); else toast('This checkbox is part of the write-up and stays as it is.'); return; }
    if (phone) { const td = e.target.closest('td[data-a]'); if (td) { const r = +td.dataset.r, c = +td.dataset.c; if (st.sel.r === r && st.sel.c === c && st.sel.r2 === r && st.sel.c2 === c && wrap._last === td.dataset.a) { const sp = spec(cur, r, c); if (sp && sp.in) startEdit(); } else select(r, c, undefined, undefined, false); wrap._last = td.dataset.a; } }
  });
  wrap.addEventListener('dblclick', e => { const td = e.target.closest('td[data-a]'); if (td && !e.target.closest('a.hl')) startEdit(); });
  wrap.addEventListener('scroll', () => { $('#cellcard').hidden = true; }, { passive: true });
  if (phone) wrap.addEventListener('touchstart', () => { }, { passive: true });

  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase(); const inField = tag === 'input' || tag === 'textarea';
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Escape') { if ($('.menu')) return closeMenus(); if (!$('#dialog').hidden) { $('#dialog').hidden = true; $('#dialog').innerHTML = ''; return; } if (!$('#findbox').hidden) { $('#findbox').hidden = true; return; } if (st.panel && phone) return closePanel(false); return; }
    if (mod && e.key.toLowerCase() === 'f') { e.preventDefault(); openFind(); return; }
    if (inField || !$('#dialog').hidden) return;
    if (mod && e.key === '/') { e.preventDefault(); shortcuts(); return; }
    if (e.ctrlKey && (e.key === '`' || e.code === 'Backquote')) { e.preventDefault(); toggleF(); return; }
    if (mod && e.altKey && e.code === 'KeyM') { e.preventDefault(); openPanel('comments'); return; }
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); toggleStyle('b'); return; }
    if (mod && e.key.toLowerCase() === 'i') { e.preventDefault(); toggleStyle('i'); return; }
    if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp') || (mod && e.shiftKey && (e.key === 'PageDown' || e.key === 'PageUp'))) { e.preventDefault(); const i = WB.sheets.indexOf(cur) + (e.key === 'ArrowDown' || e.key === 'PageDown' ? 1 : -1); const sh = WB.sheets[(i + WB.sheets.length) % WB.sheets.length]; go(sh.id); return; }
    if ($('.menu')) return;
    const k = e.key;
    const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (arrows[k]) { e.preventDefault(); const [dr, dc] = arrows[k]; mod ? jumpEdge(dr, dc, e.shiftKey) : move(dr, dc, e.shiftKey); return; }
    if (k === 'Tab') { e.preventDefault(); move(0, e.shiftKey ? -1 : 1); return; }
    if (k === 'Enter') { e.preventDefault(); const sp = spec(cur, st.sel.r, st.sel.c); if (sp && sp.in && !sp.chk) startEdit(); else { const v = val(cur, st.sel.r, st.sel.c); if (v && v.link) { v.link === '#share' ? share() : /^#/.test(v.link) ? (location.hash = v.link) : window.open(v.link, '_blank', 'noopener'); } else move(e.shiftKey ? -1 : 1, 0); } return; }
    if (k === 'F2') { e.preventDefault(); startEdit(); return; }
    if (k === ' ') { const sp = spec(cur, st.sel.r, st.sel.c); if (sp && sp.chk) { e.preventDefault(); startEdit(); return; } }
    if (k === 'Home') { e.preventDefault(); mod ? select(0, 0) : select(st.sel.r, 0); return; }
    if (k === 'PageDown' || k === 'PageUp') { e.preventDefault(); move(k === 'PageDown' ? 20 : -20, 0); return; }
    if ((k === 'Delete' || k === 'Backspace')) { const sp = spec(cur, st.sel.r, st.sel.c); if (sp && sp.in && !sp.chk) { e.preventDefault(); setInput(cur, A(st.sel.r, st.sel.c), null); toast('Input cleared. Ctrl/⌘ + Z puts his figure back.'); } return; }
    if (k.length === 1 && !mod && !e.altKey && document.activeElement && (document.activeElement === document.body || document.activeElement.id === 'gridwrap')) { const sp = spec(cur, st.sel.r, st.sel.c); if (sp && sp.in && !sp.chk) { e.preventDefault(); startEdit(k); } else if (sp || /[\w=]/.test(k)) { e.preventDefault(); sp ? protectedWarn(sp) : toast('Only the blue input cells can be changed in this portfolio.'); } }
  });

  // name box
  const nb = $('#namebox');
  nb.addEventListener('focus', () => nb.select());
  nb.addEventListener('keydown', e => {
    if (e.key !== 'Enter') { if (e.key === 'Escape') { nb.blur(); updateBars(); } return; }
    e.preventDefault(); let q = nb.value.trim(); const nm = Object.keys(WB.names).find(n => n.toLowerCase() === q.toLowerCase());
    if (nm) { const x = WB.names[nm]; go(x.id, x.a); $('#gridwrap').focus(); return; }
    let shId = cur.id; const m = /^'?([^'!]+)'?!(.+)$/.exec(q); if (m) { const sh = byName[m[1]] || WB.sheets.find(s => s.name.toLowerCase() === m[1].toLowerCase()); if (!sh) return toast('No tab called ' + m[1]); shId = sh.id; q = m[2]; }
    const parts = q.toUpperCase().split(':'); if (parts.every(p => PA(p))) { go(shId, parts.join(':')); $('#gridwrap').focus(); } else toast('Type a cell like C12, a range like B7:C15, or a named range.');
  });
  $('#namebox-dd').onclick = e => openMenu(e.currentTarget, [...Object.entries(WB.names).map(([n, x]) => ({ t: n, k: x.sheet, act: () => go(x.id, x.a) })), '-', { t: 'Manage named ranges', ic: 'view_list', act: () => openPanel('names') }]);
  // formula bar: click a reference to jump to it; click into an input to edit
  $('#fx-view').addEventListener('click', e => {
    const f = e.target.closest('.fref'); if (f) { const rf = JSON.parse(f.dataset.ref); if (rf.name) { const x = WB.names[rf.name]; if (x) go(x.id, x.a); return; } const sh = rf.sheet ? byName[rf.sheet] : cur; go(sh.id, A(rf.r1, rf.c1) + (rf.r2 !== rf.r1 || rf.c2 !== rf.c1 ? ':' + A(rf.r2, rf.c2) : '')); return; }
    const sp = spec(cur, st.sel.r, st.sel.c); if (sp && sp.in && !sp.chk) startEdit();
  });
  // menus
  $$('.mb').forEach(b => b.addEventListener('click', () => { if (b.classList.contains('open')) return closeMenus(); openMenu(b, MENUS()[b.dataset.menu]); }));
  $$('.mb').forEach(b => b.addEventListener('mouseenter', () => { if ($('.mb.open') && !b.classList.contains('open')) openMenu(b, MENUS()[b.dataset.menu]); }));
  document.addEventListener('mousedown', e => { if (!e.target.closest('.menu, .mb, .tbb, #namebox-dd, #sumchip, #alltabs')) closeMenus(); if (!e.target.closest('#cellcard, td')) $('#cellcard').hidden = true; });
  $('#cellcard').addEventListener('click', e => { if (e.target.closest('[data-open-comments]')) openPanel('comments'); });
  // toolbar
  const TB = {
    undo, redo, print: () => print(), zoom: e => openMenu(e.currentTarget, [50, 75, 90, 100, 125, 150, 200].map(z => ({ t: z + '%', chk: Math.round(st.zoom * 100) === z, act: () => setZoom(z / 100) }))),
    cur: () => setFmt('cr1'), pct: () => setFmt('pct1'), dec: () => selCells(o => { o.d = (o.d || 0) - 1; }), inc: () => selCells(o => { o.d = (o.d || 0) + 1; }),
    fmt: e => openMenu(e.currentTarget, MENUS().Format[0].sub), bold: () => toggleStyle('b'), italic: () => toggleStyle('i'), strike: () => toggleStyle('st'),
    link: () => copy(location.href.split('#')[0] + '#gid=' + cur.id + '&range=' + A(st.sel.r, st.sel.c), 'Link to ' + cur.name + '!' + A(st.sel.r, st.sel.c) + ' copied'),
    comment: () => openPanel('comments'), chart: () => { if (cur.charts.length) { st.selChart = 0; renderObjects(); drawSel(); const el = $('.obj.chart'); el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); toast(`${cur.charts.length} chart${cur.charts.length > 1 ? 's' : ''} on this tab, drawn from the cells. Change an input and they redraw.`); } else toast('No chart on this tab.'); },
    filter: () => { if (cur.filter) { st.filters[cur.id] = {}; renderGrid(); toast('Filter cleared'); } else toast('Skills has a filter on its header row.'); },
    fn: e => openMenu(e.currentTarget, ['SUM', 'AVERAGE', 'MEDIAN', 'MIN', 'MAX', 'COUNT'].map(f => ({ t: f, act: () => toast(`${f} is used in this workbook. Select a formula cell to see where.`) }))),
    locked: () => toast('Formatting is fixed in this portfolio. Blue input cells are the ones you can change.')
  };
  $$('[data-tb]').forEach(b => b.addEventListener('click', e => (TB[b.dataset.tb] || TB.locked)(e)));
  $('#menu-search').addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase(); closeMenus(); if (!q) return; const all = []; Object.entries(MENUS()).forEach(([k, items]) => items.forEach(it => { if (it === '-' || it.dis) return; if (it.sub) it.sub.forEach(s => s !== '-' && all.push(Object.assign({}, s, { t: it.t + ' › ' + s.t }))); else all.push(Object.assign({}, it, { t: k + ' › ' + it.t })); }));
    const hits = all.filter(x => x.t.toLowerCase().includes(q)).slice(0, 8); if (hits.length) openMenu(e.target, hits); $('#menu-search').focus();
  });
  // header
  $('#share-btn').onclick = share; $('#m-share').onclick = share;
  $('#hist-btn').onclick = () => openPanel('history'); $('#cmt-btn').onclick = () => openPanel('comments'); $('#m-cmt').onclick = () => openPanel('comments');
  $('#star').onclick = e => { const on = e.currentTarget.classList.toggle('on'); e.currentTarget.querySelector('.ms').style.fontVariationSettings = on ? "'FILL' 1" : ''; toast(on ? 'Starred' : 'Removed from Starred'); };
  $('#avatar').onclick = () => dialog(`<h2>Pranav Shah</h2><p>${esc(P.person.headline)}. ${esc(P.person.current)}.</p><p class="mute sm">A portfolio by Pranav Shah, built as a working spreadsheet workbook. Not affiliated with any spreadsheet product. Fictional persona: every person, deal and number here is made up.</p>`, [{ t: 'Plain résumé view', left: true, act: () => { location.href = 'read.html'; } }, { t: 'Contact', primary: true, act: share }]);
  $$('.rail button').forEach(b => b.onclick = () => (st.panel === b.dataset.panel ? closePanel(true) : openPanel(b.dataset.panel)));
  $('#explore').onclick = () => (st.panel === 'case' ? closePanel(true) : openPanel('case'));
  $('#mcase').onclick = () => openPanel('case');
  $('#m-more').onclick = e => openMenu(e.currentTarget, [{ t: 'Case notes', ic: 'sticky_note_2', act: () => openPanel('case') }, { t: 'Comments', ic: 'comment', act: () => openPanel('comments') }, { t: 'Version history (career)', ic: 'history', act: () => openPanel('history') }, { t: st.showF ? 'Show values' : 'Show formulas', ic: 'functions', act: toggleF }, { t: 'Reset inputs', ic: 'undo', act: resetInputs }, '-', { t: 'Plain résumé view', ic: 'description', act: () => { location.href = 'read.html'; } }, { t: 'Download résumé (PDF)', ic: 'download', act: () => { location.href = 'media/resume.pdf'; } }, { t: 'Take the tour again', ic: 'info', act: () => { store.set('tour', 0); tour.start(true); } }]);
  // tabs
  $('#tabs').addEventListener('click', e => { const t = e.target.closest('.tab'); if (!t) return; if (e.target.closest('.tab-dd') && t.classList.contains('on')) { openMenu(t, [{ t: 'Open Case notes', ic: 'sticky_note_2', dis: !cur.project, act: () => openPanel('case') }, { t: 'Copy link to this tab', ic: 'link', act: () => copy(location.href.split('#')[0] + '#gid=' + cur.id, 'Link copied') }, '-', { t: 'Delete', dis: 1 }, { t: 'Duplicate', dis: 1 }, { t: 'Rename', dis: 1 }]); return; } go(t.dataset.tab); });
  $('#alltabs').onclick = e => openMenu(e.currentTarget, WB.sheets.map(sh => ({ t: sh.name, chk: sh === cur, act: () => go(sh.id) })));
  $('#addtab').onclick = () => toast('New tabs are off in this portfolio. Share opens his contact card.');
  $('#tabs-l').onclick = () => $('#tabs').scrollBy({ left: -200, behavior: 'smooth' }); $('#tabs-r').onclick = () => $('#tabs').scrollBy({ left: 200, behavior: 'smooth' });
  $('#sumchip').onclick = e => { const f = e.currentTarget._f; openMenu(e.currentTarget, ['Sum', 'Average', 'Min', 'Max', 'Count'].map(k => ({ t: k + ': ' + (k === 'Count' ? f.Count : fmtValue(f[k], 'n2')), chk: st.sumStat === k, act: () => { st.sumStat = k; updateBars(); } }))); };
  // find
  $('#find-in').addEventListener('input', e => runFind(e.target.value));
  $('#find-in').addEventListener('keydown', e => { if (e.key === 'Enter' && findHits.length) { findI = (findI + (e.shiftKey ? -1 : 1) + findHits.length) % findHits.length; gotoHit(); } if (e.key === 'Escape') $('#findbox').hidden = true; e.stopPropagation(); });
  $('#find-up').onclick = () => { if (findHits.length) { findI = (findI - 1 + findHits.length) % findHits.length; gotoHit(); } };
  $('#find-dn').onclick = () => { if (findHits.length) { findI = (findI + 1) % findHits.length; gotoHit(); } };
  $('#find-x').onclick = () => { $('#findbox').hidden = true; };
  // mobile fx edit
  $('#mfx-in').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#mfx-ok').click(); } e.stopPropagation(); });
  $('#mfx-ok').onclick = () => { const sp = spec(cur, st.sel.r, st.sel.c); if (sp && sp.in && !sp.chk) { if (commitEdit($('#mfx-in').value, sp, A(st.sel.r, st.sel.c))) { $('#mfx-in').blur(); toast('Recalculated'); } } else if (sp && !sp.in) protectedWarn(sp); };
  $('#scrim').onclick = () => { closePanel(false); };
  window.addEventListener('hashchange', applyRoute);
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { const ph = isPhone(); if (ph !== phone) { phone = ph; rebuild(); } else { renderGrid(); } }, 150); });
}

function rebuild() {
  WB = buildWorkbook(P, phone); byId = {}; byName = {}; WB.sheets.forEach(sh => { prep(sh); byId[sh.id] = sh; byName[sh.name] = sh; });
  Object.keys(ctxs).forEach(k => delete ctxs[k]); recalc(); cur = null; document.body.classList.toggle('phone', phone); applyRoute();
}

fetch('content/portfolio.json').then(r => r.json()).then(data => {
  P = data; bind(); rebuild(); updateDirty();
  $('#app').classList.remove('loading'); tour.start();
}).catch(err => { console.warn(err); $('#gin').innerHTML = '<p style="padding:24px">Could not load the workbook. Open the <a href="read.html">plain résumé view</a>.</p>'; });
