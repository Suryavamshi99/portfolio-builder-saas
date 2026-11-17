// Lakshmi Naidu: playable resume. A pixel platformer in Three.js.
// The street runs through her career in order. Checkpoint terminals open chapters,
// case-file folders unlock project write-ups.
import * as THREE from '../vendor/three.module.min.js';
import * as A from './art.js';
import { loadContent, esc, media, projectBodyHTML, forCompanyLine, companyFromQuery, PHOTO_ALT } from './render.js';

const VIEW_H = 240;          // internal pixel height of the game screen
const G = 36;                // top of the pavement, in world pixels
const WORLD_W = 3560;
const PHYS = { accel: 900, air: 560, max: 92, friction: 1100, gravity: 900, jump: 292, cut: 0.45, coyote: 0.1, buffer: 0.13 };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && matchMedia('(hover: none)').matches);
if (coarse) document.body.classList.add('touch');
const SAVE_KEY = 'lakshmi-pixel-resume-v2';

/* ---------------- level design ---------------- */
// Chapters in career order. cp = x of the checkpoint terminal.
const CHAPTERS = [
  { id: 'meet', n: 1, cp: 238, short: 'Meet', year: 'Now', title: 'Meet Lakshmi' },
  { id: 'study', n: 2, cp: 600, short: 'Study', year: '2019', title: 'Psychology in Larchmont Falls' },
  { id: 'ta', n: 3, cp: 822, short: 'Hiring', year: '2020', title: 'Recruiting, Pinewick Paper & Print' },
  { id: 'hrbp', n: 4, cp: 1196, short: 'HRBP', year: '2022', title: 'HR Business Partner, Pinewick' },
  { id: 'mu', n: 5, cp: 1700, short: 'MBA', year: '2025', title: "MBA at Harrowgate School of Management" },
  { id: 'depot', n: 6, cp: 2214, short: 'Tallow Bay', year: '2026', title: 'Tallow Bay Freight placement' },
  { id: 'outside', n: 7, cp: 2566, short: 'Drawer', year: '2024+', title: 'The Third Drawer and life outside work' },
  { id: 'wins', n: 8, cp: 2936, short: 'Wins', year: '', title: 'Wins, skills and references' },
  { id: 'contact', n: 9, cp: 3336, short: 'Contact', year: '', title: "Let's talk" },
];
const TOKENS = [
  { slug: 'autumn-rush-hiring', ch: 'ta', x: 1000, y: G + 84, short: 'Autumn rush' },
  { slug: 'new-hire-orientation', ch: 'hrbp', x: 1334, y: G + 100, short: 'New-hire orientation' },
  { slug: 'job-grades-pay-bands', ch: 'hrbp', x: 1561, y: G + 176, short: 'Job grades' },
  { slug: 'staff-survey-readout', ch: 'mu', x: 1798, y: G + 78, short: 'Staff survey' },
  { slug: 'case-challenge', ch: 'mu', x: 1916, y: G + 52, short: 'Case challenge' },
  { slug: 'plain-english-handbook', ch: 'mu', x: 2076, y: G + 90, short: 'Handbook kit' },
  { slug: 'depot-first-month', ch: 'depot', x: 2354, y: G + 66, short: 'Depot first month' },
  { slug: 'third-drawer', ch: 'outside', x: 2654, y: G + 60, short: 'Third Drawer' },
];
// Platforms: one-way ledges (land from above) and solid boxes.
const PLATFORMS = [];
const SOLIDS = [];

/* ---------------- state ---------------- */
let D;                         // content
const save = loadSave();
const player = { x: save.x || 130, y: G, vx: 0, vy: 0, w: 10, h: 22, face: 1, ground: true, coyote: 0, buffer: 0, anim: 0 };
const input = { l: false, r: false, jump: false, jumpHeld: false };
let curZone = null;
let paused = true, camX = 0, camFocus = null, lastPick = null;
let renderer, scene, camera, IW = 400, scale = 3;
const layers = [], flickers = [], tokenMeshes = new Map(), cpMeshes = new Map(), particles = [];
let rain, playerMesh, playerTex, glowTex;

function loadSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { return {}; } }
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ tokens: [...got], cps: [...lit], x: Math.round(player.x) })); } catch { /* storage blocked */ } }
const got = new Set(save.tokens || []);
const lit = new Set(save.cps || []);

/* ---------------- three helpers ---------------- */
function tex(canvas, repeat = false) {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = THREE.RepeatWrapping; }
  return t;
}
function sprite(canvas, x, y, order, { additive = false, opacity = 1, parent = scene, w, h } = {}) {
  const W = w || canvas.width, H = h || canvas.height;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: tex(canvas), transparent: true, depthTest: false, depthWrite: false, opacity, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
  // keep texel edges on whole pixels: round the corner, not the centre
  m.position.set(Math.round(x) + W / 2, Math.round(y) + H / 2, 0);
  m.renderOrder = order; parent.add(m);
  return m;
}
const ORDER = { sky: 0, far: 1, mid: 2, back: 3, bld: 4, sign: 5, prop: 6, plat: 7, cp: 8, glow: 9, token: 10, player: 11, fx: 12, rain: 13, light: 14 };

/* ---------------- world ---------------- */
function plat(x, y, w, canvas, order = ORDER.plat) { PLATFORMS.push({ x, y, w }); if (canvas) sprite(canvas, x, y - canvas.height, order); }
function solid(x, w, h, canvas) { SOLIDS.push({ x, y: G, w, h }); if (canvas) sprite(canvas, x, G, ORDER.plat); }
function building(canvas, x, seed) { sprite(canvas, x, G, ORDER.bld); sprite(A.roof(canvas.width, seed), x, G + canvas.height, ORDER.back); }
function sign(canvas, x, y, flicker = false) { const m = sprite(canvas, x, y, ORDER.sign); if (flicker) flickers.push({ m, t: Math.random() * 5 }); return m; }

