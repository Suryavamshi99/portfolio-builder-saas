/* Island layout shared by the 3D world, the minimap, the full map and the project pages.
   Units are metres in world space: X to the right, Z towards the viewer, the start at (0, 10). */

export const START = { x: 0, z: 10, heading: Math.PI };
export const POND = { x: -38, z: 14, r: 7 };
export const LANE = { x0: 34, x1: 58, z: 9, w: 3.2 };

export function islandR(a) {
  return 70 + 3 * Math.sin(3 * a + 1) + 2 * Math.sin(5 * a + 2) + 1.5 * Math.cos(7 * a);
}
export function islandOutline(n = 160) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const r = islandR(a); pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  return pts; // [x, z]
}
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* Short labels for the stops (UI labels only, never new claims). */
const PROJECT_LABEL = {
  'ai-portfolio-agent': 'Print Club Ledger', 'market-khata': 'Cartridge Club', 'cloud-kitchen-pnl': 'Route P&L',
  'monday-review': 'The Short Meeting', 'threadly-operating-cadence': 'Alderwick weekly review', 'activation-tracker': 'Quote Tracker', 'thistledown-launch': 'Marlow Cross launch',
  'city-launch-playbook': 'Town launch playbook', 'second-sem': 'Quillfold',
};
export const shortOrg = (s) => String(s || '').split(' (')[0];
export const projectLabel = (p) => PROJECT_LABEL[p.slug] || String(p.title).split(':')[0];

/* Where things stand. Each stop has a pad (x, z); its sign or building stands just north of it. */
const EXP_PADS = [[-46, -25], [-33, -37], [-18, -45]];
const BOARD_SPOTS = [[2, -50], [14, -50], [26, -50], [34, -37], [22, -37], [10, -37], [18, -24], [30, -24], [42, -24]];

export function buildStops(c) {
  const S = [];
  S.push({ id: 'about', node: 'stop-about', label: 'About me', group: 'About', x: 0, z: -2, sign: 'ABOUT ME' });
  S.push({ id: 'journey', node: 'stop-journey', label: 'Journey', group: 'Journey and education', x: -26, z: -3, sign: 'JOURNEY' });
  (c.experience || []).slice(0, 3).forEach((e, i) => {
    const [x, z] = EXP_PADS[i];
    S.push({ id: 'exp-' + i, node: 'exp-' + i, label: shortOrg(e.org), group: 'Experience', x, z, kiosk: { x, z: z - 6.5 }, logo: e.logo, org: shortOrg(e.org) });
  });
  (c.projects || []).slice(0, 9).forEach((p, i) => {
    const [x, z] = BOARD_SPOTS[i];
    S.push({ id: 'p-' + p.slug, node: 'proj-' + p.slug, slug: p.slug, label: projectLabel(p), group: `Project ${i + 1} of ${Math.min(9, c.projects.length)}`, x, z: z + 5, board: { x, z }, thumb: `media/projects/${p.slug}/sign.jpg` });
  });
  S.push({ id: 'wins', node: 'stop-wins', label: 'Wins', group: 'Wins', x: 50, z: -3, sign: 'WINS' });
  S.push({ id: 'tools', node: 'stop-tools', label: 'Toolbox', group: 'Skills and tools', x: 40, z: 27, sign: 'TOOLBOX' });
  S.push({ id: 'ai', node: null, label: 'Front desk', group: 'Front desk', x: 16, z: 38, agent: true });
  S.push({ id: 'contact', node: 'stop-contact', label: 'Contact', group: 'Contact', x: -16, z: 37, sign: 'CONTACT' });
  S.forEach((s, i) => { s.n = i + 1; });
  return S;
}

