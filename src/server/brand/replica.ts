import { parsePublicUrl } from "./safe-fetch";

/** What a user asks for: build my page in the look of this company's site. The company's words and images are never copied. */
export interface ReplicaRequest {
  /** The company's public https address. */
  url: string;
  /** How the company should be named in the disclaimer. Optional: the site's own name is used otherwise. */
  company?: string | undefined;
}

/** What is stored in generation_jobs.params.replica: the request plus what the first run learned, so a continued build stays consistent. */
export interface ReplicaParams extends ReplicaRequest {
  brief?: string | undefined;
  companyName?: string | undefined;
  warnings?: string[] | undefined;
  needsImages?: boolean | undefined;
}

export const MAX_COMPANY_NAME = 80;
const MAX_URL_LENGTH = 2000;

/** The feature flag. Read inside handlers, never at module scope. */
export function replicaEnabled(): boolean {
  return process.env["REPLICA_ENABLED"] === "true";
}

/** Validates the replica part of a request body. Null when it is not valid (unknown keys included). */
export function parseReplicaRequest(raw: unknown): ReplicaRequest | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  if (Object.keys(rec).some((k) => k !== "url" && k !== "company")) return null;
  const url = rec["url"];
  if (typeof url !== "string" || url.length > MAX_URL_LENGTH) return null;
  const parsed = parsePublicUrl(url);
  if (!parsed) return null;
  const out: ReplicaRequest = { url: parsed.toString() };
  const company = rec["company"];
  if (company !== undefined) {
    if (typeof company !== "string") return null;
    const clean = company.replace(/\s+/g, " ").trim();
    // eslint-disable-next-line no-control-regex
    if (clean.length > MAX_COMPANY_NAME || /[\u0000-\u001f\u007f<>]/.test(clean)) return null;
    if (clean) out.company = clean;
  }
  return out;
}

export type ReplicaCheck =
  | { ok: true; replica: ReplicaRequest }
  | { ok: false; status: 400 | 404; code: "not_available" | "invalid_request"; message: string };

/**
 * The whole server-side gate for a replica request, in order: feature flag, no theme alongside, valid body.
 * There is deliberately no plan check: free users get the company-look preview (watermarked in Studio like any
 * preview); publishing and downloads stay behind the paid plan.
 */
export function checkReplicaRequest(raw: unknown, ctx: { enabled: boolean; hasTheme: boolean }): ReplicaCheck {
  if (!ctx.enabled) return { ok: false, status: 404, code: "not_available", message: "This feature isn't available yet." };
  if (ctx.hasTheme) return { ok: false, status: 400, code: "invalid_request", message: "Pick either a ready-made look or a company look, not both." };
  const replica = parseReplicaRequest(raw);
  if (!replica) {
    return { ok: false, status: 400, code: "invalid_request", message: "Enter the company's website address starting with https:// and a name up to 80 characters." };
  }
  return { ok: true, replica };
}
