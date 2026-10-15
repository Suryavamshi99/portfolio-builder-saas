import * as React from "react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FluidOrb } from "@/components/ui/fluid-orb";
import {
  Sparkles,
  Loader2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Edit,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";
import type { GenerationJob } from "@/lib/api-client";

export interface JobProgressViewProps {
  job: GenerationJob | null;
  generating: boolean;
  onTryAgain: () => void;
  onEditDetails: () => void;
  onUseAnotherMethod: () => void;
  onCancelQueued?: () => void;
  isCancelingQueued?: boolean;
  fallbackMessage?: string;
}

export function JobProgressView({
  job,
  generating: _generating,
  onTryAgain,
  onEditDetails,
  onUseAnotherMethod,
  onCancelQueued,
  isCancelingQueued = false,
  fallbackMessage = "A beautiful portfolio is in the works…",
}: JobProgressViewProps) {
  const isFailed = job?.status === "failed";
  const isQueuedWithRetry = job?.status === "queued" && Boolean(job.retryAt);

  // Failure UI with the 3 required action buttons
  if (isFailed) {
    const error = job?.error ?? { code: "generation_failed", message: job?.message ?? "" };
    const title =
      error.code === "generation_unsupported_claims"
        ? "Some facts aren't in your resume"
        : error.code === "generation_invalid_output"
        ? "The page didn't pass our checks"
        : error.code === "provider_rate_limited" || error.code === "free_models_busy"
        ? "The AI model is busy right now"
        : "Generation Failed";

    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle className="text-sm font-semibold">{title}</AlertTitle>
          <AlertDescription className="mt-2 space-y-3 text-xs">
            <p className="leading-relaxed">{error.message || "An error occurred during generation."}</p>
            {error.details && error.details.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 rounded bg-black/20 p-2.5 pl-6 text-xs text-foreground/90">
                {error.details.map((detail, idx) => (
                  <li key={idx}>{detail}</li>
                ))}
              </ul>
            )}
            {error.retryAfterSeconds && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                <Clock className="size-3.5" />
                <span>
                  Please try again after{" "}
                  {new Date(Date.now() + error.retryAfterSeconds * 1000).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  .
                </span>
              </div>
            )}
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
          <Button
            type="button"
            onClick={onTryAgain}
            className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-xs"
          >
            <RotateCcw className="size-3.5" />
            Try again
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onEditDetails}
            className="gap-2 text-xs"
          >
            <Edit className="size-3.5" />
            Edit my details
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onUseAnotherMethod}
            className="gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <SlidersHorizontal className="size-3.5" />
            Use another method
          </Button>
        </div>
      </div>
    );
  }

  // Queued state when retryAt is set
  if (isQueuedWithRetry && job) {
    const formattedResetTime = job.retryAt
      ? new Date(job.retryAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : "later today";

    return (
      <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-warning/30 bg-warning/5 p-8 text-center shadow-lg">
        <div className="flex size-14 items-center justify-center rounded-full bg-warning/20 text-warning">
          <Clock className="size-7" />
        </div>
        <div className="space-y-2 max-w-md">
          <div className="flex items-center justify-center gap-2">
            <h3 className="font-bold text-lg text-foreground tracking-tight">Queued for free capacity reset</h3>
            <Badge variant="outline" className="text-[10px] text-warning border-warning/40">
              Queued
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            We'll run this when free capacity resets at {formattedResetTime}. You can leave this page and come back.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          {onCancelQueued && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isCancelingQueued}
              onClick={onCancelQueued}
              className="gap-1.5 text-xs text-destructive hover:bg-destructive/10"
            >
              {isCancelingQueued ? <Loader2 className="size-3 animate-spin" /> : <XCircle className="size-3.5" />}
              Cancel
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onUseAnotherMethod}
            className="gap-1.5 text-xs"
          >
            <SlidersHorizontal className="size-3.5" />
            Use another method
          </Button>
        </div>
      </div>
    );
  }

  // Active progress view
  const progressText = job?.message || fallbackMessage;
  const progress = job?.progress ?? null;
  const percent = progress && progress.total > 0 ? Math.max(4, Math.round((progress.done / progress.total) * 100)) : null;

  return (
    <div className="relative overflow-hidden flex flex-col items-center justify-center gap-5 rounded-2xl border border-accent/40 bg-accent/5 p-8 text-center shadow-lg">
      <div className="relative">
        <FluidOrb size={170} color="#3457E8" className="shadow-2xl ring-4 ring-accent/20" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Sparkles className="size-8 text-white drop-shadow-md animate-pulse" />
        </div>
      </div>
      <div className="space-y-1.5 max-w-sm">
        <h3 className="font-bold text-lg text-foreground tracking-tight">A beautiful portfolio is in the works…</h3>
        <p className="text-xs text-accent font-medium animate-pulse">{progressText}</p>
      </div>
      {percent !== null && progress && (
        <div className="w-full max-w-sm space-y-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Build progress">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-gradient-to-r from-aurora-blue via-aurora-cyan to-aurora-mint transition-all duration-700" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Step {Math.min(progress.done + 1, progress.total)} of {progress.total}. Free builds take a few minutes. You can close this page; we keep building and it will be here when you come back.
          </p>
        </div>
      )}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin text-accent" />
        <span>Sticking to the facts on your resume — nothing made up</span>
      </div>
    </div>
  );
}
