/* The island: ground, water, grass, trees, props and one physical sign per stop. Everything is drawn from primitives. */
import * as THREE from '../vendor/three.module.min.js';
import { islandOutline, islandR, POND, LANE, START, layout } from './island.js';

export const PALETTE = {
  sand: '#f04eaf', sandSide: '#d740a3', road: '#f774be', grassPaint: '#a72c3e',
  grass: ['#c73a4f', '#a92a39', '#dc4e69', '#8f262b', '#e26378'],
  crowns: [['#eb8fff', '#df6fff'], ['#9b56e0', '#b27af0'], ['#5b89d1', '#8aa7e6'], ['#ff6ee3', '#ff8ad9'], ['#ff6b9a', '#f54e9a']],
  trunk: '#7a3a6a', lavender: '#ddf5ff', lavenderDark: '#b8e1f2', plum: '#2a2230', plumLight: '#3b2f45', wood: '#c94d8c', woodDark: '#9b3870',
  water: '#349c2f', waterDeep: '#227a25', lime: '#ffbf95', pink: '#ffcafb', gold: '#ff4d83', red: '#e83ee5', white: '#f7fbff',
};

const lambert = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d'); draw(ctx, w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.userData.ctx = ctx; t.userData.cv = cv;
  return t;
}
function loadImg(src) { return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }
const FD = '"Amatic SC", "Arial Narrow", sans-serif', FB = 'Nunito, sans-serif';

