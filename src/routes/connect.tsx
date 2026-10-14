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
  ShieldCheck,
  RefreshCw,
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

function ConnectContent() {
  const [activeTab, setActiveTab] = React.useState<"claude" | "chatgpt">("claude");
  const [copied, setCopied] = React.useState(false);
  const [mcpStatus, setMcpStatus] = React.useState<McpStatusResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [comingSoon, setComingSoon] = React.useState(false);

  const [connectorUrl, setConnectorUrl] = React.useState<string>("");

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setConnectorUrl(`${window.location.origin}/mcp`);
    }
  }, []);

  const checkStatus = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.getMcpStatus();
      setMcpStatus(data);
      setComingSoon(false);
    } catch (err: unknown) {
      if ((err as { isNotFound?: boolean })?.isNotFound) {
        setComingSoon(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void checkStatus();
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
          <Bot className="size-6 text-accent" />
          <h1 className="text-2xl font-bold tracking-tight">Connect Claude or ChatGPT</h1>
        </div>
        <p className="text-xs text-muted-foreground sm:text-sm mt-1 leading-relaxed">
          Add Shipfolio as a custom MCP connector to use your own model subscription directly.
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
          onClick={() => void checkStatus()}
          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full sm:w-auto justify-center"
        >
          <RefreshCw className="size-3.5" />
          Refresh Connection Status
        </Button>
      </div>
    </div>
  );
}
