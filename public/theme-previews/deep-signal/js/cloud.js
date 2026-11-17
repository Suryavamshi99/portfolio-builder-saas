// The point cloud. Adapted from Stillwater's stage (gy), pointer (vy), cloud (Ey) and breath (sm) code
// in assets/index-hDvjrczZ.js. Targets changed from sphere → lotus → rings to noise → scatter → fitted line → name,
// and the 4-7-8 breath became a slow sampling cycle. v3b: the first shape is her portrait, sampled from her photo's luminance,
// drawn over the photo itself, which dissolves into dots as the scroll begins.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, Vector2,
  BufferGeometry, BufferAttribute, ShaderMaterial, Points,
  Group, Mesh, PlaneGeometry, Texture, AdditiveBlending, SRGBColorSpace,
} from '../vendor/three.module.min.js';
import { cycleAt, newCycle } from './cycle.js';
export { cycleAt, newCycle };

const RM = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) { return false; }
}

/* ---------- stage: renderer, resize, visibility, adaptive DPR (Stillwater gy) ---------- */
function makeStage(canvas, { maxDpr = 2, fov = 38 } = {}) {
  const reduced = RM();
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  const scene = new Scene();
  const camera = new PerspectiveCamera(fov, 1, 0.1, 200);
  const frames = [], resizers = [], size = { w: 1, h: 1 };
  let dpr = Math.min(window.devicePixelRatio || 1, maxDpr), quality = 1, visible = true, shown = !document.hidden;
  let raf = 0, last = performance.now(), slow = 0, fast = 0;
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    size.w = Math.max(1, Math.round(r.width)); size.h = Math.max(1, Math.round(r.height));
    renderer.setPixelRatio(dpr); renderer.setSize(size.w, size.h, false);
    camera.aspect = size.w / size.h; camera.updateProjectionMatrix();
    resizers.forEach(f => f(size.w, size.h, dpr));
  };
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(e => { visible = e[0] ? e[0].isIntersecting : true; }).observe(canvas);
  document.addEventListener('visibilitychange', () => { shown = !document.hidden; last = performance.now(); });
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    if (!visible || !shown) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const ms = dt * 1000;
    ms > 26 ? slow++ : (slow = Math.max(0, slow - 1));
    ms < 14 ? fast++ : (fast = 0);
    if (slow > 60 && dpr > 1) { dpr = Math.max(1, dpr - 0.5); quality = Math.max(0.5, quality - 0.25); slow = 0; resize(); }
    else if (fast > 240 && dpr < Math.min(window.devicePixelRatio || 1, maxDpr)) { dpr += 0.5; quality = Math.min(1, quality + 0.25); fast = 0; resize(); }
    const t = now / 1000;
    frames.forEach(f => f(t, dt));
    renderer.render(scene, camera);
  };
  resize();
  if (!reduced) raf = requestAnimationFrame(loop);
  return {
    renderer, scene, camera, size, reduced,
    onFrame: f => frames.push(f),
    onResize: f => { resizers.push(f); f(size.w, size.h, dpr); },
    quality: () => quality,
    renderOnce: () => { frames.forEach(f => f(0, 0)); renderer.render(scene, camera); },
  };
}

/* ---------- pointer: damped, with an idle autopilot (Stillwater vy) ---------- */
function makePointer(el, { stiffness = 5, idleAfter = 2.5 } = {}) {
  let idle = 0, clock = 0;
  const p = {
    rx: 0, ry: 0, nx: 0, ny: 0, active: false,
    update(dt) {
      clock += dt; idle += dt;
      if (idle > idleAfter) { p.rx = Math.sin(clock * 0.45) * 0.55; p.ry = Math.sin(clock * 0.31 + 1.3) * 0.4; p.active = false; }
      const k = 1 - Math.exp(-stiffness * dt);
      p.nx += (p.rx - p.nx) * k; p.ny += (p.ry - p.ny) * k;
    },
  };
  const move = (e) => {
    const r = el.getBoundingClientRect();
    p.rx = ((e.clientX - r.left) / r.width) * 2 - 1;
    p.ry = -(((e.clientY - r.top) / r.height) * 2 - 1);
    p.active = true; idle = 0;
  };
  el.addEventListener('pointermove', move, { passive: true });
  el.addEventListener('pointerdown', move, { passive: true });
  return p;
}

