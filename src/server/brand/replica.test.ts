import { describe, expect, it } from "vitest";
import { sanitizeHtmlForServing } from "@/server/finalize-html";
import { hasNoindexMeta, responseHeaders } from "@/server/sites-serve";
import { replicaCompanyError, replicaPayload, replicaUrlError } from "@/lib/replica-form";
import type { BrandCapture } from "./capture";
import { checkReplicaRequest, parseReplicaRequest, replicaEnabled } from "./replica";
import { buildReplicaBrief, closestGoogleFont, resolveReplica, toneWords } from "./replica-brief";
import { applyReplicaGuard, nameFromResume } from "./replica-guard";

const ok = { enabled: true, hasTheme: false, paid: true };

describe("parseReplicaRequest", () => {
  it("accepts an https address with an optional company", () => {
    expect(parseReplicaRequest({ url: "https://www.acme.com/" })).toEqual({ url: "https://www.acme.com/" });
    expect(parseReplicaRequest({ url: "https://acme.com", company: "  Acme   Inc " })).toEqual({ url: "https://acme.com/", company: "Acme Inc" });
  });
  it("rejects bad addresses, long or odd names and unknown keys", () => {
    for (const bad of [
      { url: "http://acme.com" },
      { url: "https://localhost" },
      { url: "https://10.0.0.1" },
      { url: "not a url" },
      { url: 5 },
      { url: "https://acme.com", company: "x".repeat(81) },
      { url: "https://acme.com", company: "<b>x</b>" },
      { url: "https://acme.com", extra: 1 },
      "https://acme.com",
      null,
      [],
    ]) {
      expect(parseReplicaRequest(bad)).toBeNull();
    }
  });
});

describe("checkReplicaRequest", () => {
  it("returns 404 not_available when the flag is off, before anything else", () => {
    expect(checkReplicaRequest({ nonsense: 1 }, { ...ok, enabled: false })).toMatchObject({ ok: false, status: 404, code: "not_available" });
  });
  it("rejects a theme alongside, bad bodies and unpaid users", () => {
    expect(checkReplicaRequest({ url: "https://acme.com" }, { ...ok, hasTheme: true })).toMatchObject({ status: 400 });
    expect(checkReplicaRequest({ url: "http://acme.com" }, ok)).toMatchObject({ status: 400 });
    expect(checkReplicaRequest({ url: "https://acme.com" }, { ...ok, paid: false })).toMatchObject({ status: 402, code: "replica_requires_pro" });
    expect(checkReplicaRequest({ url: "https://acme.com" }, ok)).toEqual({ ok: true, replica: { url: "https://acme.com/" } });
  });
  it("reads the flag at call time", () => {
    const before = process.env["REPLICA_ENABLED"];
    process.env["REPLICA_ENABLED"] = "true";
    expect(replicaEnabled()).toBe(true);
    process.env["REPLICA_ENABLED"] = "yes";
    expect(replicaEnabled()).toBe(false);
    if (before === undefined) delete process.env["REPLICA_ENABLED"];
    else process.env["REPLICA_ENABLED"] = before;
  });
});

const brand = (over: Partial<BrandCapture> = {}): BrandCapture => ({
  name: "Acme Rockets | Home",
  description: "Zorblax quantum widgets for everyone",
  palette: ["#ff5500", "#112233"],
  fonts: ["Gotham", "Zzyzx Display"],
  voice: ["Launch the Zorblax revolution", "Build faster with Quuxware"],
  roles: { primary: "#ff5500", background: "#fafafa" },
  nav: ["Zorblax Products", "Pricing", "Our story", "Contact sales"],
  sections: ["Launch the Zorblax revolution", "Why Quuxware", "Customers love us", "Pricing plans"],
  needsScreenshots: false,
  ...over,
});
const replica = { url: "https://www.acme.com/", company: "Acme" };

