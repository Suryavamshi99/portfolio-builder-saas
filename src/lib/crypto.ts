import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Envelope encryption for secrets we store on a user's behalf (BYOK
 * provider keys, Vercel OAuth tokens) — AES-256-GCM with a key that lives
 * only in this app's environment, never in Postgres. A DB dump alone is
 * useless without also having this env var, which is the point: it keeps
 * "encrypted at rest" meaningful even if the database itself leaks.
 *
 * Ciphertext and the GCM auth tag are stored together (tag appended);
 * the nonce is stored separately since it must be unique per encryption,
 * not secret.
 */

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env["ENCRYPTION_KEY"];
  if (!raw) throw new Error("ENCRYPTION_KEY must be set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes (base64-encoded)");
  }
  return key;
}

export function encryptSecret(plaintext: string): { ciphertext: Buffer; nonce: Buffer } {
  const nonce = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext: Buffer.concat([encrypted, authTag]), nonce };
}

export function decryptSecret(ciphertext: Buffer, nonce: Buffer): string {
  const authTag = ciphertext.subarray(ciphertext.length - 16);
  const encrypted = ciphertext.subarray(0, ciphertext.length - 16);
  const decipher = createDecipheriv(ALGORITHM, getKey(), nonce);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

/**
 * PostgREST represents Postgres `bytea` columns as a `\x`-prefixed hex
 * string over JSON, both directions — never raw binary. These convert
 * between that wire format and the Buffers encryptSecret/decryptSecret use.
 */
export function bufferToBytea(buffer: Buffer): string {
  return `\\x${buffer.toString("hex")}`;
}

export function byteaToBuffer(bytea: string): Buffer {
  const hex = bytea.startsWith("\\x") ? bytea.slice(2) : bytea;
  return Buffer.from(hex, "hex");
}
