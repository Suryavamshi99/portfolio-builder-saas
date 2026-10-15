export type JobStatus =
  | "queued"
  | "reading"
  | "writing"
  | "checking"
  | "saving"
  | "done"
  | "failed";

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: string[] | undefined;
  retryAfterSeconds?: number | undefined;
}

export interface ApiErrorResponse {
  error: ApiErrorPayload;
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: string[] | undefined;
  retryAfterSeconds?: number | undefined;
  isNotFound: boolean;

  constructor(
    status: number,
    errorPayload: {
      code?: string | undefined;
      message?: string | undefined;
      details?: string[] | undefined;
      retryAfterSeconds?: number | undefined;
    }
  ) {
    super(errorPayload.message || `API error (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.code = errorPayload.code || "unknown_error";
    this.details = errorPayload.details;
    this.retryAfterSeconds = errorPayload.retryAfterSeconds;
    this.isNotFound = status === 404;
  }
}

// -------------------------------------------------------------
// Generations & Jobs
// -------------------------------------------------------------

export interface CreateGenerationBody {
  source: "free" | "gemini";
  resumeUploadId: string;
  otherSpecifics?: string | undefined;
  designIntensity?: "minimal" | "bold" | undefined;
  links?: {
    linkedin?: string | undefined;
    github?: string | undefined;
    githubProjects?: string[] | undefined;
    other?: { label: string; url: string }[] | undefined;
  } | undefined;
  instructions?: string | undefined;
}

export interface CreateGenerationResponse {
  jobId: string;
  status: JobStatus;
}

export interface GenerationJob {
  id: string;
  source: string;
  status: JobStatus;
  message: string;
  error: ApiErrorPayload | null;
  retryAt: string | null;
  updatedAt: string;
  /** Steps finished of the total, for a step-by-step (free) build while it runs. */
  progress?: { done: number; total: number } | null;
}

export interface FreeStatusResponse {
  available: boolean;
  usedToday: number;
  limitToday: number;
  resetsAt: string;
}

export interface McpConnection {
  clientId: string;
  name: string;
  connectedAt: string;
}

export interface McpStatusResponse {
  connected: boolean;
  connections?: McpConnection[] | undefined;
  latestJob: GenerationJob | null;
}

// -------------------------------------------------------------
// Custom Domains
// -------------------------------------------------------------

export interface DomainVerifyRecord {
  type: "TXT";
  name: string;
  value: string;
}

export interface DomainDnsRecords {
  a: string[];
  cname: string[];
}

export interface CustomDomain {
  hostname: string;
  status: "pending" | "verified" | "live";
  verifyRecord: DomainVerifyRecord;
  dns: DomainDnsRecords | null;
  lastCheckedAt?: string | null | undefined;
}

export interface GetDomainsResponse {
  domain: CustomDomain | null;
}

export interface VerifyDomainResponse {
  domain?: CustomDomain | null | undefined;
  status?: "pending" | "verified" | "live" | undefined;
  message?: string | undefined;
  // If the verify endpoint returns the domain directly or the get shape
  hostname?: string | undefined;
  verifyRecord?: DomainVerifyRecord | undefined;
  dns?: DomainDnsRecords | null | undefined;
}

// -------------------------------------------------------------
// Sites & Hosting
// -------------------------------------------------------------

export type SiteCheckStatus = "available" | "yours" | "taken" | "reserved" | "invalid";

export interface SiteCheckResponse {
  status: SiteCheckStatus;
  url: string;
}

export interface SiteMeSite {
  slug: string;
  url: string;
  status: "published" | "unpublished";
  publishedVersionId: string | null;
  updatedAt: string;
}

export interface SiteMeResponse {
  site: SiteMeSite | null;
  draftNewer: boolean;
}

export interface PublishSiteBody {
  slug?: string;
}

export interface PublishSiteResponse {
  url: string;
}

export interface UnpublishSiteResponse {
  ok: boolean;
}

// -------------------------------------------------------------
// GitHub Export
// -------------------------------------------------------------

export interface GitHubStatusResponse {
  connected: boolean;
  account?: string | null;
  installUrl?: string | null;
}

export interface ExportGitHubBody {
  repo: string;
}

export interface ExportGitHubResponse {
  commitUrl: string;
  repo: string;
}

// -------------------------------------------------------------
// Generic Fetch Wrapper
// -------------------------------------------------------------

async function requestJson<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, options);

  if (res.status === 404) {
    throw new ApiError(404, {
      code: "not_found",
      message: "Coming soon",
    });
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok) {
    const errorPayload = (json as ApiErrorResponse)?.error || {};
    throw new ApiError(res.status, {
      code: errorPayload.code || `http_${res.status}`,
      message: errorPayload.message || res.statusText,
      details: errorPayload.details,
      retryAfterSeconds: errorPayload.retryAfterSeconds,
    });
  }

  return json as T;
}

// -------------------------------------------------------------
// Typed API Client Methods
// -------------------------------------------------------------

export const apiClient = {
  // Generations
  createGeneration: async (body: CreateGenerationBody): Promise<CreateGenerationResponse> => {
    return requestJson<CreateGenerationResponse>("/api/generations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  getGeneration: async (id: string): Promise<GenerationJob> => {
    return requestJson<GenerationJob>(`/api/generations/${encodeURIComponent(id)}`);
  },

  getLatestGeneration: async (): Promise<GenerationJob | null> => {
    return requestJson<GenerationJob | null>("/api/generations/latest");
  },

  cancelGeneration: async (id: string): Promise<{ ok: boolean }> => {
    return requestJson<{ ok: boolean }>(`/api/generations/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  getFreeStatus: async (): Promise<FreeStatusResponse> => {
    return requestJson<FreeStatusResponse>("/api/free/status");
  },

  getMcpStatus: async (): Promise<McpStatusResponse> => {
    return requestJson<McpStatusResponse>("/api/mcp/status");
  },

  disconnectMcpConnection: async (clientId: string): Promise<{ ok: boolean }> => {
    return requestJson<{ ok: boolean }>(`/api/mcp/connections/${encodeURIComponent(clientId)}`, {
      method: "DELETE",
    });
  },

  // Hosting
  checkSiteSlug: async (slug: string): Promise<SiteCheckResponse> => {
    return requestJson<SiteCheckResponse>(`/api/sites/check?slug=${encodeURIComponent(slug)}`);
  },

  getSiteMe: async (): Promise<SiteMeResponse> => {
    return requestJson<SiteMeResponse>("/api/sites/me");
  },

  publishSite: async (body: PublishSiteBody = {}): Promise<PublishSiteResponse> => {
    return requestJson<PublishSiteResponse>("/api/sites/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  unpublishSite: async (): Promise<UnpublishSiteResponse> => {
    return requestJson<UnpublishSiteResponse>("/api/sites/unpublish", {
      method: "POST",
    });
  },

  // Custom Domains
  getDomains: async (): Promise<GetDomainsResponse> => {
    return requestJson<GetDomainsResponse>("/api/domains");
  },

  addDomain: async (hostname: string): Promise<GetDomainsResponse> => {
    return requestJson<GetDomainsResponse>("/api/domains", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hostname }),
    });
  },

  verifyDomain: async (): Promise<VerifyDomainResponse> => {
    return requestJson<VerifyDomainResponse>("/api/domains/verify", {
      method: "POST",
    });
  },

  deleteDomain: async (): Promise<{ ok: boolean }> => {
    return requestJson<{ ok: boolean }>("/api/domains", {
      method: "DELETE",
    });
  },

  // GitHub
  getGitHubStatus: async (): Promise<GitHubStatusResponse> => {
    return requestJson<GitHubStatusResponse>("/api/github/status");
  },

  exportToGitHub: async (body: ExportGitHubBody): Promise<ExportGitHubResponse> => {
    return requestJson<ExportGitHubResponse>("/api/export/github", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  },
};