/* Structures to keep grass and trees away from: [x, z, r]. */
export function structures(stops) {
  const out = [];
  for (let x = -14; x <= 14; x += 3.5) out.push([x, -15, 3]);   // name letters
  out.push([0, -8, 3]);                                           // about sign
  [[-38, -11], [-33, -13], [-28, -14], [-23, -13], [-18, -11]].forEach(([x, z]) => out.push([x, z, 2.5])); // year stones
  stops.forEach((s) => {
    out.push([s.x, s.z, 3.4]);
    if (s.kiosk) out.push([s.kiosk.x, s.kiosk.z, 4]);
    if (s.board) out.push([s.board.x, s.board.z, 4.5]);
  });
  out.push([50, -10, 4.5]);  // podium
  out.push([42, 20, 4.5]);   // crates
  out.push([16, 32, 4.5]);   // front desk booth
  out.push([-16, 31, 3]);    // mailbox
  for (let x = LANE.x0; x <= LANE.x1; x += 3) out.push([x, LANE.z, 3]);
  out.push([POND.x, POND.z, POND.r + 2]);
  out.push([START.x, START.z, 6]);
  return out;
}

export function roadPoints(stops) {
  const pts = [[START.x, START.z]];
  stops.forEach((s) => pts.push([s.x, s.z]));
  pts.push([START.x, START.z]);
  return pts;
}
function distSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az; const l = dx * dx + dz * dz || 1;
  let t = ((px - ax) * dx + (pz - az) * dz) / l; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
export function distRoad(road, x, z) {
  let d = Infinity;
  for (let i = 0; i < road.length - 1; i++) d = Math.min(d, distSeg(x, z, road[i][0], road[i][1], road[i + 1][0], road[i + 1][1]));
  return d;
}

/* Deterministic layout of grass patches, trees, bushes and rocks. */
export function layout(stops) {
  const R = rng(20261112);
  const road = roadPoints(stops);
  const keep = structures(stops);
  const inside = (x, z, m) => Math.hypot(x, z) < islandR(Math.atan2(z, x)) - m;
  const clearOf = (x, z, r) => keep.every(([sx, sz, sr]) => Math.hypot(x - sx, z - sz) > sr + r);
  const patches = [];
  for (let i = 0; i < 900 && patches.length < 52; i++) {
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * 66, x = Math.cos(a) * d, z = Math.sin(a) * d, r = 2.4 + R() * 4.2;
    if (!inside(x, z, r + 2)) continue;
    if (distRoad(road, x, z) < r + 2.8) continue;
    if (!clearOf(x, z, r)) continue;
    if (patches.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + r - 1.2)) continue;
    patches.push({ x, z, r, sx: 0.8 + R() * 0.45, rot: R() * Math.PI });
  }
  const trees = [];
  for (let i = 0; i < 1400 && trees.length < 46; i++) {
    const a = R() * Math.PI * 2, d = 12 + Math.sqrt(R()) * 58, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!inside(x, z, 3)) continue;
    if (distRoad(road, x, z) < 4.6) continue;
    if (!clearOf(x, z, 2.6)) continue;
    if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 4.6)) continue;
    trees.push({ x, z, s: 0.85 + R() * 0.55, hue: Math.floor(R() * 5), seed: Math.floor(R() * 1e6) });
  }
  const rocks = [];
  for (let i = 0; i < 900 && rocks.length < 30; i++) {
    const a = R() * Math.PI * 2, d = 50 + R() * 18, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!inside(x, z, 1.2)) continue;
    if (distRoad(road, x, z) < 3.4 || !clearOf(x, z, 1.6)) continue;
    if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 3)) continue;
    if (rocks.some((t) => Math.hypot(t.x - x, t.z - z) < 2.6)) continue;
    rocks.push({ x, z, s: 0.7 + R() * 1.1, rot: R() * Math.PI, box: R() < 0.55 });
  }
  const lanterns = [];
  for (let i = 0; i < road.length - 1; i++) {
    const [ax, az] = road[i], [bx, bz] = road[i + 1]; const len = Math.hypot(bx - ax, bz - az);
    if (len < 9) continue;
    const t = 0.5, nx = -(bz - az) / len, nz = (bx - ax) / len, side = i % 2 ? 1 : -1;
    const x = ax + (bx - ax) * t + nx * 3.4 * side, z = az + (bz - az) * t + nz * 3.4 * side;
    if (clearOf(x, z, 0.5) && inside(x, z, 2)) lanterns.push({ x, z });
  }
  return { road, patches, trees, rocks, lanterns, keep };
}

