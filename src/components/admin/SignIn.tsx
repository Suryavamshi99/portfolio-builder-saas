import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ShieldAlert, ShieldCheck, KeyRound, Copy, Check, Download, Loader2, ArrowLeft } from "lucide-react";
import { QrCode } from "./qr";

export interface SignInProps {
  onDone: () => void;
}

type Step = "password" | "totp" | "enroll" | "recovery";

export function SignIn({ onDone }: SignInProps) {
  const [step, setStep] = React.useState<Step>("password");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Form states
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [useRecoveryCode, setUseRecoveryCode] = React.useState(false);

  // Enrollment data
  const [enrollData, setEnrollData] = React.useState<{ otpauthUri: string; secret: string } | null>(null);
  const [recoveryCodes, setRecoveryCodes] = React.useState<string[]>([]);
  const [savedAcknowledged, setSavedAcknowledged] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  // Load enrollment data when step transitions to enroll
  React.useEffect(() => {
    if (step === "enroll" && !enrollData) {
      void (async () => {
        setLoading(true);
        setError(null);
        try {
          const res = await fetch("/api/admin/2fa/enroll/start", { method: "POST" });
          if (!res.ok) {
            const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
            setError(data?.error?.message ?? "Failed to initialize 2FA setup");
            return;
          }
          const data = (await res.json()) as { otpauthUri: string; secret: string };
          setEnrollData(data);
        } catch {
          setError("Network error initializing 2FA setup");
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [step, enrollData]);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = (await res.json().catch(() => null)) as {
        step?: "enroll" | "totp";
        error?: { message?: string };
        retryAfterSeconds?: number;
      } | null;

      if (!res.ok) {
        if (res.status === 429) {
          setError(
            data?.retryAfterSeconds
              ? `Account locked due to repeated failures. Retry in ${data.retryAfterSeconds}s.`
              : "Too many attempts. Account temporarily locked.",
          );
        } else {
          setError(data?.error?.message ?? "Invalid credentials");
        }
        return;
      }

      if (data?.step === "enroll") {
        setStep("enroll");
      } else {
        setStep("totp");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTotpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login/totp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: { message?: string };
        retryAfterSeconds?: number;
      } | null;

      if (!res.ok) {
        if (res.status === 429) {
          setError(
            data?.retryAfterSeconds
              ? `Verification locked. Retry in ${data.retryAfterSeconds}s.`
              : "Too many attempts. Account temporarily locked.",
          );
        } else {
          setError(data?.error?.message ?? "Invalid code. Please try again.");
        }
        return;
      }

      onDone();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleEnrollConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/2fa/enroll/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = (await res.json().catch(() => null)) as {
        recoveryCodes?: string[];
        error?: { message?: string };
      } | null;

      if (!res.ok || !data?.recoveryCodes) {
        setError(data?.error?.message ?? "Invalid verification code. Please check your authenticator.");
        return;
      }

      setRecoveryCodes(data.recoveryCodes);
      setStep("recovery");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopyCodes() {
    void navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownloadCodes() {
    const text = `Shipfolio Admin Recovery Codes\nGenerated: ${new Date().toISOString()}\n\n` +
      recoveryCodes.map((c, i) => `${i + 1}. ${c}`).join("\n") +
      "\n\nEach code can only be used once. Store these securely.";
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "shipfolio-admin-recovery-codes.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center space-y-6">
      {step === "password" && (
        <Card className="border-border/80">
          <CardHeader className="space-y-1 text-center">
            <ShieldAlert className="mx-auto size-8 text-accent" />
            <CardTitle className="text-xl font-bold text-foreground">Admin sign-in</CardTitle>
            <CardDescription>Enter your administrator credentials to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="admin-username" className="text-xs font-medium text-muted-foreground">
                  Username
                </label>
                <Input
                  id="admin-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="admin-password" className="text-xs font-medium text-muted-foreground">
                  Password
                </label>
                <Input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : "Continue"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {step === "totp" && (
        <Card className="border-border/80">
          <CardHeader className="space-y-1 text-center">
            <KeyRound className="mx-auto size-8 text-accent" />
            <CardTitle className="text-xl font-bold text-foreground">
              {useRecoveryCode ? "Enter recovery code" : "Two-factor authentication"}
            </CardTitle>
            <CardDescription>
              {useRecoveryCode
                ? "Enter one of your 10-character backup recovery codes"
                : "Enter the 6-digit code from your authenticator app"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTotpSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="admin-totp-code" className="text-xs font-medium text-muted-foreground">
                  {useRecoveryCode ? "Recovery Code (XXXXX-XXXXX)" : "Authenticator Code"}
                </label>
                <Input
                  id="admin-totp-code"
                  type="text"
                  inputMode={useRecoveryCode ? "text" : "numeric"}
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder={useRecoveryCode ? "XXXXX-XXXXX" : "123456"}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="font-mono text-center tracking-widest"
                  required
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : "Verify"}
              </Button>

              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep("password");
                  }}
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="size-3" /> Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setCode("");
                    setUseRecoveryCode(!useRecoveryCode);
                  }}
                  className="text-accent underline-offset-4 hover:underline"
                >
                  {useRecoveryCode ? "Use authenticator app" : "Use a recovery code"}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {step === "enroll" && (
        <Card className="border-border/80">
          <CardHeader className="space-y-1 text-center">
            <ShieldCheck className="mx-auto size-8 text-accent" />
            <CardTitle className="text-xl font-bold text-foreground">Set up Two-Factor Authentication</CardTitle>
            <CardDescription>Scan the QR code with your authenticator app to enable 2FA</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && !enrollData ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : enrollData ? (
              <form onSubmit={handleEnrollConfirm} className="space-y-4">
                <div className="flex justify-center py-2">
                  <QrCode value={enrollData.otpauthUri} size={180} />
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground">Manual key</span>
                  <div className="flex items-center justify-between rounded border border-border bg-muted/40 px-3 py-1.5 font-mono text-xs">
                    <span className="select-all tracking-wider">{enrollData.secret}</span>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(enrollData.secret);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="ml-2 text-muted-foreground hover:text-foreground"
                      title="Copy secret key"
                    >
                      {copied ? <Check className="size-3.5 text-accent" /> : <Copy className="size-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="admin-enroll-code" className="text-xs font-medium text-muted-foreground">
                    Confirm 6-digit code
                  </label>
                  <Input
                    id="admin-enroll-code"
                    type="text"
                    inputMode="numeric"
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="font-mono text-center tracking-widest"
                    required
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : "Enable 2FA"}
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
      )}

      {step === "recovery" && (
        <Card className="border-border/80">
          <CardHeader className="space-y-1 text-center">
            <ShieldCheck className="mx-auto size-8 text-accent" />
            <CardTitle className="text-xl font-bold text-foreground">Save your recovery codes</CardTitle>
            <CardDescription>
              Keep these 8 codes in a safe place. They are the only way to recover access if you lose your authenticator.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs">
              {recoveryCodes.map((c) => (
                <div key={c} className="rounded bg-background/80 px-2 py-1.5 text-center font-medium">
                  {c}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleCopyCodes} className="flex-1 gap-1.5">
                {copied ? <Check className="size-3.5 text-accent" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy codes"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleDownloadCodes} className="flex-1 gap-1.5">
                <Download className="size-3.5" />
                Download (.txt)
              </Button>
            </div>

            <label className="flex items-start gap-2 pt-2 text-xs text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={savedAcknowledged}
                onChange={(e) => setSavedAcknowledged(e.target.checked)}
                className="mt-0.5 rounded border-border"
              />
              <span>I have safely backed up these recovery codes.</span>
            </label>

            <Button
              type="button"
              className="w-full"
              disabled={!savedAcknowledged}
              onClick={onDone}
            >
              Continue to Console
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
