import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { apiClient, type McpStatusResponse, type McpConnection } from "@/lib/api-client";
import { formatRelativeDate } from "@/lib/date";
import { Bot, CheckCircle2, Loader2, Trash2, ExternalLink, RefreshCw, AlertCircle } from "lucide-react";

export function ConnectedAppsSection() {
  const [loading, setLoading] = React.useState(true);
  const [comingSoon, setComingSoon] = React.useState(false);
  const [mcpStatus, setMcpStatus] = React.useState<McpStatusResponse | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = React.useState<string | null>(null);
  const [confirmConnection, setConfirmConnection] = React.useState<McpConnection | null>(null);

  const fetchStatus = React.useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await apiClient.getMcpStatus();
      setMcpStatus(data);
      setComingSoon(false);
    } catch (err: unknown) {
      if ((err as { isNotFound?: boolean })?.isNotFound) {
        setComingSoon(true);
      } else {
        setErrorMsg(err instanceof Error ? err.message : "Failed to load connected apps.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const handleDisconnect = async () => {
    if (!confirmConnection) return;
    setDisconnectingId(confirmConnection.clientId);
    try {
      await apiClient.disconnectMcpConnection(confirmConnection.clientId);
      setConfirmConnection(null);
      await fetchStatus();
    } catch (err: unknown) {
      if ((err as { isNotFound?: boolean })?.isNotFound) {
        setComingSoon(true);
      } else {
        setErrorMsg(err instanceof Error ? err.message : "Failed to disconnect app.");
      }
    } finally {
      setDisconnectingId(null);
    }
  };

  const connections = mcpStatus?.connections ?? [];
  const isConnected = mcpStatus?.connected === true && connections.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="size-4 text-accent" />
            Connected Apps
          </CardTitle>
          {loading ? (
            <Badge variant="outline" className="text-[10px]">
              Checking…
            </Badge>
          ) : comingSoon ? (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              Coming soon
            </Badge>
          ) : isConnected ? (
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
        <CardDescription className="text-xs">
          Connect your Claude or ChatGPT desktop or web app to build and refine your portfolio using your own subscription.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {comingSoon ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Coming soon</p>
            <p>The connected apps endpoint is rolling out soon.</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
            <Loader2 className="size-4 animate-spin text-accent" />
            <span>Loading connected apps…</span>
          </div>
        ) : (
          <>
            {errorMsg && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}

            {!isConnected ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <Bot className="size-5" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <p className="text-xs font-semibold text-foreground">Not connected</p>
                  <p className="text-xs text-muted-foreground">
                    Connect Claude or ChatGPT to create and edit your portfolio directly from your chat app.
                  </p>
                </div>
                <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
                  <Link to="/connect">
                    Connect Claude or ChatGPT
                    <ExternalLink className="size-3" />
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="divide-y divide-border rounded-xl border border-border bg-card">
                  {connections.map((conn) => (
                    <div
                      key={conn.clientId}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{conn.name}</span>
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {conn.clientId.slice(0, 8)}…
                          </Badge>
                        </div>
                        <p className="text-muted-foreground">
                          connected {formatRelativeDate(conn.connectedAt)}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={disconnectingId === conn.clientId}
                        onClick={() => setConfirmConnection(conn)}
                        className="h-8 gap-1.5 text-xs self-start sm:self-auto"
                      >
                        {disconnectingId === conn.clientId ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                        Disconnect
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <Button asChild variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground">
                    <Link to="/connect">
                      Connect another app
                      <ExternalLink className="size-3 ml-1" />
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void fetchStatus()}
                    className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className="size-3.5" />
                    Refresh
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        <Dialog open={!!confirmConnection} onOpenChange={(open) => !open && setConfirmConnection(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="size-5" />
                Disconnect {confirmConnection?.name || "app"}?
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to disconnect <strong>{confirmConnection?.name}</strong>? Its access tokens will be revoked immediately and it will no longer be able to interact with your portfolio.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmConnection(null)}
                disabled={!!disconnectingId}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleDisconnect()}
                disabled={!!disconnectingId}
                className="gap-2"
              >
                {disconnectingId ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Yes, Disconnect
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
