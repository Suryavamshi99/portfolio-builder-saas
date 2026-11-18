import { describe, expect, it } from "vitest";
import { fetchPublicSite, isBlockedAddress, parsePublicUrl } from "./safe-fetch";
import { captureBrand, captureBrandFromUrl, fontsFromCss, paletteFromCss, rolesFromCss } from "./capture";

describe("parsePublicUrl", () => {
  it("accepts a plain https company address", () => {
    expect(parsePublicUrl("https://www.example-company.com/about")?.hostname).toBe("www.example-company.com");
  });
  it("rejects http, credentials, odd ports, localhost and internal names", () => {
    for (const bad of ["http://example.com", "https://user:pw@example.com", "https://example.com:8443", "https://localhost", "https://intranet.local", "https://db.internal", "not a url", ""]) {
      expect(parsePublicUrl(bad), bad).toBeNull();
    }
  });
  it("rejects IP-literal addresses that are private or metadata", () => {
    for (const bad of ["https://127.0.0.1", "https://10.1.2.3", "https://192.168.0.5", "https://169.254.169.254", "https://[::1]", "https://[fd00::1]"]) {
      expect(parsePublicUrl(bad), bad).toBeNull();
    }
  });
});

describe("isBlockedAddress", () => {
  it("blocks private, loopback, link-local, shared and reserved ranges", () => {
    for (const ip of ["0.0.0.0", "10.0.0.1", "100.64.0.1", "127.0.0.1", "169.254.1.1", "172.16.0.1", "172.31.255.255", "192.168.1.1", "198.18.0.1", "224.0.0.1", "::1", "fe80::1", "fc00::1", "::ffff:10.0.0.1"]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });
  it("allows ordinary public addresses", () => {
    for (const ip of ["8.8.8.8", "172.32.0.1", "104.16.0.1", "2606:4700::1111"]) expect(isBlockedAddress(ip), ip).toBe(false);
  });
});

describe("fetchPublicSite", () => {
  const page = "<html><head><title>Acme</title></head><body>hi</body></html>";
  it("rejects a name that resolves to a private address without contacting it", async () => {
    let called = false;
    const r = await fetchPublicSite("https://localhost.example.invalid/", async () => {
      called = true;
      return { status: 200, headers: {}, body: Buffer.from(page) };
    });
    expect(r.ok).toBe(false);
    expect(called).toBe(false);
  });
  it("rejects bad input before any network call", async () => {
    const r = await fetchPublicSite("http://example.com", async () => {
      throw new Error("should not be called");
    });
    expect(r).toMatchObject({ ok: false, reason: "invalid_url" });
  });
});

describe("brand capture", () => {
  const css = `
    body { font-family: "Fraunces", Georgia, serif; color: #1a1a2e; background: #FFFFFF; }
    h1 { font-family: 'Fraunces', serif; color: #e94560; }
    a { color: #e94560; }
    .btn { background: rgb(233, 69, 96); border: 1px solid #1a1a2e; }
    .card { font-family: Inter, sans-serif; color: #0f3460; }
  `;
  it("finds the most used colours without black or white", () => {
    expect(paletteFromCss(css)).toEqual(["#e94560", "#1a1a2e", "#0f3460"]);
  });
  it("finds font families without generic fallbacks", () => {
    expect(fontsFromCss(css)).toEqual(["Fraunces", "Inter"]);
  });
  it("captures name, description, colours, fonts and headings from a page", () => {
    const html = `<html><head><title>Acme Robotics | Build better</title><meta name="description" content="Warehouse robots that ship on time."><style>${css}</style></head>
      <body><h1>Robots that never sleep</h1><h2>Our customers</h2><h2>No</h2></body></html>`;
    const b = captureBrand(html);
    expect(b.name).toBe("Acme Robotics | Build better");
    expect(b.description).toContain("Warehouse robots");
    expect(b.palette[0]).toBe("#e94560");
    expect(b.fonts).toContain("Fraunces");
    expect(b.voice).toEqual(["Robots that never sleep", "Our customers"]);
  });
  it("returns empty lists for a bare page and never throws", () => {
    expect(captureBrand("<html></html>")).toMatchObject({ name: "", palette: [], fonts: [], voice: [], roles: {}, nav: [], sections: [], needsScreenshots: true });
  });
  it("reads colour roles from custom properties", () => {
    expect(rolesFromCss(":root{--brand-primary:#e94560;--color-bg:#fafafa;--text-main:#111827;--border-subtle:#ddd}")).toEqual({
      primary: "#e94560",
      background: "#fafafa",
      text: "#111827",
      border: "#dddddd",
    });
  });
  it("records menu and section order as structure, not content", () => {
    const b = captureBrand("<nav><a>Shop</a><a>Deals</a><a>Shop</a></nav><h1>Fresh in 10 minutes</h1><h2>Categories</h2><p>" + "x ".repeat(120) + "</p><style>a{color:#e94560}</style>");
    expect(b.nav).toEqual(["Shop", "Deals"]);
    expect(b.sections).toEqual(["Fresh in 10 minutes", "Categories"]);
    expect(b.needsScreenshots).toBe(false);
  });
  it("asks for screenshots when the site shows a bot check", () => {
    expect(captureBrand("<html><body>Checking your browser before accessing the site</body></html>").needsScreenshots).toBe(true);
  });
});

describe("captureBrandFromUrl", () => {
  it("reads linked stylesheets through the safe fetcher", async () => {
    const seen: string[] = [];
    const fake = (async (u: string, _t?: unknown, kind?: string) => {
      seen.push(`${kind ?? "html"}:${u}`);
      if (kind === "css") return { ok: true as const, url: u, html: ":root{--brand-primary:#e94560} h1{font-family:'Fraunces',serif}" };
      return { ok: true as const, url: "https://acme.example/", html: '<html><head><title>Acme</title><link rel="stylesheet" href="/a.css"></head><body><h1>Hello world</h1></body></html>' };
    }) as unknown as typeof import("./safe-fetch").fetchPublicSite;
    const r = await captureBrandFromUrl("https://acme.example/", fake);
    expect(r.ok && r.brand.roles["primary"]).toBe("#e94560");
    expect(r.ok && r.brand.fonts).toContain("Fraunces");
    expect(seen).toEqual(["html:https://acme.example/", "css:https://acme.example/a.css"]);
  });
  it("returns the fetcher's plain message when the site cannot be read", async () => {
    const fake = (async () => ({ ok: false as const, reason: "unreachable" as const, message: "We couldn't reach that website." })) as unknown as typeof import("./safe-fetch").fetchPublicSite;
    expect(await captureBrandFromUrl("https://x.example", fake)).toEqual({ ok: false, message: "We couldn't reach that website." });
  });
});