function buildWorld(portraitImg) {
  const N = (t, o) => A.neonSign(t, o);
  const ST = '8px Silkscreen', PX = (s) => `700 ${s >= 24 ? 24 : 16}px Silkscreen`;

  // Sky and parallax skylines (screen-anchored meshes, scrolled by texture offset)
  const sky = sprite(A.skyGradient(VIEW_H), 0, 0, ORDER.sky, { w: 4000, h: VIEW_H });
  layers.push({ m: sky, f: 1, tile: 0 });
  const mo = sprite(A.moon(), 0, 180, ORDER.sky); layers.push({ m: mo, f: 0.97, fixedX: 0.72 });
  const far = A.skyline(512, 150, { seed: 5, col: '#962c50', winCol: '#e06b95', density: 0.35, minH: 50, maxH: 140, neon: ['#ffce4f', '#ad3eff'] });
  const mid = A.skyline(640, 130, { seed: 9, col: '#6b1d37', winCol: '#6bff85', density: 0.22, minH: 40, maxH: 120, neon: ['#ffce4f', '#ad3eff', '#4affdd'] });
  for (const [c, y, f, ord] of [[far, G + 4, 0.85, ORDER.far], [mid, G, 0.6, ORDER.mid]]) {
    const t = tex(c, true);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, c.height), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false }));
    m.renderOrder = ord; m.position.y = y + c.height / 2; scene.add(m);
    layers.push({ m, f, tile: c.width, t });
  }

  // Street-side lamps and their light
  for (let x = 290; x < WORLD_W - 40; x += 270) {
    sprite(A.lamp(), x, G - 2, ORDER.prop);
    sprite(A.lampCone(), x - 12, G - 2, ORDER.light, { additive: true, opacity: 0.6 });
  }

  // 1. Meet: name sign building
  building(A.facade(430, 204, {
    seed: 1, base: '#5c2a42', shopH: 42, door: 196, doorCol: '#ffce4f', glassX: 14, glassW: 92, glow: '#4558ff', pipe: 300,
    masks: [[0, 18, 330, 110], [300, 10, 130, 140]],
  }), 0, 1);
  const nameSign = N('', { font: PX(26), color: '#4aff87', back: '#5fe21f', frame: '#3aff4e', lines: ['LAKSHMI NAIDU'], padX: 7, padY: 5, stripes: true });
  sign(nameSign, 6, G + 108);
  sign(N('HR BUSINESS PARTNER', { font: ST, color: '#7d9dff', frame: '#4558ff', back: '#0d0d2a' }), 26, G + 86, true);
  sign(N('OPEN TO HRBP ROLES · JAN 2027', { font: ST, color: '#7d9dff', frame: '#4558ff', back: '#0d0d2a' }), 26, G + 62);
  // pixelated portrait billboard
  if (portraitImg) {
    const bb = A.heroPortrait(portraitImg, 44, 52);
    const fr = A.cv(50, 58); fr.x.fillStyle = '#ffce4f'; fr.x.fillRect(0, 0, 50, 58); fr.x.drawImage(bb, 3, 3);
    sprite(fr.c, 352, G + 112, ORDER.sign);
  }
  const co = companyFromQuery();
  if (co) sign(N(`HELLO, ${co.toUpperCase()}`, { font: ST, color: '#ffe29b', frame: '#ffce4f' }), 176, G + 44, true);
  sprite(A.bench(), 120, G, ORDER.prop);
  sprite(A.hydrant(), 300, G, ORDER.prop);
  // tutorial paint on the wall
  sign(A.pixelText(coarse ? '< > = WALK' : '< > OR A D = WALK', { font: ST, color: '#c9d0f7', glow: '#4558ff', blur: 3 }), 16, G + 45);
  sign(A.pixelText(coarse ? 'A = JUMP' : 'SPACE = JUMP', { font: ST, color: '#c9d0f7', glow: '#4558ff', blur: 3 }), 326, G + 70);
  sign(A.pixelText(coarse ? 'B = OPEN' : 'E = OPEN', { font: ST, color: '#3fff72', glow: '#51ff3d', blur: 3 }), 216, G + 45);
  plat(330, G + 24, 34, A.awning(34, '#ad3eff', '#4a1441'));
  plat(372, G + 52, 34, A.awning(34, '#ffce4f', '#401617'));

  // 2. Study: old brick college
  building(A.facade(300, 176, {
    seed: 2, base: '#5a482d', brick: true, shopH: 40, door: 176, doorCol: '#6bff85', glassX: 16, glassW: 120, glow: '#6bff85', warm: '#7aff90', cool: '#fb9fff',
    masks: [[20, 20, 260, 52]],
    extra: (x, { sy, R }) => { for (let i = 20; i < 134; i += 8) R(i, sy + 14, 5, 22, ['#51ff3d', '#ad3eff', '#4affdd', '#ffce4f', '#e6f3e8'][(i / 8) % 5 | 0]); },
  }), 450, 2);
  sign(N('CLASS OF 2019', { font: PX(16), color: '#d89fff', frame: '#ad3eff' }), 474, G + 130);
  sign(N('BA PSYCHOLOGY', { font: ST, color: '#ffe29b', frame: '#ffce4f' }), 508, G + 110, true);
  sign(N('ASHGROVE', { font: ST, color: '#4aff87', frame: '#3aff4e' }), 662, G + 116);
  sprite(A.plant(), 456, G, ORDER.prop); sprite(A.plant(), 716, G, ORDER.prop);
  solid(690, 22, 14, A.crate(22, 14, '#8a4b4a'));

  // 3. Talent acquisition: hiring office + rush-season bus
  building(A.facade(330, 196, {
    seed: 3, base: '#5c1f58', shopH: 44, door: 52, doorCol: '#ad3eff', glassX: 92, glassW: 110, glow: '#ad3eff', panel: 26,
    masks: [[10, 16, 310, 70]],
  }), 770, 3);
  sign(N('NOW HIRING', { font: PX(22), color: '#ffe29b', frame: '#ffce4f', back: '#2a1a0a' }), 784, G + 140, true);
  sign(N('TALENT ACQUISITION', { font: ST, color: '#d89fff', frame: '#ad3eff' }), 940, G + 160);
  sign(N('90+ STAFF HIRED', { font: ST, color: '#4aff87', frame: '#3aff4e' }), 940, G + 140);
  const busC = A.bus('RUSH 2021');
  solid(896, 96, 32, null); sprite(busC, 896, G - 6, ORDER.plat);
  plat(960, G + 70, 62, A.ledge(62, '#5c6688', 'BILLBOARD', '#4aff87'));
  sign(N('61 STARTED', { font: ST, color: '#4affdd', frame: '#4affdd' }), 958, G + 86 + 18);

  // 4. HRBP: Pinewick tower
  building(A.facade(460, 232, {
    seed: 4, base: '#48164a', shopH: 46, door: 30, doorCol: '#4affdd', glassX: 64, glassW: 120, glow: '#4affdd', winStep: 16, cool: '#d67fff', pipe: 214,
    masks: [[10, 30, 240, 80], [250, 0, 210, 232]],
  }), 1150, 4);
  sign(N('PINEWICK', { font: PX(22), color: '#d0fffd', frame: '#4affdd', back: '#0f192a' }), 1156, G + 158, true);
  sign(N('PINEWICK · 260 PEOPLE', { font: ST, color: '#d89fff', frame: '#ad3eff' }), 1270, G + 134);
  const tr = A.cv(70, 40); tr.x.drawImage(A.trophy(), 27, 0); tr.x.drawImage(A.pixelText('LARCH LEAF', { font: ST, color: '#4aff87', glow: '#3aff4e', blur: 3 }), 0, 22); tr.x.drawImage(A.pixelText('2023', { font: ST, color: '#4aff87' }), 26, 31);
  sign(tr.c, 1160, G + 120, true);
  solid(1252, 20, 20, A.crate(20, 20));
  plat(1282, G + 52, 22, A.acUnit());
  plat(1308, G + 86, 50, A.awning(50, '#4affdd', '#141a30'));
  sign(A.pixelText('ONBOARDING', { font: ST, color: '#4affdd', glow: '#4affdd', blur: 3 }), 1310, G + 72);
  for (let i = 0; i < 6; i++) plat(1412 + i * 30, G + 24 + i * 28, 24, A.ledge(24, '#5c6688', 'G' + (i + 1), '#ad3eff'));
  sign(A.pixelText('GRADES', { font: ST, color: '#d89fff', glow: '#ad3eff', blur: 3 }), 1404, G + 6);

  // 5. Harrowgate School of Management campus
  building(A.facade(500, 214, {
    seed: 5, base: '#4f1f2c', shopH: 46, door: 40, doorCol: '#ffffff', glassX: 80, glassW: 160, glow: '#ffa8c3', winW: 14, winH: 16, winStep: 20, warm: '#e6f3e8', cool: '#ffa8c3',
    masks: [[10, 30, 480, 60]],
  }), 1660, 5);
  sign(N('HARROWGATE', { font: PX(20), color: '#ffffff', frame: '#ffa8c3', back: '#300c16' }), 1676, G + 148);
  sign(N('MBA 2025–26 · PEOPLE TRACK', { font: ST, color: '#ffb8cb', frame: '#ffa8c3' }), 1852, G + 122, true);
  solid(1742, 18, 26, A.crate(18, 26, '#7a3e68'));
  sprite(A.plant(), 1744, G + 26, ORDER.prop);
  plat(1770, G + 62, 60, null); sprite(A.heatmap(60, 34), 1770, G + 28, ORDER.plat);
  sign(A.pixelText('SURVEY', { font: ST, color: '#4aff87', glow: '#51ff3d', blur: 3 }), 1782, G + 16);
  // podium: 2, 1, 3
  const pod = (x, h, n, col) => { const cc = A.crate(24, h, col); cc.getContext('2d').drawImage(A.pixelText(n, { font: ST, color: '#401220' }), 9, 2); solid(x, 24, h, cc); };
  pod(1880, 22, '2', '#c0c6d8'); pod(1904, 36, '1', '#3fff72'); pod(1928, 14, '3', '#4dd04a');
  sign(A.pixelText('1ST OF 18', { font: ST, color: '#4aff87', glow: '#3aff4e', blur: 3 }), 1894, G + 76);
  // two easy hops: 32px onto the step, then 40px onto the screen (max jump is 47px)
  plat(2002, G + 32, 40, A.ledge(40, '#5c6688'));
  plat(2046, G + 72, 60, null); sprite(A.screenChart(60, 30), 2046, G + 42, ORDER.plat);
  sign(A.pixelText('PAY BANDS', { font: ST, color: '#4affdd', glow: '#4affdd', blur: 3 }), 2054, G + 38);

  // 6. Tallow Bay Freight depot
  building(A.facade(330, 150, {
    seed: 6, base: '#3a2340', shopH: 52, door: 40, doorCol: '#51ff3d', glassX: 74, glassW: 150, glow: '#51ff3d', warm: '#6dff6b',
    masks: [[10, 8, 310, 46]],
    extra: (x, { sy, R }) => { for (let i = 80; i < 220; i += 12) { R(i, sy + 16, 10, 3, '#132a10'); R(i, sy + 30, 10, 3, '#132a10'); R(i + 1, sy + 10, 3, 6, '#3fff72'); R(i + 5, sy + 12, 3, 4, '#2f35bf'); R(i + 2, sy + 25, 6, 5, '#e6f3e8'); } },
  }), 2170, 6);
  sign(N('FREIGHT DEPOT 24/7', { font: PX(18), color: '#aaffa8', frame: '#51ff3d', back: '#0c2a06' }), 2184, G + 112, true);
  sign(N('TALLOW BAY', { font: ST, color: '#aaffa8', frame: '#51ff3d' }), 2386, G + 118);
  sprite(A.scooter(), 2250, G, ORDER.prop); sprite(A.scooter('#3cff1a'), 2278, G, ORDER.prop);
  solid(2310, 20, 16, A.crate(20, 16)); solid(2330, 20, 32, A.crate(20, 32, '#48c44c')); solid(2350, 20, 48, A.crate(20, 48));

  // 7. Third Drawer kiosk, folk-dance poster, crossword cafe
  building(A.facade(340, 164, {
    seed: 7, base: '#4f2445', shopH: 44, door: 270, doorCol: '#6bff85', glassX: 190, glassW: 70, glow: '#6bff85',
    masks: [[10, 10, 320, 60], [6, 100, 120, 70]],
  }), 2540, 7);
  const k = A.kiosk(); sprite(k, 2626, G, ORDER.prop); plat(2626, G + 52, 56, null);
  solid(2596, 22, 20, A.crate(22, 20, '#7a3e68'));
  sign(N('DRAWER 3', { font: PX(18), color: '#d89fff', frame: '#ad3eff' }), 2620, G + 70, true);
  sign(A.poster(['FOLK', 'DANCE', 'LARCHMONT', 'JANUARY'], '#fffae1', '#a09220'), 2556, G + 54);
  sign(N('CROSSWORDS', { font: ST, color: '#4aff87', frame: '#3aff4e' }), 2722, G + 128);
  sign(N('NEWSLETTER · 1,450 READERS', { font: ST, color: '#d89fff', frame: '#ad3eff' }), 2650, G + 150);
  sprite(A.bench(), 2760, G, ORDER.prop);

  // 8. Wins arcade
  building(A.facade(330, 186, {
    seed: 8, base: '#501e16', shopH: 48, door: 284, doorCol: '#3fff72', glassX: 140, glassW: 120, glow: '#ffce4f',
    masks: [[10, 10, 310, 60]],
  }), 2900, 8);
  sign(N('WINS', { font: PX(26), color: '#a0ffc0', frame: '#3fff72', back: '#003a07' }), 2916, G + 132, true);
  sign(N('SKILLS · TOOLS · REFERENCES', { font: ST, color: '#ffe29b', frame: '#ffce4f' }), 3000, G + 140);
  ['#ffce4f', '#ad3eff', '#4affdd'].forEach((c, i) => solid(2980 + i * 22, 18, 40, null) || sprite(A.arcade(c), 2980 + i * 22, G, ORDER.plat));
  for (let i = 0; i < 4; i++) sprite(A.trophy(), 3050 + i * 20, G + 22, ORDER.sign);

  // 9. Contact
  building(A.facade(300, 200, {
    seed: 9, base: '#481d37', shopH: 46, door: 126, doorW: 26, doorCol: '#ffce4f', glassX: 14, glassW: 90, glow: '#ffce4f',
    masks: [[10, 10, 280, 70]],
  }), 3220, 9);
  sign(N("LET'S TALK", { font: PX(26), color: '#fff3d2', frame: '#ffce4f', back: '#2a1c06' }), 3240, G + 140, true);
  sign(N('LAKSHMI.NAIDU@EXAMPLE.COM', { font: ST, color: '#7d9dff', frame: '#4558ff', back: '#0d0d2a' }), 3248, G + 116);
  sprite(A.phoneBooth(), 3450, G, ORDER.prop);
  solid(WORLD_W - 30, 30, 120, null);
  const wall = A.cv(30, 160); wall.x.fillStyle = '#260c13'; wall.x.fillRect(0, 0, 30, 160); for (let y = 0; y < 160; y += 6) { wall.x.fillStyle = '#551f2f'; wall.x.fillRect(0, y, 30, 1); }
  sprite(wall.c, WORLD_W - 30, G, ORDER.plat);

  // Ground with neon reflections under the big signs
  const refl = [[6, 200, '#56ff2b'], [470, 160, '#ad3eff'], [784, 150, '#ffce4f'], [1156, 160, '#4affdd'], [1676, 200, '#ffa8c3'], [2184, 170, '#51ff3d'], [2620, 70, '#ad3eff'], [2916, 100, '#3fff72'], [3240, 140, '#ffce4f']];
  sprite(A.ground(WORLD_W, G, refl), 0, 0, ORDER.back);

  // Checkpoints
  for (const ch of CHAPTERS) {
    const on = lit.has(ch.id);
    const mA = sprite(A.terminal(true, ch.n), ch.cp - 7, G, ORDER.cp), mI = sprite(A.terminal(false, ch.n), ch.cp - 7, G, ORDER.cp);
    mA.visible = on; mI.visible = !on;
    const glow = sprite(A.glowBlob('rgba(69,88,255,.55)', 18), ch.cp - 18, G + 12, ORDER.glow, { additive: true });
    glow.visible = on;
    cpMeshes.set(ch.id, { mA, mI, glow });
  }
  // Case-file tokens
  const fc = A.folder();
  glowTex = A.glowBlob('rgba(63,255,114,.6)', 14);
  for (const t of TOKENS) {
    const g = sprite(glowTex, t.x - 14, t.y - 8, ORDER.glow, { additive: true });
    const m = sprite(fc, t.x - 7, t.y, ORDER.token);
    const taken = got.has(t.slug);
    m.visible = !taken; g.visible = !taken;
    tokenMeshes.set(t.slug, { m, g, baseY: m.position.y });
  }

  // Player
  playerTex = tex(A.playerSheet());
  playerTex.repeat.set(1 / A.FRAMES.length, 1);
  playerMesh = new THREE.Mesh(new THREE.PlaneGeometry(16, 24), new THREE.MeshBasicMaterial({ map: playerTex, transparent: true, depthTest: false, depthWrite: false }));
  playerMesh.renderOrder = ORDER.player; scene.add(playerMesh);
  const shadow = A.cv(14, 3); shadow.x.fillStyle = 'rgba(0,0,0,.35)'; shadow.x.fillRect(1, 0, 12, 3);
  player.shadow = sprite(shadow.c, 0, G - 2, ORDER.player - 0.5);

  // Rain
  if (!reduced) {
    const N2 = 160, pos = new Float32Array(N2 * 6);
    rain = { n: N2, pos, drops: [] };
    for (let i = 0; i < N2; i++) rain.drops.push({ x: Math.random() * 600, y: Math.random() * VIEW_H, s: 160 + Math.random() * 80, l: 4 + Math.random() * 5 });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    rain.mesh = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffa9e3, transparent: true, opacity: 0.35, depthTest: false }));
    rain.mesh.renderOrder = ORDER.rain; rain.mesh.frustumCulled = false; scene.add(rain.mesh);
  }
}

