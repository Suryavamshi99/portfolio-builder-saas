import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_RESUME_TEXT_CHARS = 100_000;

/** Saves (or replaces) the text for one resume upload. Throws on a database error. */
export async function saveResumeText(
  admin: SupabaseClient,
  userId: string,
  uploadId: string,
  text: string,
): Promise<void> {
  const trimmed = text.trim().slice(0, MAX_RESUME_TEXT_CHARS);
  if (!trimmed) return;

  const { error } = await admin
    .from("resume_texts")
    .upsert({ upload_id: uploadId, user_id: userId, text: trimmed }, { onConflict: "upload_id" });

  if (error) {
    throw new Error(`Failed to save resume text: ${error.message}`);
  }
}

/** The saved text for this user's resume upload, or null if there is none. Throws on a database error. */
export async function loadResumeText(
  admin: SupabaseClient,
  userId: string,
  uploadId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("resume_texts")
    .select("text")
    .eq("upload_id", uploadId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load resume text: ${error.message}`);
  }

  return (data as { text: string } | null)?.text ?? null;
}
