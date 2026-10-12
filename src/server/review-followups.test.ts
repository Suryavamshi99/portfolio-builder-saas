import { describe, expect, it, vi } from "vitest";
import {
  finalizeHtml,
  sanitizeHtmlForServing,
  signedUrlsToMarkers,
  STORAGE_MARKER_PREFIX,
  type FinalizeHtmlInput,
} from "./finalize-html";
import { addWatermark } from "./watermark";
import { embedStorageImagesInHtml } from "./template/images";
import type { SupabaseClient } from "@supabase/supabase-js";

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

describe("Task B: rel='noopener noreferrer' on every kept target='_blank' link", () => {
  it("adds rel='noopener noreferrer' to kept mailto, tel, #anchor, and verified-http with target='_blank'", () => {
    const page = BASE_INPUT.rawText.replace(
      "<h1>Jane Doe</h1>",
      `<h1>Jane Doe</h1>
      <a id="link-anchor" href="#about" target="_blank">Anchor</a>
      <a id="link-mailto" href="mailto:jane@example.com" target="_blank">Email</a>
      <a id="link-tel" href="tel:+1-555-123-4567" target="_blank">Phone</a>
      <a id="link-web" href="https://linkedin.com/in/janedoe" target="_blank">LinkedIn</a>
      <a id="link-unverified" href="https://evil.com" target="_blank">Evil</a>`,
    );

    const res = finalizeHtml({ ...BASE_INPUT, rawText: page });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // Kept links with target="_blank" must have rel="noopener noreferrer"
    expect(res.html).toMatch(/<a[^>]*id="link-anchor"[^>]*href="#about"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
    expect(res.html).toMatch(/<a[^>]*id="link-mailto"[^>]*href="mailto:jane@example.com"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
    expect(res.html).toMatch(/<a[^>]*id="link-tel"[^>]*href="tel:\+1-555-123-4567"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
    expect(res.html).toMatch(/<a[^>]*id="link-web"[^>]*href="https:\/\/linkedin\.com\/in\/janedoe"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);

    // Unverified link had href removed; it must have neither target nor rel
    expect(res.html).toContain('id="link-unverified"');
    expect(res.html).not.toMatch(/id="link-unverified"[^>]*href=/);
    expect(res.html).not.toMatch(/id="link-unverified"[^>]*target=/);
    expect(res.html).not.toMatch(/id="link-unverified"[^>]*rel=/);
  });
});

describe("Task C: Media elements without src kept unchanged and not counted", () => {
  it("keeps <img data-src='x.png' alt='a'> and <audio controls></audio> unchanged with no removed warning", () => {
    const page = BASE_INPUT.rawText.replace(
      "<h1>Jane Doe</h1>",
      `<h1>Jane Doe</h1>
      <img data-src="x.png" alt="a">
      <audio controls></audio>`,
    );

    const res = finalizeHtml({ ...BASE_INPUT, rawText: page });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.html).toContain('<img data-src="x.png" alt="a">');
    expect(res.html).toMatch(/<audio controls(="")?><\/audio>/);
    expect(res.warnings.some((w) => w.includes("Removed") && w.includes("image"))).toBe(false);
  });
});

describe("Task D: Missing tests", () => {
  // 1. sanitizeHtmlForServing(addWatermark(page)) still contains the watermark (<shipfolio-watermark)
  it("1. sanitizeHtmlForServing(addWatermark(page)) still contains the watermark", () => {
    const pageWithWatermark = addWatermark(BASE_INPUT.rawText);
    expect(pageWithWatermark).toContain("<shipfolio-watermark");

    const sanitized = sanitizeHtmlForServing(pageWithWatermark);
    expect(sanitized).toContain("<shipfolio-watermark");
  });

  // 2. sanitizeHtmlForServing leaves an outside <a href="https://evil.com"> and <img src="https://evil.com/x.png"> in place (it must not do B3/B4)
  it("2. sanitizeHtmlForServing leaves outside <a> and <img> in place without doing B3/B4", () => {
    const page = `<!DOCTYPE html><html><head><title>Test</title></head><body>
      <a href="https://evil.com">External Link</a>
      <img src="https://evil.com/x.png" alt="External Image">
    </body></html>`;

    const sanitized = sanitizeHtmlForServing(page);
    expect(sanitized).toContain('href="https://evil.com"');
    expect(sanitized).toContain('src="https://evil.com/x.png"');
  });

  // 3. sanitizeHtmlForServing removes <link rel="stylesheet" href="http://fonts.googleapis.com/css2?family=Inter"> (http, not https) and keeps the https one
  it("3. sanitizeHtmlForServing removes http font stylesheet link and keeps https one", () => {
    const page = `<!DOCTYPE html><html><head>
      <link rel="stylesheet" href="http://fonts.googleapis.com/css2?family=Inter">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto">
    </head><body>Content</body></html>`;

    const sanitized = sanitizeHtmlForServing(page);
    expect(sanitized).not.toContain("http://fonts.googleapis.com");
    expect(sanitized).toContain("https://fonts.googleapis.com/css2?family=Roboto");
  });

  // 4. sanitizeHtmlForServing removes <svg><script xlink:href="https://evil.com/x.js"></script></svg> (output has no evil.com)
  it("4. sanitizeHtmlForServing removes svg script with xlink:href", () => {
    const page = `<!DOCTYPE html><html><head><title>SVG</title></head><body>
      <svg><script xlink:href="https://evil.com/x.js"></script></svg>
    </body></html>`;

    const sanitized = sanitizeHtmlForServing(page);
    expect(sanitized).not.toContain("evil.com");
    expect(sanitized).not.toContain("x.js");
  });

  // 5. finalizeHtml removes <audio src="https://evil.com/a.mp3">, <video><track src="https://evil.com/t.vtt"></video> (the track) and <input type="image" src="https://evil.com/b.png">, with the "Removed ... images or media files" warning
  it("5. finalizeHtml removes audio, video track, and input[type='image'] with external src and warns", () => {
    const page = BASE_INPUT.rawText.replace(
      "<h1>Jane Doe</h1>",
      `<h1>Jane Doe</h1>
      <audio src="https://evil.com/a.mp3"></audio>
      <video><track src="https://evil.com/t.vtt"></video>
      <input type="image" src="https://evil.com/b.png">`,
    );

    const res = finalizeHtml({ ...BASE_INPUT, rawText: page });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.html).not.toContain("https://evil.com/a.mp3");
    expect(res.html).not.toContain("<audio");
    expect(res.html).not.toContain("https://evil.com/t.vtt");
    expect(res.html).not.toContain("<track");
    expect(res.html).not.toContain("https://evil.com/b.png");
    expect(res.html).not.toContain("<input");
    expect(res.warnings).toContain("Removed 3 images or media files that weren't your own uploads.");
  });

  // 6. finalizeHtml on a page with no <style> element at all (not a whitespace-only one) gives ok: true with the "no inline styles" warning
  it("6. finalizeHtml on a page with no <style> element at all gives ok: true with warning", () => {
    const pageNoStyle = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Jane Doe</title>
</head>
<body>
  <nav><a href="#about">About</a></nav>
  <section id="about"><h1>Jane Doe</h1></section>
</body>
</html>`;

    const res = finalizeHtml({ ...BASE_INPUT, rawText: pageNoStyle });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.html).not.toContain("<style");
    expect(res.warnings).toContain("The page has no inline styles, so it may look unstyled.");
  });

  // 7. signedUrlsToMarkers: an own signed URL followed by &quot; (as inside a serialised style attribute) becomes a marker and the &quot; survives; running signedUrlsToMarkers twice gives the same output as once; an uppercase HTTPS:// signed URL is left as is (document today's behaviour; don't change the code)
  it("7. signedUrlsToMarkers handles &quot;, idempotency, and uppercase HTTPS://", () => {
    const ownSignedUrl = "https://project.supabase.co/storage/v1/object/sign/uploads/user-123/photo.jpg?token=abc";
    const expectedMarker = `${STORAGE_MARKER_PREFIX}user-123/photo.jpg`;

    // A: an own signed URL followed by &quot; becomes a marker and &quot; survives
    const styleWithQuot = `<div style="background-image: url(&quot;${ownSignedUrl}&quot;)"></div>`;
    const pass1 = signedUrlsToMarkers(styleWithQuot, "user-123", "https://project.supabase.co");
    expect(pass1.html).toBe(`<div style="background-image: url(&quot;${expectedMarker}&quot;)"></div>`);
    expect(pass1.html).toContain("&quot;");

    // B: running signedUrlsToMarkers twice gives the same output as once
    const pass2 = signedUrlsToMarkers(pass1.html, "user-123", "https://project.supabase.co");
    expect(pass2.html).toBe(pass1.html);

    // C: an uppercase HTTPS:// signed URL is left as is (documents today's behavior)
    const upperSignedUrl = `HTTPS://project.supabase.co/storage/v1/object/sign/uploads/user-123/photo.jpg?token=abc`;
    const upperHtml = `<img src="${upperSignedUrl}">`;
    const upperPass = signedUrlsToMarkers(upperHtml, "user-123", "https://project.supabase.co");
    expect(upperPass.html).toBe(upperHtml);
  });

  // 8. embedStorageImagesInHtml (from @/server/template/images) with a fake supabase whose storage.from().download records calls:
  // a signed URL whose path is ${userId}/../other/x.png and a marker shipfolio-storage://uploads/otherUser/photo/x.png are never downloaded and stay unchanged in the output;
  // an own marker is downloaded once and rewritten to images/<basename>
  it("8. embedStorageImagesInHtml downloads only own valid storage images and rewrites them", async () => {
    const downloadedPaths: string[] = [];
    const fakeData = new Blob([new Uint8Array([1, 2, 3])]);

    const fakeSupabase = {
      storage: {
        from: (bucket: string) => {
          expect(bucket).toBe("uploads");
          return {
            download: vi.fn(async (path: string) => {
              downloadedPaths.push(path);
              return { data: fakeData, error: null };
            }),
          };
        },
      },
    } as unknown as SupabaseClient;

    const invalidSignedUrl =
      "https://project.supabase.co/storage/v1/object/sign/uploads/user-123/../other/x.png?token=abc";
    const foreignMarker = "shipfolio-storage://uploads/otherUser/photo/x.png";
    const ownMarker = `${STORAGE_MARKER_PREFIX}user-123/photo/me.jpg`;

    const htmlInput = `
      <img src="${invalidSignedUrl}">
      <img src="${foreignMarker}">
      <img src="${ownMarker}">
      <div style="background-image: url('${ownMarker}')"></div>
    `;

    const result = await embedStorageImagesInHtml(htmlInput, fakeSupabase, "user-123");

    // Path user-123/../other/x.png and foreign marker otherUser/... are never downloaded
    expect(downloadedPaths).toEqual(["user-123/photo/me.jpg"]);

    // Invalid signed url and foreign marker stay unchanged in the output
    expect(result.html).toContain(`src="${invalidSignedUrl}"`);
    expect(result.html).toContain(`src="${foreignMarker}"`);

    // Own marker is downloaded once and rewritten to images/<basename>
    expect(result.html).toContain('src="images/me.jpg"');
    expect(result.html).toContain("url('images/me.jpg')");
    expect(result.embeddedStoragePaths).toEqual(["user-123/photo/me.jpg"]);
    expect(result.files["images/me.jpg"]).toBeDefined();
  });
});
