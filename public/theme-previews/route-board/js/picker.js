/* picker.js: "Plan your route". A small model of the pilot pick room, drawn as SVG.
   Data: content/portfolio.json → picker. Slots are [aisle, bay]; aisles 0-4 are racks, 5 is the heavy-goods wall;
   bay 0 is the back of the store, bay 5 the front by the packing table. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const CAT = { Paper: '#e0877f', Writing: '#5aa4e8', Notes: '#5ddcf0', Envelopes: '#4b89f2', Binding: '#c6e08c', Labels: '#bb7acb', Print: '#9ab4c9', Packaging: '#8fa3b8', Desk: '#8fe5b3', Board: '#f0a8aa' };
  // geometry in metres; the store is 20 m wide, 14 m deep
  const RACK_X = [2.4, 5.9, 9.4, 12.9, 16.4], CHILL_X = 19.25, WALK_OFF = 1.25, CHILL_WALK = 18.1;
  const BAY_Y = (b) => 1.7 + b * 1.82, BACK = 0.7, FRONT = 12.3, PACK = [10, 13.3];
  const S = 29, OX = 30, OY = 28; // px per metre and offsets in the 640 × 470 viewBox
  const px = (x) => OX + x * S, py = (y) => OY + y * S;

  function walkX(a) { return a === 5 ? CHILL_WALK : RACK_X[a] + WALK_OFF; }
  function slotPt(item, layout) { const [a, b] = item[layout]; return [walkX(a), BAY_Y(b)]; }

  function legs(pts) {
    // pts: list of [x,y] in metres; returns polyline points and length in metres
    const out = [pts[0]]; let len = 0;
    for (let i = 1; i < pts.length; i++) {
      const p = out[out.length - 1], q = pts[i];
      if (Math.abs(p[0] - q[0]) < 0.01) { out.push(q); len += Math.abs(p[1] - q[1]); continue; }
      const viaBack = (p[1] - BACK) + (q[1] - BACK), viaFront = (FRONT - p[1]) + (FRONT - q[1]);
      const yc = viaBack < viaFront ? BACK : FRONT;
      out.push([p[0], yc], [q[0], yc], q);
      len += Math.abs(p[1] - yc) + Math.abs(q[0] - p[0]) + Math.abs(q[1] - yc);
    }
    return { pts: out, len };
  }

  function sequence(items, layout, all) {
    if (layout === 'old') return items.slice().sort((a, b) => all.indexOf(a) - all.indexOf(b));
    // re-slotted: one S-shaped pass through the racks, heavy goods last
    const dry = items.filter((i) => !i.chilled), cold = items.filter((i) => i.chilled);
    const aisles = [...new Set(dry.map((i) => i.new[0]))].sort((a, b) => a - b);
    const seq = [];
    aisles.forEach((a, k) => {
      const inA = dry.filter((i) => i.new[0] === a).sort((x, y) => (k % 2 === 0 ? y.new[1] - x.new[1] : x.new[1] - y.new[1]));
      seq.push(...inA);
    });
    seq.push(...cold.sort((x, y) => x.new[1] - y.new[1]));
    return seq;
  }

  function plan(cfg, ids, layout, batch) {
    const byId = Object.fromEntries(cfg.items.map((i) => [i.id, i]));
    const orders = [ids].concat(batch ? cfg.batch_orders : []);
    const lines = orders.flat().map((id) => byId[id]).filter(Boolean);
    const seq = sequence(lines, layout, cfg.items);
    const pts = [[PACK[0], PACK[1]], [PACK[0], FRONT]].concat(seq.map((i) => slotPt(i, layout))).concat([[PACK[0], FRONT], [PACK[0], PACK[1]]]);
    const r = legs(pts);
    const n = orders.length;
    const secs = r.len / cfg.walk_speed_mps + lines.length * cfg.seconds_per_item + n * cfg.handover_seconds;
    return { pts: r.pts, walk: r.len / n, time: secs / n, seq };
  }

  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

  window.Picker = {
    init(cfg, el) {
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      let ids = cfg.default_order.slice(), layout = 'new', batch = false;
      const svg = el.svg;
      // static floor
      let g = `<rect x="${px(0)}" y="${py(0)}" width="${20 * S}" height="${14 * S}" fill="#1c120f" stroke="rgba(240,239,234,.25)"/>`;
      RACK_X.forEach((x, a) => {
        g += `<rect class="rack" x="${px(x - 0.55)}" y="${py(BAY_Y(0) - 0.8)}" width="${1.1 * S}" height="${(BAY_Y(5) - BAY_Y(0) + 1.6) * S}"/>`;
        g += `<text class="aisle-t" x="${px(x)}" y="${py(BACK) + 4}" text-anchor="middle">A${a + 1}</text>`;
      });
      g += `<rect class="chiller" x="${px(CHILL_X - 0.5)}" y="${py(BAY_Y(0) - 0.8)}" width="${1 * S}" height="${(BAY_Y(5) - BAY_Y(0) + 1.6) * S}"/><text class="aisle-t" x="${px(CHILL_X)}" y="${py(BACK) + 4}" text-anchor="middle">HEAVY</text>`;
      g += `<rect class="pack" x="${px(PACK[0] - 2)}" y="${py(13.05)}" width="${4 * S}" height="${0.75 * S}"/><text class="pack-t" x="${px(PACK[0])}" y="${py(13.05) + 15}" text-anchor="middle">PACKING</text>`;
      svg.innerHTML = g + '<g id="pk-bins"></g><path class="walk-ghost" id="pk-ghost"/><path class="walk" id="pk-walk"/><g class="picker" id="pk-dot"><circle r="7"/></g>';
      const bins = svg.querySelector('#pk-bins'), walk = svg.querySelector('#pk-walk'), ghost = svg.querySelector('#pk-ghost'), dot = svg.querySelector('#pk-dot');

      // legend and chips
      const cats = [...new Set(cfg.items.map((i) => i.cat))];
      el.legend.innerHTML = cats.map((c) => `<span><i style="background:${CAT[c] || '#999999'}"></i>${c}</span>`).join('');
      el.items.innerHTML = cfg.items.map((i) => `<button type="button" class="chip" data-id="${i.id}" aria-pressed="false"><i style="background:${CAT[i.cat] || '#999999'}"></i>${i.name}</button>`).join('');
      el.note.textContent = cfg.note;
      el.how.textContent = cfg.how;

      const toD = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + px(p[0]).toFixed(1) + ' ' + py(p[1]).toFixed(1)).join('');
      const shown = { m: 0, t: 0, a: 0 };
      let len = 0, t0 = performance.now();

      function render() {
        const byId = Object.fromEntries(cfg.items.map((i) => [i.id, i]));
        const sel = new Set(ids.concat(batch ? cfg.batch_orders.flat() : []));
        el.items.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(ids.includes(c.dataset.id))));
        el.count.textContent = `${ids.length} of 6 items${batch ? ' + 2 batched orders' : ''}`;
        el.layout.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.l === layout)));
        el.floorT.textContent = layout === 'new' ? 'Re-slotted: fast movers by the packing bench' : 'By catalogue: the old shelf plan';
        // bins
        bins.innerHTML = cfg.items.map((i) => {
          const [a, b] = i[layout];
          const x = a === 5 ? CHILL_X : RACK_X[a], y = BAY_Y(b);
          const on = sel.has(i.id);
          return `<rect class="bin${on ? ' sel' : ''}" x="${px(x - 0.42)}" y="${py(y - 0.62)}" width="${0.84 * S}" height="${1.24 * S}" fill="${CAT[i.cat] || '#999999'}" opacity="${on ? 1 : 0.55}"><title>${i.name}</title></rect>` + (on && ids.includes(i.id) ? `<text class="bin-l" x="${px(x) + (a === 5 ? -20 : 20)}" y="${py(y) + 4}" text-anchor="${a === 5 ? 'end' : 'start'}">${i.name.replace(/ \d.*$/, '')}</text>` : '');
        }).join('');
        const cur = plan(cfg, ids.length ? ids : [], layout, batch), alt = plan(cfg, ids, layout === 'new' ? 'old' : 'new', batch);
        const d = toD(cur.pts);
        walk.setAttribute('d', d); ghost.setAttribute('d', toD(alt.pts));
        len = walk.getTotalLength();
        if (!reduced) {
          walk.style.strokeDasharray = len; walk.style.strokeDashoffset = len;
          gsap.to(walk, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.out', overwrite: true });
        }
        t0 = performance.now();
        const target = { m: ids.length ? cur.walk : 0, t: ids.length ? cur.time : 0, a: ids.length ? alt.time : 0 };
        const paint = () => { el.m.textContent = Math.round(shown.m) + ' m'; el.t.textContent = mmss(shown.t); el.alt.textContent = mmss(shown.a); };
        if (reduced) { Object.assign(shown, target); paint(); } else gsap.to(shown, { ...target, duration: 0.8, ease: 'power2.out', onUpdate: paint, overwrite: true });
        el.altLabel.textContent = layout === 'new' ? 'By catalogue' : 'Re-slotted';
      }

      el.items.addEventListener('click', (e) => {
        const c = e.target.closest('.chip'); if (!c) return;
        const id = c.dataset.id;
        if (ids.includes(id)) ids = ids.filter((x) => x !== id);
        else { ids.push(id); if (ids.length > 6) ids.shift(); }
        render();
      });
      el.layout.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; layout = b.dataset.l; render(); });
      el.batch.addEventListener('change', () => { batch = el.batch.checked; render(); });
      el.batchL.textContent = 'Batch three orders in one walk';
      el.batch.parentElement.title = cfg.batch_note;

      // the picker walks the route on a loop (idle motion)
      const placeDot = (s) => { if (!len) return; const p = walk.getPointAtLength(Math.min(len, s)); dot.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`); };
      if (reduced) placeDot(0);
      else gsap.ticker.add(() => {
        const speed = 150, dur = len / speed + 1.2;
        const e = ((performance.now() - t0) / 1000) % Math.max(dur, 0.1);
        placeDot(e * speed);
      });
      render();
      return { render };
    },
  };
})();
