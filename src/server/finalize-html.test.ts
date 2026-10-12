import { describe, expect, it } from "vitest";
import {
  finalizeHtml,
  sanitizeHtmlForServing,
  ownStoragePath,
  signedUrlsToMarkers,
  STORAGE_MARKER_PREFIX,
  type FinalizeHtmlInput,
} from "./finalize-html";
import { addWatermark } from "./watermark";

const BASE_INPUT: FinalizeHtmlInput = {
  rawText: `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Jane Doe</title>
  <style>body { color: #333; }</style>
</head>
<body>
  <nav><a href="#about">About</a></nav>
  <section id="about"><h1>Jane Doe</h1></section>
</body>
</html>`,
  userId: "user-123",
  supabaseUrl: "https://project.supabase.co",
  links: {
    linkedin: "https://linkedin.com/in/janedoe",
    github: "github.com/janedoe",
  },
  referenceText: "Jane Doe\njane@example.com\n+1 (555) 123-4567\nSenior Engineer",
};

describe("ownStoragePath - B3a", () => {
  it("accepts valid storage path starting with userId/", () => {
    expect(ownStoragePath("user-123/photo/me.jpg", "user-123")).toBe("user-123/photo/me.jpg");
  });

  it("rejects path for another user", () => {
    expect(ownStoragePath("other-user/photo/me.jpg", "user-123")).toBeNull();
  });

  it("rejects path with .. and %2E%2E", () => {
    expect(ownStoragePath("user-123/../other/x.png", "user-123")).toBeNull();
    expect(ownStoragePath("user-123/%2E%2E/other/x.png", "user-123")).toBeNull();
  });

  it("rejects user-123/..%2Fother/x.png after decoding", () => {
    expect(ownStoragePath("user-123/..%2Fother/x.png", "user-123")).toBeNull();
  });

  it("rejects malformed user-123/%E0%A4%A.png without throwing", () => {
    expect(() => ownStoragePath("user-123/%E0%A4%A.png", "user-123")).not.toThrow();
    expect(ownStoragePath("user-123/%E0%A4%A.png", "user-123")).toBeNull();
  });

  it("rejects paths with backslashes, percent signs, or control characters", () => {
    expect(ownStoragePath("user-123/photo\\x.png", "user-123")).toBeNull();
    expect(ownStoragePath("user-123/%2520photo.png", "user-123")).toBeNull();
    expect(ownStoragePath("user-123/\x00photo.png", "user-123")).toBeNull();
    expect(ownStoragePath("user-123/\x7Fphoto.png", "user-123")).toBeNull();
  });

  it("rejects paths with empty or single dot segments", () => {
    expect(ownStoragePath("user-123//photo.png", "user-123")).toBeNull();
    expect(ownStoragePath("user-123/./photo.png", "user-123")).toBeNull();
  });
});

describe("finalizeHtml - B2: Extract & hard errors", () => {
  it("returns error if rawText does not contain a web page", () => {
    const res = finalizeHtml({ ...BASE_INPUT, rawText: "Just some markdown text without HTML" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors).toContain("The AI reply didn't contain a web page.");
    }
  });

  it("returns error if HTML is cut off before </html>", () => {
    const cutOff = BASE_INPUT.rawText.replace("</html>", "").replace("</body>", "");
    const res = finalizeHtml({
      ...BASE_INPUT,
      rawText: cutOff,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors).toContain("The page was cut off before it finished.");
    }
  });
});

