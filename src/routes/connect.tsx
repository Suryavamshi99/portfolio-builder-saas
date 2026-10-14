import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Bot,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  MessageSquarePlus,
  Wrench,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { apiClient, type McpStatusResponse } from "@/lib/api-client";

export const Route = createFileRoute("/connect")({
  head: () => ({
    meta: [
      { title: "Connect Claude or ChatGPT — Shipfolio" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ConnectPage,
});

function ConnectPage() {
  return (
    <AuthGuard actionName="connect Claude or ChatGPT">
      <ConnectContent />
    </AuthGuard>
  );
}

export function ConnectContent({ initialStatus }: { initialStatus?: McpStatusResponse } = {}) {
  const [activeTab, setActiveTab] = React.useState<"claude" | "chatgpt">("claude");
  const [copied, setCopied] = React.useState(false);
  const [copiedPrompt, setCopiedPrompt] = React.useState(false);
  const [showDetails, setShowDetails] = React.useState(false);
  const [mcpStatus, setMcpStatus] = React.useState<McpStatusResponse | null>(initialStatus ?? null);
  const [loading, setLoading] = React.useState(!initialStatus);
  const [comingSoon, setComingSoon] = React.useState(false);

  const [connectorUrl, setConnectorUrl] = React.useState<string>("");
  const CHAT_PROMPT = "Build my Shipfolio portfolio";

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setConnectorUrl(`${window.location.origin}/mcp`);
    }
  }, []);

  const checkStatus = React.useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const data = await apiClient.getMcpStatus();
      setMcpStatus(data);
      setComingSoon(false);
    } catch (err: unknown) {
      if ((err as { isNotFound?: boolean })?.isNotFound) {
        setComingSoon(true);
      }
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void checkStatus(true);
    // Auto-poll every 3s so the user sees the connected screen immediately upon authorization
    const timer = setInterval(() => {
      void checkStatus(false);
    }, 3000);
    return () => clearInterval(timer);
  }, [checkStatus]);

  const copyUrl = async () => {
    if (!connectorUrl) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(connectorUrl);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = connectorUrl;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const copyPrompt = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(CHAT_PROMPT);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = CHAT_PROMPT;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch {
      // ignore
    }
  };

  const isConnected = mcpStatus?.connected === true;

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-4">
      <div className="flex items-center justify-between">
        <Link
          to="/onboarding"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to Wizard
        </Link>
        <div>
          {loading ? (
            <Badge variant="outline" className="text-[10px]">
              Checking status…
            </Badge>
          ) : isConnected ? (
            <Badge variant="success" className="text-[10px] gap-1">
              <CheckCircle2 className="size-2.5" /> Connected ✓
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              Not connected
            </Badge>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Sparkles className="size-6 text-accent" />
          ) : (
            <Bot className="size-6 text-accent" />
          )}
          <h1 className="text-2xl font-bold tracking-tight">
            {isConnected ? "Connected to Claude" : "Connect Claude or ChatGPT"}
          </h1>
        </div>
        <p className="text-xs text-muted-foreground sm:text-sm mt-1 leading-relaxed">
          {isConnected
            ? "Your custom MCP connector is successfully authorized. Follow the steps below in Claude to build your portfolio."
            : "Add Shipfolio as a custom MCP connector to use your own model subscription directly."}
        </p>
      </div>

      {comingSoon && (
        <Alert className="border-accent/40 bg-accent/5">
          <AlertCircle className="size-4 text-accent" />
          <AlertTitle className="text-xs font-semibold">Endpoint status</AlertTitle>
          <AlertDescription className="text-xs">
            The MCP connector endpoint is rolling out soon. You can follow the setup instructions below once enabled.
          </AlertDescription>
        </Alert>
      )}

      {isConnected ? (
        /* State: Connected -> Instructions screen on what to do next */
        <div className="space-y-6">
          <div className="rounded-2xl border border-success/30 bg-success/5 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-success/15 text-success shrink-0">
                <CheckCircle2 className="size-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-tight text-foreground">
                  MCP Connection Active
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Shipfolio is authorized. Claude can now communicate directly with your profile to craft your site.
                </p>
              </div>
            </div>
          </div>

          {/* Next steps instruction card */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-accent" />
                <CardTitle className="text-sm sm:text-base">What to do next</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Follow these 4 simple steps to generate and preview your personalized portfolio website.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-1">
              {/* Step 1 */}
              <div className="flex gap-3.5 items-start">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent font-semibold text-xs mt-0.5">
                  1
                </div>
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <MessageSquarePlus className="size-4 text-accent" />
                      Start a new chat session
                    </span>
                    <Button asChild variant="outline" size="sm" className="h-7 text-xs gap-1">
                      <a href="https://claude.ai" target="_blank" rel="noopener noreferrer">
                        Open Claude.ai <ExternalLink className="size-3" />
                      </a>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Open Claude (or ChatGPT) and start a <strong className="text-foreground">brand-new chat</strong>. Custom MCP connectors only initialize when starting a fresh conversation.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-3.5 items-start">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent font-semibold text-xs mt-0.5">
                  2
                </div>
                <div className="space-y-1 flex-1 min-w-0">
                  <span className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Wrench className="size-4 text-accent" />
                    Verify the Shipfolio connector is active
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Look at the prompt bar in Claude and make sure the <strong className="text-foreground">Shipfolio connector</strong> is enabled in the tools menu.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-3.5 items-start">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent font-semibold text-xs mt-0.5">
                  3
                </div>
                <div className="space-y-2 flex-1 min-w-0">
                  <span className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Bot className="size-4 text-accent" />
                    Paste and send this prompt
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Copy and send this command into your new chat:
                  </p>
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
                      {copiedPrompt ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                      {copiedPrompt ? "Copied" : "Copy Prompt"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex gap-3.5 items-start">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent font-semibold text-xs mt-0.5">
                  4
                </div>
                <div className="space-y-1 flex-1 min-w-0">
                  <span className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="size-4 text-accent" />
                    Watch your live portfolio build
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Claude will query your uploaded resume and details, generate the complete HTML & CSS portfolio, and send it directly back to Shipfolio. Live status updates will display in your wizard.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Button asChild className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90 font-semibold flex-1 justify-center">
              <Link to="/onboarding">
                Return to Wizard & Watch Live <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2 flex-1 justify-center">
              <Link to="/studio">
                Go to Studio
              </Link>
            </Button>
          </div>

          {/* Collapsible toggle for connector technical details & URL */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowDetails((prev) => !prev)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <span>{showDetails ? "Hide" : "Show"} connector technical details & URL</span>
              {showDetails ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
            {showDetails && (
              <div className="mt-3 space-y-4">
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="text-sm">Your Connector URL</CardTitle>
                    <CardDescription className="text-xs">
                      Copy this URL if you need to reconfigure Claude or ChatGPT.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="flex-1 rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-foreground select-all break-all sm:truncate">
                        {connectorUrl || "Loading…"}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void copyUrl()}
                        className="h-9 gap-1.5 text-xs shrink-0 w-full sm:w-auto justify-center"
                        disabled={!connectorUrl}
                      >
                        {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                        {copied ? "Copied" : "Copy URL"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* State: Not connected -> Show setup instructions */
        <>
          {/* Connector URL copy card */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-sm">Your Connector URL</CardTitle>
              <CardDescription className="text-xs">
                Copy this URL into your Claude.ai or ChatGPT connector settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex-1 rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-foreground select-all break-all sm:truncate">
                  {connectorUrl || "Loading…"}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void copyUrl()}
                  className="h-9 gap-1.5 text-xs shrink-0 w-full sm:w-auto justify-center"
                  disabled={!connectorUrl}
                >
                  {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                  {copied ? "Copied" : "Copy URL"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Instructions Tab panel (no new external dependencies) */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Setup Instructions</CardTitle>
                <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab("claude")}
                    className={`rounded-md px-3 py-1 font-medium transition-all ${
                      activeTab === "claude"
                        ? "bg-accent text-accent-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Claude.ai
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("chatgpt")}
                    className={`rounded-md px-3 py-1 font-medium transition-all ${
                      activeTab === "chatgpt"
                        ? "bg-accent text-accent-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    ChatGPT
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              {activeTab === "claude" ? (
                <div className="space-y-3">
                  <div className="text-xs font-medium text-foreground">Steps for Claude.ai:</div>
                  <ol className="space-y-2.5 text-xs text-muted-foreground list-decimal pl-4 leading-relaxed">
                    <li>
                      Open <strong className="text-foreground">Claude.ai</strong> and go to <strong className="text-foreground">Settings</strong>.
                    </li>
                    <li>
                      Select <strong className="text-foreground">Connectors</strong> from the settings menu.
                    </li>
                    <li>
                      Click <strong className="text-foreground">Add custom connector</strong>.
                    </li>
                    <li>
                      Paste your Shipfolio connector URL copied above.
                    </li>
                    <li>
                      Log in when prompted to authorize Shipfolio with your account.
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs font-medium text-foreground">Steps for ChatGPT:</div>
                  <ol className="space-y-2.5 text-xs text-muted-foreground list-decimal pl-4 leading-relaxed">
                    <li>
                      Open <strong className="text-foreground">ChatGPT</strong> and go to <strong className="text-foreground">Settings</strong>.
                    </li>
                    <li>
                      Select <strong className="text-foreground">Connectors</strong> (or MCP Integrations).
                    </li>
                    <li>
                      Click <strong className="text-foreground">Add</strong>.
                    </li>
                    <li>
                      Paste your Shipfolio connector URL copied above.
                    </li>
                    <li>
                      Confirm authorization in the popup dialog.
                    </li>
                  </ol>
                </div>
              )}

              <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 text-xs text-muted-foreground flex items-start gap-2.5">
                <ShieldCheck className="size-4 text-accent shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Shipfolio connects over secure OAuth 2.1 PKCE with scoped permissions. You can revoke access at any time from your account settings.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2">
            <Button asChild variant="outline" size="sm" className="gap-2 text-xs w-full sm:w-auto justify-center">
              <Link to="/onboarding">
                <ArrowLeft className="size-3.5" />
                Back to Wizard
              </Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void checkStatus(true)}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full sm:w-auto justify-center"
            >
              <RefreshCw className="size-3.5" />
              Refresh Connection Status
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