/* ---------- seeded random (Stillwater xy) ---------- */
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SLOPE = 0.55;

/* ---------- the four targets ---------- */
function buildTargets(count, namePixels, portrait) {
  const r = rng(909);
  const g = (s) => (r() + r() + r() - 1.5) * 2 * s; // ≈ normal with sd s
  const noise = new Float32Array(count * 3), scatter = new Float32Array(count * 3),
    line = new Float32Array(count * 3), name = new Float32Array(count * 3),
    seed = new Float32Array(count * 4), tint = new Float32Array(count * 4), body = new Uint8Array(count), lum = new Float32Array(count);
  const cum = portrait ? portrait.cum : null, tot = cum ? cum[cum.length - 1] : 0;
  const X0 = -2.2, X1 = 2.2, Y0 = -1.75;
  for (let i = 0; i < count; i++) {
    const i3 = i * 3, i4 = i * 4;
    if (cum) {
      // portrait: pick a pixel with probability by its weight (binary search on the cumulative sum)
      const t = r() * tot; let lo = 0, hi = cum.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < t) lo = mid + 1; else hi = mid; }
      noise[i3] = portrait.xy[lo * 2] + (r() - 0.5) * portrait.px; noise[i3 + 1] = portrait.xy[lo * 2 + 1] + (r() - 0.5) * portrait.px; noise[i3 + 2] = g(0.04);
      lum[i] = portrait.lum[lo];
    } else {
      const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u), rad = 1.7 * Math.cbrt(r());
      noise[i3] = s * Math.cos(a) * rad; noise[i3 + 1] = u * rad; noise[i3 + 2] = s * Math.sin(a) * rad; lum[i] = 0.6;
    }
    const role = r(); // < .05 axis, < .15 band, else body
    const x = X0 + 0.1 + r() * (X1 - X0 - 0.2);
    if (role < 0.05) {
      let ax, ay;
      if (r() < 0.55) { ax = X0 + r() * (X1 - X0); ay = Y0; } else { ax = X0; ay = Y0 + r() * 3.4; }
      scatter[i3] = ax; scatter[i3 + 1] = ay; scatter[i3 + 2] = 0;
      line[i3] = ax; line[i3 + 1] = ay; line[i3 + 2] = 0;
      tint[i4 + 1] = 1; tint[i4 + 2] = 1;
    } else {
      // scatter: y = 0.55x + noise, a thin slab in depth
      const out = r() < 0.025;
      scatter[i3] = x; scatter[i3 + 1] = SLOPE * x + (out ? g(1.1) : g(0.42)); scatter[i3 + 2] = g(0.16);
      if (role < 0.15) {
        // the 95% band edges around the fitted line
        const side = r() < 0.5 ? -1 : 1;
        line[i3] = x; line[i3 + 1] = SLOPE * x + side * (0.17 + 0.045 * x * x) + g(0.012); line[i3 + 2] = g(0.02);
        tint[i4 + 2] = 1;
      } else {
        line[i3] = x; line[i3 + 1] = SLOPE * x + g(0.035); line[i3 + 2] = g(0.03);
        body[i] = out ? 0 : 1;
      }
      if (out) tint[i4 + 1] = 1;
    }
    // name
    if (namePixels && namePixels.length) {
      const k = (Math.floor(r() * namePixels.length / 2)) * 2;
      name[i3] = namePixels[k] + (r() - 0.5) * 0.012; name[i3 + 1] = namePixels[k + 1] + (r() - 0.5) * 0.012; name[i3 + 2] = g(0.05);
    } else {
      name[i3] = line[i3]; name[i3 + 1] = line[i3 + 1]; name[i3 + 2] = line[i3 + 2];
    }
    if (r() < 0.012) tint[i4] = 1;
    if (r() < 0.02) tint[i4 + 3] = 1;
    seed[i4] = r(); seed[i4 + 1] = r(); seed[i4 + 2] = r(); seed[i4 + 3] = r();
  }
  return { count, noise, scatter, line, name, seed, tint, body, lum };
}

