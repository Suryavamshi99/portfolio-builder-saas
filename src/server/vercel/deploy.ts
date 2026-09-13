import { createHash } from "node:crypto";
import { VERCEL_API_BASE } from "@/config/vercel";

/**
 * Vercel Deployments API (v13) — files-by-digest flow: upload each file's
 * bytes once (dedup'd by its own SHA-1 on Vercel's end), then create the
 * deployment referencing files by that digest. Believed correct as of
 * implementation time but NOT verified live — see the uncertainty note in
 * src/config/vercel.ts. Isolated here so a correction is contained to one
 * file.
 */
export class VercelDeployError extends Error {}

async function uploadVercelFile(accessToken: string, buffer: Buffer): Promise<{ sha: string; size: number }> {
  const sha = createHash("sha1").update(buffer).digest("hex");

  const res = await fetch(`${VERCEL_API_BASE}/v2/files`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/octet-stream",
      "x-vercel-digest": sha,
    },
    body: new Uint8Array(buffer),
  });

  // 409 means Vercel already has a file with this digest — not an error for us.
  if (!res.ok && res.status !== 409) {
    throw new VercelDeployError(`Vercel file upload failed (${res.status}): ${(await res.text()).slice(0, 500)}`);
  }

  return { sha, size: buffer.byteLength };
}

export async function createVercelDeployment(
  accessToken: string,
  projectName: string,
  files: Record<string, Buffer | string>,
): Promise<{ deploymentId: string; url: string }> {
  const fileEntries = await Promise.all(
    Object.entries(files).map(async ([path, content]) => {
      const buffer = typeof content === "string" ? Buffer.from(content, "utf8") : content;
      const { sha, size } = await uploadVercelFile(accessToken, buffer);
      return { file: path, sha, size };
    }),
  );

  const res = await fetch(`${VERCEL_API_BASE}/v13/deployments`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      name: projectName,
      files: fileEntries,
      target: "production",
      projectSettings: { framework: null },
    }),
  });

  if (!res.ok) {
    throw new VercelDeployError(`Vercel deployment creation failed (${res.status}): ${(await res.text()).slice(0, 500)}`);
  }

  const json = (await res.json()) as { id?: string; url?: string };
  if (!json.id) throw new VercelDeployError("Vercel deployment response had no id");

  return { deploymentId: json.id, url: json.url ? `https://${json.url}` : "" };
}

export type VercelReadyState = "QUEUED" | "INITIALIZING" | "BUILDING" | "READY" | "ERROR" | "CANCELED";

export async function getVercelDeployment(
  accessToken: string,
  deploymentId: string,
): Promise<{ readyState: VercelReadyState; url: string } | null> {
  const res = await fetch(`${VERCEL_API_BASE}/v13/deployments/${deploymentId}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;

  const json = (await res.json()) as { readyState?: VercelReadyState; url?: string };
  if (!json.readyState) return null;
  return { readyState: json.readyState, url: json.url ? `https://${json.url}` : "" };
}

export function mapReadyStateToPublicationStatus(
  readyState: VercelReadyState,
): "queued" | "building" | "ready" | "error" {
  switch (readyState) {
    case "READY":
      return "ready";
    case "ERROR":
    case "CANCELED":
      return "error";
    case "BUILDING":
      return "building";
    default:
      return "queued";
  }
}
