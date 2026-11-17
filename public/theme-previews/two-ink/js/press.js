/* ==========================================================================
   press.js — the two WebGL2 layers of the site.

   1. RisoPlate: the hero "plate". A video (or still) is printed as a two-ink
      risograph on paper, every frame. Adapted from Presswork's riso simulator
      (presswork/assets/index-CJ82Fve4.js @163k): paper mottle and fibres,
      screened inks multiplied as an overprint, a roller pass that lays down
      a new registration, ink speckle bursts, drag-to-misregister with a spring.
      Changed for this site: ink A is the clip's darkness, ink B its warmth
      (the orange backdrop on Zubin's set); an ink flood intro; and the lens is
      the Blotter metaball field — inside the blobs you see the unprinted
      shoot in full colour, with grade, halation and chromatic aberration.
      Two copies of the clip crossfade (sin² weights) so the loop never shows.

   2. InkField: Blotter's page-wide metaball "ink" (blotter/assets/index-
      CMPW9oPT.js @598k, function YM). A fixed canvas with mix-blend-mode:
      difference. Blobs shed from the pointer, three ambient blobs orbit the
      hero word, a click splashes. Over the hero the overlay is pure white, and
      the plate pre-inverts its lens, so the difference blend turns the lens
      back into clean footage while the type on top is inverted. Elsewhere,
      over paper, a blob reads as ink A with an ink-B rim.

   Both layers read the same blob list, so the lens and the overlay line up.
   One clock: everything is driven from gsap.ticker (see core.js).
   ========================================================================== */
