import type { SupabaseClient } from "@supabase/supabase-js";

export async function recordGeneration(
  supabase: SupabaseClient,
  userId: string,
  resumeUploadId: string | null,
  status: "succeeded" | "failed",
): Promise<void> {
  await supabase
    .from("generations")
    .insert({ user_id: userId, resume_upload_id: resumeUploadId, status });
}
