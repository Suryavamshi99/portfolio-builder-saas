import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { isByokEnabledProvider } from "@/config/llm";
import { PLAN_GENERATIONS_PER_HOUR } from "@/config/plans";
import { byteaToBuffer, decryptSecret } from "@/lib/crypto";
import { extractResumeText } from "@/server/resume-text";
import {
  GUARDRAIL_SYSTEM_PROMPT,
  LlmAuthError,
  LlmRateLimitError,
  buildPortfolioHtmlUserMessage,
  callLlmProvider,
  extractHtmlDocument,
  type LlmImageInput,
  type ProfileLinks,
} from "@/server/llm";
import { recordGeneration } from "@/server/generations";
import { checkHourlyRateLimit } from "@/server/rate-limit";
import { getOrCreateAppUser } from "@/server/users";

const UPLOADS_BUCKET = "uploads";
/** Long enough to comfortably outlast the gap between generating and publishing. */
const PHOTO_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

function errorResponse(
  status: number,
  code: string,
  message: string,
  extra?: { retryAfterSeconds?: number },
) {
  const error: Record<string, unknown> = { code, message };
  if (extra?.retryAfterSeconds !== undefined) error["retryAfterSeconds"] = extra.retryAfterSeconds;
  return Response.json({ error }, { status });
}

const MAX_LINK_LENGTH = 300;
const MAX_LINKS = 10;

function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, MAX_LINK_LENGTH);
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Never trust the shape of client JSON — these are optional, best-effort
 * exact-URL inputs (see ProfileLinks / DESIGN & OUTPUT RULES in the
 * guardrail prompt), not facts subject to the resume-only content rule. */
