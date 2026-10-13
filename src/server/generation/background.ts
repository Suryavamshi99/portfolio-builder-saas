/**
 * Keeps work running after the response has been sent. On Vercel the request
 * context exposes `waitUntil`; elsewhere (dev) the promise just runs on.
 * The promise must handle its own errors.
 */
export function runInBackground(work: Promise<unknown>): void {
  const ctx = (globalThis as Record<symbol, unknown>)[Symbol.for("@vercel/request-context")] as
    | { get?: () => { waitUntil?: (p: Promise<unknown>) => void } | undefined }
    | undefined;
  const waitUntil = ctx?.get?.()?.waitUntil;
  const safe = work.catch((e: unknown) => console.error("Background work failed", e instanceof Error ? e.message : e));
  if (waitUntil) waitUntil(safe);
}
