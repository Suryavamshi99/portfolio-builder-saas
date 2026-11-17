/* Formula engine: a small spreadsheet-compatible parser and evaluator.
   Supports + - * / ^ & % comparisons, A1 refs, ranges, 'Sheet name'!A1 refs, named ranges,
   and the functions listed in FN. Values: number, string, boolean, null (empty), {err}. */
'use strict';
const ENG = (() => {
  const colToNum = s => { let n = 0; for (const ch of s.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
  const numToCol = n => { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const parseAddr = a => { const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(a); return m ? { c: colToNum(m[1]), r: +m[2] - 1 } : null; };
  const addr = (r, c) => numToCol(c) + (r + 1);
  const ERR = e => ({ err: e });
  const isErr = v => v && typeof v === 'object' && 'err' in v;

  /* ---------- tokenizer ---------- */
  function tokenize(src) {
    const t = []; let i = 0;
    while (i < src.length) {
      const ch = src[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (ch === '"') { let j = i + 1, s = ''; while (j < src.length) { if (src[j] === '"' && src[j + 1] === '"') { s += '"'; j += 2; continue; } if (src[j] === '"') break; s += src[j++]; } t.push({ k: 'str', v: s, p: i, e: j + 1 }); i = j + 1; continue; }
      if (ch === "'") { const j = src.indexOf("'", i + 1); const name = src.slice(i + 1, j); if (src[j + 1] === '!') { t.push({ k: 'sheet', v: name, p: i, e: j + 2 }); i = j + 2; continue; } throw new Error('bad quote'); }
      if (/[0-9.]/.test(ch)) { const m = /^\d*\.?\d+(?:[eE][+-]?\d+)?/.exec(src.slice(i)); t.push({ k: 'num', v: parseFloat(m[0]), p: i, e: i + m[0].length }); i += m[0].length; continue; }
      if (/[A-Za-z_$]/.test(ch)) {
        const m = /^[A-Za-z_$][A-Za-z0-9_.$]*/.exec(src.slice(i)); const w = m[0];
        if (src[i + w.length] === '!') { t.push({ k: 'sheet', v: w, p: i, e: i + w.length + 1 }); i += w.length + 1; continue; }
        if (/^\$?[A-Za-z]{1,3}\$?\d+$/.test(w)) { t.push({ k: 'ref', v: w.replace(/\$/g, ''), p: i, e: i + w.length }); i += w.length; continue; }
        if (/^(TRUE|FALSE)$/i.test(w)) { t.push({ k: 'bool', v: /^TRUE$/i.test(w), p: i, e: i + w.length }); i += w.length; continue; }
        t.push({ k: src[i + w.length] === '(' ? 'fn' : 'name', v: w, p: i, e: i + w.length }); i += w.length; continue;
      }
      const two = src.slice(i, i + 2);
      if (['<=', '>=', '<>'].includes(two)) { t.push({ k: 'op', v: two, p: i, e: i + 2 }); i += 2; continue; }
      if ('+-*/^&%=<>(),:;{}'.includes(ch)) { t.push({ k: 'op', v: ch, p: i, e: i + 1 }); i++; continue; }
      throw new Error('bad char ' + ch);
    }
    return t;
  }

  /* ---------- parser to AST ---------- */
  function parse(src) {
    const toks = tokenize(src); let i = 0;
    const peek = () => toks[i], next = () => toks[i++];
    const isOp = v => peek() && peek().k === 'op' && peek().v === v;
    const expect = v => { if (!isOp(v)) throw new Error('expected ' + v); i++; };
    function cmp() { let a = cat(); while (peek() && peek().k === 'op' && ['=', '<>', '<', '>', '<=', '>='].includes(peek().v)) { const o = next().v; a = { t: 'bin', o, a, b: cat() }; } return a; }
    function cat() { let a = add(); while (isOp('&')) { next(); a = { t: 'bin', o: '&', a, b: add() }; } return a; }
    function add() { let a = mul(); while (isOp('+') || isOp('-')) { const o = next().v; a = { t: 'bin', o, a, b: mul() }; } return a; }
    function mul() { let a = pow(); while (isOp('*') || isOp('/')) { const o = next().v; a = { t: 'bin', o, a, b: pow() }; } return a; }
    function pow() { let a = un(); while (isOp('^')) { next(); a = { t: 'bin', o: '^', a, b: un() }; } return a; }
    function un() { if (isOp('-')) { next(); return { t: 'neg', a: un() }; } if (isOp('+')) { next(); return un(); } return post(); }
    function post() { let a = prim(); while (isOp('%')) { next(); a = { t: 'pct', a }; } return a; }
    function refNode(sheet) {
      const tk = next(); if (!tk || tk.k !== 'ref') { if (tk && tk.k === 'name' && sheet) return { t: 'name', v: tk.v, sheet }; throw new Error('expected ref'); }
      const a = parseAddr(tk.v); let node = { t: 'ref', sheet, r: a.r, c: a.c, p: tk.p };
      if (isOp(':')) { next(); const tk2 = next(); const b = parseAddr(tk2.v); node = { t: 'range', sheet, r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c), r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c), p: tk.p, e: tk2.e }; }
      else node.e = tk.e;
      return node;
    }
    function prim() {
      const tk = peek(); if (!tk) throw new Error('unexpected end');
      if (tk.k === 'num') { next(); return { t: 'lit', v: tk.v }; }
      if (tk.k === 'str') { next(); return { t: 'lit', v: tk.v }; }
      if (tk.k === 'bool') { next(); return { t: 'lit', v: tk.v }; }
      if (tk.k === 'sheet') { next(); const n = refNode(tk.v); n.p = tk.p; return n; }
      if (tk.k === 'ref') return refNode(null);
      if (tk.k === 'name') { next(); return { t: 'name', v: tk.v, p: tk.p, e: tk.e }; }
      if (tk.k === 'fn') {
        next(); expect('('); const args = [];
        if (!isOp(')')) { do { if (isOp(',') || isOp(')')) { args.push({ t: 'lit', v: null }); } else args.push(cmp()); } while ((isOp(',') || isOp(';')) && next()); }
        expect(')'); return { t: 'fn', n: tk.v.toUpperCase(), args };
      }
      if (isOp('(')) { next(); const e = cmp(); expect(')'); return e; }
      if (isOp('{')) { next(); const items = []; do { items.push(cmp()); } while ((isOp(',') || isOp(';')) && next()); expect('}'); return { t: 'arr', items }; }
      throw new Error('unexpected ' + tk.v);
    }
    const ast = cmp(); if (i < toks.length) throw new Error('trailing');
    return ast;
  }

  /* ---------- evaluation ---------- */
  const num = v => { if (isErr(v)) throw v; if (v === null || v === '' || v === undefined) return 0; if (typeof v === 'boolean') return v ? 1 : 0; if (typeof v === 'number') return v; const n = parseFloat(String(v).replace(/[,₹x%]/g, '')); if (isNaN(n)) throw ERR('#VALUE!'); return n; };
  const flat = args => { const out = []; for (const a of args) { if (Array.isArray(a)) { for (const row of a) for (const v of row) out.push(v); } else out.push(a); } return out; };
  const nums = args => flat(args).filter(v => typeof v === 'number');
  const FN = {
    SUM: a => nums(a).reduce((s, v) => s + v, 0),
    AVERAGE: a => { const n = nums(a); if (!n.length) throw ERR('#DIV/0!'); return n.reduce((s, v) => s + v, 0) / n.length; },
    MIN: a => { const n = nums(a); return n.length ? Math.min(...n) : 0; },
    MAX: a => { const n = nums(a); return n.length ? Math.max(...n) : 0; },
    MEDIAN: a => { const n = nums(a).sort((x, y) => x - y); if (!n.length) throw ERR('#NUM!'); const m = n.length >> 1; return n.length % 2 ? n[m] : (n[m - 1] + n[m]) / 2; },
    COUNT: a => nums(a).length,
    COUNTA: a => flat(a).filter(v => v !== null && v !== '').length,
    COUNTIF: a => { const vals = flat([a[0]]); const crit = a[1]; return vals.filter(v => String(v).toLowerCase() === String(crit).toLowerCase() || (typeof crit === 'boolean' && v === crit)).length; },
    SUMPRODUCT: a => { const arrs = a.map(x => flat([x])); return arrs[0].reduce((s, _, i) => s + arrs.reduce((p, arr) => p * num(arr[i]), 1), 0); },
    ROUND: a => { const d = a[1] == null ? 0 : num(a[1]); const f = Math.pow(10, d); return Math.round(num(a[0]) * f + 1e-9) / f; },
    ABS: a => Math.abs(num(a[0])),
    POWER: a => Math.pow(num(a[0]), num(a[1])),
    SQRT: a => { const v = num(a[0]); if (v < 0) throw ERR('#NUM!'); return Math.sqrt(v); },
    IF: a => (truthy(a[0]) ? a[1] : (a.length > 2 ? a[2] : false)),
    IFERROR: a => (isErr(a[0]) ? a[1] : a[0]),
    AND: a => flat(a).every(truthy),
    OR: a => flat(a).some(truthy),
    NOT: a => !truthy(a[0]),
    CONCATENATE: a => flat(a).map(v => v ?? '').join(''),
    TEXT: a => fmtValue(num(a[0]), String(a[1] || '')),
    INDEX: a => { const r = a[0]; if (!Array.isArray(r)) return r; const ri = Math.max(1, num(a[1] ?? 1)) - 1, ci = Math.max(1, num(a[2] ?? 1)) - 1; return (r[ri] || [])[ci] ?? null; },
    LARGE: a => { const n = nums([a[0]]).sort((x, y) => y - x); return n[num(a[1]) - 1]; },
    HYPERLINK: a => ({ link: String(a[0]), label: a.length > 1 ? a[1] : a[0] }),
    SPARKLINE: a => ({ spark: nums([a[0]]), opts: a[1] || null }),
    IMAGE: a => ({ image: String(a[0]) }),
    YEAR: a => num(a[0])
  };
  const LAZY = new Set(['IF', 'IFERROR']);
  const truthy = v => { if (isErr(v)) throw v; if (typeof v === 'boolean') return v; if (typeof v === 'number') return v !== 0; if (typeof v === 'string') return v.toUpperCase() === 'TRUE' || (v !== '' && v.toUpperCase() !== 'FALSE'); return !!v; };

  function evaluate(ast, ctx) {
    switch (ast.t) {
      case 'lit': return ast.v;
      case 'ref': return ctx.get(ast.sheet || ctx.sheet, ast.r, ast.c);
      case 'range': { const out = []; for (let r = ast.r1; r <= ast.r2; r++) { const row = []; for (let c = ast.c1; c <= ast.c2; c++) row.push(ctx.get(ast.sheet || ctx.sheet, r, c)); out.push(row); } return out; }
      case 'name': { const n = ctx.name(ast.v); if (!n) return ERR('#NAME?'); return evaluate(n, ctx); }
      case 'neg': return -num(evaluate(ast.a, ctx));
      case 'pct': return num(evaluate(ast.a, ctx)) / 100;
      case 'arr': return [ast.items.map(x => evaluate(x, ctx))];
      case 'bin': {
        const a = evaluate(ast.a, ctx), b = evaluate(ast.b, ctx);
        if (isErr(a)) return a; if (isErr(b)) return b;
        switch (ast.o) {
          case '+': return num(a) + num(b);
          case '-': return num(a) - num(b);
          case '*': return num(a) * num(b);
          case '/': { const d = num(b); if (d === 0) return ERR('#DIV/0!'); return num(a) / d; }
          case '^': { const v = Math.pow(num(a), num(b)); return isFinite(v) ? v : ERR('#NUM!'); }
          case '&': return String(a ?? '') + String(b ?? '');
          case '=': return a == b; case '<>': return a != b;
          case '<': return num(a) < num(b); case '>': return num(a) > num(b);
          case '<=': return num(a) <= num(b); case '>=': return num(a) >= num(b);
        }
        return ERR('#ERROR!');
      }
      case 'fn': {
        const f = FN[ast.n]; if (!f) return ERR('#NAME?');
        if (LAZY.has(ast.n)) {
          if (ast.n === 'IF') { const c = evaluate(ast.args[0], ctx); if (isErr(c)) return c; return truthy(c) ? evaluate(ast.args[1], ctx) : (ast.args[2] ? evaluate(ast.args[2], ctx) : false); }
          const v = evaluate(ast.args[0], ctx); return isErr(v) ? evaluate(ast.args[1], ctx) : v;
        }
        const args = ast.args.map(x => evaluate(x, ctx));
        for (const a of args) if (isErr(a)) return a;
        return f(args);
      }
    }
    return ERR('#ERROR!');
  }
  function run(ast, ctx) { try { const v = evaluate(ast, ctx); return Array.isArray(v) ? (v[0] ? v[0][0] : null) : v; } catch (e) { return isErr(e) ? e : ERR('#ERROR!'); } }

  /* refs inside a formula with their text spans, for the coloured range highlights */
  function refsOf(src) {
    const out = []; let toks; try { toks = tokenize(src.replace(/^=/, '')); } catch (e) { return out; }
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i]; let sheet = null, start = t.p;
      if (t.k === 'sheet') { sheet = t.v; i++; }
      const tk = toks[i]; if (!tk) break;
      if (tk.k === 'ref') {
        const a = parseAddr(tk.v); let end = tk.e, r2 = a.r, c2 = a.c;
        if (toks[i + 1] && toks[i + 1].v === ':' && toks[i + 2] && toks[i + 2].k === 'ref') { const b = parseAddr(toks[i + 2].v); r2 = b.r; c2 = b.c; end = toks[i + 2].e; i += 2; }
        out.push({ sheet, r1: Math.min(a.r, r2), c1: Math.min(a.c, c2), r2: Math.max(a.r, r2), c2: Math.max(a.c, c2), p: start + 1, e: end + 1 });
      } else if (tk.k === 'name') out.push({ sheet, name: tk.v, p: (sheet ? start : tk.p) + 1, e: tk.e + 1 });
    }
    return out;
  }

  /* ---------- number formats ---------- */
  const grp = (n, d) => n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
  const grpUS = (n, d) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  function fmtValue(v, fmt, dAdj = 0) {
    if (v === null || v === undefined || v === '') return '';
    if (isErr(v)) return v.err;
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'object') return v.label != null ? String(v.label) : '';
    if (typeof v !== 'number') return String(v);
    const f = fmt || 'auto';
    const D = (base) => Math.max(0, base + dAdj);
    const neg = v < 0, a = Math.abs(v);
    switch (f) {
      case 'auto': { if (Number.isInteger(v)) return grpUS(v, 0); const s = +v.toPrecision(10); return String(s); }
      case 'n0': return (neg ? '-' : '') + grpUS(a, D(0));
      case 'n1': return (neg ? '-' : '') + grpUS(a, D(1));
      case 'n2': return (neg ? '-' : '') + grpUS(a, D(2));
      case 'acc1': return a < 0.0000001 ? '-' : neg ? '(' + grpUS(a, D(1)) + ')' : grpUS(a, D(1));
      case 'acc0': return a < 0.0000001 ? '-' : neg ? '(' + grpUS(a, D(0)) + ')' : grpUS(a, D(0));
      case 'sgn1': return (neg ? '−' : v > 0 ? '+' : '') + grpUS(a, D(1));
      case 'sgn0': return (neg ? '−' : v > 0 ? '+' : '') + grpUS(a, D(0));
      case 'cr1': return (neg ? '−' : '') + '₹' + grpUS(a, D(1)) + ' cr';
      case 'cr0': return (neg ? '−' : '') + '₹' + grpUS(a, D(0)) + ' cr';
      case 'inr0': return (neg ? '−' : '') + '₹' + grp(a, D(0));
      case 'pct0': return (neg ? '−' : '') + grpUS(a * 100, D(0)) + '%';
      case 'pct1': return (neg ? '−' : '') + grpUS(a * 100, D(1)) + '%';
      case 'spct1': return (neg ? '−' : v > 0 ? '+' : '') + grpUS(a * 100, D(1)) + '%';
      case 'x1': return (neg ? '−' : '') + grpUS(a, D(1)) + 'x';
      case 'x2': return (neg ? '−' : '') + grpUS(a, D(2)) + 'x';
      case 'x0': return (neg ? '−' : '') + grpUS(a, D(0)) + 'x';
      case 'blank': return '';
      case 'wk': return 'W' + Math.round(v);
      case 'days': return grpUS(v, D(0)) + ' days';
      case 'lakh': return a < 0.0000001 ? '-' : neg ? '(' + grpUS(a, D(0)) + ')' : grpUS(a, D(0));
      case 'ord': { const n = Math.round(v); const s = ['th', 'st', 'nd', 'rd'], m = n % 100; return n + (s[(m - 20) % 10] || s[m] || s[0]); }
      default: return String(v);
    }
  }
  const fmtLabel = { auto: 'Automatic', n0: 'Number', n1: 'Number', n2: 'Number', acc1: 'Accounting', acc0: 'Accounting', sgn1: 'Custom (+0.0;−0.0)', sgn0: 'Custom (+0;−0)', cr1: 'Custom (₹0.0 "cr")', cr0: 'Custom (₹0 "cr")', inr0: 'Currency (₹)', pct0: 'Percent', pct1: 'Percent', spct1: 'Custom (+0.0%)', x1: 'Custom (0.0"x")', x2: 'Custom (0.00"x")', x0: 'Custom (0"x")', days: 'Custom (0 "days")', lakh: 'Accounting (₹ lakh)', ord: 'Custom (ordinal)' };

  return { parse, run, refsOf, fmtValue, fmtLabel, colToNum, numToCol, parseAddr, addr, isErr, ERR };
})();
