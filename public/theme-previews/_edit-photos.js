/* Lets a visitor swap the placeholder photos in a sample site with their own. Everything stays in this browser:
   the picked image is shrunk, kept in localStorage and never uploaded. Photos drawn inside a canvas (3D worlds, games)
   cannot be swapped. */
(function () {
  var SITE = (document.currentScript && document.currentScript.getAttribute("data-site")) || location.pathname.split("/")[2] || "site";
  var KEY = "tp-photos:" + SITE;
  var store = {};
  try { store = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { store = {}; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); return true; } catch (e) { return false; } }
  function pathOf(src) { try { return new URL(src, location.href).pathname; } catch (e) { return src || ""; } }
  function isSlot(path) { return /\/media\/(photos|cutout)\//.test(path); }
  function bgPath(el) {
    var m = /url\(["']?([^"')]+)["']?\)/.exec(getComputedStyle(el).backgroundImage || "");
    return m ? pathOf(m[1]) : "";
  }

  function apply(root) {
    (root.querySelectorAll ? root.querySelectorAll("img") : []).forEach(function (img) {
      var orig = img.getAttribute("data-orig") || pathOf(img.currentSrc || img.src);
      if (!isSlot(orig)) return;
      img.setAttribute("data-orig", orig);
      if (store[orig] && img.src !== store[orig]) { img.removeAttribute("srcset"); img.src = store[orig]; }
    });
    (root.querySelectorAll ? root.querySelectorAll("[style*='background']") : []).forEach(function (el) {
      var orig = el.getAttribute("data-orig") || bgPath(el);
      if (!isSlot(orig)) return;
      el.setAttribute("data-orig", orig);
      if (store[orig]) el.style.backgroundImage = "url(" + store[orig] + ")";
    });
  }

  function shrink(file, done) {
    var r = new FileReader();
    r.onload = function () {
      var im = new Image();
      im.onload = function () {
        var s = Math.min(1, 900 / Math.max(im.width, im.height)), c = document.createElement("canvas");
        c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        done(c.toDataURL("image/jpeg", 0.85));
      };
      im.src = r.result;
    };
    r.readAsDataURL(file);
  }

  var editing = false, pending = null;
  var input = document.createElement("input");
  input.type = "file"; input.accept = "image/*"; input.style.display = "none";
  input.addEventListener("change", function () {
    var f = input.files && input.files[0]; if (!f || !pending) return;
    var orig = pending; pending = null;
    shrink(f, function (data) {
      store[orig] = data;
      if (!save()) { delete store[orig]; note("That photo is too big to keep. Try a smaller one."); return; }
      apply(document); note("Photo replaced. It stays on this device only.");
    });
    input.value = "";
  });

  function hit(x, y) {
    var els = document.elementsFromPoint(x, y);
    for (var i = 0; i < els.length; i++) {
      var el = els[i]; if (el.closest && el.closest("#tp-bar")) return null;
      if (el.tagName === "IMG") { var o = el.getAttribute("data-orig") || pathOf(el.currentSrc || el.src); if (isSlot(o)) return o; }
      var b = bgPath(el); if (isSlot(b)) return b;
    }
    return null;
  }

  var style = document.createElement("style");
  style.textContent =
    "#tp-bar{position:fixed;top:10px;right:10px;z-index:2147483000;font:600 12px/1.2 system-ui,sans-serif;display:flex;gap:6px;align-items:center}" +
    "#tp-bar button{font:inherit;cursor:pointer;border:1px solid rgba(0,0,0,.25);background:#fff;color:#111;border-radius:999px;padding:7px 12px;box-shadow:0 2px 8px rgba(0,0,0,.25)}" +
    "#tp-bar button[aria-pressed=true]{background:#111;color:#fff}" +
    "#tp-note{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483000;background:#111;color:#fff;font:500 13px system-ui,sans-serif;padding:9px 14px;border-radius:8px;display:none}" +
    "body.tp-edit img[data-orig],body.tp-edit [data-orig]{outline:2px dashed #3b6bff !important;outline-offset:-2px;cursor:copy !important}";
  document.head.appendChild(style);

  var bar = document.createElement("div"); bar.id = "tp-bar";
  var edit = document.createElement("button"); edit.type = "button"; edit.textContent = "Replace photos"; edit.setAttribute("aria-pressed", "false");
  var reset = document.createElement("button"); reset.type = "button"; reset.textContent = "Reset"; reset.title = "Put the sample photos back";
  bar.appendChild(edit); bar.appendChild(reset); bar.appendChild(input);
  var noteEl = document.createElement("div"); noteEl.id = "tp-note"; noteEl.setAttribute("role", "status");
  var timer;
  function note(t) { noteEl.textContent = t; noteEl.style.display = "block"; clearTimeout(timer); timer = setTimeout(function () { noteEl.style.display = "none"; }, 3200); }

  edit.addEventListener("click", function () {
    editing = !editing; edit.setAttribute("aria-pressed", String(editing)); document.body.classList.toggle("tp-edit", editing);
    edit.textContent = editing ? "Done" : "Replace photos";
    if (editing) { apply(document); note("Click any outlined photo to choose your own."); }
  });
  reset.addEventListener("click", function () { store = {}; try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); });

  document.addEventListener("click", function (e) {
    if (!editing) return;
    var o = hit(e.clientX, e.clientY); if (!o) return;
    e.preventDefault(); e.stopPropagation(); pending = o; input.click();
  }, true);

  function start() {
    document.body.appendChild(bar); document.body.appendChild(noteEl); apply(document);
    new MutationObserver(function (list) { list.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) { if (n.tagName === "IMG") apply({ querySelectorAll: function () { return [n]; } }); apply(n); } }); }); })
      .observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
