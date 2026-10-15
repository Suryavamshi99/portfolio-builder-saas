/**
 * Visitor country from Vercel's edge geo-IP header (set by Vercel, not the
 * browser, so a client can't forge it on production). Returns an uppercase
 * ISO 3166-1 alpha-2 code, or undefined when missing or malformed, in which
 * case Dodo falls back to its own IP detection at checkout.
 */
export function countryFromRequest(request: Request): string | undefined {
  const raw = request.headers.get("x-vercel-ip-country")?.trim().toUpperCase();
  return raw && /^[A-Z]{2}$/.test(raw) ? raw : undefined;
}
