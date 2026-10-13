import { describe, expect, it } from "vitest";
import { SITES_CSP as APP_CSP } from "./sites-serve";
import { SITES_CSP as SUBDOMAIN_CSP } from "../../sites-app/api/serve";
import { PUBLISHED_SITE_CSP } from "./site-csp";
import { parseSitePath, responseHeaders, serveSite } from "./sites-serve";
import { siteUrl } from "./sites";

function fakeAdmin(site: { slug: string; status: string } | null, files: Record<string, string | Uint8Array>) {
  const downloaded: string[] = [];
  return {
    downloaded,
    admin: {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: site, error: null }) }) }) }),
      storage: {
        from: () => ({
          download: async (path: string) => {
            downloaded.push(path);
            const f = files[path];
            return f === undefined ? { data: null, error: { message: "nope" } } : { data: new Blob([f as BlobPart]), error: null };
          },
        }),
      },
    } as never,
  };
}

describe("parseSitePath", () => {
  it("accepts the site root and its images", () => {
    expect(parseSitePath("janedoe")).toEqual({ slug: "janedoe", file: "index.html" });
    expect(parseSitePath("janedoe/")).toEqual({ slug: "janedoe", file: "index.html" });
    expect(parseSitePath("janedoe/images/me-1.PNG")).toEqual({ slug: "janedoe", file: "images/me-1.PNG" });
  });
  it("rejects traversal, other folders, nesting, bad or reserved slugs", () => {
    for (const p of ["", "janedoe/../other", "janedoe/images/../x.png", "janedoe/images/a/b.png", "janedoe/index.html", "janedoe/secret.txt", "janedoe//images/a.png", "Jane", "ja", "api/images/a.png", "www", "jane doe", "janedoe/images/%2e%2e.png", "janedoe/images/a.png/"]) {
      expect(parseSitePath(p), p).toBeNull();
    }
  });
});

describe("serveSite", () => {
  const html = '<img src="images/me.png" alt=""><div style="background:url(images/me.png)"></div><a href="#a">x</a>';
  it("serves a published page with images rewritten under /s/<slug>", async () => {
    const { admin } = fakeAdmin({ slug: "janedoe", status: "published" }, { "janedoe/index.html": html });
    const res = await serveSite(admin, "janedoe");
    expect(res.status).toBe(200);
    expect(res.body).toContain('src="/s/janedoe/images/me.png"');
    expect(res.body).toContain("url(/s/janedoe/images/me.png)");
    expect(res.body).toContain('href="#a"');
  });
  it("serves an image with its content type", async () => {
    const { admin } = fakeAdmin({ slug: "janedoe", status: "published" }, { "janedoe/images/me.png": new Uint8Array([1, 2, 3]) });
    const res = await serveSite(admin, "janedoe/images/me.png");
    expect(res).toMatchObject({ status: 200, contentType: "image/png" });
  });
  it("404s an unpublished or unknown site without reading any file", async () => {
    for (const site of [{ slug: "janedoe", status: "unpublished" }, null]) {
      const { admin, downloaded } = fakeAdmin(site, { "janedoe/index.html": html });
      expect((await serveSite(admin, "janedoe")).status).toBe(404);
      expect(downloaded).toEqual([]);
    }
  });
  it("404s a missing file and never touches storage for an invalid path", async () => {
    const { admin, downloaded } = fakeAdmin({ slug: "janedoe", status: "published" }, {});
    expect((await serveSite(admin, "janedoe")).status).toBe(404);
    downloaded.length = 0;
    expect((await serveSite(admin, "janedoe/../x")).status).toBe(404);
    expect(downloaded).toEqual([]);
  });
});

describe("safety headers", () => {
  it("sandboxes every response without allowing same-origin", () => {
    for (const type of ["text/html; charset=utf-8", "image/png"]) {
      const csp = responseHeaders(type)["Content-Security-Policy"]!;
      expect(csp).toContain("sandbox allow-scripts");
      expect(csp).not.toContain("allow-same-origin");
      expect(csp).toContain("connect-src 'none'");
    }
    expect(responseHeaders("text/html")["X-Content-Type-Options"]).toBe("nosniff");
  });
  it("uses the same policy as the subdomain server", () => {
    expect(APP_CSP).toBe(SUBDOMAIN_CSP);
    expect(APP_CSP.startsWith(PUBLISHED_SITE_CSP)).toBe(true);
  });
});

describe("siteUrl", () => {
  it("builds a path address when SITES_BASE_URL is set, a subdomain otherwise", () => {
    process.env["SITES_DOMAIN"] = "shipfolio.xyz";
    delete process.env["SITES_BASE_URL"];
    expect(siteUrl("jane")).toBe("https://jane.shipfolio.xyz");
    process.env["SITES_BASE_URL"] = "https://www.shipfolio.xyz/s/";
    expect(siteUrl("jane")).toBe("https://www.shipfolio.xyz/s/jane");
    delete process.env["SITES_BASE_URL"];
  });
});
