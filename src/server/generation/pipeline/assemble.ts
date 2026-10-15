import type { ProfileLinks } from "@/server/llm";

import type { BuildInput, Plan, PlanSection } from "./types";

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const BLOCKED_TAG = /<\s*(script|iframe|object|embed|link|meta|base|form|style)\b[\s\S]*?(<\/\s*\1\s*>|$)/gi;
const EVENT_ATTR = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;

/**
 * Takes a model's reply for one page part and returns the single <section> element it asked for,
 * or null when there is nothing usable. Strips fences, scripts and event handlers.
 */
export function cleanFragment(raw: string, id: string, className: string): string | null {
  let text = raw.trim();
  const fenced = /```(?:html)?\s*([\s\S]*?)```/i.exec(text);
  if (fenced?.[1]) text = fenced[1].trim();
  const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(text);
  if (body?.[1]) text = body[1].trim();
  const first = text.search(/<section\b/i);
  if (first === -1) return null;
  text = text.slice(first);
  const last = text.toLowerCase().lastIndexOf("</section>");
  if (last === -1) return null;
  text = text.slice(0, last + "</section>".length);
  text = text.replace(BLOCKED_TAG, "").replace(EVENT_ATTR, "");

  // Exactly one top-level section with the id and class we expect (the model may rename them).
  const opening = /^<section\b[^>]*>/i.exec(text);
  if (!opening) return null;
  text = `<section id="${id}" class="${className}">${text.slice(opening[0].length)}`;
  const visible = text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  if (visible.length < 25) return null;
  const opens = (text.match(/<section\b/gi) ?? []).length;
  const closes = (text.match(/<\/section>/gi) ?? []).length;
  if (opens !== closes) return null;
  return text;
}

export function linksHtml(links: ProfileLinks, cls = "links"): string {
  const items: Array<[string, string]> = [];
  if (links.linkedin) items.push(["LinkedIn", links.linkedin]);
  if (links.github) items.push(["GitHub", links.github]);
  (links.githubProjects ?? []).forEach((u, i) => items.push([`Project ${i + 1}`, u]));
  (links.other ?? []).forEach((o) => items.push([o.label, o.url]));
  if (items.length === 0) return "";
  return `<div class="${cls}">${items.map(([label, url]) => `<a class="btn" href="${esc(url)}" rel="noopener noreferrer">${esc(label)}</a>`).join("")}</div>`;
}

function fontsHref(plan: Plan): string {
  const fam = (n: string, w: string) => `family=${encodeURIComponent(n).replace(/%20/g, "+")}:wght@${w}`;
  const parts = [fam(plan.theme.fonts.display, "500;700;800")];
  if (plan.theme.fonts.body !== plan.theme.fonts.display) parts.push(fam(plan.theme.fonts.body, "400;500;600"));
  return `https://fonts.googleapis.com/css2?${parts.join("&")}&display=swap`;
}

/** The finished document. The navigation and footer are made here, so their anchors always match the sections. */
export function assembleDocument(plan: Plan, css: string, fragments: Record<string, string>, input: BuildInput): string {
  const nav = plan.sections.map((s) => `<a href="#${s.id}">${esc(s.title)}</a>`).join("");
  const sections = plan.sections.map((s) => fragments[s.id] ?? "").join("\n");
  const title = plan.headline ? `${plan.name} | ${plan.headline}` : plan.name;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${plan.tagline ? `<meta name="description" content="${esc(plan.tagline)}">` : ""}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${fontsHref(plan)}" rel="stylesheet">
<style>
${css}
</style>
</head>
<body>
<header class="top"><nav><a class="brand" href="#top">${esc(plan.name)}</a><div class="navlinks">${nav}</div></nav></header>
<main>
${fragments["hero"] ?? ""}
${sections}
</main>
<footer class="foot"><span>${esc(plan.name)}</span>${linksHtml(input.links)}</footer>
</body>
</html>`;
}

/** Which page parts contain a piece of text (used to redo only the part with an unsupported claim). */
export function keysContaining(fragments: Record<string, string>, text: string): string[] {
  const needle = text.toLowerCase();
  return Object.entries(fragments)
    .filter(([, html]) => html.replace(/<[^>]+>/g, " ").toLowerCase().includes(needle))
    .map(([key]) => key);
}

export function planSectionIds(plan: Plan): string[] {
  return plan.sections.map((s: PlanSection) => s.id);
}

/**
 * A small model sometimes ignores the photo it was given. The photo is the user's own choice, so it is put in the hero
 * by code when the model's hero does not show it.
 */
export function ensurePhoto(hero: string, plan: Plan, input: BuildInput): string {
  const url = input.photoUrl;
  if (!url || hero.includes(url) || hero.includes(esc(url))) return hero;
  const img = `<img src="${esc(url)}" alt="Photo of ${esc(plan.name)}">`;
  const close = hero.toLowerCase().lastIndexOf("</div></section>");
  if (close !== -1) return `${hero.slice(0, close)}${img}${hero.slice(close)}`;
  const end = hero.toLowerCase().lastIndexOf("</section>");
  return end === -1 ? hero : `${hero.slice(0, end)}${img}${hero.slice(end)}`;
}
