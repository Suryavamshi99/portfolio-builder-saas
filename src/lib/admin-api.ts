import { requestStepUp } from "./admin-stepup";

// --- Types matching 08a Task C and 08c contracts ---

export interface AdminSession {
  authenticated: boolean;
  expiresAt?: string | undefined;
  idleExpiresAt?: string | undefined;
  stepUpUntil?: string | null | undefined;
  twoFactor?: boolean | undefined;
}

export interface AdminOverview {
  users: {
    total: number;
    new7d: number;
    pro: number;
    admins: number;
  };
  content: {
    portfolios: number;
    versions: number;
    uploadsBytes: number;
  };
  sites: {
    published: number;
    unpublished: number;
  };
  domains: {
    pending: number;
    verified: number;
    live: number;
  };
  jobs: {
    last24h: {
      total: number;
      done: number;
      failed: number;
      queued: number;
      running: number;
      bySource: {
        free: number;
        gemini: number;
        mcp: number;
      };
    };
    topErrors: Array<{ code: string; count: number }>;
    oldestQueuedRetryAt: string | null;
  };
  mcp: {
    activeConnections: number;
  };
  freeProviders: Array<{
    id: string;
    label: string;
    model: string;
    usedToday: number;
    dailyBudget: number;
    cooldownUntil: string | null;
  }>;
  payments: {
    enabled: boolean;
  };
}

export interface AdminUserSummary {
  id: string;
  email: string | null;
  createdAt: string;
  plan: "free" | "pro";
  isAdmin: boolean;
  hasPortfolioContent: boolean;
  storageUsedBytes: number;
  vercelConnected: boolean;
  byokProviders: string[];
  siteSlug?: string | null | undefined;
}

export interface AdminUserUpload {
  id?: string | undefined;
  kind: string;
  filename: string;
  sizeBytes?: number | undefined;
  size_bytes?: number | undefined;
  createdAt?: string | undefined;
  created_at?: string | undefined;
}

export interface AdminUserVersion {
  id: string;
  source: string;
  model: string;
  warningsCount: number;
  htmlBytes: number;
  createdAt: string;
}

export interface AdminUserJob {
  id: string;
  source: string;
  status: string;
  provider: string;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserDetail {
  id: string;
  email: string | null;
  createdAt: string;
  plan: "free" | "pro";
  isAdmin: boolean;
  portfolio: {
    html: string | null;
    updatedAt: string;
  } | null;
  uploads: AdminUserUpload[];
  versions?: AdminUserVersion[] | undefined;
  jobs?: AdminUserJob[] | undefined;
  site?: {
    slug: string;
    status: string;
    url: string;
    updatedAt: string;
  } | null | undefined;
  domain?: {
    hostname: string;
    status: string;
  } | null | undefined;
  connections?: {
    github: { account: string } | null;
    vercel: boolean;
    mcp: Array<{ clientId: string; name: string; connectedAt: string }>;
  } | undefined;
  byokProviders?: Array<{ provider: string; created_at: string }> | undefined;
  vercelConnection?: { vercel_username: string | null; connected_at: string } | null | undefined;
}

export interface AdminSiteSummary {
  slug: string;
  url: string;
  status: string;
  ownerEmail: string | null;
  ownerId: string;
  updatedAt: string;
  domain: {
    hostname: string;
    status: string;
  } | null;
}

export interface AdminJobSummary {
  id: string;
  userEmail: string | null;
  source: string;
  status: string;
  provider: string;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  retryAt: string | null;
}

export interface AdminAuditEntry {
  id: string;
  createdAt: string;
  action: string;
  targetType: string;
  targetId: string | null;
  reason: string | null;
  detail: Record<string, unknown>;
}

export interface AdminSystemSetting {
  name: string;
  set: boolean;
}

export interface AdminSystemInfo {
  commit: string | null;
  appOrigin: string;
  sitesBaseUrl: string | null;
  payments: {
    enabled: boolean;
  };
  settings: AdminSystemSetting[];
}

export interface PaginatedResult<T> {
  page: number;
  pageSize: number;
  total: number;
  data: T[];
}

// --- Error Class ---

export class AdminApiError extends Error {
  status: number;
  code?: string | undefined;
  isUnauthorized: boolean;
  isStepUpRequired: boolean;
  isNotAvailable: boolean;

