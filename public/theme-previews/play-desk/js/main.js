/* Yash Trivedi's island: modes, driving input, camera, stops, panel, maps, and read mode. */
import { loadContent, renderRead, wireCopy, toast, hideToast, forLine, esc, ICON } from './content.js';
import { buildStops, layout, paintMapBase, paintMapStops, paintCar, START, islandR, LANE } from './island.js';
import { mountPortfolioAgent } from '../agent/portfolio-agent.js';

const $ = (s, r = document) => r.querySelector(s);
const params = new URLSearchParams(location.search);
const mqReduced = matchMedia('(prefers-reduced-motion: reduce)');
const reduced = mqReduced.matches;
const touch = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && innerWidth < 900);
const small = innerWidth < 760;
const hasGL = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } })();
if (touch) document.body.classList.add('touch');

const STORE = 'vg-island-visited';
const visited = new Set((() => { try { return JSON.parse(localStorage.getItem(STORE) || '[]'); } catch { return []; } })());
const saveVisited = () => { try { localStorage.setItem(STORE, JSON.stringify([...visited])); } catch {} };

let C, STOPS, LAY, agent, mode = null;
let W = null; // world runtime, built on first entry

boot().catch((e) => { console.warn(e); document.body.className = 'mode-read grid-floor'; });

async function boot() {
  C = await loadContent();
  STOPS = buildStops(C);
  LAY = layout(STOPS);
  document.title = C.meta.site_title;
  $('#read').innerHTML = renderRead(C, STOPS, { canDrive: hasGL, touch });
  wireCopy(document);
  agent = mountPortfolioAgent();
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-drive]')) { e.preventDefault(); enterWorld(); }
    if (e.target.closest('[data-read]')) { e.preventDefault(); enterRead(); }
    if (e.target.closest('[data-ask]')) { e.preventDefault(); agent.open(e.target.closest('[data-ask]')); }
  });
  setupReadNav();
  const want = params.get('mode');
  const stopParam = params.get('stop');
  const startWorld = hasGL && want !== 'read' && (want === 'drive' || (!reduced && !touch && !small));
  if (startWorld) await enterWorld({ stop: stopParam });
  else { enterRead(); if (stopParam) { const s = findStop(stopParam); const el = s && document.getElementById(s.node || 'ask'); if (el) setTimeout(() => el.scrollIntoView({ block: 'start' }), 60); } }
  $('.loader').classList.add('done');
}
const findStop = (v) => STOPS.find((s) => s.id === v || s.slug === v);

/* ================= read mode ================= */
function enterRead() {
  if (W) { closePanel(); closeMap(); }
  mode = 'read';
  document.body.classList.remove('mode-world'); document.body.classList.add('mode-read', 'grid-floor');
  if (W && W.current) { const el = document.getElementById(W.current.node || 'ask'); if (el) el.scrollIntoView({ block: 'start' }); else scrollTo(0, 0); } else scrollTo(0, 0);
}
function setupReadNav() {
  const links = [...document.querySelectorAll('.rnav .links a')];
  const secs = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  const io = new IntersectionObserver((ents) => { ents.forEach((en) => { if (en.isIntersecting) { links.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + en.target.id)); const on = links.find((a) => a.classList.contains('on')); if (on && mode === 'read') { const p = on.parentElement; p.scrollTo({ left: on.offsetLeft - p.clientWidth / 2 + on.clientWidth / 2, behavior: 'smooth' }); } } }); }, { rootMargin: '-40% 0px -55% 0px' });
  secs.forEach((s) => io.observe(s));
}

/* ================= world mode ================= */
async function enterWorld(opt = {}) {
  if (!hasGL) return;
  if (!W) {
    $('.loader').classList.remove('done');
    try { await Promise.all([document.fonts.load('700 40px "Amatic SC"'), document.fonts.load('800 20px Nunito')]); } catch {}
    await buildWorld();
  }
  mode = 'world';
  document.body.classList.remove('mode-read', 'grid-floor'); document.body.classList.add('mode-world');
  scrollTo(0, 0);
  W.resize();
  $('.loader').classList.add('done');
  if (opt.stop && findStop(opt.stop)) { hideIntro(true); glideTo(findStop(opt.stop), true); }
  else if (!W.started) showIntro();
  $('#world').focus({ preventScroll: true });
}