/* ---------------- physics ---------------- */
function step(dt) {
  const p = player;
  const dir = (input.r ? 1 : 0) - (input.l ? 1 : 0);
  if (dir) { p.vx += dir * (p.ground ? PHYS.accel : PHYS.air) * dt; p.face = dir; }
  else if (p.ground) { const f = PHYS.friction * dt; p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f; }
  p.vx = Math.max(-PHYS.max, Math.min(PHYS.max, p.vx));

  p.coyote = p.ground ? PHYS.coyote : p.coyote - dt;
  p.buffer -= dt;
  if (p.buffer > 0 && p.coyote > 0) { p.vy = PHYS.jump; p.ground = false; p.coyote = 0; p.buffer = 0; }
  if (!input.jumpHeld && p.vy > 0) p.vy -= p.vy * (1 - PHYS.cut) * Math.min(1, dt * 12);
  p.vy -= PHYS.gravity * dt;

  // horizontal move + solid boxes
  let nx = p.x + p.vx * dt;
  for (const s of SOLIDS) {
    if (p.y < s.y + s.h - 0.5 && p.y + p.h > s.y && nx + p.w / 2 > s.x && nx - p.w / 2 < s.x + s.w) {
      nx = p.vx > 0 ? s.x - p.w / 2 : s.x + s.w + p.w / 2; p.vx = 0;
    }
  }
  p.x = Math.max(8, Math.min(WORLD_W - 8, nx));

  // vertical move
  const prevY = p.y;
  let ny = p.y + p.vy * dt;
  p.ground = false;
  if (p.vy <= 0) {
    let floor = G;
    for (const pl of PLATFORMS) if (p.x + p.w / 2 > pl.x + 1 && p.x - p.w / 2 < pl.x + pl.w - 1 && prevY >= pl.y - 0.01 && ny <= pl.y) floor = Math.max(floor, pl.y);
    for (const s of SOLIDS) if (p.x + p.w / 2 > s.x && p.x - p.w / 2 < s.x + s.w && prevY >= s.y + s.h - 0.01 && ny <= s.y + s.h) floor = Math.max(floor, s.y + s.h);
    if (ny <= floor) { ny = floor; p.vy = 0; p.ground = true; }
  } else {
    for (const s of SOLIDS) if (p.x + p.w / 2 > s.x && p.x - p.w / 2 < s.x + s.w && prevY + p.h <= s.y && ny + p.h > s.y) { ny = s.y - p.h; p.vy = 0; }
  }
  p.y = ny;

  // animation
  p.anim += dt * (Math.abs(p.vx) > 5 ? 11 : 2.2);
}

