import * as React from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Trash2,
  Loader2,
  AlertCircle,
  Clock,
  HardDrive,
  CheckCircle2,
} from "lucide-react";

export type UploadKind = "resume" | "visual_reference" | "photo" | "project_image";

export interface UploadItem {
  id: string;
  kind: UploadKind;
  filename: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
}

export interface StorageStats {
  usedBytes: number;
  quotaBytes: number;
}

interface UploadWidgetProps {
  kind: UploadKind;
  onUploadSuccess?: (upload: UploadItem) => void;
  onDeleteSuccess?: (deletedId: string) => void;
  title?: string;
  description?: string;
  maxFilesOverride?: number;
}

const KIND_CONFIG: Record<
  UploadKind,
  {
    label: string;
    maxCount: number;
    maxSizeFormatted: string;
    allowedTypesFormatted: string;
    accept: string;
    retentionNotice: string;
  }
> = {
  resume: {
    label: "Resume (PDF or DOCX)",
    maxCount: 1,
    maxSizeFormatted: "5 MB",
    allowedTypesFormatted: "PDF, DOCX",
    accept: ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    retentionNotice: "Resumes are automatically purged within 48 hours of generation for your privacy.",
  },
  visual_reference: {
    label: "Visual Reference Screenshot",
    maxCount: 3,
    maxSizeFormatted: "5 MB each",
    allowedTypesFormatted: "PNG, JPG, WEBP",
    accept: "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp",
    retentionNotice: "Design reference screenshots expire 48 hours after generation.",
  },
  photo: {
    label: "Profile Headshot",
    maxCount: 1,
    maxSizeFormatted: "5 MB",
    allowedTypesFormatted: "PNG, JPG, WEBP",
    accept: "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp",
    retentionNotice: "EXIF/GPS metadata is stripped server-side. Draft images expire after 30 days of inactivity; published sites embed their own copy.",
  },
  project_image: {
    label: "Project Showcase Image",
    maxCount: 10,
    maxSizeFormatted: "5 MB each",
    allowedTypesFormatted: "PNG, JPG, WEBP",
    accept: "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp",
    retentionNotice: "Project images are embedded directly into your Vercel static bundle upon publish.",
  },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadWidget({
  kind,
  onUploadSuccess,
  onDeleteSuccess,
  title,
  description,
  maxFilesOverride,
}: UploadWidgetProps) {
  const config = KIND_CONFIG[kind];
  const maxAllowed = maxFilesOverride ?? config.maxCount;

  const [uploads, setUploads] = React.useState<UploadItem[]>([]);
  const [storage, setStorage] = React.useState<StorageStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [rateLimitTimer, setRateLimitTimer] = React.useState<number | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const fetchUploadsAndStorage = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/uploads?kind=${kind}`);
      if (res.status === 401) return;
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? res.statusText);
      }
      const data = (await res.json()) as { uploads: UploadItem[]; storage: StorageStats };
      setUploads(data.uploads ?? []);
      setStorage(data.storage ?? null);
    } catch (err: unknown) {
      console.warn("Error fetching uploads:", err);
    } finally {
      setLoading(false);
    }
  }, [kind]);

  React.useEffect(() => {
    void fetchUploadsAndStorage();
  }, [fetchUploadsAndStorage]);

  // Rate limit countdown effect
  React.useEffect(() => {
    if (rateLimitTimer === null || rateLimitTimer <= 0) return;
    const interval = setInterval(() => {
      setRateLimitTimer((prev) => (prev && prev > 1 ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(interval);
  }, [rateLimitTimer]);

  const handleFileSelected = async (file: File) => {
    setUploading(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append("kind", kind);
    formData.append("file", file);

    try {
      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Translate error codes honestly based on API.md contract
        const err = json?.error;
        if (res.status === 429) {
          const retry = err?.retryAfterSeconds ?? 300;
          setRateLimitTimer(retry);
          throw new Error(
            `Upload limit reached (10/hour). Try again in ${Math.ceil(retry / 60)} minute(s).`
          );
        } else if (err?.code === "upload_limit_exceeded") {
          throw new Error(err.message ?? `Maximum of ${maxAllowed} upload(s) reached for this kind.`);
        } else if (err?.code === "upload_quota_exceeded") {
          throw new Error(err.message ?? "Storage quota exceeded (50MB free cap). Delete existing uploads first.");
        } else if (err?.code === "upload_invalid_type") {
          throw new Error(err.message ?? `Invalid file format. Allowed formats: ${config.allowedTypesFormatted}`);
        } else if (err?.code === "upload_too_large") {
          throw new Error(err.message ?? "File is too large. Maximum size is 5MB.");
        } else {
          throw new Error(err?.message ?? `Upload failed (${res.status})`);
        }
      }

      const newUpload = json as UploadItem;
      await fetchUploadsAndStorage();
      onUploadSuccess?.(newUpload);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/uploads/${id}`, {
        method: "DELETE",
      });

      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error?.message ?? "Failed to delete upload");
      }

      setUploads((prev) => prev.filter((u) => u.id !== id));
      onDeleteSuccess?.(id);
      await fetchUploadsAndStorage();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to delete file.");
    } finally {
      setDeletingId(null);
    }
  };

  const isSingleton = kind === "resume" || kind === "photo";
  const atMaxCount = !isSingleton && uploads.length >= maxAllowed;

  return (
    <div className="space-y-4">
      {/* Title and retention notice */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">{title ?? config.label}</h4>
          <span className="text-xs text-muted-foreground">
            {isSingleton ? "Single file" : `${uploads.length} of ${maxAllowed} uploaded`}
          </span>
        </div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>

      {/* Trust & Retention Callout */}
      <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
        <Clock className="mt-0.5 size-3.5 shrink-0 text-accent" />
        <span>{config.retentionNotice}</span>
      </div>

      {/* Storage Quota Bar */}
      {storage && (
        <div className="space-y-1.5 rounded-lg border border-border/80 bg-card p-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <HardDrive className="size-3.5 text-muted-foreground" />
              <span>Storage Quota</span>
            </div>
            <span className="text-muted-foreground font-mono">
              {formatBytes(storage.usedBytes)} / {formatBytes(storage.quotaBytes)} (
              {Math.round((storage.usedBytes / storage.quotaBytes) * 100)}%)
            </span>
          </div>
          <Progress
            value={storage.usedBytes}
            max={storage.quotaBytes}
            indicatorClassName={
              storage.usedBytes / storage.quotaBytes > 0.9
                ? "bg-destructive"
                : storage.usedBytes / storage.quotaBytes > 0.75
                ? "bg-warning"
                : "bg-accent"
            }
          />
        </div>
      )}

      {/* Honest Error Alert */}
      {errorMsg && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Upload Rejected</AlertTitle>
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {/* Rate limit banner */}
      {rateLimitTimer !== null && (
        <Alert variant="warning">
          <Clock className="size-4" />
          <AlertTitle>Upload Cooldown</AlertTitle>
          <AlertDescription>
            Rolling rate limit reached. Retry in {rateLimitTimer} seconds.
          </AlertDescription>
        </Alert>
      )}

      {/* Upload Dropzone / Button */}
      <div
        onClick={() => {
          if (!uploading && !atMaxCount && !rateLimitTimer) {
            fileInputRef.current?.click();
          }
        }}
        className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all ${
          atMaxCount || rateLimitTimer
            ? "border-border/60 bg-muted/30 cursor-not-allowed opacity-60"
            : uploading
            ? "border-accent bg-accent/5 cursor-wait"
            : "border-border hover:border-accent hover:bg-accent/5 cursor-pointer"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={config.accept}
          className="hidden"
          disabled={uploading || atMaxCount || !!rateLimitTimer}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFileSelected(file);
          }}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="size-8 animate-spin text-accent" />
            <p className="text-xs font-medium">Validating and uploading…</p>
            <p className="text-[11px] text-muted-foreground">Inspecting magic bytes & stripping metadata</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <UploadCloud className="size-5" />
            </div>
            <div>
              <p className="text-xs font-medium">
                {atMaxCount
                  ? "Maximum uploads reached"
                  : isSingleton && uploads.length > 0
                  ? "Click to replace current file"
                  : "Click to browse or drop file"}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Max {config.maxSizeFormatted} • {config.allowedTypesFormatted}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Existing Uploads List */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((up) => (
            <div
              key={up.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-2.5 text-xs shadow-xs"
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                {kind === "resume" ? (
                  <FileText className="size-4 shrink-0 text-accent" />
                ) : (
                  <div className="relative size-8 shrink-0 overflow-hidden rounded border border-border bg-muted">
                    <img
                      src={up.url}
                      alt={up.filename}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1 truncate">
                  <div className="font-medium text-foreground truncate">{up.filename}</div>
                  <div className="text-[11px] text-muted-foreground">{formatBytes(up.sizeBytes)}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={deletingId === up.id}
                  onClick={() => void handleDelete(up.id)}
                  className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  aria-label={`Delete ${up.filename}`}
                >
                  {deletingId === up.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
