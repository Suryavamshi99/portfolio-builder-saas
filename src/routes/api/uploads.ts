import { randomUUID } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware, type AuthedContext } from "@/server/auth-middleware";
import { getOrCreateAppUser } from "@/server/users";
import { isUploadKind, sanitizeFilename, stripImageMetadataIfNeeded, validateUpload } from "@/server/uploads";
import { checkHourlyRateLimit } from "@/server/rate-limit";
import { UPLOAD_LIMITS, type UploadKind } from "@/config/uploads";
import { PLAN_STORAGE_QUOTA_BYTES, PLAN_UPLOADS_PER_HOUR } from "@/config/plans";

const BUCKET = "uploads";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

function errorResponse(status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return Response.json({ error: { code, message, ...extra } }, { status });
}

export const Route = createFileRoute("/api/uploads")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ request, context }) => {
        const { user, supabase } = context as AuthedContext;

        const appUser = await getOrCreateAppUser(supabase, user.id);
        if (!appUser) return errorResponse(500, "internal_error", "Could not load account");

        const kindFilter = new URL(request.url).searchParams.get("kind");
        if (kindFilter !== null && !isUploadKind(kindFilter)) {
          return errorResponse(400, "upload_invalid_kind", "kind must be one of the supported upload types");
        }

        const { data: uploads, error } = await supabase
          .from("uploads")
          .select("id, kind, storage_path, filename, size_bytes, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) return errorResponse(500, "internal_error", "Could not list uploads");

        // Storage summary is always account-wide, even when `kind` filters the list below.
        const allRows = uploads ?? [];
        const usedBytes = allRows.reduce((sum, row) => sum + row.size_bytes, 0);

        const rows = kindFilter === null ? allRows : allRows.filter((row) => row.kind === kindFilter);
        const paths = rows.map((row) => row.storage_path);
        const signed =
          paths.length > 0
            ? await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
            : { data: [] };
        const urlByPath = new Map((signed.data ?? []).map((entry) => [entry.path, entry.signedUrl]));

        return Response.json({
          uploads: rows.map((row) => ({
            id: row.id,
            kind: row.kind,
            filename: row.filename,
            sizeBytes: row.size_bytes,
            url: urlByPath.get(row.storage_path) ?? null,
            createdAt: row.created_at,
          })),
          storage: { usedBytes, quotaBytes: PLAN_STORAGE_QUOTA_BYTES[appUser.plan] },
        });
      },

      POST: async ({ request, context }) => {
        const { user, supabase } = context as AuthedContext;

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return errorResponse(400, "invalid_form", "Body must be multipart/form-data");
        }

        const kindValue = form.get("kind");
        const file = form.get("file");

        if (!isUploadKind(kindValue)) {
          return errorResponse(400, "upload_invalid_kind", "kind must be one of the supported upload types");
        }
        if (!(file instanceof File)) {
          return errorResponse(400, "upload_missing_file", "No file provided");
        }

        const kind: UploadKind = kindValue;
        const buffer = Buffer.from(await file.arrayBuffer());

        // 1. size + real content-type — before anything touches storage.
        const validated = await validateUpload(kind, buffer);
        if (!validated.ok) return errorResponse(400, validated.error.code, validated.error.message);

        const appUser = await getOrCreateAppUser(supabase, user.id);
        if (!appUser) return errorResponse(500, "internal_error", "Could not load account");

        // 2. hourly upload rate limit, separate from the LLM generation limit.
        const rateLimit = await checkHourlyRateLimit(
          supabase,
          "uploads",
          user.id,
          PLAN_UPLOADS_PER_HOUR[appUser.plan],
        );
        if (rateLimit.limited) {
          return errorResponse(429, "rate_limited", "Upload limit reached, try again later", {
            retryAfterSeconds: rateLimit.retryAfterSeconds,
          });
        }

        // 3. remaining quota — storage bytes and per-kind count.
        const { data: existingForUser } = await supabase
          .from("uploads")
          .select("id, kind, storage_path, size_bytes")
          .eq("user_id", user.id);

        const rows = existingForUser ?? [];
        const usedBytes = rows.reduce((sum, row) => sum + row.size_bytes, 0);
        const limits = UPLOAD_LIMITS[kind];
        const sameKindRows = rows.filter((row) => row.kind === kind);

        let replacing: (typeof rows)[number] | undefined;
        if (limits.slot === "singleton") {
          replacing = sameKindRows[0];
        } else if (sameKindRows.length >= limits.maxCount) {
          return errorResponse(
            409,
            "upload_limit_exceeded",
            `You can have at most ${limits.maxCount} ${kind} uploads — remove one first`,
          );
        }

        const effectiveUsedBytes = usedBytes - (replacing?.size_bytes ?? 0);
        const quotaBytes = PLAN_STORAGE_QUOTA_BYTES[appUser.plan];
        if (effectiveUsedBytes + buffer.byteLength > quotaBytes) {
          return errorResponse(
            409,
            "upload_quota_exceeded",
            `Storage quota exceeded (${Math.floor(quotaBytes / (1024 * 1024))}MB on the ${appUser.plan} plan)`,
          );
        }

        // 4. strip metadata, then 5. store — in that order, never the reverse.
        const processed = await stripImageMetadataIfNeeded(kind, buffer, validated.mime);

        const id = randomUUID();
        const filename = sanitizeFilename(file.name);
        const storagePath = `${user.id}/${kind}/${id}-${filename}`;

        const uploadResult = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, processed, { contentType: validated.mime, upsert: false });
        if (uploadResult.error) {
          return errorResponse(500, "internal_error", "Could not store file");
        }

        const insertResult = await supabase
          .from("uploads")
          .insert({
            id,
            user_id: user.id,
            kind,
            storage_path: storagePath,
            filename,
            size_bytes: processed.byteLength,
            mime_type: validated.mime,
          })
          .select("id, kind, filename, size_bytes, created_at")
          .single();

        if (insertResult.error || !insertResult.data) {
          await supabase.storage.from(BUCKET).remove([storagePath]);
          return errorResponse(500, "internal_error", "Could not save upload record");
        }

        // Replace-on-upload for singleton kinds, only after the new file is safely stored.
        if (replacing) {
          await supabase.storage.from(BUCKET).remove([replacing.storage_path]);
          await supabase.from("uploads").delete().eq("id", replacing.id);
        }

        const signedUrl = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

        return Response.json(
          {
            id: insertResult.data.id,
            kind: insertResult.data.kind,
            filename: insertResult.data.filename,
            sizeBytes: insertResult.data.size_bytes,
            url: signedUrl.data?.signedUrl ?? null,
            createdAt: insertResult.data.created_at,
          },
          { status: 201 },
        );
      },
    },
  },
});
