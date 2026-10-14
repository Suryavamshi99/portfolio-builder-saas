import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRequestHeader } from "@tanstack/react-start/server";

export type AdminAuditTargetType = "user" | "site" | "domain" | "job" | "provider" | "mcp" | "system";

export type AdminAuditAction =
  | "user.plan_change"
  | "user.admin_flag"
  | "user.html_edit"
  | "user.delete"
  | "user.mcp_revoke"
  | "site.takedown"
  | "domain.remove"
  | "job.cancel"
  | "provider.clear_cooldown"
  | (string & {});

export interface LogAdminActionOptions {
  action: AdminAuditAction;
  targetType: AdminAuditTargetType;
  targetId?: string | null;
  reason?: string | null;
  detail?: Record<string, unknown> | null;
  request?: Request;
}

const SENSITIVE_KEY_PATTERN = /password|secret|token|key|html/i;

export function sanitizeAuditDetail(detail?: Record<string, unknown> | null): Record<string, unknown> {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) {
    return {};
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(detail)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitizeAuditDetail(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function computeActorHash(clientIp: string, sessionSecret = process.env["ADMIN_SESSION_SECRET"] || ""): string {
  return createHash("sha256")
    .update(clientIp + sessionSecret)
    .digest("hex")
    .slice(0, 16);
}

function extractClientIp(request?: Request): string {
  let headerValue: string | null = null;
  if (request) {
    headerValue = request.headers.get("x-forwarded-for");
  }
  if (!headerValue) {
    try {
      headerValue = getRequestHeader("x-forwarded-for") ?? null;
    } catch {
      // Not in TanStack Start server request context
    }
  }
  if (!headerValue) return "";
  const first = headerValue.split(",")[0]?.trim();
  return first ?? "";
}

export async function logAdminAction(admin: SupabaseClient, opts: LogAdminActionOptions): Promise<void> {
  const { action, targetType, targetId, reason, detail, request } = opts;
  const clientIp = extractClientIp(request);
  const sessionSecret = process.env["ADMIN_SESSION_SECRET"] || "";
  const actorHash = computeActorHash(clientIp, sessionSecret);
  const sanitized = sanitizeAuditDetail(detail);

  try {
    const { error } = await admin.from("admin_audit_log").insert({
      action,
      target_type: targetType,
      target_id: targetId ?? null,
      reason: reason ?? null,
      detail: sanitized,
      actor_hash: actorHash,
    });
    if (error) {
      console.error("Failed to write to admin_audit_log:", error);
    }
  } catch (err) {
    console.error("Failed to write to admin_audit_log:", err);
  }
}

export function validateReason(reason: unknown): { ok: true; reason: string } | { ok: false; response: Response } {
  if (typeof reason !== "string") {
    return {
      ok: false,
      response: Response.json(
        { error: { code: "reason_required", message: "Reason must be provided (3-300 characters)" } },
        { status: 400 },
      ),
    };
  }
  const trimmed = reason.trim();
  if (trimmed.length < 3 || trimmed.length > 300) {
    return {
      ok: false,
      response: Response.json(
        { error: { code: "reason_required", message: "Reason must be between 3 and 300 characters" } },
        { status: 400 },
      ),
    };
  }
  return { ok: true, reason: trimmed };
}

export function parsePagination(url: URL): { page: number; pageSize: number; offset: number } {
  let page = parseInt(url.searchParams.get("page") || "1", 10);
  if (isNaN(page) || page < 1) page = 1;
  let pageSize = parseInt(url.searchParams.get("pageSize") || "25", 10);
  if (isNaN(pageSize) || pageSize < 1) pageSize = 25;
  if (pageSize > 100) pageSize = 100;
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}
