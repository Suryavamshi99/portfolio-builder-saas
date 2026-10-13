import { randomBytes } from "node:crypto";
import { isIP } from "node:net";

export type ValidateHostnameResult =
  | { ok: true; hostname: string }
  | { ok: false; reason: string };

const LABEL_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const TLD_REGEX = /^[a-z]{2,}$/;

/**
 * Validates a candidate custom domain hostname:
 * - trim, lowercase, strip trailing dot
 * - no scheme, path, port, spaces, underscores
 * - total length 4–253 characters
 * - each label 1–63 chars of [a-z0-9-], not starting or ending with '-'
 * - at least two labels
 * - last label (TLD) 2+ letters (or valid punycode xn--...)
 * - not an IP address (IPv4 or IPv6)
 * - reject sitesDomain itself and any subdomain of it
 * - reject anything ending .vercel.app, .vercel.com, .now.sh, localhost
 * - punycode (xn--) allowed
 */
export function validateHostname(raw: unknown, sitesDomain: string): ValidateHostnameResult {
  if (typeof raw !== "string") {
    return { ok: false, reason: "Hostname must be a string" };
  }

  let hostname = raw.trim().toLowerCase();

  // Strip a single trailing dot if present
  if (hostname.endsWith(".")) {
    hostname = hostname.slice(0, -1);
  }

  if (!hostname) {
    return { ok: false, reason: "Hostname cannot be empty" };
  }

  // Reject spaces, underscores, schemes, paths, ports
  if (
    hostname.includes(" ") ||
    hostname.includes("_") ||
    hostname.includes("/") ||
    hostname.includes(":") ||
    hostname.includes("?") ||
    hostname.includes("#") ||
    hostname.includes("@")
  ) {
    return { ok: false, reason: "Hostname contains invalid characters, scheme, port, or path" };
  }

  if (hostname.length < 4 || hostname.length > 253) {
    return { ok: false, reason: "Hostname must be between 4 and 253 characters" };
  }

  // Reject IP addresses
  if (isIP(hostname) !== 0) {
    return { ok: false, reason: "IP addresses are not allowed" };
  }

  // Reject localhost
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return { ok: false, reason: "localhost is not allowed" };
  }

  // Reject vercel-managed domains
  const blockedSuffixes = [".vercel.app", ".vercel.com", ".now.sh"];
  for (const suffix of blockedSuffixes) {
    if (hostname === suffix.slice(1) || hostname.endsWith(suffix)) {
      return { ok: false, reason: `Domains ending in ${suffix} are not allowed` };
    }
  }

  // Reject sitesDomain itself and any subdomain of it
  const cleanSitesDomain = sitesDomain.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  if (cleanSitesDomain) {
    if (hostname === cleanSitesDomain || hostname.endsWith(`.${cleanSitesDomain}`)) {
      return { ok: false, reason: "Cannot use the app sites domain or any subdomain of it" };
    }
  }

  const labels = hostname.split(".");
  if (labels.length < 2) {
    return { ok: false, reason: "Hostname must have at least two labels" };
  }

  for (const label of labels) {
    if (label.length < 1 || label.length > 63) {
      return { ok: false, reason: "Domain labels must be between 1 and 63 characters" };
    }
    if (!LABEL_REGEX.test(label)) {
      return { ok: false, reason: `Label "${label}" is invalid; only lowercase letters, digits, and hyphens allowed (cannot start/end with hyphen)` };
    }
  }

  // Check last label (TLD): 2+ letters, or punycode (starts with xn--)
  const tld = labels[labels.length - 1]!;
  if (tld.startsWith("xn--")) {
    // Punycode TLD
    if (tld.length < 5) {
      return { ok: false, reason: "Invalid punycode TLD" };
    }
  } else if (!TLD_REGEX.test(tld)) {
    return { ok: false, reason: "TLD must be at least 2 letters" };
  }

  return { ok: true, hostname };
}

/**
 * Returns the DNS TXT record name required to verify domain ownership.
 */
export function verifyRecordName(hostname: string): string {
  return `_shipfolio-verify.${hostname}`;
}

/**
 * Generates a cryptographically random verification token:
 * 24 random bytes base64url encoded, prefixed with 'shipfolio-verify='.
 */
export function newVerifyToken(): string {
  const bytes = randomBytes(24);
  const token = bytes.toString("base64url");
  return `shipfolio-verify=${token}`;
}

/**
 * Matches an array of TXT records (as returned by resolveTxt) against the expected token.
 * Joins chunked parts of each record and performs an exact trimmed match.
 */
export function txtMatches(txtRecords: string[][], token: string): boolean {
  const expected = token.trim();
  for (const chunks of txtRecords) {
    const joined = chunks.join("").trim();
    if (joined === expected) {
      return true;
    }
  }
  return false;
}
