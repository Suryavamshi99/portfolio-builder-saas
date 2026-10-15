import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { apiClient, type CustomDomain } from "@/lib/api-client";
import { usePricing } from "@/lib/use-pricing";
import {
  Globe,
  Copy,
  Check,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Loader2,
  Sparkles,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

interface CustomDomainSectionProps {
  hasPaidAccess?: boolean;
  onUpgrade?: () => void;
  upgrading?: boolean;
}

export function CustomDomainSection({
  hasPaidAccess = true,
  onUpgrade,
  upgrading = false,
}: CustomDomainSectionProps) {
  const pricing = usePricing();
  const [loading, setLoading] = React.useState(true);
  const [comingSoon, setComingSoon] = React.useState(false);
  const [is402, setIs402] = React.useState(false);
  const [domain, setDomain] = React.useState<CustomDomain | null>(null);

  // Input state
  const [hostnameInput, setHostnameInput] = React.useState("");
  const [addingDomain, setAddingDomain] = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

  // User feedback
  const [infoMessage, setInfoMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  const fetchDomain = React.useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setErrorMessage(null);
      const res = await apiClient.getDomains();
      setDomain(res.domain);
      setComingSoon(false);
      setIs402(false);
    } catch (err: unknown) {
      if ((err as { isNotFound?: boolean })?.isNotFound) {
        setComingSoon(true);
      } else if ((err as { status?: number })?.status === 402) {
        setIs402(true);
      } else {
        if (!silent) {
          setErrorMessage(err instanceof Error ? err.message : "Failed to load domain configuration.");
        }
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchDomain();
  }, [fetchDomain]);

  // Poll GET /api/domains every 15s while pending or verified
  React.useEffect(() => {
    if (!domain || domain.status === "live" || comingSoon || is402) return;

    const interval = setInterval(() => {
      void fetchDomain(true);
    }, 15000);

    return () => clearInterval(interval);
  }, [domain, comingSoon, is402, fetchDomain]);

  const handleCopy = async (key: string, text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = hostnameInput
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/+$/, "");
    if (!trimmed) return;

    setAddingDomain(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const res = await apiClient.addDomain(trimmed);
      setDomain(res.domain);
      setHostnameInput("");
    } catch (err: unknown) {
      if ((err as { isNotFound?: boolean })?.isNotFound) {
        setComingSoon(true);
      } else if ((err as { status?: number })?.status === 402) {
        setIs402(true);
      } else {
        setErrorMessage(err instanceof Error ? err.message : "Failed to add domain.");
      }
    } finally {
      setAddingDomain(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const res = await apiClient.verifyDomain();
      // res may have message or updated status / domain
      if (res.message) {
        setInfoMessage(res.message);
      }
      if (res.domain) {
        setDomain(res.domain);
      } else if (res.status) {
        setDomain((prev) =>
          prev
            ? {
                ...prev,
                status: res.status as "pending" | "verified" | "live",
                dns: res.dns ?? prev.dns,
              }
            : null
        );
      }
      // Re-fetch to get freshest backend record
      await fetchDomain(true);
    } catch (err: unknown) {
      if ((err as { isNotFound?: boolean })?.isNotFound) {
        setComingSoon(true);
      } else if ((err as { status?: number })?.status === 429) {
        setErrorMessage("Please wait at least 10 seconds between verification attempts.");
      } else {
        setErrorMessage(err instanceof Error ? err.message : "Verification request failed.");
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      await apiClient.deleteDomain();
      setDomain(null);
      setDeleteDialogOpen(false);
    } catch (err: unknown) {
      if ((err as { isNotFound?: boolean })?.isNotFound) {
        setComingSoon(true);
      } else {
        setErrorMessage(err instanceof Error ? err.message : "Failed to remove domain.");
      }
    } finally {
      setDeleting(false);
    }
  };

  const showFreeUpgrade = !hasPaidAccess || is402;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="size-4 text-accent" />
            Custom Domain
          </CardTitle>
          {loading ? (
            <Badge variant="outline" className="text-[10px]">
              Checking…
            </Badge>
          ) : comingSoon ? (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              Coming soon
            </Badge>
          ) : showFreeUpgrade ? (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              Pro Feature
            </Badge>
          ) : domain?.status === "live" ? (
            <Badge variant="success" className="gap-1 text-[10px]">
              <CheckCircle2 className="size-3" />
              Live
            </Badge>
          ) : domain?.status === "verified" ? (
            <Badge variant="accent" className="gap-1 text-[10px]">
              <CheckCircle2 className="size-3" />
              Verified
            </Badge>
          ) : domain?.status === "pending" ? (
            <Badge variant="warning" className="text-[10px]">
              Pending verification
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              No domain configured
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          Connect your personal apex domain or subdomain to your published portfolio.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {comingSoon ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Coming soon</p>
            <p>Custom domain mapping is rolling out soon.</p>
          </div>
        ) : showFreeUpgrade ? (
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-6 text-center space-y-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-accent/10 text-accent mx-auto">
              <Sparkles className="size-5" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h4 className="font-semibold text-sm text-foreground">Custom Domains Require Pro</h4>
              <p className="text-xs text-muted-foreground">
                Bring your own domain (e.g. <code>alex.dev</code> or <code>portfolio.alex.com</code>) with automatic SSL certificates and global edge routing.
              </p>
            </div>
            {onUpgrade && (
              <Button
                onClick={onUpgrade}
                disabled={upgrading}
                className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90 text-xs font-semibold"
              >
                {upgrading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                Unlock Pro + your domain · {pricing.today}
              </Button>
            )}
            <p className="text-[11px] text-muted-foreground">{pricing.fineprint}</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
            <Loader2 className="size-4 animate-spin text-accent" />
            <span>Loading domain configuration…</span>
          </div>
        ) : (
          <>
            {errorMessage && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            {infoMessage && (
              <Alert variant="accent">
                <CheckCircle2 className="size-4" />
                <AlertTitle>Notice</AlertTitle>
                <AlertDescription>{infoMessage}</AlertDescription>
              </Alert>
            )}

            {/* State A: No domain configured */}
            {!domain && (
              <div className="space-y-3">
                <form onSubmit={handleAddDomain} className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="portfolio.yourdomain.com or yourdomain.com"
                    value={hostnameInput}
                    onChange={(e) => setHostnameInput(e.target.value)}
                    disabled={addingDomain}
                    className="text-xs h-9 font-mono"
                  />
                  <Button
                    type="submit"
                    disabled={addingDomain || !hostnameInput.trim()}
                    className="h-9 gap-1.5 text-xs bg-accent text-accent-foreground shrink-0"
                  >
                    {addingDomain ? <Loader2 className="size-3.5 animate-spin" /> : <Globe className="size-3.5" />}
                    Add Domain
                  </Button>
                </form>
                <p className="text-[11px] text-muted-foreground">
                  You can connect an apex domain (e.g. <code>yourdomain.com</code>) or any subdomain. You must have already published your portfolio.
                </p>
              </div>
            )}

            {/* State B: Pending verification */}
            {domain && domain.status === "pending" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-border bg-card p-4 text-xs">
                  <div>
                    <span className="text-muted-foreground">Domain: </span>
                    <span className="font-semibold font-mono text-foreground">{domain.hostname}</span>
                  </div>
                  <Badge variant="warning" className="text-[10px] self-start sm:self-auto">
                    Pending TXT Record
                  </Badge>
                </div>

                <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3">
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-foreground">Step 1: Prove domain ownership</h4>
                    <p className="text-[11px] text-muted-foreground">
                      Add the following TXT record in your DNS provider (Cloudflare, Namecheap, GoDaddy, Route53, etc.).
                    </p>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-border bg-background/80">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-border bg-muted/40 text-[10px] uppercase text-muted-foreground font-mono">
                        <tr>
                          <th className="px-3 py-2">Type</th>
                          <th className="px-3 py-2">Name / Host</th>
                          <th className="px-3 py-2">Value / Content</th>
                          <th className="px-3 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border text-[11px] font-mono">
                        <tr>
                          <td className="px-3 py-2.5 font-semibold text-foreground">
                            {domain.verifyRecord.type}
                          </td>
                          <td className="px-3 py-2.5 max-w-[140px] truncate" title={domain.verifyRecord.name}>
                            {domain.verifyRecord.name}
                          </td>
                          <td className="px-3 py-2.5 max-w-[200px] truncate" title={domain.verifyRecord.value}>
                            {domain.verifyRecord.value}
                          </td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => void handleCopy("txt-val", domain.verifyRecord.value)}
                              className="h-7 px-2 text-[10px] gap-1"
                            >
                              {copiedKey === "txt-val" ? (
                                <Check className="size-3 text-success" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                              {copiedKey === "txt-val" ? "Copied" : "Copy Value"}
                            </Button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteDialogOpen(true)}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Trash2 className="size-3.5" />
                    Remove Domain
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleVerify()}
                    disabled={verifying}
                    className="h-8 gap-1.5 text-xs bg-accent text-accent-foreground font-semibold"
                  >
                    {verifying ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                    Verify now
                  </Button>
                </div>
              </div>
            )}

            {/* State C: Verified or Live */}
            {domain && (domain.status === "verified" || domain.status === "live") && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-border bg-card p-4 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Domain: </span>
                    <a
                      href={`https://${domain.hostname}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold font-mono text-foreground hover:underline inline-flex items-center gap-1"
                    >
                      {domain.hostname}
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {domain.status === "live" ? (
                      <Badge variant="success" className="gap-1 text-[10px]">
                        <CheckCircle2 className="size-2.5" />
                        Live
                      </Badge>
                    ) : (
                      <Badge variant="accent" className="gap-1 text-[10px]">
                        <CheckCircle2 className="size-2.5" />
                        Verified
                      </Badge>
                    )}
                  </div>
                </div>

                {domain.status === "verified" && (
                  <Alert variant="accent">
                    <CheckCircle2 className="size-4" />
                    <AlertTitle>Ownership verified</AlertTitle>
                    <AlertDescription className="text-xs">
                      Domain ownership is confirmed. Configure the DNS records below to point traffic to your portfolio. It will automatically flip to Live once DNS routing is detected.
                    </AlertDescription>
                  </Alert>
                )}

                {domain.dns && (
                  <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3">
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-foreground">DNS Records Configuration</h4>
                      <p className="text-[11px] text-muted-foreground">
                        Configure these records with your DNS provider to route visitors to your site.
                      </p>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-border bg-background/80">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-border bg-muted/40 text-[10px] uppercase text-muted-foreground font-mono">
                          <tr>
                            <th className="px-3 py-2">Type</th>
                            <th className="px-3 py-2">Host</th>
                            <th className="px-3 py-2">Target / Value</th>
                            <th className="px-3 py-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border text-[11px] font-mono">
                          {domain.dns.cname && domain.dns.cname.length > 0 && domain.dns.cname.map((val, idx) => (
                            <tr key={`cname-${idx}`}>
                              <td className="px-3 py-2.5 font-semibold text-foreground">CNAME</td>
                              <td className="px-3 py-2.5">{domain.hostname}</td>
                              <td className="px-3 py-2.5">{val}</td>
                              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => void handleCopy(`cname-${idx}`, val)}
                                  className="h-7 px-2 text-[10px] gap-1"
                                >
                                  {copiedKey === `cname-${idx}` ? (
                                    <Check className="size-3 text-success" />
                                  ) : (
                                    <Copy className="size-3" />
                                  )}
                                  {copiedKey === `cname-${idx}` ? "Copied" : "Copy"}
                                </Button>
                              </td>
                            </tr>
                          ))}

                          {domain.dns.a && domain.dns.a.length > 0 && domain.dns.a.map((val, idx) => (
                            <tr key={`a-${idx}`}>
                              <td className="px-3 py-2.5 font-semibold text-foreground">A</td>
                              <td className="px-3 py-2.5">@</td>
                              <td className="px-3 py-2.5">{val}</td>
                              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => void handleCopy(`a-${idx}`, val)}
                                  className="h-7 px-2 text-[10px] gap-1"
                                >
                                  {copiedKey === `a-${idx}` ? (
                                    <Check className="size-3 text-success" />
                                  ) : (
                                    <Copy className="size-3" />
                                  )}
                                  {copiedKey === `a-${idx}` ? "Copied" : "Copy"}
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteDialogOpen(true)}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Trash2 className="size-3.5" />
                    Remove
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void fetchDomain(false)}
                    className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className="size-3.5" />
                    Refresh Status
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Remove domain confirm dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="size-5" />
                Remove custom domain?
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to remove <strong>{domain?.hostname}</strong>? Traffic will stop pointing to your portfolio and you will need to re-verify ownership if you want to add it again.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="gap-2"
              >
                {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Yes, Remove Domain
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
