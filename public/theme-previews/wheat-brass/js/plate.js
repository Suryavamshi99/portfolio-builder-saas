// Hero depth sandwich, adapted from Ada Okafor's assets/strip-DZznrBt_.js plate.
// Ada draws the clip on canvas.stage, the name sits above it, and canvas.cutout redraws the
// figure through a MATTE branch that keys her out of the sky. Nisha's clip is a warehouse
// aisle with no clean sky, so the MATTE branch is replaced by a real alpha texture: 61 frames
// cut out of the same clip with rembg, swapped in step with the video's media time.
// Kept from Ada: one full-screen triangle per canvas, lift/gamma/gain grade, 3-stop palette
// map, halation from mips, 24 fps grain, vignette, idle pointer autopilot after 3 s.
// Dropped: every lens and style layer. Added: the clip is a ping-pong encode (no seam), the
// figure and the room move a few pixels apart with the pointer, and the room is softened
// where she stands so that parallax reads as depth of field, not a double image.
import { gsap, reduced } from './base.js';

const VERT = `#version 300 es
in vec2 p; out vec2 vUv;
void main(){ vUv = p*.5+.5; gl_Position = vec4(p,0.,1.); }`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uV, uC;
uniform vec2 uRes, uPtr;
uniform vec4 uFrame, uCrop;
uniform float uTime, uDpr, uPar, uCutOn;
uniform vec3 uLift, uGamma, uGain, uShadow, uMid, uHigh, uHalCol, uFill;
uniform float uContrast, uSat, uMap, uGrain, uHal, uVig;
uniform vec4 uShade; // right, left, bottom amount, bottom reach

float lum(vec3 c){ return dot(c, vec3(.299,.587,.114)); }
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 cutUv(vec2 fu){ return (fu - uCrop.xy)/uCrop.zw; }
float inBox(vec2 c){ return step(0.,c.x)*step(0.,c.y)*step(c.x,1.)*step(c.y,1.); }

vec3 grade(vec3 c){
  c = pow(max(c + uLift, 0.), 1./max(uGamma, .001)) * uGain;
  c = (c-.5)*uContrast + .5;
  float L = lum(c);
  c = mix(vec3(L), c, uSat);
  vec3 gm = L < .5 ? mix(uShadow, uMid, L*2.) : mix(uMid, uHigh, (L-.5)*2.);
  return mix(c, gm, uMap);
}
vec3 finish(vec3 c){
  vec2 fc = vUv*uRes;
  float gs = max(1., 1.7*uDpr);
  float n = hash(floor(fc/gs) + vec2(floor(uTime*24.)*37.13, floor(uTime*24.)*19.77)) - .5;
  float Lg = lum(c);
  c += n * uGrain * (.4 + 1.2*(1.-abs(Lg-.5)*2.));
  vec2 d = vUv-.5;
  c *= mix(1., smoothstep(.95, .25, length(d)*1.15), uVig);
  // shade, drawn in the shader so the room and the figure darken the same way
  c *= 1. - uShade.x*smoothstep(.42, 1., vUv.x);
  c *= 1. - uShade.y*smoothstep(.58, 0., vUv.x);
  c *= 1. - uShade.z*smoothstep(uShade.w, 0., vUv.y);
  return c;
}

