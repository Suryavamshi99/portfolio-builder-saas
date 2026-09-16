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
} from "lucide-react";

export type LLMProvider = "anthropic" | "openai" | "google";

export interface ConnectedKey {
  provider: LLMProvider;
  connectedAt: string;
}

const PROVIDER_METADATA: Record<
  LLMProvider,
  {
    name: string;
    description: string;
    placeholder: string;
    docsUrl: string;
    recommended?: boolean;
  }
> = {
  anthropic: {
    name: "Anthropic Claude",
    description: "Claude 3.7 Sonnet / 3.5 Sonnet. Excellent reasoning and structured extraction.",
    placeholder: "sk-ant-...",
    docsUrl: "https://console.anthropic.com/settings/keys",
    recommended: true,
  },
  openai: {
    name: "OpenAI",
    description: "GPT-4o / GPT-4o-mini. Fast and dependable content drafting.",
    placeholder: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys",
  },
  google: {
    name: "Google Gemini",
    description: "Gemini 2.5 Flash / Pro. Generous free tier quotas for students.",
    placeholder: "AIzaSy...",
    docsUrl: "https://aistudio.google.com/app/apikey",
  },
};

interface ByokManagerProps {
  onKeyConnected?: (provider: LLMProvider) => void;
  compact?: boolean;
}

export function ByokManager({ onKeyConnected, compact = false }: ByokManagerProps) {
  const [keys, setKeys] = React.useState<ConnectedKey[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  // Form states per provider
  const [activeProvider, setActiveProvider] = React.useState<LLMProvider>("anthropic");
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

      <div className="grid gap-4 sm:grid-cols-3">
        {(["anthropic", "openai", "google"] as LLMProvider[]).map((prov) => {
          const meta = PROVIDER_METADATA[prov];
          const connected = isConnected(prov);
          const keyData = getKey(prov);
          const isSelected = activeProvider === prov;

          return (
            <div
              key={prov}
              onClick={() => setActiveProvider(prov)}
              className={`cursor-pointer rounded-xl border p-4 transition-all ${
                isSelected
                  ? "border-accent ring-1 ring-accent bg-accent/5"
                  : "border-border hover:border-border/80 bg-card"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-sm">{meta.name}</div>
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
              <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{meta.description}</p>
              {connected && keyData && (
                <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
                  <span>
                    Linked {new Date(keyData.connectedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={deletingProvider === prov}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(prov);
                    }}
                    className="h-6 px-1.5 text-destructive hover:bg-destructive/10 text-[11px]"
                    aria-label={`Disconnect ${meta.name} key`}
                  >
                    {deletingProvider === prov ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Trash2 className="size-3" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

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