function frameIndex() {
  const p = player;
  if (!p.ground) return p.vy > 20 ? 6 : 7;
  if (Math.abs(p.vx) > 5) return 2 + (Math.floor(p.anim) % 4);
  return Math.floor(p.anim) % 2;
}

/* ---------------- interactions ---------------- */
function nearChapter() { return CHAPTERS.find((c) => Math.abs(player.x - c.cp) < 26); }
function zoneChapter(x) { let cur = CHAPTERS[0]; for (const c of CHAPTERS) if (x >= c.cp - 60) cur = c; return cur; }

function checkTriggers() {
  for (const ch of CHAPTERS) {
    if (!lit.has(ch.id) && Math.abs(player.x - ch.cp) < 14) {
      lit.add(ch.id); const m = cpMeshes.get(ch.id); m.mA.visible = true; m.mI.visible = false; m.glow.visible = true;
      burst(ch.cp, G + 30, '#4558ff'); toast(`Checkpoint ${ch.n}: ${ch.title}`, `Press ${coarse ? 'B' : 'E'} to open this chapter`); persist(); updateHUD();
    }
  }
  for (const t of TOKENS) {
    if (got.has(t.slug)) continue;
    if (Math.abs(player.x - t.x) < 11 && player.y < t.y + 12 && player.y + player.h > t.y) {
      got.add(t.slug); const m = tokenMeshes.get(t.slug); m.m.visible = false; m.g.visible = false;
      burst(t.x, t.y + 6, '#3fff72', 16);
      lastPick = { slug: t.slug, until: performance.now() + 6000 };
      const p = D.projects.find((x) => x.slug === t.slug);
      toast(`Case file ${got.size}/8 unlocked: ${p.title}`, `Press ${coarse ? 'B' : 'E'} to read it`, () => openProject(t.slug));
      persist(); updateHUD();
    }
  }
  const near = nearChapter();
  const pr = $('#prompt');
  if (near && !panelOpen()) {
    pr.hidden = false; pr.innerHTML = `<b>${coarse ? 'B' : 'E'}</b> Open: ${esc(near.title)}`;
    const sx = (near.cp - camX) * scale, sy = (VIEW_H - (G + 48)) * scale;
    pr.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy)}px) translate(-50%, -100%)`;
  } else pr.hidden = true;
}

function interact() {
  if (lastPick && performance.now() < lastPick.until) { const s = lastPick.slug; lastPick = null; openProject(s); return; }
  const near = nearChapter();
  if (near) openChapter(near.id);
}

function burst(x, y, col, n = 10) {
  if (reduced) return;
  const c = A.cv(2, 2); c.x.fillStyle = col; c.x.fillRect(0, 0, 2, 2);
  for (let i = 0; i < n; i++) {
    const m = sprite(c.c, x, y, ORDER.fx);
    particles.push({ m, vx: (Math.random() - 0.5) * 120, vy: 40 + Math.random() * 90, life: 0.7 });
  }
}

/* ---------------- render loop ---------------- */
let last = performance.now(), acc = 0, t0 = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; t0 += dt;
  if (!paused) { acc += dt; while (acc > 1 / 120) { step(1 / 120); acc -= 1 / 120; } checkTriggers(); }
  // camera
  let target = player.x - IW * 0.42;
  if (camFocus) { target = camFocus.x - IW / 2; if (now > camFocus.until) camFocus = null; }
  target = Math.max(0, Math.min(WORLD_W - IW, target));
  camX += (target - camX) * (reduced ? 1 : Math.min(1, dt * (camFocus ? 3 : 6)));
  const cx = Math.round(camX);
  camera.position.x = cx;
  for (const L of layers) {
    if (L.tile) { L.m.scale.x = IW; L.m.position.x = cx + IW / 2; L.t.repeat.x = IW / L.tile; L.t.offset.x = (cx * (1 - L.f)) / L.tile; }
    else if (L.fixedX != null) L.m.position.x = cx + IW * L.fixedX;
    else L.m.position.x = cx + IW / 2;
  }
  // player sprite
  const fi = frameIndex();
  playerTex.offset.x = fi / A.FRAMES.length;
  playerMesh.scale.x = player.face;
  playerMesh.position.set(Math.round(player.x), Math.round(player.y) + 12, 0);
  player.shadow.position.x = Math.round(player.x); player.shadow.visible = player.y - G < 40 && !onPlatformAbove();
  // tokens bob
  if (!reduced) for (const [, t] of tokenMeshes) t.m.position.y = t.baseY + Math.round(Math.sin(t0 * 3 + t.baseY) * 2);
  // focus blink on a token
  if (camFocus && camFocus.slug) { const t = tokenMeshes.get(camFocus.slug); if (t) t.g.material.opacity = 0.5 + 0.5 * Math.sin(t0 * 12); }
  // neon flicker
  if (!reduced) for (const f of flickers) { f.t -= dt; if (f.t < 0) { f.m.material.opacity = f.m.material.opacity < 1 ? 1 : 0.55; f.t = f.m.material.opacity < 1 ? 0.06 + Math.random() * 0.08 : 1.5 + Math.random() * 5; } }
  // particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const q = particles[i]; q.life -= dt; q.vy -= 300 * dt;
    q.m.position.x += q.vx * dt; q.m.position.y += q.vy * dt; q.m.material.opacity = Math.max(0, q.life / 0.7);
    if (q.life <= 0) { scene.remove(q.m); q.m.geometry.dispose(); q.m.material.dispose(); particles.splice(i, 1); }
  }
  // rain
  if (rain) {
    const P = rain.pos;
    rain.drops.forEach((d, i) => {
      d.y -= d.s * dt; d.x -= d.s * 0.18 * dt;
      if (d.y < G - 6) { d.y = VIEW_H + Math.random() * 30; d.x = Math.random() * (IW + 60); }
      if (d.x < -10) d.x += IW + 40;
      const X = cx + d.x;
      P.set([X, d.y, 0, X + d.l * 0.18, d.y + d.l, 0], i * 6);
    });
    rain.mesh.geometry.attributes.position.needsUpdate = true;
  }
  renderer.render(scene, camera);
  if (!paused) updateMap();
  requestAnimationFrame(loop);
}
function onPlatformAbove() { return player.y > G + 2; }

/* ---------------- layout ---------------- */
function resize() {
  const stage = $('#stage');
  const w = stage.clientWidth, h = stage.clientHeight;
  scale = h / VIEW_H;
  IW = Math.ceil(w / scale);
  renderer.setSize(IW, VIEW_H, false);
  camera.left = 0; camera.right = IW; camera.top = VIEW_H; camera.bottom = 0; camera.updateProjectionMatrix();
}

/* ---------------- DOM: HUD, panels, toasts ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function updateHUD() {
  $$('[data-files]').forEach((el) => { el.textContent = `${got.size}/8`; });
  $$('[data-folders]').forEach((el) => { el.innerHTML = TOKENS.map((t) => `<i class="${got.has(t.slug) ? 'on' : ''}" title="${esc(t.short)}"></i>`).join(''); });
  $$('.map-node').forEach((b) => { b.classList.toggle('lit', lit.has(b.dataset.ch)); });
}
function updateMap() {
  // nodes are evenly spaced, so place the marker piecewise between checkpoints
  const xs = [0, ...CHAPTERS.map((c) => c.cp), WORLD_W];
  const ps = [0, ...CHAPTERS.map((_, i) => i / (CHAPTERS.length - 1)), 1];
  let pct = 1;
  for (let i = 0; i < xs.length - 1; i++) if (player.x <= xs[i + 1]) { const f = (player.x - xs[i]) / (xs[i + 1] - xs[i]); pct = i === 0 ? 0 : i === xs.length - 2 ? 1 : ps[i] + f * (ps[i + 1] - ps[i]); break; }
  $$('.map-you').forEach((el) => { el.style.left = (pct * 100).toFixed(2) + '%'; });
  const z = zoneChapter(player.x);
  if (z.id !== curZone) {
    curZone = z.id;
    $$('.map-node').forEach((b) => b.classList.toggle('here', b.dataset.ch === z.id));
    const pt = $('#pad-title'); if (pt) { pt.textContent = z.title; $('#pad-n').textContent = z.n; $('#pad-sub').textContent = `Checkpoint ${z.n} of 9${z.year ? ' · ' + z.year : ''} · tap to open`; }
  }
}
function buildMap() {
  const html = `<div class="map-track"><span class="map-you" aria-hidden="true"></span>${CHAPTERS.map((c) => `<button class="map-node" data-ch="${c.id}" style="left:${((c.n - 1) / (CHAPTERS.length - 1) * 100).toFixed(2)}%" aria-label="Go to chapter ${c.n}: ${esc(c.title)}"><span>${c.n}</span><em>${esc(c.short)}</em></button>`).join('')}</div>`;
  $$('.map').forEach((m) => { m.innerHTML = html; });
  $$('.map-node').forEach((b) => b.addEventListener('click', () => travel(b.dataset.ch, true)));
}

function travel(id, open) {
  const ch = CHAPTERS.find((c) => c.id === id);
  player.x = ch.cp - 18; player.y = G; player.vx = 0; player.vy = 0; player.face = 1;
  camX = Math.max(0, Math.min(WORLD_W - IW, player.x - IW * 0.42));
  if (!lit.has(id)) checkTriggers();
  persist();
  if (open) openChapter(id);
}

let toastTimer;
function toast(title, sub, action) {
  const el = $('#toast');
  el.innerHTML = `<b>${esc(title)}</b><span>${esc(sub)}</span>${action ? '<button class="pbtn" type="button">Read it now</button>' : ''}`;
  el.classList.add('show');
  if (action) $('button', el).onclick = action;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 5200);
}

/* ---------- panels ---------- */
let returnFocus = null, panelStack = [];
function panelOpen() { return !$('#panel').hidden; }
function openPanel(title, kicker, html, { back = null, wide = false } = {}) {
  const p = $('#panel');
  if (!panelOpen()) returnFocus = document.activeElement;
  $('#panel-title').textContent = title;
  $('#panel-kicker').textContent = kicker;
  $('#panel-body').innerHTML = html;
  $('#panel-body').scrollTop = 0; requestAnimationFrame(() => { $('#panel-body').scrollTop = 0; });
  $('#panel-back').hidden = !back;
  $('#panel-back').onclick = back;
  p.classList.toggle('wide', wide);
  p.hidden = false; document.body.classList.add('panel-on');
  input.l = input.r = false;
  wirePanel();
  $('#panel-close').focus({ preventScroll: true });
}
function closePanel() {
  $('#panel').hidden = true; document.body.classList.remove('panel-on');
  if (returnFocus && returnFocus.focus) returnFocus.focus({ preventScroll: true }); else $('#c').focus({ preventScroll: true });
}
function wirePanel() {
  $$('#panel-body [data-project]').forEach((b) => b.addEventListener('click', () => openProject(b.dataset.project, b.dataset.from)));
  $$('#panel-body [data-where]').forEach((b) => b.addEventListener('click', () => showWhere(b.dataset.where)));
  $$('#panel-body [data-go]').forEach((b) => b.addEventListener('click', () => { closePanel(); travel(b.dataset.go, true); }));
}
function showWhere(slug) {
  const t = TOKENS.find((x) => x.slug === slug);
  closePanel();
  const ch = CHAPTERS.find((c) => c.id === t.ch);
  if (Math.abs(player.x - t.x) > 400) { player.x = ch.cp - 18; player.y = G; player.vx = 0; }
  camFocus = { x: t.x, until: performance.now() + 2200, slug };
  toast(`The ${t.short} case file is up there`, 'Jump onto the ledges to reach the gold folder');
}

const P = (x) => `<p>${esc(x)}</p>`;
const photo = (src, cls = '') => `<figure class="ph ${cls}"><img src="${media(src)}" alt="${esc(PHOTO_ALT(D, src))}" loading="lazy"><figcaption>${esc(PHOTO_ALT(D, src))}</figcaption></figure>`;
const quote = (i) => { const q = D.testimonials[i]; return `<blockquote class="quote"><p>“${esc(q.quote)}”</p><cite>${esc(q.name)}, ${esc(q.role)}. ${esc(q.relation)}</cite></blockquote>`; };
const role = (e) => `<article class="role"><img src="${media(e.logo)}" alt="${esc(e.org)} logo" class="logo"><div><h3>${esc(e.role)}</h3><p class="kicker">${esc(e.org)} · ${esc(e.place)} · ${esc(e.dates)}</p><ul>${e.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></article>`;
function card(slug, from) {
  const p = D.projects.find((x) => x.slug === slug);
  const open = got.has(slug);
  return `<article class="pcard ${open ? '' : 'locked'}">
    <div class="thumb"><img src="${media(p.thumbnail)}" alt="${esc(p.title)}: cover" loading="lazy">${open ? '' : '<span class="lock" aria-hidden="true"></span>'}</div>
    <div class="pc-body">
      <p class="kicker">${esc(p.type)} · ${esc(p.org)} · ${esc(p.year)}</p>
      <h3>${esc(p.title)}</h3>
      <p class="res"><b>${esc(p.result)}</b></p>
      ${open ? `<button class="pbtn" type="button" data-project="${slug}" data-from="${from}">Read the case file</button>`
      : `<p class="lockline">Case file locked. Collect the gold folder in this chapter to open it.</p><div class="row"><button class="pbtn" type="button" data-where="${slug}">Show me where</button><a class="pbtn ghost" href="project.html?p=${slug}">Skip, read it</a></div>`}
    </div></article>`;
}
const journey = (years) => `<ol class="timeline">${D.journey.filter((j) => years.includes(j.year)).map((j) => `<li><b>${esc(j.year)}</b><span>${esc(j.title)}</span><em>${esc(j.detail)}</em></li>`).join('')}</ol>`;

function chapterHTML(id) {
  const d = D;
  switch (id) {
    case 'meet': {
      const fc = forCompanyLine(d);
      return `<div class="split"><img class="headshot" src="${media(d.media.headshot)}" alt="Lakshmi Naidu, headshot" width="600" height="600">
        <div><p class="lede">${esc(d.person.headline)}.</p>${P(d.pitch.short)}
        ${fc ? `<p class="forco">${esc(fc)}</p>` : ''}
        <dl class="facts"><div><dt>Now</dt><dd>${esc(d.person.current)}</dd></div><div><dt>Looking for</dt><dd>${esc(d.person.looking_for)}</dd></div><div><dt>Based in</dt><dd>${esc(d.person.location)}</dd></div><div><dt>Available from</dt><dd>${esc(d.person.available_from)}</dd></div></dl></div></div>
        <h3 class="sec">Why hire me</h3><ol class="why">${d.pitch.why_hire.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
        <div class="row"><button class="pbtn" type="button" data-go="contact">Skip to contact</button><a class="pbtn ghost" href="resume.html">Read it all</a></div>`;
    }
    case 'study':
      return `${P(d.about.intro.split('. ').slice(0, 1).join('. ') + '.')}
        <div class="edu">${d.education.slice(1).concat(d.education.slice(0, 1)).map((e) => `<article class="role"><img class="logo" src="${media(e.logo)}" alt="${esc(e.school)} logo"><div><h3>${esc(e.degree)}</h3><p class="kicker">${esc(e.school)} · ${esc(e.years)}</p><p>${esc(e.notes)}</p></div></article>`).join('')}</div>
        ${journey(['2019'])}
        ${photo('photos/hobby-kuchipudi.jpg', 'small')}
        <p class="note">Folk dance with the Larchmont Falls Bellringers since 2018. More about life outside work at checkpoint 7.</p>`;
    case 'ta':
      return `${role(d.experience[2])}${journey(['2020', '2021'])}${quote(1)}<h3 class="sec">Case file</h3>${card('autumn-rush-hiring', id)}`;
    case 'hrbp':
      return `${role(d.experience[1])}${journey(['2022'])}${quote(0)}<h3 class="sec">Case files</h3>${card('new-hire-orientation', id)}${card('job-grades-pay-bands', id)}
        <div class="win">${photo('photos/achievement-award.jpg')}<div><h3>${esc(d.wins[1].title)}</h3>${P(d.wins[1].detail)}</div></div>`;
    case 'mu':
      return `<article class="role"><img class="logo" src="${media(d.education[0].logo)}" alt="Harrowgate School of Management logo"><div><h3>${esc(d.education[0].degree)}</h3><p class="kicker">${esc(d.education[0].school)} · ${esc(d.education[0].years)}</p><p>${esc(d.education[0].notes)}</p></div></article>
        ${journey(['2025'])}<h3 class="sec">Case files</h3>${card('staff-survey-readout', id)}${card('case-challenge', id)}${card('plain-english-handbook', id)}`;
    case 'depot':
      return `${role(d.experience[0])}${journey(['2026'])}${quote(2)}<h3 class="sec">Case file</h3>${card('depot-first-month', id)}`;
    case 'outside':
      return `${P(d.about.now)}<h3 class="sec">Case file</h3>${card('third-drawer', id)}
        <h3 class="sec">Outside work</h3><div class="outs">${d.outside.filter((o) => o.title !== 'Mock interviews').map((o) => `<article>${`<img src="${media(o.image)}" alt="${esc(PHOTO_ALT(d, o.image))}" loading="lazy">`}<h4>${esc(o.title)}</h4>${P(o.detail)}</article>`).join('')}</div>
        ${(() => { const m = d.outside.find((o) => o.title === 'Mock interviews'); return m ? `<div class="plain"><h4>${esc(m.title)}</h4>${P(m.detail)}</div>` : ''; })()}`;
    case 'wins':
      return `<h3 class="sec">Wins</h3><div class="wins">${d.wins.map((w, i) => `<article><span class="medal">${i + 1}</span><div><h4>${esc(w.title)}</h4>${P(w.detail)}</div></article>`).join('')}</div>
        <h3 class="sec">Skills</h3><div class="skills">${Object.entries(d.skills).map(([k, v]) => `<div><h4>${esc(k)}</h4><ul>${v.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}</div>
        <h3 class="sec">Tools</h3><div class="tools">${d.tools.map((t) => `<span><img src="${media(t.logo)}" alt="" width="16" height="16">${esc(t.name)}</span>`).join('')}</div>
        <h3 class="sec">Certifications</h3><ul class="certs">${d.certifications.map((c) => `<li><b>${esc(c.name)}</b> ${esc(c.issuer)}, ${esc(c.year)}</li>`).join('')}</ul>
        <h3 class="sec">How I work</h3><ol class="why">${d.values.map((v) => `<li>${esc(v)}</li>`).join('')}</ol>
        <h3 class="sec">References</h3>${d.testimonials.map((_, i) => quote(i)).join('')}`;
    case 'contact': {
      const c = d.contact, fc = forCompanyLine(d);
      return `<div class="split"><img class="headshot tall" src="${media(d.media.professional)}" alt="Lakshmi Naidu, half-body portrait" loading="lazy">
        <div>${fc ? `<p class="forco">${esc(fc)}</p>` : ''}<p class="lede">I am looking for ${esc(d.person.looking_for.charAt(0).toLowerCase() + d.person.looking_for.slice(1))}, from ${esc(d.person.available_from)}.</p>
        <ul class="contact">
          <li><span>Email</span><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li>
          <li><span>Phone</span><a href="tel:${esc(c.phone.replace(/\s/g, ''))}">${esc(c.phone)}</a></li>
          <li><span>LinkedIn</span><a href="${esc(c.linkedin)}" rel="noopener">linkedin.com/in/example</a></li>
          <li><span>Book a call</span><a href="${esc(c.calendly)}" rel="noopener">calendly.com/example</a></li>
          <li><span>Newsletter</span><a href="${esc(c.newsletter)}" rel="noopener">The Third Drawer on LinkedIn</a></li>
        </ul>
        <div class="row"><a class="pbtn" href="mailto:${esc(c.email)}">Email Lakshmi</a><a class="pbtn ghost" href="resume.html">Full resume</a></div></div></div>
        <h3 class="sec">Case files you collected: ${got.size} of 8</h3>
        <ul class="collected">${TOKENS.map((t) => { const p = D.projects.find((x) => x.slug === t.slug); return `<li class="${got.has(t.slug) ? 'on' : ''}">${got.has(t.slug) ? `<button type="button" data-project="${t.slug}" data-from="contact">${esc(p.title)}</button>` : `<a href="project.html?p=${t.slug}">${esc(p.title)}</a><em>not collected</em>`}</li>`; }).join('')}</ul>`;
    }
  }
  return '';
}

function openChapter(id) {
  const ch = CHAPTERS.find((c) => c.id === id);
  openPanel(ch.title, `Checkpoint ${ch.n} of 9${ch.year ? ' · ' + ch.year : ''}`, chapterHTML(id));
}
function openProject(slug, from) {
  if (!got.has(slug)) { got.add(slug); const m = tokenMeshes.get(slug); if (m) { m.m.visible = false; m.g.visible = false; } persist(); updateHUD(); }
  const p = D.projects.find((x) => x.slug === slug);
  const back = from ? () => openChapter(from) : null;
  openPanel(p.title, `Case file · ${p.type} · ${p.org}`, `${projectBodyHTML(D, slug)}<div class="row end"><a class="pbtn ghost" href="project.html?p=${slug}">Open as a page</a></div>`, { back });
}

function openMenu() {
  const html = `<ol class="menu-list">${CHAPTERS.map((c) => `<li><button type="button" data-go="${c.id}" class="${lit.has(c.id) ? 'lit' : ''}"><span class="n">${c.n}</span><span class="t">${esc(c.title)}</span><span class="y">${esc(c.year)}</span></button></li>`).join('')}</ol>
    <h3 class="sec">Case files ${got.size}/8</h3>
    <ul class="collected">${TOKENS.map((t) => { const p = D.projects.find((x) => x.slug === t.slug); return `<li class="${got.has(t.slug) ? 'on' : ''}">${got.has(t.slug) ? `<button type="button" data-project="${t.slug}">${esc(p.title)}</button>` : `<button type="button" data-where="${t.slug}">${esc(p.title)}</button><em>locked: show me where</em>`}</li>`; }).join('')}</ul>
    <div class="row"><a class="pbtn" href="resume.html">Read it all</a><button class="pbtn ghost" type="button" id="m-help">Controls</button><button class="pbtn ghost" type="button" id="m-reset">Reset progress</button></div>`;
  openPanel('Menu', 'Jump to any chapter', html);
  $('#m-help').onclick = () => { closePanel(); showIntro(); };
  $('#m-reset').onclick = () => { got.clear(); lit.clear(); persist(); location.reload(); };
}

/* ---------- intro / controls sheet ---------- */
function showIntro(rm = false) {
  const el = $('#intro'); el.hidden = false; paused = true;
  el.classList.toggle('rm', rm);
  // reduced motion: reading the resume is the primary action
  const play = $('#intro-play'), read = $('#intro-read');
  play.classList.toggle('ghost', rm); read.classList.toggle('ghost', !rm);
  (rm ? read : play).focus({ preventScroll: true });
  animDemo();
}
function hideIntro() { $('#intro').hidden = true; paused = false; $('#c').focus({ preventScroll: true }); try { localStorage.setItem(SAVE_KEY + '-intro', '1'); } catch { /* */ } }
function animDemo() {
  const sheet = A.playerSheet();
  $$('.demo').forEach((cnv) => {
    const x = cnv.getContext('2d'); x.imageSmoothingEnabled = false;
    const kind = cnv.dataset.demo; let f = 0;
    const draw = () => {
      if ($('#intro').hidden) return;
      x.clearRect(0, 0, cnv.width, cnv.height);
      x.fillStyle = '#6b1d37'; x.fillRect(0, 0, cnv.width, cnv.height); x.fillStyle = '#6b2f41'; x.fillRect(0, 30, cnv.width, 10);
      const fr = kind === 'run' ? 2 + (f % 4) : kind === 'jump' ? (f % 8 < 4 ? 6 : 7) : f % 2;
      const yo = kind === 'jump' ? [0, -6, -10, -11, -10, -6, -2, 0][f % 8] : 0;
      x.drawImage(sheet, fr * 16, 0, 16, 24, kind === 'run' ? 8 + (f * 3) % 40 : 22, 6 + yo, 16, 24);
      if (kind === 'open') { x.drawImage(A.terminal(f % 6 > 2, 4), 40, 8); x.drawImage(sheet, 0, 0, 16, 24, 22, 6, 16, 24); }
      f++; if (!reduced) setTimeout(() => requestAnimationFrame(draw), 120);
    };
    draw();
  });
}

/* ---------------- input ---------------- */
function bindInput() {
  const keys = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
  addEventListener('keydown', (e) => {
    if (!$('#intro').hidden) { if (e.code === 'Escape') hideIntro(); return; }
    if (panelOpen()) { if (e.code === 'Escape') closePanel(); return; }
    if (e.target.closest && e.target.closest('a,button') && (e.code === 'Space' || e.code === 'Enter')) return;
    if (keys[e.code]) { input[keys[e.code]] = true; e.preventDefault(); }
    if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) { if (!e.repeat) { player.buffer = PHYS.buffer; } input.jumpHeld = true; e.preventDefault(); }
    if (e.code === 'KeyE' || e.code === 'Enter') { interact(); e.preventDefault(); }
    if (e.code === 'KeyM') openMenu();
  });
  addEventListener('keyup', (e) => {
    if (keys[e.code]) input[keys[e.code]] = false;
    if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) input.jumpHeld = false;
  });
  addEventListener('blur', () => { input.l = input.r = input.jumpHeld = false; });

  // touch pad buttons (hold to move)
  const hold = (el, on, off) => {
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture?.(e.pointerId); el.classList.add('down'); on(); });
    const up = () => { el.classList.remove('down'); off(); };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => el.addEventListener(t, up));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  };
  $$('[data-pad="l"]').forEach((b) => hold(b, () => { input.l = true; }, () => { input.l = false; }));
  $$('[data-pad="r"]').forEach((b) => hold(b, () => { input.r = true; }, () => { input.r = false; }));
  $$('[data-pad="jump"]').forEach((b) => hold(b, () => { player.buffer = PHYS.buffer; input.jumpHeld = true; }, () => { input.jumpHeld = false; }));
  $$('[data-pad="open"]').forEach((b) => b.addEventListener('click', () => interact()));

  // click / tap a checkpoint terminal in the scene
  $('#c').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const wx = camX + ((e.clientX - r.left) / r.width) * IW, wy = VIEW_H - ((e.clientY - r.top) / r.height) * VIEW_H;
    const ch = CHAPTERS.find((c) => Math.abs(wx - c.cp) < 14 && wy > G - 4 && wy < G + 40);
    if (ch) openChapter(ch.id);
  });

  $('#panel-close').addEventListener('click', closePanel);
  $('#panel').addEventListener('click', (e) => { if (e.target.id === 'panel') closePanel(); });
  $$('[data-menu]').forEach((b) => b.addEventListener('click', openMenu));
  $('#pad-ch').addEventListener('click', () => openChapter(zoneChapter(player.x).id));
  $$('[data-help]').forEach((b) => b.addEventListener('click', () => showIntro()));
  $('#intro-play').addEventListener('click', hideIntro);
  // simple focus trap in the panel
  $('#panel').addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = $$('#panel button:not([hidden]), #panel a[href]').filter((x) => x.offsetParent);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { f[f.length - 1].focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { f[0].focus(); e.preventDefault(); }
  });
}