void main(){
  vec2 fu = (vUv - uFrame.xy)/uFrame.zw;
#ifdef CUT
  fu -= uPtr*uPar;
  vec2 cu = cutUv(fu);
  float inside = inBox(cu);
  vec4 t = texture(uC, clamp(cu, 0., 1.));
  float a = t.a*inside*uCutOn;
  if (a < .003){ o = vec4(0.); return; }
  vec3 c = grade(t.rgb/max(t.a,.001));
  c = clamp(finish(c), 0., 1.);
  o = vec4(c*a, a);
#else
  fu += uPtr*uPar*.55;
  vec2 cf = clamp(fu, vec2(.001), vec2(.999));
  vec3 c = textureLod(uV, cf, 0.).rgb;
  // soften the room where the figure stands
  vec2 cu = cutUv(fu);
  float m = textureLod(uC, clamp(cu,0.,1.), 3.).a * inBox(cu) * uCutOn;
  c = mix(c, textureLod(uV, cf, 3.5).rgb, smoothstep(.05,.6,m)*.85);
  // halation
  vec3 b = textureLod(uV, cf, 4.).rgb*.5 + textureLod(uV, cf, 6.).rgb*.5;
  c += uHalCol * max(lum(b)-.42, 0.) * uHal * 1.6;
  // above the top of the frame: carry the shelves' colour up into a dim ceiling
  float upv = max(fu.y - 1., 0.);
  vec3 ceil_ = mix(textureLod(uV, vec2(cf.x, .995), 6.).rgb*.6, uFill, smoothstep(0., .22, upv));
  c = mix(c, ceil_, smoothstep(0., .02, upv));
  c = grade(c);
  o = vec4(finish(c), 1.);
#endif
}`;

const hex = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

function program(canvas, defs, alpha) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha, premultipliedAlpha: true, powerPreference: 'high-performance' });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG.replace('#version 300 es', '#version 300 es\n' + defs)));
  gl.linkProgram(pr); gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const U = new Map(); const u = (n) => { if (!U.has(n)) U.set(n, gl.getUniformLocation(pr, n)); return U.get(n); };
  const tex = (unit) => {
    const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const tV = tex(0), tC = tex(1);
  gl.uniform1i(u('uV'), 0); gl.uniform1i(u('uC'), 1);
  return { gl, u, tV, tC };
}

/**
 * opts: { video, poster, frames:{dir,count,fps,crop:[x,y,w,h],src:[W,H]}, grade, layout(w,h)->{x,y,w,h,shade}, pointerTarget }
 */
export function createPlate(stage, cut, opts) {
  const rm = reduced();
  const P = { ...opts.grade };
  const [SW, SH] = opts.frames.src;
  const A = program(stage, '', false);
  const B = A ? program(cut, '#define CUT 1', true) : null;
  let ready = () => {};
  const api = { ready: new Promise((r) => { ready = r; }), webgl: !!(A && B), rect: { x: 0, y: 0, w: 1, h: 1 }, project: (fx, fy) => [fx, fy], destroy() {} };
  if (!api.webgl) { cut.remove(); ready(); return api; }

  const video = document.createElement('video');
  video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'auto';
  video.setAttribute('muted', ''); video.setAttribute('playsinline', '');
  video.src = opts.video;

  // cut-out frames
  const N = opts.frames.count;
  const imgs = [];
  let loaded = 0;
  const framesReady = new Promise((res) => {
    for (let i = 0; i < N; i++) {
      const im = new Image();
      im.decoding = 'async';
      im.onload = im.onerror = () => { if (++loaded === N) res(); };
      im.src = `${opts.frames.dir}/c${String(i).padStart(3, '0')}.webp`;
      imgs.push(im);
    }
  });

  const upload = (ctx, tex, unit, src) => {
    const gl = ctx.gl; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.generateMipmap(gl.TEXTURE_2D);
  };

  let dpr = 1, W = 1, H = 1, shade = [0, 0, 0, 0.5];
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = stage.getBoundingClientRect();
    W = Math.max(2, r.width); H = Math.max(2, r.height);
    for (const [c, ctx] of [[stage, A], [cut, B]]) {
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      ctx.gl.viewport(0, 0, c.width, c.height);
    }
    const L = opts.layout(W, H);
    api.rect = { x: L.x, y: L.y, w: L.w, h: L.h };
    shade = L.shade;
    opts.onLayout?.(api.rect);
  };
  // frame point (0..1, top-based) -> CSS px in the hero
  api.project = (fx, fy) => [api.rect.x + fx * api.rect.w, api.rect.y + fy * api.rect.h];
  const ro = new ResizeObserver(resize); ro.observe(stage); resize();

  const ptr = { x: 0, y: 0, tx: 0, ty: 0, idle: 0 };
  const target = opts.pointerTarget || stage.parentElement;
  const onMove = (e) => {
    const r = stage.getBoundingClientRect();
    ptr.tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    ptr.ty = Math.max(-1, Math.min(1, -(((e.clientY - r.top) / r.height) * 2 - 1)));
    ptr.idle = 0;
  };
  target.addEventListener('pointermove', onMove, { passive: true });
  target.addEventListener('pointerdown', onMove, { passive: true });

  let vis = true, started = false, cutOn = 0, idx = 0, lastIdx = -1, newFrame = true, t0 = performance.now();
  const io = new IntersectionObserver((es) => {
    vis = es[0]?.isIntersecting ?? true;
    if (!started || rm) return;
    vis ? video.play().catch(() => {}) : video.pause();
  });
  io.observe(stage);

  const frameIndex = (mt) => {
    const D = (video.duration || 10.08) / 2; // ping-pong: forward then the same frames reversed
    const tt = mt % (2 * D);
    const s = tt < D ? tt : 2 * D - tt;
    return Math.max(0, Math.min(N - 1, Math.round(s * opts.frames.fps)));
  };
  const rvfc = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
  const onFrame = (_, meta) => { newFrame = true; idx = frameIndex(meta.mediaTime); video.requestVideoFrameCallback(onFrame); };
  if (rvfc) video.requestVideoFrameCallback(onFrame);

  video.addEventListener('loadeddata', () => {
    video.playbackRate = opts.playbackRate || 0.85;
    if (!rm) video.play().catch(() => {});
    started = true;
  }, { once: true });
  video.load();

  framesReady.then(() => {
    gsap.to({ v: 0 }, { v: 1, duration: rm ? 0 : 1.1, delay: rm ? 0 : 0.6, ease: 'power2.inOut', onUpdate() { cutOn = this.targets()[0].v; } });
  });

  const draw = (ctx, now) => {
    const gl = ctx.gl, u = ctx.u, v3 = (n, a) => gl.uniform3f(u(n), a[0], a[1], a[2]);
    const cw = gl.canvas.width, ch = gl.canvas.height;
    const R = api.rect, C = opts.frames.crop;
    gl.uniform2f(u('uRes'), cw, ch);
    gl.uniform2f(u('uPtr'), ptr.x, ptr.y);
    gl.uniform4f(u('uFrame'), R.x / W, 1 - (R.y + R.h) / H, R.w / W, R.h / H);
    gl.uniform4f(u('uCrop'), C[0] / SW, 1 - (C[1] + C[3]) / SH, C[2] / SW, C[3] / SH);
    gl.uniform1f(u('uTime'), (now - t0) / 1000);
    gl.uniform1f(u('uDpr'), dpr);
    gl.uniform1f(u('uPar'), rm ? 0 : P.parallax);
    gl.uniform1f(u('uCutOn'), cutOn);
    v3('uLift', P.lift); v3('uGamma', P.gamma); v3('uGain', P.gain);
    v3('uShadow', hex(P.map.shadow)); v3('uMid', hex(P.map.mid)); v3('uHigh', hex(P.map.high));
    v3('uHalCol', hex(P.halationColor)); v3('uFill', hex(P.fill));
    gl.uniform1f(u('uContrast'), P.contrast); gl.uniform1f(u('uSat'), P.saturation);
    gl.uniform1f(u('uMap'), P.map.amount); gl.uniform1f(u('uGrain'), rm ? 0 : P.grain);
    gl.uniform1f(u('uHal'), P.halation); gl.uniform1f(u('uVig'), P.vignette);
    gl.uniform4f(u('uShade'), shade[0], shade[1], shade[2], shade[3]);
    if (ctx === B) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  let firstDrawn = false;
  const tick = (time, dtMs) => {
    if (!vis || document.hidden) return;
    const dt = Math.min(0.05, dtMs / 1000);
    const now = performance.now();
    ptr.idle += dt;
    if (ptr.idle > 3 && !rm) { ptr.tx = Math.sin(now / 2600) * 0.5; ptr.ty = Math.sin(now / 3700 + 1.2) * 0.35; }
    const k = 1 - Math.exp(-5 * dt);
    ptr.x += (ptr.tx - ptr.x) * k; ptr.y += (ptr.ty - ptr.y) * k;
    if (video.readyState >= 2 && (newFrame || !rvfc)) {
      if (!rvfc) idx = frameIndex(video.currentTime);
      upload(A, A.tV, 0, video);
      newFrame = false;
    }
    if (idx !== lastIdx && imgs[idx]?.complete && imgs[idx].naturalWidth) {
      upload(A, A.tC, 1, imgs[idx]);
      upload(B, B.tC, 1, imgs[idx]);
      lastIdx = idx;
    }
    if (video.readyState < 2) return;
    draw(A, now); draw(B, now);
    if (!firstDrawn) { firstDrawn = true; ready(); }
  };
  gsap.ticker.add(tick);
  // reduced motion: hold the first frame
  if (rm) video.addEventListener('loadeddata', () => { video.pause(); video.currentTime = 0; }, { once: true });

  api.destroy = () => {
    gsap.ticker.remove(tick); ro.disconnect(); io.disconnect();
    target.removeEventListener('pointermove', onMove); target.removeEventListener('pointerdown', onMove);
    video.pause(); video.removeAttribute('src');
    A.gl.getExtension('WEBGL_lose_context')?.loseContext(); B.gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
  api.video = video;
  return api;
}
