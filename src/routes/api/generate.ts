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
} from "@/server/llm";
import { recordGeneration } from "@/server/generations";
import { checkHourlyRateLimit } from "@/server/rate-limit";
import { getOrCreateAppUser, hasPaidAccess } from "@/server/users";
import { loadPortfolioInputs, savePortfolioInputs } from "@/server/portfolio-inputs";
import { addWatermark } from "@/server/watermark";

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

        const responseHtml = !hasPaidAccess(appUser) ? addWatermark(html) : html;
        return Response.json({ html: responseHtml, updatedAt });
      },
    },
  },
});