/* sample her photo: weight by luminance and edges, inside the cut-out's alpha. Height in world units. */
export const PORTRAIT_H = 3.6;
async function portraitPoints(src) {
  const img = new Image(); img.src = src;
  try { await img.decode(); } catch (e) { return null; }
  const W = 220, H = Math.round(W * img.naturalHeight / img.naturalWidth);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, W, H);
  const d = x.getImageData(0, 0, W, H).data, L = new Float32Array(W * H), A = new Float32Array(W * H);
  for (let k = 0; k < W * H; k++) { L[k] = (0.299 * d[k * 4] + 0.587 * d[k * 4 + 1] + 0.114 * d[k * 4 + 2]) / 255; A[k] = d[k * 4 + 3] / 255; }
  const s = PORTRAIT_H / H, xy = [], lum = [], cum = []; let acc = 0;
  for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
    const k = j * W + i; if (A[k] < 0.5) continue;
    const gx = L[k + 1] - L[k - 1], gy = L[k + W] - L[k - W], edge = Math.min(1, Math.hypot(gx, gy) * 4);
    const face = j < H * 0.36 ? 1.15 : 1; // the head carries more of the likeness
    const w = (0.05 + Math.pow(L[k], 2.2) * 0.8 + edge * 1.4) * face;
    acc += w; cum.push(acc); xy.push((i - W / 2) * s, -(j - H / 2) * s); lum.push(Math.min(1, L[k] * 1.25 + edge * 0.4));
  }
  return { img, xy: Float32Array.from(xy), lum: Float32Array.from(lum), cum: Float32Array.from(cum), px: s, aspect: img.naturalWidth / img.naturalHeight };
}

/* sample the name from a 2D canvas, in world units, centred */
async function namePoints(text, widthUnits) {
  try { await document.fonts.load('italic 400 200px "Cormorant Garamond"'); } catch (e) {}
  const W = 1200, H = 360, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#000000'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = 'italic 400 300px "Cormorant Garamond", "Times New Roman", serif';
  x.fillText(text, W / 2, H / 2 + 10);
  const d = x.getImageData(0, 0, W, H).data, pts = [];
  let minX = W, maxX = 0;
  for (let j = 0; j < H; j += 2) for (let i = 0; i < W; i += 2) {
    if (d[(j * W + i) * 4 + 3] > 140) { pts.push(i, j); if (i < minX) minX = i; if (i > maxX) maxX = i; }
  }
  const s = widthUnits / Math.max(1, maxX - minX), cx = (minX + maxX) / 2, out = new Float32Array(pts.length);
  for (let k = 0; k < pts.length; k += 2) { out[k] = (pts[k] - cx) * s; out[k + 1] = -(pts[k + 1] - H / 2) * s; }
  return out;
}



