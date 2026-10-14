import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Bot,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { apiClient, type GenerationJob, type McpStatusResponse } from "@/lib/api-client";

interface McpWaitingPanelProps {
  onPortfolioReady?: () => void;
  className?: string;
}

export function McpWaitingPanel({ onPortfolioReady, className }: McpWaitingPanelProps) {
  const [copied, setCopied] = React.useState(false);
  const [mcpStatus, setMcpStatus] = React.useState<McpStatusResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [comingSoon, setComingSoon] = React.useState(false);

  const CHAT_PROMPT = "Build my Shipfolio portfolio";

  const fetchStatus = React.useCallback(async () => {
    try {
      const data = await apiClient.getMcpStatus();
      setMcpStatus(data);
      setComingSoon(false);
      if (data.latestJob?.status === "done") {
        onPortfolioReady?.();
      }
    } catch (err: unknown) {
      if ((err as { isNotFound?: boolean })?.isNotFound) {
        setComingSoon(true);
      }
    } finally {
      setLoading(false);
    }
  }, [onPortfolioReady]);

  React.useEffect(() => {
    void fetchStatus();
    // Poll every 3 seconds as required by Task C
    const timer = setInterval(() => {
      void fetchStatus();
    }, 3000);

    return () => clearInterval(timer);
  }, [fetchStatus]);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(CHAT_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  if (comingSoon) {
    return (
      <Card className={`border-border bg-card/60 ${className ?? ""}`}>
        <CardContent className="py-8 text-center space-y-3">
          <div className="flex size-12 mx-auto items-center justify-center rounded-full bg-accent/10 text-accent">
            <Bot className="size-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">Claude / ChatGPT Connector Coming Soon</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            The MCP connector endpoint is rolling out soon. In the meantime, you can use the Free generation method or connect your Gemini API key.
          </p>
          <div className="pt-2">
            <Button asChild variant="outline" size="sm" className="gap-2 text-xs">
              <Link to="/connect">
                View Connector Setup Guide <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isConnected = mcpStatus?.connected === true;
  const latestJob: GenerationJob | null = mcpStatus?.latestJob ?? null;

  return (
    <Card className={`border-border bg-card ${className ?? ""}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="size-5 text-accent" />
            <CardTitle className="text-base">Use Your Claude or ChatGPT</CardTitle>
          </div>
          {loading ? (
            <Badge variant="outline" className="text-[10px]">
              Checking…
            </Badge>
          ) : isConnected ? (
            <Badge variant="success" className="text-[10px] gap-1">
              <CheckCircle2 className="size-2.5" /> Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              Not connected
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          Generate using Claude or ChatGPT directly through our official custom connector.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {!isConnected ? (
          /* State (a): Not connected */
          <div className="rounded-xl border border-border/80 bg-muted/20 p-5 text-center space-y-3">
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              Connect your Claude or ChatGPT account once. The model uses your personal subscription plan to craft and refine your site.
            </p>
            <Button asChild className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90 text-xs font-semibold">
              <Link to="/connect">
                Connect Claude or ChatGPT <ExternalLink className="size-3.5" />
              </Link>
            </Button>
          </div>
        ) : (
          /* State (b) & (c): Connected & Live polling status */
          <div className="space-y-4">
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-2">
              <div className="text-xs font-medium text-foreground">
                Now say this in your chat:
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background p-2.5">
                <span className="font-mono text-xs font-semibold text-accent truncate">
                  {CHAT_PROMPT}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void copyPrompt()}
                  className="h-7 gap-1.5 text-xs shrink-0"
                >
                  {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>

            {/* Live status transitions: waiting for chat -> received, checking -> ready / needs fixes */}
            <div className="rounded-xl border border-border p-4 bg-muted/20 space-y-3">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-muted-foreground">Status</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => void fetchStatus()}
                  className="size-6 text-muted-foreground hover:text-foreground"
                  aria-label="Refresh status"
                >
                  <RefreshCw className="size-3" />
                </Button>
              </div>

              {(!latestJob || latestJob.status === "queued") && (
                <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-accent shrink-0" />
                  <span>Waiting for your chat to send instructions…</span>
                </div>
              )}

              {latestJob &&
                (latestJob.status === "reading" ||
                  latestJob.status === "writing" ||
                  latestJob.status === "checking" ||
                  latestJob.status === "saving") && (
                  <div className="flex items-center gap-2.5 text-xs text-accent font-medium">
                    <Loader2 className="size-4 animate-spin shrink-0" />
                    <span>Received, checking ({latestJob.message || "validating output"}…)</span>
                  </div>
                )}

              {latestJob && latestJob.status === "done" && (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-success font-medium">
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span>Portfolio is ready!</span>
                  </div>
                  <Button asChild size="sm" className="gap-1.5 bg-accent text-accent-foreground text-xs font-semibold h-7">
                    <Link to="/studio">
                      Open in Studio <ArrowRight className="size-3" />
                    </Link>
                  </Button>
                </div>
              )}

              {latestJob && latestJob.status === "failed" && (
                <Alert variant="destructive" className="py-2.5">
                  <AlertTriangle className="size-4" />
                  <AlertTitle className="text-xs font-semibold">Needs fixes</AlertTitle>
                  <AlertDescription className="text-xs space-y-1 mt-1">
                    <p>{latestJob.error?.message ?? "Your chat output didn't pass our checks."}</p>
                    {latestJob.error?.details && latestJob.error.details.length > 0 && (
                      <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px] opacity-90">
                        {latestJob.error.details.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    )}
                    <p className="text-[11px] opacity-75 pt-1">
                      We have automatically returned these specific instructions to your chat model so it can fix them.
                    </p>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