describe("finalizeHtml - B3: Images and media sources", () => {
  it("rewrites valid signed storage URL to storage marker", () => {
    const htmlWithImg = BASE_INPUT.rawText.replace(
      "<h1>Jane Doe</h1>",
      `<h1>Jane Doe</h1><img src="https://project.supabase.co/storage/v1/object/sign/uploads/user-123/photo/me.jpg?token=abc" alt="Jane">`,
    );
    const res = finalizeHtml({ ...BASE_INPUT, rawText: htmlWithImg });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.html).toContain(`src="${STORAGE_MARKER_PREFIX}user-123/photo/me.jpg"`);
    }
  });

  it("removes <img> with signed URL for another user's path", () => {
    const htmlWithImg = BASE_INPUT.rawText.replace(
      "<h1>Jane Doe</h1>",
      `<h1>Jane Doe</h1><img src="https://project.supabase.co/storage/v1/object/sign/uploads/otherUser/photo/x.png?token=abc" alt="Jane">`,
    );
    const res = finalizeHtml({ ...BASE_INPUT, rawText: htmlWithImg });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.html).not.toContain("<img");
      expect(res.warnings).toContain("Removed 1 image or media file that wasn't your own upload.");
    }
  });

  it("removes <img> with signed URL from another origin with the right path", () => {
    const htmlWithImg = BASE_INPUT.rawText.replace(
      "<h1>Jane Doe</h1>",
      `<h1>Jane Doe</h1><img src="https://evil.co/storage/v1/object/sign/uploads/user-123/photo/me.jpg?token=abc" alt="Jane">`,
    );
    const res = finalizeHtml({ ...BASE_INPUT, rawText: htmlWithImg });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.html).not.toContain("<img");
      expect(res.warnings).toContain("Removed 1 image or media file that wasn't your own upload.");
    }
  });

  it("rejects path with .. and %2E%2E", () => {
    const htmlDotDot = BASE_INPUT.rawText.replace(
      "<h1>Jane Doe</h1>",
      `<h1>Jane Doe</h1><img src="https://project.supabase.co/storage/v1/object/sign/uploads/user-123/../other/x.png?token=abc" alt="A"><img src="https://project.supabase.co/storage/v1/object/sign/uploads/user-123/%2E%2E/other/x.png?token=abc" alt="B">`,
    );
    const res = finalizeHtml({ ...BASE_INPUT, rawText: htmlDotDot });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.html).not.toContain("<img");
      expect(res.warnings).toContain("Removed 2 images or media files that weren't your own uploads.");
    }
  });

  it("preserves already valid markers and removes invalid markers", () => {
    const htmlWithMarkers = BASE_INPUT.rawText.replace(
      "<h1>Jane Doe</h1>",
      `<h1>Jane Doe</h1><img src="${STORAGE_MARKER_PREFIX}user-123/photo.jpg" alt="Valid"><img src="${STORAGE_MARKER_PREFIX}other-user/photo.jpg" alt="Invalid">`,
    );
    const res = finalizeHtml({ ...BASE_INPUT, rawText: htmlWithMarkers });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.html).toContain(`src="${STORAGE_MARKER_PREFIX}user-123/photo.jpg"`);
      expect(res.html).not.toContain("other-user");
      expect(res.warnings).toContain("Removed 1 image or media file that wasn't your own upload.");
    }
  });

  it("preserves data:image/... sources on img, input, and poster", () => {
    const htmlWithData = BASE_INPUT.rawText.replace(
      "<h1>Jane Doe</h1>",
      `<h1>Jane Doe</h1>
      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUg" alt="Avatar">
      <input type="image" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUg">
      <video poster="data:image/png;base64,iVBORw0KGgoAAAANSUhEUg"></video>`,
    );
    const res = finalizeHtml({ ...BASE_INPUT, rawText: htmlWithData });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.html).toContain(`src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUg"`);
      expect(res.html).toContain(`poster="data:image/png;base64,iVBORw0KGgoAAAANSUhEUg"`);
    }
  });

  it("removes video src and removes video poster if not own upload", () => {
    const htmlWithVideo = BASE_INPUT.rawText.replace(
      "<h1>Jane Doe</h1>",
      `<h1>Jane Doe</h1>
      <video src="https://x/clip.mp4"></video>
      <video poster="https://x/p.png"></video>`,
    );
    const res = finalizeHtml({ ...BASE_INPUT, rawText: htmlWithVideo });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.html).not.toContain("https://x/clip.mp4");
      expect(res.html).not.toContain("poster=");
      expect(res.warnings).toContain("Removed 2 images or media files that weren't your own uploads.");
    }
  });

  it("removes srcset attributes and <source> elements everywhere", () => {
    const htmlWithSources = BASE_INPUT.rawText.replace(
      "<h1>Jane Doe</h1>",
      `<picture><source srcset="https://evil.com/pic.webp"><img src="data:image/png;base64,123" srcset="https://evil.com/pic.png 2x" alt="Pic"></picture>`,
    );
    const res = finalizeHtml({ ...BASE_INPUT, rawText: htmlWithSources });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.html).not.toContain("<source");
      expect(res.html).not.toContain("srcset");
    }
  });

  it("removes svg image and use hrefs unless # or data:image/", () => {
    const htmlWithSvg = BASE_INPUT.rawText.replace(
      "<h1>Jane Doe</h1>",
      `<svg><image href="https://evil.com/x.png"/><image href="data:image/png;base64,123"/><use href="#icon"/><use href="https://evil.com/icons.svg#icon"/></svg>`,
    );
    const res = finalizeHtml({ ...BASE_INPUT, rawText: htmlWithSvg });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.html).not.toContain("https://evil.com/x.png");
      expect(res.html).not.toContain("https://evil.com/icons.svg");
      expect(res.html).toContain('href="#icon"');
      expect(res.html).toContain('href="data:image/png;base64,123"');
    }
  });

  it("empties foreign marker in style attribute and warns", () => {
    const htmlWithForeignMarker = BASE_INPUT.rawText.replace(
      "<h1>Jane Doe</h1>",
      `<div style="background-image:url(shipfolio-storage://uploads/otherUserId/photo/x.png)">Content</div>`,
    );
    const res = finalizeHtml({ ...BASE_INPUT, rawText: htmlWithForeignMarker });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.html).not.toContain("otherUserId");
      expect(res.warnings).toContain("The page referenced an image that isn't yours; it won't load.");
    }
  });

  it("rewrites signed URLs in CSS and empties foreign signed URLs with no token remaining", () => {
    const htmlWithCssUrls = BASE_INPUT.rawText.replace(
      "<style>body { color: #333; }</style>",
      `<style>
        .hero { background: url('https://project.supabase.co/storage/v1/object/sign/uploads/user-123/hero.jpg?token=abc'); }
        .bad { background: url('https://project.supabase.co/storage/v1/object/sign/uploads/other-user/bad.jpg?token=abc'); }
      </style>`,
    );
    const res = finalizeHtml({ ...BASE_INPUT, rawText: htmlWithCssUrls });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.html).toContain(`${STORAGE_MARKER_PREFIX}user-123/hero.jpg`);
      expect(res.html).not.toContain("token=abc");
      expect(res.html).not.toContain("other-user/bad.jpg");
      expect(res.warnings).toContain("The page referenced an image that isn't yours; it won't load.");
    }
  });
});

