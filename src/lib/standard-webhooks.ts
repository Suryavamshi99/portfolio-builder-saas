import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies a webhook against the open Standard Webhooks spec
 * (standardwebhooks.com) — used as-is by Dodo Payments, and by design not
 * provider-specific, so this is reusable for any future provider that
 * follows the same spec.
 *
 * Algorithm: HMAC-SHA256 over "{id}.{timestamp}.{rawBody}", keyed by the
 * base64 portion of the "whsec_..." secret, compared (constant-time)
 * against each "v1,<base64>" entry in the signature header — there can be
 * more than one, space-separated, for key rotation. Also rejects a
 * timestamp outside a tolerance window to defeat replay of an old,
 * validly-signed payload.
 */
export function verifyStandardWebhook(opts: {
  id: string;
  timestamp: string;
  signatureHeader: string;
  rawBody: string;
  secret: string;
  toleranceSeconds?: number;
}): boolean {
  const tolerance = opts.toleranceSeconds ?? 5 * 60;
  const timestampSeconds = Number(opts.timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  if (Math.abs(Date.now() / 1000 - timestampSeconds) > tolerance) return false;

  const secretBytes = Buffer.from(opts.secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${opts.id}.${opts.timestamp}.${opts.rawBody}`;
  const expected = createHmac("sha256", secretBytes).update(signedContent).digest();

  const candidates = opts.signatureHeader
    .split(" ")
    .map((entry) => entry.split(",")[1])
    .filter((sig): sig is string => Boolean(sig));

  return candidates.some((candidate) => {
    let candidateBytes: Buffer;
    try {
      candidateBytes = Buffer.from(candidate, "base64");
    } catch {
      return false;
    }
    return candidateBytes.length === expected.length && timingSafeEqual(candidateBytes, expected);
  });
}
