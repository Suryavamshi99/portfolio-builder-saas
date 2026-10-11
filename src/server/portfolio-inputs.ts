import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileLinks } from "./llm";

export const MAX_LINK_LENGTH = 300;
export const MAX_LINKS = 10;
export const MAX_SPECIFICS_LENGTH = 4000;

export type DesignIntensity = "minimal" | "bold";

export function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, MAX_LINK_LENGTH);
  return trimmed.length > 0 ? trimmed : undefined;
}

export function cleanSpecifics(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, MAX_SPECIFICS_LENGTH);
  return trimmed.length > 0 ? trimmed : null;
}

/** Never trust the shape of client JSON — these are optional, best-effort
 * exact-URL inputs (see ProfileLinks / DESIGN & OUTPUT RULES in the
 * guardrail prompt), not facts subject to the resume-only content rule. */
export function parseLinks(raw: unknown): ProfileLinks {
  if (typeof raw !== "object" || raw === null) return {};
  const obj = raw as Record<string, unknown>;

  const githubProjects = Array.isArray(obj["githubProjects"])
    ? obj["githubProjects"].map(cleanString).filter((v): v is string => Boolean(v)).slice(0, MAX_LINKS)
    : undefined;

  const other = Array.isArray(obj["other"])
    ? obj["other"]
        .map((entry) => {
          if (typeof entry !== "object" || entry === null) return undefined;
          const e = entry as Record<string, unknown>;
          const label = cleanString(e["label"]);
          const url = cleanString(e["url"]);
          return label && url ? { label, url } : undefined;
        })
        .filter((v): v is { label: string; url: string } => Boolean(v))
        .slice(0, MAX_LINKS)
    : undefined;

  return {
    linkedin: cleanString(obj["linkedin"]),
    github: cleanString(obj["github"]),
    githubProjects: githubProjects && githubProjects.length > 0 ? githubProjects : undefined,
    other: other && other.length > 0 ? other : undefined,
  };
}

export interface LoadedPortfolioInputs {
  links: ProfileLinks;
  specifics: string | null;
  designIntensity: DesignIntensity;
  updatedAt: string | null;
}

export interface SavePortfolioInputsPartial {
  links?: unknown;
  specifics?: unknown;
  designIntensity?: unknown;
}

export async function loadPortfolioInputs(
  supabase: SupabaseClient,
  userId: string,
): Promise<LoadedPortfolioInputs> {
  const { data, error } = await supabase
    .from("portfolio_inputs")
    .select("links, specifics, design_intensity, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return {
      links: {},
      specifics: null,
      designIntensity: "minimal",
      updatedAt: null,
    };
  }

  const designIntensity: DesignIntensity = data.design_intensity === "bold" ? "bold" : "minimal";

  return {
    links: parseLinks(data.links),
    specifics: typeof data.specifics === "string" ? cleanSpecifics(data.specifics) : null,
    designIntensity,
    updatedAt: data.updated_at ?? null,
  };
}

export async function savePortfolioInputs(
  supabase: SupabaseClient,
  userId: string,
  partial: SavePortfolioInputsPartial,
): Promise<{
  links: ProfileLinks;
  specifics: string | null;
  designIntensity: DesignIntensity;
  updatedAt: string;
}> {
  const current = await loadPortfolioInputs(supabase, userId);

  const links = partial.links !== undefined ? parseLinks(partial.links) : current.links;
  const specifics =
    partial.specifics !== undefined ? cleanSpecifics(partial.specifics) : current.specifics;
  const designIntensity: DesignIntensity =
    partial.designIntensity !== undefined
      ? partial.designIntensity === "bold"
        ? "bold"
        : "minimal"
      : current.designIntensity;

  const updatedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("portfolio_inputs")
    .upsert(
      {
        user_id: userId,
        links,
        specifics,
        design_intensity: designIntensity,
        updated_at: updatedAt,
      },
      { onConflict: "user_id" },
    )
    .select("links, specifics, design_intensity, updated_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not save portfolio inputs");
  }

  return {
    links: parseLinks(data.links),
    specifics: typeof data.specifics === "string" ? cleanSpecifics(data.specifics) : null,
    designIntensity: data.design_intensity === "bold" ? "bold" : "minimal",
    updatedAt: data.updated_at,
  };
}
