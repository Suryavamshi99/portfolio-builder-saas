#!/usr/bin/env node
/**
 * Reads a downloaded sample portfolio site as plain text (never runs it) and prints a design fingerprint:
 * fonts, colours, layout and effect techniques, section outline, scripted behaviours. The fingerprint carries no
 * visible text from the sample, so it is safe to keep as a theme's code-derived reference.
 *
 *   node scripts/theme-brief/extract.mjs <sample-folder-with-index.html> > src/server/themes/reference/<id>.txt
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2];
if (!root) throw new Error("usage: extract.mjs <sample-folder>");

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? (/vendor|node_modules|media|fonts/.test(f) ? [] : walk(join(d, f))) : [join(d, f)]));
const files = walk(root);
const read = (ext) => files.filter((f) => f.endsWith(ext)).map((f) => readFileSync(f, "utf8")).join("\n");
const html = readFileSync(join(root, "index.html"), "utf8");
const css = read(".css") + (html.match(/<style[^>]*>([\s\S]*?)<\/style>/g) ?? []).join("\n");
const js = files.filter((f) => f.endsWith(".js") && !/vendor|\.min\./.test(f)).map((f) => readFileSync(f, "utf8")).join("\n");

// The samples ship a voice-agent widget we do not use; keep its names out of the fingerprint.
const VOICE = /agent|elevenlabs|livesession|waveform|convo|^va-|preview(brain|session)/i;
const uniq = (a) => [...new Set(a)].filter((x) => !VOICE.test(String(x)));
const fonts = uniq([...css.matchAll(/font-family\s*:\s*([^;}{]+)/g)].map((m) => m[1].trim().split(",")[0].replace(/["']/g, "")).filter((f) => !/^(inherit|var|system|ui-|sans|serif|monospace|-apple)/i.test(f))).slice(0, 8);
const rootVars = [...(css.match(/:root\s*{[^}]*}/g) ?? [])].join(" ");
const colors = uniq([...rootVars.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})/g)].map((m) => `${m[1]} ${m[2]}`)).slice(0, 16);
const has = (re) => re.test(css);
const layout = [
  ["CSS grid layouts", /display\s*:\s*grid/],
  ["flex layouts", /display\s*:\s*flex/],
  ["sticky elements", /position\s*:\s*sticky/],
  ["scroll snap", /scroll-snap/],
  ["clip-path shapes", /clip-path/],
  ["blend modes", /mix-blend-mode/],
  ["backdrop blur", /backdrop-filter/],
  ["3D transforms", /perspective|translate3d|rotate[XY]\(/],
  ["CSS keyframe animation", /@keyframes/],
  ["marquee or ticker motion", /marquee|ticker/i],
  ["SVG filters or masks", /filter\s*:\s*url|mask/],
  ["custom cursor", /cursor\s*:\s*(none|url)/],
  ["dark colour scheme", /color-scheme\s*:\s*dark/],
  ["reduced-motion handling", /prefers-reduced-motion/],
]
  .filter(([, re]) => has(re))
  .map(([n]) => n);
const keyframes = uniq([...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1])).slice(0, 12);
const tech = [
  ["canvas 2D drawing", /getContext\(['"]2d/],
  ["WebGL or three.js scene", /WebGLRenderer|THREE\.|getContext\(['"]webgl/],
  ["GSAP animation", /gsap\./],
  ["scroll-triggered animation", /ScrollTrigger|IntersectionObserver/],
  ["smooth scrolling", /Lenis|scrollTo\(/],
  ["pointer drag interaction", /pointerdown|mousedown|touchstart/],
  ["keyboard controls", /keydown/],
  ["web audio sound", /AudioContext/],
  ["requestAnimationFrame loop", /requestAnimationFrame/],
  ["hash or history routing", /hashchange|history\.(push|replace)State/],
  ["localStorage state", /localStorage/],
  ["SVG charts drawn by script", /createElementNS|<svg/],
]
  .filter(([, re]) => re.test(js))
  .map(([n]) => n);
const fns = uniq([...js.matchAll(/function\s+([A-Za-z_]\w{3,})\s*\(/g)].map((m) => m[1])).slice(0, 30);

const outline = [];
for (const m of html.matchAll(/<(header|nav|main|section|aside|article|footer|dialog)\b([^>]*)>/g)) {
  const id = /id="([^"]+)"/.exec(m[2])?.[1];
  const cls = /class="([^"]+)"/.exec(m[2])?.[1]?.split(/\s+/)[0];
  outline.push(`${m[1]}${id ? "#" + id : ""}${cls ? "." + cls : ""}`);
}
const heads = [...html.matchAll(/<h([12])[^>]*class="([^"]+)"/g)].map((m) => `h${m[1]}.${m[2].split(/\s+/)[0]}`).slice(0, 6);

const line = (k, v) => (v.length ? `${k}: ${Array.isArray(v) ? v.join(", ") : v}\n` : "");
process.stdout.write(
  line("Fonts used", fonts) + line("Colour tokens", colors) + line("Visual techniques", layout) + line("Named animations", keyframes) +
    line("Scripted behaviours", tech) + line("Script functions (hint at features)", fns) + line("Page outline (landmarks)", outline.slice(0, 24)) + line("Heading classes", heads),
);
