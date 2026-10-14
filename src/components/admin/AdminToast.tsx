import * as React from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

export function AdminToast({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto flex items-center justify-between gap-2 p-3 rounded-xl border shadow-lg text-xs animate-in slide-in-from-bottom-2",
            toast.type === "success" && "bg-card border-accent/40 text-foreground",
            toast.type === "error" && "bg-card border-destructive/40 text-destructive",
            toast.type === "info" && "bg-card border-border text-foreground"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            {toast.type === "success" && <CheckCircle2 className="size-4 shrink-0 text-accent" />}
            {toast.type === "error" && <AlertCircle className="size-4 shrink-0 text-destructive" />}
            <span className="truncate">{toast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="text-muted-foreground hover:text-foreground shrink-0 p-1"
            aria-label="Dismiss"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
