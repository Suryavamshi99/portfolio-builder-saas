import { FileQuestion } from "lucide-react";

export function EmptyState({
  message,
  description,
}: {
  message: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-border/70 bg-card/40 my-4">
      <FileQuestion className="size-8 text-muted-foreground/60 mb-2" />
      <p className="text-sm font-medium text-foreground">{message}</p>
      {description && <p className="text-xs text-muted-foreground mt-1 max-w-sm">{description}</p>}
    </div>
  );
}
