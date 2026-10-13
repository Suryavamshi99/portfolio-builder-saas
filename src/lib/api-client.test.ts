import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiClient, ApiError } from "./api-client";

describe("apiClient", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("handles 404 as coming soon ApiError", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Not found" } }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(apiClient.getFreeStatus()).rejects.toSatisfy((err) => {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(404);
      expect(apiErr.code).toBe("not_found");
      expect(apiErr.message).toBe("Coming soon");
      expect(apiErr.isNotFound).toBe(true);
      return true;
    });
  });

  it("maps API error payload fields correctly", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "generation_unsupported_claims",
            message: "Unsupported claims detected",
            details: ["Claim 1", "Claim 2"],
            retryAfterSeconds: 30,
          },
        }),
        {
          status: 422,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    await expect(
      apiClient.createGeneration({
        source: "free",
        resumeUploadId: "res-123",
      })
    ).rejects.toSatisfy((err) => {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(422);
      expect(apiErr.code).toBe("generation_unsupported_claims");
      expect(apiErr.message).toBe("Unsupported claims detected");
      expect(apiErr.details).toEqual(["Claim 1", "Claim 2"]);
      expect(apiErr.retryAfterSeconds).toBe(30);
      expect(apiErr.isNotFound).toBe(false);
      return true;
    });
  });

  it("handles empty or non-JSON error body gracefully", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response("Bad Gateway", {
        status: 502,
        statusText: "Bad Gateway",
        headers: { "Content-Type": "text/plain" },
      })
    );

    await expect(apiClient.getSiteMe()).rejects.toSatisfy((err) => {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(502);
      expect(apiErr.code).toBe("http_502");
      expect(apiErr.message).toBe("Bad Gateway");
      return true;
    });
  });

  it("calls createGeneration with correct method, headers, and body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          jobId: "job-abc",
          status: "queued",
        }),
        {
          status: 202,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
    global.fetch = fetchMock;

    const res = await apiClient.createGeneration({
      source: "gemini",
      resumeUploadId: "upload-1",
      otherSpecifics: "Special focus",
      designIntensity: "bold",
      links: { linkedin: "https://linkedin.com/in/test" },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/generations",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "gemini",
          resumeUploadId: "upload-1",
          otherSpecifics: "Special focus",
          designIntensity: "bold",
          links: { linkedin: "https://linkedin.com/in/test" },
        }),
      })
    );
    expect(res).toEqual({ jobId: "job-abc", status: "queued" });
  });

  it("calls getGeneration with encoded ID", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "job/123",
          source: "free",
          status: "reading",
          message: "Reading resume…",
          error: null,
          retryAt: null,
          updatedAt: "2026-10-13T00:00:00Z",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
    global.fetch = fetchMock;

    const res = await apiClient.getGeneration("job/123");
    expect(fetchMock).toHaveBeenCalledWith("/api/generations/job%2F123", undefined);
    expect(res.status).toBe("reading");
    expect(res.message).toBe("Reading resume…");
  });

  it("calls checkSiteSlug with query param", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "available",
          url: "https://john.shipfolio.site",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
    global.fetch = fetchMock;

    const res = await apiClient.checkSiteSlug("john");
    expect(fetchMock).toHaveBeenCalledWith("/api/sites/check?slug=john", undefined);
    expect(res.status).toBe("available");
  });

  it("calls cancelGeneration with DELETE", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    global.fetch = fetchMock;

    const res = await apiClient.cancelGeneration("job-1");
    expect(fetchMock).toHaveBeenCalledWith("/api/generations/job-1", {
      method: "DELETE",
    });
    expect(res.ok).toBe(true);
  });
});
