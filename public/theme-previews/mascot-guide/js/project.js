/* Project write-up page: project.html?p=<slug> */
(function () {
  'use strict';
  var esc = Site.esc, chip = Site.chip;

  var ALT = {
    'channels.jpg': 'Chart: accounts by territory',
    'at-work-office.webp': 'Kunal Ahuja mapping the quote approval steps at a whiteboard',
    'event-classroom-readout.jpg': 'Kunal Ahuja presenting the Tamarack readout in an Ashgrove School of Management class'
  };

  Site.load().then(render).catch(function (e) {
    document.getElementById('pj').innerHTML = '<p class="load-err">Could not load this project (' + esc(e.message) + '). <a href="index.html">Back to the portfolio</a>.</p>';
  });

  function shortTitle(t) { return (t.indexOf(': ') > -1 ? t.split(': ') : t.split(/ (?=at )/))[0]; }
  function cap(s) { s = String(s || '').trim(); return s.charAt(0).toUpperCase() + s.slice(1); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // "Higher conversion; label: own record" -> { text: "Higher conversion", label: "Own record" }
  function splitNote(note) {
    var parts = String(note || '').split(';').map(function (s) { return s.trim(); }).filter(Boolean);
    var text = [], label = '';
    parts.forEach(function (p) {
      var clean = p.replace(/^label:\s*/i, '');
      if (!label && Site.kindOf(clean) !== 'note') label = cap(clean);
      else text.push(cap(p));
    });
    return { text: text.join('. '), label: label };
  }

  function render(d) {
    var slug = new URLSearchParams(location.search).get('p');
    var list = d.projects;
    var i = list.findIndex(function (p) { return p.slug === slug; });
    if (i < 0) i = 0;
    var p = list[i], pg = d.project_pages[p.slug] || {};
    document.title = p.title + ' · Kunal Ahuja';
    document.getElementById('pjBrace').textContent = '{' + p.org + '/' + p.year + '}';

    var parts = p.title.indexOf(': ') > -1 ? p.title.split(': ') : p.title.split(/ (?=at )/);
    var big = parts[0], small = parts.slice(1).join(': ');
    // keep the last word and the asterisk together so the * never sits alone
    var bw = big.split(' '), lastW = bw.pop();
    var bigHTML = esc(bw.join(' ')) + (bw.length ? ' ' : '') + (lastW.length > 12 ? esc(lastW) + '\u2060<span class="st" aria-hidden="true">*</span>' :
      '<span class="nb">' + esc(lastW) + '<span class="st" aria-hidden="true">*</span></span>');

    var facts = [
      ['Role', pg.my_role || p.role],
      ['When', (pg.dates || p.duration || p.year).split(' (')[0]],
      ['Where', p.org],
      ['Team', p.team]
    ].filter(function (f) { return f[1]; }).map(function (f) {
      return '<li><span>' + esc(f[0]) + '</span>' + esc(f[1]) + '</li>';
    }).join('');

    var results = (pg.results && pg.results.length ? pg.results : p.metrics.map(function (m) { return { metric: m[1], value: m[0], note: '' }; }))
      .map(function (r) {
        var n = splitNote(r.note);
        return '<li class="pj-num rv"><span class="num-v">' + esc(r.value) + '</span><span class="pj-num-m">' + esc(r.metric) + '</span>' +
          (n.text ? '<span class="pj-num-t">' + esc(n.text) + '</span>' : '') + (n.label ? chip(n.label) : '') + '</li>';
      }).join('');

    var block = function (title, html) { return html ? '<section class="pj-block rv"><h2 class="pj-label">' + esc(title) + '</h2><div class="pj-text">' + html + '</div></section>' : ''; };
    var did = (pg.what_i_did || []).map(function (w, k) { return '<li><b>' + pad(k + 1) + '</b><span>' + esc(w) + '</span></li>'; }).join('');
    var decisions = (pg.decisions || []).map(function (x) { return '<div class="pj-dec"><h3>' + esc(x.choice) + '</h3><p>' + esc(x.why) + '</p></div>'; }).join('');

    var imgs = (pg.images && pg.images.length ? pg.images : [p.thumbnail]);
    var lead = imgs[0];
    var rest = imgs.slice(1).map(function (src) {
      var file = src.split('/').pop();
      var alt = ALT[file] || (file === 'flow.jpg' ? 'Diagram: how ' + big + ' works' : p.title);
      var photo = /photos\//.test(src);
      return '<figure class="pj-fig rv' + (photo ? ' pj-photo' : '') + '"><img src="' + esc(src) + '" alt="' + esc(alt) + '" loading="lazy"></figure>';
    }).join('');

    var prev = list[(i - 1 + list.length) % list.length], next = list[(i + 1) % list.length];
    var tags = p.tags.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');

    document.getElementById('pj').innerHTML =
      '<header class="pj-head">' +
      '<div class="sec-room" aria-hidden="true">' + MascotHero.roomSVG() + '</div>' +
      '<div class="sec-in">' +
      '<div class="sec-top">' + Site.idx('Project ' + pad(i + 1) + '/' + pad(list.length), p.type) + '<ul class="pj-tags">' + tags + '</ul></div>' +
      '<h1 class="pj-h"><span class="pj-big">' + bigHTML + '</span>' + (small ? '<span class="pj-small">' + esc(small) + '</span>' : '') + '</h1>' +
      '<p class="lede pj-lede">' + esc(p.summary) + '</p>' +
      '<ul class="pj-facts">' + facts + '</ul>' +
      (pg.dates && pg.dates.indexOf(' (') > -1 ? '<p class="pj-datenote">' + esc(cap(pg.dates.split(' (')[1].replace(/\)$/, ''))) + '.</p>' : '') +
      '</div></header>' +
      '<div class="sec-in">' +
      '<figure class="pj-lead"><img src="' + esc(lead) + '" alt="' + esc(p.title) + ': cover" width="1600" height="1000"></figure>' +
      '<h2 class="sub">Results</h2><ul class="pj-nums">' + results + '</ul>' +
      '<div class="pj-body">' +
      block('Context', pg.context ? '<p>' + esc(pg.context) + '</p>' : '') +
      block('Problem', pg.problem ? '<p>' + esc(pg.problem) + '</p>' : '') +
      block('What I did', did ? '<ol class="pj-did">' + did + '</ol>' : '') +
      block('Decision', decisions) +
      block('What I learned', pg.learned ? '<p>' + esc(pg.learned) + '</p>' : '') +
      block('Next', pg.next ? '<p>' + esc(pg.next) + '</p>' : '') +
      '</div>' +
      (rest ? '<div class="pj-gallery">' + rest + '</div>' : '') +
      '<div class="pj-cta rv"><p><b>Want the detail behind this?</b> Email me and I will send the working sheet.</p>' +
      '<div class="pj-cta-b">' +
      '<button type="button" class="pj-copy" data-copy="' + esc(d.contact.email) + '" data-copied="Email copied: ' + esc(d.contact.email) + '">Copy email</button></div></div>' +
      '<nav class="pj-pn" aria-label="More projects">' +
      '<a class="pj-prev" href="project.html?p=' + encodeURIComponent(prev.slug) + '"><span>← Previous</span><b>' + esc(shortTitle(prev.title)) + '</b></a>' +
      '<a class="pj-next" href="project.html?p=' + encodeURIComponent(next.slug) + '"><span>Next →</span><b>' + esc(shortTitle(next.title)) + '</b></a>' +
      '</nav></div>';

    document.getElementById('foot').innerHTML =
      '<p><b>Kunal Ahuja</b> · <a href="index.html">Portfolio</a> · <a href="mailto:' + esc(d.contact.email) + '">' + esc(d.contact.email) + '</a> · <a href="' + esc(d.contact.linkedin) + '" target="_blank" rel="noopener">LinkedIn</a></p>' +
      '<p class="credit">Poster style after Mascot Portfolio Hero by Kedhareswer Naidu (MIT).</p>';
    Site.reveal();
  }
})();
