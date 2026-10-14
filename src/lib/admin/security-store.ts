import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

export interface AdminSecurityRow {
  id: boolean;
  totp_secret_enc: string | null;
  totp_enabled_at: string | null;
  recovery_hashes: string[];
  session_epoch: number;
  last_totp_step: string | number | bigint | null;
  updated_at: string;
}

const RECOVERY_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 32 unambiguous alphanumeric characters

export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(normalizeRecoveryCode(code)).digest("hex");
}

export function generateRecoveryCodes(): { plaintextCodes: string[]; hashes: string[] } {
  const plaintextCodes: string[] = [];
  const hashes: string[] = [];

  for (let i = 0; i < 8; i++) {
    const bytes = randomBytes(10);
    let raw = "";
    for (let j = 0; j < 10; j++) {
      raw += RECOVERY_CHARS[bytes[j]! % RECOVERY_CHARS.length];
    }
    const formatted = `${raw.slice(0, 5)}-${raw.slice(5)}`;
    plaintextCodes.push(formatted);
    hashes.push(hashRecoveryCode(formatted));
  }

  return { plaintextCodes, hashes };
}

export function encryptTotpSecret(secret: string): string {
  const { ciphertext, nonce } = encryptSecret(secret);
  return Buffer.concat([nonce, ciphertext]).toString("base64");
}

export function decryptTotpSecret(packed: string): string {
  const buffer = Buffer.from(packed, "base64");
  const nonce = buffer.subarray(0, 12);
  const ciphertext = buffer.subarray(12);
  return decryptSecret(ciphertext, nonce);
}

export async function getAdminSecurity(admin: SupabaseClient): Promise<AdminSecurityRow> {
  const { data, error } = await admin
    .from("admin_security")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read admin_security: ${error.message}`);
  }

  if (data) {
    return data as AdminSecurityRow;
  }

  // Insert default row if none exists
  const initial: Partial<AdminSecurityRow> = {
    id: true,
    totp_secret_enc: null,
    totp_enabled_at: null,
    recovery_hashes: [],
    session_epoch: 1,
    last_totp_step: null,
  };

  const { data: inserted, error: insertError } = await admin
    .from("admin_security")
    .insert(initial)
    .select("*")
    .single();

  if (insertError) {
    throw new Error(`Failed to initialize admin_security: ${insertError.message}`);
  }

  return inserted as AdminSecurityRow;
}

export async function savePendingTotpSecret(admin: SupabaseClient, secretBase32: string): Promise<void> {
  const encrypted = encryptTotpSecret(secretBase32);
  const { error } = await admin
    .from("admin_security")
    .upsert({
      id: true,
      totp_secret_enc: encrypted,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    throw new Error(`Failed to save pending TOTP secret: ${error.message}`);
  }
}

export async function enableTotp(
  admin: SupabaseClient,
  recoveryHashes: string[],
  step: bigint | number,
): Promise<void> {
  const { error } = await admin
    .from("admin_security")
    .update({
      totp_enabled_at: new Date().toISOString(),
      recovery_hashes: recoveryHashes,
      last_totp_step: String(step),
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);

  if (error) {
    throw new Error(`Failed to enable TOTP: ${error.message}`);
  }
}

export async function updateLastTotpStep(admin: SupabaseClient, step: bigint | number): Promise<void> {
  const { error } = await admin
    .from("admin_security")
    .update({
      last_totp_step: String(step),
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);

  if (error) {
    throw new Error(`Failed to update last_totp_step: ${error.message}`);
  }
}

export async function verifyAndConsumeRecoveryCode(admin: SupabaseClient, code: string): Promise<boolean> {
  const normalized = normalizeRecoveryCode(code);
  if (normalized.length !== 10) {
    return false;
  }

  const hash = hashRecoveryCode(code);
  const row = await getAdminSecurity(admin);

  const idx = row.recovery_hashes.indexOf(hash);
  if (idx === -1) {
    return false;
  }

  // Remove the consumed hash
  const remainingHashes = row.recovery_hashes.filter((_, i) => i !== idx);

  const { error } = await admin
    .from("admin_security")
    .update({
      recovery_hashes: remainingHashes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);

  if (error) {
    throw new Error(`Failed to consume recovery code: ${error.message}`);
  }

  return true;
}

export async function bumpSessionEpoch(admin: SupabaseClient): Promise<number> {
  const row = await getAdminSecurity(admin);
  const nextEpoch = (row.session_epoch || 1) + 1;

  const { error } = await admin
    .from("admin_security")
    .update({
      session_epoch: nextEpoch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);

  if (error) {
    throw new Error(`Failed to bump session epoch: ${error.message}`);
  }

  return nextEpoch;
}

export async function regenerateRecoveryCodes(admin: SupabaseClient): Promise<string[]> {
  const { plaintextCodes, hashes } = generateRecoveryCodes();

  const { error } = await admin
    .from("admin_security")
    .update({
      recovery_hashes: hashes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);

  if (error) {
    throw new Error(`Failed to regenerate recovery codes: ${error.message}`);
  }

  return plaintextCodes;
}