function parseLinks(raw: unknown): ProfileLinks {
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

export const Route = createFileRoute("/api/generate")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      POST: async ({ request, context }) => {
        const { user, supabase } = context as AuthedContext;

        let body: {
          provider?: unknown;
          resumeUploadId?: unknown;
          otherSpecifics?: unknown;
          designIntensity?: unknown;
          links?: unknown;
        };
        try {
          body = await request.json();
        } catch {
          return errorResponse(400, "invalid_json", "Body must be valid JSON");
        }

        if (!isByokEnabledProvider(body.provider)) {
          return errorResponse(400, "invalid_provider", "provider must be: google (Gemini is the only supported provider right now)");
        }
        if (typeof body.resumeUploadId !== "string") {
          return errorResponse(400, "invalid_request", "resumeUploadId is required");
        }
        if (body.designIntensity !== undefined && body.designIntensity !== "minimal" && body.designIntensity !== "bold") {
          return errorResponse(400, "invalid_request", "designIntensity must be 'minimal' or 'bold'");
        }
        const otherSpecifics = typeof body.otherSpecifics === "string" ? body.otherSpecifics : undefined;
        const designIntensity = body.designIntensity === "bold" ? "bold" : "minimal";
        const links = parseLinks(body.links);
        const provider = body.provider;
        const resumeUploadId = body.resumeUploadId;

        const appUser = await getOrCreateAppUser(supabase, user.id);
        if (!appUser) return errorResponse(500, "internal_error", "Could not load account");

        // Our own compute cost, independent of whose API key is used.
        const rateLimit = await checkHourlyRateLimit(
          supabase,
          "generations",
          user.id,
          PLAN_GENERATIONS_PER_HOUR[appUser.plan],
        );
        if (rateLimit.limited) {
          return errorResponse(429, "rate_limited", "Generation limit reached, try again later", {
            retryAfterSeconds: rateLimit.retryAfterSeconds,
          });
        }

        const { data: keyRow } = await supabase
          .from("byok_keys")
          .select("encrypted_key, nonce")
          .eq("user_id", user.id)
          .eq("provider", provider)
          .maybeSingle();
        if (!keyRow) {
          return errorResponse(401, "byok_key_missing", "Connect a Google Gemini API key first");
        }

        const { data: resumeRow } = await supabase
          .from("uploads")
          .select("id, storage_path, mime_type")
          .eq("id", resumeUploadId)
          .eq("user_id", user.id)
          .eq("kind", "resume")
          .maybeSingle();
        if (!resumeRow) {
          return errorResponse(400, "resume_not_found", "Resume upload not found");
        }

        const resumeDownload = await supabase.storage.from(UPLOADS_BUCKET).download(resumeRow.storage_path);
        if (resumeDownload.error || !resumeDownload.data) {
          return errorResponse(500, "internal_error", "Could not read resume");
        }
        const resumeBuffer = Buffer.from(await resumeDownload.data.arrayBuffer());
        const resumeText = await extractResumeText(resumeBuffer, resumeRow.mime_type);

        // Design inputs: the profile photo (embedded by exact URL in the
        // generated HTML) and up to 3 visual-reference screenshots (sent as
        // vision input for mood/layout inspiration, never embedded as-is).
        const [{ data: photoRow }, { data: referenceRows }] = await Promise.all([
          supabase
            .from("uploads")
            .select("storage_path")
            .eq("user_id", user.id)
            .eq("kind", "photo")
            .maybeSingle(),
          supabase
            .from("uploads")
            .select("storage_path, mime_type")
            .eq("user_id", user.id)
            .eq("kind", "visual_reference")
            .limit(3),
        ]);

        let photoUrl: string | undefined;
        if (photoRow) {
          const signed = await supabase.storage
            .from(UPLOADS_BUCKET)
            .createSignedUrl(photoRow.storage_path, PHOTO_SIGNED_URL_TTL_SECONDS);
          photoUrl = signed.data?.signedUrl;
        }

        const referenceImages: LlmImageInput[] = [];
        for (const row of referenceRows ?? []) {
          const download = await supabase.storage.from(UPLOADS_BUCKET).download(row.storage_path);
          if (download.error || !download.data) continue;
          const buffer = Buffer.from(await download.data.arrayBuffer());
          referenceImages.push({ mimeType: row.mime_type, base64Data: buffer.toString("base64") });
        }

        const apiKey = decryptSecret(byteaToBuffer(keyRow.encrypted_key), byteaToBuffer(keyRow.nonce));
        const userMessage = buildPortfolioHtmlUserMessage({
          resumeText,
          otherSpecifics,
          photoUrl,
          hasReferenceImages: referenceImages.length > 0,
          designIntensity,
          links,
        });

        let responseText: string;
        try {
          const result = await callLlmProvider(provider, {
            apiKey,
            systemPrompt: GUARDRAIL_SYSTEM_PROMPT,
            userMessage,
            images: referenceImages,
          });
          responseText = result.text;
        } catch (e) {
          await recordGeneration(supabase, user.id, resumeRow.id, "failed");
          if (e instanceof LlmAuthError) {
            return errorResponse(401, "byok_key_invalid", "Your API key was rejected by the provider");
          }
          if (e instanceof LlmRateLimitError) {
            return errorResponse(
              429,
              "provider_rate_limited",
              "The AI model is busy handling other requests right now. Please try again shortly.",
              { retryAfterSeconds: e.retryAfterSeconds },
            );
          }
          return errorResponse(502, "llm_provider_error", e instanceof Error ? e.message : String(e));
        }

        // The resume has been consumed for an attempt either way — the LLM
        // call itself succeeded, so the 48h retention clock starts here,
        // even if what follows fails our own sanity check.
        await recordGeneration(supabase, user.id, resumeRow.id, "succeeded");

        let html: string;
        try {
          html = extractHtmlDocument(responseText);
        } catch {
          return errorResponse(422, "generation_invalid_output", "Model output wasn't a valid HTML document");
        }

        const updatedAt = new Date().toISOString();
        const { error: saveError } = await supabase
          .from("portfolios")
          .upsert({ user_id: user.id, generated_html: html, updated_at: updatedAt }, { onConflict: "user_id" });

        if (saveError) {
          return errorResponse(500, "internal_error", "Generated content but could not save it");
        }

        return Response.json({ html, updatedAt });
      },
    },
  },
});
