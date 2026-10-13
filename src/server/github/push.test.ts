import { describe, it, expect, beforeEach, vi } from "vitest";
import { pushSiteToRepo } from "./push";
import { GithubError } from "./app";

describe("pushSiteToRepo", () => {
  const token = "ghs_mocktoken";
  const repo = "octocat/hello-world";
  const message = "Deploy portfolio";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("validation", () => {
    it("throws if repo is invalid format", async () => {
      await expect(
        pushSiteToRepo({
          token,
          repo: "invalid-repo",
          files: { "index.html": "<h1>Hi</h1>" },
          message,
        }),
      ).rejects.toThrow(GithubError);

      await expect(
        pushSiteToRepo({
          token,
          repo: "owner/repo/extra",
          files: { "index.html": "<h1>Hi</h1>" },
          message,
        }),
      ).rejects.toThrow(GithubError);
    });

    it("throws if file paths are empty, start with / or contain ..", async () => {
      await expect(
        pushSiteToRepo({
          token,
          repo,
          files: { "": "empty" },
          message,
        }),
      ).rejects.toThrow(GithubError);

      await expect(
        pushSiteToRepo({
          token,
          repo,
          files: { "/index.html": "leading slash" },
          message,
        }),
      ).rejects.toThrow(GithubError);

      await expect(
        pushSiteToRepo({
          token,
          repo,
          files: { "images/../index.html": "path traversal" },
          message,
        }),
      ).rejects.toThrow(GithubError);
    });
  });

  describe("access errors", () => {
    it("throws 'The Shipfolio app isn't installed on that repository' on 404 or 403", async () => {
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/repos/octocat/hello-world")) {
          return Promise.resolve(new Response(JSON.stringify({ message: "Not Found" }), { status: 404 }));
        }
        return Promise.resolve(new Response(null, { status: 500 }));
      });
      vi.stubGlobal("fetch", mockFetch);

      await expect(
        pushSiteToRepo({
          token,
          repo,
          files: { "index.html": "<h1>Hi</h1>" },
          message,
        }),
      ).rejects.toThrow("The Shipfolio app isn't installed on that repository");
    });
  });

  describe("normal flow", () => {
    it("completes normal Git Data API flow in correct order with payloads", async () => {
      const calls: Array<{ url: string; method: string; body?: unknown }> = [];

      const mockFetch = vi.fn().mockImplementation((url: string, init: RequestInit) => {
        const parsedBody = init.body ? JSON.parse(init.body as string) : undefined;
        calls.push({ url, method: init.method || "GET", body: parsedBody });

        if (url.endsWith("/repos/octocat/hello-world") && init.method === "GET") {
          return Promise.resolve(
            new Response(JSON.stringify({ default_branch: "main" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        if (url.endsWith("/git/ref/heads/main") && init.method === "GET") {
          return Promise.resolve(
            new Response(JSON.stringify({ object: { sha: "head-sha-123" } }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        if (url.endsWith("/git/commits/head-sha-123") && init.method === "GET") {
          return Promise.resolve(
            new Response(JSON.stringify({ tree: { sha: "tree-sha-old" } }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        if (url.endsWith("/git/blobs") && init.method === "POST") {
          return Promise.resolve(
            new Response(JSON.stringify({ sha: `blob-sha-${parsedBody.content.slice(0, 5)}` }), {
              status: 201,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        if (url.endsWith("/git/trees") && init.method === "POST") {
          return Promise.resolve(
            new Response(JSON.stringify({ sha: "new-tree-sha-456" }), {
              status: 201,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        if (url.endsWith("/git/commits") && init.method === "POST") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                sha: "commit-sha-789",
                html_url: "https://github.com/octocat/hello-world/commit/commit-sha-789",
              }),
              {
                status: 201,
                headers: { "Content-Type": "application/json" },
              },
            ),
          );
        }

        if (url.endsWith("/git/refs/heads/main") && init.method === "PATCH") {
          return Promise.resolve(
            new Response(JSON.stringify({ object: { sha: "commit-sha-789" } }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        return Promise.resolve(new Response(null, { status: 404 }));
      });
      vi.stubGlobal("fetch", mockFetch);

      const files = {
        "index.html": "<html><body>Hello</body></html>",
        "README.txt": "My portfolio",
      };

      const result = await pushSiteToRepo({
        token,
        repo,
        files,
        message,
      });

      expect(result).toEqual({
        commitUrl: "https://github.com/octocat/hello-world/commit/commit-sha-789",
        branch: "main",
        created: false,
      });

      // Verify sequence of operations
      expect(calls[0]?.url).toBe("https://api.github.com/repos/octocat/hello-world");
      expect(calls[0]?.method).toBe("GET");

      expect(calls[1]?.url).toBe("https://api.github.com/repos/octocat/hello-world/git/ref/heads/main");
      expect(calls[1]?.method).toBe("GET");

      expect(calls[2]?.url).toBe("https://api.github.com/repos/octocat/hello-world/git/commits/head-sha-123");
      expect(calls[2]?.method).toBe("GET");

      // Blobs created for 2 files
      expect(calls[3]?.url).toBe("https://api.github.com/repos/octocat/hello-world/git/blobs");
      expect(calls[4]?.url).toBe("https://api.github.com/repos/octocat/hello-world/git/blobs");

      // Tree created with base_tree
      expect(calls[5]?.url).toBe("https://api.github.com/repos/octocat/hello-world/git/trees");
      expect(calls[5]?.body).toMatchObject({
        base_tree: "tree-sha-old",
      });
      const treeEntries = (calls[5]?.body as { tree: Array<{ path: string; mode: string }> }).tree;
      expect(treeEntries).toHaveLength(2);
      expect(treeEntries[0]?.mode).toBe("100644");

      // Commit created with parents = [head]
      expect(calls[6]?.url).toBe("https://api.github.com/repos/octocat/hello-world/git/commits");
      expect(calls[6]?.body).toEqual({
        message,
        tree: "new-tree-sha-456",
        parents: ["head-sha-123"],
      });

      // Branch ref updated
      expect(calls[7]?.url).toBe("https://api.github.com/repos/octocat/hello-world/git/refs/heads/main");
      expect(calls[7]?.method).toBe("PATCH");
      expect(calls[7]?.body).toEqual({
        sha: "commit-sha-789",
        force: false,
      });
    });
  });

  describe("empty-repo flow", () => {
    it("handles empty repo with only index.html", async () => {
      const calls: Array<{ url: string; method: string; body?: unknown }> = [];

      const mockFetch = vi.fn().mockImplementation((url: string, init: RequestInit) => {
        const parsedBody = init.body ? JSON.parse(init.body as string) : undefined;
        calls.push({ url, method: init.method || "GET", body: parsedBody });

        if (url.endsWith("/repos/octocat/hello-world") && init.method === "GET") {
          return Promise.resolve(
            new Response(JSON.stringify({ default_branch: "main" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        if (url.endsWith("/git/ref/heads/main") && init.method === "GET") {
          // Empty repo returns 404
          return Promise.resolve(new Response(JSON.stringify({ message: "Not Found" }), { status: 404 }));
        }

        if (url.endsWith("/contents/index.html") && init.method === "PUT") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                commit: {
                  sha: "init-commit-sha",
                  html_url: "https://github.com/octocat/hello-world/commit/init-commit-sha",
                },
              }),
              {
                status: 201,
                headers: { "Content-Type": "application/json" },
              },
            ),
          );
        }

        return Promise.resolve(new Response(null, { status: 404 }));
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await pushSiteToRepo({
        token,
        repo,
        files: { "index.html": "<h1>Initial</h1>" },
        message,
      });

      expect(result).toEqual({
        commitUrl: "https://github.com/octocat/hello-world/commit/init-commit-sha",
        branch: "main",
        created: true,
      });

      expect(calls).toHaveLength(3);
      expect(calls[2]?.url).toBe("https://api.github.com/repos/octocat/hello-world/contents/index.html");
      expect(calls[2]?.method).toBe("PUT");
      expect(calls[2]?.body).toMatchObject({
        branch: "main",
        message,
      });
    });

    it("handles empty repo with index.html and additional files", async () => {
      const calls: Array<{ url: string; method: string; body?: unknown }> = [];

      const mockFetch = vi.fn().mockImplementation((url: string, init: RequestInit) => {
        const parsedBody = init.body ? JSON.parse(init.body as string) : undefined;
        calls.push({ url, method: init.method || "GET", body: parsedBody });

        if (url.endsWith("/repos/octocat/hello-world") && init.method === "GET") {
          return Promise.resolve(
            new Response(JSON.stringify({ default_branch: "main" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        if (url.endsWith("/git/ref/heads/main") && init.method === "GET") {
          return Promise.resolve(new Response(JSON.stringify({ message: "Git Repository is empty" }), { status: 409 }));
        }

        if (url.endsWith("/contents/index.html") && init.method === "PUT") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                commit: {
                  sha: "init-commit-sha",
                  html_url: "https://github.com/octocat/hello-world/commit/init-commit-sha",
                },
              }),
              {
                status: 201,
                headers: { "Content-Type": "application/json" },
              },
            ),
          );
        }

        if (url.endsWith("/git/commits/init-commit-sha") && init.method === "GET") {
          return Promise.resolve(
            new Response(JSON.stringify({ tree: { sha: "init-tree-sha" } }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        if (url.endsWith("/git/blobs") && init.method === "POST") {
          return Promise.resolve(
            new Response(JSON.stringify({ sha: "blob-sha-extra" }), {
              status: 201,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        if (url.endsWith("/git/trees") && init.method === "POST") {
          return Promise.resolve(
            new Response(JSON.stringify({ sha: "second-tree-sha" }), {
              status: 201,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        if (url.endsWith("/git/commits") && init.method === "POST") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                sha: "second-commit-sha",
                html_url: "https://github.com/octocat/hello-world/commit/second-commit-sha",
              }),
              {
                status: 201,
                headers: { "Content-Type": "application/json" },
              },
            ),
          );
        }

        if (url.endsWith("/git/refs/heads/main") && init.method === "PATCH") {
          return Promise.resolve(
            new Response(JSON.stringify({ object: { sha: "second-commit-sha" } }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        return Promise.resolve(new Response(null, { status: 404 }));
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await pushSiteToRepo({
        token,
        repo,
        files: {
          "index.html": "<h1>Initial</h1>",
          "README.txt": "Notes",
        },
        message,
      });

      expect(result).toEqual({
        commitUrl: "https://github.com/octocat/hello-world/commit/second-commit-sha",
        branch: "main",
        created: true,
      });

      // Verify that PUT contents/index.html was called first, then blobs for README.txt, tree with base_tree, commit with parents=[init-commit-sha]
      const putCall = calls.find((c) => c.url.includes("/contents/index.html"));
      expect(putCall).toBeDefined();

      const blobCalls = calls.filter((c) => c.url.includes("/git/blobs"));
      expect(blobCalls).toHaveLength(1); // Only README.txt uploaded in the secondary commit
    });
  });
});
