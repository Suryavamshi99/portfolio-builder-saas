import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminEnv } from "@/lib/admin/env";

export type AdminAuditTargetType = "user" | "site" | "domain" | "job" | "provider" | "mcp" | "system";

export interface LogAdminActionOptions {
  action: string;
  targetType: AdminAuditTargetType;
  targetId?: string | null;
  reason?: string | null;
  detail?: Record<string, unknown>;
  request?: Request;
}

const REDACTED_KEY_REGEX = /password|secret|token|key|html/i;

export function sanitizeAuditDetail(detail?: Record<string, unknown>): Record<string, unknown> {
  if (!detail || typeof detail !== "object") return {};
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(detail)) {
    if (REDACTED_KEY_REGEX.test(k)) continue;
    sanitized[k] = v;
  }
  return sanitized;
}

export function computeActorHash(clientIp: string, sessionSecret: string): string {
  return createHash("sha256")
    .update((clientIp || "") + sessionSecret)
    .digest("hex")
    .slice(0, 16);
}

/**
 * Log an administrative action to admin_audit_log.
 * Never throws — failures are logged to console.warn to ensure the primary mutation is not interrupted.
 * Detail keys matching password|secret|token|key|html are automatically stripped.
 */
export async function logAdminAction(
  admin: SupabaseClient,
  params: LogAdminActionOptions,
): Promise<void> {
  try {
    const { sessionSecret } = getAdminEnv();
    const clientIp = params.request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
    const actorHash = computeActorHash(clientIp, sessionSecret);
    const detail = sanitizeAuditDetail(params.detail);

    await admin.from("admin_audit_log").insert({
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId ?? null,
      reason: params.reason ?? null,
      detail,
      actor_hash: actorHash,
    });
  } catch (err) {
    console.warn("Failed to write admin audit log:", err);
  }
}
