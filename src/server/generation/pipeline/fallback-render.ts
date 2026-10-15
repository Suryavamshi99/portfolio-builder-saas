import { esc, linksHtml } from "./assemble";
import type { BuildInput, Plan, PlanSection } from "./types";

const BULLET = /^\s*([-*•–·▪●◦]|\d+[.)])\s+/;

/**
 * A section made in code from the resume text itself, used when no model could write it.
 * It can only contain what the resume says, so it can never fail the fact check.
 */
export function fallbackSection(section: PlanSection, source: string): string {
  const title = section.title.trim().toLowerCase();
  const lines = source.split(/\r?\n/).map((l) => l.trimEnd());
  if (lines[0] && lines[0].trim().toLowerCase().replace(/[:\s]+$/g, "") === title) lines.shift();

  // Blocks are separated by blank lines; a block becomes one card.
  const blocks: string[][] = [[]];
  for (const l of lines) {
    if (l.trim() === "") {
      if (blocks[blocks.length - 1]!.length) blocks.push([]);
    } else blocks[blocks.length - 1]!.push(l);
  }
  const cards = blocks
    .filter((b) => b.length)
    .map((block) => {
      const head: string[] = [];
      const bullets: string[] = [];
      for (const l of block) (BULLET.test(l) ? bullets : head).push(l.replace(BULLET, "").trim());
      const [first, ...rest] = head;
      return `<div class="card">${first ? `<h3>${esc(first)}</h3>` : ""}${rest.map((r) => `<p>${esc(r)}</p>`).join("")}${
        bullets.length ? `<ul class="list">${bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""
      }</div>`;
    })
    .join("");

  return `<section id="${section.id}" class="sec"><div class="wrap"><h2 class="sec-title">${esc(section.title)}</h2><div class="grid">${cards || `<div class="card"><p>${esc(source)}</p></div>`}</div></div></section>`;
}

export function fallbackHero(plan: Plan, input: BuildInput): string {
  const photo = input.photoUrl ? `<img src="${esc(input.photoUrl)}" alt="Photo of ${esc(plan.name)}">` : "";
  return `<section id="top" class="hero"><div class="wrap">${plan.headline ? `<p class="eyebrow">${esc(plan.headline)}</p>` : ""}<h1>${esc(plan.name)}</h1>${
    plan.tagline ? `<p class="lead">${esc(plan.tagline)}</p>` : ""
  }${linksHtml(input.links)}${photo}</div></section>`;
}
