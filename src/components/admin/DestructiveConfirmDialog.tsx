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
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle } from "lucide-react";
import { validateReason, validateConfirmEmail, formatErrorMessage } from "@/lib/admin-api";

export interface DestructiveConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string | undefined;
  confirmVariant?: "destructive" | "default" | undefined;
  requiredConfirmEmail?: string | undefined;
  onConfirm: (reason: string, confirmEmail?: string | undefined) => Promise<void>;
}

export function DestructiveConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm action",
  confirmVariant = "destructive",
  requiredConfirmEmail,
  onConfirm,
}: DestructiveConfirmDialogProps) {
  const [reason, setReason] = React.useState("");
  const [typedEmail, setTypedEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const cancelButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (open) {
      setReason("");
      setTypedEmail("");
      setError(null);
      // Ensure cancel button is focused when opened (default focus)
      setTimeout(() => {
        cancelButtonRef.current?.focus();
      }, 50);
    }
  }, [open]);

  const reasonValidation = validateReason(reason);
  const emailValid = requiredConfirmEmail
    ? validateConfirmEmail(requiredConfirmEmail, typedEmail)
    : true;
  const canSubmit = reasonValidation.valid && emailValid && !submitting;

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setSubmitting(true);
    try {
      await onConfirm(reason.trim(), typedEmail.trim());
      onOpenChange(false);
    } catch (err: unknown) {
      setError(formatErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleConfirm} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="size-5 text-destructive shrink-0" />
              {title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              {description}
            </DialogDescription>
          </DialogHeader>

          {requiredConfirmEmail && (
            <div className="space-y-1.5 rounded-lg border border-border/80 bg-muted/30 p-3">
              <label htmlFor="confirm-user-email" className="text-xs font-medium text-foreground block">
                Type <strong className="text-destructive font-mono">{requiredConfirmEmail}</strong> to confirm:
              </label>
              <Input
                id="confirm-user-email"
                type="text"
                value={typedEmail}
                onChange={(e) => setTypedEmail(e.target.value)}
                placeholder={requiredConfirmEmail}
                autoComplete="off"
                disabled={submitting}
                className="text-xs font-mono"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="confirm-reason" className="text-xs font-medium text-muted-foreground">
                Audit Reason (required, 3–300 characters)
              </label>
              <span className="text-[11px] text-muted-foreground">
                {reason.trim().length}/300
              </span>
            </div>
            <Textarea
              id="confirm-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this action is being taken (e.g., User requested account deletion via support ticket #123)"
              className="h-20 text-xs"
              maxLength={300}
              disabled={submitting}
              required
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              ref={cancelButtonRef}
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={confirmVariant}
              disabled={!canSubmit}
              className="text-xs gap-1.5 font-medium"
            >
              {submitting ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