/* 2D map painter shared by the minimap, the full map and project pages. */
const MAPC = { water: '#2d8f2a', shore: '#8cd17f', sand: '#ef4faf', road: '#f77cc1', grass: '#a12835', pond: '#42a83a' };
export function paintMapBase(ctx, size, stops, lay, opt = {}) {
  const span = opt.span || 160, k = size / span, cx = size / 2, cz = size / 2;
  const P = (x, z) => [cx + x * k, cz + z * k];
  ctx.fillStyle = MAPC.water; ctx.fillRect(0, 0, size, size);
  const o = islandOutline(120);
  ctx.beginPath(); o.forEach(([x, z], i) => { const [px, pz] = P(x, z); i ? ctx.lineTo(px, pz) : ctx.moveTo(px, pz); }); ctx.closePath();
  ctx.lineWidth = 3 * k; ctx.strokeStyle = MAPC.shore; ctx.stroke(); ctx.fillStyle = MAPC.sand; ctx.fill();
  ctx.fillStyle = MAPC.grass; lay.patches.forEach((p) => { const [px, pz] = P(p.x, p.z); ctx.beginPath(); ctx.ellipse(px, pz, p.r * k, p.r * k * p.sx, p.rot, 0, Math.PI * 2); ctx.fill(); });
  ctx.fillStyle = MAPC.pond; { const [px, pz] = P(POND.x, POND.z); ctx.beginPath(); ctx.arc(px, pz, POND.r * k, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = MAPC.road; ctx.lineWidth = 3.2 * k; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); lay.road.forEach(([x, z], i) => { const [px, pz] = P(x, z); i ? ctx.lineTo(px, pz) : ctx.moveTo(px, pz); }); ctx.stroke();
  ctx.fillStyle = '#6d7cd7'; lay.trees.forEach((t) => { const [px, pz] = P(t.x, t.z); ctx.beginPath(); ctx.arc(px, pz, 1.6 * k * t.s, 0, Math.PI * 2); ctx.fill(); });
  return P;
}
export function paintMapStops(ctx, size, stops, opt = {}) {
  const span = opt.span || 160, k = size / span, c = size / 2;
  const d = Math.max(5, Math.min(opt.numbers ? 30 : 11, (opt.numbers ? 5 : 2.6) * k));
  stops.forEach((s) => {
    const x = c + s.x * k, z = c + s.z * k;
    const hi = opt.highlight === s.id, nx = opt.next === s.id, vis = opt.visited && opt.visited.has(s.id);
    ctx.save(); ctx.translate(x, z); ctx.rotate(Math.PI / 4);
    const dd = hi ? d * 1.45 : d;
    ctx.fillStyle = vis || hi ? '#ffbf95' : '#1d1721'; ctx.strokeStyle = nx ? '#ffbf95' : '#ffffff'; ctx.lineWidth = Math.max(1.5, dd * 0.22);
    ctx.fillRect(-dd / 2, -dd / 2, dd, dd); ctx.strokeRect(-dd / 2, -dd / 2, dd, dd);
    ctx.restore();
    if (opt.numbers && size > 300) { ctx.fillStyle = vis || hi ? '#1d1721' : '#ffffff'; ctx.font = `800 ${Math.round(d * (s.n > 9 ? 0.5 : 0.62))}px Nunito, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(s.n), x, z + 0.5); }
  });
}
export function paintCar(ctx, size, car, opt = {}) {
  const span = opt.span || 160, k = size / span, c = size / 2;
  ctx.save(); ctx.translate(c + car.x * k, c + car.z * k); ctx.rotate(-car.heading + Math.PI);
  const s = Math.max(7, 3.4 * k);
  ctx.fillStyle = '#e83ee5'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, s * 0.8); ctx.lineTo(0, s * 0.4); ctx.lineTo(-s * 0.7, s * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