const CAM = 7;
const VERT = /* glsl */`
uniform float uMorph, uBreath, uTime, uDpr, uSize, uAspect, uPtrPow, uCam;
uniform vec2 uPtr, uTrail, uVel;
attribute vec3 aScatter;
attribute vec3 aLine;
attribute vec3 aName;
attribute vec4 aSeed;
attribute vec4 aTint;
attribute float aLum;
varying float vA;
varying float vDepth;
varying float vTint;

float sm(float x) { x = clamp(x, 0.0, 1.0); return x * x * x * (x * (x * 6.0 - 15.0) + 10.0); }

void main() {
  float m1 = clamp(uMorph, 0.0, 1.0);
  float m2 = clamp(uMorph - 1.0, 0.0, 1.0);
  float m3 = clamp(uMorph - 2.0, 0.0, 1.0);
  // each dot leaves a little after its neighbours, so one shape pours into the next
  float t1 = sm((m1 - aSeed.x * 0.45) / 0.55);
  float t2 = sm((m2 - aSeed.y * 0.45) / 0.55);
  float t3 = sm((m3 - aSeed.z * 0.45) / 0.55);
  vec3 p = mix(mix(mix(position, aScatter, t1), aLine, t2), aName, t3);

  float tr = sin(t1 * 3.14159) * 1.3 + 0.45 * sin(t2 * 3.14159) + sin(t3 * 3.14159);
  float ang = tr * (aSeed.w - 0.5) * 1.6;
  float cs = cos(ang), sn = sin(ang);
  p.xz = mat2(cs, -sn, sn, cs) * p.xz;
  p += (aSeed.wzx - 0.5) * vec3(0.7, 0.5, 0.7) * tr;

  // sampling cycle: the cloud swells as it samples (gently while it is still her portrait)
  float br = uBreath;
  float sw = mix(0.035, 0.12, t1);
  p *= (1.0 - sw * 0.6) + sw * br + (aSeed.w - 0.5) * 0.05 * br * t1;
  p += mix(0.006, 0.014, t1) * vec3(sin(uTime * 0.5 + aSeed.x * 40.0), sin(uTime * 0.43 + aSeed.y * 40.0), sin(uTime * 0.37 + aSeed.z * 40.0));

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float depth = -mv.z;
  vec4 clip = projectionMatrix * mv;
  vec2 ndc = clip.xy / clip.w;

  // a hand in water: a gaussian push around the damped pointer, dragged along its motion,
  // and a wider, lazier swirl trailing behind it
  vec2 asp = vec2(uAspect, 1.0);
  vec2 q = (ndc - uPtr) * asp;
  float d2 = dot(q, q);
  float f = exp(-d2 / 0.03) * uPtrPow;
  vec2 dir = q * inversesqrt(d2 + 0.0001);
  vec2 push = dir * f * 0.085 * (0.55 + 0.9 * aSeed.y) + uVel * f * (0.5 + aSeed.x);
  vec2 q2 = (ndc - uTrail) * asp;
  float d3 = dot(q2, q2);
  float f2 = exp(-d3 / 0.16) * uPtrPow;
  vec2 perp = vec2(-q2.y, q2.x) * inversesqrt(d3 + 0.0001);
  push += perp * f2 * 0.05 * (aSeed.z - 0.35);
  ndc += push / asp;
  gl_Position = vec4(ndc * clip.w, clip.z, clip.w);

  float dn = clamp((depth - (uCam - 2.4)) / 4.8, 0.0, 1.0);
  float sz = uSize * (uCam / depth) * mix(1.25, 0.6, dn) * (0.92 + 0.18 * br) * (0.7 + 0.6 * aSeed.w);
  sz *= 1.0 + f * 0.6;
  float px = sz * uDpr;
  float portraitA = 0.07 + 0.62 * aLum;
  vA = mix(portraitA, mix(0.9, 0.4, dn), t1) * clamp(px / 1.7, 0.45, 1.0);
  vDepth = dn;
  float w0 = 1.0 - t1;
  float w1 = t1 * (1.0 - t2);
  float w2 = t2 * (1.0 - t3);
  vTint = aTint.x * w0 + aTint.y * w1 + aTint.z * w2 + aTint.w * t3 + f * 0.8;
  gl_PointSize = max(px, 1.5);
}`;
const FRAG = /* glsl */`
uniform vec3 uHi, uLow, uSpark;
varying float vA;
varying float vDepth;
varying float vTint;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float d = length(c);
  float core = 1.0 - smoothstep(0.35, 1.0, d);
  if (core < 0.01) discard;
  vec3 col = mix(uHi, uLow, vDepth * 0.8);
  col = mix(col, uSpark, clamp(vTint, 0.0, 1.0));
  gl_FragColor = vec4(col * core * vA, core * vA);
  #include <colorspace_fragment>
}`;
// her photo inside the scene, graded deep-sea to aqua, dissolving into the dots as the scroll begins
const PV = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const PF = /* glsl */`
uniform sampler2D uMap; uniform float uShow, uTime; uniform vec3 uDeep, uHi;
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec4 t = texture2D(uMap, vUv);
  float L = dot(t.rgb, vec3(0.299, 0.587, 0.114));
  vec3 g = mix(uDeep, uHi, smoothstep(0.05, 0.95, L));
  g = mix(g, t.rgb, 0.18);
  float n = h(floor(vUv * vec2(90.0, 145.0)));
  float keep = smoothstep(n - 0.08, n + 0.08, uShow * 1.08);
  float scan = 0.92 + 0.08 * sin(vUv.y * 420.0 + uTime * 2.0);
  gl_FragColor = vec4(g * scan * 1.08, t.a * keep * 0.9);
  #include <colorspace_fragment>
}`;

const ss = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const mix = (a, b, t) => a + (b - a) * t;
const sm5 = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * x * (x * (x * 6 - 15) + 10); };

