// replaced by 08c
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
import { ShieldAlert, Loader2 } from "lucide-react";

export interface StepUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function StepUpDialog({ open, onOpenChange, onSuccess, onCancel }: StepUpDialogProps) {
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setPassword("");
      setCode("");
      setError(null);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/step-up", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password, code }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(data?.error?.message ?? "Step-up verification failed.");
        return;
      }
      onOpenChange(false);
      onSuccess?.();
    } catch {
      setError("Network error during step-up verification.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) onCancel?.();
      }}
    >
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-accent" />
              Security Confirmation Required
            </DialogTitle>
            <DialogDescription>
              This is a protected action. Please confirm your admin password and 2FA code to continue.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="stepup-password" className="text-xs font-medium text-muted-foreground">
                Admin Password
              </label>
              <Input
                id="stepup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="stepup-code" className="text-xs font-medium text-muted-foreground">
                2FA Code or Recovery Code
              </label>
              <Input
                id="stepup-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6 digits or XXXXX-XXXXX"
                autoComplete="one-time-code"
                required
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => {
                onOpenChange(false);
                onCancel?.();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !password || !code}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Confirm"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
