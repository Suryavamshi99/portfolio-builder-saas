import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_VERSIONS_PER_USER = 20;

export async function savePortfolioVersion(
  admin: SupabaseClient,
  userId: string,
  version: { html: string; source: "gemini" | "free" | "mcp"; model: string | null; warnings: string[] },
): Promise<{ versionId: string; updatedAt: string }> {
  // 1. Insert portfolio_versions row
  const { data: inserted, error: insertError } = await admin
    .from("portfolio_versions")
    .insert({
      user_id: userId,
      html: version.html,
      source: version.source,
      model: version.model,
      warnings: version.warnings,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    throw new Error(`Failed to insert portfolio version: ${insertError?.message ?? "unknown error"}`);
  }

  // 2. Upsert portfolios row
  const updatedAt = new Date().toISOString();
  const { error: upsertError } = await admin
    .from("portfolios")
    .upsert({ user_id: userId, generated_html: version.html, updated_at: updatedAt }, { onConflict: "user_id" });

  if (upsertError) {
    throw new Error(`Failed to update portfolio: ${upsertError.message}`);
  }

  // 3. Delete versions older than the newest MAX_VERSIONS_PER_USER for this user
  const { data: keepRows, error: selectError } = await admin
    .from("portfolio_versions")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MAX_VERSIONS_PER_USER);

  if (selectError) {
    throw new Error(`Failed to query portfolio versions: ${selectError.message}`);
  }

  const keepIds = (keepRows ?? []).map((row) => row.id);
  if (keepIds.length >= MAX_VERSIONS_PER_USER) {
    const { error: deleteError } = await admin
      .from("portfolio_versions")
      .delete()
      .eq("user_id", userId)
      .not("id", "in", `(${keepIds.join(",")})`);

    if (deleteError) {
      throw new Error(`Failed to prune old portfolio versions: ${deleteError.message}`);
    }
  }

  return { versionId: inserted.id, updatedAt };
}