async function buildWorld() {
  const [{ createWorld }, { createCar, TUNE }, THREE] = await Promise.all([import('./world.js'), import('./car.js'), import('../vendor/three.module.min.js')]);
  const canvas = $('#world');
  const quality = touch ? 0.5 : 1;
  const world = createWorld({ canvas, stops: STOPS, quality, reduced });
  const car = createCar(world.scene);
  car.place(START.x, START.z, START.heading);
  world.paintCrates(C.tools || []);
  const { renderer, scene, camera } = world;

  W = { world, car, THREE, started: false, current: null, panelOpen: false, mapOpen: false, glide: null, auto: null, keys: new Set(), joy: { x: 0, y: 0, on: false }, zoom: touch ? 1.25 : 1, camT: new THREE.Vector3(START.x, 0, START.z - 3), camP: new THREE.Vector3(), introT: 0, lastDrive: 0, hitTime: 0, pinsDownAt: 0 };
  W.camP.set(START.x, 26, START.z + 20);
  window.__island = W; // read-only handle for QA scripts
  STOPS.forEach((s) => { s.inside = false; });

  /* --- markers --- */
  const mk = $('.markers');
  STOPS.forEach((s) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'mk'; b.setAttribute('aria-label', `Stop ${s.n}: ${s.label}. Drive there`);
    b.innerHTML = `<span class="dia"><i>${s.n}</i></span><span class="tag">${esc(s.label)}</span>`;
    b.addEventListener('click', (e) => { e.stopPropagation(); hideIntro(); driveTo(s); });
    mk.append(b); s.el = b;
  });

  /* --- minimap and big map --- */
  const mm = $('.hud-map canvas'); mm.width = mm.height = 368;
  const base = document.createElement('canvas'); base.width = base.height = 368; paintMapBase(base.getContext('2d'), 368, STOPS, LAY);
  W.drawMini = () => { const g = mm.getContext('2d'); g.drawImage(base, 0, 0); paintMapStops(g, 368, STOPS, { visited, next: nextStop()?.id }); paintCar(g, 368, { x: car.state.x, z: car.state.z, heading: car.state.h }); };
  $('.hud-map').addEventListener('click', (e) => { const r = e.currentTarget.getBoundingClientRect(); const x = ((e.clientX - r.left) / r.width - 0.5) * 160, z = ((e.clientY - r.top) / r.height - 0.5) * 160; hideIntro(); const s = nearestStop(x, z, 12); if (s) driveTo(s); else if (onIsland(x, z)) driveToPoint(x, z); });
  const big = $('.map-stage canvas'); big.width = big.height = 900;
  const bigBase = document.createElement('canvas'); bigBase.width = bigBase.height = 900; paintMapBase(bigBase.getContext('2d'), 900, STOPS, LAY);
  W.drawBig = () => { const g = big.getContext('2d'); g.drawImage(bigBase, 0, 0); paintMapStops(g, 900, STOPS, { visited, next: nextStop()?.id, numbers: true }); paintCar(g, 900, { x: car.state.x, z: car.state.z, heading: car.state.h }); };
  big.addEventListener('click', (e) => { const r = big.getBoundingClientRect(); const s = nearestStop(((e.clientX - r.left) / r.width - 0.5) * 160, ((e.clientY - r.top) / r.height - 0.5) * 160, 10); if (s) { closeMap(); glideTo(s); } });
  $('.map-list').innerHTML = STOPS.map((s) => `<li><button type="button" data-go="${s.id}"><span class="n"><b>${s.n}</b></span>${esc(s.label)}</button></li>`).join('');
  $('.map-list').addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (!b) return; const s = findStop(b.dataset.go); closeMap(); hideIntro(true); glideTo(s); });

  /* --- pins (bowling) --- */
  const pins = world.pins;
  const dyn = (s, R) => {
    for (const p of pins) {
      const dx = p.x - s.x, dz = p.z - s.z, d = Math.hypot(dx, dz), m = R + 0.35;
      if (d < m && d > 1e-4) { const nx = dx / d, nz = dz / d; p.x = s.x + nx * m; p.z = s.z + nz * m; const sp = Math.max(4, Math.hypot(s.vx, s.vz)); p.vx = s.vx * 0.9 + nx * sp * 0.5; p.vz = s.vz * 0.9 + nz * sp * 0.5; if (!p.down) { p.down = true; W.hitTime = performance.now(); } s.vx *= 0.985; s.vz *= 0.985; }
    }
  };
  W.updatePins = (dt) => {
    let moving = false, down = 0;
    for (const p of pins) {
      p.x += p.vx * dt; p.z += p.vz * dt; const f = Math.exp(-2.2 * dt); p.vx *= f; p.vz *= f;
      if (Math.hypot(p.vx, p.vz) > 0.08) moving = true;
      if (p.down) { down++; p.tilt = Math.min(Math.PI / 2, p.tilt + dt * 6); if (Math.hypot(p.vx, p.vz) > 0.5) p.tiltDir = Math.atan2(p.vx, p.vz); }
    }
    for (let i = 0; i < pins.length; i++) for (let j = i + 1; j < pins.length; j++) {
      const a = pins[i], b = pins[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d < 0.62 && d > 1e-4) { const nx = dx / d, nz = dz / d, o = (0.62 - d) / 2; a.x -= nx * o; a.z -= nz * o; b.x += nx * o; b.z += nz * o; const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz; if (rv < 0) { a.vx += rv * nx * 0.9; a.vz += rv * nz * 0.9; b.vx -= rv * nx * 0.9; b.vz -= rv * nz * 0.9; if (!b.down && Math.abs(rv) > 1.2) b.down = true; if (!a.down && Math.abs(rv) > 1.2) a.down = true; } }
    }
    const ax = new THREE.Vector3();
    for (const p of pins) { ax.set(Math.cos(p.tiltDir), 0, -Math.sin(p.tiltDir)); p.m.quaternion.setFromAxisAngle(ax, p.tilt); p.m.position.set(p.x, 0.12 + Math.sin(p.tilt) * 0.3, p.z); }
    if (down === pins.length && !W.strike && performance.now() - W.hitTime < 4000) { W.strike = true; toast('Strike', 'All ten pins down'); }
    if (down && !moving && performance.now() - W.hitTime > 5000) { pins.forEach((p) => { p.x = p.hx; p.z = p.hz; p.vx = p.vz = 0; p.tilt = 0; p.down = false; }); W.strike = false; }
  };

  /* --- input --- */
  const DRIVE = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ShiftLeft: 'b', ShiftRight: 'b', Space: 'x' };
  const typing = (e) => { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable); };
  addEventListener('keydown', (e) => {
    if (mode !== 'world' || typing(e) || agentOpen()) return;
    if (e.key === 'Escape') { if (W.mapOpen) closeMap(); else if (W.panelOpen) closePanel(); return; }
    if (W.mapOpen) return;
    if (W.panelOpen) { if (e.key === 'm' || e.key === 'M') { closePanel(); openMap(); } else if (e.key === 'l' || e.key === 'L') enterRead(); return; }
    if (DRIVE[e.code]) { if (!W.started) hideIntro(); W.keys.add(DRIVE[e.code]); W.auto = null; world.hideTarget(); if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault(); return; }
    if (!W.started && (e.key === 'Enter')) { hideIntro(); return; }
    if (e.key === 'm' || e.key === 'M') openMap();
    else if (e.key === 'l' || e.key === 'L') enterRead();
    else if (e.key === 'n' || e.key === 'N') { const s = nextStop(); if (s) driveTo(s); }
    else if (e.key === 'r' || e.key === 'R') { car.place(START.x, START.z, START.heading); W.auto = null; }
    else if (e.key === 'Enter') { const s = STOPS.find((x) => Math.hypot(x.x - car.state.x, x.z - car.state.z) < 3.2); if (s) enterStop(s); }
  });
  addEventListener('keyup', (e) => { if (DRIVE[e.code]) W.keys.delete(DRIVE[e.code]); });
  addEventListener('blur', () => W.keys.clear());

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  const pick = (cx, cy) => {
    ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(world.clickables, true);
    for (const h of hits) { let o = h.object; while (o && !o.userData.stopId) o = o.parent; if (o) return { stop: findStop(o.userData.stopId) }; }
    if (ray.ray.intersectPlane(plane, hit)) return { x: hit.x, z: hit.z };
    return null;
  };
  let down = null;
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); const dt = performance.now() - down.t; down = null;
    if (moved > 10 || dt > 700 || W.panelOpen) return;
    if (!W.started) hideIntro();
    const p = pick(e.clientX, e.clientY); if (!p) return;
    if (p.stop) driveTo(p.stop); else if (onIsland(p.x, p.z)) driveToPoint(p.x, p.z);
  });
  let hoverT = 0;
  canvas.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; const now = performance.now(); if (now - hoverT < 90) return; hoverT = now; const p = pick(e.clientX, e.clientY); canvas.classList.toggle('pointing', !!(p && p.stop)); });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); W.zoom = Math.max(0.65, Math.min(1.6, W.zoom * (e.deltaY > 0 ? 1.08 : 0.93))); }, { passive: false });

  // joystick
  const joy = $('.joy'), knob = joy.querySelector('i');
  const joyMove = (e) => { const r = joy.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2); const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; } W.joy.x = x; W.joy.y = y; knob.style.transform = `translate(${x * 38}px, ${y * 38}px)`; };
  joy.addEventListener('pointerdown', (e) => { e.preventDefault(); joy.setPointerCapture(e.pointerId); W.joy.on = true; W.auto = null; world.hideTarget(); if (!W.started) hideIntro(); joyMove(e); });
  joy.addEventListener('pointermove', (e) => { if (W.joy.on) joyMove(e); });
  const joyEnd = () => { W.joy.on = false; W.joy.x = W.joy.y = 0; knob.style.transform = ''; };
  joy.addEventListener('pointerup', joyEnd); joy.addEventListener('pointercancel', joyEnd);

  /* --- HUD and panel buttons --- */
  $('.hud-tools [data-map]').addEventListener('click', () => { hideIntro(true); openMap(); });
  $('.mapview .x').addEventListener('click', closeMap);
  $('.mapview').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeMap(); });
  $('.hud-next .go').addEventListener('click', () => { const s = nextStop(); if (s) { hideIntro(true); driveTo(s); } });
  $('.panel-x').addEventListener('click', closePanel);
  $('.panel [data-drive-on]').addEventListener('click', closePanel);
  $('.panel [data-prev]').addEventListener('click', () => stepStop(-1));
  $('.panel [data-next]').addEventListener('click', () => stepStop(1));
  $('.intro [data-start]').addEventListener('click', () => hideIntro());

  /* --- sizing --- */
  W.resize = () => { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 0.8 ? 50 : 36; camera.updateProjectionMatrix(); };
  addEventListener('resize', () => W && W.resize());

  /* --- loop --- */
  const clock = new THREE.Clock(); let acc = 0, frame = 0;
  const v = new THREE.Vector3();
  const input = { throttle: 0, steer: 0, boost: false, brake: false };
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, clock.getDelta()); const time = clock.elapsedTime;
    if (mode !== 'world' || document.hidden) return;
    frame++;
    computeInput(input, car.state);
    if (W.glide) runGlide(dt);
    else { acc += dt; while (acc > 1 / 120) { car.step(1 / 120, input, world.colliders, dyn); acc -= 1 / 120; } }
    W.updatePins(dt);
    car.render(dt, input, time, reduced);
    if (W.started && !W.glide) checkPads();
    // camera
    const s = car.state;
    if (!W.started) {
      W.introT += reduced ? 0 : dt;
      const a = -0.5 + W.introT * 0.07; const r = 30;
      camera.position.set(Math.sin(a) * r, 24, -4 + Math.cos(a) * r); camera.lookAt(0, 0, -6);
      W.camP.copy(camera.position); W.camT.set(0, 0, -6);
    } else {
      const lead = W.glide ? 0 : 0.3;
      const tx = s.x + s.vx * lead, tz = s.z + s.vz * lead;
      const k = reduced ? 1 : 1 - Math.exp(-4 * dt);
      W.camT.x += (tx - W.camT.x) * k; W.camT.z += (tz - W.camT.z) * k;
      const z = W.zoom * (camera.aspect < 0.8 ? 1.15 : 1);
      const want = v.set(W.camT.x, 25 * z, W.camT.z + 21 * z);
      const kp = reduced ? 1 : 1 - Math.exp(-(W.blend ? 2.2 : 6) * dt);
      W.camP.lerp(want, kp); if (W.blend && W.camP.distanceTo(want) < 0.3) W.blend = false;
      camera.position.copy(W.camP); camera.lookAt(W.camT.x + (W.camP.x - want.x) * 0.0, 0, W.camT.z - 2);
    }
    // guidance chevron
    const ns = nextStop(); const tgt = W.auto || ns;
    if (tgt && W.started) { const dx = tgt.x - s.x, dz = tgt.z - s.z, d = Math.hypot(dx, dz); const ch = world.chevron; ch.visible = d > 6 && !W.panelOpen; const a = Math.atan2(dx, dz); ch.position.set(s.x + Math.sin(a) * 3.6, 0.12, s.z + Math.cos(a) * 3.6); ch.rotation.y = a; } else world.chevron.visible = false;
    const ao = agentOpen(); document.body.classList.toggle('agent-open', ao); document.body.classList.toggle('map-open', W.mapOpen); document.body.classList.toggle('panel-open', W.panelOpen);
    world.update(time, dt, { x: s.x, z: s.z }, ao);
    renderer.render(scene, camera);
    placeMarkers(ns);
    if (frame % 4 === 0) { W.drawMini(); updateNextHud(ns); if (W.mapOpen) W.drawBig(); }
    if (W.started && !W.panelOpen && (input.throttle || W.auto)) { W.lastDrive += dt; if (W.lastDrive > 10) $('.hud-keys').classList.add('faded'); }
  }
  W.resize(); loop();

  function computeInput(inp, s) {
    inp.throttle = 0; inp.steer = 0; inp.boost = false; inp.brake = false;
    if (!W.started || W.panelOpen || W.mapOpen || agentOpen() || W.glide) { inp.brake = true; return; }
    const K = W.keys;
    if (K.size) { inp.throttle = (K.has('u') ? 1 : 0) - (K.has('d') ? 1 : 0); inp.steer = (K.has('l') ? 1 : 0) - (K.has('r') ? 1 : 0); inp.boost = K.has('b'); inp.brake = K.has('x'); return; }
    if (W.joy.on) { const m = Math.hypot(W.joy.x, W.joy.y); if (m > 0.15) steerToward(inp, s, W.joy.x, W.joy.y, Math.min(1, m * 1.15), false); return; }
    if (W.auto) {
      const dx = W.auto.x - s.x, dz = W.auto.z - s.z, d = Math.hypot(dx, dz);
      if (d < (W.auto.stop ? 1.6 : 1.4)) { const st = W.auto.stop; W.auto = null; world.hideTarget(); inp.brake = true; if (st && !W.panelOpen) { st.inside = true; enterStop(st); } return; }
      steerToward(inp, s, dx, dz, Math.min(1, 0.35 + d / 10), true);
      // stuck: if no progress, glide the rest of the way
      const now = performance.now();
      if (d < W.auto.best - 0.6) { W.auto.best = d; W.auto.bestT = now; }
      else if (now - W.auto.bestT > 2200) { const st = W.auto.stop; const tx = W.auto.x, tz = W.auto.z; W.auto = null; world.hideTarget(); if (st) glideTo(st); else startGlide(tx, tz, s.h, null); }
    }
  }
  function steerToward(inp, s, dx, dz, mag, avoid) {
    let desired = Math.atan2(dx, dz);
    if (avoid) {
      let push = 0;
      for (const c of world.colliders) {
        const ox = c.x - s.x, oz = c.z - s.z, od = Math.hypot(ox, oz); if (od > 8 || od < 0.01) continue;
        const rel = wrap(Math.atan2(ox, oz) - desired); if (Math.abs(rel) > 0.9) continue;
        if (od > Math.hypot(dx, dz)) continue;
        const lateral = Math.sin(rel) * od; if (Math.abs(lateral) > c.r + 1.9) continue;
        push += (rel > 0 ? -1 : 1) * (1 - od / 8) * 1.3;
      }
      desired += Math.max(-1.1, Math.min(1.1, push));
    }
    const diff = wrap(desired - s.h);
    inp.steer = Math.max(-1, Math.min(1, diff * 2.4));
    inp.throttle = mag * (Math.abs(diff) > 2 ? 0.4 : 1);
  }

  function checkPads() {
    const s = car.state;
    for (const st of STOPS) {
      const d = Math.hypot(st.x - s.x, st.z - s.z), inside = d < 2.75;
      if (inside && !st.inside) { st.inside = true; if (!W.panelOpen && !agentOpen()) enterStop(st); }
      else if (!inside && d > 3.4) st.inside = false;
      world.setPad(st.id, { visited: visited.has(st.id), near: d < 2.75, next: nextStop() === st });
    }
  }

  function placeMarkers(ns) {
    const w = innerWidth, h = innerHeight, s = car.state;
    for (const st of STOPS) {
      v.set(st.x, 2.6, st.z).project(camera);
      const x = (v.x + 1) / 2 * w, y = (1 - v.y) / 2 * h, el = st.el;
      const off = v.z > 1 || x < -60 || x > w + 60 || y < -40 || y > h + 40 || !W.started;
      if (off) { if (el.style.visibility !== 'hidden') el.style.visibility = 'hidden'; continue; }
      el.style.visibility = 'visible';
      el.style.transform = `translate(${(x - 17).toFixed(1)}px, ${(y - 17).toFixed(1)}px)`;
      const d = Math.hypot(st.x - s.x, st.z - s.z);
      el.classList.toggle('visited', visited.has(st.id));
      el.classList.toggle('next', st === ns);
      el.classList.toggle('near', d < 3);
      el.classList.toggle('far', d > (small ? 16 : 26) && st !== ns && st !== (W.auto && W.auto.stop));
    }
  }
  function updateNextHud(ns) {
    const box = $('.hud-next');
    $('.hbtn .count').innerHTML = `<em>${visited.size}</em>/${STOPS.length}`;
    if (!ns) return;
    const d = Math.round(Math.hypot(ns.x - car.state.x, ns.z - car.state.z));
    box.querySelector('.nm').textContent = ns.label;
    box.querySelector('.dist').textContent = d < 4 ? 'here' : d + ' m';
    box.querySelector('.lbl').textContent = visited.size === STOPS.length ? 'All read. Next:' : `Next stop ${ns.n} of ${STOPS.length}:`;
  }
}

