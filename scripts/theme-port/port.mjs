#!/usr/bin/env node
/**
 * Turns one Portfolio Wall sample site into a single self-contained theme template.
 *
 *   node scripts/theme-port/port.mjs <theme-id>
 *
 * The sample folder is untrusted downloaded data: this script only READS its files (HTML, CSS, JS, JSON) as text.
 * It never runs anything from the sample folder and never runs a package manager or build tool inside it.
 *
 * What it does, in order:
 *   1. inlines the sample's own stylesheets and scripts (ES-module graphs are bundled with esbuild)
 *   2. drops local font files (a Google Fonts link replaces them), sample media and the voice-agent widget
 *   3. swaps the sample person's name for placeholders that a small runtime script fills from the page's data island
 *   4. makes the sample's own `fetch("content/portfolio.json")` read the data island instead
 *   5. checks that no sample name, voice-agent code or local asset path is left
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import { build } from "esbuild";
import { THEMES, SAMPLES_ROOT } from "./themes.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");

const SENTINEL = {
  FULL: "⟦FULL⟧",
  FIRST: "⟦FIRST⟧",
  LAST: "⟦LAST⟧",
  INITIALS: "⟦INITIALS⟧",
};

const read = (p) => readFileSync(p, "utf8");

function sampleRoot(cfg) {
  const base = join(SAMPLES_ROOT, cfg.sample);
  const inner = join(base, cfg.inner);
  if (!existsSync(inner)) throw new Error(`sample folder missing: ${inner}`);
  return inner;
}

/** Library files come from the official npm packages (pinned in package.json), not from the sample's copies. */
function vendorAlias() {
  const nm = (p) => join(repo, "node_modules", p);
  return {
    "gsap.min.js": nm("gsap/dist/gsap.min.js"),
    "ScrollTrigger.min.js": nm("gsap/dist/ScrollTrigger.min.js"),
    "Draggable.min.js": nm("gsap/dist/Draggable.min.js"),
    "Flip.min.js": nm("gsap/dist/Flip.min.js"),
    "lenis.min.js": nm("lenis/dist/lenis.min.js"),
    "three.module.min.js": nm("three/build/three.module.min.js"),
  };
}

function processCss(css, cfg, report) {
  const families = new Set();
  css = css.replace(/@font-face\s*{[^}]*}/g, (block) => {
    const m = block.match(/font-family\s*:\s*["']?([^;"']+)/);
    if (m) families.add(m[1].trim());
    report.fontFaces++;
    return "";
  });
  for (const [from, to] of Object.entries(cfg.fontMap ?? {})) css = css.split(from).join(to);
  css = css.replace(/url\(\s*(['"]?)(?!data:|#)([^)'"]+)\1\s*\)/g, () => {
    report.cssUrlsDropped++;
    return 'url("data:,")';
  });
  return { css, families };
}

function replaceNames(text, cfg) {
  const { first, last } = cfg.person;
  const full = `${first} ${last}`;
  let out = text;
  for (const [needle, token] of [
    [full.toUpperCase(), SENTINEL.FULLUP],
    [last.toUpperCase(), SENTINEL.LASTUP],
    [first.toUpperCase(), SENTINEL.FIRSTUP],
    [full, SENTINEL.FULL],
    [`${first}&nbsp;${last}`, SENTINEL.FULL],
    [last, SENTINEL.LAST],
    [first, SENTINEL.FIRST],
    ...(cfg.initials ? [[cfg.initials, SENTINEL.INITIALS]] : []),
  ]) {
    out = out.split(needle).join(token);
  }
  return out;
}

async function bundleModule(entry, cfg) {
  const alias = vendorAlias();
  const res = await build({
    entryPoints: [entry],
    bundle: true,
    format: "iife",
    write: false,
    minify: true,
    legalComments: "none",
    target: "es2020",
    logLevel: "silent",
    plugins: [
      {
        name: "official-vendor",
        setup(b) {
          b.onResolve({ filter: /vendor\// }, (a) => {
            const file = a.path.split("/").pop();
            if (alias[file]) return { path: alias[file] };
            return undefined;
          });
        },
      },
    ],
  });
  return res.outputFiles[0].text;
}

const RESOLVER = `(function(){var D={};try{D=JSON.parse(document.getElementById("folio-data").textContent)}catch(e){}var P=D.person||{},F=P.first_name||"",L=P.last_name||"";var M={"${SENTINEL.FULL}":(F+" "+L).trim(),"${SENTINEL.FIRST}":F,"${SENTINEL.LAST}":L,"${SENTINEL.INITIALS}":((F[0]||"")+(L[0]||"")).toUpperCase(),"${SENTINEL.FULLUP}":(F+" "+L).trim().toUpperCase(),"${SENTINEL.FIRSTUP}":F.toUpperCase(),"${SENTINEL.LASTUP}":L.toUpperCase()};var RE=/\\u27E6(FULL|FIRST|LAST|INITIALS|FULLUP|FIRSTUP|LASTUP)\\u27E7/g;function fx(s){return s.replace(RE,function(m){return M[m]})}function has(s){return s.indexOf("\\u27E6")>-1}function walk(n){if(n.nodeType===3){if(has(n.nodeValue))n.nodeValue=fx(n.nodeValue)}else if(n.nodeType===1){for(var i=0;i<n.attributes.length;i++){var a=n.attributes[i];if(has(a.value))a.value=fx(a.value)}for(var c=n.firstChild;c;c=c.nextSibling)walk(c)}}walk(document.documentElement);new MutationObserver(function(ms){ms.forEach(function(m){if(m.type==="childList")m.addedNodes.forEach(walk);else walk(m.target)})}).observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true})})();`;

/** The sample's content file reduced to its shape: strings become "", lists [], numbers 0. No sample text is kept. */
function skeletonOf(v) {
  if (Array.isArray(v)) return [];
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, skeletonOf(x)]));
  if (typeof v === "number") return 0;
  if (typeof v === "boolean") return false;
  return "";
}

