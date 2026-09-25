import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Loader2,
  ExternalLink,
  Lock,
  Sparkles,
} from "lucide-react";

export type LLMProvider = "anthropic" | "openai" | "google";

export interface ConnectedKey {
  provider: LLMProvider;
  connectedAt: string;
}

/**
 * Phase 1: Gemini is the only connectable provider (see BYOK_ENABLED_PROVIDERS
 * in src/config/llm.ts — the server rejects anything else). Anthropic and
 * OpenAI both require a funded account before a key works at all, which
 * defeats a free "generate first, pay to deploy" flow; Gemini has a real,
 * ongoing, no-card-required free tier. Kept as a Record so re-adding a
 * provider later is additive, not a rewrite.
 */
const PROVIDER_METADATA: Record<
  LLMProvider,
  {
    name: string;
    description: string;
    placeholder: string;
    docsUrl: string;
    steps: string[];
    freeTier: { label: string; variant: "success" | "warning" | "outline" };
  }
> = {
  google: {
    name: "Google Gemini",
    description: "Gemini 3.5 Flash. Fast, accurate structured extraction from your resume — and free to use.",
    placeholder: "AIzaSy...",
    docsUrl: "https://aistudio.google.com/app/apikey",
    freeTier: { label: "Free, no card needed", variant: "success" },
    steps: [
      "Open aistudio.google.com/app/apikey in a new tab and sign in with any Google account.",
      "Click the blue \"Create API key\" button.",
      "Pick an existing Google Cloud project from the dropdown, or choose \"Create API key in new project\" — either works.",
      "Copy the key that appears (it starts with \"AIzaSy\").",
      "Paste it into the box below and click Save Key.",
    ],
  },
  anthropic: {
    name: "Anthropic Claude",
    description: "Claude Sonnet 5. Not available yet — coming in a later phase.",
    placeholder: "sk-ant-...",
    docsUrl: "https://console.anthropic.com/settings/keys",
    freeTier: { label: "$5 one-time trial credit", variant: "warning" },
    steps: [],
  },
  openai: {
    name: "OpenAI",
    description: "GPT-5.6 Terra. Not available yet — coming in a later phase.",
    placeholder: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys",
    freeTier: { label: "Requires billing set up first", variant: "outline" },
    steps: [],
  },
};

const ACTIVE_PROVIDER: LLMProvider = "google";

interface ByokManagerProps {
  onKeyConnected?: (provider: LLMProvider) => void;
  compact?: boolean;
}

export function ByokManager({ onKeyConnected, compact = false }: ByokManagerProps) {
  const [keys, setKeys] = React.useState<ConnectedKey[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  // Phase 1 only connects Gemini — see ACTIVE_PROVIDER above.
  const activeProvider = ACTIVE_PROVIDER;
  const [keyInput, setKeyInput] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [deletingProvider, setDeletingProvider] = React.useState<LLMProvider | null>(null);

  const fetchKeys = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/byok-keys");
      if (res.status === 401) return;
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? res.statusText);
      }
      const data = (await res.json()) as { keys: ConnectedKey[] };
      setKeys(data.keys ?? []);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to load keys");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchKeys();
  }, [fetchKeys]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) return;

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/byok-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: activeProvider,
          apiKey: keyInput.trim(),
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error?.message ?? `Failed to save key (${res.status})`);
      }

      setKeyInput("");
      setSuccessMsg(
        `Successfully connected ${PROVIDER_METADATA[activeProvider].name} key.`
      );
      await fetchKeys();
      onKeyConnected?.(activeProvider);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to connect key");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (provider: LLMProvider) => {
    if (deletingProvider) return;
    setDeletingProvider(provider);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/byok-keys/${provider}`, {
        method: "DELETE",
      });

      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error?.message ?? "Failed to disconnect key");
      }

      setSuccessMsg(`Disconnected ${PROVIDER_METADATA[provider].name} key.`);
      await fetchKeys();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to delete key");
    } finally {
      setDeletingProvider(null);
    }
  };

  const isConnected = (provider: LLMProvider) => keys.some((k) => k.provider === provider);
  const getKey = (provider: LLMProvider) => keys.find((k) => k.provider === provider);

  return (
    <div className="space-y-6">
      {/* Honest trust notice */}
      <Alert variant="accent" className="border-accent/30 bg-accent/5">
        <Lock className="size-4 text-accent" />
        <AlertTitle className="text-foreground font-semibold">
          Bring Your Own Key (BYOK) Security & Privacy
        </AlertTitle>
        <AlertDescription className="text-muted-foreground text-xs leading-relaxed">
          Your API keys are encrypted at rest with <strong>AES-256-GCM envelope encryption</strong>. Keys are never logged, never returned over the network, and are used solely to generate your portfolio content when you request it.
        </AlertDescription>
      </Alert>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {successMsg && (
        <Alert variant="success">
          <CheckCircle2 className="size-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{successMsg}</AlertDescription>
        </Alert>
      )}

      {(() => {
        const meta = PROVIDER_METADATA[activeProvider];
        const connected = isConnected(activeProvider);
        const keyData = getKey(activeProvider);

        return (
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{meta.name}</span>
                <Badge variant={meta.freeTier.variant} className="text-[10px]">
                  {meta.freeTier.label}
                </Badge>
              </div>
              {connected ? (
                <Badge variant="success" className="gap-1 text-[10px]">
                  <CheckCircle2 className="size-3" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Not connected
                </Badge>
              )}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{meta.description}</p>

            <div className="mt-4 rounded-lg border border-border/60 bg-card p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Sparkles className="size-3.5 text-accent" />
                How to get your free Gemini API key
              </p>
              <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs text-muted-foreground leading-relaxed">
                {meta.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>

            {connected && keyData && (
              <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2.5 text-[11px] text-muted-foreground">
                <span>
                  Linked {new Date(keyData.connectedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={deletingProvider === activeProvider}
                  onClick={() => void handleDelete(activeProvider)}
                  className="h-6 px-1.5 text-destructive hover:bg-destructive/10 text-[11px]"
                  aria-label={`Disconnect ${meta.name} key`}
                >
                  {deletingProvider === activeProvider ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="size-3" /> Disconnect
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        );
      })()}

      <p className="text-center text-[11px] text-muted-foreground">
        Claude and OpenAI keys are coming in a later phase — Gemini is the only supported provider for now.
      </p>

      {/* Add / Rotate form */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="size-4 text-accent" />
              {isConnected(activeProvider)
                ? `Rotate ${PROVIDER_METADATA[activeProvider].name} Key`
                : `Connect ${PROVIDER_METADATA[activeProvider].name}`}
            </CardTitle>
            <a
              href={PROVIDER_METADATA[activeProvider].docsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
            >
              Get API key <ExternalLink className="size-3" />
            </a>
          </div>
          <CardDescription className="text-xs">
            {isConnected(activeProvider)
              ? "Entering a new key will securely overwrite your previous key."
              : "Paste your API key below. It will be encrypted and tested during generation."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleConnect} className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Input
                type="password"
                placeholder={PROVIDER_METADATA[activeProvider].placeholder}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                required
                className="font-mono text-xs"
                disabled={submitting}
                autoComplete="off"
              />
            </div>
            <Button type="submit" disabled={submitting || !keyInput.trim()} className="gap-2">
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Encrypting…
                </>
              ) : isConnected(activeProvider) ? (
                <>
                  <RefreshCw className="size-4" />
                  Rotate Key
                </>
              ) : (
                <>
                  <ShieldCheck className="size-4" />
                  Save Key
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