describe("finalizeHtml - B4: Links", () => {
  it("keeps in-page anchors", () => {
    const res = finalizeHtml(BASE_INPUT);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.html).toContain('href="#about"');
    }
  });

  it("handles mailto links based on referenceText", () => {
    const htmlWithMailto = BASE_INPUT.rawText.replace(
      "<h1>Jane Doe</h1>",
      `<h1>Jane Doe</h1><a href="mailto:jane@example.com?subject=Hello">Valid Mail</a><a href="mailto:hacker@evil.com">Bad Mail</a>`,
    );
    const res = finalizeHtml({ ...BASE_INPUT, rawText: htmlWithMailto });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.html).toContain('href="mailto:jane@example.com?subject=Hello"');
      expect(res.html).not.toContain('href="mailto:hacker@evil.com"');
      expect(res.html).toContain(">Bad Mail</a>");
      expect(res.warnings).toContain("Removed 1 link that wasn't in your verified links.");
    }
  });

  it("keeps mailto when it appears in links.other via referenceText", () => {
    const refTextWithOther = "Jane Doe\nSenior Engineer\nmailto:other-contact@example.com";
    const htmlWithMailto = BASE_INPUT.rawText.replace(
      "<h1>Jane Doe</h1>",
      `<h1>Jane Doe</h1><a href="mailto:other-contact@example.com">Other Contact</a>`,
    );
    const res = finalizeHtml({
      ...BASE_INPUT,
      referenceText: refTextWithOther,
      rawText: htmlWithMailto,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.html).toContain('href="mailto:other-contact@example.com"');
    }
  });

  it("handles tel links based on digits in referenceText", () => {
    const htmlWithTel = BASE_INPUT.rawText.replace(
      "<h1>Jane Doe</h1>",
      `<h1>Jane Doe</h1><a href="tel:5551234567">Valid Tel</a><a href="tel:9998887777">Bad Tel</a>`,
    );
    const res = finalizeHtml({ ...BASE_INPUT, rawText: htmlWithTel });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.html).toContain('href="tel:5551234567"');
      expect(res.html).not.toContain('href="tel:9998887777"');
      expect(res.html).toContain(">Bad Tel</a>");
      expect(res.warnings).toContain("Removed 1 link that wasn't in your verified links.");
    }
  });

  it("matches normalized verified links and rejects unverified links", () => {
    const htmlWithLinks = BASE_INPUT.rawText.replace(
      "<h1>Jane Doe</h1>",
      `<h1>Jane Doe</h1>
      <a href="https://www.LinkedIn.com/in/janedoe/">LinkedIn Match</a>
      <a href="https://linkedin.com/in/janedoe-evil">LinkedIn Evil</a>
      <a href="http://github.com/janedoe/">GitHub Match</a>
      <a href="https://random-site.com">Random</a>`,
    );
    const res = finalizeHtml({ ...BASE_INPUT, rawText: htmlWithLinks });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.html).toContain('href="https://www.LinkedIn.com/in/janedoe/"');
      expect(res.html).toContain('href="http://github.com/janedoe/"');
      expect(res.html).not.toContain('href="https://linkedin.com/in/janedoe-evil"');
      expect(res.html).not.toContain('href="https://random-site.com"');
      expect(res.warnings).toContain("Removed 2 links that weren't in your verified links.");
    }
  });

  it("removes javascript: and data: links", () => {
    const htmlWithBadHrefs = BASE_INPUT.rawText.replace(
      "<h1>Jane Doe</h1>",
      `<h1>Jane Doe</h1>
      <a href="javascript:alert(1)">JS</a>
      <a href="data:text/html,<script>alert(1)</script>">Data</a>`,
    );
    const res = finalizeHtml({ ...BASE_INPUT, rawText: htmlWithBadHrefs });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.html).not.toContain("javascript:alert(1)");
      expect(res.html).not.toContain("data:text/html");
      expect(res.html).toContain(">JS</a>");
      expect(res.html).toContain(">Data</a>");
    }
  });

  it("removes javascript:// and ftp:// even if targeting verified domain", () => {
    const htmlWithTrickyHrefs = BASE_INPUT.rawText.replace(
      "<h1>Jane Doe</h1>",
      `<h1>Jane Doe</h1>
      <a href="javascript://linkedin.com/in/janedoe#%0aalert(1)">Tricky JS</a>
      <a href="ftp://linkedin.com/in/janedoe">FTP</a>`,
    );
    const res = finalizeHtml({ ...BASE_INPUT, rawText: htmlWithTrickyHrefs });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.html).not.toContain('href="javascript:');
      expect(res.html).not.toContain('href="ftp:');
      expect(res.html).toContain(">Tricky JS</a>");
      expect(res.html).toContain(">FTP</a>");
    }
  });

  it("removes links inside svg (including xlink:href)", () => {
    const htmlWithSvgLinks = BASE_INPUT.rawText.replace(
      "<h1>Jane Doe</h1>",
      `<h1>Jane Doe</h1>
      <svg><a xlink:href="https://evil.com">Evil SVG Link</a></svg>`,
    );
    const res = finalizeHtml({ ...BASE_INPUT, rawText: htmlWithSvgLinks });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.html).not.toContain("https://evil.com");
      expect(res.html).toContain("Evil SVG Link");
    }
  });

  it("adds rel='noopener noreferrer' to kept target='_blank' links and removes target on stripped links", () => {
    const htmlWithTarget = BASE_INPUT.rawText.replace(
      "<h1>Jane Doe</h1>",
      `<h1>Jane Doe</h1>
      <a href="https://linkedin.com/in/janedoe" target="_blank">LinkedIn</a>
      <a href="https://bad.com" target="_blank">Bad</a>`,
    );
    const res = finalizeHtml({ ...BASE_INPUT, rawText: htmlWithTarget });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.html).toContain('rel="noopener noreferrer"');
      expect(res.html).toContain('>LinkedIn</a>');
      expect(res.html).not.toContain('href="https://bad.com"');
      expect(res.html).toContain('>Bad</a>');
      expect(res.html).not.toContain('<a target="_blank">Bad</a>');
    }
  });
});

