export const RESERVED_SLUGS: readonly string[] = Object.freeze([
  "www",
  "api",
  "app",
  "admin",
  "mail",
  "ftp",
  "ns1",
  "ns2",
  "smtp",
  "imap",
  "pop",
  "blog",
  "docs",
  "help",
  "support",
  "status",
  "static",
  "assets",
  "cdn",
  "dev",
  "staging",
  "test",
  "demo",
  "root",
  "login",
  "signup",
  "dashboard",
  "studio",
  "shipfolio",
]);

export const BLOCKED_WORDS: readonly string[] = Object.freeze([
  "paypal",
  "google",
  "microsoft",
  "apple",
  "amazon",
  "bank",
  "login",
  "signin",
  "verify",
  "security",
  "phishing",
  "support-team",
  "billing",
]);

const RESERVED_SET = new Set(RESERVED_SLUGS);
const BLOCKED_SET = new Set(BLOCKED_WORDS);

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/;

export type ValidateSlugResult =
  | { ok: true; slug: string }
  | { ok: false; status: "invalid" | "reserved" };

/**
 * Validates a candidate subdomain slug:
 * - lowercase, trimmed
 * - matches regex ^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$ (3 to 40 characters)
 * - no consecutive hyphens ("--")
 * - not reserved (status: "reserved")
 * - not blocked phishing / brand word (status: "reserved")
 */
export function validateSlug(raw: unknown): ValidateSlugResult {
  if (typeof raw !== "string") {
    return { ok: false, status: "invalid" };
  }

  const slug = raw.trim().toLowerCase();

  if (!SLUG_REGEX.test(slug)) {
    return { ok: false, status: "invalid" };
  }

  if (slug.includes("--")) {
    return { ok: false, status: "invalid" };
  }

  if (RESERVED_SET.has(slug) || BLOCKED_SET.has(slug)) {
    return { ok: false, status: "reserved" };
  }

  return { ok: true, slug };
}

/**
 * Derives a candidate slug from a human-readable title or name:
 * - ASCII-fold (decomposes unicode accents and strips diacritics)
 * - lowercase
 * - non-alphanumerics → '-'
 * - collapse multiple '-' and trim '-'
 * - cut to at most 30 characters
 * - may return "" if empty after stripping
 */
export function slugFromTitle(title: string): string {
  const folded = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return folded.slice(0, 30).replace(/-+$/, "");
}

/**
 * Returns the public URL for a published site slug.
 * Env is read inside handler/function, not at module scope.
 */
export function siteUrl(slug: string): string {
  const domain = process.env["SITES_DOMAIN"] ?? "";
  return `https://${slug}.${domain}`;
}

/**
 * Maps a request Host header to a valid site slug given the configured sites domain.
 * - lowercase, strip port
 * - host must end with `.${sitesDomain}`
 * - the prefix label must be a single label without extra dots and pass validateSlug
 * - anything else (apex, multi-level, other domain) returns null
 */
export function hostToSlug(host: string | null | undefined, sitesDomain: string | null | undefined): string | null {
  if (!host || !sitesDomain) return null;

  const normalizedDomain = sitesDomain.trim().toLowerCase();
  if (!normalizedDomain) return null;

  const hostname = host.trim().toLowerCase().split(":")[0];
  if (!hostname) return null;

  const suffix = `.${normalizedDomain}`;
  if (!hostname.endsWith(suffix)) return null;

  const candidate = hostname.slice(0, -suffix.length);
  if (!candidate || candidate.includes(".")) {
    return null;
  }

  const validation = validateSlug(candidate);
  if (!validation.ok) {
    return null;
  }

  return validation.slug;
}
