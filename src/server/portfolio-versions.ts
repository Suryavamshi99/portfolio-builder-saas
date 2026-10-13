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
    // Don't leave a "newest" version that never became the live draft.
    await admin.from("portfolio_versions").delete().eq("user_id", userId).eq("id", inserted.id);
    throw new Error(`Failed to update portfolio: ${upsertError.message}`);
  }

  // 3. Prune to the newest MAX_VERSIONS_PER_USER. The page is already saved, so
  // a failure here is logged, not thrown; the next save prunes again.
  await pruneOldVersions(admin, userId);

  return { versionId: inserted.id, updatedAt };
}

async function pruneOldVersions(admin: SupabaseClient, userId: string): Promise<void> {
  const { data: newest, error: selectError } = await admin
    .from("portfolio_versions")
    .select("created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MAX_VERSIONS_PER_USER);

  if (selectError) {
    console.warn(`Could not list portfolio versions to prune: ${selectError.message}`);
    return;
  }
  if (!newest || newest.length < MAX_VERSIONS_PER_USER) return;

  // Delete by a created_at cutoff rather than "not in <ids>", so a version a
  // parallel generation inserts after this select is never deleted.
  const cutoff = newest[newest.length - 1]!.created_at as string;
  const { error: deleteError } = await admin
    .from("portfolio_versions")
    .delete()
    .eq("user_id", userId)
    .lt("created_at", cutoff);

  if (deleteError) {
    console.warn(`Could not prune old portfolio versions: ${deleteError.message}`);
  }
}

export type PortfolioVersionSummary = {
  id: string;
  source: string;
  model: string | null;
  warnings: string[];
  createdAt: string;
};

export async function listPortfolioVersions(
  admin: SupabaseClient,
  userId: string,
): Promise<PortfolioVersionSummary[]> {
  const { data, error } = await admin
    .from("portfolio_versions")
    .select("id, source, model, warnings, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MAX_VERSIONS_PER_USER);

  if (error) {
    throw new Error(`Failed to list portfolio versions: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    source: row.source,
    model: row.model,
    warnings: Array.isArray(row.warnings) ? row.warnings : [],
    createdAt: row.created_at,
  }));
}

export async function restorePortfolioVersion(
  admin: SupabaseClient,
  userId: string,
  versionId: string,
): Promise<{ html: string; updatedAt: string }> {
  const { data: versionRow, error: fetchError } = await admin
    .from("portfolio_versions")
    .select("html")
    .eq("user_id", userId)
    .eq("id", versionId)
    .maybeSingle();

  if (fetchError || !versionRow) {
    throw new Error(`Portfolio version not found: ${fetchError?.message ?? "unknown"}`);
  }

  const updatedAt = new Date().toISOString();
  const { error: upsertError } = await admin
    .from("portfolios")
    .upsert({ user_id: userId, generated_html: versionRow.html, updated_at: updatedAt }, { onConflict: "user_id" });

  if (upsertError) {
    throw new Error(`Failed to restore portfolio draft: ${upsertError.message}`);
  }

  return { html: versionRow.html, updatedAt };
}
