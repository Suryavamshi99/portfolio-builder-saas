import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldAlert } from "lucide-react";
import { registerStepUpHandler } from "@/lib/admin-stepup";

export interface StepUpDialogProps {
  /** Optional callback when step-up successfully completes */
  onSuccess?: () => void;
}

export function StepUpDialog({ onSuccess }: StepUpDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const resolverRef = React.useRef<((value: boolean) => void) | null>(null);

  React.useEffect(() => {
    const unregister = registerStepUpHandler(
      () =>
        new Promise<boolean>((resolve) => {
          resolverRef.current = resolve;
          setPassword("");
          setCode("");
          setError(null);
          setOpen(true);
        }),
    );
    return unregister;
  }, []);

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setOpen(false);
      if (resolverRef.current) {
        resolverRef.current(false);
        resolverRef.current = null;
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/step-up", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password, code: code.trim() }),
      });

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: { code?: string; message?: string };
        retryAfterSeconds?: number;
      } | null;

      if (!res.ok) {
        if (res.status === 429) {
          setError(
            data?.retryAfterSeconds
              ? `Locked. Try again in ${data.retryAfterSeconds}s.`
              : "Too many failed attempts. Locked.",
          );
        } else {
          setError(data?.error?.message ?? "Invalid password or verification code");
        }
        return;
      }

      setOpen(false);
      if (resolverRef.current) {
        resolverRef.current(true);
        resolverRef.current = null;
      }
      onSuccess?.();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-5" />
              <DialogTitle>Confirm identity (Step-up)</DialogTitle>
            </div>
            <DialogDescription>
              This is a protected or destructive action. Re-enter your admin password and current 2FA code to continue.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-4">
            <div className="space-y-1">
              <label htmlFor="stepup-password" className="text-xs font-medium text-muted-foreground">
                Admin Password
              </label>
              <Input
                id="stepup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                autoFocus
                required
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="stepup-code" className="text-xs font-medium text-muted-foreground">
                6-digit 2FA Code (or Recovery Code)
              </label>
              <Input
                id="stepup-code"
                type="text"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="font-mono tracking-wider"
                required
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Confirm and Proceed"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
