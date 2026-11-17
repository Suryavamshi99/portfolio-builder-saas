/* Shared helpers for index.html and project.html. */
(function (global) {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function load() {
    return fetch('content/portfolio.json').then(function (r) {
      if (!r.ok) throw new Error('content ' + r.status);
      return r.json();
    });
  }

  // ?for=Company, escaped by callers and capped to 40 characters of plain text.
  function forCompany() {
    var v = new URLSearchParams(location.search).get('for');
    if (!v) return '';
    v = v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40);
    return v;
  }

  var toastTimer = 0;
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('on'); }, 2200);
  }

  function copy(text, done) {
    var ok = function () { toast(done || 'Copied'); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(ok, function () { fallback(); });
    } else fallback();
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); ok(); } catch (e) { toast(text); }
      ta.remove();
    }
  }

  // Elements with [data-copy] copy their value on click.
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy]');
    if (!b) return;
    e.preventDefault();
    copy(b.getAttribute('data-copy'), b.getAttribute('data-copied') || 'Copied');
  });

  // Reveal on scroll (off for reduced motion).
  function reveal(scope) {
    var els = (scope || document).querySelectorAll('.rv:not(.in)');
    if (REDUCED || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach(function (el) { io.observe(el); });
  }

  // Index pill like the poster's "08/01".
  function idx(num, label) {
    return '<span class="idx"><b>' + esc(num) + '</b>' + esc(label) + '</span>';
  }

  // Evidence label chip. kind: leadership | own
  function kindOf(label) {
    var l = String(label || '').toLowerCase();
    if (l.indexOf('not audited') > -1 || l.indexOf('leadership') > -1) return 'leadership';
    if (l.indexOf('own record') > -1) return 'own';
    return 'note';
  }
  function chip(label, kind) {
    if (!label) return '';
    return '<span class="ev ev-' + (kind || kindOf(label)) + '">' + esc(label) + '</span>';
  }

  global.Site = { esc: esc, load: load, forCompany: forCompany, toast: toast, copy: copy, reveal: reveal, idx: idx, chip: chip, kindOf: kindOf, REDUCED: REDUCED };
})(window);