const fetchShim = (skeleton) => `(function(){var SK=${JSON.stringify(skeleton)};function mg(a,b){if(b===undefined||b===null)return a;if(Array.isArray(a)||typeof a!=="object"||a===null)return b;var o={};for(var k in a)o[k]=mg(a[k],b[k]);for(var k2 in b)if(!(k2 in o))o[k2]=b[k2];return o}var E;function mk(){var f=function(){return E};E=new Proxy(f,{get:function(t,k){if(k===Symbol.toPrimitive)return function(){return ""};if(k==="length")return 0;if(k==="map"||k==="filter"||k==="flatMap"||k==="slice"||k==="concat"||k==="flat")return function(){return []};if(k==="join"||k==="toString"||k==="trim"||k==="replace"||k==="replaceAll"||k==="toLowerCase"||k==="toUpperCase"||k==="padStart"||k==="split"&&0)return function(){return ""};if(k==="split")return function(){return []};if(k==="forEach"||k==="some"||k==="every")return function(){return k==="every"};if(k==="includes"||k==="startsWith"||k==="endsWith")return function(){return false};if(k==="find"||k==="findIndex")return function(){return k==="find"?undefined:-1};if(k===Symbol.iterator)return function(){return [][Symbol.iterator]()};if(k==="then"||k==="toJSON")return undefined;return E},apply:function(){return E},ownKeys:function(){return []},has:function(){return false}});return E}mk();function tol(v){if(v===null||typeof v!=="object")return v;if(Array.isArray(v)){return new Proxy(v.map(tol),{get:function(t,k){if(typeof k==="string"&&/^\\d+$/.test(k)&&!(k in t))return E;return Reflect.get(t,k)}})}var o={};for(var k in v)o[k]=tol(v[k]);return new Proxy(o,{get:function(t,k){if(k in t||typeof k==="symbol"||k==="then"||k==="toJSON")return Reflect.get(t,k);return E}})}var of=window.fetch;window.fetch=function(u){if(/content\\/portfolio\\.json/.test(String(u))){var el=document.getElementById("folio-data"),d={};try{d=JSON.parse(el.textContent)}catch(e){}var r=new Response("{}",{status:200,headers:{"content-type":"application/json"}});var m=mg(SK,d);r.json=function(){return Promise.resolve(tol(m))};return Promise.resolve(r)}return of?of.apply(this,arguments):Promise.reject(new Error("blocked"))}})();`;