describe("finalizeHtml - B5: Safety clean-up / sanitizeHtmlForServing", () => {
  it("removes script with src or href but keeps inline scripts without src/href", () => {
    const html = `<!DOCTYPE html><html><head><title>T</title></head><body>
      <script src="https://evil.com/track.js"></script>
      <svg><script href="https://x/y.js"></script></svg>
      <script>console.log("hello");</script>
    </body></html>`;
    const cleaned = sanitizeHtmlForServing(html);
    expect(cleaned).not.toContain("track.js");
    expect(cleaned).not.toContain("https://x/y.js");
    expect(cleaned).toContain('console.log("hello");');
  });

  it("removes dangerous embed elements, meta http-equiv, and disallows bad links", () => {
    const html = `<!DOCTYPE html><html><head>
      <meta http-equiv="refresh" content="30">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto">
      <link rel="preconnect" href="https://fonts.gstatic.com">
      <link rel="stylesheet" href="https://evil.com/style.css">
      <link rel="icon" href="/favicon.ico">
    </head><body>
      <iframe></iframe><embed><object></object><portal></portal><base href="https://evil.com">
    </body></html>`;
    const cleaned = sanitizeHtmlForServing(html);
    expect(cleaned).not.toContain("http-equiv");
    expect(cleaned).toContain("fonts.googleapis.com");
    expect(cleaned).toContain("fonts.gstatic.com");
    expect(cleaned).not.toContain("evil.com");
    expect(cleaned).not.toContain("<iframe");
    expect(cleaned).not.toContain("<embed");
    expect(cleaned).not.toContain("<object");
    expect(cleaned).not.toContain("<portal");
    expect(cleaned).not.toContain("<base");
  });

  it("removes Font Awesome stylesheet with outside-stylesheet warning", () => {
    const htmlWithFontAwesome = BASE_INPUT.rawText.replace(
      "<head>",
      `<head><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">`,
    );
    const res = finalizeHtml({ ...BASE_INPUT, rawText: htmlWithFontAwesome });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.html).not.toContain("font-awesome");
      expect(res.warnings).toContain(
        "Removed outside style sheets or scripts; anything they provided (such as icon fonts) won't show.",
      );
    }
  });

  it("strips form actions, submission attributes, and ping", () => {
    const html = `<!DOCTYPE html><html><head><title>T</title></head><body>
      <form action="https://evil.com" method="POST" target="_blank">
        <button formaction="https://evil.com/steal" formmethod="POST" formtarget="_self">Send</button>
      </form>
      <a href="#" ping="https://evil.com/ping">Link</a>
    </body></html>`;
    const cleaned = sanitizeHtmlForServing(html);
    expect(cleaned).not.toContain('action="');
    expect(cleaned).not.toContain('method="');
    expect(cleaned).not.toContain('formaction');
    expect(cleaned).not.toContain('formmethod');
    expect(cleaned).not.toContain('formtarget');
    expect(cleaned).not.toContain('ping=');
  });

  it("cleans @import in style elements unless from fonts.googleapis.com", () => {
    const html = `<!DOCTYPE html><html><head>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter');
        @import "https://evil.com/bad.css";
        body { color: blue; }
      </style>
    </head><body>Hello</body></html>`;
    const cleaned = sanitizeHtmlForServing(html);
    expect(cleaned).toContain("fonts.googleapis.com");
    expect(cleaned).not.toContain("evil.com");
    expect(cleaned).toContain("color: blue;");
  });

  it("is idempotent on a messy fixture", () => {
    const fixture = `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="refresh" content="5">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Open+Sans">
  <link rel="stylesheet" href="https://bad.com/style.css">
  <style>
    @import 'https://fonts.googleapis.com/css?family=Lato';
    @import 'https://evil.com/x.css';
    h1 { font-size: 24px; }
  </style>
</head>
<body>
  <iframe src="https://evil.com"></iframe>
  <form action="/login" method="post"><button formaction="/hacked">Submit</button></form>
  <script src="bad.js"></script>
  <script>window.effect = 1;</script>
  <a ping="/track" href="#">Click</a>
</body>
</html>`;
    const once = sanitizeHtmlForServing(fixture);
    const twice = sanitizeHtmlForServing(once);
    expect(twice).toBe(once);
  });
});