  constructor(message: string, status: number, code?: string | undefined) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.code = code;
    this.isUnauthorized = status === 401;
    this.isStepUpRequired = status === 403 && code === "step_up_required";
    this.isNotAvailable = status === 404;
  }
}

// --- Pure Helper Functions ---

/**
 * Validates that reason string is between 3 and 300 characters trimmed.
 */
export function validateReason(reason: string): { valid: boolean; error?: string } {
  const trimmed = reason.trim();
  if (!trimmed) {
    return { valid: false, error: "Reason is required (3–300 characters)." };
  }
  if (trimmed.length < 3) {
    return { valid: false, error: "Reason must be at least 3 characters." };
  }
  if (trimmed.length > 300) {
    return { valid: false, error: "Reason cannot exceed 300 characters." };
  }
  return { valid: true };
}

/**
 * Case-insensitive confirmation email comparison.
 */
export function validateConfirmEmail(email: string, confirmEmail: string): boolean {
  return email.trim().toLowerCase() === confirmEmail.trim().toLowerCase();
}

/**
 * Formats relative time (e.g., "3 hours ago", "just now").
 */
export function formatRelativeTime(dateInput: string | number | Date, now: Date = new Date()): string {
  const date = new Date(dateInput);
  const diffMs = now.getTime() - date.getTime();

  if (isNaN(diffMs)) {
    return "recently";
  }

  if (diffMs < 30 * 1000) {
    return "just now";
  }

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) {
    return `${diffSec} ${diffSec === 1 ? "second" : "seconds"} ago`;
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin} ${diffMin === 1 ? "minute" : "minutes"} ago`;
  }

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths} ${diffMonths === 1 ? "month" : "months"} ago`;
  }

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears} ${diffYears === 1 ? "year" : "years"} ago`;
}

/**
 * Formats exact timestamp for tooltips and details.
 */
export function formatExactTime(dateInput: string | number | Date): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

/**
 * Formats byte counts into human-readable strings.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Calculates pagination metadata.
 */
export function calculatePagination(total: number, page: number, pageSize: number) {
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  return {
    page: currentPage,
    totalPages,
    hasPrev: currentPage > 1,
    hasNext: currentPage < totalPages,
    startIndex: total === 0 ? 0 : (currentPage - 1) * safePageSize + 1,
    endIndex: Math.min(total, currentPage * safePageSize),
  };
}

/**
 * Formats error object or code into friendly plain-language text.
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof AdminApiError) {
    if (error.code === "last_admin") {
      return "Cannot delete or remove admin status from the last remaining administrator account.";
    }
    if (error.code === "confirm_mismatch") {
      return "The confirmation email does not match the user's email.";
    }
    if (error.code === "reason_required") {
      return "A reason (3–300 characters) is required for this action.";
    }
    if (error.code === "step_up_required") {
      return "Step-up verification required for this action.";
    }
    if (error.code === "job_finished") {
      return "This job has already finished and cannot be cancelled.";
    }
    if (error.code === "domain_not_found") {
      return "The specified domain was not found.";
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred.";
}

// --- Request Core & Step-up Wrapper ---

async function parseResponse<T>(res: Response): Promise<T> {
  if (res.status === 404) {
    throw new AdminApiError("Endpoint not available yet.", 404);
  }

  if (res.status === 401) {
    throw new AdminApiError("Unauthorized: admin session expired.", 401);
  }

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // Empty or non-JSON body
  }

  if (!res.ok) {
    const errorBody = json as { error?: { code?: string; message?: string } } | null;
    const message = errorBody?.error?.message ?? `Request failed (${res.status})`;
    const code = errorBody?.error?.code;
    throw new AdminApiError(message, res.status, code);
  }

  return json as T;
}

/**
 * Executes a destructive API call with step-up verification retry.
 * If 403 step_up_required is returned, triggers the step-up prompt once and retries.
 */
export async function executeWithStepUp<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (err: unknown) {
    if (err instanceof AdminApiError && err.isStepUpRequired) {
      const stepUpOk = await requestStepUp();
      if (stepUpOk) {
        return await action();
      }
    }
    throw err;
  }
}

// --- API Client Methods ---

export const adminApi = {
  async getSession(): Promise<AdminSession> {
    const res = await fetch("/api/admin/session");
    if (!res.ok && res.status !== 401) {
      throw new AdminApiError("Failed to check session", res.status);
    }
    if (res.status === 401) {
      return { authenticated: false };
    }
    const json = (await res.json().catch(() => ({ authenticated: false }))) as AdminSession;
    return json;
  },

  async logout(): Promise<void> {
    await fetch("/api/admin/logout", { method: "POST" });
  },

  async getOverview(): Promise<AdminOverview | null> {
    try {
      const res = await fetch("/api/admin/overview");
      return await parseResponse<AdminOverview>(res);
    } catch (err) {
      if (err instanceof AdminApiError && err.isNotAvailable) {
        return null;
      }
      throw err;
    }
  },

  async getUsers(params: {
    query?: string | undefined;
    plan?: ("all" | "free" | "pro") | undefined;
    admin?: boolean | undefined;
    site?: ("published" | "all") | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
  }): Promise<PaginatedResult<AdminUserSummary> | null> {
    const sp = new URLSearchParams();
    if (params.query?.trim()) sp.set("query", params.query.trim());
    if (params.plan && params.plan !== "all") sp.set("plan", params.plan);
    if (params.admin) sp.set("admin", "true");
    if (params.site && params.site !== "all") sp.set("site", params.site);
    if (params.page) sp.set("page", String(params.page));
    if (params.pageSize) sp.set("pageSize", String(params.pageSize));

    const qs = sp.toString();
    const url = `/api/admin/users${qs ? `?${qs}` : ""}`;

    try {
      const res = await fetch(url);
      const json = await parseResponse<{ users: AdminUserSummary[]; page?: number; pageSize?: number; total?: number }>(res);
      return {
        data: json.users ?? [],
        page: json.page ?? 1,
        pageSize: json.pageSize ?? 25,
        total: json.total ?? json.users?.length ?? 0,
      };
    } catch (err) {
      if (err instanceof AdminApiError && err.isNotAvailable) {
        return null;
      }
      throw err;
    }
  },

  async getUserDetail(userId: string): Promise<AdminUserDetail | null> {
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`);
      return await parseResponse<AdminUserDetail>(res);
    } catch (err) {
      if (err instanceof AdminApiError && err.isNotAvailable) {
        return null;
      }
      throw err;
    }
  },

  async updateUser(
    userId: string,
    body: {
      plan?: ("free" | "pro") | undefined;
      isAdmin?: boolean | undefined;
      html?: string | undefined;
      reason: string;
    }
  ): Promise<AdminUserDetail> {
    return executeWithStepUp(async () => {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      return await parseResponse<AdminUserDetail>(res);
    });
  },

  async deleteUser(
    userId: string,
    body: {
      reason: string;
      confirmEmail: string;
    }
  ): Promise<{ ok: boolean }> {
    return executeWithStepUp(async () => {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      return await parseResponse<{ ok: boolean }>(res);
    });
  },

  async revokeUserMcp(
    userId: string,
    body: { reason: string }
  ): Promise<{ ok: boolean; revokedClients: number }> {
    return executeWithStepUp(async () => {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/revoke-mcp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      return await parseResponse<{ ok: boolean; revokedClients: number }>(res);
    });
  },

  async getSites(params: {
    query?: string | undefined;
    status?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
  }): Promise<PaginatedResult<AdminSiteSummary> | null> {
    const sp = new URLSearchParams();
    if (params.query?.trim()) sp.set("query", params.query.trim());
    if (params.status && params.status !== "all") sp.set("status", params.status);
    if (params.page) sp.set("page", String(params.page));
    if (params.pageSize) sp.set("pageSize", String(params.pageSize));

    const qs = sp.toString();
    const url = `/api/admin/sites${qs ? `?${qs}` : ""}`;

    try {
      const res = await fetch(url);
      const json = await parseResponse<{ sites: AdminSiteSummary[]; page: number; pageSize: number; total: number }>(res);
      return {
        data: json.sites ?? [],
        page: json.page ?? 1,
        pageSize: json.pageSize ?? 25,
        total: json.total ?? 0,
      };
    } catch (err) {
      if (err instanceof AdminApiError && err.isNotAvailable) {
        return null;
      }
      throw err;
    }
  },

  async unpublishSite(slug: string, body: { reason: string }): Promise<{ ok: boolean }> {
    return executeWithStepUp(async () => {
      const res = await fetch(`/api/admin/sites/${encodeURIComponent(slug)}/unpublish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      return await parseResponse<{ ok: boolean }>(res);
    });
  },

  async removeDomain(body: { hostname: string; reason: string }): Promise<{ ok: boolean }> {
    return executeWithStepUp(async () => {
      const res = await fetch("/api/admin/domains/remove", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      return await parseResponse<{ ok: boolean }>(res);
    });
  },

  async getJobs(params: {
    status?: string | undefined;
    source?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
  }): Promise<PaginatedResult<AdminJobSummary> | null> {
    const sp = new URLSearchParams();
    if (params.status && params.status !== "all") sp.set("status", params.status);
    if (params.source && params.source !== "all") sp.set("source", params.source);
    if (params.page) sp.set("page", String(params.page));
    if (params.pageSize) sp.set("pageSize", String(params.pageSize));

    const qs = sp.toString();
    const url = `/api/admin/jobs${qs ? `?${qs}` : ""}`;

    try {
      const res = await fetch(url);
      const json = await parseResponse<{ jobs: AdminJobSummary[]; page: number; pageSize: number; total: number }>(res);
      return {
        data: json.jobs ?? [],
        page: json.page ?? 1,
        pageSize: json.pageSize ?? 25,
        total: json.total ?? 0,
      };
    } catch (err) {
      if (err instanceof AdminApiError && err.isNotAvailable) {
        return null;
      }
      throw err;
    }
  },

  async cancelJob(jobId: string, body: { reason: string }): Promise<{ ok: boolean }> {
    const res = await fetch(`/api/admin/jobs/${encodeURIComponent(jobId)}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return await parseResponse<{ ok: boolean }>(res);
  },

  async clearProviderCooldown(body: { provider: string; reason: string }): Promise<{ ok: boolean }> {
    const res = await fetch("/api/admin/providers/clear-cooldown", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return await parseResponse<{ ok: boolean }>(res);
  },

  async getAudit(params: {
    action?: string | undefined;
    targetType?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
  }): Promise<PaginatedResult<AdminAuditEntry> | null> {
    const sp = new URLSearchParams();
    if (params.action && params.action !== "all") sp.set("action", params.action);
    if (params.targetType && params.targetType !== "all") sp.set("targetType", params.targetType);
    if (params.page) sp.set("page", String(params.page));
    if (params.pageSize) sp.set("pageSize", String(params.pageSize));

    const qs = sp.toString();
    const url = `/api/admin/audit${qs ? `?${qs}` : ""}`;

    try {
      const res = await fetch(url);
      const json = await parseResponse<{ entries: AdminAuditEntry[]; page: number; pageSize: number; total: number }>(res);
      return {
        data: json.entries ?? [],
        page: json.page ?? 1,
        pageSize: json.pageSize ?? 25,
        total: json.total ?? 0,
      };
    } catch (err) {
      if (err instanceof AdminApiError && err.isNotAvailable) {
        return null;
      }
      throw err;
    }
  },

  async getSystem(): Promise<AdminSystemInfo | null> {
    try {
      const res = await fetch("/api/admin/system");
      return await parseResponse<AdminSystemInfo>(res);
    } catch (err) {
      if (err instanceof AdminApiError && err.isNotAvailable) {
        return null;
      }
      throw err;
    }
  },
};
