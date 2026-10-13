import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addDomain,
  getDomainConfig,
  removeDomain,
  VercelDomainError,
} from "./domains";

describe("src/server/vercel/domains.ts Vercel client", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = {
      ...originalEnv,
      VERCEL_API_TOKEN: "test-secret-token",
      SITES_PROJECT_ID: "prj_sites123",
      VERCEL_TEAM_ID: "team_abc456",
    };
  });

  describe("addDomain", () => {
    it("successfully adds a domain", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ name: "example.com" }),
      } as Response);

      await expect(addDomain("example.com")).resolves.toBeUndefined();

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.vercel.com/v10/projects/prj_sites123/domains?teamId=team_abc456",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer test-secret-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: "example.com" }),
        },
      );
    });

    it("treats 409 already added to this project as success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          error: {
            code: "domain_already_in_project",
            message: "The domain is already added to this project.",
          },
        }),
      } as Response);

      await expect(addDomain("example.com")).resolves.toBeUndefined();
    });

    it("throws VercelDomainError when 409 is for another project without leaking token", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          error: {
            code: "domain_already_in_use",
            message: "The domain is already in use by another project",
          },
        }),
      } as Response);

      try {
        await addDomain("example.com");
        expect.unreachable("should have thrown");
      } catch (err: any) {
        expect(err).toBeInstanceOf(VercelDomainError);
        expect(err.status).toBe(409);
        expect(err.message).toBe("This domain is already used by another Vercel project");
        expect(err.message).not.toContain("test-secret-token");
      }
    });

    it("throws on other error statuses without leaking token", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: {
            code: "forbidden",
            message: "Invalid permissions",
          },
        }),
      } as Response);

      try {
        await addDomain("example.com");
        expect.unreachable("should have thrown");
      } catch (err: any) {
        expect(err).toBeInstanceOf(VercelDomainError);
        expect(err.status).toBe(403);
        expect(err.message).toContain("Invalid permissions");
        expect(err.message).not.toContain("test-secret-token");
      }
    });
  });

  describe("getDomainConfig", () => {
    it("maps Vercel domain config response correctly", async () => {
      const sampleResponse = {
        configuredBy: "cname",
        misconfigured: false,
        recommendedIPv4: [
          { rank: 1, value: "76.76.21.21" },
          { rank: 2, value: "76.76.21.22" },
        ],
        recommendedCNAME: [
          { rank: 1, value: "cname.vercel-dns.com" },
        ],
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => sampleResponse,
      } as Response);

      const config = await getDomainConfig("example.com");
      expect(config).toEqual({
        misconfigured: false,
        recommendedIPv4: ["76.76.21.21", "76.76.21.22"],
        recommendedCNAME: ["cname.vercel-dns.com"],
      });
    });

    it("handles string arrays in recommendedIPv4 / recommendedCNAME", async () => {
      const sampleResponse = {
        misconfigured: true,
        recommendedIPv4: ["76.76.21.21"],
        recommendedCNAME: ["cname.vercel-dns.com"],
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => sampleResponse,
      } as Response);

      const config = await getDomainConfig("example.com");
      expect(config).toEqual({
        misconfigured: true,
        recommendedIPv4: ["76.76.21.21"],
        recommendedCNAME: ["cname.vercel-dns.com"],
      });
    });

    it("throws VercelDomainError on error without leaking token", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: {
            message: "Domain not found",
          },
        }),
      } as Response);

      try {
        await getDomainConfig("unknown.com");
        expect.unreachable("should have thrown");
      } catch (err: any) {
        expect(err).toBeInstanceOf(VercelDomainError);
        expect(err.status).toBe(404);
        expect(err.message).toBe("Domain not found");
        expect(err.message).not.toContain("test-secret-token");
      }
    });
  });

  describe("removeDomain", () => {
    it("deletes a domain successfully", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response);

      await expect(removeDomain("example.com")).resolves.toBeUndefined();

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.vercel.com/v9/projects/prj_sites123/domains/example.com?teamId=team_abc456",
        {
          method: "DELETE",
          headers: {
            Authorization: "Bearer test-secret-token",
          },
        },
      );
    });

    it("treats 404 as success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: { message: "Domain not found on project" },
        }),
      } as Response);

      await expect(removeDomain("example.com")).resolves.toBeUndefined();
    });

    it("throws VercelDomainError on other error statuses", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error: { message: "Internal server error" },
        }),
      } as Response);

      await expect(removeDomain("example.com")).rejects.toThrow("Internal server error");
    });
  });
});