export async function port(id) {
  const cfg = THEMES[id];
  if (!cfg) throw new Error(`unknown theme ${id}`);
  const root = sampleRoot(cfg);
  const report = { fontFaces: 0, cssUrlsDropped: 0, patches: 0, mediaRefs: 0 };
  const $ = cheerio.load(read(join(root, "index.html")));

  // 1. styles, in document order
  let css = "";
  const families = new Set();
  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (/^https?:/.test(href) || /agent\//.test(href)) return;
    const p = join(root, href);
    if (!existsSync(p)) return;
    const r = processCss(read(p), cfg, report);
    r.families.forEach((f) => families.add(f));
    css += `\n/* ${href} */\n${r.css}`;
  });
  $("style").each((_, el) => {
    const r = processCss($(el).html() ?? "", cfg, report);
    r.families.forEach((f) => families.add(f));
    css += `\n${r.css}`;
    $(el).remove();
  });

  // 2. scripts, in document order
  let js = "";
  const scripts = $("script").toArray();
  for (const el of scripts) {
    const src = $(el).attr("src");
    const type = $(el).attr("type");
    if (src) {
      if (/agent\/|elevenlabs|libsamplerate/i.test(src)) continue;
      const file = src.split("/").pop();
      const alias = vendorAlias();
      if (alias[file]) js += `;\n${read(alias[file])}\n`;
      else if (type === "module") js += `;\n${await bundleModule(join(root, src), cfg)}\n`;
      else js += `;\n${read(join(root, src))}\n`;
    } else {
      const body = $(el).html() ?? "";
      if (type === "module") {
        const tmp = join(repo, "node_modules/.cache/theme-port");
        mkdirSync(tmp, { recursive: true });
        const f = join(tmp, `${id}-inline.mjs`);
        writeFileSync(f, body.replace(/from\s+(['"])\.\//g, `from $1${root}/`));
        js += `;\n${await bundleModule(f, cfg)}\n`;
      } else if (!/folio-data/.test(body)) js += `;\n${body}\n`;
    }
  }

  // 3. body markup without scripts, links and local media
  $("script, link, style, noscript").remove();
  const body = $("body");
  body.find("[src^='media/'], [src^='./media/']").each((_, el) => {
    report.mediaRefs++;
    $(el).removeAttr("src");
  });
  const bodyAttrs = Object.entries(body.attr() ?? {})
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, "&quot;")}"`)
    .join(" ");
  const htmlLang = $("html").attr("lang") ?? "en";
  let bodyHtml = body.html() ?? "";

  // 4. theme-specific patches (each must match exactly the stated number of times)
  const patch = (text, where) => {
    for (const p of cfg.patches ?? []) {
      if (p.in !== where) continue;
      const count = text.split(p.from).length - 1;
      if (count !== (p.count ?? 1)) throw new Error(`${id}: patch "${p.from.slice(0, 50)}" in ${where} matched ${count}, expected ${p.count ?? 1}`);
      text = text.split(p.from).join(p.to);
      report.patches++;
    }
    return text;
  };
  css = patch(css, "css");
  js = patch(js, "js");
  bodyHtml = patch(bodyHtml, "html");

  // 5. names, then fonts
  for (const [from, to] of Object.entries(cfg.jsRename ?? {})) js = js.replace(new RegExp(`\\b${from}\\b`, "g"), to);
  css = replaceNames(css, cfg);
  js = replaceNames(js, cfg);
  bodyHtml = replaceNames(bodyHtml, cfg);

  const gfonts = (cfg.googleFonts ?? []).map((f) => `family=${f}`).join("&");
  const fontLink = gfonts
    ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?${gfonts}&display=swap">`
    : "";

  const title = replaceNames($("title").text() || "Portfolio", cfg);
  const out = `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${title}</title>
<!--FOLIO_OPTIONS-->
${fontLink}
<style>${css}
</style>
</head>
<body ${bodyAttrs}>
<script type="application/json" id="folio-data">__FOLIO_DATA__</script>
<script>${fetchShim(skeletonOf(JSON.parse(read(join(root, "content/portfolio.json")))))}</script>
${bodyHtml}
<script>${js.replace(/<\/script/gi, "<\\/script")}</script>
<script>${RESOLVER}</script>
</body>
</html>
`;

  // 6. safety checks: nothing of the sample may remain
  const banned = [cfg.person.first, cfg.person.last, ...(cfg.extraBanned ?? [])];
  for (const b of banned) {
    if (out.includes(b)) throw new Error(`${id}: sample text "${b}" is still in the output`);
  }
  if (/elevenlabs|conversational-ai|libsamplerate/i.test(out)) throw new Error(`${id}: voice-agent code is still in the output`);
  if (/\bsrc=["'](media|fonts)\//.test(bodyHtml)) throw new Error(`${id}: a local asset reference is left in the markup`);
  report.mediaRefsInScript = (js.match(/media\//g) ?? []).length;

  const dir = join(repo, "src/server/themes", id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "template.html"), out);
  return { id, bytes: out.length, families: [...families], report };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ids = process.argv.slice(2);
  if (ids.length === 0) {
    console.error("usage: node scripts/theme-port/port.mjs <theme-id>...");
    process.exit(1);
  }
  for (const id of ids) {
    const r = await port(id);
    console.log(JSON.stringify(r));
  }
}