describe("buildReplicaBrief", () => {
  it("includes the hard rules and the captured colours and fonts", () => {
    const { brief } = buildReplicaBrief(brand(), replica);
    expect(brief).toContain("An independent concept by <the person's name>, not affiliated with Acme.");
    expect(brief).toContain("noindex,nofollow");
    expect(brief).toMatch(/Never use Acme's logo/);
    expect(brief).toMatch(/Do not invent reviews/);
    expect(brief).toMatch(/Google Fonts only/);
    expect(brief).toContain("#ff5500");
    expect(brief).toContain("Montserrat"); // Gotham
  });
  it("never quotes the company's text", () => {
    const { brief } = buildReplicaBrief(brand(), replica);
    for (const leaked of ["Zorblax", "Quuxware", "Customers love us", "Contact sales", "quantum widgets", "Our story"]) {
      expect(brief).not.toContain(leaked);
    }
  });
  it("warns and does not guess when fonts, colours or voice are missing", () => {
    const { brief, warnings } = buildReplicaBrief(brand({ fonts: [], palette: [], roles: {}, voice: [] }), replica);
    expect(warnings.join(" ")).toMatch(/fonts/);
    expect(warnings.join(" ")).toMatch(/colours/);
    expect(warnings.join(" ")).toMatch(/tone/);
    expect(brief).toContain("Do not guess brand colours");
  });
  it("relies on screenshots when the site could not be read", () => {
    const { brief, warnings } = buildReplicaBrief(null, replica);
    expect(brief).toMatch(/only from the attached screenshots/);
    expect(warnings[0]).toMatch(/your screenshots/);
  });
  it("falls back to the company's host for the name", () => {
    expect(buildReplicaBrief(null, { url: "https://www.acme.com/" }).companyName).toBe("acme.com");
    expect(buildReplicaBrief(brand(), { url: "https://www.acme.com/" }).companyName).toBe("Acme Rockets");
  });
});

describe("fonts and tone", () => {
  it("maps known names, passes Google fonts through and falls back to Inter", () => {
    expect(closestGoogleFont("Helvetica Neue")).toEqual({ family: "Inter", exact: false });
    expect(closestGoogleFont('"DM Sans"')).toEqual({ family: "DM Sans", exact: true });
    expect(closestGoogleFont("Zzyzx")).toEqual({ family: "Inter", exact: false });
    expect(closestGoogleFont("Acme Mono").family).toBe("JetBrains Mono");
  });
  it("gives neutral tone words when nothing matches", () => {
    expect(toneWords(["xyz"])).toEqual(["clear", "confident"]);
    expect(toneWords(["Build with our API"])).toContain("technical");
  });
});

describe("resolveReplica", () => {
  it("marks an unreadable site as needing screenshots", async () => {
    const r = await resolveReplica({ url: "https://acme.com/" }, async () => ({ ok: false, message: "blocked" }));
    expect(r.needsImages).toBe(true);
    expect(r.brief).toMatch(/screenshots/);
  });
  it("marks a bot-check page the same way, and a good read as not", async () => {
    const blocked = await resolveReplica({ url: "https://acme.com/" }, async () => ({ ok: true, url: "https://acme.com/", brand: brand({ needsScreenshots: true }) }));
    expect(blocked.needsImages).toBe(true);
    const good = await resolveReplica({ url: "https://acme.com/" }, async () => ({ ok: true, url: "https://acme.com/", brand: brand() }));
    expect(good.needsImages).toBe(false);
  });
  it("survives a throwing reader and reuses a stored brief without reading again", async () => {
    expect((await resolveReplica({ url: "https://acme.com/" }, async () => { throw new Error("x"); })).needsImages).toBe(true);
    let calls = 0;
    const r = await resolveReplica({ url: "https://acme.com/", brief: "B", companyName: "Acme" }, async () => { calls++; return { ok: false, message: "" }; });
    expect(calls).toBe(0);
    expect(r).toMatchObject({ brief: "B", needsImages: false });
  });
});

const page = `<!doctype html><html><head><title>t</title><link rel="icon" href="https://www.acme.com/favicon.ico"><meta name="robots" content="index"><style>.h{background:url(https://cdn.acme.com/bg.png)} .k{background:url(https://fonts.gstatic.com/x)}</style></head>
<body><header>Nav</header><main><img src="https://www.acme.com/logo.png" alt="logo"><img src="images/me.png" alt="me"><svg><use href="https://acme.com/s.svg#a"></use></svg><svg><circle r="1"/></svg></main><footer><p>Bye</p></footer></body></html>`;
const guardOpts = { name: "Ada Lovelace", company: "Acme", companyUrl: "https://www.acme.com/" };

describe("applyReplicaGuard", () => {
  it("adds the disclaimer at the top and in the footer, and noindex", () => {
    const { html } = applyReplicaGuard(page, guardOpts);
    const text = "An independent concept by Ada Lovelace, not affiliated with Acme.";
    expect(html.match(/<meta name="robots"/g)).toHaveLength(1);
    expect(html).toContain('content="noindex,nofollow"');
    expect(html).toMatch(/<body[^>]*>\s*<div data-replica-disclaimer="top"[^>]*>An independent concept/);
    expect(html.split(text)).toHaveLength(3);
    expect(html).toMatch(/<footer>[\s\S]*data-replica-disclaimer="footer"/);
  });
  it("is idempotent", () => {
    const once = applyReplicaGuard(page, guardOpts).html;
    expect(applyReplicaGuard(once, guardOpts).html).toBe(once);
  });
  it("escapes names", () => {
    const { html } = applyReplicaGuard(page, { ...guardOpts, name: 'A<script>alert(1)</script>"', company: "B&C <i>" });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("B&amp;C");
  });
  it("removes images, icons, css and svg from the company's host but keeps the user's", () => {
    const { html, removed } = applyReplicaGuard(page, guardOpts);
    expect(html).not.toContain("acme.com/logo.png");
    expect(html).not.toContain("favicon.ico");
    expect(html).not.toContain("cdn.acme.com");
    expect(html).not.toContain("acme.com/s.svg");
    expect(html).toContain("images/me.png");
    expect(html).toContain("fonts.gstatic.com");
    expect(html).toContain("<circle");
    expect(removed).toBe(4);
  });
  it("survives the page rules again and keeps the noindex meta when served", () => {
    const guarded = applyReplicaGuard(page, guardOpts).html;
    const served = sanitizeHtmlForServing(guarded);
    expect(hasNoindexMeta(served)).toBe(true);
    expect(served).toContain("An independent concept by Ada Lovelace");
    expect(hasNoindexMeta("<meta name='robots' content='index'>")).toBe(false);
    expect(responseHeaders("text/html", true)["X-Robots-Tag"]).toBe("noindex, nofollow");
    expect(responseHeaders("text/html")["X-Robots-Tag"]).toBeUndefined();
  });
  it("finds the name on a resume's first lines", () => {
    expect(nameFromResume("\nAda Lovelace\nEngineer\nada@x.com")).toBe("Ada Lovelace");
    expect(nameFromResume("RESUME 2024\n123 Main St")).toBe("");
  });
});

describe("replica form rules", () => {
  it("validates the address and name in plain words", () => {
    expect(replicaUrlError("")).toMatch(/Enter/);
    expect(replicaUrlError("acme")).toMatch(/https/);
    expect(replicaUrlError("http://acme.com")).toMatch(/https/);
    expect(replicaUrlError("https://acme.com")).toBeNull();
    expect(replicaCompanyError("x".repeat(81))).toMatch(/under/);
  });
  it("builds the payload only when on and valid", () => {
    expect(replicaPayload(false, "https://acme.com", "")).toBeUndefined();
    expect(replicaPayload(true, "nope", "")).toBeUndefined();
    expect(replicaPayload(true, " https://acme.com ", " Acme ")).toEqual({ url: "https://acme.com", company: "Acme" });
    expect(replicaPayload(true, "https://acme.com", " ")).toEqual({ url: "https://acme.com" });
  });
});
