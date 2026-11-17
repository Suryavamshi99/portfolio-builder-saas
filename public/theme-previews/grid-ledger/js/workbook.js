/* The workbook: every tab, its cells, formulas, notes, comments, charts and images.
   Figures come only from content/portfolio.json and the model assumptions written beside each tab.
   Basis chips mark each figure: Fact (case file), From his files (read from his project working),
   Derived (a formula on facts), Back-solved (set so the model ties to his published output), Try it (a value for you to change). */
'use strict';
function buildWorkbook(P, phone) {
  const pg = s => P.project_pages[s] || {}, pr = s => P.projects.find(x => x.slug === s) || {};
  const T = P.testimonials;
  const sheets = [];
  function Sheet(id, name, o = {}) {
    const sh = Object.assign({ id, name, cols: [], rowH: {}, cells: {}, merges: [], charts: [], images: [], cf: [], comments: {}, freeze: { r: 0, c: 0 }, rows: 60, color: null, project: null }, o);
    sheets.push(sh); return sh;
  }
  const norm = x => (x === null || x === undefined) ? null : (typeof x === 'object' ? x : typeof x === 'string' && x[0] === '=' ? { f: x } : { v: x });
  const put = (sh, a, spec) => { const n = norm(spec); if (n) sh.cells[a] = n; };
  const row = (sh, r, c0, arr) => arr.forEach((x, i) => { if (x !== undefined && x !== null && x !== '') put(sh, ENG.numToCol(ENG.colToNum(c0) + i) + r, x); });
  const IN = (v, fmt, extra = {}) => Object.assign({ v, in: true, fmt }, extra);
  const F = (f, fmt, extra = {}) => Object.assign({ f, fmt }, extra);
  const H = (v, extra = {}) => Object.assign({ v, s: 'hdr' }, extra);
  const B = k => ({ v: { fact: 'Fact', chart: 'From his files', der: 'Derived', back: 'Back-solved', try: 'Try it', model: 'His model', assumed: 'Assumed' }[k], s: 'basis b-' + k });
  const L = (v, extra = {}) => Object.assign({ v }, extra, { s: 'lab wrap ' + (extra.s || '') });
  const title = (sh, t, sub, span) => { put(sh, 'B2', { v: t, s: 'h1' }); put(sh, 'B3', { v: sub, s: 'sub wrap' }); sh.merges.push('B2:' + span + '2', 'B3:' + span + '3'); sh.rowH[1] = 10; sh.rowH[2] = 36; };
  const legend = (sh, r, span) => { put(sh, 'B' + r, { v: 'Blue cells take your own numbers, black cells hold formulas, and green cells point to other tabs.', s: 'legend wrap' }); sh.merges.push(`B${r}:${span}${r}`); };
  const foot = (sh, r, span, text) => { put(sh, 'B' + r, { v: text, s: 'foot wrap' }); sh.merges.push(`B${r}:${span}${r}`); };
  const cm = (who, text) => ({ who: who.name, role: who.role, rel: who.relation, text: text || who.quote });
  const W = (d, m) => phone ? m : d;

  /* ================= Cover ================= */
  const cover = Sheet('cover', 'Cover', { color: '#e81a51', kind: 'cover', rows: 50 });
  const kpis = [
    { lab: 'EBITDA adjustments found', f: "=-'QoE bridge'!C14", fmt: 'cr1', spark: "=SPARKLINE('QoE bridge'!C8:C13,{\"charttype\",\"column\"})", go: 'qoe', sub: 'Box-maker QoE, Pinewick 2024' },
    { lab: 'Offer revised by the buyer', f: "=-'QoE bridge'!C35", fmt: 'cr0', spark: "=SPARKLINE({'QoE bridge'!C7,'QoE bridge'!C15},{\"charttype\",\"column\"})", go: 'qoe', sub: 'About ₹78 cr, per the deal team' },
    { lab: 'LBO base-case IRR', f: "='LBO returns'!C30", fmt: 'pct0', spark: "=SPARKLINE('LBO returns'!C41:F41)", go: 'lbo', sub: '2.4x MOIC, five-year hold' },
    { lab: 'Working-capital peg vs seller', f: "='NWC peg'!C9", fmt: 'sgn1', spark: "=SPARKLINE('NWC peg'!C7:C8,{\"charttype\",\"column\"})", go: 'nwc', sub: '₹27.5 cr adopted in the SPA', unit: ' cr' },
    { lab: 'Peak overdraft use', f: "='Cash 13wk'!E7", fmt: 'pct0', spark: "=SPARKLINE('Cash 13wk'!C17:O17)", go: 'cash', sub: '₹3.8 cr to ₹2.9 cr in a quarter' },
    { lab: 'Investment Club stock pitch', f: "='EPS bridge'!C17", fmt: 'ord', spark: "=SPARKLINE('EPS bridge'!C7:C12,{\"charttype\",\"column\"})", go: 'eps', sub: 'of 22 teams, ₹30,000 prize' }
  ];
  const tabsIndex = [
    ['qoe', 'QoE bridge', pr('qoe-box-maker').result],
    ['lbo', 'LBO returns', pr('lbo-stationery-distributor').result],
    ['nwc', 'NWC peg', pr('nwc-peg').result],
    ['sell', 'Sell-side', pr('sell-side-envelope-division').result],
    ['hav', 'Ferndale valuation', pr('ferndale-initiation').result],
    ['eps', 'EPS bridge', pr('stock-pitch').result],
    ['cash', 'Cash 13wk', pr('cash-forecast').result],
    ['flow', 'Reamsheet', pr('reamsheet').result],
    ['exp', 'Experience', 'Harlow & Venn analyst to senior, Pinewick deal analyst, corporate finance diploma, Level 1 credential'],
    ['skills', 'Skills', 'Deal work, valuation and modelling, data tools, filterable'],
    ['refs', 'Testimonials', 'His Pinewick accountant, his regional manager and his live-project client']
  ];
  const p = P.person;
  if (!phone) {
    cover.cols = [24, 156, 156, 156, 156, 156, 156, 24];
    Object.assign(cover.rowH, { 0: 16, 1: 52, 2: 30, 3: 30, 4: 30, 5: 28, 6: 28, 7: 28, 8: 28, 9: 36, 10: 18, 11: 34, 12: 24, 13: 42, 14: 34, 15: 26, 16: 20, 17: 34 });
    put(cover, 'B2', { f: '=IMAGE("media/photos/headshot.jpg")', s: 'photo' }); cover.merges.push('B2:C10');
    put(cover, 'D2', { v: p.first_name + ' ' + p.last_name, s: 'name' }); cover.merges.push('D2:G2');
    put(cover, 'D3', { v: p.headline, s: 'headline' }); cover.merges.push('D3:G3');
    put(cover, 'D4', { v: P.pitch.short, s: 'pitch wrap' }); cover.merges.push('D4:G5');
    row(cover, 6, 'D', [{ v: 'Looking for', s: 'k' }, { v: p.looking_for, s: 'kv wrap' }]); cover.merges.push('E6:G7');
    row(cover, 8, 'D', [{ v: 'Now', s: 'k' }, { v: p.current, s: 'kv wrap' }]); cover.merges.push('E8:G8');
    row(cover, 9, 'D', [{ v: 'Based in', s: 'k' }, { v: p.location + ' · available from ' + p.available_from, s: 'kv' }]); cover.merges.push('E9:G9');
    row(cover, 10, 'D', [{ f: '=HYPERLINK("#share","Contact Pranav")', s: 'btnc primary' }, { f: '=HYPERLINK("media/resume.pdf","Résumé (PDF)")', s: 'btnc' }, { f: '=HYPERLINK("' + P.contact.linkedin + '","LinkedIn")', s: 'btnc' }, { f: '=HYPERLINK("read.html","Plain résumé view")', s: 'btnc' }]);
    put(cover, 'B12', { v: 'Strongest results', s: 'sec' }); cover.merges.push('B12:G12');
    kpis.forEach((k, i) => {
      const c = ENG.numToCol(1 + i);
      put(cover, c + 13, { v: k.lab, s: 'kl wrap' });
      put(cover, c + 14, { f: k.f, fmt: k.fmt, s: 'kv2 link', suffix: k.unit });
      put(cover, c + 15, { f: k.spark, s: 'kspark' });
      put(cover, c + 16, { f: `=HYPERLINK("#gid=${k.go}","${k.sub.replace(/"/g, '')}")`, s: 'ks wrap' });
    });
    put(cover, 'B18', { v: 'Contents', s: 'sec' }); cover.merges.push('B18:D18');
    put(cover, 'E18', { v: 'Why hire him', s: 'sec' }); cover.merges.push('E18:G18');
    tabsIndex.forEach(([id, nm, res], i) => { put(cover, 'B' + (19 + i), { f: `=HYPERLINK("#gid=${id}","${nm}")`, s: 'toc' }); put(cover, 'C' + (19 + i), { v: res, s: 'tocr wrap' }); cover.merges.push(`C${19 + i}:D${19 + i}`); });
    P.pitch.why_hire.forEach((w, i) => { put(cover, 'E' + (19 + i * 2), { v: w, s: 'why wrap' }); cover.merges.push(`E${19 + i * 2}:G${20 + i * 2}`); });
    put(cover, 'E26', { v: 'How he works', s: 'sec2' }); cover.merges.push('E26:G26');
    P.values.forEach((v, i) => { put(cover, 'E' + (27 + i), { v: '· ' + v, s: 'val wrap' }); cover.merges.push(`E${27 + i}:G${27 + i}`); });
    put(cover, 'E31', { v: 'Outside work: ' + P.outside.map(o => o.title.toLowerCase()).join(', ') + '. ' + P.about.now, s: 'val wrap mute' }); cover.merges.push('E31:G32');
    cover.freeze = { r: 0, c: 0 };
  } else {
    cover.cols = [8, 168, 168, 8];
    Object.assign(cover.rowH, { 0: 8, 1: 40 });
    put(cover, 'B2', { v: p.first_name + ' ' + p.last_name, s: 'name' }); cover.merges.push('B2:C2');
    put(cover, 'B3', { v: p.headline, s: 'headline wrap' }); cover.merges.push('B3:C3');
    put(cover, 'B4', { v: 'Strongest results', s: 'sec' }); cover.merges.push('B4:C4');
    kpis.forEach((k, i) => {
      const c = i % 2 ? 'C' : 'B', r0 = 5 + Math.floor(i / 2) * 4;
      put(cover, c + r0, { v: k.lab, s: 'kl wrap' }); put(cover, c + (r0 + 1), { f: k.f, fmt: k.fmt, s: 'kv2 link', suffix: k.unit });
      put(cover, c + (r0 + 2), { f: k.spark, s: 'kspark' }); put(cover, c + (r0 + 3), { f: `=HYPERLINK("#gid=${k.go}","${k.sub}")`, s: 'ks wrap' });
      cover.rowH[r0 - 1] = 30; cover.rowH[r0] = 34; cover.rowH[r0 + 1] = 28;
    });
    cover.rowH[17] = 12; cover.rowH[18] = 300;
    put(cover, 'B19', { f: '=IMAGE("media/photos/headshot.jpg")', s: 'photo' }); cover.merges.push('B19:C19');
    put(cover, 'B20', { v: P.pitch.short, s: 'pitch wrap' }); cover.merges.push('B20:C20');
    put(cover, 'B21', { v: 'Looking for: ' + p.looking_for, s: 'kv wrap' }); cover.merges.push('B21:C21');
    put(cover, 'B22', { v: p.current + ' · ' + p.location + ' · available from ' + p.available_from, s: 'kv wrap mute' }); cover.merges.push('B22:C22');
    row(cover, 23, 'B', [{ f: '=HYPERLINK("#share","Contact")', s: 'btnc primary' }, { f: '=HYPERLINK("media/resume.pdf","Résumé (PDF)")', s: 'btnc' }]); cover.rowH[22] = 36;
    put(cover, 'B25', { v: 'Contents', s: 'sec' }); cover.merges.push('B25:C25');
    tabsIndex.forEach(([id, nm, res], i) => { put(cover, 'B' + (26 + i), { f: `=HYPERLINK("#gid=${id}","${nm}")`, s: 'toc' }); put(cover, 'C' + (26 + i), { v: res, s: 'tocr wrap' }); });
    put(cover, 'B38', { v: 'Why hire him', s: 'sec' }); cover.merges.push('B38:C38');
    P.pitch.why_hire.forEach((w, i) => { put(cover, 'B' + (39 + i), { v: w, s: 'why wrap' }); cover.merges.push(`B${39 + i}:C${39 + i}`); });
  }

  /* ================= QoE bridge ================= */
  const q = Sheet('qoe', 'QoE bridge', { project: 'qoe-box-maker', color: '#491880', rows: 44 });
  q.cols = W([20, 220, 80, 60, 88, 16], [6, 148, 66, 48, 74, 8]);
  title(q, 'Quality of earnings: corrugated-box maker purchase', 'Pinewick Paper & Print · Feb to Mar 2024 · senior analyst for EBITDA and debt-like items · ₹ cr', 'E'); legend(q, 4, 'E');
  row(q, 6, 'B', [H('EBITDA bridge, FY24'), H('₹ cr', { s: 'hdr r' }), H('Accept', { s: 'hdr c' }), H('Basis')]);
  const qn = pg('qoe-box-maker');
  row(q, 7, 'B', [L('Reported EBITDA', { note: qn.problem }), IN(46.8, 'n1'), '', B('fact')]);
  const adj = [
    ['Rebate accrual release', -3.4, 'A ₹3.4 cr release of customer-rebate accruals sat inside FY24 EBITDA. A one-off credit, so it comes out.', 'fact'],
    ['One-off waste-paper gain', -2.7, 'A ₹2.7 cr one-off gain on selling surplus waste paper sat inside EBITDA. It will not recur under a new owner.', 'fact'],
    ['Capitalised maintenance labour', -2.1, qn.decisions[1].why, 'fact'],
    ['December cut-off sales', -1.9, 'December sales invoices checked against dispatch records: ₹1.9 cr was booked before the lorries left the yard.', 'fact'],
    ['Below-market promoter rent', -1.5, qn.decisions[0].why, 'fact'],
    ['Non-recurring legal costs (added back)', 1.2, 'An add-back from his working papers: legal costs of an old dispute that will not recur.', 'chart']
  ];
  adj.forEach(([l, v, n, b], i) => row(q, 8 + i, 'B', [L(l, { note: n }), IN(v, 'acc1'), { v: true, chk: true, in: true, s: 'c' }, B(b)]));
  row(q, 14, 'B', [L('Total adjustments', { s: 'lab b' }), F('=SUMPRODUCT(C8:C13,D8:D13)', 'acc1', { s: 'b' }), '', B('der')]);
  row(q, 15, 'B', [L('Adjusted EBITDA', { s: 'lab tot' }), F('=C7+C14', 'n1', { s: 'tot' }), { v: '', s: 'tot' }, B('der')]);
  row(q, 16, 'B', [L('Adjustments as % of reported'), F('=C14/C7', 'pct1'), '', B('der')]);
  row(q, 18, 'B', [H('Growth check'), H('', { s: 'hdr' }), H(''), H('')]);
  row(q, 19, 'B', [L('Reported growth, FY24 on FY23'), IN(0.38, 'pct0'), '', B('fact')]);
  row(q, 20, 'B', [L('FY23 EBITDA, implied'), F('=C7/(1+C19)', 'n1'), '', B('der')]);
  row(q, 21, 'B', [L('Growth on adjusted EBITDA', { note: 'Reported growth was 38%. On adjusted EBITDA it is about 7%. That gap is what Pinewick would have been paying for.' }), F('=C15/C20-1', 'pct1', { s: 'b' }), '', B('der')]);
  row(q, 23, 'B', [H('Debt-like items'), H('₹ cr', { s: 'hdr r' }), H(''), H('')]);
  [['Pulp-supplier creditors past 90 days', 9.6], ['Overdue statutory dues (GST, PF)', 6.2], ['Unfunded gratuity', 5.1], ['Customer advances on undelivered orders', 4.0], ['Disputed tax provisions', 2.7], ['Deferred consideration, earlier acquisition', 1.4]]
    .forEach(([l, v], i) => row(q, 24 + i, 'B', [L(l), IN(v, 'n1'), '', B('chart')]));
  row(q, 30, 'B', [L('Total debt-like items', { s: 'lab tot', note: 'Deducted from equity value. The case file gives the total, ₹29 cr; the split is from his working papers.' }), F('=SUM(C24:C29)', 'n1', { s: 'tot' }), { v: '', s: 'tot' }, B('der')]);
  row(q, 32, 'B', [H('Price impact'), H('', { s: 'hdr' }), H(''), H('')]);
  row(q, 33, 'B', [L('Offer revision, per the deal team'), IN(78, 'n0'), '', B('fact')]);
  row(q, 34, 'B', [L('Multiple applied to the adjustments', { note: 'Offer revision divided by the EBITDA taken out (78 ÷ 10.4). An implied figure, not a number from the deal. Untick an adjustment above to see what it was worth.' }), IN(7.5, 'x2'), '', B('back')]);
  row(q, 35, 'B', [L('Change in headline price', { s: 'lab b' }), F('=C14*C34', 'acc1', { s: 'b' }), '', B('der')]);
  foot(q, 37, 'E', 'Source: case file and his working papers. The target and every figure are fictional. Untick "Accept" to drop an adjustment, and the bridge, chart and Cover follow.');
  q.charts.push({ type: 'waterfall', anchor: W('G6', 'B39'), w: W(460, 340), h: 300, title: 'Reported to adjusted EBITDA, FY24 (₹ cr)', data: g => ({ labels: ['Reported', ...adj.map((a, i) => ['Rebate release', 'Waste-paper gain', 'Maintenance labour', 'Dec cut-off', 'Promoter rent', 'Legal add-back'][i]), 'Adjusted'], vals: [g('C7'), ...adj.map((_, i) => g('D' + (8 + i)) ? g('C' + (8 + i)) : 0), g('C15')], total: [0, 7], colors: { tot: '#f44267' } }) });
  q.charts.push({ type: 'hbars', anchor: W('G23', 'B56'), w: W(460, 340), h: 230, title: 'Debt-like items (₹ cr)', data: g => ({ labels: [24, 25, 26, 27, 28, 29].map(r => g('B' + r)), series: [{ name: '₹ cr', vals: [24, 25, 26, 27, 28, 29].map(r => g('C' + r)), color: '#3c4043' }], labelW: W(190, 130) }) });
  q.comments.C15 = cm(T[0]);
  q.names = { Reported_EBITDA: 'C7', Total_adjustments: 'C14', Adjusted_EBITDA: 'C15', Debt_like_items: 'C30' };
  q.cf.push({ range: 'C8:C13', rule: v => v < 0 ? 'neg' : '' });

  /* ================= LBO returns ================= */
  const l = Sheet('lbo', 'LBO returns', { project: 'lbo-stationery-distributor', color: '#491880', rows: 60 });
  l.cols = W([20, 220, 76, 76, 76, 76, 16], [6, 150, 66, 70, 66, 66, 8]);
  title(l, 'LBO: family-office buyout of a stationery distributor', "Brackenridge School of Management live project · 2025 · I owned the model · five-year hold · figures in ₹ cr", 'F'); legend(l, 4, 'F');
  row(l, 6, 'B', [H('Entry and uses'), H('₹ cr', { s: 'hdr r' }), H('Basis')]);
  row(l, 7, 'B', [L('Entry EBITDA', { note: 'Not in the case file. Back-solved as enterprise value ₹148 cr ÷ 8.0x entry multiple, so the model ties to his sources and uses.' }), IN(18.5, 'n1'), B('back')]);
  row(l, 8, 'B', [L('Entry multiple (EV / EBITDA)'), IN(8, 'x1'), B('model')]);
  row(l, 9, 'B', [L('Enterprise value'), F('=C7*C8', 'n1'), B('der')]);
  row(l, 10, 'B', [L('Fees and expenses'), IN(4, 'n1'), B('model')]);
  row(l, 11, 'B', [L('Cash to balance sheet'), IN(2, 'n1'), B('model')]);
  row(l, 12, 'B', [L('Total uses', { s: 'lab tot' }), F('=C9+C10+C11', 'n1', { s: 'tot' }), { v: '', s: 'tot' }]);
  row(l, 14, 'B', [H('Sources'), H('₹ cr', { s: 'hdr r' }), H('')]);
  row(l, 15, 'B', [L('Senior debt', { note: 'Raise this to test debt capacity. The leverage check below turns red above the 3.0x he tested.' }), IN(55.5, 'n1'), B('model')]);
  row(l, 16, 'B', [L('Mezzanine'), IN(14, 'n1'), B('model')]);
  row(l, 17, 'B', [L('Sponsor equity (plug)'), F('=C12-C15-C16', 'n1'), B('der')]);
  row(l, 18, 'B', [L('Total sources', { s: 'lab tot' }), F('=SUM(C15:C17)', 'n1', { s: 'tot' }), { v: '', s: 'tot' }]);
  row(l, 19, 'B', [L('Entry leverage (senior debt / EBITDA)', { note: 'The case file rounds this to 3.0x.' }), F('=C15/C7', 'x2'), B('der')]);
  row(l, 20, 'B', [L('Leverage check'), F('=IF(C19>3.05,"Above the 3.0x tested","Within the 3.0x tested")', null, { s: 'wrap' }), '']); l.merges.push('C20:D20');
  row(l, 22, 'B', [H('Exit, year 5'), H('₹ cr', { s: 'hdr r' }), H('')]);
  row(l, 23, 'B', [L('Exit EBITDA (assumed)', { note: 'Assumption, not from his files. The persona file gives no exit EBITDA or exit net debt, so this and net debt at exit are two assumed values picked together so the base case returns his published 2.4x. Change either to see how sensitive the return is.' }), IN(31, 'n1'), B('assumed')]);
  row(l, 24, 'B', [L('Exit multiple'), IN(8, 'x1'), B('model')]);
  row(l, 25, 'B', [L('Net debt at exit (assumed)', { note: 'Assumption, not from his files. Picked with exit EBITDA so the base case returns 2.4x.' }), IN(45.2, 'n1'), B('assumed')]);
  row(l, 26, 'B', [L('Exit equity value'), F('=C23*C24-C25', 'n1'), B('der')]);
  row(l, 27, 'B', [L('Holding period (years)'), IN(5, 'n0'), B('fact')]);
  row(l, 28, 'B', [H('Returns'), H('', { s: 'hdr' }), H('')]);
  row(l, 29, 'B', [L('MOIC', { s: 'lab tot' }), F('=C26/C17', 'x2', { s: 'tot' }), B('der')]);
  row(l, 30, 'B', [L('IRR', { s: 'lab tot' }), F('=C29^(1/C27)-1', 'pct1', { s: 'tot' }), B('der')]);
  row(l, 32, 'B', [H('IRR by entry and exit multiple'), H('Exit 7.0x', { s: 'hdr r' }), H('8.0x', { s: 'hdr r' }), H('9.0x', { s: 'hdr r' }), H('10.0x', { s: 'hdr r' })]);
  row(l, 33, 'B', [L('Entry \\ exit', { s: 'lab mute' }), IN(7, 'x1'), IN(8, 'x1'), IN(9, 'x1'), IN(10, 'x1')]);
  [7.5, 8, 8.5, 9].forEach((e, i) => {
    const r = 34 + i; put(l, 'B' + r, IN(e, 'x1', { s: 'lab' }));
    ['C', 'D', 'E', 'F'].forEach(c => put(l, c + r, F(`=(($C$23*${c}$33-$C$25)/($C$7*$B${r}+$C$10+$C$11-$C$15-$C$16))^(1/$C$27)-1`, 'pct1')));
  });
  row(l, 39, 'B', [L('At your entry multiple (row 8)', { s: 'lab b' })]);
  row(l, 41, 'B', [L('IRR at the entry multiple above', { s: 'lab' }), ...['C', 'D', 'E', 'F'].map(c => F(`=(($C$23*${c}$33-$C$25)/$C$17)^(1/$C$27)-1`, 'pct1'))]);
  foot(l, 43, 'F', 'His published base case is 19%. The grid here uses a simpler exit resting on two assumed figures (exit EBITDA and exit net debt), so individual cells can drift a little from his full model.');
  l.cf.push({ range: 'C34:F37', rule: v => 'scale', scale: [0.10, 0.30], color: [52, 168, 83] });
  l.cf.push({ range: 'C20', rule: v => /Above/.test(v) ? 'bad' : 'good' });
  l.charts.push({ type: 'line', anchor: W('H6', 'B45'), w: W(420, 340), h: 260, title: 'IRR by exit multiple at your entry multiple', data: g => ({ labels: ['C', 'D', 'E', 'F'].map(c => ENG.fmtValue(g(c + '33'), 'x1')), vals: ['C', 'D', 'E', 'F'].map(c => +(g(c + '41') * 100).toFixed(1)), fmt: v => v.toFixed(1) + '%', ref: { v: 19, label: 'Base case 19%' } }) });
  l.comments.C30 = cm(T[2]);
  l.names = { Entry_EBITDA: 'C7', Sponsor_equity: 'C17', MOIC: 'C29', IRR: 'C30' };

  /* ================= NWC peg ================= */
  const n = Sheet('nwc', 'NWC peg', { project: 'nwc-peg', color: '#491880', rows: 46 });
  n.cols = W([20, 270, 92, 92, 24], [6, 170, 80, 80, 8]);
  title(n, 'Working-capital peg: stationery-wholesale carve-out', 'Harlow & Venn Advisory · 2023 · senior analyst on the working-capital workstream · ₹ cr', 'D'); legend(n, 4, 'D');
  row(n, 6, 'B', [H('The peg'), H('₹ cr', { s: 'hdr r' }), H('Basis')]);
  row(n, 7, 'B', [L("Seller's proposed peg (one quarter)", { note: pg('nwc-peg').problem }), IN(19, 'n1'), B('fact')]);
  row(n, 8, 'B', [L('Normalised peg (24 months, school-term season and one-offs adjusted)', { note: pg('nwc-peg').decisions[0].why }), IN(27.5, 'n1'), B('fact')]);
  row(n, 9, 'B', [L('Difference', { s: 'lab tot' }), F('=C8-C7', 'sgn1', { s: 'tot' }), B('der')]);
  row(n, 10, 'B', [L('Months of working capital rebuilt'), IN(24, 'n0'), B('fact')]);
  row(n, 12, 'B', [H('Completion: try a closing NWC'), H('₹ cr', { s: 'hdr r' }), H('')]);
  row(n, 13, 'B', [L('NWC delivered at completion', { note: 'Type any number. This is not from the deal; it shows how the peg moves the price.' }), IN(19, 'n1'), B('try')]);
  row(n, 14, 'B', [L("Price adjustment against the seller's peg"), F('=C13-C7', 'sgn1'), B('der')]);
  row(n, 15, 'B', [L('Price adjustment against the normalised peg'), F('=C13-C8', 'sgn1'), B('der')]);
  row(n, 16, 'B', [L('Value protected for the buyer', { s: 'lab tot', note: 'Rupee for rupee: each crore of peg is a crore of price at completion.' }), F('=C14-C15', 'sgn1', { s: 'tot' }), B('der')]);
  row(n, 17, 'B', [L('Reading'), F('=IF(C15<0,"Buyer pays ₹"&TEXT(-C15,"n1")&" cr less at completion",IF(C15>0,"Buyer pays ₹"&TEXT(C15,"n1")&" cr more","No adjustment"))', null, { s: 'wrap b' })]); n.merges.push('C17:D17');
  foot(n, 19, 'D', 'Source: case file. The monthly series was built from ledger extracts during the deal. The normalised peg went into the SPA.');
  n.charts.push({ type: 'columns', anchor: W('F6', 'B21'), w: W(420, 340), h: 260, title: 'Peg against completion NWC (₹ cr)', data: g => ({ labels: ["Seller's peg", 'Normalised peg', 'Your completion NWC'], series: [{ name: '₹ cr', vals: [g('C7'), g('C8'), g('C13')] }], pointColors: ['#35ea61', '#f44267', '#9aa0a6'] }) });
  n.names = { Seller_peg: 'C7', Normalised_peg: 'C8', Peg_difference: 'C9' };

  /* ================= Sell-side ================= */
  const s = Sheet('sell', 'Sell-side', { project: 'sell-side-envelope-division', color: '#491880', rows: 56 });
  s.cols = W([20, 190, 76, 76, 70, 84, 16], [6, 120, 60, 60, 60, 70, 8]);
  title(s, 'Sell-side process: envelope division (Project SOAR)', 'Pinewick Paper & Print · Mar to Jun 2025 · deal analyst · division revenue about ₹190 cr', 'F'); legend(s, 4, 'F');
  row(s, 6, 'B', [H('Buyer funnel'), H('Strategic', { s: 'hdr r' }), H('Financial', { s: 'hdr r' }), H('Total', { s: 'hdr r' }), H('Conversion', { s: 'hdr r' })]);
  row(s, 7, 'B', [L('Screened', { note: pg('sell-side-envelope-division').what_i_did[0] }), IN(33, 'n0'), IN(21, 'n0'), F('=C7+D7', 'n0', { s: 'b' }), '']);
  row(s, 8, 'B', [L('Teaser sent'), IN(19, 'n0'), IN(12, 'n0'), F('=C8+D8', 'n0', { s: 'b' }), F('=E8/E7', 'pct1')]);
  row(s, 9, 'B', [L('NDA signed', { note: 'By the end of June 2025, when the first round closed.' }), IN(4, 'n0'), IN(5, 'n0'), F('=C9+D9', 'n0', { s: 'b' }), F('=E9/E8', 'pct1')]);
  row(s, 10, 'B', [L('Screened to NDA', { s: 'lab tot' }), { v: '', s: 'tot' }, { v: '', s: 'tot' }, { v: '', s: 'tot' }, F('=E9/E7', 'pct1', { s: 'tot' })]);
  row(s, 11, 'B', [L('Financial buyers, NDA rate', { note: pg('sell-side-envelope-division').decisions[0].why }), '', '', '', F('=D9/D7', 'pct1')]);
  row(s, 12, 'B', [L('Strategic buyers, NDA rate'), '', '', '', F('=C9/C7', 'pct1')]);
  row(s, 14, 'B', [H('Plan the next process'), H(''), H(''), H(''), H('')]);
  row(s, 15, 'B', [L('NDAs you want'), IN(12, 'n0'), B('try')]);
  row(s, 16, 'B', [L('Buyers to screen at his conversion'), F('=ROUND(C15/F10+0.499,0)', 'n0'), B('der')]);
  row(s, 17, 'B', [L('Teasers to send'), F('=ROUND(C15/F9+0.499,0)', 'n0'), B('der')]);
  row(s, 19, 'B', [H('Trading comps, EV / EBITDA NTM'), H('Multiple', { s: 'hdr r' }), H(''), H(''), H('')]);
  const comps = [11, 10.5, 9.8, 9.4, 9, 8.6, 8.2, 7.9, 7.5, 7.2, 6.8, 6.4, 6, 5.5];
  comps.forEach((v, i) => row(s, 20 + i, 'B', [L('Peer ' + String.fromCharCode(65 + i)), IN(v, 'x1')]));
  row(s, 34, 'B', [L('Median', { s: 'lab tot', note: pg('sell-side-envelope-division').decisions[1].why }), F('=MEDIAN(C20:C33)', 'x1', { s: 'tot' }), B('der')]);
  row(s, 35, 'B', [L('Mean'), F('=AVERAGE(C20:C33)', 'x1'), B('der')]);
  row(s, 36, 'B', [L('Range'), F('=TEXT(MIN(C20:C33),"x1")&" to "&TEXT(MAX(C20:C33),"x1")'), B('der')]);
  row(s, 37, 'B', [L('Precedent transactions in the IM set'), IN(28, 'n0'), B('fact')]);
  foot(s, 39, 'F', 'Source: case file (54, 31, 9 and 28 precedents) plus his own funnel and comps workings. Peers are not named, and every multiple is invented.');
  s.charts.push({ type: 'hbars', anchor: W('H6', 'B41'), w: W(420, 340), h: 200, title: 'Buyer funnel by the end of June 2025', data: g => ({ labels: ['Screened', 'Teaser sent', 'NDA signed'], series: [{ name: 'Strategic', vals: [g('C7'), g('C8'), g('C9')], color: '#f44267' }, { name: 'Financial', vals: [g('D7'), g('D8'), g('D9')], color: '#faa1b3' }], labelW: 90 }) });
  s.charts.push({ type: 'columns', anchor: W('H19', 'B54'), w: W(420, 340), h: 260, title: 'Trading comps: EV / EBITDA, NTM', data: g => ({ labels: comps.map((_, i) => String.fromCharCode(65 + i)), series: [{ name: 'EV/EBITDA', vals: comps.map((_, i) => g('C' + (20 + i))), color: '#35ea61' }], ref: { v: g('C34'), label: 'Median ' + ENG.fmtValue(g('C34'), 'x1') }, fmt: v => v.toFixed(1) + 'x', yfmt: v => v + 'x' }) });
  s.comments.E9 = cm(T[1]);
  s.names = { Buyers_screened: 'E7', NDAs_signed: 'E9', Comps_median: 'C34' };

  /* ================= Ferndale valuation ================= */
  const h = Sheet('hav', 'Ferndale valuation', { project: 'ferndale-initiation', color: '#491880', rows: 50 });
  h.cols = W([20, 220, 66, 66, 62, 74, 62, 16], [6, 130, 60, 60, 60, 60, 60, 8]);
  title(h, 'Ferndale Board & Tissue: initiation (practice report)', 'Ledger Lines newsletter · Jan to Feb 2025 · per-share fair value in ₹ · no investment advice', 'G'); legend(h, 4, 'G');
  row(h, 6, 'B', [H('Football field'), H('Low', { s: 'hdr r' }), H('High', { s: 'hdr r' }), H('Mid', { s: 'hdr r' }), H('Your price', { s: 'hdr c' })]);
  [['Trading comps, 6.5 to 7.5x FY27E EV/EBITDA', 268, 331], ['DCF, WACC 11 to 12%, g 3.5 to 4.5%', 282, 340], ['Tissue margin scenarios, low to high', 238, 392]].forEach(([lb, lo, hi], i) => {
    const r = 7 + i; row(h, r, 'B', [L(lb, i === 2 ? { note: pg('ferndale-initiation').decisions[1].why } : {}), IN(lo, 'n0'), IN(hi, 'n0'), F(`=AVERAGE(C${r}:D${r})`, 'n0'), F(`=IF(AND($C$12>=C${r},$C$12<=D${r}),"Inside","Outside")`, null, { s: 'c' })]);
  });
  row(h, 10, 'B', [L('Overall range', { s: 'lab tot' }), F('=MIN(C7:C9)', 'n0', { s: 'tot' }), F('=MAX(D7:D9)', 'n0', { s: 'tot' }), F('=AVERAGE(C10:D10)', 'n0', { s: 'tot' }), { v: '', s: 'tot' }]);
  row(h, 12, 'B', [L('Compare a share price (₹)', { note: 'Type any price to see which of his ranges it falls inside. The chart draws it as a line.' }), IN(300, 'n0'), B('try')]);
  row(h, 14, 'B', [H('DCF sensitivity, value per share (₹)'), H('g 3.0%', { s: 'hdr r' }), H('3.5%', { s: 'hdr r' }), H('4.0%', { s: 'hdr r' }), H('4.5%', { s: 'hdr r' }), H('5.0%', { s: 'hdr r' })]);
  const grid = [[318, 331, 346, 363, 383], [301, 312, 325, 340, 357], [286, 296, 307, 320, 335], [273, 282, 292, 303, 316], [262, 270, 278, 288, 299]];
  grid.forEach((rw, i) => { put(h, 'B' + (15 + i), { v: 0.105 + i * 0.005, fmt: 'pct1', s: 'lab', note: i === 0 ? 'Rows are WACC. Values pasted from his DCF model.' : undefined }); rw.forEach((v, j) => put(h, ENG.numToCol(2 + j) + (15 + i), { v, fmt: 'n0' })); });
  row(h, 21, 'B', [L('WACC'), IN(0.115, 'pct1'), B('try')]);
  row(h, 22, 'B', [L('Terminal growth'), IN(0.04, 'pct1'), B('try')]);
  row(h, 23, 'B', [L('Value per share at these inputs', { s: 'lab tot' }), F('=IFERROR(INDEX(C15:G19,ROUND((C21-0.105)/0.005,0)+1,ROUND((C22-0.03)/0.005,0)+1),"Off the grid")', 'n0', { s: 'tot' }), B('der')]);
  row(h, 25, 'B', [H('The report'), H('', { s: 'hdr' })]);
  [['Pages', 22], ['Valuation methods', 4], ['Reads, first month', 1450], ['Reviewer comments from two practising analysts', 33]].forEach(([lb, v], i) => row(h, 26 + i, 'B', [L(lb), IN(v, 'n0'), B('fact')]));
  foot(h, 31, 'G', 'Source: case file plus his football-field and sensitivity tables. Three of the four methods have published ranges. A practice report that shows model output and gives no advice.');
  h.charts.push({ type: 'football', anchor: W('I6', 'B33'), w: W(390, 340), h: 230, title: 'Valuation football field, ₹ per share', data: g => ({ rows: [7, 8, 9].map(r => ({ label: ['Trading comps', 'DCF', 'Tissue scenarios'][r - 7], lo: g('C' + r), hi: g('D' + r) })), marker: g('C12'), labelW: W(110, 90) }) });
  h.cf.push({ range: 'C15:G19', rule: () => 'scale', scale: [262, 383], color: [234, 67, 53] });
  h.cf.push({ range: 'F7:F9', rule: v => v === 'Inside' ? 'good' : 'bad' });
  h.names = { Fair_value_low: 'C10', Fair_value_high: 'D10', DCF_value: 'C23' };

  /* ================= EPS bridge ================= */
  const e = Sheet('eps', 'EPS bridge', { project: 'stock-pitch', color: '#491880', rows: 46 });
  e.cols = W([20, 270, 92, 92, 24], [6, 170, 80, 80, 8]);
  title(e, 'Stock pitch: long on a stationery and envelope maker', "Brackenridge Investment Club · February 2025 · I led the team · EPS in ₹, team estimates", 'D'); legend(e, 4, 'D');
  row(e, 6, 'B', [H('Earnings bridge'), H('₹ / share', { s: 'hdr r' }), H('Basis')]);
  const sp = pg('stock-pitch');
  row(e, 7, 'B', [L('FY26E EPS'), IN(24, 'n0'), B('fact')]);
  row(e, 8, 'B', [L('Volume, from the 7-mill capacity map', { note: sp.what_i_did[0] }), IN(6, 'sgn0'), B('fact')]);
  row(e, 9, 'B', [L('Price'), IN(3, 'sgn0'), B('fact')]);
  row(e, 10, 'B', [L('Pulp cost, mill by mill', { note: sp.what_i_did[1] }), IN(4, 'sgn0'), B('fact')]);
  row(e, 11, 'B', [L('Energy'), IN(-2, 'sgn0'), B('fact')]);
  row(e, 12, 'B', [L('FY29E EPS', { s: 'lab tot' }), F('=C7+SUM(C8:C11)', 'n0', { s: 'tot' }), B('der')]);
  row(e, 13, 'B', [L('EPS CAGR, FY26E to FY29E'), F('=(C12/C7)^(1/3)-1', 'pct1'), B('der')]);
  row(e, 14, 'B', [L('Share of the growth from volume', { note: sp.decisions[0].why }), F('=C8/(C12-C7)', 'pct0'), B('der')]);
  row(e, 16, 'B', [H('Result'), H('', { s: 'hdr' }), H('')]);
  row(e, 17, 'B', [L('Placing'), IN(1, 'ord'), B('fact')]);
  row(e, 18, 'B', [L('Teams'), IN(22, 'n0'), B('fact')]);
  row(e, 19, 'B', [L('Mills mapped'), IN(7, 'n0'), B('fact')]);
  row(e, 20, 'B', [L('Prize, shared by the team of 3'), IN(30000, 'inr0'), B('fact')]);
  row(e, 21, 'B', [L('Judges'), { v: 'Two fund managers and a retired credit analyst', s: 'wrap' }]); e.merges.push('C21:D21');
  foot(e, 23, 'D', 'Source: case file (team estimates, company is fictional). Edit a driver here and the bridge, the CAGR and the chart all recalculate.');
  e.charts.push({ type: 'waterfall', anchor: W('F6', 'B25'), w: W(420, 340), h: 270, title: 'EPS FY26E to FY29E (₹)', data: g => ({ labels: ['FY26E', 'Volume', 'Price', 'Pulp', 'Energy', 'FY29E'], vals: [g('C7'), g('C8'), g('C9'), g('C10'), g('C11'), g('C12')], total: [0, 5], colors: { tot: '#491880', up: '#a181c9', down: '#35ea61' } }) });
  e.images.push({ src: 'media/photos/achievement-stock-pitch.jpg', anchor: W('F25', 'B44'), w: W(420, 340), alt: 'Investment Club stock pitch winners, 2025' });
  e.names = { EPS_FY26E: 'C7', EPS_FY29E: 'C12' };

  /* ================= Cash 13wk ================= */
  const c = Sheet('cash', 'Cash 13wk', { project: 'cash-forecast', color: '#491880', rows: 52 });
  c.cols = W([20, 200, ...Array(13).fill(58), 24], [6, 120, ...Array(13).fill(50), 8]);
  title(c, '13-week cash forecast: back-to-school season', 'Pinewick Paper & Print · 2024 · built as a spreadsheet, updated every Monday with the senior accountant', 'O'); legend(c, 4, 'O');
  row(c, 6, 'B', [H('Results over the next quarter'), H('Before', { s: 'hdr r' }), H('After', { s: 'hdr r' }), H('Change', { s: 'hdr r' })]);
  row(c, 7, 'B', [L('Peak overdraft use (₹ cr)'), IN(3.8, 'n1'), IN(2.9, 'n1'), F('=D7/C7-1', 'pct0', { s: 'b' }), B('fact')]);
  row(c, 8, 'B', [L('Debtor days'), IN(52, 'n0'), IN(41, 'n0'), F('=D8-C8', 'sgn0', { s: 'b' }), B('fact')]);
  put(c, 'B10', H('Weekly forecast, ₹ lakh')); c.merges.push('B10:H10');
  put(c, 'B11', { v: '₹ lakh', s: 'hdr' });
  const rec = [70, 55, 64, 135, 46, 42, 102, 66, 50, 142, 58, 52, 96], pay = [-78, -92, -58, -70, -118, -52, -64, -80, -138, -68, -55, -98, -62];
  for (let i = 0; i < 13; i++) {
    const col = ENG.numToCol(2 + i), prev = ENG.numToCol(1 + i);
    if (i > 5) put(c, col + 10, { v: '', s: 'hdr' });
    put(c, col + 11, { v: i + 1, fmt: 'wk', s: 'hdr r' });
    put(c, col + 12, i === 0 ? IN(-170, 'lakh') : F(`=${prev}16`, 'lakh'));
    put(c, col + 13, IN(rec[i], 'lakh', { s: 'pos' }));
    put(c, col + 14, F(`=${col}13-IF(AND($C$22>0,${col}$11=10),$L$13,0)+IF(AND($C$22>0,${col}$11=10+$C$22),$L$13,0)`, 'lakh', { s: 'pos' }));
    put(c, col + 15, IN(pay[i], 'lakh', { s: 'negc' }));
    put(c, col + 16, F(`=${col}12+${col}14+${col}15`, 'lakh', { s: 'tot' }));
    put(c, col + 17, F(`=$C$21+${col}16`, 'lakh'));
  }
  row(c, 12, 'B', [L('Opening')]); row(c, 13, 'B', [L('Receipts, as planned', { note: 'Receipts come from the receivable ageing and the confirmed order book. Wendell Odom supplies the stock-in dates.' })]);
  row(c, 14, 'B', [L('Receipts, after any delay')]); row(c, 15, 'B', [L('Payments')]);
  row(c, 16, 'B', [L('Closing', { s: 'lab tot' })]); row(c, 17, 'B', [L('Overdraft headroom', { note: 'Below ₹120 lakh of headroom turns red, as in the sheet.' })]);
  row(c, 18, 'B', [L('Lowest headroom in the 13 weeks', { s: 'lab b' }), F('=MIN(C17:O17)', 'lakh', { s: 'b' })]);
  row(c, 20, 'B', [H('Assumptions'), H('', { s: 'hdr' }), H('')]);
  row(c, 21, 'B', [L('Overdraft limit, ₹ lakh', { note: 'Back-solved: closing balance plus headroom equals 400 in every week of his forecast.' }), IN(400, 'n0'), B('back')]);
  row(c, 22, 'B', [L('Delay the week-10 receipt by (weeks)', { note: 'His next step was a scenario for a delayed shipment payment. Try 1, 2 or 3 and watch the headroom.' }), IN(0, 'n0'), B('try')]);
  foot(c, 24, 'O', 'Source: case file (results) and his forecast sheet (weekly figures in whole lakh, at Dennis Hale\'s insistence). The weekly rows are live, so editing a receipt or payment shifts every later closing balance.');
  c.cf.push({ range: 'C17:O17', rule: v => v < 0 ? 'bad2' : v < 120 ? 'bad' : 'good' });
  c.cf.push({ range: 'C18', rule: v => v < 0 ? 'bad2' : v < 120 ? 'bad' : 'good' });
  c.charts.push({ type: 'columns', anchor: W('B26', 'B26'), w: W(620, 340), h: 250, title: 'Overdraft headroom by week (₹ lakh)', data: g => { const v = []; for (let i = 0; i < 13; i++) v.push(g(ENG.numToCol(2 + i) + '17')); return { labels: v.map((_, i) => 'W' + (i + 1)), series: [{ name: 'Headroom', vals: v }], pointColors: v.map(x => x < 0 ? '#0ea527' : x < 120 ? '#35ea61' : '#6634a8'), ref: { v: 120, label: '₹120 lakh' }, labelsOn: !phone }; } });
  c.names = { Overdraft_limit: 'C21', Delay_weeks: 'C22', Lowest_headroom: 'C18' };
  c.freeze = { r: 0, c: phone ? 0 : 2 };

  /* ================= Reamsheet ================= */
  const fb = Sheet('flow', 'Reamsheet', { project: 'reamsheet', color: '#491880', rows: 46 });
  fb.cols = W([20, 150, 170, 320, 70, 24], [6, 110, 130, 260, 60, 8]);
  title(fb, 'Reamsheet: a monthly paper-price tracker', 'Side project · since October 2024 · built alone · Python, pandas, DuckDB, Streamlit, scheduled jobs', 'E');
  row(fb, 5, 'B', [H('Measure'), H('Value', { s: 'hdr r' }), H('Basis')]);
  row(fb, 6, 'B', [L('Months of data'), IN(26, 'n0'), B('fact')]);
  row(fb, 7, 'B', [L('Paper grades'), IN(31, 'n0'), B('fact')]);
  row(fb, 8, 'B', [L('Grade-months kept consistent'), F('=C6*C7', 'n0'), B('der')]);
  row(fb, 9, 'B', [L('Monthly users, about'), IN(220, 'n0'), B('fact')]);
  row(fb, 11, 'B', [H('Pipeline step'), H('Tool'), H('What it does'), H('Live', { s: 'hdr c' })]);
  const fp = pg('reamsheet');
  [['Pull', 'Python, scheduled job', fp.what_i_did[0], true], ['Clean', 'pandas', fp.what_i_did[1], true], ['Store', 'DuckDB', fp.what_i_did[2], true], ['Show', 'Streamlit', fp.what_i_did[3], true], ['Next', 'Monthly note', fp.next, false]]
    .forEach(([a, b, d, ok], i) => row(fb, 12 + i, 'B', [L(a, { s: 'lab b' }), { v: b, s: 'wrap' }, { v: d, s: 'wrap' }, { v: ok, chk: true, s: 'c' }]));
  foot(fb, 18, 'E', 'Source: case file. The tracker itself runs as a separate Streamlit app.');
  fb.names = { Months_of_data: 'C6', Paper_grades: 'C7' };

  /* ================= Experience ================= */
  const x = Sheet('exp', 'Experience', { color: '#e81a51', rows: 40, vtop: true });
  const yrs = []; for (let y = 2019; y <= 2026; y++) yrs.push(y);
  x.cols = W([20, 90, 300, 110, 360, ...yrs.map(() => 36), 24], [6, 70, 190, 96, 280, ...yrs.map(() => 30), 8]);
  title(x, 'Experience and education', 'Timeline from graduation to Project SOAR. The shading in the year columns is conditional formatting.', 'E');
  row(x, 5, 'B', [H('Year'), H('Milestone'), H('Type'), H('Detail'), ...yrs.map(y => H(String(y).slice(2), { s: 'hdr c' }))]);
  const typeOf = t => /Pinewick|Harlow|Promoted/.test(t) ? 'Work' : /Certificate|Credential/.test(t) ? 'Certification' : 'Education';
  P.journey.forEach((j, i) => {
    const r = 6 + i; const m = String(j.year).match(/\d{4}/g).map(Number); let a = m[0], b = m[1] || m[0];
    if (/Promoted/.test(j.title)) b = 2023;
    const exp = P.experience.find(ex => (/Promoted/.test(j.title) && /Harlow/.test(ex.org) && /Senior/.test(ex.role)) || (j.title.includes(ex.org.split(' ')[0]) && j.title.includes(ex.role.split(',')[0])));
    const note = exp ? exp.role + ', ' + exp.org + ' (' + exp.dates + '): ' + exp.points.join(' ') : undefined;
    row(x, r, 'B', [{ v: j.year, s: 'lab' }, L(j.title, { s: 'lab b wrap', note }), { v: typeOf(j.title), chip: true }, { v: j.detail, s: 'wrap' }, ...yrs.map(y => ({ v: y >= a && y <= b ? 1 : '', s: 'gantt', fmt: 'blank' }))]);
    x.cf.push({ range: `F${r}:M${r}`, rule: v => v === 1 ? 'g-' + typeOf(j.title).toLowerCase() : '' });
  });
  const r0 = 6 + P.journey.length + 1;
  row(x, r0, 'B', [H('Year'), H('Win or certification'), H('Type'), H('Detail')]);
  P.wins.forEach((w, i) => row(x, r0 + 1 + i, 'B', [{ v: (w.detail.match(/20\d\d/) || [''])[0], s: 'lab' }, L(w.title, { s: 'lab b wrap' }), { v: 'Award', chip: true }, { v: w.detail, s: 'wrap' }]));
  const r1 = r0 + 1 + P.wins.length;
  P.certifications.filter(cc => !P.wins.some(w => w.title.includes(cc.name))).forEach((cc, i) => row(x, r1 + i, 'B', [{ v: cc.year, s: 'lab' }, L(cc.name, { s: 'lab b wrap' }), { v: 'Certification', chip: true }, { v: cc.issuer, s: 'wrap' }]));
  x.freeze = { r: 5, c: 0 };

  /* ================= Skills ================= */
  const k = Sheet('skills', 'Skills', { color: '#e81a51', rows: 46, filter: { row: 5, c1: 1, c2: 6 }, vtop: true });
  k.cols = W([20, 230, 160, 90, 80, 280, 130, 24], [6, 150, 120, 80, 70, 220, 110, 8]);
  title(k, 'Skills and tools', "The header row has filter buttons. 'Used in' counts how many project tabs rely on each skill, and Level is calculated from that count.", 'G');
  row(k, 5, 'B', [H('Skill or tool'), H('Area'), H('Kind'), H('Used in', { s: 'hdr r' }), H('Projects'), H('Level')]);
  const NM = { qoe: 'QoE bridge', lbo: 'LBO returns', nwc: 'NWC peg', sell: 'Sell-side', hav: 'Ferndale valuation', eps: 'EPS bridge', cash: 'Cash 13wk', flow: 'Reamsheet' };
  const slugTab = { 'qoe-box-maker': 'qoe', 'lbo-stationery-distributor': 'lbo', 'nwc-peg': 'nwc', 'sell-side-envelope-division': 'sell', 'ferndale-initiation': 'hav', 'stock-pitch': 'eps', 'cash-forecast': 'cash', reamsheet: 'flow' };
  const skillMap = { 'Quality of earnings': ['qoe'], 'Debt-like item schedules and net debt': ['qoe'], 'Working-capital peg': ['nwc'], 'Buyer lists and outreach': ['sell'], 'Information memo drafting': ['sell'], 'Three-statement modelling': ['hav', 'lbo'], DCF: ['hav'], LBO: ['lbo'], 'Comps and precedent deals': ['sell', 'hav'], 'Scenario and sensitivity tables': ['hav', 'lbo', 'cash'], 'Excel (Power Query and macros)': [], 'Market data screens': [] };
  const toolSlug = { Python: 'python', pandas: 'pandas', Jupyter: 'jupyter', DuckDB: 'duckdb', Streamlit: 'streamlit', Plotly: 'plotly', 'Scheduled jobs': 'githubactions', Dashboards: 'tableau', 'ERP ledger extracts': 'sap', 'Spreadsheet models': 'googlesheets', 'Team wiki': 'notion', Newsletter: 'substack' };
  const rowsK = [];
  Object.entries(P.skills).forEach(([area, list]) => list.forEach(sk => { if (area === 'Data' && !(sk in skillMap)) return; rowsK.push([sk, area, 'Skill', skillMap[sk] || []]); }));
  P.tools.forEach(t => rowsK.push([t.name, 'Tools', 'Tool', P.projects.filter(pp => (pp.tools || []).includes(toolSlug[t.name])).map(pp => slugTab[pp.slug]), t.logo]));
  rowsK.forEach(([sk, area, kind, tabs, logo], i) => {
    const r = 6 + i;
    row(k, r, 'B', [{ v: sk, s: 'lab b', logo: logo ? 'media/' + logo : null, note: tabs.length ? undefined : 'Used in his Harlow & Venn and Pinewick work rather than in a project tab here.' }, { v: area, chip: true }, { v: kind, chip: true }, { v: tabs.length, fmt: 'n0', s: 'r' }, { v: tabs.map(t => NM[t]).join(', ') || 'From experience', s: 'wrap', tabs }, F(`=IF(E${r}>=3,"Core",IF(E${r}=2,"Strong",IF(E${r}=1,"Used","From experience")))`, null, { chip: true })]);
  });
  k.freeze = { r: 5, c: 0 };
  k.lastRow = 5 + rowsK.length;

  /* ================= Testimonials ================= */
  const t = Sheet('refs', 'Testimonials', { color: '#e81a51', rows: 30, vtop: true });
  t.cols = W([20, 170, 250, 190, 140, 440, 24], [6, 130, 170, 150, 110, 300, 8]);
  title(t, 'What people say', 'Every quote is a comment left by the person who said it. Pick a name or open the Comments panel at top right. Each comment is also pinned to the cell it refers to.', 'F');
  row(t, 5, 'B', [H('Name'), H('Role'), H('Relation'), H('About'), H('What they said')]);
  const about = [['qoe', 'C15'], ['sell', 'E9'], ['lbo', 'C30']];
  T.forEach((tt, i) => { const r = 6 + i; row(t, r, 'B', [{ v: tt.name, s: 'lab b' }, { v: tt.role, s: 'wrap' }, { v: tt.relation, s: 'wrap' }, { f: `=HYPERLINK("#gid=${about[i][0]}&range=${about[i][1]}","${NM[about[i][0]]}")` }, { v: '"' + tt.quote + '"', s: 'wrap quote' }]); t.comments['B' + r] = cm(tt); });
  t.freeze = { r: 5, c: 0 };

  // global named ranges
  const names = {};
  sheets.forEach(sh => Object.entries(sh.names || {}).forEach(([nm, a]) => { names[nm] = { sheet: sh.name, id: sh.id, a }; }));
  return { sheets, names };
}
