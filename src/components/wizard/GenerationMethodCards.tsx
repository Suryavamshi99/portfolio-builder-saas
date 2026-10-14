import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ByokManager, type LLMProvider } from "@/components/byok/ByokManager";
import { Zap, KeyRound, AlertCircle } from "lucide-react";
import { ClaudeLogo, ChatGPTLogo } from "@/components/wizard/BrandLogos";
import type { FreeStatusResponse } from "@/lib/api-client";

export type GenerationMethod = "free" | "mcp" | "gemini";

interface GenerationMethodCardsProps {
  selectedMethod: GenerationMethod;
  onSelectMethod: (method: GenerationMethod) => void;
  freeStatus: FreeStatusResponse | null;
  freeLoading: boolean;
  freeConsentChecked: boolean;
  onFreeConsentChange: (checked: boolean) => void;
  onKeyConnected: (provider: LLMProvider) => void;
  comingSoonNotice?: string | null;
}

export function GenerationMethodCards({
  selectedMethod,
  onSelectMethod,
  freeStatus,
  freeLoading,
  freeConsentChecked,
  onFreeConsentChange,
  onKeyConnected,
  comingSoonNotice,
}: GenerationMethodCardsProps) {
  const isFreeAvailable = freeStatus ? freeStatus.available : true;
  const remainingToday = freeStatus
    ? Math.max(0, freeStatus.limitToday - freeStatus.usedToday)
    : null;
  const limitToday = freeStatus?.limitToday ?? 3;

  return (
    <div className="space-y-5">
      {comingSoonNotice && (
        <Alert variant="default" className="border-accent/40 bg-accent/5">
          <AlertCircle className="size-4 text-accent" />
          <AlertTitle className="text-xs font-semibold">Service note</AlertTitle>
          <AlertDescription className="text-xs">{comingSoonNotice}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {/* Card 1: Free */}
        <button
          type="button"
          onClick={() => onSelectMethod("free")}
          className={`flex flex-col text-left rounded-xl border p-4 transition-all relative ${
            selectedMethod === "free"
              ? "border-accent bg-accent/10 ring-2 ring-accent"
              : "border-border bg-card/60 hover:border-accent/40"
          }`}
        >
          <div className="flex items-center justify-between w-full mb-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Zap className="size-4" />
            </div>
            {selectedMethod === "free" && (
              <Badge variant="accent" className="text-[10px] py-0 px-1.5 font-mono">
                Selected
              </Badge>
            )}
          </div>
          <div className="font-semibold text-sm text-foreground">Free</div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            No setup.{" "}
            {freeLoading ? (
              "Checking free generations…"
            ) : remainingToday !== null ? (
              `${remainingToday} of ${limitToday} free generations left today.`
            ) : (
              "Free daily generations available."
            )}
          </p>
          {!isFreeAvailable && (
            <Badge variant="outline" className="mt-3 text-[10px] text-amber-500 border-amber-500/30 w-fit">
              Capacity resets soon
            </Badge>
          )}
        </button>

        {/* Card 2: Claude or ChatGPT (MCP) */}
        <button
          type="button"
          onClick={() => onSelectMethod("mcp")}
          className={`flex flex-col text-left rounded-xl border p-4 transition-all relative ${
            selectedMethod === "mcp"
              ? "border-accent bg-accent/10 ring-2 ring-accent"
              : "border-border bg-card/60 hover:border-accent/40"
          }`}
        >
          <div className="flex items-center justify-between w-full mb-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <ClaudeLogo className="size-4" />
              <ChatGPTLogo className="ml-1 size-4 text-foreground" />
            </div>
            {selectedMethod === "mcp" && (
              <Badge variant="accent" className="text-[10px] py-0 px-1.5 font-mono">
                Selected
              </Badge>
            )}
          </div>
          <div className="font-semibold text-sm text-foreground">Claude or ChatGPT</div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Best quality, uses your subscription plan via custom connector.
          </p>
        </button>

        {/* Card 3: Gemini Key */}
        <button
          type="button"
          onClick={() => onSelectMethod("gemini")}
          className={`flex flex-col text-left rounded-xl border p-4 transition-all relative ${
            selectedMethod === "gemini"
              ? "border-accent bg-accent/10 ring-2 ring-accent"
              : "border-border bg-card/60 hover:border-accent/40"
          }`}
        >
          <div className="flex items-center justify-between w-full mb-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <KeyRound className="size-4" />
            </div>
            {selectedMethod === "gemini" && (
              <Badge variant="accent" className="text-[10px] py-0 px-1.5 font-mono">
                Selected
              </Badge>
            )}
          </div>
          <div className="font-semibold text-sm text-foreground">My Gemini key</div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Free key from Google. We store it securely and never bill for inference.
          </p>
        </button>
      </div>

      {/* Detail panel for selected card */}
      {selectedMethod === "free" && (
        <Card className="border-border/80 bg-muted/20">
          <CardContent className="pt-4">
            <label className="flex items-start gap-3 cursor-pointer text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={freeConsentChecked}
                onChange={(e) => onFreeConsentChange(e.target.checked)}
                className="mt-0.5 size-4 rounded border-border text-accent focus:ring-accent"
              />
              <span className="leading-relaxed">
                Free models may keep your resume text to improve their AI. Use your own Gemini key or Claude/ChatGPT to avoid this.
              </span>
            </label>
          </CardContent>
        </Card>
      )}

      {selectedMethod === "gemini" && (
        <div className="pt-2">
          <ByokManager onKeyConnected={onKeyConnected} />
        </div>
      )}
    </div>
  );
}
