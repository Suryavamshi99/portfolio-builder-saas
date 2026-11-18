import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import net from "node:net";

/**
 * Fetches a company's public home page for brand capture. The URL is typed by a user, so every hop is checked:
 * https only, no credentials or odd ports, no private, loopback, link-local or metadata addresses, and the connection
 * is pinned to the address we checked (so a second DNS answer cannot point it somewhere else).
 */

export const MAX_SITE_BYTES = 1_500_000;
const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;
const USER_AGENT = "ShipfolioBrandCapture/1.0 (+https://www.shipfolio.xyz)";

export type SafeFetchResult =
  | { ok: true; url: string; html: string }
  | { ok: false; reason: "invalid_url" | "blocked_address" | "not_html" | "too_large" | "too_many_redirects" | "unreachable" | "bad_status"; message: string };

/** True when an IP address must never be fetched: loopback, private, link-local, multicast, reserved, or cloud metadata. */
export function isBlockedAddress(ip: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  const addr = mapped?.[1] ?? ip;
  if (net.isIPv4(addr)) {
    const [a, b] = addr.split(".").map(Number) as [number, number];
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (net.isIPv6(addr)) {
    const lower = addr.toLowerCase();
    return (
      lower === "::" || lower === "::1" ||
      lower.startsWith("fc") || lower.startsWith("fd") ||
      lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb") ||
      lower.startsWith("ff")
    );
  }
  return true;
}

/** Checks the text of a URL before any network call. Returns the cleaned URL or null. */
export function parsePublicUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  if (u.port && u.port !== "443") return null;
  const host = u.hostname.toLowerCase();
  if (!host.includes(".") || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return null;
  if (net.isIP(host) && isBlockedAddress(host)) return null;
  return u;
}

interface Hop {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
}

/** One HTTPS request pinned to a checked address. Reads at most MAX_SITE_BYTES. */
function requestPinned(url: URL, address: string, family: number): Promise<Hop | "too_large" | "unreachable"> {
  return new Promise((resolve) => {
    const req = httpsRequest(
      {
        host: url.hostname,
        servername: url.hostname,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,text/css;q=0.9", "accept-encoding": "identity" },
        timeout: TIMEOUT_MS,
        lookup: (_host, _opts, cb) => cb(null, address, family),
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > MAX_SITE_BYTES) {
            req.destroy();
            resolve("too_large");
            return;
          }
          chunks.push(c);
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
        res.on("error", () => resolve("unreachable"));
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve("unreachable");
    });
    req.on("error", () => resolve("unreachable"));
    req.end();
  });
}

async function checkedAddress(host: string): Promise<{ address: string; family: number } | null> {
  const addrs = await dnsLookup(host, { all: true, verbatim: true }).catch(() => []);
  if (addrs.length === 0) return null;
  if (addrs.some((a) => isBlockedAddress(a.address))) return null;
  const first = addrs[0];
  return first ? { address: first.address, family: first.family } : null;
}

/** Fetches the page at `raw`, following at most a few safe redirects. */
export async function fetchPublicSite(raw: string, transport = requestPinned, kind: "html" | "css" = "html"): Promise<SafeFetchResult> {
  const first = parsePublicUrl(raw);
  if (!first) return { ok: false, reason: "invalid_url", message: "Enter a full web address that starts with https://" };
  let url: URL = first;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const target = await checkedAddress(url.hostname);
    if (!target) return { ok: false, reason: "blocked_address", message: "That address can't be used. Enter your company's public website." };
    const res = await transport(url, target.address, target.family);
    if (res === "too_large") return { ok: false, reason: "too_large", message: "That page is too large to read. Try the company's home page." };
    if (res === "unreachable") return { ok: false, reason: "unreachable", message: "We couldn't reach that website. Check the address and try again." };

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers["location"];
      let next: URL | null = null;
      if (typeof location === "string") {
        try {
          next = parsePublicUrl(new URL(location, url).toString());
        } catch {
          next = null;
        }
      }
      if (!next) return { ok: false, reason: "blocked_address", message: "That website redirects somewhere we can't use." };
      url = next;
      continue;
    }
    if (res.status < 200 || res.status >= 300) return { ok: false, reason: "bad_status", message: "That website didn't load a page. Check the address." };
    const type = String(res.headers["content-type"] ?? "");
    const okType = kind === "css" ? /text\/css/i : /text\/html|application\/xhtml\+xml/i;
    if (!okType.test(type)) return { ok: false, reason: "not_html", message: "That address isn't a web page." };
    return { ok: true, url: url.toString(), html: res.body.toString("utf8") };
  }
  return { ok: false, reason: "too_many_redirects", message: "That website redirects too many times. Enter the final address." };
}