function wrap(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
function onIsland(x, z) { return Math.hypot(x, z) < islandR(Math.atan2(z, x)) - 1; }
function nearestStop(x, z, max) { let best = null, bd = max; STOPS.forEach((s) => { const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; best = s; } }); return best; }
function nextStop() {
  const order = STOPS;
  const cur = W && W.current ? STOPS.indexOf(W.current) : -1;
  for (let i = 1; i <= order.length; i++) { const s = order[(cur + i + order.length) % order.length]; if (!visited.has(s.id)) return s; }
  return STOPS[(cur + 1 + STOPS.length) % STOPS.length];
}
function agentOpen() { const d = document.querySelector('.va-drawer'); return !!(d && d.getAttribute('aria-hidden') === 'false'); }

/* ---------- moving the car ---------- */
function driveTo(s) {
  const c = W.car.state;
  if (Math.hypot(s.x - c.x, s.z - c.z) < 2.75) { s.inside = true; enterStop(s); return; }
  if (W.panelOpen) closePanel();
  W.auto = { x: s.x, z: s.z, stop: s, best: Infinity, bestT: performance.now() };
  W.world.showTarget(s.x, s.z);
}
function driveToPoint(x, z) { W.auto = { x, z, stop: null, best: Infinity, bestT: performance.now() }; W.world.showTarget(x, z); }
function glideTo(s, instant = false) { startGlide(s.x, s.z + 0.2, Math.PI, s, instant); }
function startGlide(x, z, h, stop, instant = false) {
  const c = W.car.state; W.auto = null; W.world.hideTarget();
  if (!W.started) { W.started = true; W.blend = true; }
  if (W.panelOpen) closePanel(true);
  STOPS.forEach((st) => { st.inside = false; });
  if (instant || reduced) { W.car.place(x, z, h); W.camT.set(x, 0, z); W.camP.set(x, 25 * W.zoom, z + 21 * W.zoom); if (stop) { stop.inside = true; enterStop(stop); } return; }
  W.glide = { fx: c.x, fz: c.z, fh: c.h, x, z, h, t: 0, dur: Math.min(1.3, 0.45 + Math.hypot(x - c.x, z - c.z) / 70), stop };
}
function runGlide(dt) {
  const g = W.glide; g.t += dt / g.dur; const t = Math.min(1, g.t), e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const s = W.car.state; s.x = g.fx + (g.x - g.fx) * e; s.z = g.fz + (g.z - g.fz) * e; s.h = g.fh + wrap(g.h - g.fh) * e; s.vx = s.vz = 0;
  if (t >= 1) { W.glide = null; W.car.place(g.x, g.z, g.h); if (g.stop) { g.stop.inside = true; enterStop(g.stop); } }
}

