/* Home page: the mascot hero and the poster sections below. */
(function () {
  'use strict';
  var esc = Site.esc, idx = Site.idx, chip = Site.chip;
  var TOTAL = 9;
  var touch = window.matchMedia('(hover: none)').matches;

  Site.load().then(build).catch(function (err) {
    document.getElementById('main').insertAdjacentHTML('afterbegin',
      '<p class="load-err">Could not load the content file (' + esc(err.message) + '). Email kunal.ahuja@example.com.</p>');
  });

  function build(d) {
    var company = Site.forCompany();
    var S = d.site;
    D = d;
    var order = ['about', 'numbers', 'work', 'experience', 'journey', 'wins', 'skills', 'contact'];

    hero(d, company);
    about(d, company);
    numbers(d);
    work(d);
    experience(d);
    journey(d);
    wins(d);
    skills(d);
    contact(d);
    footer(d);
    nav(d, order);
    Site.reveal();

  }

  /* ---------------- Section scaffolding ---------------- */

  function room() {
    return '<div class="sec-room" aria-hidden="true">' + MascotHero.roomSVG() + '</div>';
  }
  function secTop(n, s) {
    return '<header class="sec-top rv">' + idx(pad(n) + '/' + pad(TOTAL), s.tag) +
      '<span class="sec-brace" aria-hidden="true">{' + esc(s.brace[0]) + '/' + esc(s.brace[1]) + '}</span></header>';
  }
  function heading(lines, doodle) {
    // doodle: 'star' | 'swash' | 'flower' | 'bracket' | 'vtag:TEXT'
    var out = lines.map(function (l, i) {
      var last = i === lines.length - 1;
      var t = esc(l);
      if (last && doodle === 'swash') {
        var a = Array.from(l);
        t = esc(a.slice(0, -1).join('')) + '<span class="sw">' + esc(a[a.length - 1]) +
          '<svg viewBox="0 0 255 72" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M6 44 C40 18 150 4 222 14 C262 20 258 48 214 58 C150 72 60 70 30 60 C10 53 20 40 60 34"/></svg></span>';
      }
      if (last && doodle === 'bracket') {
        var b = Array.from(l);
        t = esc(b.slice(0, -1).join('')) + '<span class="br">' +
          '<svg viewBox="0 0 100 120" preserveAspectRatio="none" aria-hidden="true"><path class="arc-t" vector-effect="non-scaling-stroke" d="M4 16 Q50 -8 96 16"/><path class="arc-b" vector-effect="non-scaling-stroke" d="M4 104 Q50 128 96 104"/></svg>' + esc(b[b.length - 1]) + '</span>';
      }
      if (last && doodle && doodle.indexOf('vtag:') === 0) {
        t += '<span class="vt" aria-hidden="true"><span>' + esc(doodle.slice(5)) + '</span><i></i></span>';
      }
      if (last && (doodle === 'star' || doodle === 'bracket')) t += '<span class="st" aria-hidden="true">*</span>';
      return '<span class="ln">' + t + '</span>';
    }).join('');
    return '<h2 class="sec-h rv">' + out + '</h2>';
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function flower(cls) {
    return '<span class="flw ' + (cls || '') + '" aria-hidden="true"><svg viewBox="0 0 120 120"><path d="' + MascotHero.flowerPath + '"/><circle cx="60" cy="60" r="4" fill="none" stroke="currentColor" stroke-width="2"/></svg></span>';
  }
  function arrow() { return '<span class="arr" aria-hidden="true">→</span>'; }

  /* ---------------- 01 Hero ---------------- */

  var heroApi = null;

  function hero(d, company) {
    var h = d.site.hero;
    var root = document.querySelector('.hero');
    var props = {
      height: '100svh',
      minHeight: '560px',
      index: h.index, discipline: h.discipline,
      tagline: company ? h.tagline_for.replace('{company}', company) : h.tagline,
      collection: h.collection, collectionHref: '#work',
      reel: h.reel, avatar: d.media.headshot, avatarAlt: 'Kunal Ahuja',
      year: h.year, initials: h.initials, badge: h.badge, badgeHref: '#contact',
      line2: h.line2, line3: h.line3, word: h.word, verticalTag: h.verticalTag, bracketed: h.bracketed,
      headingLabel: h.headingLabel,
      seekingLabel: h.seekingLabel, seeking: h.seeking, href: '#contact',
      services: h.services.map(function (s) { return s[0]; }),
      serviceLinks: h.services.map(function (s) { return s[1]; }),
      greetings: company ? ['Hi ' + company + '! Welcome to Kunal\'s desk.'].concat(h.greetings.slice(1)) : h.greetings,
      skin: '#4f86a8', beanie: '#1d1d1f', shirt: '#55603f', tag: '#5890b9',
      accent: '#b55f9a', paper: '#ebebea', ink: '#111111',
      glasses: true, beard: true,
      characterLabel: 'Kunal\'s desk mascot',
      bubbleMs: 2600,
      onPoke: function () { }
    };
    heroApi = MascotHero.create(root, props);
    if (company) root.classList.add('has-for');

  }

  var D = null;

  /* ---------------- 02 About ---------------- */

  function about(d, company) {
    var s = d.site.sections.about;
    var forLine = company ? '<p class="for-line rv"><b>' + esc(d.pitch.for_company_template.split(':')[0].replace('{company}', company)) + ':</b> ' +
      esc(d.pitch.for_company_template.split(': ').slice(1).join(': ').replace(/\{company\}/g, company)) + '</p>' : '';
    var why = d.pitch.why_hire.map(function (w, i) {
      return '<li class="why rv"><span class="why-n">' + pad(i + 1) + '</span><p>' + esc(w) + '</p></li>';
    }).join('');
    var values = d.values.map(function (v) { return '<li>' + esc(v) + '</li>'; }).join('');
    document.getElementById('about').innerHTML = room() + '<div class="sec-in">' +
      secTop(2, s) +
      '<div class="about-grid">' +
      '<div class="about-text">' + heading(s.title, 'star') + forLine +
      '<p class="lede rv">' + esc(d.pitch.short) + '</p>' +
      '<p class="rv">' + esc(d.about.intro) + '</p>' +
      '<p class="now rv"><span class="now-tag">Now</span>' + esc(d.about.now) + '</p>' +
      '</div>' +
      '<figure class="about-photo rv">' + flower('about-flw') +
      '<img src="' + esc(d.media.professional_alt) + '" alt="Kunal Ahuja mapping the quote approval steps at a whiteboard" width="1154" height="1155" loading="lazy">' +
      '<figcaption class="sticker">At work<sup>@</sup></figcaption></figure>' +
      '</div>' +
      '<h3 class="sub rv">Why hire me</h3><ol class="why-list">' + why + '</ol>' +
      '<div class="values rv"><h3 class="sub">How I work</h3><ul>' + values + '</ul></div>' +
      '</div>';
  }

  /* ---------------- 03 Numbers ---------------- */

  function numbers(d) {
    var s = d.site.sections.numbers;
    var tiles = d.site.numbers.map(function (n, i) {
      return '<li class="num rv num-' + n.kind + '"><a href="' + esc(n.link) + '">' +
        '<span class="num-v' + (n.value.length > 6 ? ' long' : '') + '">' + esc(n.value) + '</span>' +
        '<span class="num-w">' + esc(n.what) + '</span>' +
        '<span class="num-foot">' + chip(n.label, n.kind) + arrow() + '</span></a></li>';
    }).join('');
    var legend = [['own', 'Own record'], ['leadership', 'Leadership-confirmed, not audited']]
      .map(function (k) { return '<li>' + chip(k[1], k[0]) + '</li>'; }).join('');
    document.getElementById('numbers').innerHTML = room() + '<div class="sec-in">' +
      secTop(3, s) +
      '<div class="sec-head">' + heading(s.title, 'swash') +
      '<div class="sec-intro rv"><p>' + esc(s.intro) + '</p><ul class="legend" aria-label="Evidence labels">' + legend + '</ul></div></div>' +
      '<ul class="nums">' + tiles + '</ul></div>';
  }

  /* ---------------- 04 Work ---------------- */

  function cover(p, d) {
    var rc = d.site.covers && d.site.covers[p.slug];
    if (rc) {
      return '<span class="cov cov-res" aria-hidden="true"><span class="cov-room">' + MascotHero.roomSVG() + '</span>' +
        '<span class="cov-num' + (rc[0].length > 5 ? ' long' : '') + '">' + esc(rc[0]) + '</span>' +
        '<span class="cov-what">' + esc(rc[1]) + '</span>' +
        '<span class="cov-chip">' + chip(rc[2]) + '</span>' +
        '<img class="cov-thumb" src="' + esc(p.thumbnail) + '" alt="" width="1600" height="1000" loading="lazy"></span>';
    }
    if (p.slug === 'forecast-playbook') {
      return '<span class="cov cov-ev" aria-hidden="true"><span class="cov-room">' + MascotHero.roomSVG() + '</span>' +
        '<span class="cov-big">6</span><span class="cov-word">Percent</span>' +
        flower('cov-flw') +
        '<span class="cov-pill">forecast miss, down from 19%</span></span>';
    }
    return '<img src="' + esc(p.thumbnail) + '" alt="' + esc(p.title) + ': cover" width="1600" height="1000" loading="lazy">';
  }

  function work(d) {
    var s = d.site.sections.work;
    var cards = d.projects.map(function (p, i) {
      var m = p.metrics[0];
      return '<li class="card rv' + (i === 0 ? ' card-feature' : '') + '"><a href="project.html?p=' + encodeURIComponent(p.slug) + '">' +
        '<span class="card-img">' + cover(p, d) + '</span>' +
        '<span class="card-body">' +
        '<span class="card-top"><b class="card-n">' + pad(i + 1) + '</b><span>' + esc(p.org) + ' · ' + esc(p.year) + '</span></span>' +
        '<span class="card-t">' + esc(p.title) + '</span>' +
        '<span class="card-s">' + esc(p.summary) + '</span>' +
        '<span class="card-m"><b>' + esc(m[0]) + '</b> ' + esc(m[1]) + '</span>' +
        '<span class="card-go">Read the write-up ' + arrow() + '</span>' +
        '</span></a></li>';
    }).join('');
    document.getElementById('work').innerHTML = room() + '<div class="sec-in">' +
      secTop(4, s) +
      '<div class="sec-head">' + heading(s.title, 'bracket') + '<p class="sec-intro rv">' + esc(s.intro) + '</p></div>' +
      '<ul class="cards">' + cards + '</ul></div>';
  }

  /* ---------------- 05 Experience ---------------- */

  function experience(d) {
    var s = d.site.sections.experience;
    var rows = d.experience.map(function (x, i) {
      var pts = x.points.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('');
      return '<li class="xp rv">' +
        '<div class="xp-side"><span class="logo-box"><img src="' + esc(x.logo) + '" alt="' + esc(x.org.split(' (')[0]) + ' logo" loading="lazy"></span>' +
        '<span class="xp-dates">' + esc(x.dates) + '</span></div>' +
        '<div class="xp-main"><h3 class="xp-role">' + esc(x.role) + '</h3><p class="xp-org">' + esc(x.org) + (x.place ? ', ' + esc(x.place) : '') + '</p>' +
        '<ul class="xp-pts">' + pts + '</ul></div></li>';
    }).join('');
    document.getElementById('experience').innerHTML = room() + '<div class="sec-in">' +
      secTop(5, s) + heading(s.title, 'vtag:2019 to now') +
      '<ol class="xps">' + rows + '</ol></div>';
  }

  /* ---------------- 06 Journey and education ---------------- */

  function journey(d) {
    var s = d.site.sections.journey;
    var steps = d.journey.map(function (j, i) {
      return '<li class="step rv"><span class="step-y">' + esc(j.year) + '</span><h3>' + esc(j.title) + '</h3><p>' + esc(j.detail) + '</p></li>';
    }).join('');
    var edu = d.education.map(function (e) {
      var logo = e.logo ? '<img src="' + esc(e.logo) + '" alt="' + esc(e.school) + ' logo" loading="lazy">' :
        '<span class="mono" aria-hidden="true">LFC</span>';
      return '<li class="edu rv"><span class="logo-box">' + logo + '</span><div><h3>' + esc(e.degree) + '</h3><p class="edu-s">' + esc(e.school) + ' · ' + esc(e.years) + '</p><p>' + esc(e.notes) + '</p></div></li>';
    }).join('');
    document.getElementById('journey').innerHTML = room() + '<div class="sec-in">' +
      secTop(6, s) + heading(s.title, 'swash') +
      '<ol class="steps">' + steps + '</ol>' +
      '<h3 class="sub rv">Education</h3><ul class="edus">' + edu + '</ul></div>';
  }

  /* ---------------- 07 Wins ---------------- */

  function wins(d) {
    var s = d.site.sections.wins;
    var withImg = d.wins.filter(function (w) { return w.image; })[0];
    var rest = d.wins.filter(function (w) { return w !== withImg; });
    var feature = withImg ? '<figure class="win-photo rv"><img src="' + esc(withImg.image) + '" alt="' + esc(withImg.title) + '" width="1280" height="853" loading="lazy">' +
      '<figcaption><b>' + esc(withImg.title) + '</b><span>' + esc(withImg.detail) + '</span></figcaption></figure>' : '';
    var list = rest.map(function (w, i) {
      return '<li class="win rv"><span class="win-n">' + pad(i + 1) + '</span><h3>' + esc(w.title) + '</h3><p>' + esc(w.detail) + '</p></li>';
    }).join('');
    var cert = d.certifications.map(function (c) {
      return '<p class="cert rv"><span class="idx"><b>Cert</b>' + esc(c.issuer) + '</span> ' + esc(c.name) + '</p>';
    }).join('');
    document.getElementById('wins').innerHTML = room() + '<div class="sec-in">' +
      secTop(7, s) + heading(s.title, 'star') +
      '<div class="wins-grid">' + feature + '<ul class="win-list">' + list + '</ul></div>' + cert + '</div>';
  }

  /* ---------------- 08 Skills and tools ---------------- */

  function skills(d) {
    var s = d.site.sections.skills;
    var groups = Object.keys(d.skills).map(function (g) {
      return '<div class="sk rv"><h3>' + esc(g) + '</h3><ul>' + d.skills[g].map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
    }).join('');
    var tools = d.tools.map(function (t) {
      return '<li>' + (t.logo ? '<img src="' + esc(t.logo) + '" alt="" width="20" height="20" loading="lazy">' : '<span class="tool-dot" aria-hidden="true"></span>') + esc(t.name) + '</li>';
    }).join('');
    document.getElementById('skills').innerHTML = room() + '<div class="sec-in">' +
      secTop(8, s) + heading(s.title, 'vtag:Toolkit') +
      '<div class="sks">' + groups + '</div>' +
      '<h3 class="sub rv">Tools I use</h3><ul class="tools rv">' + tools + '</ul></div>';
  }

  /* ---------------- 09 Contact ---------------- */

  function contact(d) {
    var s = d.site.sections.contact, c = d.contact;
    var wa = 'https://wa.me/' + c.whatsapp.replace(/\D/g, '');
    var tel = 'tel:' + c.phone.replace(/\s/g, '');
    document.getElementById('contact').innerHTML = room() + '<div class="sec-in">' +
      secTop(9, s) +
      '<div class="contact-grid"><div>' + heading(s.title, 'swash') +
      '<p class="lede rv">Hiring for a sales operations, business operations or revenue operations role? Write to me and I will reply within a day.</p></div>' +
      '<ul class="cta rv">' +
      '<li><button type="button" class="cta-main" data-copy="' + esc(c.email) + '" data-copied="Email copied: ' + esc(c.email) + '"><span class="cta-a">Copy email</span><span class="cta-b">' + esc(c.email) + '</span></button></li>' +
      '<li><a class="cta-row" href="' + esc(c.linkedin) + '" target="_blank" rel="noopener"><span>LinkedIn</span><span>in/example ↗</span></a></li>' +
      (c.phone ? '<li><a class="cta-row" href="' + esc(tel) + '"><span>Call</span><span>' + esc(c.phone) + '</span></a></li>' : '') +
      (c.whatsapp ? '<li><a class="cta-row" href="' + esc(wa) + '" target="_blank" rel="noopener"><span>WhatsApp</span><span>Message me ↗</span></a></li>' : '') +
      '<li><a class="cta-row" href="' + esc(c.resume_pdf) + '" target="_blank" rel="noopener"><span>Resume</span><span>PDF ↗</span></a></li>' +
      '<li><a class="cta-row" href="mailto:' + esc(c.email) + '?subject=' + encodeURIComponent('Call with Kunal') + '"><span>Book a call</span><span>Email me a time</span></a></li>' +
      '</ul></div></div>';
  }

  function footer(d) {
    document.getElementById('foot').innerHTML =
      '<p><b>Kunal Ahuja</b> · Sales and Business Operations · <a href="mailto:' + esc(d.contact.email) + '">' + esc(d.contact.email) + '</a></p>' +
      '<p class="credit">Hero character after <a href="https://21st.dev/@kedhareswer/components/mascot-portfolio-hero" target="_blank" rel="noopener">Mascot Portfolio Hero</a> by Kedhareswer Naidu (MIT).</p>';
  }

  /* ---------------- Nav ---------------- */

  var menuBtn, menu;
  function closeMenu() {
    if (!menu || menu.hidden) return;
    menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
  }

  function nav(d, order) {
    var S = d.site.sections;
    var names = { about: 'About', numbers: 'Numbers', work: 'Work', experience: 'Experience', journey: 'Journey', wins: 'Wins', skills: 'Skills', contact: 'Contact' };
    document.getElementById('navLinks').innerHTML = order.map(function (k) {
      return '<li><a href="#' + k + '">' + names[k] + '</a></li>';
    }).join('');
    document.getElementById('menuList').innerHTML = '<li><a href="#top"><b>01</b>Meet Kunal</a></li>' + order.map(function (k, i) {
      return '<li><a href="#' + k + '"><b>' + pad(i + 2) + '</b>' + names[k] + '</a></li>';
    }).join('');

    var navEl = document.getElementById('nav');
    menuBtn = document.getElementById('menuBtn'); menu = document.getElementById('menu');
    menuBtn.addEventListener('click', function () {
      var open = menu.hidden;
      menu.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('menu-open', open);
      if (open) menu.querySelector('a').focus();
    });
    document.getElementById('menuClose').addEventListener('click', function () { closeMenu(); menuBtn.focus(); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) closeMenu(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { closeMenu(); menuBtn.focus(); } });

    // show the bar once the hero is mostly gone
    var heroEl = document.querySelector('.hero');
    new IntersectionObserver(function (en) {
      navEl.classList.toggle('on', !en[0].isIntersecting);
    }, { threshold: 0, rootMargin: '-35% 0px 0px 0px' }).observe(heroEl);

    // current section number in the index pill
    var num = document.getElementById('navNum'), nm = document.getElementById('navName');
    var links = document.querySelectorAll('#navLinks a');
    var secs = order.map(function (k) { return document.getElementById(k); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var k = en.target.id, i = order.indexOf(k);
        num.textContent = pad(i + 2) + '/' + pad(TOTAL);
        nm.textContent = names[k];
        links.forEach(function (a) { a.classList.toggle('cur', a.getAttribute('href') === '#' + k); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    secs.forEach(function (s) { io.observe(s); });
  }
})();
