import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;

/** Encode buffer into RFC 4648 Base32 without padding */
export function encodeBase32(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i]!;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/** Decode RFC 4648 Base32 string to Buffer */
export function decodeBase32(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/[\s-=]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]!);
    if (idx === -1) {
      throw new Error(`Invalid Base32 character: ${cleaned[i]}`);
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/** Generate a 20-byte random secret in Base32 format (32 characters) */
export function generateTotpSecret(): string {
  const bytes = randomBytes(20);
  return encodeBase32(bytes);
}

/** Build standard otpauth URI */
export function getTotpUri(username: string, secretBase32: string): string {
  return `otpauth://totp/Shipfolio%20Admin:${encodeURIComponent(username)}?secret=${secretBase32}&issuer=Shipfolio%20Admin`;
}

/** Compute TOTP code for a specific step count (RFC 6238 / RFC 4226) */
export function generateTotpCodeForStep(secret: Buffer | string, step: bigint | number): string {
  const secretBuffer = typeof secret === "string" ? decodeBase32(secret) : secret;
  const stepBigInt = BigInt(step);

  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigInt64BE(stepBigInt);

  const hmac = createHmac("sha1", secretBuffer).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;

  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);

  const otp = binary % 10 ** DIGITS;
  return otp.toString().padStart(DIGITS, "0");
}

/** Calculate step number for a given timestamp in ms */
export function getTotpStep(timeMs: number = Date.now()): bigint {
  return BigInt(Math.floor(timeMs / 1000 / STEP_SECONDS));
}

export interface VerifyTotpOptions {
  timeMs?: number;
  lastStep?: string | number | bigint | null;
  window?: number; // default 1 (accepts ±1 step)
}

export interface VerifyTotpResult {
  ok: boolean;
  step?: bigint;
}

/**
 * Verify a 6-digit TOTP code against a Base32 secret.
 * Checks ±1 step window and rejects any step <= lastStep to prevent replay.
 * Uses constant-time comparison.
 */
export function verifyTotpCode(
  secretBase32: string,
  candidateCode: string,
  options: VerifyTotpOptions = {},
): VerifyTotpResult {
  const code = candidateCode.trim();
  if (!/^\d{6}$/.test(code)) {
    return { ok: false };
  }

  let secretBuf: Buffer;
  try {
    secretBuf = decodeBase32(secretBase32);
  } catch {
    return { ok: false };
  }

  const timeMs = options.timeMs ?? Date.now();
  const currentStep = getTotpStep(timeMs);
  const window = options.window ?? 1;
  const lastStep = options.lastStep != null ? BigInt(options.lastStep) : null;

  const candidateBuf = Buffer.from(code, "utf8");

  // Check from step - window to step + window
  for (let offset = -window; offset <= window; offset++) {
    const step = currentStep + BigInt(offset);

    // Anti-replay: reject if step <= lastStep
    if (lastStep !== null && step <= lastStep) {
      continue;
    }

    const expectedCode = generateTotpCodeForStep(secretBuf, step);
    const expectedBuf = Buffer.from(expectedCode, "utf8");

    if (candidateBuf.length === expectedBuf.length && timingSafeEqual(candidateBuf, expectedBuf)) {
      return { ok: true, step };
    }
  }

  return { ok: false };
}