/* ---------- stops, panel ---------- */
let slot = null;
function enterStop(s) {
  W.current = s;
  if (W.auto) { W.auto = null; W.world.hideTarget(); }
  markVisited(s);
  if (s.agent) { if (W.panelOpen) closePanel(true); toast('Front desk', `Email: ${C.contact.email}`); return; }
  openPanel(s);
}
function markVisited(s) {
  if (visited.has(s.id)) return;
  visited.add(s.id); saveVisited(); W.fresh = true; setTimeout(() => { W.fresh = false; }, 50);
  if (visited.size === STOPS.length) toast('Every stop read', `Thanks for driving. Email: ${C.contact.email}`);
  else toast(s.label, `Stop ${s.n} read · ${visited.size} of ${STOPS.length}`);
}
function openPanel(s) {
  if (!visited.has(s.id) || !W.fresh) hideToast();
  const panel = $('.panel'), body = $('.panel-body');
  restoreSlot();
  const el = document.getElementById(s.node); if (!el) return;
  slot = { el, mark: document.createComment('slot') }; el.before(slot.mark); body.append(el); body.scrollTop = 0;
  $('#panel-title').textContent = s.label;
  $('.panel .eyebrow').textContent = `Stop ${s.n} of ${STOPS.length} · ${s.group}`;
  const i = STOPS.indexOf(s);
  $('.panel [data-prev] .t').textContent = STOPS[(i - 1 + STOPS.length) % STOPS.length].label;
  $('.panel [data-next] .t').textContent = STOPS[(i + 1) % STOPS.length].label;
  panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false'); panel.inert = false;
  W.panelOpen = true; W.keys.clear();
  setTimeout(() => $('#panel-title').focus({ preventScroll: true }), 30);
}
function restoreSlot() { if (slot) { slot.mark.replaceWith(slot.el); slot = null; } }
function closePanel(silent) {
  if (!W || !W.panelOpen) { restoreSlot(); return; }
  const panel = $('.panel'); panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); panel.inert = true;
  W.panelOpen = false;
  setTimeout(() => { if (!W.panelOpen) restoreSlot(); }, 450);
  if (!silent) $('#world').focus({ preventScroll: true });
}
function stepStop(dir) {
  const i = W.current ? STOPS.indexOf(W.current) : -1;
  const s = STOPS[(i + dir + STOPS.length) % STOPS.length];
  closePanel(true); restoreSlot(); glideTo(s);
}

