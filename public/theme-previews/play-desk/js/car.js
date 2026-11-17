/* A toy off-road car drawn from boxes and cylinders, with simple and stable arcade physics.
   Heading h: forward vector = (sin h, cos h) in (x, z). h = PI faces north (up the screen). */
import * as THREE from '../vendor/three.module.min.js';
import { islandR, POND } from './island.js';

export const TUNE = { maxSpeed: 15, boostSpeed: 23, accel: 20, reverse: 7, brake: 34, steer: 2.5, grip: 7.5, radius: 1.25 };

export function createCar(scene) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.05, ...o });
  const red = M('#e33be3', { roughness: 0.38 }), dark = M('#2b2230', { roughness: 0.8 }), plum = M('#3b2f45', { roughness: 0.7 });
  const glass = M('#1f3a2f', { roughness: 0.15, metalness: 0.3, emissive: '#0d2b1e', side: THREE.DoubleSide }), chrome = M('#e4edf2', { roughness: 0.3, metalness: 0.6 });
  const lime = M('#ffbf95', { emissive: '#8f5a3a', emissiveIntensity: 0.5 });
  const head = new THREE.MeshBasicMaterial({ color: '#ffc4d0' }), tail = new THREE.MeshBasicMaterial({ color: '#ff4dff' }), amber = new THREE.MeshBasicMaterial({ color: '#ff6ba6' });
  const add = (geo, m, x, y, z, parent = body) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
  // side profile (u = forward, v = up) extruded across the width, with rounded bevels
  const profile = (pts, width, bevel) => {
    const sh = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: width, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 6 });
    g.rotateY(-Math.PI / 2); g.translate(width / 2, 0, 0); return g;
  };
  add(profile([[-1.62, 0.62], [1.62, 0.62], [1.72, 0.92], [1.5, 1.22], [0.5, 1.32], [-1.62, 1.3]], 1.66, 0.16), red, 0, 0, 0);
  add(profile([[-1.22, 1.3], [0.42, 1.3], [-0.04, 2.0], [-1.18, 2.0]], 1.44, 0.1), red, 0, 0, 0);
  // windows
  const winShape = new THREE.Shape([[-1.08, 1.44], [0.24, 1.44], [-0.1, 1.9], [-1.06, 1.9]].map(([u, v]) => new THREE.Vector2(u, v)));
  const winGeo = new THREE.ShapeGeometry(winShape); winGeo.rotateY(-Math.PI / 2);
  add(winGeo, glass, 0.835, 0, 0); add(winGeo, glass, -0.835, 0, 0);
  const pillar = add(new THREE.BoxGeometry(0.06, 0.48, 0.08), red, 0.84, 1.67, -0.45); add(pillar.geometry, red, -0.84, 1.67, -0.45);
  const ws = add(new THREE.PlaneGeometry(1.36, 0.82), glass, 0, 1.66, 0.27); ws.rotation.x = -0.588;
  const rw = add(new THREE.PlaneGeometry(1.3, 0.5), glass, 0, 1.7, -1.29); rw.rotation.y = Math.PI;
  // trim, bumpers, roof rack
  const capsule = (len, r) => { const g = new THREE.CapsuleGeometry(r, len, 4, 10); g.rotateZ(Math.PI / 2); return g; };
  add(capsule(1.7, 0.17), dark, 0, 0.72, 1.86); add(capsule(1.7, 0.17), dark, 0, 0.72, -1.82);
  add(new THREE.BoxGeometry(1.95, 0.16, 3.5), dark, 0, 0.56, 0);
  add(new THREE.BoxGeometry(1.25, 0.06, 1.0), lime, 0, 1.38, 1.0).rotation.x = -0.09;
  const rack = new THREE.Group(); rack.position.set(0, 2.14, -0.6); body.add(rack);
  add(capsule(1.3, 0.05), plum, 0, 0, 0.5, rack); add(capsule(1.3, 0.05), plum, 0, 0, -0.5, rack);
  [-0.62, 0.62].forEach((x) => { const r = add(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6), plum, x, 0, 0, rack); r.rotation.x = Math.PI / 2; });
  [-0.45, 0, 0.45].forEach((x) => { const l = add(new THREE.CylinderGeometry(0.12, 0.12, 0.14, 12), plum, x, 0.06, 0.55, rack); l.rotation.x = Math.PI / 2; add(new THREE.CircleGeometry(0.095, 12), amber, x, 0.06, 0.63, rack); });
  // lights
  [-0.6, 0.6].forEach((x) => { const h = add(new THREE.CylinderGeometry(0.17, 0.17, 0.1, 14), chrome, x, 1.04, 1.84); h.rotation.x = Math.PI / 2; add(new THREE.CircleGeometry(0.13, 14), head, x, 1.04, 1.9);
    add(new THREE.BoxGeometry(0.34, 0.16, 0.05), tail, x * 1.1, 1.06, -1.82); });
  // spare wheel on the back
  const spare = add(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 16), dark, 0, 1.25, -1.95); spare.rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 10), chrome, 0, 1.25, -1.95).rotation.x = Math.PI / 2;
  // wheel arches
  const archGeo = new THREE.CylinderGeometry(0.74, 0.74, 0.5, 14, 1, true, 0, Math.PI); archGeo.rotateZ(Math.PI / 2);
  const archMat = M('#2b2230', { side: THREE.DoubleSide, roughness: 0.8 });
  [[0.92, 1.1], [-0.92, 1.1], [0.92, -1.05], [-0.92, -1.05]].forEach(([x, z]) => add(archGeo, archMat, x, 0.62, z));
  // wheels: chunky tyres with rounded edges, rims and hubs
  const tyreProfile = [[0.3, -0.29], [0.48, -0.29], [0.56, -0.22], [0.58, 0], [0.56, 0.22], [0.48, 0.29], [0.3, 0.29]].map(([r, y]) => new THREE.Vector2(r, y));
  const wheelGeo = new THREE.LatheGeometry(tyreProfile, 18); wheelGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.5, 14); rimGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.56, 8); hubGeo.rotateZ(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(0.52, 0.06, 0.5);
  const tire = M('#2a2228', { roughness: 0.9, flatShading: true });
  const wheels = [];
  [[0.98, 1.1], [-0.98, 1.1], [0.98, -1.05], [-0.98, -1.05]].forEach(([x, z], i) => {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.58, z); g.add(pivot);
    const w = new THREE.Mesh(wheelGeo, tire); pivot.add(w);
    w.add(new THREE.Mesh(rimGeo, chrome)); w.add(new THREE.Mesh(hubGeo, lime));
    for (let k = 0; k < 3; k++) { const sp = new THREE.Mesh(spokeGeo, plum); sp.rotation.x = k * Math.PI / 3; sp.scale.set(1.04, 1, 0.12); w.add(sp); }
    wheels.push({ pivot, w, front: i < 2 });
  });
  g.traverse((o) => { if (o.isMesh && !(o.material && o.material.isMeshBasicMaterial)) { o.castShadow = true; o.receiveShadow = true; } });
  // soft contact shadow under the car
  const blobTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const gr = x.createRadialGradient(64, 64, 8, 64, 64, 64); gr.addColorStop(0, 'rgba(10,10,40,.55)'); gr.addColorStop(1, 'rgba(10,10,40,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); return t; })();
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4.8), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false })); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.03; g.add(blob);
  // headlight glow
  const glowC = document.createElement('canvas'); glowC.width = glowC.height = 64; { const x = glowC.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,160,185,.9)'); gr.addColorStop(1, 'rgba(255,120,175,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); }
  const glowMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(glowC), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  [-0.6, 0.6].forEach((x) => { const sp = new THREE.Sprite(glowMat); sp.scale.set(0.9, 0.9, 1); sp.position.set(x, 1.04, 1.98); body.add(sp); });
  scene.add(g);

  // dust puffs
  const dustGeo = new THREE.IcosahedronGeometry(0.35, 0);
  const dust = [];
  for (let i = 0; i < 36; i++) { const m = new THREE.Mesh(dustGeo, new THREE.MeshLambertMaterial({ color: '#f69acc', transparent: true, opacity: 0 })); m.visible = false; scene.add(m); dust.push({ m, life: 0 }); }
  let dustI = 0;

  const s = { x: 0, z: 0, h: Math.PI, vx: 0, vz: 0, vf: 0, yaw: 0, roll: 0, pitch: 0, bump: 0, inWater: false, speed: 0 };

  function place(x, z, h) { s.x = x; s.z = z; s.h = h; s.vx = s.vz = s.vf = 0; g.position.set(x, 0, z); g.rotation.y = h; }

  function step(dt, input, colliders, dyn) {
    const fx = Math.sin(s.h), fz = Math.cos(s.h), rx = fz, rz = -fx;
    let vf = s.vx * fx + s.vz * fz, vl = s.vx * rx + s.vz * rz;
    const top = input.boost ? TUNE.boostSpeed : TUNE.maxSpeed;
    const t = input.throttle;
    if (t > 0) { if (vf < -0.5) vf += TUNE.brake * dt * t; else if (vf < top * t) vf += TUNE.accel * (input.boost ? 1.5 : 1) * dt * t; }
    else if (t < 0) { if (vf > 0.5) vf += TUNE.brake * dt * t; else if (vf > -TUNE.reverse) vf += TUNE.accel * 0.6 * dt * t; }
    else vf *= Math.exp(-1.6 * dt);
    if (vf > top) vf += (top - vf) * Math.min(1, 3 * dt);
    if (input.brake) vf *= Math.exp(-5 * dt);
    vf *= Math.exp(-0.25 * dt);
    // water and pond slow the car
    const r = Math.hypot(s.x, s.z), edge = islandR(Math.atan2(s.z, s.x));
    s.inWater = r > edge - 0.6 || Math.hypot(s.x - POND.x, s.z - POND.z) < POND.r - 0.6;
    if (s.inWater) vf *= Math.exp(-2.4 * dt);
    vl *= Math.exp(-(input.brake ? 2.2 : TUNE.grip) * dt);
    const steerAmt = input.steer * TUNE.steer * Math.min(1, Math.abs(vf) / 5) * Math.sign(vf || 1) / (1 + Math.abs(vf) / 40);
    s.yaw = steerAmt;
    s.h += steerAmt * dt;
    s.vx = fx * vf + rx * vl; s.vz = fz * vf + rz * vl;
    s.x += s.vx * dt; s.z += s.vz * dt;
    // static colliders
    const R = TUNE.radius;
    for (const c of colliders) {
      const dx = s.x - c.x, dz = s.z - c.z, d = Math.hypot(dx, dz), m = c.r + R;
      if (d < m && d > 1e-4) {
        const nx = dx / d, nz = dz / d; s.x = c.x + nx * m; s.z = c.z + nz * m;
        const vn = s.vx * nx + s.vz * nz;
        if (vn < 0) { s.vx -= 1.35 * vn * nx; s.vz -= 1.35 * vn * nz; s.bump = Math.min(1, s.bump + Math.abs(vn) / 12); }
      }
    }
    // dynamic bodies (bowling pins) get pushed
    if (dyn) dyn(s, R);
    // keep inside the sea wall
    const r2 = Math.hypot(s.x, s.z), lim = islandR(Math.atan2(s.z, s.x)) + 4;
    if (r2 > lim) { const nx = s.x / r2, nz = s.z / r2; s.x = nx * lim; s.z = nz * lim; const vn = s.vx * nx + s.vz * nz; if (vn > 0) { s.vx -= 1.4 * vn * nx; s.vz -= 1.4 * vn * nz; } }
    s.vf = vf; s.speed = Math.hypot(s.vx, s.vz);
  }

  let spin = 0, dustT = 0;
  function render(dt, input, time, reduced) {
    g.position.set(s.x, s.inWater ? -0.35 : 0, s.z); g.rotation.y = s.h;
    const targetRoll = -s.yaw * Math.min(1, Math.abs(s.vf) / 10) * 0.09;
    const targetPitch = -input.throttle * 0.035 * (Math.abs(s.vf) < TUNE.maxSpeed - 1 ? 1 : 0.3) + (input.brake ? 0.05 : 0);
    s.roll += (targetRoll - s.roll) * Math.min(1, 8 * dt); s.pitch += (targetPitch - s.pitch) * Math.min(1, 6 * dt);
    s.bump *= Math.exp(-6 * dt);
    const bob = reduced ? 0 : Math.sin(time * 18) * 0.02 * Math.min(1, s.speed / 8) + s.bump * 0.12 * Math.sin(time * 40);
    body.rotation.set(s.pitch, 0, s.roll); body.position.y = bob;
    spin += s.vf * dt / 0.58;
    wheels.forEach((w) => { w.w.rotation.x = spin; if (w.front) w.pivot.rotation.y = input.steer * 0.45; });
    // dust
    dustT -= dt;
    if (!reduced && dustT <= 0 && (s.speed > 9 || (Math.abs(s.yaw) > 1.2 && s.speed > 5))) {
      dustT = 0.045;
      const d = dust[dustI++ % dust.length], side = dustI % 2 ? 1 : -1;
      const bx = s.x - Math.sin(s.h) * 1.4 + Math.cos(s.h) * side, bz = s.z - Math.cos(s.h) * 1.4 - Math.sin(s.h) * side;
      d.m.position.set(bx, 0.3, bz); d.m.scale.setScalar(0.6); d.life = 1; d.m.visible = true; d.m.material.color.set(s.inWater ? '#e3f6df' : '#f69acc');
    }
    dust.forEach((d) => { if (d.life <= 0) return; d.life -= dt * 1.6; d.m.position.y += dt * 0.8; d.m.scale.setScalar(0.6 + (1 - d.life) * 1.6); d.m.material.opacity = Math.max(0, d.life) * 0.7; if (d.life <= 0) d.m.visible = false; });
  }
  return { group: g, state: s, place, step, render };
}