export async function makeCloud(canvas, { colors, name, photo }) {
  const stage = makeStage(canvas, { maxDpr: 2, fov: 38 });
  const hero = canvas.closest('.hero'), track = canvas.closest('.hero-track');
  const ptr = makePointer(hero, { stiffness: 5 });
  stage.camera.position.set(0, 0, CAM);

  const small = window.innerWidth < 720;
  const total = small ? 16000 : 42000;
  const [namePix, portrait] = await Promise.all([namePoints(name, 4.5), portraitPoints(photo)]);
  const T = buildTargets(total, namePix, portrait);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(T.noise, 3));
  geo.setAttribute('aScatter', new BufferAttribute(T.scatter, 3));
  geo.setAttribute('aLine', new BufferAttribute(T.line, 3));
  geo.setAttribute('aName', new BufferAttribute(T.name, 3));
  geo.setAttribute('aSeed', new BufferAttribute(T.seed, 4));
  geo.setAttribute('aTint', new BufferAttribute(T.tint, 4));
  geo.setAttribute('aLum', new BufferAttribute(T.lum, 1));
  const U = {
    uMorph: { value: 0 }, uBreath: { value: 0.5 }, uTime: { value: 0 }, uDpr: { value: stage.renderer.getPixelRatio() },
    uSize: { value: small ? 2.3 : 2.5 }, uAspect: { value: 1 }, uPtrPow: { value: 0 }, uCam: { value: CAM },
    uPtr: { value: new Vector2() }, uTrail: { value: new Vector2() }, uVel: { value: new Vector2() },
    uHi: { value: new Color(colors.hi) }, uLow: { value: new Color(colors.low) }, uSpark: { value: new Color(colors.spark) },
  };
  const mat = new ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: U, transparent: true, depthTest: false, depthWrite: false, blending: AdditiveBlending });
  const pts = new Points(geo, mat);
  pts.frustumCulled = false;
  const group = new Group();
  let plateU = null;
  if (portrait) {
    const tex = new Texture(portrait.img); tex.colorSpace = SRGBColorSpace; tex.needsUpdate = true;
    plateU = { uMap: { value: tex }, uShow: { value: 1 }, uTime: { value: 0 }, uDeep: { value: new Color(colors.deep) }, uHi: { value: new Color(colors.low) } };
    const plate = new Mesh(new PlaneGeometry(PORTRAIT_H * portrait.aspect, PORTRAIT_H), new ShaderMaterial({ vertexShader: PV, fragmentShader: PF, uniforms: plateU, transparent: true, depthTest: false, depthWrite: false }));
    plate.position.z = -0.05; plate.renderOrder = 0; pts.renderOrder = 1;
    group.add(plate);
  }
  group.add(pts);
  stage.scene.add(group);

  let aspect = 1, visW = 1, visH = 1;
  stage.onResize((w, h, dpr) => {
    aspect = w / h; U.uAspect.value = aspect; U.uDpr.value = dpr;
    visH = 2 * CAM * Math.tan((38 * Math.PI) / 360); visW = visH * aspect;
  });

  let progress = 0;
  if (track && !stage.reduced && window.ScrollTrigger) {
    window.ScrollTrigger.create({ trigger: track, start: 'top top', end: 'bottom bottom', onUpdate: (st) => { progress = st.progress; } });
  }

  // 600 sampled dots for the live r² readout
  const probe = [];
  { const r = rng(42); while (probe.length < 600) { const i = Math.floor(r() * total); if (T.body[i]) probe.push(i); } }
  const r2At = (m) => {
    const m1 = Math.min(1, Math.max(0, m)), m2 = Math.min(1, Math.max(0, m - 1)), m3 = Math.min(1, Math.max(0, m - 2));
    let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0; const n = probe.length;
    for (const i of probe) {
      const s = T.seed, i3 = i * 3, i4 = i * 4;
      const t1 = sm5((m1 - s[i4] * 0.45) / 0.55), t2 = sm5((m2 - s[i4 + 1] * 0.45) / 0.55), t3 = sm5((m3 - s[i4 + 2] * 0.45) / 0.55);
      const x = mix(mix(mix(T.noise[i3], T.scatter[i3], t1), T.line[i3], t2), T.name[i3], t3);
      const y = mix(mix(mix(T.noise[i3 + 1], T.scatter[i3 + 1], t1), T.line[i3 + 1], t2), T.name[i3 + 1], t3);
      sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
    }
    const cov = sxy / n - (sx / n) * (sy / n), vx = sxx / n - (sx / n) ** 2, vy = syy / n - (sy / n) ** 2;
    return vx > 0 && vy > 0 ? (cov * cov) / (vx * vy) : 0;
  };

  const ticks = [], cyc = newCycle(), state = { morph: 0, cycle: cyc, dt: 0, drawn: total, total, r2: 0 };
  let clock = 0, morph = 0, lastX = 0, lastY = 0, vx = 0, vy = 0, pow = 0, drawn = total, r2Clock = 0;
  const fixedMorph = stage.reduced ? 0 : null;

  stage.onFrame((t, dt) => {
    ptr.update(dt);
    clock += dt; U.uTime.value = clock;
    if (stage.reduced) { cyc.v = 0.6; cyc.phase = 1; cyc.f = 0.3; cyc.left = 3; } else cycleAt(clock, cyc);
    U.uBreath.value = cyc.v;
    const target = fixedMorph != null ? fixedMorph : Math.min(1, Math.max(0, (progress - 0.03) / 0.88)) * 3;
    morph = fixedMorph != null ? fixedMorph : morph + (target - morph) * (dt > 0 ? 1 - Math.exp(-2.6 * dt) : 0);
    U.uMorph.value = morph;
    if (plateU) { plateU.uShow.value = 1 - ss(morph / 0.6); plateU.uTime.value = clock; }

    if (dt > 0) {
      const k = 1 - Math.exp(-2.2 * dt);
      U.uTrail.value.x += (ptr.nx - U.uTrail.value.x) * k; U.uTrail.value.y += (ptr.ny - U.uTrail.value.y) * k;
      const ax = (ptr.nx - lastX) / dt, ay = (ptr.ny - lastY) / dt, k2 = 1 - Math.exp(-5 * dt);
      vx += (ax * 0.05 - vx) * k2; vy += (ay * 0.05 - vy) * k2;
      const cap = 0.16;
      U.uVel.value.set(Math.max(-cap, Math.min(cap, vx)), Math.max(-cap, Math.min(cap, vy)));
      pow += ((ptr.active ? 1 : 0.6) - pow) * (1 - Math.exp(-2 * dt));
    } else pow = 0;
    lastX = ptr.nx; lastY = ptr.ny;
    U.uPtr.value.set(ptr.nx, ptr.ny);
    U.uPtrPow.value = stage.reduced ? 0 : pow;

    // layout: wide screens put the shapes right of centre, tall screens put them under the copy
    const W = ss((aspect - 0.85) / 0.4);
    const k1 = ss(Math.min(1, morph)), k3 = ss(Math.max(0, morph - 2));
    const sP = mix(Math.min(0.62 * visH / PORTRAIT_H, 0.98 * visW / 2.4), 0.94 * visH / PORTRAIT_H, W);
    const sC = mix(0.9 * visW / 4.4, Math.min(0.5 * visW / 4.4, 0.72 * visH / 3.5), W);
    const sN = mix(0.9 * visW / 4.5, 0.6 * visW / 4.5, W);
    group.scale.setScalar(mix(mix(sP, sC, k1), sN, k3));
    const xP = W * visW * 0.17, xC = W * visW * 0.2, xN = W * visW * 0.12;
    const yP = mix(-0.17 * visH, -0.03 * visH, W), yC = mix(-0.2 * visH, 0.02 * visH, W), yN = mix(-0.16 * visH, 0.04 * visH, W);
    group.position.set(mix(mix(xP, xC, k1), xN, k3) + ptr.nx * 0.05, mix(mix(yP, yC, k1), yN, k3) + ptr.ny * 0.03, 0);
    group.rotation.y = Math.sin(clock * 0.21) * 0.12 * (1 - k1) + ptr.nx * 0.1;
    group.rotation.x = -ptr.ny * 0.05;

    // more samples drawn as the cycle swells; fewer when the device struggles
    const q = stage.quality();
    const base = Math.min(total, Math.max(8000, Math.floor(total * (0.4 + 1.2 * (q - 0.5)))));
    const n = Math.floor(base * (0.8 + 0.2 * cyc.v));
    if (n !== drawn) { drawn = n; geo.setDrawRange(0, drawn); }

    r2Clock += dt;
    if (r2Clock > 0.12 || dt === 0) { r2Clock = 0; state.r2 = r2At(morph); }
    state.morph = morph; state.dt = dt; state.drawn = drawn;
    for (let i = 0; i < ticks.length; i++) ticks[i](state);
  });

  if (stage.reduced) {
    const again = () => requestAnimationFrame(() => stage.renderOnce());
    again(); stage.onResize(again);
  }
  return { onTick: (f) => ticks.push(f), state, total, renderOnce: stage.renderOnce };
}
