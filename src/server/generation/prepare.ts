import type { SupabaseClient } from "@supabase/supabase-js";
import { extractResumeText } from "@/server/resume-text";
import { loadResumeText, saveResumeText } from "@/server/resume-texts";
import { loadPortfolioInputs } from "@/server/portfolio-inputs";
import { buildPortfolioHtmlUserMessage, type LlmImageInput } from "@/server/llm";
import { PROMPT_SIGNED_URL_TTL_SECONDS } from "@/server/storage-markers";

const UPLOADS_BUCKET = "uploads";

export type PreparedGeneration =
  | {
      ok: true;
      userMessage: string;
      referenceText: string;
      images: LlmImageInput[];
      links: Awaited<ReturnType<typeof loadPortfolioInputs>>["links"];
    }
  | { ok: false; code: "resume_not_found" | "internal_error"; message: string };

/**
 * Everything a model call needs, read with the service-role client and scoped
 * to `userId` on every query, so it also works for a job that runs after the
 * request that created it (or from the cron route, which has no session).
 */
export async function prepareGeneration(
  admin: SupabaseClient,
  userId: string,
  opts: { resumeUploadId: string; instructions?: string | undefined; skipImages?: boolean },
): Promise<PreparedGeneration> {
  const { data: resumeRow } = await admin
    .from("uploads")
    .select("id, storage_path, mime_type")
    .eq("id", opts.resumeUploadId)
    .eq("user_id", userId)
    .eq("kind", "resume")
    .maybeSingle();
  if (!resumeRow) return { ok: false, code: "resume_not_found", message: "Resume upload not found" };

  let inputs: Awaited<ReturnType<typeof loadPortfolioInputs>>;
  try {
    inputs = await loadPortfolioInputs(admin, userId);
  } catch {
    return { ok: false, code: "internal_error", message: "Could not load portfolio inputs" };
  }

  let resumeText = await loadResumeText(admin, userId, resumeRow.id).catch(() => null);
  if (resumeText === null) {
    const download = await admin.storage.from(UPLOADS_BUCKET).download(resumeRow.storage_path);
    if (download.error || !download.data) return { ok: false, code: "internal_error", message: "Could not read resume" };
    resumeText = await extractResumeText(Buffer.from(await download.data.arrayBuffer()), resumeRow.mime_type);
    await saveResumeText(admin, userId, resumeRow.id, resumeText).catch((e: unknown) => {
      console.warn("Could not save resume text", e instanceof Error ? e.message : e);
    });
  }

  // The checks after a page is saved only need the text, not the photo link or screenshots.
  const [{ data: photoRow }, { data: referenceRows }] = opts.skipImages
    ? [{ data: null }, { data: null }]
    : await Promise.all([
    admin.from("uploads").select("storage_path").eq("user_id", userId).eq("kind", "photo").maybeSingle(),
    admin.from("uploads").select("storage_path, mime_type").eq("user_id", userId).eq("kind", "visual_reference").limit(3),
  ]);

  let photoUrl: string | undefined;
  if (photoRow) {
    const signed = await admin.storage.from(UPLOADS_BUCKET).createSignedUrl(photoRow.storage_path, PROMPT_SIGNED_URL_TTL_SECONDS);
    photoUrl = signed.data?.signedUrl;
  }

  const images: LlmImageInput[] = [];
  for (const row of referenceRows ?? []) {
    const download = await admin.storage.from(UPLOADS_BUCKET).download(row.storage_path);
    if (download.error || !download.data) continue;
    images.push({ mimeType: row.mime_type, base64Data: Buffer.from(await download.data.arrayBuffer()).toString("base64") });
  }

  const { links, specifics, designIntensity } = inputs;
  const userMessage = buildPortfolioHtmlUserMessage({
    resumeText,
    otherSpecifics: specifics ?? undefined,
    revisionInstructions: opts.instructions,
    photoUrl,
    hasReferenceImages: images.length > 0,
    designIntensity,
    links,
  });

  // Facts the page may use: the resume, the user's own words, and their verified links.
  const referenceText = [
    resumeText,
    specifics ?? "",
    opts.instructions ?? "",
    links.linkedin,
    links.github,
    ...(links.githubProjects ?? []),
    ...(links.other ?? []).map((o) => o.url),
  ]
    .filter(Boolean)
    .join("\n");

  return { ok: true, userMessage, referenceText, images, links };
}