/* ---------------- boot ---------------- */
async function boot() {
  const bar = $('#loader-fill'), pct = $('#loader-pct');
  const prog = (v) => { bar.style.transform = `scaleX(${v})`; pct.textContent = Math.round(v * 100); };
  prog(0.1);
  const [data] = await Promise.all([loadContent(), document.fonts.load('8px Silkscreen'), document.fonts.load('700 16px Silkscreen')]);
  D = data; prog(0.45);
  const img = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = media(D.media.headshot); });
  prog(0.7);
  renderer = new THREE.WebGLRenderer({ canvas: $('#c'), antialias: false, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(1);
  renderer.debug.checkShaderErrors = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene(); scene.background = new THREE.Color('#401220');
  camera = new THREE.OrthographicCamera(0, 400, VIEW_H, 0, -100, 100); camera.position.z = 10;
  buildWorld(img);
  resize(); addEventListener('resize', resize);
  buildMap(); updateHUD(); bindInput(); updateMap();
  camX = Math.max(0, player.x - IW * 0.42);
  prog(1);
  setTimeout(() => $('#loader').classList.add('done'), 250);
  requestAnimationFrame(loop);
  let seen = false; try { seen = !!localStorage.getItem(SAVE_KEY + '-intro'); } catch { /* */ }
  if (reduced) showIntro(true);
  else if (!seen) showIntro();
  else { paused = false; if (save.x > 100) toast('Welcome back', `${got.size} of 8 case files collected. Press M for the chapter menu.`); }
  document.documentElement.classList.add('ready');
}

boot().catch((e) => {
  console.warn(e);
  $('#loader').classList.add('done');
  $('#fallback').hidden = false;
});