(function () {
  const N = 40; // max blobs
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hex = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

  /* ---------- shared GLSL: the metaball field (Blotter, units = viewport heights) ---------- */
  const FIELD = `
  uniform vec3 uBalls[${N}];
  uniform float uVh, uTime;
  float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
  // q: viewport css px. returns field distance f (<0 inside) and its gradient g
  float field(vec2 q, out vec2 g){
    vec2 p = q/uVh; float S = 0.; vec2 G = vec2(0.); const float K = .034;
    for (int i = 0; i < ${N}; i++){
      vec3 b = uBalls[i]; if (b.z <= .002) continue;
      vec2 v = p - b.xy; float l = length(v) + 1e-4; float d = l - b.z;
      if (d > .45) continue;
      float e = exp(-d/K); S += e; G += e*(v/l);
    }
    float f = .7; g = vec2(0.);
    if (S > 1e-9){ f = -K*log(S); g = G/S; }
    f += (vnoise(p*15. + vec2(uTime*.25, -uTime*.2)) - .5)*.013;
    return f;
  }`;

  const VERT = `#version 300 es
  in vec2 p; out vec2 vUv; void main(){ vUv = p*.5+.5; gl_Position = vec4(p,0.,1.); }`;

  /* ---------- the riso plate fragment shader ---------- */
  const PLATE_FRAG = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uA, uB;
  uniform vec2 uRes, uVid, uFocus, uPtr, uOff, uOrigin, uCss;
  uniform sampler2D uS; uniform float uVidOn;
  uniform float uZoom, uMix, uDpr, uScroll, uPassX, uFlood, uDepth, uInkK, uBurst, uSeed, uBallsOn, uIsImg;
  uniform vec4 uFade; uniform vec2 uFadeDir;   // amount, offset, from, to: the print fades to paper where the copy sits
  uniform vec3 uPaper, uInkA, uInkB;
  ${FIELD}
  // the poster still prints from first paint; the video fades in over it once it is decoding
  vec3 raw(vec2 uv, float lod){ vec2 c = clamp(uv, 0., 1.); vec3 v = mix(textureLod(uA, c, lod).rgb, textureLod(uB, c, lod).rgb, uMix); return mix(textureLod(uS, c, lod).rgb, v, uVidOn); }
  float lum(vec3 c){ return dot(c, vec3(.299,.587,.114)); }
  // ink A: how dark the frame is. ink B: how warm (the orange backdrop, skin, food)
  float densA(vec2 uv, float lod){ return smoothstep(.5, .98, 1. - lum(raw(uv, lod))); }
  // ink B prints redness: Zubin's red shirt and skin, not the brown cafe or the white ring light
  float densB(vec2 uv, float lod){ vec3 c = raw(uv, lod); return smoothstep(.1, .34, c.r - max(c.g, c.b))*.85; }
  mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c,-s,s,c); }
  float screenDot(vec2 fc, float d, float cell, float ang){
    vec2 f = fract((rot(ang)*fc)/cell) - .5; float r = sqrt(clamp(d,0.,1.))*.62; float aa = 1.1/cell;
    return smoothstep(r+aa, r-aa, length(f)); }
  void main(){
    float ar = uRes.x/uRes.y, vr = uVid.x/uVid.y;
    vec2 s = ar > vr ? vec2(1., vr/ar) : vec2(ar/vr, 1.);
    float zoom = uZoom*(1. + uIsImg*(.04 + .03*sin(uTime*.17)));   // stills breathe slowly
    vec2 uv = (vUv-.5)*s/zoom + uFocus;
    vec2 fc = vUv*uRes; float dpr = uDpr;

    // scroll: the sheet turns and zooms a little, and the two plates separate
    vec2 rel = (uv - uFocus)*vec2(vr,1.); rel = rot(-uScroll*.1)*rel/(1. + uScroll*.14); uv = uFocus + rel/vec2(vr,1.);
    vec2 sep = vec2(0., .05*uScroll);
    // pointer parallax with luminance as cheap depth
    float l0 = lum(raw(uv, 2.)); uv += uPtr*uDepth*(l0 - .35);

    // roller pass, sweeping left to right, slightly diagonal
    float sw = vUv.x + (vUv.y-.5)*.14;
    float live = (uPassX > -.5 && uPassX < 1.6) ? 1. : 0.;
    float swept = live > .5 ? smoothstep(uPassX+.012, uPassX-.012, sw) : 1.;
    float wet = live*exp(-max(0., uPassX - sw)*7.)*swept;
    float band = live*exp(-pow((sw-uPassX)/.016, 2.));

    vec2 uvA = uv - sep, uvB = uv - uOff + sep;
    float k = uInkK*(1. + .25*wet);
    float dA = densA(uvA, 0.)*k;
    float cA = max(screenDot(fc, dA, 3.8*dpr, .2618), smoothstep(.72, .95, dA));
    float dB = densB(uvB, 1.)*k;
    float cB = screenDot(fc, dB, 5.2*dpr, 1.309)*smoothstep(.04, .16, dB);
    float mott = .86 + .14*vnoise(fc/(2.2*dpr)); float speck = 1. - .55*smoothstep(.93,.99, hash(floor(fc/(1.2*dpr))));
    cA *= mott*speck; cB *= (.9 + .1*vnoise(fc/(2.8*dpr)+9.))*speck;

    // paper: slow mottle and fibres
    vec3 col = uPaper*(1. - .05*vnoise(fc/(46.*dpr)) - .03*vnoise(fc/(7.*dpr)));
    vec2 pc = fc/(34.*dpr); vec2 id = floor(pc);
    if (hash(id) > .8){ vec2 ctr = vec2(.2+.6*hash(id+7.), .2+.6*hash(id+13.)); float a = hash(id+3.)*6.2832;
      vec2 d = fract(pc)-ctr; vec2 dir = vec2(cos(a), sin(a)); float t = clamp(dot(d,dir), -.14, .14);
      col *= 1. - .2*smoothstep(.012, 0., length(d - dir*t)); }
    float fd = uFade.x*(1. - smoothstep(uFade.z, uFade.w, dot(vUv, uFadeDir) + uFade.y));
    cA *= 1. - fd; cB *= 1. - fd*.9;
    vec3 print = col*mix(vec3(1.), uInkA, clamp(cA,0.,1.))*mix(vec3(1.), uInkB, clamp(cB,0.,1.));

    // ink speckle burst just behind the roller
    if (uBurst > .01){ vec2 sc = fc/(3.*dpr); vec2 sid = floor(sc);
      float near = exp(-abs(sw - uPassX)*5.)*step(sw, uPassX+.02);
      if (hash(sid + uSeed*3.1) > 1. - .014*uBurst*near){ float rr = .18+.3*hash(sid+5.);
        print *= mix(vec3(1.), hash(sid+9.) > .55 ? uInkB : uInkA, smoothstep(rr, rr-.08, length(fract(sc)-.5))*.9); } }

    // intro: ink A floods the sheet first; the first roller pass prints over it
    float edge = vUv.x*.85 + vUv.y*.35 + (vnoise(fc/(60.*dpr)) - .5)*.25;
    float flooded = smoothstep(edge+.03, edge-.03, uFlood*1.6 - .2);
    vec3 floodCol = col*mix(vec3(1.), uInkA, .92*flooded);
    col = mix(floodCol, print, swept);
    col *= 1. - .085*band; col += .035*exp(-pow((sw-uPassX-.02)/.006, 2.))*live;

    // the lens: Blotter blobs. Inside them, the shoot as it really looked, unprinted
    vec2 q = uOrigin + vec2(vUv.x, 1.-vUv.y)*uCss; vec2 g;
    float f = field(q, g);
    float inside = (1. - smoothstep(-.004, .007, f))*uBallsOn;
    if (inside > .001){
      float bnd = exp(-(f*f)/(.03*.03));
      vec2 luv = uv + g*vec2(1.,-1.)*bnd*.02;               // refraction at the blob edge
      vec2 dd = vUv - .5; vec2 ab = dd*.0035*(.4 + dot(dd,dd)*3.) + g*bnd*.004;
      vec3 c = vec3(raw(luv+ab, 0.).r, raw(luv, 0.).g, raw(lglow-ab, 0.).b);
      vec3 hb = raw(luv, 4.)*.5 + raw(luv, 6.)*.5;           // halation from mips
      c += vec3(1., .62, .4)*max(lum(hb) - .45, 0.)*.7;
      c = pow(max(c + vec3(.015,.008,0.), 0.), vec3(1./1.04))*vec3(1.04, 1., .96);
      c = (c-.5)*1.08 + .5;
      c += (hash(fc/dpr + floor(uTime*24.)) - .5)*.05;      // 24fps grain
      col = mix(col, 1. - clamp(c, 0., 1.), inside);         // pre-inverted: the overlay re-inverts it
    }
    vec2 dv = vUv - .5; col *= 1. - .07*smoothstep(.35, .95, length(dv*vec2(1.,1.2)));
    col += (hash(fc/(dpr*.9) + floor(uTime*8.)*3.1) - .5)*.03;
    o = vec4(col, 1.);
  }`;

  /* ---------- the page-wide ink overlay (difference blend) ---------- */
  const INK_FRAG = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform vec2 uView; uniform vec4 uHero; uniform float uAmp;
  uniform vec3 uPaper, uInkA, uInkB;
  ${FIELD}
  void main(){
    vec2 q = vec2(vUv.x, 1.-vUv.y)*uView; vec2 g;
    float f = field(q, g);
    float inside = 1. - smoothstep(-.004, .007, f);
    float rim = exp(-pow((f + .003)/.006, 2.));
    float inHero = step(uHero.x, q.x)*step(q.x, uHero.z)*step(uHero.y, q.y)*step(q.y, uHero.w);
    vec3 col;
    if (inHero > .5){ col = vec3(inside); }
    else {
      vec3 inL = abs(uPaper - uInkA);       // paper -> ink A under a blob
      vec3 rimL = abs(uPaper - uInkB);      // paper -> ink B on the rim
      col = mix(inL*inside, rimL, rim*.9);
    }
    o = vec4(col*uAmp, 1.);
  }`;

  function makeGL(canvas, frag, opts) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: !!opts.alpha, premultipliedAlpha: true, powerPreference: 'high-performance' });
    if (!gl) return null;
    const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, frag)); gl.linkProgram(pr); gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {}; const u = (n) => (n in U ? U[n] : (U[n] = gl.getUniformLocation(pr, n)));
    return { gl, u };
  }

  /* ======================= Blob simulation (shared) ======================= */
  const Blobs = {
    list: new Float32Array(N * 3), // x, y, r in viewport heights
    zone: false, active: false, tx: 0, ty: 0, hx: 0, hy: 0, lx: 0, ly: 0, was: false, speed: 0,
    trail: Array.from({ length: 22 }, () => ({ x: 0, y: 0, r0: 0, age: 99 })), ti: 0,
    parts: [], ambient: null, // {cx, cy, ax, ay} in px, set by the hero
    lastMove: -1e9, enabled: !RM, amp: 0, sx: 0, sy: 0,
  };
  const vh = () => innerHeight;
  function spawnTrail(x, y, r) { const b = Blobs.trail[Blobs.ti]; b.x = x; b.y = y; b.r0 = r; b.age = 0; Blobs.ti = (Blobs.ti + 1) % Blobs.trail.length; }
  function splash(px, py, n = 6, sp = .5) {
    if (!Blobs.enabled) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, v = sp * (.4 + Math.random() * .8);
      if (Blobs.parts.length >= 12) Blobs.parts.shift();
      Blobs.parts.push({ x: px / vh(), y: py / vh(), vx: Math.cos(a) * v, vy: Math.sin(a) * v, r0: .03 + Math.random() * .045, age: 0, life: .7 + Math.random() * .5 });
    }
  }
  function blobInput() {
    if (!Blobs.enabled) return;
    let px = -1, py = -1;
    const set = (x, y, t) => { px = x; py = y; Blobs.tx = x / vh(); Blobs.ty = y / vh(); Blobs.zone = !!(t && t.closest && t.closest('[data-ink]')); Blobs.active = Blobs.zone; Blobs.lastMove = performance.now(); };
    // scrolling moves the page under a still pointer: re-check which zone it is over
    addEventListener('scroll', () => { if (px < 0) return; const t = document.elementFromPoint(px, py); Blobs.zone = !!(t && t.closest && t.closest('[data-ink]')); if (!Blobs.zone) Blobs.active = false; }, { passive: true });
    addEventListener('pointermove', (e) => set(e.clientX, e.clientY, e.target), { passive: true });
    addEventListener('pointerdown', (e) => { set(e.clientX, e.clientY, e.target); if (Blobs.zone && !e.target.closest('input,button,a,.sticker')) splash(e.clientX, e.clientY, 5, .5); }, { passive: true });
    addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') Blobs.active = false; }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => { Blobs.active = false; });
  }
  // one step of the sim; t seconds, dt seconds
  function blobStep(t, dt) {
    const B = Blobs; const H = vh(); const m = Math.min(1, .55 + (innerWidth / H) * .5);
    // idle autopilot: after 3s without input the "cursor" wanders over the hero on a Lissajous path
    const idle = performance.now() - B.lastMove > 3000;
    let act = B.active;
    if (idle && B.ambient && B.ambient.visible) {
      const A = B.ambient; act = true;
      B.tx = (A.cx + A.ax * 1.05 * Math.sin(t / 2.6)) / H; B.ty = (A.cy + A.ay * .8 * Math.sin(t / 3.7 + 1.2)) / H;
    }
    if (act) {
      if (!B.was) { B.hx = B.tx; B.hy = B.ty; B.lx = B.hx; B.ly = B.hy; }
      const k = 1 - Math.exp(-(idle ? 3 : 18) * dt); B.hx += (B.tx - B.hx) * k; B.hy += (B.ty - B.hy) * k;
      const d = Math.hypot(B.hx - B.lx, B.hy - B.ly); const sp = dt > 0 ? d / dt : 0; B.speed += (sp - B.speed) * .2;
      const r = (.06 + .035 * Math.min(1, B.speed / 1.4)) * m * (idle && B.ambient ? (B.ambient.size ?? 1) : 1); const n = Math.min(6, Math.max(1, Math.ceil(d / (r * .8))));
      // on the idle autopilot, only lay a new ball once it has moved, so a slow drift does not stack into one huge blob
      if (!(idle && Math.hypot(B.hx - B.sx, B.hy - B.sy) < r * .5)) { for (let i = 1; i <= n; i++) { const f = i / n; spawnTrail(B.lx + (B.hx - B.lx) * f, B.ly + (B.hy - B.ly) * f, r); } B.sx = B.hx; B.sy = B.hy; }
      B.lx = B.hx; B.ly = B.hy;
    } else B.speed *= .9;
    B.was = act;
    let w = 0; const L = B.list;
    for (const b of B.trail) { b.age += dt; const k = Math.max(0, 1 - b.age / .6); L[w++] = b.x; L[w++] = b.y; L[w++] = b.r0 * Math.pow(k, 1.4); }
    // three ambient blobs orbit the hero word (Blotter)
    const A = B.ambient;
    for (let i = 0; i < 3; i++) {
      if (A && A.visible) {
        const cx = A.cx / H, cy = A.cy / H, ax = A.ax / H, ay = A.ay / H;
        const ph = [[.21, 0, .27, 1.3], [.17, 2.1, .23, .4], [.13, 4, .31, .7]][i];
        L[w++] = cx + ax * Math.sin(t * ph[0] + ph[1]) * (1 - i * .05); L[w++] = cy + ay * Math.sin(t * ph[2] + ph[3]);
        L[w++] = (.075 + .02 * Math.sin(t * .5 + i * 2.1)) * m * (A.scale ?? 1) * (A.size ?? 1);
      } else { L[w++] = 0; L[w++] = 0; L[w++] = 0; }
    }
    for (let i = B.parts.length - 1; i >= 0; i--) { const p = B.parts[i]; p.age += dt; if (p.age >= p.life) { B.parts.splice(i, 1); continue; } const k = Math.exp(-2.6 * dt); p.vx *= k; p.vy *= k; p.x += p.vx * dt; p.y += p.vy * dt; }
    for (let i = 0; i < 12; i++) { const p = B.parts[i]; if (p) { L[w++] = p.x; L[w++] = p.y; L[w++] = p.r0 * m * Math.pow(1 - p.age / p.life, .8); } else { L[w++] = 0; L[w++] = 0; L[w++] = 0; } }
    while (w < N * 3) L[w++] = 0;
  }

  /* ============================ Ink overlay ============================ */
  function InkField(canvas, getTheme, getHeroRect) {
    if (RM) { canvas.remove(); Blobs.enabled = false; return null; }
    let G; try { G = makeGL(canvas, INK_FRAG, { alpha: true }); } catch (e) { console.warn(e); }
    if (!G) { canvas.remove(); Blobs.enabled = false; return null; }
    const { gl, u } = G; blobInput();
    const dpr = Math.min(devicePixelRatio || 1, 1.25);
    const size = () => { canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr); gl.viewport(0, 0, canvas.width, canvas.height); };
    size(); addEventListener('resize', size);
    return {
      frame(t, dt) {
        blobStep(t, dt);
        const th = getTheme(); const r = getHeroRect();
        gl.uniform3fv(u('uBalls'), Blobs.list); gl.uniform1f(u('uVh'), innerHeight); gl.uniform1f(u('uTime'), t);
        gl.uniform2f(u('uView'), innerWidth, innerHeight);
        gl.uniform4f(u('uHero'), r ? r.left : -1, r ? r.top : -1, r ? r.right : -1, r ? r.bottom : -1);
        gl.uniform1f(u('uAmp'), 1);
        gl.uniform3fv(u('uPaper'), hex(th.paper)); gl.uniform3fv(u('uInkA'), hex(th.a)); gl.uniform3fv(u('uInkB'), hex(th.b));
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
    };
  }

  /* ============================ Riso plate ============================ */
  function RisoPlate(canvas, o) {
    const api = { webgl: false, off: { x: 0, y: 0 }, scroll: 0, ptr: { x: 0, y: 0 }, onFirstFrame: null, onPass: null, hold: () => {}, pass: () => {}, frame: () => {}, setTheme: () => {} };
    let G; try { G = makeGL(canvas, PLATE_FRAG, { alpha: false }); } catch (e) { console.warn('plate', e); }
    if (!G) { canvas.style.display = 'none'; return api; }
    api.webgl = true; const { gl, u } = G;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    const tex = (i) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([244, 238, 228, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
    const TA = tex(0), TB = tex(1), TS = tex(2); gl.uniform1i(u('uA'), 0); gl.uniform1i(u('uB'), 1); gl.uniform1i(u('uS'), 2); let vidOn = 0;
    const up = (t, i, src) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.generateMipmap(gl.TEXTURE_2D); };

    // sources: two copies of the clip (crossfaded), or one still image
    let vA = null, vB = null, img = null, srcW = 16, srcH = 9, ready = false;
    if (o.video && !RM) {
      const mk = () => { const v = document.createElement('video'); v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); return v; };
      vA = mk(); vB = mk();
      const start = () => { srcW = vA.videoWidth; srcH = vA.videoHeight; if (isFinite(vA.duration)) vB.currentTime = vA.duration / 2; vA.play().catch(() => {}); vB.play().catch(() => {}); };
      vA.addEventListener('loadedmetadata', start, { once: true });
      // load after first paint so the page itself is never waiting on 11 MB of video
      const go = () => { vA.src = o.video; vB.src = o.video; };
      if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 600 }); else setTimeout(go, 200);
    }
    const still = new Image(); still.decoding = 'async';
    still.onload = () => { img = still; if (!vA || !vA.videoWidth) { srcW = still.naturalWidth; srcH = still.naturalHeight; } up(TS, 2, still); drawStill = true; };
    still.src = o.image || o.poster;
    let drawStill = false;

    const dpr = Math.min(devicePixelRatio || 1, matchMedia('(pointer:coarse)').matches ? 1.25 : 1.5);
    let W = 1, H = 1, rect = canvas.getBoundingClientRect();
    const size = () => { rect = canvas.getBoundingClientRect(); W = Math.max(2, Math.round(rect.width * dpr)); H = Math.max(2, Math.round(rect.height * dpr)); canvas.width = W; canvas.height = H; gl.viewport(0, 0, W, H); };
    new ResizeObserver(size).observe(canvas); size();
    let visible = true; new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (vA) { visible ? (vA.play().catch(() => {}), vB.play().catch(() => {})) : (vA.pause(), vB.pause()); } }).observe(canvas);

    // misregistration (ink B offset) on a spring, Presswork's constants
    const rest = o.rest || [.004, -.002]; const off = { x: rest[0], y: rest[1] }; let vx = 0, vy = 0; let held = null;
    api.off = off; api.hold = (x, y) => { held = x == null ? null : { x, y }; };
    // roller passes: intro pass, then one every 6–8s
    let passT = -1, passD = { x: 0, y: 0 }, burst = 0, seed = 1, nextPass = o.introPass === false ? 2 : .6, flood = o.introPass === false ? 1 : 0;
    const PASS = 1.5;
    api.pass = () => { if (passT < 0) nextPass = 0; };
    let ptx = 0, pty = 0, px = 0, py = 0, lastUser = -1e9;
    (o.pointerEl || canvas).addEventListener('pointermove', (e) => { ptx = ((e.clientX - rect.left) / rect.width) * 2 - 1; pty = -(((e.clientY - rect.top) / rect.height) * 2 - 1); lastUser = performance.now(); }, { passive: true });
    let theme = o.theme; api.setTheme = (t) => { theme = t; };
    let first = false, t0 = performance.now();

    api.frame = (now, dt) => {
      if (!visible || document.hidden) return;
      rect = canvas.getBoundingClientRect();
      const t = (now - t0) / 1000;
      if (o.introPass !== false) flood = Math.min(1, t / .5);
      // pointer: low-passed; after 3s idle it drifts on a Lissajous path
      if (performance.now() - lastUser > 3000 && !RM) { ptx = .5 * Math.sin(t / 2.6); pty = .35 * Math.sin(t / 3.7 + 1.2); }
      const k = 1 - Math.exp(-5 * dt); px += (Math.max(-.92, Math.min(.92, ptx)) - px) * k; py += (Math.max(-.92, Math.min(.92, pty)) - py) * k; api.ptr.x = px; api.ptr.y = py;
      // passes
      if (!RM && passT < 0 && t > nextPass) { passT = 0; seed = 1 + Math.random() * 40; passD.x = (Math.random() - .5) * .006; passD.y = (Math.random() - .5) * .004; burst = 1; o.onPass && o.onPass(); }
      let passX = -1;
      if (passT >= 0) { passT += dt; const h = Math.min(1, passT / PASS); passX = -.12 + (h < .5 ? 2 * h * h : 1 - Math.pow(-2 * h + 2, 2) / 2) * 1.52; if (h >= 1) { passT = -1; passX = -1; rest[0] = Math.max(-.01, Math.min(.012, rest[0] + passD.x)); rest[1] = Math.max(-.006, Math.min(.006, rest[1] + passD.y)); nextPass = t + 6 + Math.random() * 2; } }
      else burst = Math.max(0, burst - dt * 1.4);
      if (o.introPass !== false && t < .6) passX = -.2; // hold the sheet flooded until the first pass
      // spring the plate offset towards rest (or the held drag position); idle wobble
      let tx = rest[0] + (RM ? 0 : Math.sin(t * .9) * .0016), ty = rest[1] + (RM ? 0 : Math.sin(t * .7 + 1.1) * .0011);
      if (held) { tx = held.x; ty = held.y; }
      const F = 90, D = held ? 16 : 7.5, n = 4, g = dt / n;
      for (let i = 0; i < n; i++) { vx += ((tx - off.x) * F - vx * D) * g; vy += ((ty - off.y) * F - vy * D) * g; off.x += vx * g; off.y += vy * g; }
      // textures
      let mix = 0;
      if (vA && vA.readyState >= 2) {
        up(TA, 0, vA); if (vB.readyState >= 2) { up(TB, 1, vB); const D2 = vA.duration; if (isFinite(D2) && D2 > 0) { const a = Math.sin(Math.PI * (vA.currentTime % D2) / D2) ** 2, b = Math.sin(Math.PI * (vB.currentTime % D2) / D2) ** 2; mix = b / Math.max(1e-4, a + b); } }
        srcW = vA.videoWidth; srcH = vA.videoHeight; vidOn = Math.min(1, vidOn + dt / 1.2);
      } else if (!drawStill) return;
      const th = theme();
      gl.uniform2f(u('uRes'), W, H); gl.uniform2f(u('uVid'), srcW, srcH);
      gl.uniform2f(u('uFocus'), (o.focus || [.5, .5])[0], (o.focus || [.5, .5])[1]); gl.uniform1f(u('uZoom'), o.zoom || 1);
      gl.uniform1f(u('uMix'), mix); gl.uniform1f(u('uVidOn'), vidOn); gl.uniform1f(u('uIsImg'), vA ? 0 : 1);
      gl.uniform2f(u('uPtr'), px, py); gl.uniform1f(u('uDepth'), RM ? 0 : (o.depth ?? .016));
      gl.uniform2f(u('uOff'), off.x, off.y); gl.uniform2f(u('uOrigin'), rect.left, rect.top); gl.uniform2f(u('uCss'), rect.width, rect.height);
      gl.uniform1f(u('uDpr'), dpr); gl.uniform1f(u('uTime'), RM ? 0 : t); gl.uniform1f(u('uScroll'), api.scroll);
      gl.uniform1f(u('uPassX'), passX); gl.uniform1f(u('uFlood'), flood); gl.uniform1f(u('uInkK'), RM ? 1 : 1 + .05 * Math.sin(t * 1.15));
      const fa = o.fade ? o.fade() : null; gl.uniform4f(u('uFade'), fa ? fa.amt : 0, fa ? fa.off : 0, fa ? fa.a : 0, fa ? fa.b : 1); gl.uniform2f(u('uFadeDir'), fa ? fa.dir[0] : 1, fa ? fa.dir[1] : 0);
      gl.uniform1f(u('uBurst'), burst); gl.uniform1f(u('uSeed'), seed);
      gl.uniform3fv(u('uBalls'), Blobs.list); gl.uniform1f(u('uVh'), innerHeight); gl.uniform1f(u('uBallsOn'), Blobs.enabled ? 1 : 0);
      gl.uniform3fv(u('uPaper'), hex(th.paper)); gl.uniform3fv(u('uInkA'), hex(th.a)); gl.uniform3fv(u('uInkB'), hex(th.b));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!first) { first = true; api.onFirstFrame && api.onFirstFrame(); }
    };
    return api;
  }

  window.Press = { RisoPlate, InkField, Blobs, splash };
})();
