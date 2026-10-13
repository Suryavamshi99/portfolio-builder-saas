export class VercelDomainError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "VercelDomainError";
  }
}

export interface DomainConfig {
  misconfigured: boolean;
  recommendedIPv4: string[];
  recommendedCNAME: string[];
}

interface VercelRecommendedRecord {
  rank?: number;
  value?: string;
}

interface VercelConfigResponse {
  misconfigured?: boolean;
  recommendedIPv4?: (string | VercelRecommendedRecord)[];
  recommendedCNAME?: (string | VercelRecommendedRecord)[];
}

function getVercelConfig() {
  const token = process.env["VERCEL_API_TOKEN"];
  const projectId = process.env["SITES_PROJECT_ID"];
  const teamId = process.env["VERCEL_TEAM_ID"];

  if (!token || !projectId) {
    throw new VercelDomainError(500, "Vercel configuration missing (VERCEL_API_TOKEN or SITES_PROJECT_ID)");
  }

  return { token, projectId, teamId };
}

function withTeamQuery(url: string, teamId: string | undefined): string {
  if (!teamId) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}teamId=${encodeURIComponent(teamId)}`;
}

/**
 * Adds a domain to the Vercel sites project.
 * POST https://api.vercel.com/v10/projects/${SITES_PROJECT_ID}/domains
 * Treat 409 "already added to this project" as success.
 * 409 for another project -> VercelDomainError "This domain is already used by another Vercel project".
 */
export async function addDomain(hostname: string): Promise<void> {
  const { token, projectId, teamId } = getVercelConfig();
  const url = withTeamQuery(
    `https://api.vercel.com/v10/projects/${projectId}/domains`,
    teamId,
  );

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: hostname }),
  });

  if (res.ok) {
    return;
  }

  let body: any = {};
  try {
    body = await res.json();
  } catch {
    // Non-JSON response
  }

  if (res.status === 409) {
    const code = body?.error?.code;
    const message = (body?.error?.message ?? "").toLowerCase();

    // 409 already added to this project:
    // e.g. code === 'domain_already_in_use' or similar when already on this project,
    // or message containing 'already exists' / 'already added to this project'
    if (
      code === "domain_already_in_use_on_this_project" ||
      code === "domain_already_in_project" ||
      code === "domain_already_exists" ||
      message.includes("already added to this project") ||
      message.includes("already exists on this project") ||
      message.includes("already added")
    ) {
      return;
    }

    // 409 for another project
    throw new VercelDomainError(409, "This domain is already used by another Vercel project");
  }

  const errorMsg = body?.error?.message ? String(body.error.message) : `Vercel error ${res.status}`;
  throw new VercelDomainError(res.status, errorMsg);
}

/**
 * Gets domain DNS and routing configuration from Vercel.
 * GET https://api.vercel.com/v6/domains/${hostname}/config
 */
export async function getDomainConfig(hostname: string): Promise<DomainConfig> {
  const { token, teamId } = getVercelConfig();
  const url = withTeamQuery(
    `https://api.vercel.com/v6/domains/${encodeURIComponent(hostname)}/config`,
    teamId,
  );

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    let body: any = {};
    try {
      body = await res.json();
    } catch {
      // Non-JSON
    }
    const errorMsg = body?.error?.message ? String(body.error.message) : `Vercel error ${res.status}`;
    throw new VercelDomainError(res.status, errorMsg);
  }

  const data = (await res.json()) as VercelConfigResponse;

  const extractValues = (list?: (string | VercelRecommendedRecord)[]): string[] => {
    if (!Array.isArray(list)) return [];
    return list
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && typeof item.value === "string") return item.value;
        return "";
      })
      .filter((v) => Boolean(v));
  };

  return {
    misconfigured: Boolean(data.misconfigured),
    recommendedIPv4: extractValues(data.recommendedIPv4),
    recommendedCNAME: extractValues(data.recommendedCNAME),
  };
}

/**
 * Removes a domain from the Vercel sites project.
 * DELETE https://api.vercel.com/v9/projects/${SITES_PROJECT_ID}/domains/${hostname}
 * 404 is treated as success.
 */
export async function removeDomain(hostname: string): Promise<void> {
  const { token, projectId, teamId } = getVercelConfig();
  const url = withTeamQuery(
    `https://api.vercel.com/v9/projects/${projectId}/domains/${encodeURIComponent(hostname)}`,
    teamId,
  );

  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.ok || res.status === 404) {
    return;
  }

  let body: any = {};
  try {
    body = await res.json();
  } catch {
    // Non-JSON
  }

  const errorMsg = body?.error?.message ? String(body.error.message) : `Vercel error ${res.status}`;
  throw new VercelDomainError(res.status, errorMsg);
}
