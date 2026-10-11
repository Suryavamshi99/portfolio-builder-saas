export const WATERMARK_ATTR = "data-shipfolio-watermark";

const WATERMARK_TEXT = "Preview, not published. Upgrade to publish and download.";

const WATERMARK_HTML = `<div ${WATERMARK_ATTR} style="all:initial;display:block;position:fixed;bottom:0;left:0;right:0;width:100%;background:#18181b;color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;line-height:20px;font-weight:500;text-align:center;padding:10px 16px;z-index:2147483647;box-shadow:0 -2px 10px rgba(0,0,0,0.3);box-sizing:border-box;border-top:1px solid #27272a;pointer-events:auto;">${WATERMARK_TEXT}</div>`;

/**
 * Inserts a single fixed preview watermark bar right before </body>
 * (or appends it to the end if there is no </body> tag).
 */
export function addWatermark(html: string): string {
  const match = /<\/body>/i.exec(html);
  if (match && match.index !== undefined) {
    const idx = match.index;
    return html.slice(0, idx) + WATERMARK_HTML + html.slice(idx);
  }
  return html + WATERMARK_HTML;
}

/**
 * Removes any element carrying the data-shipfolio-watermark attribute.
 */
export function stripWatermark(html: string): string {
  return html.replace(/<div\s+[^>]*data-shipfolio-watermark[^>]*>[\s\S]*?<\/div>/gi, "");
}
