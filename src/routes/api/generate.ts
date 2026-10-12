import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isByokEnabledProvider, LLM_MODELS } from "@/config/llm";
import { PLAN_GENERATIONS_PER_HOUR } from "@/config/plans";
import { byteaToBuffer, decryptSecret } from "@/lib/crypto";
import { extractResumeText } from "@/server/resume-text";
import { loadResumeText, saveResumeText } from "@/server/resume-texts";
import {
  GUARDRAIL_SYSTEM_PROMPT,
  LlmAuthError,
  LlmRateLimitError,
  buildPortfolioHtmlUserMessage,
  callLlmProvider,
  type LlmImageInput,
} from "@/server/llm";
import { recordGeneration } from "@/server/generations";
import { checkHourlyRateLimit } from "@/server/rate-limit";
import { getOrCreateAppUser, hasPaidAccess } from "@/server/users";
import { loadPortfolioInputs, savePortfolioInputs } from "@/server/portfolio-inputs";
import { addWatermark } from "@/server/watermark";
import { finalizeWithFactCheck, type CheckedGenerationResult } from "@/server/checked-generation";
import { savePortfolioVersion } from "@/server/portfolio-versions";
import {
  PHOTO_SIGNED_URL_TTL_SECONDS,
  PROMPT_SIGNED_URL_TTL_SECONDS,
  signStorageMarkers,
} from "@/server/storage-markers";
import { getSupabaseEnv } from "@/lib/supabase/env";

const UPLOADS_BUCKET = "uploads";

function errorResponse(
  status: number,
  code: string,
  message: string,
  extra?: { retryAfterSeconds?: number; details?: string[] },
) {
  const error: Record<string, unknown> = { code, message };
  if (extra?.retryAfterSeconds !== undefined) error["retryAfterSeconds"] = extra.retryAfterSeconds;
  if (extra?.details !== undefined) error["details"] = extra.details;
  return Response.json({ error }, { status });
}

function llmErrorResponse(e: unknown) {
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
          instructions?: unknown;
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
        if (body.instructions !== undefined && (typeof body.instructions !== "string" || body.instructions.length > 2000)) {
          return errorResponse(400, "invalid_request", "instructions must be a string up to 2000 characters");
        }

        const provider = body.provider;
        const resumeUploadId = body.resumeUploadId;

        if (body.links !== undefined || body.otherSpecifics !== undefined || body.designIntensity !== undefined) {
          try {
            await savePortfolioInputs(supabase, user.id, {
              links: body.links,
              specifics: body.otherSpecifics,
              designIntensity: body.designIntensity,
            });
          } catch {
            return errorResponse(500, "internal_error", "Could not save portfolio inputs");
          }
        }

        let savedInputs: Awaited<ReturnType<typeof loadPortfolioInputs>>;
        try {
          savedInputs = await loadPortfolioInputs(supabase, user.id);
        } catch {
          return errorResponse(500, "internal_error", "Could not load portfolio inputs");
        }
        const links = savedInputs.links;
        const otherSpecifics = savedInputs.specifics ?? undefined;
        const designIntensity = savedInputs.designIntensity;
        const instructions =
          typeof body.instructions === "string" && body.instructions.trim().length > 0
            ? body.instructions.trim()
            : undefined;

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

        // Text is saved at upload; resumes uploaded before that existed, or
        // whose save failed, are extracted from the file and saved now.
        const admin = createSupabaseAdminClient();
        let resumeText = await loadResumeText(admin, user.id, resumeRow.id).catch(() => null);
        if (resumeText === null) {
          const resumeDownload = await supabase.storage.from(UPLOADS_BUCKET).download(resumeRow.storage_path);
          if (resumeDownload.error || !resumeDownload.data) {
            return errorResponse(500, "internal_error", "Could not read resume");
          }
          const resumeBuffer = Buffer.from(await resumeDownload.data.arrayBuffer());
          resumeText = await extractResumeText(resumeBuffer, resumeRow.mime_type);
          await saveResumeText(admin, user.id, resumeRow.id, resumeText).catch((e: unknown) => {
            console.warn("Could not save resume text", e instanceof Error ? e.message : e);
          });
        }

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
            .createSignedUrl(photoRow.storage_path, PROMPT_SIGNED_URL_TTL_SECONDS);
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
          revisionInstructions: instructions,
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
          return llmErrorResponse(e);
        }

        // The resume has been consumed for an attempt either way — the LLM
        // call itself succeeded, so the 48h retention clock starts here,
        // even if what follows fails our own sanity check.
        await recordGeneration(supabase, user.id, resumeRow.id, "succeeded");

        // The repair round is part of this one request: it counts once
        // against the hourly limit and once as a generation.
        let finalResult: CheckedGenerationResult;
        try {
          finalResult = await finalizeWithFactCheck({
            firstReply: responseText,
            finalize: {
              userId: user.id,
              supabaseUrl: getSupabaseEnv().url,
              links,
              referenceText: [
                resumeText,
                otherSpecifics ?? "",
                links.linkedin,
                links.github,
                ...(links.githubProjects ?? []),
                ...(links.other ?? []).map((o) => o.url),
              ]
                .filter(Boolean)
                .join("\n"),
            },
            originalUserMessage: userMessage,
            repair: async (repairMessage) =>
              (
                await callLlmProvider(provider, {
                  apiKey,
                  systemPrompt: GUARDRAIL_SYSTEM_PROMPT,
                  userMessage: repairMessage,
                  images: [],
                })
              ).text,
          });
        } catch (e) {
          return llmErrorResponse(e);
        }

        if (!finalResult.ok) {
          if (finalResult.reason === "unsupported_claims") {
            return errorResponse(
              422,
              "generation_unsupported_claims",
              "The AI's page included facts that aren't in your resume, even after one correction. Please try again or add those details in your specifics.",
              { details: finalResult.details },
            );
          }
          return errorResponse(422, "generation_invalid_output", "The AI's page didn't pass our checks. Please try again.", {
            details: finalResult.details,
          });
        }

        let savedVersion: { versionId: string; updatedAt: string };
        try {
          savedVersion = await savePortfolioVersion(admin, user.id, {
            html: finalResult.html,
            source: "gemini",
            model: LLM_MODELS.google,
            warnings: finalResult.warnings,
          });
        } catch {
          return errorResponse(500, "internal_error", "Generated content but could not save it");
        }

        let responseHtml = await signStorageMarkers(
          finalResult.html,
          supabase,
          user.id,
          PHOTO_SIGNED_URL_TTL_SECONDS,
        );
        if (!hasPaidAccess(appUser)) {
          responseHtml = addWatermark(responseHtml);
        }

        return Response.json({
          html: responseHtml,
          updatedAt: savedVersion.updatedAt,
          warnings: finalResult.warnings,
        });
      },
    },
  },
});