export function createWorld({ canvas, stops, quality = 1, reduced = false }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality > 0.6, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality > 0.6 ? 1.6 : 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.water);
  scene.fog = new THREE.Fog(PALETTE.waterDeep, 95, 190);
  const camera = new THREE.PerspectiveCamera(36, 1, 1, 400);

  // lights
  const hemi = new THREE.HemisphereLight('#ffd2ef', '#463f7a', 1.55); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffdceb', 2.1);
  sun.castShadow = true; sun.shadow.mapSize.set(quality > 0.6 ? 2048 : 1024, quality > 0.6 ? 2048 : 1024);
  Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 1, far: 140 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04; sun.shadow.radius = 4;
  scene.add(sun, sun.target);

  const lay = layout(stops);
  const colliders = [];
  const clickables = [];
  const tickers = [];
  const addCol = (x, z, r) => colliders.push({ x, z, r });
  const shadowy = (o, cast = true) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = cast; m.receiveShadow = true; } }); return o; };

  /* ---------- ground (painted canvas + tile grid in the shader) ---------- */
  const SPAN = 160, PX = 2048, k = PX / SPAN, C = PX / 2;
  const paint = canvasTex(PX, PX, (g) => {
    g.fillStyle = PALETTE.sand; g.fillRect(0, 0, PX, PX);
    const R = Math.random; // speckles only, not layout
    for (let i = 0; i < 9000; i++) { g.fillStyle = R() < 0.5 ? 'rgba(255,140,205,.10)' : 'rgba(180,40,140,.08)'; g.fillRect(R() * PX, R() * PX, 2 + R() * 4, 2 + R() * 4); }
    // wet sand near the shore
    const o = islandOutline(160);
    g.save(); g.beginPath(); o.forEach(([x, z], i) => { const px = C + x * k, pz = C + z * k; i ? g.lineTo(px, pz) : g.moveTo(px, pz); }); g.closePath();
    g.lineWidth = 7 * k; g.strokeStyle = 'rgba(214,60,164,.55)'; g.stroke(); g.restore();
    // road
    g.strokeStyle = PALETTE.road; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 4.6 * k;
    g.beginPath(); lay.road.forEach(([x, z], i) => { const px = C + x * k, pz = C + z * k; i ? g.lineTo(px, pz) : g.moveTo(px, pz); }); g.stroke();
    g.setLineDash([1.1 * k, 1.6 * k]); g.lineWidth = 0.28 * k; g.strokeStyle = 'rgba(255,220,235,.85)'; g.stroke(); g.setLineDash([]);
    // grass patches
    lay.patches.forEach((p) => { g.save(); g.translate(C + p.x * k, C + p.z * k); g.rotate(p.rot); g.scale(1, p.sx);
      const gr = g.createRadialGradient(0, 0, p.r * k * 0.5, 0, 0, p.r * k * 1.08); gr.addColorStop(0, PALETTE.grassPaint); gr.addColorStop(1, 'rgba(167,44,62,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, p.r * k * 1.08, 0, Math.PI * 2); g.fill(); g.restore(); });
    // pond rim and bowling lane apron
    g.fillStyle = '#e045a6'; g.beginPath(); g.arc(C + POND.x * k, C + POND.z * k, (POND.r + 1.4) * k, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(50,40,80,.18)'; g.fillRect(C + (LANE.x0 - 1) * k, C + (LANE.z - LANE.w / 2 - 1) * k, (LANE.x1 - LANE.x0 + 2) * k, (LANE.w + 2) * k);
    // start plaza ring
    g.strokeStyle = 'rgba(255,225,240,.8)'; g.lineWidth = 0.35 * k; g.beginPath(); g.arc(C + START.x * k, C + START.z * k, 5 * k, 0, Math.PI * 2); g.stroke();
  });
  paint.anisotropy = 8;
  const groundMat = new THREE.MeshLambertMaterial({ map: paint });
  groundMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;').replace('#include <map_fragment>', `#include <map_fragment>
      vec2 tc = vWPos.xz / 2.0; vec2 gw = fwidth(tc);
      vec2 gl = abs(fract(tc - 0.5) - 0.5) / max(gw, vec2(1e-4));
      float line = 1.0 - min(min(gl.x, gl.y) / 1.4, 1.0);
      vec2 cell = floor(tc); float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
      diffuseColor.rgb *= (1.0 - line * 0.13) * (0.965 + h * 0.06);`);
  };
  const shape = new THREE.Shape(islandOutline(160).map(([x, z]) => new THREE.Vector2(x, -z)));
  const topGeo = new THREE.ShapeGeometry(shape, 8); topGeo.rotateX(-Math.PI / 2);
  { const p = topGeo.attributes.position, uv = topGeo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + SPAN / 2) / SPAN, 1 - (p.getZ(i) + SPAN / 2) / SPAN); }
  const ground = new THREE.Mesh(topGeo, groundMat); ground.receiveShadow = true; scene.add(ground);
  const sideGeo = new THREE.ExtrudeGeometry(shape, { depth: 5, bevelEnabled: false, curveSegments: 4 }); sideGeo.rotateX(-Math.PI / 2); sideGeo.translate(0, -5.02, 0);
  scene.add(new THREE.Mesh(sideGeo, [lambert(PALETTE.sandSide), lambert(PALETTE.sandSide)]));

  /* ---------- water, shallows, foam ---------- */
  const water = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), lambert(PALETTE.water)); water.rotation.x = -Math.PI / 2; water.position.y = -0.9; water.receiveShadow = true; scene.add(water);
  const shallowTex = canvasTex(512, 512, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, w * 0.34, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(135,220,120,.75)'); gr.addColorStop(1, 'rgba(135,220,120,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
  const shallow = new THREE.Mesh(new THREE.PlaneGeometry(210, 210), new THREE.MeshBasicMaterial({ map: shallowTex, transparent: true, depthWrite: false })); shallow.rotation.x = -Math.PI / 2; shallow.position.y = -0.85; scene.add(shallow);
  const foamMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false });
  const foams = [];
  [1.6, 4.2].forEach((off, j) => {
    const o = islandOutline(160), pos = [], idx = [];
    o.forEach(([x, z], i) => { const a = Math.atan2(z, x), r = islandR(a); [off, off + 0.35].forEach((d) => pos.push(Math.cos(a) * (r + d), 0, Math.sin(a) * (r + d))); const b = i * 2, n = ((i + 1) % o.length) * 2; if (i % 7 < (j ? 3 : 5)) idx.push(b, n, b + 1, b + 1, n, n + 1); });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
    const m = new THREE.Mesh(geo, foamMat.clone()); m.position.y = -0.82; scene.add(m); foams.push(m);
  });
  // pond
  const pond = new THREE.Mesh(new THREE.CircleGeometry(POND.r, 40), lambert('#42a83a')); pond.rotation.x = -Math.PI / 2; pond.position.set(POND.x, 0.03, POND.z); pond.receiveShadow = true; scene.add(pond);
  const pondFoam = new THREE.Mesh(new THREE.RingGeometry(POND.r - 0.5, POND.r - 0.2, 40), new THREE.MeshBasicMaterial({ color: '#edffe9', transparent: true, opacity: 0.7 })); pondFoam.rotation.x = -Math.PI / 2; pondFoam.position.set(POND.x, 0.05, POND.z); scene.add(pondFoam);
  [[0, 0.6], [2.4, -1.8], [-2.2, 1.6]].forEach(([dx, dz], i) => { const lily = new THREE.Mesh(new THREE.CircleGeometry(0.7 - i * 0.12, 7), lambert('#bf9a5a')); lily.rotation.x = -Math.PI / 2; lily.position.set(POND.x + dx, 0.07, POND.z + dz); scene.add(lily); });

  /* ---------- grass: dense instanced clumps of blades that sway ---------- */
  const windU = { value: 0 };
  const swayShader = (amp, bendExpr = 'max(position.y, 0.0)') => (sh) => { sh.uniforms.uTime = windU; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    #ifdef USE_INSTANCING
      float ph = instanceMatrix[3].x * 0.35 + instanceMatrix[3].z * 0.27;
      float bend = ${bendExpr};
      transformed.x += (sin(uTime * 1.7 + ph) * 0.6 + sin(uTime * 3.1 + ph * 2.0) * 0.25) * ${amp} * bend;
      transformed.z += cos(uTime * 1.3 + ph) * ${amp} * 0.5 * bend;
    #endif`); };
  const clumpGeo = (() => {
    const pos = [], colr = [], nrm = []; let seed = 3; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 6; i++) {
      const a = r() * Math.PI * 2, d = r() * 0.22, x = Math.cos(a) * d, z = Math.sin(a) * d, rot = r() * Math.PI, w = 0.07 + r() * 0.05, h = 0.6 + r() * 0.55, lean = (r() - 0.5) * 0.35;
      const cx = Math.cos(rot) * w, cz = Math.sin(rot) * w;
      pos.push(x - cx, 0, z - cz, x + cx, 0, z + cz, x + lean, h, z + lean * 0.5);
      colr.push(0.66, 0.6, 0.5, 0.66, 0.6, 0.5, 1.15, 1.12, 1.0);
      nrm.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); return g;
  })();
  const grassMat = new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true, side: THREE.DoubleSide });
  grassMat.onBeforeCompile = (sh) => { swayShader('0.16')(sh); sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal = normalize( vNormal );'); };
  const R2 = (() => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
  const tufts = [];
  lay.patches.forEach((p) => { const n = Math.round(p.r * p.r * 11 * quality); for (let i = 0; i < n; i++) { const a = R2() * Math.PI * 2, d = Math.sqrt(R2()) * p.r * 1.02; const x = Math.cos(a) * d, z = Math.sin(a) * d * p.sx; const c = Math.cos(p.rot), s = Math.sin(p.rot); tufts.push([p.x + x * c - z * s, p.z + x * s + z * c, (0.75 + R2() * 0.6) * (1 - Math.pow(d / p.r, 3) * 0.6)]); } });
  const tuftMesh = new THREE.InstancedMesh(clumpGeo, grassMat, tufts.length); tuftMesh.receiveShadow = true;
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
  tufts.forEach(([x, z, h], i) => { q.setFromEuler(e.set(0, R2() * Math.PI * 2, 0)); const w = 0.9 + R2() * 0.5; mtx.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(w, h, w)); tuftMesh.setMatrixAt(i, mtx); tuftMesh.setColorAt(i, col.set(PALETTE.grass[Math.floor(R2() * PALETTE.grass.length)])); });
  scene.add(tuftMesh);

  /* ---------- ground debris: fallen leaves and pebbles ---------- */
  {
    const leafGeo = new THREE.PlaneGeometry(0.26, 0.16); leafGeo.rotateX(-Math.PI / 2);
    const n = Math.round(1700 * quality), dm = new THREE.InstancedMesh(leafGeo, new THREE.MeshLambertMaterial({ color: '#ffffff' }), n);
    const cols = ['#d92fc1', '#e83ac5', '#c72bbc', '#ff5cd1', '#f24a8a', '#923ab2'];
    for (let i = 0; i < n; i++) { const a = R2() * Math.PI * 2, d = Math.sqrt(R2()) * 68; const x = Math.cos(a) * d, z = Math.sin(a) * d; if (d > islandR(a) - 1.5) { mtx.makeScale(0, 0, 0); dm.setMatrixAt(i, mtx); continue; } q.setFromEuler(e.set(0, R2() * 6.3, 0)); const sc = 0.7 + R2() * 0.8; mtx.compose(new THREE.Vector3(x, 0.025, z), q, new THREE.Vector3(sc, 1, sc)); dm.setMatrixAt(i, mtx); dm.setColorAt(i, col.set(cols[Math.floor(R2() * cols.length)])); }
    dm.receiveShadow = true; scene.add(dm);
    const pebGeo = new THREE.DodecahedronGeometry(0.16, 0), pn = Math.round(260 * quality), pm = new THREE.InstancedMesh(pebGeo, lambert('#e6f6ff', { flatShading: true }), pn);
    for (let i = 0; i < pn; i++) { const a = R2() * Math.PI * 2, d = Math.sqrt(R2()) * 66; const sc = 0.6 + R2() * 1.4; mtx.compose(new THREE.Vector3(Math.cos(a) * d, 0.05, Math.sin(a) * d), q.setFromEuler(e.set(R2(), R2() * 3, R2())), new THREE.Vector3(sc, sc * 0.6, sc)); pm.setMatrixAt(i, mtx); }
    pm.receiveShadow = true; scene.add(pm);
  }

  /* ---------- trees: trunk and branches, crowns of many small leaves ---------- */
  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.36, 2.8, 7); trunkGeo.translate(0, 1.4, 0);
  const branchGeo = new THREE.CylinderGeometry(0.07, 0.13, 1.4, 5); branchGeo.translate(0, 0.7, 0);
  const trunkMat = lambert(PALETTE.trunk, { flatShading: true });
  const leafGeo = new THREE.IcosahedronGeometry(0.34, 0);
  const coreGeo = new THREE.IcosahedronGeometry(1, 1);
  const leafMat = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }); leafMat.onBeforeCompile = swayShader('0.06', '1.0');
  const leaves = [], cores = [];
  lay.trees.forEach((t) => {
    const g = new THREE.Group(); g.position.set(t.x, 0, t.z); g.scale.setScalar(t.s);
    let a = t.seed; const r = () => { a = (a * 9301 + 49297) % 233280; return a / 233280; };
    g.add(new THREE.Mesh(trunkGeo, trunkMat));
    const blobs = [[0, 3.6, 0, 1.55]];
    const nb = 2 + Math.floor(r() * 3);
    for (let i = 0; i < nb; i++) { const ang = r() * Math.PI * 2, d = 0.9 + r() * 0.5, y = 2.9 + r() * 1.3; blobs.push([Math.cos(ang) * d, y, Math.sin(ang) * d, 0.95 + r() * 0.45]);
      const br = new THREE.Mesh(branchGeo, trunkMat); br.position.set(0, 2.0 + r() * 0.5, 0); br.rotation.set(Math.sin(ang) * 0.8, 0, -Math.cos(ang) * 0.8); g.add(br); }
    const [c1, c2] = PALETTE.crowns[t.hue];
    blobs.forEach(([bx, by, bz, br]) => {
      cores.push([t.x + bx * t.s, by * t.s, t.z + bz * t.s, br * 0.82 * t.s, c1]);
      const n = Math.round(br * br * 16);
      for (let i = 0; i < n; i++) { const u = r() * 2 - 1, th = r() * Math.PI * 2, rad = br * (0.75 + r() * 0.3), sq = Math.sqrt(1 - u * u);
        leaves.push([t.x + (bx + Math.cos(th) * sq * rad) * t.s, (by + u * rad * 0.85) * t.s, t.z + (bz + Math.sin(th) * sq * rad) * t.s, (0.75 + r() * 0.6) * t.s, r() < 0.5 ? c1 : c2, r() * 0.25 - 0.1]); }
    });
    shadowy(g); scene.add(g); addCol(t.x, t.z, 0.55 * t.s);
  });
  const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, leaves.length);
  leaves.forEach(([x, y, z, sc, c, lt], i) => { mtx.compose(new THREE.Vector3(x, y, z), q.setFromEuler(e.set(i * 1.3, i * 2.1, i * 0.7)), new THREE.Vector3(sc, sc, sc)); leafMesh.setMatrixAt(i, mtx); leafMesh.setColorAt(i, col.set(c).offsetHSL(0, 0, lt)); });
  leafMesh.castShadow = true; leafMesh.receiveShadow = true; scene.add(leafMesh);
  const coreMesh = new THREE.InstancedMesh(coreGeo, new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), cores.length);
  cores.forEach(([x, y, z, sc, c], i) => { mtx.compose(new THREE.Vector3(x, y, z), q.identity(), new THREE.Vector3(sc, sc * 0.85, sc)); coreMesh.setMatrixAt(i, mtx); coreMesh.setColorAt(i, col.set(c).offsetHSL(0, 0.02, -0.08)); });
  coreMesh.castShadow = true; coreMesh.receiveShadow = true; scene.add(coreMesh);

  /* ---------- rocks and soft blocks ---------- */
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const roundedBox = (w, h, d, rr) => { const sh = new THREE.Shape(); const x = -w / 2 + rr, y = -h / 2 + rr, W2 = w - 2 * rr, H2 = h - 2 * rr; sh.moveTo(x, y - rr); sh.lineTo(x + W2, y - rr); sh.quadraticCurveTo(x + W2 + rr, y - rr, x + W2 + rr, y); sh.lineTo(x + W2 + rr, y + H2); sh.quadraticCurveTo(x + W2 + rr, y + H2 + rr, x + W2, y + H2 + rr); sh.lineTo(x, y + H2 + rr); sh.quadraticCurveTo(x - rr, y + H2 + rr, x - rr, y + H2); sh.lineTo(x - rr, y); sh.quadraticCurveTo(x - rr, y - rr, x, y - rr);
    const g = new THREE.ExtrudeGeometry(sh, { depth: d - 2 * rr, bevelEnabled: true, bevelThickness: rr, bevelSize: rr * 0.98, bevelSegments: 3, curveSegments: 4 }); g.translate(0, 0, -(d - 2 * rr) / 2); g.computeVertexNormals(); return g; };
  const blockGeo = roundedBox(1.6, 1.1, 1.3, 0.22);
  const rockMat = lambert(PALETTE.lavender), rockMat2 = lambert(PALETTE.lavenderDark, { flatShading: true });
  lay.rocks.forEach((r, i) => {
    const m = new THREE.Mesh(r.box ? blockGeo : rockGeo, i % 3 ? rockMat : rockMat2);
    m.position.set(r.x, r.box ? 0.45 * r.s : 0.25 * r.s, r.z); m.scale.setScalar(r.s * (r.box ? 1 : 0.7)); m.rotation.set(r.box ? 0.08 : 0.4, r.rot, r.box ? -0.06 : 0.2);
    shadowy(m); scene.add(m); addCol(r.x, r.z, (r.box ? 0.8 : 0.6) * r.s);
  });

  /* ---------- lanterns ---------- */
  const glowTex = canvasTex(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,120,175,.9)'); gr.addColorStop(1, 'rgba(255,90,175,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
  const glowMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const lanternHead = new THREE.MeshBasicMaterial({ color: '#ff9ac1' });
  const poolTex = canvasTex(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,140,181,.45)'); gr.addColorStop(1, 'rgba(255,140,181,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  function lantern(x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.4, 0.22), lambert(PALETTE.plumLight)); post.position.y = 1.2; g.add(post);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.4, 4), lambert(PALETTE.plum)); cap.position.y = 3.15; cap.rotation.y = Math.PI / 4; g.add(cap);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.55), lanternHead); head.position.y = 2.68; g.add(head);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([cx, cz]) => { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.72, 0.07), lambert(PALETTE.plum)); bar.position.set(cx * 0.3, 2.68, cz * 0.3); g.add(bar); });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.7), lambert(PALETTE.plum)); plate.position.y = 2.33; g.add(plate);
    const glow = new THREE.Sprite(glowMat); glow.scale.set(3.4, 3.4, 1); glow.position.y = 2.68; g.add(glow);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(2.2, 24), poolMat); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.03; g.add(pool);
    shadowy(g); glow.castShadow = false; pool.castShadow = false; pool.receiveShadow = false; scene.add(g); addCol(x, z, 0.35);
  }
  lay.lanterns.forEach((l) => lantern(l.x, l.z));

  /* ---------- the name in big standing letters ---------- */
  const STROKES = {
    V: [[[0, 3], [1, 0], [2, 3]]], I: [[[0.3, 0], [0.3, 3]]],
    D: [[[0, 0], [0, 3], [1, 3], [1.65, 2.65], [1.95, 1.9], [1.95, 1.1], [1.65, 0.35], [1, 0], [0, 0]]],
    H: [[[0, 0], [0, 3]], [[2, 0], [2, 3]], [[0, 1.5], [2, 1.5]]],
    U: [[[0, 3], [0, 0.95], [0.3, 0.25], [1, 0], [1.7, 0.25], [2, 0.95], [2, 3]]],
    G: [[[1.95, 2.55], [1.55, 2.92], [1, 3], [0.42, 2.78], [0.06, 2.15], [0, 1.5], [0.06, 0.85], [0.42, 0.22], [1, 0], [1.55, 0.08], [1.95, 0.45], [1.95, 1.3], [1.1, 1.3]]],
    O: [[[1, 0], [1.6, 0.15], [1.92, 0.7], [2, 1.5], [1.92, 2.3], [1.6, 2.85], [1, 3], [0.4, 2.85], [0.08, 2.3], [0, 1.5], [0.08, 0.7], [0.4, 0.15], [1, 0]]],
    E: [[[1.9, 3], [0, 3], [0, 0], [1.9, 0]], [[0, 1.5], [1.5, 1.5]]],
    L: [[[0, 3], [0, 0], [1.8, 0]]],
  };
  const WIDTH = { I: 0.6, L: 1.8, E: 1.9 };
  {
    const text = 'YASH TRIVEDI', S = 1.25, th = 0.62, dep = 0.9;
    let total = 0; for (const ch of text) total += (ch === ' ' ? 1.4 : (WIDTH[ch] || 2)) + 0.75; total -= 0.75;
    const segs = [], joints = [];
    let cx = -total / 2;
    for (const ch of text) {
      if (ch === ' ') { cx += 1.4 + 0.75; continue; }
      (STROKES[ch] || []).forEach((poly) => { for (let i = 0; i < poly.length; i++) { const [x, y] = poly[i]; joints.push([cx + x, y]); if (i) { const [px, py] = poly[i - 1]; segs.push([cx + px, py, cx + x, y]); } } });
      cx += (WIDTH[ch] || 2) + 0.75;
    }
    const grp = new THREE.Group(); grp.position.set(0, 0.35, -15.5); grp.rotation.x = -0.32;
    const letterMat = lambert(PALETTE.white), sideMat = lambert(PALETTE.lavenderDark);
    const segMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), letterMat, segs.length);
    const jGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 14); jGeo.rotateX(Math.PI / 2);
    const jMesh = new THREE.InstancedMesh(jGeo, letterMat, joints.length);
    segs.forEach(([ax, ay, bx, by], i) => { const len = Math.hypot(bx - ax, by - ay); mtx.compose(new THREE.Vector3((ax + bx) / 2 * S, (ay + by) / 2 * S, 0), q.setFromEuler(e.set(0, 0, Math.atan2(by - ay, bx - ax))), new THREE.Vector3(len * S, th * S, dep)); segMesh.setMatrixAt(i, mtx); });
    joints.forEach(([x, y], i) => { mtx.compose(new THREE.Vector3(x * S, y * S, 0), q.identity(), new THREE.Vector3(th * S, th * S, dep)); jMesh.setMatrixAt(i, mtx); });
    grp.add(segMesh, jMesh);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(total * S + 2, 0.5, 2.4), sideMat); plinth.position.set(0, -0.2, 0.2); plinth.rotation.x = 0.32; grp.add(plinth);
    shadowy(grp); scene.add(grp);
    for (let x = -total * S / 2; x <= total * S / 2; x += 1.6) addCol(x, -15.3, 1.1);
  }

  /* ---------- signs, stones, kiosks, boards and the rest ---------- */
  const woodMat = lambert(PALETTE.wood, { flatShading: true }), plumMat = lambert(PALETTE.plum), plumLightMat = lambert(PALETTE.plumLight);
  function textBoard(title, sub, w = 1024, h = 400, bg = PALETTE.plum) {
    return canvasTex(w, h, (g) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = PALETTE.lime; g.fillRect(w * 0.1, 0, w * 0.8, 10);
      g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 ${Math.round(h * 0.52)}px ${FD}`; g.fillText(title, w / 2, sub ? h * 0.42 : h * 0.54);
      if (sub) { g.fillStyle = PALETTE.pink; g.font = `800 ${Math.round(h * 0.11)}px ${FB}`; g.fillText(sub, w / 2, h * 0.8); } });
  }
  function signPost(x, z, title, sub, stopId, scale = 1) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(scale);
    [-1.9, 1.9].forEach((px) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.6, 0.3), woodMat); p.position.set(px, 1.8, 0); g.add(p); });
    const board = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.9, 0.22), [plumMat, plumMat, plumMat, plumMat, new THREE.MeshLambertMaterial({ map: textBoard(title, sub) }), plumMat]);
    board.position.y = 2.6; g.add(board);
    shadowy(g); scene.add(g); [-1.9, 1.9].forEach((px) => addCol(x + px * scale, z, 0.35));
    if (stopId) { g.userData.stopId = stopId; clickables.push(g); }
    return g;
  }
  const byId = Object.fromEntries(stops.map((s) => [s.id, s]));

  // About: sign under the letters, with a bench
  if (byId.about) signPost(0, -8, 'About me', 'STOP 1', 'about');
  { const b = new THREE.Group(); b.position.set(6, 0, -6.5); b.rotation.y = -0.4; const seat = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.18, 0.8), woodMat); seat.position.y = 0.7; b.add(seat); const back = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.7, 0.14), woodMat); back.position.set(0, 1.15, -0.38); b.add(back); [-1.2, 1.2].forEach((x) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.7), plumLightMat); l.position.set(x, 0.35, 0); b.add(l); }); shadowy(b); scene.add(b); addCol(6, -6.5, 1.3); }

  // Journey: year stones
  if (byId.journey) {
    signPost(-28, -7.5, 'Journey', `STOP ${byId.journey.n}`, 'journey', 0.8);
    const years = ['2019', '2021', '2023', '2025', '2026'];
    [[-38, -11], [-33, -13], [-28, -14], [-23, -13], [-18, -11]].forEach(([x, z], i) => {
      const tex = canvasTex(256, 340, (g, w, h) => { g.fillStyle = PALETTE.lavender; g.fillRect(0, 0, w, h); g.fillStyle = PALETTE.plum; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 140px ${FD}`; g.fillText(years[i], w / 2, h * 0.5); });
      const st = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.9 + i * 0.25, 0.7), [rockMat2, rockMat2, rockMat, rockMat, new THREE.MeshLambertMaterial({ map: tex }), rockMat2]);
      st.position.set(x, (2.9 + i * 0.25) / 2, z); st.rotation.y = (x + 28) * -0.02; st.userData.stopId = 'journey';
      shadowy(st); scene.add(st); clickables.push(st); addCol(x, z, 1.1);
    });
  }

  // Experience: three kiosks with logos
  const kioskColors = [['#3b2f45', '#ffffff'], ['#ef5adf', '#ffffff'], ['#348f2f', '#ffffff']];
  stops.filter((s) => s.kiosk).forEach((s, i) => {
    const { x, z } = s.kiosk; const [base, stripe] = kioskColors[i % 3];
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const b = new THREE.Mesh(new THREE.BoxGeometry(5, 2.4, 3.2), lambert(base, { flatShading: true })); b.position.y = 1.2; g.add(b);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(5.3, 0.25, 1), woodMat); counter.position.set(0, 1.3, 1.9); g.add(counter);
    const awnTex = canvasTex(256, 64, (gg, w, h) => { for (let j = 0; j < 8; j++) { gg.fillStyle = j % 2 ? stripe : base; gg.fillRect(j * w / 8, 0, w / 8, h); } });
    const awn = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.18, 2.2), new THREE.MeshLambertMaterial({ map: awnTex })); awn.position.set(0, 3.4, 1.4); awn.rotation.x = 0.28; g.add(awn);
    [-2.5, 2.5].forEach((px) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.4, 0.2), woodMat); p.position.set(px, 1.7, 2.3); g.add(p); });
    const logoTex = canvasTex(512, 256, (gg, w, h) => { gg.fillStyle = '#ffffff'; gg.fillRect(0, 0, w, h); gg.fillStyle = PALETTE.lime; gg.fillRect(0, h - 14, w, 14); });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.1, 0.25), [plumMat, plumMat, plumMat, plumMat, new THREE.MeshLambertMaterial({ map: logoTex }), plumMat]); sign.position.set(0, 4.9, -0.6); g.add(sign);
    loadImg(s.logo).then((img) => { if (!img) return; const gg = logoTex.userData.ctx, w = 512, h = 256; const ar = (img.naturalWidth || 300) / (img.naturalHeight || 100); let dw = w * 0.8, dh = dw / ar; if (dh > h * 0.55) { dh = h * 0.55; dw = dh * ar; } gg.drawImage(img, (w - dw) / 2, (h - 14 - dh) / 2, dw, dh); logoTex.needsUpdate = true; });
    g.userData.stopId = s.id; shadowy(g); scene.add(g); clickables.push(g); addCol(x, z, 2.6); addCol(x - 1.8, z + 1.2, 1.2); addCol(x + 1.8, z + 1.2, 1.2);
  });

  // Projects: billboards with each cover
  const frameMat = lambert(PALETTE.plum);
  stops.filter((s) => s.board).forEach((s) => {
    const { x, z } = s.board; const g = new THREE.Group(); g.position.set(x, 0, z);
    const tex = new THREE.TextureLoader().load(s.thumb); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(7, 4.5, 0.3), frameMat); frame.position.y = 3.6; g.add(frame);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 4.125), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); face.position.set(0, 3.6, 0.16); g.add(face);
    [-2.6, 2.6].forEach((px) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.6, 0.28), woodMat); p.position.set(px, 0.8, 0); g.add(p); });
    const plateTex = textBoard(s.label, `STOP ${s.n}`, 1024, 220);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.1, 0.2), [plumMat, plumMat, plumMat, plumMat, new THREE.MeshLambertMaterial({ map: plateTex }), plumMat]); plate.position.set(0, 0.95, 0.4); plate.rotation.x = -0.25; g.add(plate);
    g.userData.stopId = s.id; shadowy(g); face.castShadow = false; scene.add(g); clickables.push(g);
    addCol(x - 2.6, z, 0.45); addCol(x + 2.6, z, 0.45); addCol(x, z, 0.6);
  });

  // Wins: podium with five trophies
  if (byId.wins) {
    const g = new THREE.Group(); g.position.set(50, 0, -10);
    [[0, 1.5, '1'], [-2.3, 1.0, '2'], [2.3, 0.7, '3']].forEach(([px, h, n]) => {
      const tex = canvasTex(128, 128, (gg, w) => { gg.fillStyle = PALETTE.lavender; gg.fillRect(0, 0, w, w); gg.fillStyle = PALETTE.plum; gg.font = `700 96px ${FD}`; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText(n, w / 2, w / 2 + 4); });
      const st = new THREE.Mesh(new THREE.BoxGeometry(2.3, h, 2.2), [rockMat2, rockMat2, rockMat, rockMat, new THREE.MeshLambertMaterial({ map: tex }), rockMat2]); st.position.set(px, h / 2, 0); g.add(st);
    });
    const prof = [[0, 0], [0.55, 0], [0.55, 0.12], [0.18, 0.2], [0.14, 0.6], [0.2, 0.7], [0.62, 1.0], [0.72, 1.55], [0.66, 1.6], [0, 1.2]].map(([a, b]) => new THREE.Vector2(a, b));
    const cupGeo = new THREE.LatheGeometry(prof, 16), goldMat = new THREE.MeshStandardMaterial({ color: PALETTE.gold, metalness: 0.55, roughness: 0.3, emissive: '#5a0020', emissiveIntensity: 0.4 });
    const cups = [];
    [[0, 1.5, 1.25], [-2.3, 1.0, 1], [2.3, 0.7, 1], [-4.6, 0.5, 0.85], [4.6, 0.5, 0.85]].forEach(([px, h, sc], i) => {
      if (i > 2) { const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.5, 8), rockMat2); ped.position.set(px, 0.25, 0.4); g.add(ped); }
      const cup = new THREE.Mesh(cupGeo, goldMat); cup.position.set(px, h, i > 2 ? 0.4 : 0); cup.scale.setScalar(sc); g.add(cup); cups.push(cup);
    });
    signPost(50, -14.2, 'Wins', `STOP ${byId.wins.n}`, null, 0.7);
    g.userData.stopId = 'wins'; shadowy(g); scene.add(g); clickables.push(g);
    addCol(50, -10, 3.4); addCol(45.4, -9.6, 0.9); addCol(54.6, -9.6, 0.9);
    if (!reduced) tickers.push((time) => cups.forEach((c, i) => { c.rotation.y = time * 0.8 + i; }));
  }

  // Bowling lane with pins that scatter
  const pins = [];
  {
    const laneTex = canvasTex(1024, 160, (g, w, h) => { g.fillStyle = '#f27aaa'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(150,40,100,.35)'; g.lineWidth = 2; for (let y = 0; y < h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } g.fillStyle = PALETTE.red; for (let i = 0; i < 5; i++) { const y = h * (0.2 + i * 0.15); g.beginPath(); g.moveTo(w * 0.3 + 30, y); g.lineTo(w * 0.3, y - 10); g.lineTo(w * 0.3, y + 10); g.fill(); } });
    const len = LANE.x1 - LANE.x0;
    const lane = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, LANE.w), new THREE.MeshLambertMaterial({ map: laneTex })); lane.position.set((LANE.x0 + LANE.x1) / 2, 0.06, LANE.z); lane.receiveShadow = true; scene.add(lane);
    [-1, 1].forEach((sd) => { const gut = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, 0.35), plumLightMat); gut.position.set((LANE.x0 + LANE.x1) / 2, 0.15, LANE.z + sd * (LANE.w / 2 + 0.17)); gut.receiveShadow = true; scene.add(gut); });
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.4, LANE.w + 1.4), plumMat); back.position.set(LANE.x1 + 0.6, 0.7, LANE.z); shadowy(back); scene.add(back); addCol(LANE.x1 + 0.6, LANE.z - 1.2, 0.9); addCol(LANE.x1 + 0.6, LANE.z + 1.2, 0.9);
    const pinProf = [[0, 0], [0.2, 0], [0.26, 0.25], [0.28, 0.5], [0.16, 0.85], [0.12, 1.0], [0.17, 1.15], [0.15, 1.3], [0, 1.36]].map(([a, b]) => new THREE.Vector2(a, b));
    const pinGeo = new THREE.LatheGeometry(pinProf, 10); pinGeo.translate(0, 0, 0);
    const pinMat = lambert('#fff2f7'), bandMat = lambert(PALETTE.red);
    const bandGeo = new THREE.CylinderGeometry(0.155, 0.17, 0.09, 10); bandGeo.translate(0, 0.98, 0);
    const baseX = LANE.x1 - 3;
    let row = 0, idx = 0;
    for (row = 0; row < 4; row++) for (let j = 0; j <= row; j++) {
      const hx = baseX + row * 0.75 - 1.5, hz = LANE.z + (j - row / 2) * 0.7;
      const m = new THREE.Group(); const body = new THREE.Mesh(pinGeo, pinMat); const band = new THREE.Mesh(bandGeo, bandMat); m.add(body, band); m.scale.setScalar(1.25);
      shadowy(m); scene.add(m);
      pins.push({ m, hx, hz, x: hx, z: hz, vx: 0, vz: 0, tilt: 0, tiltDir: 0, down: false, idx: idx++ });
    }
    pins.forEach((p) => p.m.position.set(p.x, 0.12, p.z));
  }

  // Toolbox: crates printed with tool logos
  const crateTextures = [];
  if (byId.tools) {
    signPost(36, 17.5, 'Toolbox', `STOP ${byId.tools.n}`, 'tools', 0.7);
    const g = new THREE.Group(); g.position.set(42.5, 0, 20); g.userData.stopId = 'tools';
    const spots = []; [5, 4, 3, 2].forEach((n, r) => { for (let i = 0; i < n; i++) spots.push([(i - (n - 1) / 2) * 1.62, 0.78 + r * 1.56, (r % 2) * 0.12]); });
    const crateGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    spots.forEach(([cx, cy, cz], i) => {
      const tex = canvasTex(256, 256, (gg, w) => { gg.fillStyle = '#f6c4d7'; gg.fillRect(0, 0, w, w); gg.strokeStyle = PALETTE.woodDark; gg.lineWidth = 18; gg.strokeRect(9, 9, w - 18, w - 18); gg.lineWidth = 4; gg.strokeStyle = 'rgba(155,56,112,.4)'; for (let y = 60; y < w; y += 52) { gg.beginPath(); gg.moveTo(18, y); gg.lineTo(w - 18, y); gg.stroke(); } });
      crateTextures.push(tex);
      const m = new THREE.Mesh(crateGeo, new THREE.MeshLambertMaterial({ map: tex })); m.position.set(cx, cy, cz); m.rotation.y = ((i * 37) % 11 - 5) * 0.025; g.add(m);
    });
    shadowy(g); scene.add(g); clickables.push(g); addCol(42.5, 20, 3.6); addCol(39, 20, 1.2); addCol(46, 20, 1.2);
  }
  async function paintCrates(tools) {
    const list = tools.slice(0, crateTextures.length);
    await Promise.all(list.map(async (t, i) => {
      const tex = crateTextures[i]; const gg = tex.userData.ctx; const w = 256;
      if (t.logo) { const img = await loadImg(t.logo); if (img) gg.drawImage(img, w * 0.24, w * 0.18, w * 0.52, w * 0.52); }
      else { gg.fillStyle = PALETTE.plum; gg.font = `800 54px ${FB}`; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText(t.name.split(' ').map((x) => x[0]).join(''), w / 2, w * 0.44); }
      gg.fillStyle = PALETTE.plum; gg.font = `700 34px ${FD}`; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText(t.name.toUpperCase().slice(0, 18), w / 2, w * 0.84);
      tex.needsUpdate = true;
    }));
  }

  // Front desk: booth and a little robot with a signal face
  let robot = null, faceTex = null;
  if (byId.ai) {
    const bx = byId.ai.x, bz = byId.ai.z - 6.2;
    const g = new THREE.Group(); g.position.set(bx, 0, bz); g.userData.stopId = 'ai';
    const b = new THREE.Mesh(new THREE.BoxGeometry(5.6, 2.4, 3), lambert(PALETTE.plumLight, { flatShading: true })); b.position.y = 1.2; g.add(b);
    const awnTex = canvasTex(256, 64, (gg, w, h) => { for (let j = 0; j < 8; j++) { gg.fillStyle = j % 2 ? PALETTE.lime : PALETTE.plum; gg.fillRect(j * w / 8, 0, w / 8, h); } });
    const awn = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.18, 2.2), new THREE.MeshLambertMaterial({ map: awnTex })); awn.position.set(0, 3.4, 1.4); awn.rotation.x = 0.28; g.add(awn);
    [-2.8, 2.8].forEach((px) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.4, 0.2), woodMat); p.position.set(px, 1.7, 2.3); g.add(p); });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.4, 0.22), [plumMat, plumMat, plumMat, plumMat, new THREE.MeshLambertMaterial({ map: textBoard('Front desk', `STOP ${byId.ai.n}`, 1024, 320) }), plumMat]); sign.position.set(0, 4.6, -0.6); g.add(sign);
    // robot
    robot = new THREE.Group(); robot.position.set(0, 0, 2.6);
    const white = lambert('#eef6fc', { flatShading: true });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 1.4, 10), white); torso.position.y = 1.0; robot.add(torso);
    const head = new THREE.Group(); head.position.y = 2.3; robot.add(head);
    const skull = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.15, 1.1), white); head.add(skull);
    faceTex = canvasTex(256, 160, () => {});
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.42, 0.88), new THREE.MeshBasicMaterial({ map: faceTex, toneMapped: false })); face.position.z = 0.56; head.add(face);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5), plumMat); ant.position.y = 0.8; head.add(ant);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), lambert(PALETTE.lime, { emissive: '#bf7a4a' })); bulb.position.y = 1.1; head.add(bulb);
    [-1, 1].forEach((sd) => { const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.0, 6), white); arm.position.set(sd * 0.95, 1.2, 0); arm.rotation.z = sd * 0.5; arm.name = sd < 0 ? 'armL' : 'armR'; robot.add(arm); });
    robot.userData.head = head;
    g.add(robot);
    shadowy(g); face.castShadow = false; scene.add(g); clickables.push(g);
    addCol(bx, bz, 3); addCol(bx - 2, bz + 1, 1.4); addCol(bx + 2, bz + 1, 1.4); addCol(bx, bz + 2.6, 0.9);
  }
  function drawFace(time, talking) {
    if (!faceTex) return; const g = faceTex.userData.ctx, w = 256, h = 160;
    g.fillStyle = '#251f2b'; g.fillRect(0, 0, w, h); g.fillStyle = PALETTE.lime;
    for (let i = 0; i < 9; i++) { const amp = (talking ? 0.35 : 0.12) + 0.5 * Math.abs(Math.sin(time * (talking ? 7 : 2.2) + i * 0.9)) * (talking ? 1 : 0.4); const bh = Math.max(10, h * 0.7 * amp); const x = 28 + i * 24; g.beginPath(); g.roundRect(x, (h - bh) / 2, 13, bh, 6); g.fill(); }
    faceTex.needsUpdate = true;
  }
  drawFace(0, false);

  // Contact: red mailbox
  if (byId.contact) {
    const x = byId.contact.x, z = byId.contact.z - 5.5;
    const g = new THREE.Group(); g.position.set(x, 0, z); g.userData.stopId = 'contact';
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.6, 0.35), woodMat); post.position.y = 0.8; g.add(post);
    const redM = lambert(PALETTE.red, { flatShading: true });
    const boxM = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 2.0), redM); boxM.position.y = 2.05; g.add(boxM);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.0, 12, 1, false, 0, Math.PI), redM); top.rotation.set(Math.PI / 2, 0, Math.PI / 2); top.position.y = 2.55; g.add(top);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.3, 0.08), lambert('#c92ec7')); door.position.set(0, 2.2, 1.02); g.add(door);
    const flagPole = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, 0.08), plumMat); flagPole.position.set(0.75, 2.6, 0.2); g.add(flagPole);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.6), lambert(PALETTE.lime)); flag.position.set(0.75, 3.05, 0.45); g.add(flag);
    shadowy(g); scene.add(g); clickables.push(g); addCol(x, z, 1.3);
    signPost(x + 4.5, z - 0.5, 'Contact', `STOP ${byId.contact.n}`, 'contact', 0.7);
    const env = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.6), lambert('#fff2f7')); env.position.set(x, 3.6, z); scene.add(env); env.castShadow = true;
    if (!reduced) tickers.push((time) => { env.position.y = 3.7 + Math.sin(time * 2) * 0.18; env.rotation.y = time * 0.9; flag.rotation.x = Math.sin(time * 3) * 0.12; });
  }

  /* ---------- pads (one per stop) ---------- */
  const padFill = new THREE.CircleGeometry(2.7, 40), padRing = new THREE.RingGeometry(2.45, 2.8, 48);
  const pads = {};
  stops.forEach((s) => {
    const g = new THREE.Group(); g.position.set(s.x, 0.04, s.z);
    const fill = new THREE.Mesh(padFill, new THREE.MeshBasicMaterial({ color: PALETTE.plum, transparent: true, opacity: 0.28, depthWrite: false })); fill.rotation.x = -Math.PI / 2;
    const ringM = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, depthWrite: false });
    const ring = new THREE.Mesh(padRing, ringM); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01;
    g.add(fill, ring); scene.add(g); pads[s.id] = { g, ring, fill, state: '' };
  });
  function setPad(id, { visited, near, next }) {
    const p = pads[id]; if (!p) return;
    p.ring.material.color.set(near || visited ? PALETTE.lime : '#ffffff');
    p.fill.material.opacity = near ? 0.5 : 0.28;
    p.next = next; p.near = near;
  }

  /* ---------- guidance: a chevron around the car and a click target ring ---------- */
  const chevShape = new THREE.Shape(); chevShape.moveTo(0, 0.9); chevShape.lineTo(0.75, -0.3); chevShape.lineTo(0, 0.1); chevShape.lineTo(-0.75, -0.3); chevShape.closePath();
  const chevGeo = new THREE.ShapeGeometry(chevShape); chevGeo.rotateX(-Math.PI / 2);
  const chevron = new THREE.Mesh(chevGeo, new THREE.MeshBasicMaterial({ color: PALETTE.lime, transparent: true, opacity: 0.95, depthWrite: false })); chevron.position.y = 0.12; scene.add(chevron);
  const targetRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 32), new THREE.MeshBasicMaterial({ color: PALETTE.lime, transparent: true, opacity: 0, depthWrite: false })); targetRing.rotation.x = -Math.PI / 2; targetRing.position.y = 0.1; scene.add(targetRing);

  /* ---------- per-frame ---------- */
  function update(time, dt, focus, talking) {
    windU.value = reduced ? 0 : time;
    foams.forEach((f, i) => { const s = 1 + (reduced ? 0 : Math.sin(time * 0.8 + i * 1.7) * 0.012); f.scale.set(s, 1, s); f.material.opacity = 0.55 + (reduced ? 0 : Math.sin(time * 0.8 + i * 1.7) * 0.25); });
    tickers.forEach((t) => t(time, dt));
    Object.values(pads).forEach((p) => { const s = p.near ? 1.08 : p.next && !reduced ? 1 + Math.sin(time * 4) * 0.05 : 1; p.ring.scale.setScalar(s); });
    if (robot) {
      if (!reduced) { robot.rotation.z = Math.sin(time * 1.4) * 0.04; robot.position.y = Math.abs(Math.sin(time * 2.8)) * 0.08; robot.getObjectByName('armR').rotation.z = 0.5 + Math.sin(time * 3) * 0.35; }
      const head = robot.userData.head, wp = new THREE.Vector3(); robot.getWorldPosition(wp);
      const want = Math.max(-0.9, Math.min(0.9, Math.atan2(focus.x - wp.x, focus.z - wp.z)));
      head.rotation.y += (want - head.rotation.y) * Math.min(1, dt * 3);
      if (!reduced || !update.f) drawFace(time, talking); update.f = 1;
    }
    if (targetRing.material.opacity > 0) { targetRing.material.opacity = Math.max(0, targetRing.material.opacity - dt * 0.4); targetRing.scale.setScalar(1 + (reduced ? 0 : Math.sin(time * 6) * 0.08)); }
    // keep the sun's shadow box on the car
    sun.position.set(focus.x - 22, 38, focus.z + 16); sun.target.position.set(focus.x, 0, focus.z);
  }
  function showTarget(x, z) { targetRing.position.x = x; targetRing.position.z = z; targetRing.material.opacity = 0.95; }
  function hideTarget() { targetRing.material.opacity = 0; }

  return { renderer, scene, camera, colliders, clickables, pins, setPad, update, chevron, showTarget, hideTarget, paintCrates, ground };
}
