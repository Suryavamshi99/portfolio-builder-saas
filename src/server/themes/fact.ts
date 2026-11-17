import { findUnsupportedClaims } from "@/server/fact-check";
import type { ThemeContent } from "./types";

/** Fields without which a themed page makes no sense; a flagged one fails the build instead of being dropped. */
const REQUIRED_PATHS = ["person.first_name", "person.last_name", "person.headline"];

const LINKISH = /^(https?:\/\/|mailto:|tel:|shipfolio-storage:\/\/|[^\s@]+@[^\s@]+\.[^\s@]+$)/i;

type Node = Record<string, unknown> | unknown[];

/** Every string the page can show, in document order. Links and emails are checked as links elsewhere, not as prose. */
export function contentStrings(content: unknown): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") {
      if (v.trim() && !LINKISH.test(v.trim())) out.push(v);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v as Record<string, unknown>).forEach(walk);
  };
  walk(content);
  return out;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export type ContentCheck =
  | { ok: true; content: ThemeContent; dropped: string[] }
  | { ok: false; unsupported: string[] };

/**
 * Checks every string in the content against the facts the user supplied (resume, answers, links) with the same
 * checker bespoke pages use. A flagged string is dropped from the content; a flagged required field fails the build.
 */
export function checkContent(content: ThemeContent, referenceText: string): ContentCheck {
  const clone = structuredClone(content);
  const dropped: string[] = [];

  for (let round = 0; round < 3; round++) {
    const html = `<html><body>${contentStrings(clone)
      .map((s) => `<p>${escapeHtml(s)}</p>`)
      .join("")}</body></html>`;
    const claims = findUnsupportedClaims(html, referenceText);
    if (claims.length === 0) return { ok: true, content: clone, dropped };

    for (const c of claims) {
      const hit = removeStringsContaining(clone, c.claim, "");
      if (hit.required) return { ok: false, unsupported: claims.map((x) => x.message) };
      dropped.push(...hit.removed);
    }
  }
  const left = findUnsupportedClaims(
    `<html><body>${contentStrings(clone).map((s) => `<p>${escapeHtml(s)}</p>`).join("")}</body></html>`,
    referenceText,
  );
  return left.length === 0 ? { ok: true, content: clone, dropped } : { ok: false, unsupported: left.map((x) => x.message) };
}

function removeStringsContaining(root: Node, needle: string, base: string): { removed: string[]; required: boolean } {
  const removed: string[] = [];
  let required = false;
  const visit = (node: Node, path: string) => {
    if (Array.isArray(node)) {
      for (let i = node.length - 1; i >= 0; i--) {
        const v = node[i];
        if (typeof v === "string" && !LINKISH.test(v.trim()) && v.includes(needle)) {
          removed.push(v);
          node.splice(i, 1);
        } else if (v && typeof v === "object") visit(v as Node, path);
      }
      return;
    }
    for (const [k, v] of Object.entries(node)) {
      const p = path ? `${path}.${k}` : k;
      if (typeof v === "string" && !LINKISH.test(v.trim()) && v.includes(needle)) {
        if (REQUIRED_PATHS.includes(p)) required = true;
        removed.push(v);
        delete node[k];
      } else if (v && typeof v === "object") visit(v as Node, p);
    }
  };
  visit(root, base);
  return { removed, required };
}