/* ---------- map, intro ---------- */
function openMap() { if (!W) return; W.mapOpen = true; W.drawBig(); [...document.querySelectorAll('.map-list li')].forEach((li, i) => li.classList.toggle('v', visited.has(STOPS[i].id))); const m = $('.mapview'); m.classList.add('open'); m.setAttribute('aria-hidden', 'false'); m.inert = false; setTimeout(() => $('.mapview .x').focus(), 30); }
function closeMap() { if (!W || !W.mapOpen) return; W.mapOpen = false; const m = $('.mapview'); m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); m.inert = true; $('#world').focus({ preventScroll: true }); }
function showIntro() {
  const el = $('.intro'), P = C.person;
  el.querySelector('.eyebrow').textContent = P.looking_for;
  el.querySelector('h1').textContent = `${P.first_name} ${P.last_name}`;
  el.querySelector('.role').textContent = P.current;
  el.querySelector('.headline').textContent = P.headline;
  el.querySelector('img').src = C.media.cutout;
  el.querySelector('.keys .n-stops').textContent = `${STOPS.length} stops, one for each part of the story`;
  el.querySelector('.forline').textContent = forLine(C);
  el.querySelector('.forline').hidden = !forLine(C);
  el.classList.remove('gone');
}
function hideIntro(silent) {
  if (!W || W.started) { $('.intro').classList.add('gone'); return; }
  W.started = true; W.blend = true;
  $('.intro').classList.add('gone');
  if (!silent) setTimeout(() => toast('Drive into a diamond', touch ? 'Use the stick, or tap where you want to go.' : 'Arrow keys or WASD to drive. Or click where you want to go.'), 500);
  $('#world').focus({ preventScroll: true });
}
