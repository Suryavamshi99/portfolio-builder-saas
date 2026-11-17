/* ==========================================================================
   plate.js — the treated media plate (WebGL2)
   Adapted from the shared plate engine in the Halden and Kai Moreno reference
   bundles (halden/assets/index-CESfXTID.js, kai-moreno/assets/sections-*.js):
   one full-screen triangle, two copies of the clip cross-faded so the loop seam
   never shows, then grade, palette map, halation, aberration, grain, vignette.

   Added for this site:
   - lens mode "blueprint": inside the lens the scene is redrawn as line art
     (Sobel edges) in signal blue on paper with a drafting grid and hatching —
     "see the product, then see underneath it".
   - uScan: an intro sweep that draws the blueprint across the frame once.
   - external pointer: the page drives the lens (waypoint tour, touch drag)
     through plate.pointer(x, y, on) in -1..1 space.
   ========================================================================== */
(function () {
  const hex = (h) => {
    const r = h.replace('#', ''), n = parseInt(r.length === 3 ? r.split('').map((d) => d + d).join('') : r, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };

  const VERT = `#version 300 es
in vec2 p; out vec2 vUv;
void main(){ vUv = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }`;

  const FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uA, uB, uP;
uniform float uPost;
uniform vec2 uRes, uVid, uFocus, uPtr;
uniform float uZoom, uMix, uTime, uDpr, uFade;
uniform vec3 uLift, uGamma, uGain, uShadow, uMid, uHigh, uHalCol, uPaper, uInk, uMark;
uniform float uContrast, uSat, uMap, uGrain, uGrainSize, uHal, uAb, uVig, uDepth, uLensR, uPtrOn, uScan;
uniform int uLens;

// video A/B crossfade, with the poster frame on top until the video is playing
vec3 src(vec2 uv, float lod){ vec3 v = mix(textureLod(uA, uv, lod).rgb, textureLod(uB, uv, lod).rgb, uMix); return uPost > 0.001 ? mix(v, textureLod(uP, uv, lod).rgb, uPost) : v; }
float lum(vec3 c){ return dot(c, vec3(.299,.587,.114)); }
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }

// Blueprint: Sobel edges on luminance, drawn in signal blue on paper,
// with a drafting grid and diagonal hatching in the shadows.
vec3 blueprint(vec2 uv, vec2 fc){
  vec2 px = 1.25/uVid;
  float tl = lum(src(uv+vec2(-px.x, px.y), .6)), tc = lum(src(uv+vec2(0., px.y), .6)), tr = lum(src(uv+vec2(px.x, px.y), .6));
  float ml = lum(src(uv+vec2(-px.x, 0.), .6)),                                       mr = lum(src(uv+vec2(px.x, 0.), .6));
  float bl = lum(src(uv+vec2(-px.x,-px.y), .6)), bc = lum(src(uv+vec2(0.,-px.y), .6)), br = lum(src(uv+vec2(px.x,-px.y), .6));
  float gx = -tl - 2.*ml - bl + tr + 2.*mr + br;
  float gy = -bl - 2.*bc - br + tl + 2.*tc + tr;
  float g = length(vec2(gx, gy));
  float line = smoothstep(.10, .34, g);
  float L = lum(src(uv, 1.5));
  float cell = 22.*uDpr;
  vec2 gp = fc/cell;
  float minor = max(step(fract(gp.x), .045), step(fract(gp.y), .045));
  float major = max(step(fract(gp.x/5.), .012), step(fract(gp.y/5.), .012));
  float hatch = step(.62, fract((fc.x + fc.y)/(5.*uDpr))) * smoothstep(.36, .12, L);
  float ink = clamp(line*.95 + hatch*.32 + minor*.07 + major*.16, 0., 1.);
  return mix(uPaper, uInk, ink);
}

void main(){
  float ar = uRes.x/uRes.y, vr = uVid.x/uVid.y;
  vec2 s = ar > vr ? vec2(1., vr/ar) : vec2(ar/vr, 1.);
  vec2 uv = (vUv-.5)*s/uZoom + uFocus;
  vec2 fc = vUv*uRes;

  // pointer parallax: luminance as cheap depth (bright areas move more)
  float l0 = lum(src(uv, 1.));
  uv += uPtr*uDepth*(l0-.35);

  // radial chromatic aberration
  vec2 d = (vUv-.5);
  vec2 ab = d*uAb*(.4+dot(d,d)*3.);
  vec3 c = vec3(src(uv+ab,0.).r, src(uv,0.).g, src(uv-ab,0.).b);

  // halation: mips 4 and 6 as a free blur, highlights only, tinted
  if (uHal > 0.001){
    vec3 b = src(uv,4.)*.5 + src(uv,6.)*.5;
    c += uHalCol * max(lum(b)-.42, 0.) * uHal * 1.6;
  }

  // grade: lift/gamma/gain -> contrast -> saturation -> 3-stop palette map
  c = pow(max(c + uLift, 0.), 1./max(uGamma, .001)) * uGain;
  c = (c-.5)*uContrast + .5;
  float L = lum(c);
  c = mix(vec3(L), c, uSat);
  if (uMap > 0.){
    vec3 gm = L < .5 ? mix(uShadow, uMid, L*2.) : mix(uMid, uHigh, (L-.5)*2.);
    c = mix(c, gm, uMap);
  }

  // lens mask around the (smoothed) pointer, aspect-corrected
  float lens = 0.;
  vec2 q = (vUv - (uPtr*.5+.5)); q.x *= ar;
  float dd = length(q);
  if (uLens > 0 && uPtrOn > 0.){ lens = smoothstep(uLensR, uLensR*.94, dd) * uPtrOn; }

  // intro scan: a band sweeps left to right and leaves the drawing behind it for a moment
  float scan = 0.;
  if (uScan > -.5){
    float x = vUv.x - uScan;
    scan = smoothstep(-.32, 0., x) * (1. - smoothstep(0., .004, x));
  }

  float bpMix = max(lens, scan*.92);
  if (bpMix > .001){
    vec3 bp = blueprint(uv, fc);
    c = mix(c, bp, bpMix);
  }
  if (uScan > -.5){ c += uMark * (1. - smoothstep(0., .003, abs(vUv.x - uScan))) * .9; }

  // lens rim: thin ink ring plus a soft outer shadow so the window reads as glass
  if (uLens > 0 && uPtrOn > 0.){
    float rim = smoothstep(uLensR*1.012, uLensR, dd) * (1. - smoothstep(uLensR, uLensR*.985, dd));
    c = mix(c, uInk, rim*.85*uPtrOn);
    float sh = smoothstep(uLensR*1.18, uLensR, dd) * (1. - lens);
    c *= 1. - sh*.28*uPtrOn;
  }

  // grain: 24fps hashed, luminance weighted (strongest in the mids)
  float gs = max(1., floor(uGrainSize*uDpr + .5));
  float tq = floor(uTime*24.);
  float n = hash(floor(fc/gs) + vec2(tq*17.31, tq*7.13)) - .5;
  float Lg = lum(c);
  c += n * uGrain * (.4 + 1.2*(1.-abs(Lg-.5)*2.));

  // vignette
  float v = smoothstep(.95, .25, length(d)*1.15);
  c *= mix(1., v, uVig * (1. - lens));

  o = vec4(c * uFade, 1.);
}`;

  const LENS = { none: 0, blueprint: 4 };

  /**
   * createPlate(canvas, opts) -> controller
   * opts.src: video (.mp4) or image path. opts.poster for fallbacks.
   * opts.onFirstFrame(): called once the first decoded frame has been drawn.
   */
  function createPlate(canvas, opts) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let a = Object.assign({
      focus: [0.5, 0.5], zoom: 1, playbackRate: 1, crossfade: true,
      lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1], contrast: 1.05, saturation: 1,
      map: null, grain: 0.06, grainSize: 1.6, halation: 0.3, halationColor: '#4dc4ff',
      aberration: 0.0015, vignette: 0.35, depth: 0.012, lens: 'blueprint', lensRadius: 0.12,
      paper: '#eaf2f4', ink: '#f0632f', mark: '#4dc4ff', breathe: true,
    }, opts);
    const isImg = /\.(jpe?g|png|webp|avif)(\?.*)?$/i.test(a.src);
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });

    // ---- Fallback: no WebGL2 -> poster/image with a CSS grade
    if (!gl) {
      const img = new Image();
      img.src = a.poster || a.src; img.alt = '';
      img.className = 'plate-fallback';
      canvas.replaceWith(img);
      a.onFirstFrame && a.onFirstFrame();
      return { webgl: false, set() {}, pointer() {}, scan() {}, destroy() {} };
    }

    const mkVideo = () => {
      const v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
      v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
      v.src = a.src; return v;
    };
    const vA = isImg ? null : mkVideo();
    const vB = isImg || !a.crossfade ? null : mkVideo();
    const img = isImg ? new Image() : null;
    let imgReady = false;

    const sh = (type, srcTxt) => {
      const s = gl.createShader(type); gl.shaderSource(s, srcTxt); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog); gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    const U = {}; const u = (n) => U[n] || (U[n] = gl.getUniformLocation(prog, n));
    const mkTex = (unit) => {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([20, 22, 28, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    const tA = mkTex(0), tB = mkTex(1), tP = mkTex(2);
    gl.uniform1i(u('uA'), 0); gl.uniform1i(u('uB'), 1); gl.uniform1i(u('uP'), 2);
    const upload = (tex, unit, el) => {
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el);
      gl.generateMipmap(gl.TEXTURE_2D);
    };

    // pointer state, smoothed every frame: x += (tx - x) * (1 - exp(-k dt))
    const P = { x: 0, y: 0, tx: 0, ty: 0, on: 0, ton: 0, k: 9 };
    let scanX = -1, fade = 0, firstDone = false, started = false;
    // poster first: drawn through the plate on first paint, the video fades in over it when it plays
    let vidSeen = false;
    let posterReady = false, post = 1, pw = 0, ph = 0;
    if (!isImg && a.poster) {
      const pi = new Image(); pi.decoding = 'async';
      pi.onload = () => { upload(tP, 2, pi); pw = pi.naturalWidth; ph = pi.naturalHeight; posterReady = true; };
      pi.src = a.poster;
    } else post = 0;

    if (isImg) {
      img.decoding = 'async';
      img.onload = () => { upload(tA, 0, img); upload(tB, 1, img); imgReady = true; };
      img.src = a.src;
    } else {
      const start = () => {
        if (started) return; started = true;
        vA.playbackRate = a.playbackRate;
        if (vB && tail) { vB.playbackRate = a.playbackRate; vA.loop = vB.loop = false; }
        else if (vB) { vB.playbackRate = a.playbackRate; if (isFinite(vA.duration)) vB.currentTime = vA.duration / 2; }
        if (!reduce) { vA.play().catch(() => {}); vB && !tail && vB.play().catch(() => {}); }
      };
      vA.addEventListener('loadedmetadata', start);
      vA.load(); vB && vB.load();
    }

    // crossfade: 'tail' (Daimyo) fades to a fresh copy only over the last moments of the clip,
    // so a moving subject is never double-exposed; true (sin² weights) suits slow scenes.
    const tail = a.crossfade === 'tail';
    let act = vA, oth = vB;

    let dpr = 1;
    const resize = () => {
      dpr = Math.min(devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1.5 : 2);
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(2, Math.round(r.width * dpr));
      canvas.height = Math.max(2, Math.round(r.height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    const ro = new ResizeObserver(resize); ro.observe(canvas); resize();

    let visible = true;
    const io = new IntersectionObserver((es) => {
      visible = es[es.length - 1].isIntersecting;
      if (!vA) return;
      if (visible && !reduce) { if (tail) act.play().catch(() => {}); else { vA.play().catch(() => {}); vB && vB.play().catch(() => {}); } }
      else { vA.pause(); vB && vB.pause(); }
    });
    io.observe(canvas);

    const t0 = performance.now();
    let last = t0, dead = false;
    const frame = (now) => {
      if (dead) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!visible || document.hidden) return;
      const k = 1 - Math.exp(-P.k * dt);
      P.x += (P.tx - P.x) * k; P.y += (P.ty - P.y) * k;
      P.on += (P.ton - P.on) * (1 - Math.exp(-6 * dt));

      let ready = false, vidOn = false;
      if (isImg) ready = imgReady;
      else {
        const A = tail ? act : vA, B = tail ? oth : vB;
        if (A.readyState >= 2 && (reduce || A.currentTime > 0 || started && tail && vidSeen)) {
          upload(tA, 0, A); ready = vidOn = true; vidSeen = true;
          if (B && B.readyState >= 2 && (!tail || !B.paused)) upload(tB, 1, B);
        }
        if (posterReady) ready = true;
      }
      if (!ready) return;
      if (!isImg) post = vidOn && (now - t0) / 1000 > (a.holdPoster || 0) ? (reduce ? 0 : Math.max(0, post - dt / 0.9)) : (posterReady ? 1 : 0);
      if (!firstDone) { firstDone = true; a.onFirstFrame && a.onFirstFrame(); }
      fade += (1 - fade) * (1 - Math.exp(-2.4 * dt));

      // seamless loop: whichever copy is near its loop point is faded out
      let mix = 0;
      if (tail && vB && isFinite(act.duration) && act.duration > 0 && !reduce) {
        const D = act.duration, f = Math.min(0.7, D / 6), rem = D - act.currentTime;
        if (rem < f && oth.paused) { oth.currentTime = 0; oth.play().catch(() => {}); }
        if (!oth.paused && oth.readyState >= 2) { const x = Math.min(1, Math.max(0, 1 - rem / f)); mix = x * x * (3 - 2 * x); }
        if (act.ended || rem < 0.04) { act.pause(); const tmp = act; act = oth; oth = tmp; mix = 0; upload(tA, 0, act); }
      } else if (!tail && vB && vB.readyState >= 2 && isFinite(vA.duration) && vA.duration > 0) {
        const D = vA.duration;
        const wa = Math.pow(Math.sin(Math.PI * ((vA.currentTime % D) / D)), 2);
        const wb = Math.pow(Math.sin(Math.PI * ((vB.currentTime % D) / D)), 2);
        mix = wb / Math.max(1e-4, wa + wb);
      }
      const t = (now - t0) / 1000;
      const c3 = (n, v) => gl.uniform3f(u(n), v[0], v[1], v[2]);
      const m = a.map;
      gl.uniform2f(u('uRes'), canvas.width, canvas.height);
      gl.uniform2f(u('uVid'), isImg ? img.naturalWidth : vA.videoWidth || pw || 1280, isImg ? img.naturalHeight : vA.videoHeight || ph || 960);
      gl.uniform2f(u('uFocus'), a.focus[0], a.focus[1]);
      gl.uniform2f(u('uPtr'), P.x, P.y);
      // slow breathing push-in so even a still keeps moving
      const breathe = a.breathe ? (1.03 + 0.025 * Math.sin(t * 0.17)) : 1;
      gl.uniform1f(u('uZoom'), a.zoom * (isImg ? breathe : 1));
      gl.uniform1f(u('uMix'), mix);
      gl.uniform1f(u('uPost'), post);
      gl.uniform1f(u('uTime'), t);
      gl.uniform1f(u('uDpr'), dpr);
      gl.uniform1f(u('uFade'), fade);
      c3('uLift', a.lift); c3('uGamma', a.gamma); c3('uGain', a.gain);
      c3('uShadow', m ? hex(m.shadow) : [0, 0, 0]); c3('uMid', m ? hex(m.mid) : [0.5, 0.5, 0.5]); c3('uHigh', m ? hex(m.high) : [1, 1, 1]);
      c3('uHalCol', hex(a.halationColor)); c3('uPaper', hex(a.paper)); c3('uInk', hex(a.ink)); c3('uMark', hex(a.mark));
      gl.uniform1f(u('uContrast'), a.contrast); gl.uniform1f(u('uSat'), a.saturation);
      gl.uniform1f(u('uMap'), m ? m.amount : 0);
      gl.uniform1f(u('uGrain'), a.grain); gl.uniform1f(u('uGrainSize'), a.grainSize);
      gl.uniform1f(u('uHal'), a.halation); gl.uniform1f(u('uAb'), a.aberration);
      gl.uniform1f(u('uVig'), a.vignette); gl.uniform1f(u('uDepth'), a.depth);
      gl.uniform1f(u('uLensR'), a.lensRadius); gl.uniform1f(u('uPtrOn'), P.on);
      gl.uniform1f(u('uScan'), scanX);
      gl.uniform1i(u('uLens'), LENS[a.lens] || 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    // One clock: the plate renders from gsap.ticker when GSAP is present.
    const tick = () => frame(performance.now());
    let raf = 0;
    if (window.gsap) gsap.ticker.add(tick);
    else { const loop = (n) => { raf = requestAnimationFrame(loop); frame(n); }; raf = requestAnimationFrame(loop); }

    return {
      webgl: true,
      video: vA,
      set(n) { a = Object.assign(a, n); if (n.playbackRate && vA) { vA.playbackRate = n.playbackRate; vB && (vB.playbackRate = n.playbackRate); } },
      /** Lens position in -1..1 (y up); on 0..1; k = smoothing rate */
      pointer(x, y, on, k) { P.tx = x; P.ty = y; if (on != null) P.ton = on; if (k) P.k = k; },
      jump(x, y) { P.x = P.tx = x; P.y = P.ty = y; },
      scan(x) { scanX = x; },
      destroy() {
        dead = true; window.gsap && gsap.ticker.remove(tick); cancelAnimationFrame(raf);
        ro.disconnect(); io.disconnect();
        if (vA) { vA.pause(); vA.removeAttribute('src'); vB && (vB.pause(), vB.removeAttribute('src')); }
        const ext = gl.getExtension('WEBGL_lose_context'); ext && ext.loseContext();
      },
    };
  }

  /** Map a point in source space (0..1, top-left origin) to CSS px in a W x H box (cover-fit, same maths as the shader). */
  function mapCover(vx, vy, W, H, vw, vh, focus, zoom) {
    const ar = W / H, vr = vw / vh;
    const s = ar > vr ? [1, vr / ar] : [ar / vr, 1];
    const px = (vx - focus[0]) * zoom / s[0] + 0.5;
    const py = ((1 - vy) - focus[1]) * zoom / s[1] + 0.5;
    return [px * W, (1 - py) * H];
  }

  window.Plate = { create: createPlate, mapCover };
})();
