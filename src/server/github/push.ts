import { GithubError } from "./app";

const REPO_REGEX = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

async function gh<T>(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: T }> {
  const url = `https://api.github.com${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const reqInit: RequestInit = {
    method,
    headers,
  };
  if (body !== undefined) {
    reqInit.body = JSON.stringify(body);
  }

  const res = await fetch(url, reqInit);

  let data: unknown = null;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    try {
      data = await res.text();
    } catch {
      data = null;
    }
  }

  return { status: res.status, data: data as T };
}

function validateRepo(repo: string): void {
  if (!repo || typeof repo !== "string" || !REPO_REGEX.test(repo)) {
    throw new GithubError(`Invalid repository name: "${repo}". Expected format "owner/repo"`, 400);
  }
}

function validateFilePaths(files: Record<string, Buffer | string>): void {
  for (const filePath of Object.keys(files)) {
    if (!filePath || filePath.trim() === "") {
      throw new GithubError("File path must not be empty", 400);
    }
    if (filePath.startsWith("/")) {
      throw new GithubError(`File path must not start with '/': "${filePath}"`, 400);
    }
    const segments = filePath.split("/");
    if (segments.includes("..")) {
      throw new GithubError(`File path must not contain '..': "${filePath}"`, 400);
    }
  }
}

export async function pushSiteToRepo(opts: {
  token: string;
  repo: string /* "owner/name" */;
  files: Record<string, Buffer | string>;
  branch?: string;
  message: string;
}): Promise<{ commitUrl: string; branch: string; created: boolean }> {
  const { token, repo, files, message } = opts;

  // 1. Validate repo and file paths
  validateRepo(repo);
  validateFilePaths(files);

  // 2. GET /repos/{repo} -> default branch
  const repoRes = await gh<{ default_branch?: string }>(token, "GET", `/repos/${repo}`);
  if (repoRes.status === 404 || repoRes.status === 403) {
    throw new GithubError("The Shipfolio app isn't installed on that repository", repoRes.status);
  }
  if (repoRes.status < 200 || repoRes.status >= 300) {
    throw new GithubError(`Failed to fetch repository information (${repoRes.status})`, repoRes.status);
  }

  const defaultBranch = repoRes.data.default_branch || "main";
  // Use opts.branch only if it equals the default branch; otherwise ignore.
  const targetBranch = opts.branch === defaultBranch ? opts.branch : defaultBranch;

  // 3. Check if repo is empty: GET /repos/{repo}/git/ref/heads/{branch}
  const refRes = await gh<{ object?: { sha?: string } }>(
    token,
    "GET",
    `/repos/${repo}/git/ref/heads/${targetBranch}`,
  );

  let isCreated = false;
  let headCommitSha: string | null = null;

  if (refRes.status === 404 || refRes.status === 409) {
    // Empty repository flow
    isCreated = true;
    const indexContent = files["index.html"] ?? "";
    const indexBuf = typeof indexContent === "string" ? Buffer.from(indexContent, "utf8") : indexContent;

    const putRes = await gh<{ commit?: { html_url?: string; sha?: string } }>(
      token,
      "PUT",
      `/repos/${repo}/contents/index.html`,
      {
        message: message || "Initial commit",
        content: indexBuf.toString("base64"),
        branch: targetBranch,
      },
    );

    if (putRes.status < 200 || putRes.status >= 300) {
      throw new GithubError(`Failed to create initial commit (${putRes.status})`, putRes.status);
    }

    const initialCommitUrl = putRes.data.commit?.html_url || `https://github.com/${repo}/commit/${putRes.data.commit?.sha}`;
    headCommitSha = putRes.data.commit?.sha ?? null;

    // If there is only index.html, stop after it.
    const fileKeys = Object.keys(files);
    if (fileKeys.length === 1 && fileKeys[0] === "index.html") {
      return {
        commitUrl: initialCommitUrl,
        branch: targetBranch,
        created: true,
      };
    }
  } else if (refRes.status >= 200 && refRes.status < 300) {
    headCommitSha = refRes.data.object?.sha ?? null;
    if (!headCommitSha) {
      throw new GithubError("Target branch head commit SHA could not be determined", 502);
    }
  } else {
    throw new GithubError(`Failed to fetch branch reference (${refRes.status})`, refRes.status);
  }

  // 4. Normal Git Data API flow for files (or remaining files)
  // If we just created the initial commit, get the new branch head commit sha if not set
  if (!headCommitSha) {
    const afterRef = await gh<{ object?: { sha?: string } }>(
      token,
      "GET",
      `/repos/${repo}/git/ref/heads/${targetBranch}`,
    );
    headCommitSha = afterRef.data.object?.sha ?? null;
    if (!headCommitSha) {
      throw new GithubError("Branch head commit SHA not available for remaining files", 502);
    }
  }

  // Get the head commit to find its tree sha
  const commitRes = await gh<{ tree?: { sha?: string } }>(
    token,
    "GET",
    `/repos/${repo}/git/commits/${headCommitSha}`,
  );
  if (commitRes.status < 200 || commitRes.status >= 300 || !commitRes.data.tree?.sha) {
    throw new GithubError(`Failed to fetch commit tree (${commitRes.status})`, commitRes.status);
  }
  const baseTreeSha = commitRes.data.tree.sha;

  // If we created index.html in the initial commit, remaining files don't need index.html re-uploaded
  // unless we want all files in the tree. We can push all files (or files except index.html if isCreated).
  const filesToUpload = isCreated
    ? Object.fromEntries(Object.entries(files).filter(([path]) => path !== "index.html"))
    : files;

  // POST git/blobs for each file
  const treeEntries: Array<{
    path: string;
    mode: "100644";
    type: "blob";
    sha: string;
  }> = [];

  for (const [filePath, content] of Object.entries(filesToUpload)) {
    const buf = typeof content === "string" ? Buffer.from(content, "utf8") : content;
    const blobRes = await gh<{ sha?: string }>(
      token,
      "POST",
      `/repos/${repo}/git/blobs`,
      {
        content: buf.toString("base64"),
        encoding: "base64",
      },
    );

    if (blobRes.status < 200 || blobRes.status >= 300 || !blobRes.data.sha) {
      throw new GithubError(`Failed to create blob for ${filePath} (${blobRes.status})`, blobRes.status);
    }

    treeEntries.push({
      path: filePath,
      mode: "100644",
      type: "blob",
      sha: blobRes.data.sha,
    });
  }

  // POST git/trees with base_tree and entries
  const treeRes = await gh<{ sha?: string }>(
    token,
    "POST",
    `/repos/${repo}/git/trees`,
    {
      base_tree: baseTreeSha,
      tree: treeEntries,
    },
  );
  if (treeRes.status < 200 || treeRes.status >= 300 || !treeRes.data.sha) {
    throw new GithubError(`Failed to create tree (${treeRes.status})`, treeRes.status);
  }
  const newTreeSha = treeRes.data.sha;

  // POST git/commits (parents = [head])
  const newCommitRes = await gh<{ sha?: string; html_url?: string }>(
    token,
    "POST",
    `/repos/${repo}/git/commits`,
    {
      message,
      tree: newTreeSha,
      parents: [headCommitSha],
    },
  );
  if (newCommitRes.status < 200 || newCommitRes.status >= 300 || !newCommitRes.data.sha) {
    throw new GithubError(`Failed to create commit (${newCommitRes.status})`, newCommitRes.status);
  }
  const newCommitSha = newCommitRes.data.sha;
  const commitUrl = newCommitRes.data.html_url || `https://github.com/${repo}/commit/${newCommitSha}`;

  // PATCH git/refs/heads/{branch} (force: false)
  const patchRefRes = await gh(
    token,
    "PATCH",
    `/repos/${repo}/git/refs/heads/${targetBranch}`,
    {
      sha: newCommitSha,
      force: false,
    },
  );
  if (patchRefRes.status < 200 || patchRefRes.status >= 300) {
    throw new GithubError(`Failed to update branch reference (${patchRefRes.status})`, patchRefRes.status);
  }

  return {
    commitUrl,
    branch: targetBranch,
    created: isCreated,
  };
}
