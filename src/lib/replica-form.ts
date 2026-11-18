/** Form rules for the "look like a company's site" option. Mirrors the server's checks so errors show before sending. */
export const REPLICA_COMPANY_MAX = 80;

export const replicaUiEnabled = (): boolean => import.meta.env["VITE_REPLICA_ENABLED"] === "true";

/** Plain-language error for the address field, or null when it is fine. */
export function replicaUrlError(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "Enter the company's website address.";
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return "Enter the full address, starting with https://";
  }
  if (u.protocol !== "https:") return "The address must start with https://";
  if (!u.hostname.includes(".") || u.username || u.password) return "That doesn't look like a website address.";
  return null;
}

export function replicaCompanyError(raw: string): string | null {
  return raw.trim().length > REPLICA_COMPANY_MAX ? `Keep the company name under ${REPLICA_COMPANY_MAX + 1} characters.` : null;
}

/** The `replica` part of a generation request, or undefined when the option is off or not valid yet. */
export function replicaPayload(on: boolean, url: string, company: string): { url: string; company?: string } | undefined {
  if (!on || replicaUrlError(url) || replicaCompanyError(company)) return undefined;
  const name = company.trim();
  return { url: url.trim(), ...(name ? { company: name } : {}) };
}
