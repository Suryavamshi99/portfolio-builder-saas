/**
 * The design-credit and copyright notice shown on every page built on one of our
 * ready-made looks. Same wording as Terms section 7. (The looks are switched off by TEMPLATES_ENABLED.)
 * No digits on purpose: the numbers fact check reads visible text.
 */
export const COPYRIGHT_EMAIL = "contact@shipfolio.xyz";

export const NOTICE_ATTR = "data-shipfolio-notice";

/**
 * A small collapsed chip fixed in the bottom-left corner; a click opens the full sentence and the email link.
 * Fixed (not part of the page flow) because several looks are full-screen apps (map, canvas, game) that a footer
 * line at the end of the document could never reach. Plain <details>, no script; inline styles only (pages are
 * self-contained); semi-transparent dark so it reads on light and dark pages alike.
 */
export const NOTICE_HTML =
  `<details ${NOTICE_ATTR} style="position:fixed;left:12px;bottom:12px;z-index:2147483000;margin:0;padding:0;font:400 11px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;letter-spacing:.01em;color:#fff;">` +
  `<summary style="display:inline-block;cursor:pointer;padding:4px 10px;border-radius:999px;background:rgba(20,20,20,.62);color:#fff;opacity:.85;">Design credit</summary>` +
  `<div style="margin-top:6px;padding:10px 12px;border-radius:12px;background:rgba(20,20,20,.92);color:#eee;max-width:min(340px,calc(100vw - 24px));">` +
  `Layout inspired by publicly available web designs; credit stays with their original creators. ` +
  `Copyright concern? Write to <a href="mailto:${COPYRIGHT_EMAIL}" style="color:#fff;text-decoration:underline;">${COPYRIGHT_EMAIL}</a> and it will be removed.` +
  `</div></details>`;

/** Inserts the notice right before the last </body> (or appends it). Safe to call twice: it never adds a second one. */
export function withNotice(html: string): string {
  if (html.includes(NOTICE_ATTR)) return html;
  const idx = html.toLowerCase().lastIndexOf("</body>");
  return idx === -1 ? html + NOTICE_HTML : html.slice(0, idx) + NOTICE_HTML + html.slice(idx);
}
