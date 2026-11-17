/*!
 * Mascot Portfolio Hero, vanilla JS rebuild.
 *
 * Original component: "mascot-portfolio-hero" by Kedhareswer Naidu
 * (21st.dev/@kedhareswer/components/mascot-portfolio-hero), MIT licence.
 * This file ports its structure, SVG character, perspective-grid room,
 * head-tracking maths, blink and grin to plain JavaScript (no React, no build).
 *
 * MIT License. Copyright (c) Kedhareswer Naidu (original component).
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions: the above copyright
 * notice and this permission notice shall be included in all copies or
 * substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS",
 * WITHOUT WARRANTY OF ANY KIND.
 *
 * Usage:
 *   const hero = MascotHero.create(document.getElementById('hero'), { initials: 'UI', ... });
 *   hero.poke();            // same as clicking the character
 *   hero.say('Hello', 2000) // show the speech bubble with any text
 *   hero.talk(1500)         // animate the mouth as if speaking
 *   hero.setHappy(true)     // grin + closed happy eyes
 *   hero.destroy()
 */
(function (global) {
  'use strict';

  /* ---------- Props (defaults reproduce the original demo exactly) ---------- */
  var DEFAULTS = {
    height: '100svh',
    minHeight: '440px',
    index: '08/01',
    discipline: 'Visual design',
    tagline: 'Make it helpful',
    collection: ['Selected', 'Works'],
    reel: ['Sample reels @ 2026', 'Visual design'],
    year: '2026',
    initials: 'UI',
    badge: 'Hire me',
    line2: 'Portfolio',
    line3: 'Design',
    word: 'Work',
    verticalTag: 'Visual',
    bracketed: 'S',
    seekingLabel: 'Seeking*',
    seeking: 'UI / Graphic',
    href: null,
    services: ['Brand design', 'Logo design', 'Interface design', 'IP character design'],
    greetings: ['Hi there!', "Let's make something bold.", 'Psst — I\'m open to work.', 'Okay, you can stop poking me :)'],
    skin: '#b0d8f7',
    beanie: '#1d1d1f',
    shirt: '#18181a',
    tag: '#5890b9',
    accent: '#b55f9a',
    paper: '#ebebea',
    ink: '#111111',
    className: '',

    /* Optional extras added in this rebuild. All off by default, so the
       defaults above render the original component unchanged. */
    headingLabel: null,      // aria-label for the h1 (defaults to the words joined)
    badgeHref: null,         // makes the "Hire me" badge a link
    collectionHref: null,    // makes {Selected/Works} a link
    serviceLinks: null,      // array of hrefs, one per service
    avatar: null,            // image URL shown in the reel circle instead of the accent dot
    avatarAlt: '',
    glasses: false,          // draw glasses on the character
    beard: false,            // draw a short beard
    beardColor: '#1b2a33',
    characterLabel: 'Say hi to the character',
    bubbleMs: 2200,          // how long the bubble and grin stay after a poke
    onPoke: null,            // function(api) called after each click on the character
    headingLevel: 1          // 1 renders <h1>; 2 renders <h2> when used lower on a page
  };

  var FONT_SANS = '"Inter","Helvetica Neue",Helvetica,Arial,system-ui,sans-serif';
  var FONT_DISPLAY = '"Archivo Black","Arial Black","Helvetica Neue",Helvetica,Arial,system-ui,sans-serif';
  var CHAR_W = 600, CHAR_H = 720;

  /* ---------- Maths (ported 1:1) ---------- */

  // Where the pointer sits relative to the head, squashed into -1..1 with a soft curve.
  function aim(px, py, cx, cy, sx, sy) {
    var sat = function (v) { return v / Math.sqrt(1 + v * v); };
    return [sat((px - cx) / sx), sat((py - cy) / sy)];
  }

  // Frame-rate independent easing toward a target.
  function approach(cur, target, dt, k) {
    return target + (cur - target) * Math.exp(-k * dt);
  }

  // Each layer moves a different amount, which reads as the head turning in 3D.
  // x, y: look direction (-1..1). near: 0..1 when the pointer is close (eyes widen, brows lift).
  function pose(x, y, near) {
    return {
      body: { dx: x * 4, dy: 0 },
      head: { dx: x * 10, dy: y * 7, rot: x * 4 },
      ears: { dx: -x * 7, dy: -y * 3, lead: 1 + x * 0.16, trail: 1 - x * 0.16 },
      beanie: { dx: x * 13, dy: y * 4 },
      tag: { dx: x * 7, dy: 0 },
      blush: { dx: x * 20, dy: y * 14 },
      face: { dx: x * 28, dy: y * (y < 0 ? 11 : 20) },
      nose: { dx: x * 10, dy: y * 7 },
      eyes: { dx: x * 4, dy: y * 4, scale: 1 + near * 0.14 },
      brows: { dx: x * 3, dy: y * 2 + Math.min(0, y) * 3 - near * 9 }
    };
  }

  // Eye height multiplier for a blink that lasts 150 ms (t in seconds since the blink started).
  function blink(t) {
    return t < 0 || t > 0.15 ? 1 : 1 - Math.sin(Math.PI * t / 0.15) * 0.92;
  }

  // The perspective "room": a back wall grid, rays to the edges, and nested depth frames.
  function room() {
    var back = [], rays = [];
    var out = function (x, y) {
      var dx = x - 500, dy = y - 475;
      var tx = dx > 0 ? (1000 - x) / dx : dx < 0 ? -x / dx : Infinity;
      var ty = dy > 0 ? (1000 - y) / dy : dy < 0 ? -y / dy : Infinity;
      var t = Math.min(tx, ty);
      return [x, y, x + dx * t, y + dy * t];
    };
    for (var i = 0; i <= 14; i++) {
      var x = 95 + 810 * i / 14;
      back.push([x, 85, x, 865]);
      rays.push(out(x, 85), out(x, 865));
    }
    for (var j = 0; j <= 11; j++) {
      var y = 85 + 780 * j / 11;
      back.push([95, y, 905, y]);
      rays.push(out(95, y), out(905, y));
    }
    var depth = [1.07, 1.16, 1.28, 1.45, 1.7].map(function (s) {
      var l = 500 - 405 * s, r = 500 + 405 * s, t = 475 - 390 * s, b = 475 + 390 * s;
      return 'M' + l + ' ' + t + 'H' + r + 'V' + b + 'H' + l + 'Z';
    });
    return { back: back, rays: rays, depth: depth };
  }

  // Five uneven petals traced in polar coordinates.
  function flowerPath() {
    var petals = [1, 0.84, 0.95, 0.78, 0.9], d = '';
    for (var i = 0; i <= 180; i++) {
      var a = i / 180 * Math.PI * 2;
      var p = Math.floor((a + Math.PI / 5) / (Math.PI * 2) * 5) % 5;
      var r = 50 * (0.3 + 0.7 * Math.pow(Math.abs(Math.cos(a * 5 / 2)), 0.9) * petals[p]);
      var x = 60 + Math.cos(a - Math.PI / 2) * r, y = 60 + Math.sin(a - Math.PI / 2) * r;
      d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    return d + 'Z';
  }

  var ROOM = room();
  var FLOWER = flowerPath();
  var HEAD_PATH = 'M300 150 C402 150 470 226 470 348 C470 472 396 562 300 562 C204 562 130 472 130 348 C130 226 198 150 300 150 Z';
  var MOUTH_PATH = 'M218 440 Q300 458 382 440 Q376 524 300 530 Q224 524 218 440 Z';
  var CUFF_PATH = 'M114 262 Q300 222 486 262 L490 322 Q300 286 110 322 Z';
  var BODY_PATH = 'M28 730 C40 646 104 604 206 588 L394 588 C496 604 560 646 572 730 Z';
  var NECK_PATH = 'M246 500 L354 500 L360 600 Q300 624 240 600 Z';
  var BROWS = {
    calm: ['M198 300 Q230 282 264 294', 'M336 294 Q370 282 402 300'],
    happy: ['M198 292 Q230 270 264 286', 'M336 286 Q370 270 402 292']
  };

  var uid = 0;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function chars(text) {
    return Array.from(String(text)).map(function (c) {
      return '<span class="mph-ch">' + (c === ' ' ? '&nbsp;' : esc(c)) + '</span>';
    }).join('');
  }

  /* ---------- Markup ---------- */

  function roomSVG() {
    var s = '<svg class="mph-room" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">' +
      '<g stroke="currentColor" stroke-width="0.8" fill="none" opacity="0.13">';
    ROOM.back.concat(ROOM.rays).forEach(function (l) {
      s += '<line x1="' + l[0] + '" y1="' + l[1] + '" x2="' + l[2].toFixed(1) + '" y2="' + l[3].toFixed(1) + '"/>';
    });
    ROOM.depth.forEach(function (d) { s += '<path d="' + d + '"/>'; });
    return s + '</g></svg>';
  }

  function characterSVG(p, id) {
    var u = function (n) { return 'url(#' + n + id + ')'; };
    var knit = '';
    for (var i = 0; i < 34; i++) knit += '<line x1="' + (112 + i * 11.4).toFixed(1) + '" y1="220" x2="' + (112 + i * 11.4).toFixed(1) + '" y2="330"/>';
    var ear = function (side, cx, curl) {
      return '<g data-part="' + side + '">' +
        '<ellipse cx="' + cx + '" cy="380" rx="46" ry="60" fill="' + p.skin + '"/>' +
        '<ellipse cx="' + cx + '" cy="380" rx="46" ry="60" fill="' + u('shade') + '"/>' +
        '<path d="' + curl + '" fill="none" stroke="#2e84a2" stroke-opacity="0.35" stroke-width="7" stroke-linecap="round"/>' +
        '<ellipse cx="' + (side === 'earL' ? 136 : 464) + '" cy="392" rx="24" ry="22" fill="' + u('blush') + '"/></g>';
    };
    var beard = p.beard ?
      '<g clip-path="' + u('headclip') + '"><g data-part="beard">' +
      '<path filter="' + u('fuzz') + '" fill="' + p.beardColor + '" opacity="0.88" d="M130 384 L152 388 C160 444 192 474 230 466 C256 460 272 452 300 452 C328 452 344 460 370 466 C408 474 440 444 448 388 L470 384 C474 490 404 578 300 580 C196 578 126 490 130 384 Z"/>' +
      '<path fill="' + p.beardColor + '" opacity="0.9" filter="' + u('fuzz') + '" d="M222 440 Q258 420 300 428 Q342 420 378 440 Q342 436 300 444 Q258 436 222 440 Z"/>' +
      '</g></g>' : '';
    var glasses = p.glasses ?
      '<g data-part="glasses" fill="none" stroke="#141414" stroke-width="9" stroke-linejoin="round">' +
      '<rect x="190" y="306" width="104" height="86" rx="30" fill="#ffffff" fill-opacity="0.1"/>' +
      '<rect x="306" y="306" width="104" height="86" rx="30" fill="#ffffff" fill-opacity="0.1"/>' +
      '<path d="M294 336 Q300 326 306 336" stroke-width="8"/>' +
      '<path d="M190 330 L150 320 M410 330 L450 320" stroke-width="8" stroke-linecap="round"/>' +
      '<path d="M206 322 L226 316" stroke="#ffffff" stroke-opacity="0.55" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M322 322 L342 316" stroke="#ffffff" stroke-opacity="0.55" stroke-width="5" stroke-linecap="round"/>' +
      '</g>' : '';

    return '<svg viewBox="0 0 ' + CHAR_W + ' ' + CHAR_H + '" aria-hidden="true" focusable="false"><defs>' +
      '<radialGradient id="shade' + id + '" cx="46%" cy="40%" r="62%"><stop offset="0.55" stop-color="#14607a" stop-opacity="0"/><stop offset="1" stop-color="#14607a" stop-opacity="0.34"/></radialGradient>' +
      '<radialGradient id="hi' + id + '" cx="36%" cy="30%" r="42%"><stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="blush' + id + '"><stop offset="0" stop-color="#6fffff" stop-opacity="0.55"/><stop offset="1" stop-color="#6fffff" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="knit' + id + '" cx="38%" cy="22%" r="80%"><stop offset="0" stop-color="#ffffff" stop-opacity="0.2"/><stop offset="0.6" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.35"/></radialGradient>' +
      '<radialGradient id="eye' + id + '" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#3a3a3c"/><stop offset="1" stop-color="#050505"/></radialGradient>' +
      '<radialGradient id="nose' + id + '" cx="42%" cy="36%" r="66%"><stop offset="0" stop-color="#82e5ff" stop-opacity="0.18"/><stop offset="1" stop-color="#3a9ab8" stop-opacity="0.42"/></radialGradient>' +
      '<linearGradient id="neck' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14556b" stop-opacity="0.45"/><stop offset="0.5" stop-color="#14556b" stop-opacity="0.08"/></linearGradient>' +
      '<linearGradient id="cloth' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.1"/><stop offset="1" stop-color="#000000" stop-opacity="0.3"/></linearGradient>' +
      '<filter id="fuzz' + id + '" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="4" xChannelSelector="R" yChannelSelector="G"/></filter>' +
      '<clipPath id="mouth' + id + '"><path d="' + MOUTH_PATH + '"/></clipPath>' +
      '<clipPath id="cuff' + id + '"><path d="' + CUFF_PATH + '"/></clipPath>' +
      '<clipPath id="headclip' + id + '"><path d="' + HEAD_PATH + '"/></clipPath>' +
      '</defs>' +
      '<ellipse cx="300" cy="712" rx="250" ry="16" fill="#000000" opacity="0.08"/>' +

      /* body */
      '<g data-part="body">' +
      '<path d="' + BODY_PATH + '" fill="' + p.shirt + '"/><path d="' + BODY_PATH + '" fill="' + u('cloth') + '"/>' +
      '<path d="' + NECK_PATH + '" fill="' + p.skin + '"/><path d="' + NECK_PATH + '" fill="' + u('neck') + '"/>' +
      '<path d="M236 566 Q262 604 300 628 L250 668 Q214 628 194 594 Z" fill="' + p.shirt + '"/>' +
      '<path d="M364 566 Q338 604 300 628 L350 668 Q386 628 406 594 Z" fill="' + p.shirt + '"/>' +
      '<path d="M236 566 Q262 604 300 628 L250 668 Q214 628 194 594 Z M364 566 Q338 604 300 628 L350 668 Q386 628 406 594 Z" fill="#ffffff" opacity="0.07" stroke="#000000" stroke-opacity="0.4" stroke-width="2"/>' +
      '<rect x="288" y="628" width="24" height="102" fill="#ffffff" opacity="0.05" stroke="#000000" stroke-opacity="0.35" stroke-width="2"/>' +
      '<circle cx="300" cy="656" r="6" fill="#2a2a2c" stroke="#000000" stroke-opacity="0.5"/>' +
      '<circle cx="300" cy="698" r="6" fill="#2a2a2c" stroke="#000000" stroke-opacity="0.5"/>' +
      '</g>' +

      /* head */
      '<g data-part="head">' +
      ear('earL', 138, 'M150 348 Q118 360 124 392 Q130 416 150 414') +
      ear('earR', 462, 'M450 348 Q482 360 476 392 Q470 416 450 414') +
      '<path d="' + HEAD_PATH + '" fill="' + p.skin + '"/>' +
      '<path d="' + HEAD_PATH + '" fill="' + u('shade') + '"/>' +
      '<path d="' + HEAD_PATH + '" fill="' + u('hi') + '"/>' +
      '<g data-part="blush">' +
      '<ellipse data-blush cx="190" cy="430" rx="44" ry="30" fill="' + u('blush') + '"/>' +
      '<ellipse data-blush cx="410" cy="430" rx="44" ry="30" fill="' + u('blush') + '"/>' +
      '</g>' +
      beard +
      '<g data-part="face">' +
      '<g data-part="brows">' +
      '<path data-brow="0" d="' + BROWS.calm[0] + '" fill="none" stroke="#182e3b" stroke-width="22" stroke-linecap="round"/>' +
      '<path data-brow="1" d="' + BROWS.calm[1] + '" fill="none" stroke="#182e3b" stroke-width="22" stroke-linecap="round"/>' +
      '</g>' +
      '<g data-part="eyes">' +
      '<g data-eyes="open">' +
      '<ellipse cx="240" cy="350" rx="25" ry="31" fill="' + u('eye') + '"/><circle cx="231" cy="336" r="8.5" fill="#ffffff"/><circle cx="250" cy="361" r="3.5" fill="#ffffff" opacity="0.8"/>' +
      '<ellipse cx="360" cy="350" rx="25" ry="31" fill="' + u('eye') + '"/><circle cx="351" cy="336" r="8.5" fill="#ffffff"/><circle cx="370" cy="361" r="3.5" fill="#ffffff" opacity="0.8"/>' +
      '</g>' +
      '<g data-eyes="happy" style="display:none">' +
      '<path d="M214 356 Q240 324 266 356" fill="none" stroke="#111111" stroke-width="13" stroke-linecap="round"/>' +
      '<path d="M334 356 Q360 324 386 356" fill="none" stroke="#111111" stroke-width="13" stroke-linecap="round"/>' +
      '</g>' +
      '</g>' +
      glasses +
      '<path d="M420 382 L423.5 391 L433 391.5 L425.6 397.5 L428.2 406.8 L420 401.5 L411.8 406.8 L414.4 397.5 L407 391.5 L416.5 391 Z" fill="#14242a"/>' +
      '<g data-part="mouth">' +
      '<path d="' + MOUTH_PATH + '" fill="#0f3d3d"/>' +
      '<g clip-path="' + u('mouth') + '">' +
      '<ellipse cx="300" cy="530" rx="46" ry="22" fill="#57d9d6"/>' +
      '<path d="M210 436 Q300 456 390 436 L390 474 Q300 490 210 474 Z" fill="#ffffff"/>' +
      '<path d="M236 516 Q300 500 364 516 L364 540 L236 540 Z" fill="#f3efe9"/>' +
      '<path d="M262 452 V484 M300 456 V488 M338 452 V484" stroke="#000000" stroke-opacity="0.08" stroke-width="2"/>' +
      '</g>' +
      '<path d="' + MOUTH_PATH + '" fill="none" stroke="#24798a" stroke-opacity="0.45" stroke-width="3"/>' +
      '<path d="M208 432 Q212 442 220 446 M392 432 Q388 442 380 446" fill="none" stroke="#2e84a2" stroke-opacity="0.4" stroke-width="4" stroke-linecap="round"/>' +
      '</g>' +
      '<g data-part="nose">' +
      '<ellipse cx="300" cy="414" rx="28" ry="12" fill="#14556b" opacity="0.14"/>' +
      '<ellipse cx="300" cy="398" rx="29" ry="26" fill="' + p.skin + '"/>' +
      '<ellipse cx="300" cy="398" rx="29" ry="26" fill="' + u('nose') + '"/>' +
      '<ellipse cx="291" cy="387" rx="10" ry="8" fill="#ffffff" opacity="0.45"/>' +
      '</g>' +
      '</g>' +

      /* beanie */
      '<g data-part="beanie"><g transform="translate(0 -22)">' +
      '<g filter="' + u('fuzz') + '">' +
      '<path d="M126 300 C112 168 196 88 300 88 C404 88 488 168 474 300 Z" fill="' + p.beanie + '"/>' +
      '<path d="M126 300 C112 168 196 88 300 88 C404 88 488 168 474 300 Z" fill="' + u('knit') + '"/>' +
      '<path d="' + CUFF_PATH + '" fill="' + p.beanie + '"/>' +
      '<g clip-path="' + u('cuff') + '" stroke="#ffffff" stroke-opacity="0.08" stroke-width="5">' + knit + '</g>' +
      '<path d="' + CUFF_PATH + '" fill="#000000" opacity="0.18"/>' +
      '<path d="M112 292 Q300 254 488 292" fill="none" stroke="#000000" stroke-opacity="0.25" stroke-width="3"/>' +
      '</g>' +
      '<g data-part="tag"><g class="mph-tagwig"><g transform="rotate(-7 190 272)">' +
      '<rect x="172" y="238" width="36" height="64" rx="5" fill="' + p.tag + '"/>' +
      '<rect x="172" y="238" width="36" height="64" rx="5" fill="' + u('cloth') + '"/>' +
      '<rect x="177" y="243" width="26" height="54" rx="3" fill="none" stroke="#ffffff" stroke-opacity="0.5" stroke-width="1.6" stroke-dasharray="3 3"/>' +
      '</g></g></g>' +
      '</g></g>' +
      '</g>' +
      '</svg>';
  }

  function heroHTML(p, id) {
    var letters = Array.from(String(p.line3));
    var line3Head = letters.slice(0, -1).join('');
    var line3Last = letters[letters.length - 1] || '';
    var h = 'h' + (p.headingLevel === 2 ? 2 : 1);
    var label = p.headingLabel || [p.year, p.initials, p.line2, p.line3, p.word + p.bracketed].join(' ');
    var badge = p.badgeHref ?
      '<a class="mph-badge" href="' + esc(p.badgeHref) + '" tabindex="-1">' + esc(p.badge) + '<sup>@</sup></a>' :
      '<span class="mph-badge">' + esc(p.badge) + '<sup>@</sup></span>';
    var brace = '{' + esc(p.collection[0]) + '/' + esc(p.collection[1]) + '}';
    var reelDot = p.avatar ?
      '<img class="mph-avatar" src="' + esc(p.avatar) + '" alt="' + esc(p.avatarAlt) + '" width="80" height="80">' :
      '<i aria-hidden="true"></i>';
    var pillInner = esc(p.seeking) + '<em aria-hidden="true">→</em>';
    var services = p.services.map(function (s, i) {
      var link = p.serviceLinks && p.serviceLinks[i];
      return '<li>' + (link ? '<a href="' + esc(link) + '">' + esc(s) + '</a>' : esc(s)) + '</li>';
    }).join('');

    return roomSVG() +
      '<div class="mph-stage">' +
      '<header class="mph-top">' +
      '<span class="mph-index"><b>' + esc(p.index) + '</b>' + esc(p.discipline) + '</span>' +
      '<span class="mph-tagline">' + esc(p.tagline) + '</span>' +
      (p.collectionHref ? '<a class="mph-brace" href="' + esc(p.collectionHref) + '">' + brace + '</a>' : '<span class="mph-brace">' + brace + '</span>') +
      '<span class="mph-reel">' + reelDot + '<span>' + esc(p.reel[0]) + '<br>' + esc(p.reel[1]) + '</span></span>' +
      '</header>' +
      '<span class="mph-rule mph-rule-l" aria-hidden="true"></span>' +
      '<span class="mph-rule mph-rule-r" aria-hidden="true"></span>' +
      '<' + h + ' class="mph-h1" aria-label="' + esc(label) + '">' +
      '<span class="mph-line" aria-hidden="true">' + chars(p.year) +
      '<svg class="mph-arrow" viewBox="0 0 100 100"><path d="M14 14 L84 84 M84 30 V84 H30"/></svg>' +
      chars(p.initials) + badge + '</span>' +
      '<span class="mph-line" aria-hidden="true">' + chars(p.line2) + '</span>' +
      '<span class="mph-line" aria-hidden="true">' + chars(line3Head) +
      '<span class="mph-swash"><span class="mph-ch">' + esc(line3Last) + '</span>' +
      '<svg viewBox="0 0 255 72" preserveAspectRatio="none"><path pathLength="1" d="M6 44 C40 18 150 4 222 14 C262 20 258 48 214 58 C150 72 60 70 30 60 C10 53 20 40 60 34"/></svg></span></span>' +
      '<span class="mph-line mph-l4" aria-hidden="true">' + chars(p.word) +
      '<span class="mph-vtag"><span>' + esc(p.verticalTag) + '</span><i></i></span>' +
      '<span class="mph-bracket"><svg viewBox="0 0 100 120" preserveAspectRatio="none">' +
      '<path class="mph-arc-t" vector-effect="non-scaling-stroke" d="M4 16 Q50 -8 96 16"/>' +
      '<path class="mph-arc-b" vector-effect="non-scaling-stroke" d="M4 104 Q50 128 96 104"/></svg>' + esc(p.bracketed) + '</span>' +
      '<span class="mph-star">*</span></span>' +
      '</' + h + '>' +
      '<svg class="mph-curl" viewBox="0 0 100 100" aria-hidden="true"><path pathLength="1" d="M92 8 C70 6 52 22 58 40 C63 56 84 52 80 36 C76 22 50 30 40 48 C32 62 26 74 16 84 M14 66 L14 86 L34 86"/></svg>' +
      '<div class="mph-pill"><span class="mph-pill-a">' + esc(p.seekingLabel) + '</span>' +
      (p.href ? '<a class="mph-pill-b" href="' + esc(p.href) + '">' + pillInner + '</a>' : '<span class="mph-pill-b" tabindex="0">' + pillInner + '</span>') +
      '</div>' +
      '<div class="mph-flower" aria-hidden="true"><svg viewBox="0 0 120 120"><path d="' + FLOWER + '"/><circle cx="60" cy="60" r="4" fill="none" stroke="' + esc(p.ink) + '" stroke-width="2"/></svg></div>' +
      '<ul class="mph-services">' + services + '</ul>' +
      '<button type="button" class="mph-char" aria-label="' + esc(p.characterLabel) + '">' +
      characterSVG(p, id) +
      '<span class="mph-bubble" data-on="false" aria-live="polite"></span>' +
      '</button>' +
      '</div>';
  }

  /* ---------- Component ---------- */

  function create(root, options) {
    var p = Object.assign({}, DEFAULTS, options || {});
    var id = 'mph' + (++uid);
    root.classList.add('mph-root');
    if (p.className) p.className.split(/\s+/).forEach(function (c) { if (c) root.classList.add(c); });
    root.style.setProperty('--mph-accent', p.accent);
    root.style.setProperty('--mph-paper', p.paper);
    root.style.setProperty('--mph-ink', p.ink);
    root.style.setProperty('--mph-sans', FONT_SANS);
    root.style.setProperty('--mph-display', FONT_DISPLAY);
    root.style.height = p.height;
    root.style.minHeight = p.minHeight;
    root.innerHTML = heroHTML(p, id);

    var btn = root.querySelector('.mph-char');
    var bubble = root.querySelector('.mph-bubble');
    var q = function (name) { return btn.querySelector('[data-part="' + name + '"]'); };
    var parts = {
      body: q('body'), head: q('head'), earL: q('earL'), earR: q('earR'), beanie: q('beanie'), tag: q('tag'),
      blush: q('blush'), face: q('face'), nose: q('nose'), brows: q('brows'), eyes: q('eyes'),
      mouth: q('mouth'), glasses: q('glasses'), beard: q('beard')
    };
    var eyesOpen = btn.querySelector('[data-eyes="open"]');
    var eyesHappy = btn.querySelector('[data-eyes="happy"]');
    var browEls = btn.querySelectorAll('[data-brow]');
    var blushEls = btn.querySelectorAll('[data-blush]');

    var happy = false, greetIndex = -1, hideTimer = 0, talkUntil = 0;
    bubble.textContent = p.greetings[0] || '';

    function setHappy(on) {
      happy = !!on;
      btn.classList.toggle('mph-happy', happy);
      eyesOpen.style.display = happy ? 'none' : '';
      eyesHappy.style.display = happy ? '' : 'none';
      var b = happy ? BROWS.happy : BROWS.calm;
      browEls[0].setAttribute('d', b[0]);
      browEls[1].setAttribute('d', b[1]);
      blushEls.forEach(function (e) { e.setAttribute('rx', happy ? 50 : 44); e.setAttribute('ry', happy ? 34 : 30); });
      bubble.setAttribute('data-on', happy ? 'true' : 'false');
    }
    function say(text, ms) {
      bubble.textContent = text;
      setHappy(true);
      // restart the tag wiggle
      btn.classList.remove('mph-happy'); void btn.offsetWidth; btn.classList.add('mph-happy');
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function () { setHappy(false); }, ms || p.bubbleMs);
    }
    function poke() {
      greetIndex = (greetIndex + 1) % Math.max(1, p.greetings.length);
      say(p.greetings[greetIndex] || '', p.bubbleMs);
    }
    function talk(ms) { talkUntil = performance.now() + (ms || 1200); }

    var api = { root: root, button: btn, poke: poke, say: say, talk: talk, setHappy: setHappy, props: p, destroy: destroy };
    function onClick() { poke(); if (typeof p.onPoke === 'function') p.onPoke(api); }
    btn.addEventListener('click', onClick);

    /* ---------- Animation loop ---------- */
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    var reduced = mq.matches;
    var onMq = function () { reduced = mq.matches; };
    if (mq.addEventListener) mq.addEventListener('change', onMq);

    var px = 0, py = 0, lastMove = -1e9;
    var lx = 0, ly = 0, near = 0;
    var prev = performance.now();
    var nextBlink = prev + 1800, blinkAt = -1e9;
    var raf = 0, visible = true;

    var onMove = function (e) { px = e.clientX; py = e.clientY; lastMove = performance.now(); };
    var onLeave = function () { lastMove = -1e9; };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    window.addEventListener('blur', onLeave);

    var tr = function (x, y) { return 'translate(' + x.toFixed(2) + ' ' + y.toFixed(2) + ')'; };

    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      var dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      var r = btn.getBoundingClientRect();
      var cx = r.left + r.width * 0.5, cy = r.top + r.height * 0.48;
      var tx = 0, ty = 0, tn = 0;
      if (now - lastMove > 3500) {
        // idle: a slow look-around sway
        if (!reduced) {
          var s = now / 1000;
          tx = Math.sin(s * 0.45) * 0.55 + Math.sin(s * 1.1) * 0.1;
          ty = Math.sin(s * 0.31 + 1) * 0.25;
        }
      } else {
        var span = Math.max(innerWidth, innerHeight);
        var a = aim(px, py, cx, cy, span * 0.3, span * 0.26);
        tx = a[0]; ty = a[1];
        tn = Math.max(0, 1 - Math.hypot(px - cx, py - cy) / (r.width * 0.45));
      }
      var k = reduced ? 30 : 7;
      lx = approach(lx, tx, dt, k);
      ly = approach(ly, ty, dt, k);
      near = approach(near, tn, dt, 8);
      var o = pose(lx, ly, near);
      var bob = reduced ? 0 : Math.sin(now / 620) * 1.6;
      if (!reduced && now > nextBlink) {
        blinkAt = now;
        nextBlink = now + (Math.random() < 0.2 ? 260 : 2200 + Math.random() * 3200);
      }
      var lid = reduced ? 1 : blink((now - blinkAt) / 1000);

      parts.body.setAttribute('transform', tr(o.body.dx, o.body.dy + bob * 0.4));
      parts.head.setAttribute('transform', tr(o.head.dx, o.head.dy + bob) + ' rotate(' + o.head.rot.toFixed(2) + ' 300 560)');
      parts.earL.setAttribute('transform', tr(o.ears.dx, o.ears.dy) + ' translate(138 380) scale(' + o.ears.lead.toFixed(3) + ' 1) translate(-138 -380)');
      parts.earR.setAttribute('transform', tr(o.ears.dx, o.ears.dy) + ' translate(462 380) scale(' + o.ears.trail.toFixed(3) + ' 1) translate(-462 -380)');
      parts.beanie.setAttribute('transform', tr(o.beanie.dx, o.beanie.dy));
      parts.tag.setAttribute('transform', tr(o.tag.dx, o.tag.dy));
      parts.blush.setAttribute('transform', tr(o.blush.dx, o.blush.dy));
      parts.face.setAttribute('transform', tr(o.face.dx, o.face.dy));
      parts.nose.setAttribute('transform', tr(o.nose.dx, o.nose.dy));
      parts.brows.setAttribute('transform', tr(o.brows.dx, o.brows.dy));
      parts.eyes.setAttribute('transform', tr(o.eyes.dx, o.eyes.dy) + ' translate(300 350) scale(' + o.eyes.scale.toFixed(3) + ' ' + (o.eyes.scale * lid).toFixed(3) + ') translate(-300 -350)');
      if (parts.glasses) parts.glasses.setAttribute('transform', tr(o.eyes.dx, o.eyes.dy));
      if (parts.beard) parts.beard.setAttribute('transform', tr(o.blush.dx * 0.9, o.blush.dy * 0.6));

      // grin: the mouth opens wider; while talking it flaps open and shut
      var sx = happy ? 1.06 : 1, sy = happy ? 1.12 : 1;
      if (now < talkUntil && !reduced) sy *= 0.62 + 0.38 * Math.abs(Math.sin(now / 90));
      parts.mouth.setAttribute('transform', sx === 1 && sy === 1 ? '' :
        'translate(300 440) scale(' + sx.toFixed(3) + ' ' + sy.toFixed(3) + ') translate(-300 -440)');
    }
    raf = requestAnimationFrame(frame);

    var io = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      prev = performance.now();
    });
    io.observe(root);

    function destroy() {
      cancelAnimationFrame(raf);
      io.disconnect();
      clearTimeout(hideTimer);
      if (mq.removeEventListener) mq.removeEventListener('change', onMq);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onLeave);
      btn.removeEventListener('click', onClick);
    }

    return api;
  }

  // Static helpers for reuse elsewhere on a page (the room grid, the flower, a still character).
  function staticCharacter(options) {
    return characterSVG(Object.assign({}, DEFAULTS, options || {}), 'mphs' + (++uid));
  }

  global.MascotHero = {
    create: create,
    DEFAULTS: DEFAULTS,
    roomSVG: roomSVG,
    flowerPath: FLOWER,
    staticCharacter: staticCharacter,
    maths: { aim: aim, approach: approach, pose: pose, blink: blink }
  };
})(window);
