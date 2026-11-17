/* ==========================================================================
   backlog.js — signature interactive: "Prioritise my backlog"
   A tactile RICE board. Drag cards to re-rank (Draggable + Flip), move the
   sliders to reshape the bars live, pick a lens to re-theme and re-sort the
   board with a stagger, split-flap scores, a typed verdict and a
   "shipped first" stamp with a paper-dust burst.
   Data: content/portfolio.json → backlog.
   ========================================================================== */
(function () {
  window.Backlog = function (root, B) {
    if (!root || !B || !B.items || !B.items.length) { root && root.remove(); return; }
    const esc = K.esc;
    const orig = B.items.map((it) => ({ ...it }));
    let items = B.items.map((it) => ({ ...it }));
    let lens = 'balanced', sel = items[0].id, manual = false;
    const shipped = items.find((i) => i.shipped) || items[0];
    const F = B.fields;

    root.innerHTML = `
      <div class="wrap">
        <div class="sec-head">
          <div><span class="eyebrow"><b>04</b> Signature · try it</span><h2 class="h2" id="backlog-h" data-decode>Prioritise my <em>backlog</em></h2></div>
          <p class="lede">${esc(B.intro)}</p>
        </div>
        <div class="bl-grid">
          <div>
            <div class="lenses" role="radiogroup" aria-label="What your team cares about most">
              ${B.lenses.map((l) => `<button type="button" role="radio" aria-checked="${l.id === lens}" data-lens="${l.id}">${esc(l.label)}</button>`).join('')}
            </div>
            <p class="lens-hint" aria-live="polite"></p>
            <ol class="board" aria-label="Backlog ranked by score"></ol>
          </div>
          <aside class="panel" aria-label="Estimates and verdict">
            <div><span class="mono">Estimates for</span><h3 class="p-title"></h3></div>
            <div class="sliders"></div>
            <div class="formula">${esc(B.formula)} × lens weight</div>
            <div class="verdict" aria-live="polite"><p class="v1"></p><p class="v2"></p></div>
            <div class="panel-acts">
              <button type="button" class="pill pill-solid sm" data-reset>${esc(B.reset)}</button>
              <a class="pill pill-ghost sm" href="project.html?p=suggested-routing-rules" data-wipe="Suggested standing orders">${esc(B.case_link)} <span class="arr">→</span></a>
            </div>
          </aside>
        </div>
      </div>`;

    const board = root.querySelector('.board');
    const hint = root.querySelector('.lens-hint');
    const v1 = root.querySelector('.v1'), v2 = root.querySelector('.v2');

    const weight = (it) => (lens === 'balanced' ? 1 : (it.lens && it.lens[lens]) || 1);
    const score = (it) => (it.reach * it.impact * (it.confidence / 100) / it.effort) * weight(it);
    const fmt = (n) => String(Math.round(n));
    const pct = (k, v) => ((v - F[k].min) / (F[k].max - F[k].min)) * 100;

    board.innerHTML = items.map((it) => `
      <li class="rice-card" data-id="${it.id}" tabindex="0" data-cursor="drag" aria-label="${esc(it.title)}">
        <span class="rk" aria-hidden="true"></span>
        <div>
          <p class="rc-t">${esc(it.title)}</p>
          <p class="rc-d">${esc(it.detail)}</p>
          <div class="rc-bars">${['reach', 'impact', 'confidence', 'effort'].map((k) => `<span>${esc(F[k].label)}<i><b data-bar="${k}"></b></i></span>`).join('')}</div>
        </div>
        <div class="rc-score"><span class="flap" data-score></span><small>RICE score</small><div class="sbar"><b></b></div></div>
        <span class="stamp" aria-hidden="true">${esc(B.shipped_label)}</span>
        <div class="rc-move"><button type="button" data-up aria-label="Move up">▲</button><button type="button" data-down aria-label="Move down">▼</button></div>
      </li>`).join('');
    const cardOf = (id) => board.querySelector(`[data-id="${id}"]`);

    // ---------- sliders for the selected item ----------
    const sliders = root.querySelector('.sliders');
    const drawSliders = () => {
      const it = items.find((i) => i.id === sel);
      root.querySelector('.p-title').textContent = it.title;
      sliders.innerHTML = ['reach', 'impact', 'confidence', 'effort'].map((k) => `
        <div class="sl"><label for="sl-${k}">${esc(F[k].label)} <span class="mono" style="font-size:10px">${esc(F[k].unit)}</span><b data-v="${k}">${it[k]}</b></label>
        <input id="sl-${k}" type="range" min="${F[k].min}" max="${F[k].max}" step="${F[k].step}" value="${it[k]}" data-k="${k}" /></div>`).join('');
      board.querySelectorAll('.rice-card').forEach((c) => c.classList.toggle('sel', c.dataset.id === sel));
    };
    sliders.addEventListener('input', (e) => {
      const k = e.target.dataset.k; if (!k) return;
      const it = items.find((i) => i.id === sel);
      it[k] = parseFloat(e.target.value);
      sliders.querySelector(`[data-v="${k}"]`).textContent = it[k];
      manual = false;
      paint(false);
      clearTimeout(sliders._t); sliders._t = setTimeout(() => sort(true), 220);
    });

    // ---------- paint bars and scores ----------
    const paint = (flapAll) => {
      const max = Math.max(...items.map(score));
      items.forEach((it) => {
        const c = cardOf(it.id);
        ['reach', 'impact', 'confidence', 'effort'].forEach((k) => {
          const w = k === 'effort' ? 100 - pct(k, it[k]) * .9 : pct(k, it[k]);
          c.querySelector(`[data-bar="${k}"]`).style.setProperty('--w', Math.max(4, w) + '%');
        });
        c.querySelector('.sbar b').style.width = (score(it) / max) * 100 + '%';
        const el = c.querySelector('[data-score]'), s = fmt(score(it));
        if (el.dataset.v !== s) { el.dataset.v = s; K.flap(el, s, { instant: !flapAll && !c._seen, flips: 3, stagger: .03 }); }
      });
    };

    // ---------- order, ranks, stamp, verdict ----------
    const ranks = () => {
      [...board.children].forEach((c, i) => { c.querySelector('.rk').textContent = String(i + 1).padStart(2, '0'); });
    };
    let stamped = null;
    const stamp = () => {
      const top = board.firstElementChild;
      board.querySelectorAll('.stamp').forEach((s) => { if (s.closest('.rice-card') !== top || top.dataset.id !== shipped.id) gsap.to(s, { opacity: 0, duration: .2 }); });
      if (top.dataset.id !== shipped.id) { stamped = null; return; }
      if (stamped === top) return;
      stamped = top;
      const s = top.querySelector('.stamp');
      if (K.reduce) { gsap.set(s, { opacity: 1 }); return; }
      gsap.fromTo(s, { opacity: 0, scale: 2.4, rotation: -22 }, { opacity: 1, scale: 1, rotation: -9, duration: .55, ease: 'back.out(3)', delay: .35,
        onComplete: () => { const r = s.getBoundingClientRect(); K.burst(r.left + r.width / 2, r.top + r.height / 2, { n: 18, dust: true, spread: 40 }); } });
    };
    const verdict = () => {
      const top = items.find((i) => i.id === board.firstElementChild.dataset.id);
      const t1 = top.id === shipped.id ? B.same_note : B.diff_note.replace('{pick}', top.title).replace('{shipped}', shipped.title);
      v1.classList.add('caret'); v2.textContent = '';
      K.type(v1, t1, { cps: .016 });
      gsap.delayedCall(K.reduce ? 0 : Math.min(3.2, t1.length * .016) + .15, () => { v1.classList.remove('caret'); K.type(v2, B.why, { cps: .008 }); });
    };
    const sort = (animate) => {
      const order = [...items].sort((a, b) => score(b) - score(a)).map((i) => i.id);
      const state = Flip.getState(board.children);
      order.forEach((id) => board.appendChild(cardOf(id)));
      ranks();
      if (animate && !K.reduce) Flip.from(state, { duration: .75, ease: 'expo.out', stagger: .05 });
      stamp(); verdict();
    };

    // ---------- lens switch: re-theme + re-sort with stagger ----------
    const setLens = (id) => {
      lens = id;
      root.dataset.lens = id;
      root.querySelectorAll('.lenses button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.lens === id)));
      const l = B.lenses.find((x) => x.id === id);
      hint.textContent = l ? l.hint : '';
      manual = false;
      paint(true);
      sort(true);
    };
    root.querySelector('.lenses').addEventListener('click', (e) => { const b = e.target.closest('[data-lens]'); b && setLens(b.dataset.lens); });
    root.querySelector('.lenses').addEventListener('keydown', (e) => {
      if (!/Arrow(Left|Right)/.test(e.key)) return;
      const ids = B.lenses.map((l) => l.id); const i = ids.indexOf(lens);
      const n = ids[(i + (e.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length];
      setLens(n); root.querySelector(`[data-lens="${n}"]`).focus(); e.preventDefault();
    });
    root.querySelector('[data-reset]').addEventListener('click', () => {
      items = orig.map((i) => ({ ...i })); drawSliders(); setLens('balanced');
    });

    // ---------- select + keyboard + move buttons ----------
    const move = (c, dir) => {
      const sib = dir < 0 ? c.previousElementSibling : c.nextElementSibling; if (!sib) return;
      const state = Flip.getState(board.children);
      dir < 0 ? board.insertBefore(c, sib) : board.insertBefore(sib, c);
      Flip.from(state, { duration: .5, ease: 'expo.out' });
      manual = true; ranks(); stamp(); verdict();
    };
    board.addEventListener('click', (e) => {
      const c = e.target.closest('.rice-card'); if (!c) return;
      if (e.target.closest('[data-up]')) return move(c, -1);
      if (e.target.closest('[data-down]')) return move(c, 1);
      if (c._dragged) return;
      sel = c.dataset.id; drawSliders();
    });
    board.addEventListener('keydown', (e) => {
      const c = e.target.closest('.rice-card'); if (!c) return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); move(c, e.key === 'ArrowUp' ? -1 : 1); c.focus(); }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sel = c.dataset.id; drawSliders(); }
    });

    // ---------- drag to re-rank: Draggable with live Flip of the others ----------
    gsap.registerPlugin(Draggable, Flip);
    board.querySelectorAll('.rice-card').forEach((card) => {
      Draggable.create(card, {
        type: 'y', zIndexBoost: false, minimumMovement: 6, dragClickables: false,
        onPress() { card._dragged = false; },
        onDragStart() { card._dragged = true; card.classList.add('dragging'); gsap.to(card, { scale: 1.025, rotation: -0.6, duration: .2 }); },
        onDrag() {
          // swap with a neighbour once the dragged card passes half of it
          const r = card.getBoundingClientRect(), mid = r.top + r.height / 2;
          const prev = card.previousElementSibling, next = card.nextElementSibling;
          const swap = (other, before) => {
            const st = Flip.getState(other);
            const y0 = card.getBoundingClientRect().top;
            before ? board.insertBefore(card, other) : board.insertBefore(other, card);
            const y1 = card.getBoundingClientRect().top;
            gsap.set(card, { y: '+=' + (y0 - y1) }); this.update();
            Flip.from(st, { duration: .35, ease: 'power3.out' });
            ranks();
          };
          if (prev && mid < prev.getBoundingClientRect().top + prev.offsetHeight / 2) swap(prev, true);
          else if (next && mid > next.getBoundingClientRect().top + next.offsetHeight / 2) swap(next, false);
        },
        onRelease() {
          card.classList.remove('dragging');
          gsap.to(card, { y: 0, scale: 1, rotation: 0, duration: .6, ease: 'elastic.out(1, .55)' });
          if (card._dragged) { manual = true; ranks(); stamp(); verdict(); setTimeout(() => { card._dragged = false; }, 50); }
        },
      });
    });

    // ---------- first view: flap every score and land the stamp ----------
    drawSliders(); paint(false); sort(false); hint.textContent = B.lenses[0].hint;
    root.dataset.lens = lens;
    const io = new IntersectionObserver((es) => {
      if (!es[0].isIntersecting) return; io.disconnect();
      board.querySelectorAll('.rice-card').forEach((c) => { c._seen = true; const el = c.querySelector('[data-score]'); K.flap(el, el.dataset.v, { delay: .1 }); });
      stamped = null; stamp(); verdict();
    }, { threshold: .35 });
    io.observe(board);
  };
})();
