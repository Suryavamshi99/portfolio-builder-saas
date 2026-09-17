import { zodToJsonSchema } from "zod-to-json-schema";
import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { isLlmProvider } from "@/config/llm";
import { PLAN_GENERATIONS_PER_HOUR } from "@/config/plans";
import { byteaToBuffer, decryptSecret } from "@/lib/crypto";
import { extractResumeText } from "@/server/resume-text";
import {
  GUARDRAIL_SYSTEM_PROMPT,
  LlmAuthError,
  buildExtractionUserMessage,
  callLlmProvider,
  extractJsonObject,
} from "@/server/llm";
import { recordGeneration } from "@/server/generations";
import { checkHourlyRateLimit } from "@/server/rate-limit";
import { getOrCreateAppUser } from "@/server/users";
import { contentSchema } from "@/data/content";
import { projectErrors } from "@/routes/-studio/model";

const contentJsonSchema = zodToJsonSchema(contentSchema, "Content");

function errorResponse(
  status: number,
  code: string,
  message: string,
  extra?: { issues?: unknown; retryAfterSeconds?: number },
) {
  const error: Record<string, unknown> = { code, message };
  if (extra?.retryAfterSeconds !== undefined) error["retryAfterSeconds"] = extra.retryAfterSeconds;
  const body: Record<string, unknown> = { error };
  if (extra?.issues) body["issues"] = extra.issues;
  return Response.json(body, { status });
}

export const Route = createFileRoute("/api/generate")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      POST: async ({ request, context }) => {
        const { user, supabase } = context as AuthedContext;

        let body: { provider?: unknown; resumeUploadId?: unknown; otherSpecifics?: unknown };
        try {
          body = await request.json();
        } catch {
          return errorResponse(400, "invalid_json", "Body must be valid JSON");
        }

        if (!isLlmProvider(body.provider)) {
          return errorResponse(400, "invalid_provider", "provider must be one of: anthropic, openai, google");
        }
        if (typeof body.resumeUploadId !== "string") {
          return errorResponse(400, "invalid_request", "resumeUploadId is required");
        }
        const otherSpecifics = typeof body.otherSpecifics === "string" ? body.otherSpecifics : undefined;
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
          return errorResponse(401, "byok_key_missing", "Connect an Anthropic/OpenAI/Google API key first");
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

        const download = await supabase.storage.from("uploads").download(resumeRow.storage_path);
        if (download.error || !download.data) {
          return errorResponse(500, "internal_error", "Could not read resume");
        }
        const resumeBuffer = Buffer.from(await download.data.arrayBuffer());
        const resumeText = await extractResumeText(resumeBuffer, resumeRow.mime_type);

        const apiKey = decryptSecret(byteaToBuffer(keyRow.encrypted_key), byteaToBuffer(keyRow.nonce));
        const userMessage = buildExtractionUserMessage(resumeText, otherSpecifics, contentJsonSchema);

        let responseText: string;
        try {
          const result = await callLlmProvider(provider, {
            apiKey,
            systemPrompt: GUARDRAIL_SYSTEM_PROMPT,
            userMessage,
          });
          responseText = result.text;
        } catch (e) {
          await recordGeneration(supabase, user.id, resumeRow.id, "failed");
          if (e instanceof LlmAuthError) {
            return errorResponse(401, "byok_key_invalid", "Your API key was rejected by the provider");
          }
          return errorResponse(502, "llm_provider_error", e instanceof Error ? e.message : String(e));
        }

        // The resume has been consumed for an attempt either way — the LLM
        // call itself succeeded, so the 48h retention clock starts here,
        // even if what follows fails our own schema validation.
        await recordGeneration(supabase, user.id, resumeRow.id, "succeeded");

        let rawJson: unknown;
        try {
          rawJson = extractJsonObject(responseText);
        } catch {
          return errorResponse(422, "generation_invalid_output", "Model output wasn't valid JSON");
        }

        const parsed = contentSchema.safeParse(rawJson);
        const issues: { path: string; message: string }[] = parsed.success
          ? []
          : parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));

        if (parsed.success) {
          const projectIssues = projectErrors(parsed.data.projects);
          for (const [index, message] of projectIssues) {
            issues.push({ path: `projects.${index}`, message });
          }
        }

        if (issues.length > 0) {
          return errorResponse(422, "generation_invalid_output", "Model output didn't match the content schema", {
            issues,
          });
        }

        const updatedAt = new Date().toISOString();
        const { error: saveError } = await supabase
          .from("portfolios")
          .upsert({ user_id: user.id, content: parsed.data, updated_at: updatedAt }, { onConflict: "user_id" });

        if (saveError) {
          return errorResponse(500, "internal_error", "Generated content but could not save it");
        }

        return Response.json({ content: parsed.data, updatedAt });
      },
    },
  },
});