describe("finalizeHtml - B6: Viewport, semantic warnings, repair, and watermark removal", () => {
  it("repairs missing doctype with warning and prepends doctype", () => {
    const noDoctype = BASE_INPUT.rawText.replace("<!DOCTYPE html>", "");
    const res = finalizeHtml({ ...BASE_INPUT, rawText: noDoctype });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.html.trim().toLowerCase().startsWith("<!doctype html")).toBe(true);
      expect(res.warnings).toContain("Added a missing doctype.");
    }
  });

  it("repairs missing head/body with warning", () => {
    const noHeadBody = BASE_INPUT.rawText
      .replace("<head>", "")
      .replace("</head>", "")
      .replace("<body>", "")
      .replace("</body>", "");
    const res = finalizeHtml({ ...BASE_INPUT, rawText: noHeadBody });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.warnings).toContain("The page was missing its <head> or <body> section; it was repaired.");
    }
  });

  it("warns when page has no inline styles", () => {
    const noStyles = BASE_INPUT.rawText.replace("<style>body { color: #333; }</style>", "<style>   </style>");
    const res = finalizeHtml({ ...BASE_INPUT, rawText: noStyles });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.warnings).toContain("The page has no inline styles, so it may look unstyled.");
    }
  });

  it("inserts viewport tag when missing and warns", () => {
    const noViewport = BASE_INPUT.rawText.replace(
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      "",
    );
    const res = finalizeHtml({ ...BASE_INPUT, rawText: noViewport });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
      expect(res.warnings).toContain("Added a mobile viewport tag.");
    }
  });

  it("warns when nav, section, in-page navigation, or alt text are missing", () => {
    const lackingSemantics = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Plain</title>
  <style>body { color: black; }</style>
</head>
<body>
  <div><h1>Hello</h1><img src="data:image/png;base64,123"></div>
</body>
</html>`;
    const res = finalizeHtml({ ...BASE_INPUT, rawText: lackingSemantics });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.warnings).toContain("The page has no <nav> section.");
      expect(res.warnings).toContain("The page has no <section> elements.");
      expect(res.warnings).toContain("The page has no in-page navigation.");
      expect(res.warnings).toContain("One or more images are missing alt text.");
    }
  });

  it("removes watermark without adding a warning", () => {
    const watermarked = addWatermark(BASE_INPUT.rawText);
    expect(watermarked).toContain("shipfolio-watermark");
    const res = finalizeHtml({ ...BASE_INPUT, rawText: watermarked });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.html).not.toContain("shipfolio-watermark");
      expect(res.html).not.toContain("data-shipfolio-watermark");
      expect(res.warnings.some((w) => w.toLowerCase().includes("watermark"))).toBe(false);
    }
  });

  describe("signedUrlsToMarkers", () => {
    it("converts own signed URLs into storage markers", () => {
      const html = `<img src="https://project.supabase.co/storage/v1/object/sign/uploads/user-123/avatar.jpg?token=abc">`;
      const result = signedUrlsToMarkers(html, "user-123", "https://project.supabase.co");
      expect(result.html).toBe(`<img src="${STORAGE_MARKER_PREFIX}user-123/avatar.jpg">`);
      expect(result.foreign).toBe(0);
    });

    it("empties foreign user signed URLs and increments foreign count", () => {
      const html = `<img src="https://project.supabase.co/storage/v1/object/sign/uploads/other-user/avatar.jpg?token=abc">`;
      const result = signedUrlsToMarkers(html, "user-123", "https://project.supabase.co");
      expect(result.html).toBe(`<img src="">`);
      expect(result.foreign).toBe(1);
    });
  });
});

describe("review fixes: parser differentials and SVG", () => {
  const page = (body: string, head = "") =>
    `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{color:#333}</style>${head}</head><body><nav><a href="#a">A</a></nav><section id="a">${body}</section></body></html>`;
  const run = (body: string, head = "") => finalizeHtml({ ...BASE_INPUT, rawText: page(body, head) });

  it("removes external xlink:href on SVG <use> and <image> (asserted on serialised output)", () => {
    const res = run(
      `<svg xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="https://evil.com/s.svg#i"/><image xlink:href="https://evil.com/x.png"/><use xlink:href="#local"/></svg>`,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.html).not.toContain("https://evil.com");
    expect(res.html).toContain('xlink:href="#local"');
  });

  it("removes SVG <script xlink:href> in sanitizeHtmlForServing", () => {
    const out = sanitizeHtmlForServing(page(`<svg><script xlink:href="https://evil.com/x.js"></script></svg>`));
    expect(out).not.toContain("evil.com");
  });

  it("removes <noscript> in body and head with everything inside it", () => {
    const body = `<noscript><img src="https://evil.com/t.png"><a href="https://evil.com">x</a><iframe src="https://evil.com/f"></iframe></noscript>`;
    const head = `<noscript><meta http-equiv="refresh" content="0;url=https://evil.com"><link rel="stylesheet" href="https://evil.com/s.css"></noscript>`;
    const res = run(body, head);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.html).not.toContain("noscript");
    expect(res.html).not.toContain("evil.com");
    expect(sanitizeHtmlForServing(page(body, head))).not.toContain("evil.com");
  });

  it("blocks the noscript attribute re-entry trick", () => {
    const res = run(`<noscript><p title="</noscript><img src=https://evil.com/x.png>"></p></noscript>`);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.html).not.toContain("evil.com");
  });

  it("cleans the nested-form mutation-XSS payload so a re-parse finds nothing", () => {
    const payload = `<form><math><mtext></form><form><mglyph><style></math><a href="https://evil.com/mx">mx</a><iframe src="https://evil.com/if"></iframe><script src="https://evil.com/x.js"></script><meta http-equiv="refresh" content="0;url=https://evil.com"><img src="https://evil.com/i.png">`;
    const res = run(payload);
    if (res.ok) {
      expect(res.html).not.toContain("evil.com");
      // The saved HTML is a fixed point: cleaning it again changes nothing.
      expect(sanitizeHtmlForServing(res.html)).not.toContain("evil.com");
      const again = finalizeHtml({ ...BASE_INPUT, rawText: res.html });
      expect(again.ok && again.html).toBe(res.html);
    } else {
      expect(res.errors).toContain("The page's HTML couldn't be cleaned safely.");
    }
    expect(sanitizeHtmlForServing(page(payload))).not.toMatch(/<iframe|<script src|http-equiv/);
  });

  it("is a fixed point on a normal page", () => {
    const res = finalizeHtml(BASE_INPUT);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const again = finalizeHtml({ ...BASE_INPUT, rawText: res.html });
    expect(again.ok && again.html).toBe(res.html);
  });

  it("removes SMIL animations that set href, and clears external feImage href", () => {
    const res = run(
      `<svg><a><animate attributeName="href" values="https://evil.com/anim"/><text>LinkedIn</text></a>` +
        `<image><set attributeName="xlink:href" to="https://evil.com/set.png"/></image>` +
        `<rect><animate attributeName="opacity" values="0;1"/></rect>` +
        `<filter><feImage xlink:href="https://evil.com/fe.png"/></filter></svg>`,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.html).not.toContain("evil.com");
    expect(res.html).toContain('attributeName="opacity"');
  });
});
