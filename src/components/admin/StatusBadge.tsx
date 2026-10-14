import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();

  if (normalized === "done" || normalized === "published" || normalized === "live" || normalized === "verified" || normalized === "ready") {
    return <Badge variant="success" className="text-[10px] uppercase font-mono">{status}</Badge>;
  }

  if (normalized === "failed" || normalized === "cancelled" || normalized === "cancelled_by_admin" || normalized === "error") {
    return <Badge variant="destructive" className="text-[10px] uppercase font-mono">{status}</Badge>;
  }

  if (normalized === "running" || normalized === "queued" || normalized === "pending" || normalized === "in_progress") {
    return <Badge variant="warning" className="text-[10px] uppercase font-mono">{status}</Badge>;
  }

  if (normalized === "pro") {
    return <Badge variant="accent" className="text-[10px] uppercase font-mono">pro</Badge>;
  }

  if (normalized === "free") {
    return <Badge variant="secondary" className="text-[10px] uppercase font-mono">free</Badge>;
  }

  return <Badge variant="outline" className="text-[10px] uppercase font-mono">{status}</Badge>;
}
