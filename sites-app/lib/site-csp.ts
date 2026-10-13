/** Content-Security-Policy for every published page (user's own Vercel deploy and the hosted sites). Keep free of imports: sites-app/lib/site-csp.ts is a byte-for-byte copy. */
export const PUBLISHED_SITE_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; media-src 'self'; connect-src 'none'; form-action 'none'; frame-src 'none'; base-uri 'none'";
